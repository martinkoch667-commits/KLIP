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

  // derive active workspace id from pathname
  const activeMatch = pathname.match(/\/workspace\/([^/]+)/);
  const activeId = activeMatch ? activeMatch[1] : null;

  return (
    <aside style={{
      width: 240,
      height: "100vh",
      position: "fixed",
      top: 0,
      left: 0,
      background: "#000000",
      borderRight: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      padding: "24px 16px",
      zIndex: 100,
      overflowY: "auto",
    }}>
      {/* Logo */}
      <div style={{ padding: "0 8px 28px", borderBottom: "1px solid var(--border)" }}>
        <Link href="/dashboard" style={{ textDecoration: "none" }}>
          <span style={{
            fontFamily: "'Cabinet Grotesk', sans-serif",
            fontWeight: 900,
            fontSize: 22,
            letterSpacing: "-0.04em",
            color: "var(--text)",
          }}>
            Kl<span style={{ color: "var(--acid)" }}>ip</span>
          </span>
        </Link>
      </div>

      {/* Label */}
      <div style={{
        padding: "20px 8px 8px",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        fontFamily: "'Satoshi', sans-serif",
      }}>
        Clients
      </div>

      {/* Workspace list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {workspaces.length === 0 && (
          <p style={{ padding: "8px", fontSize: 13, color: "var(--text-subtle)" }}>Aucun client</p>
        )}
        {workspaces.map((ws) => {
          const isActive = ws.id === activeId;
          return (
            <Link
              key={ws.id}
              href={`/workspace/${ws.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 8,
                marginBottom: 2,
                color: isActive ? "#000" : "var(--text-muted)",
                background: isActive ? "var(--acid)" : "transparent",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 500,
                fontFamily: "'Satoshi', sans-serif",
                transition: "all 0.15s",
              }}
            >
              <div style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: isActive ? "#000" : "var(--text-subtle)",
                flexShrink: 0,
              }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {ws.name}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Nouveau client */}
      <Link
        href="/workspace/new"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderRadius: 8,
          marginTop: 8,
          background: "var(--acid)",
          color: "#000",
          fontWeight: 700,
          fontSize: 14,
          textDecoration: "none",
          fontFamily: "'Satoshi', sans-serif",
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
        Nouveau client
      </Link>

      {/* User footer */}
      <div style={{
        marginTop: 16,
        paddingTop: 16,
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "var(--acid)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 700,
            color: "#000",
            flexShrink: 0,
            fontFamily: "'Cabinet Grotesk', sans-serif",
          }}>
            {initials}
          </div>
          <span style={{
            fontSize: 13,
            color: "var(--text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontFamily: "'Satoshi', sans-serif",
          }}>
            {displayName}
          </span>
        </div>

        <button
          onClick={handleLogout}
          title="Déconnexion"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            color: "var(--text-subtle)",
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
            <path d="M7 1H2a1 1 0 00-1 1v8a1 1 0 001 1h5M9 9l2-2-2-2M5 7h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </aside>
  );
}
