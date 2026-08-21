'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import TemplatesView, { type PostTemplate, type Workspace } from './TemplatesView';

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const { id: workspaceId } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [templates, setTemplates] = useState<PostTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [formatFilter, setFormatFilter] = useState('all');

  useEffect(() => {
    if (!workspaceId) return;
    async function load() {
      setLoading(true);
      const [{ data: ws }, res] = await Promise.all([
        supabase.from('workspaces').select('id,name,primary_color,secondary_color,accent_color,brand_icon_url,logo_url,logo_dark_url,font_family').eq('id', workspaceId).single(),
        fetch(`/api/templates?workspaceId=${workspaceId}`),
      ]);
      setWorkspace(ws);
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.templates ?? []);
      }
      setLoading(false);
    }
    load();
  }, [workspaceId, supabase]);

  return (
    <TemplatesView
      workspaceId={workspaceId}
      workspace={workspace}
      templates={templates}
      loading={loading}
      formatFilter={formatFilter}
      onFilter={setFormatFilter}
      onNew={() => router.push(`/workspace/${workspaceId}/template-editor/new`)}
      onEdit={(tpl) => router.push(`/workspace/${workspaceId}/template-editor/${tpl.id}`)}
      onDelete={async (id) => {
        await fetch(`/api/templates/${id}`, { method: 'DELETE' });
        setTemplates(prev => prev.filter(tpl => tpl.id !== id));
      }}
    />
  );
}
