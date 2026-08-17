import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// PUT /api/templates/[templateId] — update template
export async function PUT(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });
  const body = await request.json();
  const { templateId } = params;

  const allowedFields = ['name', 'format_id', 'background_style', 'text_zones', 'pages', 'logo_placement', 'thumbnail_url', 'sort_order'];
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) updates[field] = body[field];
  }

  // Un template multi-pages n'écrit `pages` que si la liste en compte plusieurs :
  // un template d'une page reste décrit par `text_zones` seul.
  if (Array.isArray(updates.pages) && (updates.pages as unknown[]).length <= 1) updates.pages = null;

  let { data, error } = await supabase
    .from('post_templates')
    .update(updates)
    .eq('id', templateId)
    .select()
    .single();

  // Tant que la migration `pages` n'est pas passée, on enregistre au moins la
  // première page plutôt que de perdre le travail de l'utilisateur.
  if (error && 'pages' in updates && /pages/i.test(error.message)) {
    const { pages: _drop, ...rest } = updates;
    ({ data, error } = await supabase.from('post_templates').update(rest).eq('id', templateId).select().single());
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}

// DELETE /api/templates/[templateId]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });
  const { error } = await supabase
    .from('post_templates')
    .delete()
    .eq('id', params.templateId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
