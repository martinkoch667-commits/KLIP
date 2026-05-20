import Sidebar from "./Sidebar";

interface Workspace {
  id: string;
  name: string;
}

interface AppLayoutProps {
  children: React.ReactNode;
  workspaces?: Workspace[];
  userName?: string;
}

export default function AppLayout({ children, workspaces, userName }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-black">
      <Sidebar workspaces={workspaces} userName={userName} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
