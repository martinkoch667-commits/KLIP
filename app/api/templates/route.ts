import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// GET /api/templates?workspaceId=xxx
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId requis' }, { status: 400 });
  }

  const supabase = createRouteHandlerClient({ cookies });
  const { data, error } = await supabase
    .from('post_templates')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

// POST /api/templates  — create a new template
export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const body = await request.json();
  const { workspace_id, name, format_id, background_style, text_zones, logo_placement, thumbnail_url } = body;

  if (!workspace_id) return NextResponse.json({ error: 'workspace_id requis' }, { status: 400 });

  const { data, error } = await supabase
    .from('post_templates')
    .insert({
      workspace_id,
      name: name ?? 'Nouveau template',
      format_id: format_id ?? 'ig-portrait',
      background_style: background_style ?? { type: 'gradient', angle: 135, colorFrom: '#0038FF', colorTo: '#FFFFFF' },
      text_zones: text_zones ?? [],
      logo_placement: logo_placement ?? null,
      thumbnail_url: thumbnail_url ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data }, { status: 201 });
}
