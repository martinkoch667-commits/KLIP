import Sidebar from "./Sidebar";

interface AppLayoutProps {
  workspaces?: any[];
  userName?: string;
  children: React.ReactNode;
  activeWorkspaceId?: string;
}

export default function AppLayout({ workspaces = [], userName = '', children, activeWorkspaceId }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-black">
      <Sidebar workspaces={workspaces} userName={userName} activeWorkspaceId={activeWorkspaceId} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
