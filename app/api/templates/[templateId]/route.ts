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

  const allowedFields = ['name', 'format_id', 'background_style', 'text_zones', 'logo_placement', 'thumbnail_url', 'sort_order'];
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) updates[field] = body[field];
  }

  const { data, error } = await supabase
    .from('post_templates')
    .update(updates)
    .eq('id', templateId)
    .select()
    .single();

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
