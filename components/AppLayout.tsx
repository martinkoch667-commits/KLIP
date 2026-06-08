import Sidebar from "./Sidebar";

interface AppLayoutProps {
  workspaces?: any[];
  userName?: string;
  children: React.ReactNode;
  activeWorkspaceId?: string;
}

export default function AppLayout({ workspaces = [], userName = '', children, activeWorkspaceId }: AppLayoutProps) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--canvas)" }}>
      <Sidebar workspaces={workspaces} userName={userName} activeWorkspaceId={activeWorkspaceId} />
      <main style={{ marginLeft: "var(--sb-w)", flex: 1, minHeight: "100vh", background: "var(--canvas)" }}>
        {children}
      </main>
    </div>
  );
}
