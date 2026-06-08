"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface Workspace { id: string; name: string }

interface SidebarProps {
  workspaces?: any[];
  userName?: string;
  activeWorkspaceId?: string;
}

const WS_COLORS = ["#7B5CF5", "#2FD79B", "#C8732B", "#5A86E8", "#DD2A7B", "#88B394", "#E8A03A", "#4A8DD4"];

function IconGrid() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7.5" height="7.5" rx="2"/>
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/>
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/>
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>
    </svg>
  );
}
function IconPlus() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 12H3m0 0l3.5-3.5M3 12l3.5 3.5"/>
    </svg>
  );
}

export default function Sidebar({ workspaces: _w, userName: _u, activeWorkspaceId: _a }: SidebarProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserEmail(session.user.email ?? "");
      const { data } = await supabase
        .from("workspaces")
        .select("id, name")
        .order("created_at", { ascending: true });
      setWorkspaces(data ?? []);
    }
    load();
  }, [supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const displayName = userEmail.split("@")[0] ?? "Utilisateur";
  const initials = displayName.slice(0, 2).toUpperCase();

  const activeMatch = pathname.match(/\/workspace\/([^/]+)/);
  const activeId = activeMatch ? activeMatch[1] : null;
  const isDashboard = pathname === "/dashboard";

  return (
    <aside className="sidebar" style={{ width: "var(--sb-w)", position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 100 }}>

      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px 14px" }}>
        <Link href="/dashboard" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
          <span style={{
            fontFamily: "var(--display)",
            fontWeight: 900,
            fontSize: 22,
            letterSpacing: "-0.05em",
            lineHeight: 1,
            color: "var(--cream)",
            display: "inline-flex",
            alignItems: "center",
          }}>
            Kl<span style={{ color: "var(--mint)" }}>ip</span>
            <span style={{ width: 4, height: 4, background: "var(--mint)", borderRadius: "50%", marginLeft: 3, marginTop: 7, flexShrink: 0 }} />
          </span>
        </Link>
        <span className="sb-full chip" style={{ marginLeft: "auto", background: "var(--cream-4)", color: "var(--cream-2)", fontSize: 10 }}>
          Agence
        </span>
      </div>

      {/* Main nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <Link href="/dashboard" className={`nav-item${isDashboard ? " active" : ""}`} style={{ textDecoration: "none" }}>
          <span className="nav-ic"><IconGrid /></span>
          <span className="nav-label">Tableau de bord</span>
        </Link>
      </nav>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--cream-4)", margin: "6px 4px" }} />

      {/* Clients label */}
      <div className="label sb-full" style={{ color: "var(--cream-3)", padding: "0 12px 4px" }}>
        Vos clients
      </div>

      {/* Workspace list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, overflowY: "auto", flex: 1, margin: "0 -4px", padding: "0 4px" }}>
        {workspaces.length === 0 && (
          <p className="sb-full" style={{ padding: "8px 12px", fontSize: 13, color: "var(--cream-3)" }}>Aucun client</p>
        )}
        {workspaces.map((ws, i) => {
          const isActive = ws.id === activeId;
          const color = WS_COLORS[i % WS_COLORS.length];
          const wsInitials = ws.name.slice(0, 2).toUpperCase();
          return (
            <Link key={ws.id} href={`/workspace/${ws.id}`} className={`nav-item${isActive ? " active" : ""}`} style={{ padding: "7px 10px", textDecoration: "none" }}>
              <span style={{
                width: 26, height: 26,
                borderRadius: 7,
                background: isActive ? "var(--mint-ink)" : color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 800, color: "#fff",
                fontFamily: "var(--mono)", letterSpacing: "0.02em",
                flexShrink: 0,
              }}>
                {wsInitials}
              </span>
              <span className="nav-label trunc" style={{ fontWeight: 600, fontSize: 13 }}>{ws.name}</span>
            </Link>
          );
        })}
      </div>

      {/* Add workspace */}
      <Link
        href="/workspace/new"
        className="sb-full"
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "9px 12px", borderRadius: "var(--r-s)",
          color: "var(--cream-3)", fontSize: 13, fontWeight: 600,
          border: "1px dashed var(--cream-4)", transition: "all 0.15s",
          textDecoration: "none", marginTop: 4,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--mint)"; e.currentTarget.style.color = "var(--mint)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--cream-4)"; e.currentTarget.style.color = "var(--cream-3)"; }}
      >
        <IconPlus />
        <span>Nouveau client</span>
      </Link>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--cream-4)", margin: "8px 4px 4px" }} />

      {/* User footer */}
      <button
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "7px 10px", borderRadius: "var(--r-s)",
          background: "transparent", border: "none", cursor: "pointer",
          width: "100%", textAlign: "left", transition: "background 0.15s",
          color: "var(--cream)",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "var(--cream-4)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        onClick={handleLogout}
        title="Se déconnecter"
      >
        <span style={{
          width: 26, height: 26, borderRadius: 7,
          background: "#7B5CF5",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 800, color: "#fff",
          fontFamily: "var(--mono)", letterSpacing: "0.02em",
          flexShrink: 0,
        }}>
          {initials}
        </span>
        <span className="sb-full" style={{ display: "flex", flexDirection: "column", lineHeight: 1.2, minWidth: 0, flex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: "var(--cream)" }}>{displayName}</span>
        </span>
        <span className="sb-full" style={{ color: "var(--cream-3)", marginLeft: "auto", flexShrink: 0 }}>
          <IconLogout />
        </span>
      </button>
    </aside>
  );
}
