"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import MobileSidebar from "./ui/MobileSidebar";
import BetaFeedback from "./BetaFeedback";

interface Workspace { id: string; name: string; brand_icon_url?: string | null; logo_url?: string | null; logo_dark_url?: string | null; primary_color?: string | null }

interface SidebarProps {
  workspaces?: any[];
  userName?: string;
  activeWorkspaceId?: string;
  /** Masque la pastille de signalement : elle recouvre les actions de
   *  certains écrans pleine page (parcours de création). */
  hideBeta?: boolean;
}

const WS_COLORS = ["#7B5CF5", "#2FD79B", "#C8732B", "#5A86E8", "#DD2A7B", "#88B394", "#E8A03A", "#4A8DD4"];

// ─── Icons ──────────────────────────────────────────────────────────────────

function IconGrid() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/></svg>;
}
function IconCalendar() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg>;
}
function IconEdit() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="M13.5 7.5l3 3"/></svg>;
}
function IconSend() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3L11 14M22 3l-7 19-4-8-8-4 19-7Z"/></svg>;
}
function IconUsers() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6M17.5 19a5.5 5.5 0 0 0-2.2-4.4"/></svg>;
}
function IconTemplate() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 9v12"/></svg>;
}
function IconSettings() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>;
}
function IconPlus() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>;
}
function IconLogout() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 12H3m0 0l3.5-3.5M3 12l3.5 3.5"/></svg>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Sidebar({ workspaces: _w, userName: _u, activeWorkspaceId: _a, hideBeta = false }: SidebarProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClientComponentClient();
  const t = useTranslations("nav");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [userEmail, setUserEmail] = useState<string>("");
  const [pendingCount, setPendingCount] = useState(0);

  const activeMatch = pathname.match(/\/workspace\/([^/]+)/);
  const activeId = activeMatch ? activeMatch[1] : null;
  const isDashboard = pathname === "/dashboard";

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserEmail(session.user.email ?? "");
      const { data } = await supabase
        .from("workspaces")
        .select("id, name, brand_icon_url, logo_url, logo_dark_url, primary_color")
        .order("created_at", { ascending: true });
      setWorkspaces(data ?? []);
    }
    load();
  }, [supabase]);

  // Badge: count pending posts across ALL workspaces
  useEffect(() => {
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("status", "generated")
      .then(({ count }) => setPendingCount(count ?? 0));
  }, [supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const displayName = userEmail.split("@")[0] ?? "";
  const initials = displayName.slice(0, 2).toUpperCase();

  // Nav item active states
  const isComposer   = pathname === "/composer" || (activeId ? (pathname === `/workspace/${activeId}` || pathname.includes("/editor")) : false);
  const isCalendar   = pathname === "/calendar" || pathname.includes("/planning");
  const isQueue      = pathname === "/feed" || pathname.includes("/results");
  const isSettings   = pathname === "/settings" || pathname.includes("/parametres");
  const isTemplates  = pathname === "/templates" || (activeId ? pathname.includes("/templates") : false);

  const navItems = [
    {
      label: t("dashboard"),
      icon: <IconGrid />,
      href: "/dashboard",
      active: isDashboard,
      badge: 0,
      tourId: "dashboard",
    },
    {
      label: t("calendar"),
      icon: <IconCalendar />,
      href: activeId ? `/workspace/${activeId}/planning` : "/calendar",
      active: isCalendar,
      badge: 0,
      tourId: "calendar",
    },
    {
      label: t("composer"),
      icon: <IconEdit />,
      href: activeId ? `/workspace/${activeId}` : "/composer",
      active: isComposer,
      badge: 0,
      tourId: "composer",
    },
    {
      label: t("feed"),
      icon: <IconSend />,
      href: activeId ? `/workspace/${activeId}/results` : "/feed",
      active: isQueue,
      badge: pendingCount,
      tourId: "feed",
    },
    {
      label: t("templates"),
      icon: <IconTemplate />,
      href: activeId ? `/workspace/${activeId}/templates` : "/templates",
      active: isTemplates,
      badge: 0,
      tourId: "templates",
    },
  ];

  return (
    <>
    <MobileSidebar />
    {/* Phase d'ouverture : signalement de bug accessible depuis toutes les pages
        de l'app. Monté ici car la Sidebar est le seul élément commun aux 17
        pages — le widget se positionne lui-même en `fixed`. */}
    {!hideBeta && <BetaFeedback />}
    <aside className="sidebar" style={{ width: "var(--sb-w)", position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 100 }}>

      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px 14px" }}>
        <Link href="/dashboard" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
          <img src="/logo-klip-mint.png" alt="Klip" style={{ height: 32, width: "auto" }} />
        </Link>
        <span className="sb-full chip" style={{ marginLeft: "auto", background: "var(--cream-4)", color: "var(--cream-2)", fontSize: 10 }}>
          Agence
        </span>
      </div>

      {/* Main nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {navItems.map(item => (
          <Link
            key={item.label}
            href={item.href}
            data-tour={item.tourId}
            className={`nav-item${item.active ? " active" : ""}`}
            style={{ textDecoration: "none" }}
          >
            <span className="nav-ic">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {item.badge > 0 && (
              <span className="nav-badge" style={{ marginLeft: "auto" }}>{item.badge}</span>
            )}
          </Link>
        ))}
      </nav>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--cream-4)", margin: "6px 4px" }} />

      {/* Clients label */}
      <div data-tour="clients" className="label sb-full" style={{ color: "var(--cream-3)", padding: "0 12px 4px" }}>
        {t("yourClients")}
      </div>

      {/* Workspace list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, overflowY: "auto", flex: 1, margin: "0 -4px", padding: "0 4px" }}>
        {workspaces.length === 0 && (
          <p className="sb-full" style={{ padding: "8px 12px", fontSize: 13, color: "var(--cream-3)" }}>{t("noClients")}</p>
        )}
        {workspaces.map((ws, i) => {
          const isActive = ws.id === activeId;
          const color = ws.primary_color || WS_COLORS[i % WS_COLORS.length];
          const wsInitials = ws.name.slice(0, 2).toUpperCase();
          const logoSrc = ws.brand_icon_url || ws.logo_url || ws.logo_dark_url || null;
          return (
            <Link key={ws.id} href={`/workspace/${ws.id}`} className={`nav-item${isActive ? " active" : ""}`} style={{ padding: "7px 10px", textDecoration: "none" }}>
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoSrc} alt={ws.name} style={{ width: 26, height: 26, borderRadius: 7, objectFit: "contain", flexShrink: 0, background: "#fff", padding: 3, outline: isActive ? "2px solid var(--leaf)" : "none" }} />
              ) : (
                <span style={{ width: 26, height: 26, borderRadius: 7, background: isActive ? "var(--leaf-ink)" : color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff", fontFamily: "var(--mono)", letterSpacing: "0.02em", flexShrink: 0 }}>
                  {wsInitials}
                </span>
              )}
              <span className="nav-label trunc" style={{ fontWeight: 600, fontSize: 13 }}>{ws.name}</span>
            </Link>
          );
        })}
      </div>

      {/* Add workspace */}
      <Link
        data-tour="new-post"
        href="/workspace/new"
        className="sb-full"
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: "var(--r-s)", color: "var(--cream-3)", fontSize: 13, fontWeight: 600, border: "1px solid var(--cream-4)", transition: "all 0.15s", textDecoration: "none", marginTop: 4 }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--leaf)"; e.currentTarget.style.color = "var(--leaf)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--cream-4)"; e.currentTarget.style.color = "var(--cream-3)"; }}
      >
        <IconPlus />
        <span>{t("newClient")}</span>
      </Link>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--cream-4)", margin: "8px 4px 4px" }} />

      {/* Réglages globaux */}
      <Link
        href="/settings"
        className={`nav-item${isSettings ? " active" : ""}`}
        style={{ textDecoration: "none" }}
      >
        <span className="nav-ic"><IconSettings /></span>
        <span className="nav-label">{t("settings")}</span>
      </Link>

      {/* User footer */}
      <button
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: "var(--r-s)", background: "transparent", border: "none", cursor: "pointer", width: "100%", textAlign: "left", transition: "background 0.15s", color: "var(--cream)" }}
        onMouseEnter={e => { e.currentTarget.style.background = "var(--cream-4)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        onClick={handleLogout}
        title={t("logout")}
      >
        <span style={{ width: 26, height: 26, borderRadius: 7, background: "#7B5CF5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff", fontFamily: "var(--mono)", letterSpacing: "0.02em", flexShrink: 0 }}>
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
    </>
  );
}
