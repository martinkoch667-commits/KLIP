import { VisualEditor } from '../../editor/[postId]/page';

export default function TemplateEditorPage({ params }: { params: { id: string; templateId: string } }) {
  return <VisualEditor workspaceId={params.id} templateId={params.templateId} mode="template" />;
}
