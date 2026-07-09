import { NextRequest, NextResponse } from 'next/server';
import { mcpDb, resolveAccessToken, assertWorkspaceOwnership } from '@/lib/mcp-oauth';
import { generateDescriptionForUser } from '@/lib/generate-description';

// Serveur MCP KLIP — transport Streamable HTTP (JSON-RPC 2.0), un seul endpoint
// POST. Pas de flux SSE : tous les outils sont synchrones (lecture/écriture DB
// rapides + un appel IA). Authentifié par Authorization: Bearer <access_token>
// émis par /api/mcp/oauth/token.

const PROTOCOL_VERSION = '2025-06-18';

type JsonRpcRequest = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Record<string, unknown> };

const TOOLS = [
  {
    name: 'list_workspaces',
    description: "Liste les clients (workspaces) de l'utilisateur KLIP connecté.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'generate_caption',
    description: "Génère une légende Instagram (et un texte visuel court) adaptés à la charte d'un client KLIP, à partir d'un brief.",
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string', description: "ID du client (workspace) KLIP — voir list_workspaces." },
        brief: { type: 'string', description: 'Brief du post (sujet, angle, contexte).' },
        context: { type: 'string', description: 'Contexte additionnel optionnel.' },
      },
      required: ['workspaceId', 'brief'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_post',
    description: "Crée un post prêt à planifier pour un client KLIP.",
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
        brief: { type: 'string' },
        description: { type: 'string', description: 'Légende Instagram.' },
        texteVisuel: { type: 'string', description: 'Texte court incrusté sur le visuel.' },
        photoUrl: { type: 'string', description: 'URL de la photo (optionnel).' },
        postType: { type: 'string', enum: ['post', 'reel', 'story', 'carrousel'] },
      },
      required: ['workspaceId'],
      additionalProperties: false,
    },
  },
  {
    name: 'schedule_post',
    description: "Planifie un post KLIP existant à une date/heure donnée (publication automatique ensuite par KLIP).",
    inputSchema: {
      type: 'object',
      properties: {
        postId: { type: 'string' },
        scheduledAt: { type: 'string', description: 'Date/heure ISO 8601 de publication.' },
        targetPlatforms: { type: 'array', items: { type: 'string', enum: ['instagram', 'facebook'] } },
      },
      required: ['postId', 'scheduledAt'],
      additionalProperties: false,
    },
  },
] as const;

function toolTextResult(data: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

async function callTool(name: string, args: Record<string, unknown>, userId: string) {
  const db = mcpDb();

  if (name === 'list_workspaces') {
    const { data, error } = await db
      .from('workspaces')
      .select('id, name, sector, instagram_username, facebook_page_id')
      .eq('user_id', userId)
      .order('created_at');
    if (error) throw new Error(error.message);
    return toolTextResult({ workspaces: data ?? [] });
  }

  if (name === 'generate_caption') {
    const workspaceId = String(args.workspaceId || '');
    const brief = String(args.brief || '');
    if (!(await assertWorkspaceOwnership(userId, workspaceId))) {
      throw new Error("Ce client n'appartient pas à cet utilisateur.");
    }
    const result = await generateDescriptionForUser({
      userId, brief, workspaceId,
      context: args.context ? String(args.context) : undefined,
    });
    return toolTextResult(result);
  }

  if (name === 'create_post') {
    const workspaceId = String(args.workspaceId || '');
    if (!(await assertWorkspaceOwnership(userId, workspaceId))) {
      throw new Error("Ce client n'appartient pas à cet utilisateur.");
    }
    const { data, error } = await db
      .from('posts')
      .insert({
        workspace_id: workspaceId,
        brief: args.brief ? String(args.brief) : null,
        description: args.description ? String(args.description) : null,
        texte_visuel: args.texteVisuel ? String(args.texteVisuel) : null,
        photo_url: args.photoUrl ? String(args.photoUrl) : null,
        post_type: args.postType ? String(args.postType) : 'post',
        status: 'validated',
      })
      .select('id')
      .single();
    if (error || !data) throw new Error(error?.message || 'Échec de la création du post');
    return toolTextResult({ postId: data.id });
  }

  if (name === 'schedule_post') {
    const postId = String(args.postId || '');
    const scheduledAt = String(args.scheduledAt || '');
    // Vérifie que le post appartient bien à un workspace de l'utilisateur.
    const { data: post } = await db
      .from('posts')
      .select('id, workspace_id, workspaces!workspace_id(user_id)')
      .eq('id', postId)
      .maybeSingle();
    const ownerId = (post?.workspaces as unknown as { user_id?: string } | null)?.user_id;
    if (!post || ownerId !== userId) {
      throw new Error("Ce post n'appartient pas à cet utilisateur.");
    }
    const { error } = await db
      .from('posts')
      .update({
        scheduled_at: scheduledAt,
        status: 'scheduled',
        ...(Array.isArray(args.targetPlatforms) ? { target_platforms: args.targetPlatforms } : {}),
      })
      .eq('id', postId);
    if (error) throw new Error(error.message);
    return toolTextResult({ postId, scheduledAt, status: 'scheduled' });
  }

  throw new Error(`Outil inconnu : ${name}`);
}

function unauthorized(origin: string) {
  return new NextResponse(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
    },
  });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!bearer) return unauthorized(request.nextUrl.origin);

  const resolved = await resolveAccessToken(bearer);
  if (!resolved) return unauthorized(request.nextUrl.origin);

  let body: JsonRpcRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 });
  }

  // Notifications (pas d'id) : accusé réception sans corps de réponse.
  if (body.id === undefined) {
    return new NextResponse(null, { status: 202 });
  }

  try {
    if (body.method === 'initialize') {
      return NextResponse.json({
        jsonrpc: '2.0', id: body.id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: 'klip', version: '1.0.0' },
        },
      });
    }

    if (body.method === 'tools/list') {
      return NextResponse.json({ jsonrpc: '2.0', id: body.id, result: { tools: TOOLS } });
    }

    if (body.method === 'tools/call') {
      const params = body.params || {};
      const name = String(params.name || '');
      const args = (params.arguments as Record<string, unknown>) || {};
      try {
        const result = await callTool(name, args, resolved.userId);
        return NextResponse.json({ jsonrpc: '2.0', id: body.id, result });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue';
        return NextResponse.json({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: message }], isError: true } });
      }
    }

    return NextResponse.json({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: 'Method not found' } }, { status: 404 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    return NextResponse.json({ jsonrpc: '2.0', id: body.id, error: { code: -32603, message } }, { status: 500 });
  }
}
