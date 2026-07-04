"use client";

import { useState, useEffect, useRef } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { resetOnboardingTour } from "@/components/OnboardingTour";
import { resetOnboardingChecklist } from "@/components/OnboardingChecklist";
import { useAccountType } from "@/hooks/useAccountType";

type Tab = "profile" | "security" | "notifications" | "appearance" | "publi" | "integrations" | "agency" | "billing" | "help";

interface UserPrefs {
  notif_email_publish_success: boolean;
  notif_email_publish_error: boolean;
  notif_email_validation_request: boolean;
  notif_email_validation_result: boolean;
  notif_email_reminder: boolean;
  notif_email_weekly_summary: boolean;
  notif_inapp: boolean;
  timezone: string;
  date_format: string;
  time_format: string;
}

const DEFAULT_PREFS: UserPrefs = {
  notif_email_publish_success: true,
  notif_email_publish_error: true,
  notif_email_validation_request: true,
  notif_email_validation_result: true,
  notif_email_reminder: true,
  notif_email_weekly_summary: false,
  notif_inapp: true,
  timezone: "Europe/Paris",
  date_format: "DD/MM/YYYY",
  time_format: "24h",
};

const WS_COLORS = ["#7B5CF5","#2FD79B","#C8732B","#5A86E8","#DD2A7B","#88B394","#E8A03A","#4A8DD4"];

const ST_CSS = `
.st-layout{display:flex;min-height:100%;}
.st-nav{width:232px;flex-shrink:0;border-right:1px solid var(--line);background:var(--paper);padding:16px 10px;position:sticky;top:0;align-self:flex-start;height:calc(100vh - 64px);overflow-y:auto;}
.st-content{flex:1;padding:36px 44px;max-width:760px;}
.set-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--line-2);}
.set-row:last-child{border-bottom:none;}
.st-tab-btn{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;font-size:13px;font-weight:600;color:var(--ink-2);cursor:pointer;transition:all .12s;border:none;background:none;width:100%;text-align:left;margin-bottom:2px;}
.st-tab-btn:hover{background:var(--sunk);color:var(--ink);}
.st-tab-btn.on{background:var(--white);color:var(--ink);box-shadow:var(--shadow-card);}
.st-h{font-family:var(--display);font-weight:800;font-size:20px;text-transform:uppercase;color:var(--forest);letter-spacing:-.01em;margin:0 0 4px;}
.st-sub{font-size:13px;color:var(--ink-3);margin:0 0 28px;}
.st-card{background:#fff;border-radius:14px;border:1px solid rgba(13,15,10,.10);padding:24px;margin-bottom:16px;}
.st-label{display:block;font-family:var(--sans);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(20,22,15,.6);margin-bottom:6px;}
.st-input{width:100%;border:1.5px solid rgba(20,22,15,.15);border-radius:8px;padding:10px 14px;font-family:var(--sans);font-size:14px;color:var(--ink);background:#fff;outline:none;transition:border-color .15s;}
.st-input::placeholder{color:rgba(20,22,15,.30);}
.st-input:focus{border-color:var(--mint);}
.st-input:disabled{background:var(--sunk);color:var(--ink-3);cursor:not-allowed;}
.st-select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238B8E7F' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:36px;cursor:pointer;}
.st-btn{padding:10px 20px;background:var(--forest);color:var(--canvas);font-family:var(--display);font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.08em;border-radius:8px;border:none;cursor:pointer;transition:background .15s,color .15s;white-space:nowrap;}
.st-btn:hover:not(:disabled){background:var(--mint);color:var(--forest);}
.st-btn:disabled{opacity:.5;cursor:not-allowed;}
.st-btn-ghost{padding:8px 14px;background:transparent;color:var(--ink);font-family:var(--sans);font-weight:600;font-size:12px;border-radius:8px;border:1.5px solid rgba(20,22,15,.15);cursor:pointer;transition:border-color .15s;white-space:nowrap;}
.st-btn-ghost:hover{border-color:rgba(20,22,15,.30);}
.st-btn-danger{padding:8px 14px;background:transparent;color:#DC2626;font-family:var(--sans);font-weight:600;font-size:12px;border-radius:8px;border:1.5px solid rgba(220,38,38,.25);cursor:pointer;transition:all .15s;white-space:nowrap;}
.st-btn-danger:hover{background:#DC2626;color:#fff;border-color:#DC2626;}
.st-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:13px 0;border-bottom:1px solid rgba(20,22,15,.06);}
.st-toggle-row:last-child{border-bottom:none;}
.st-toggle{position:relative;width:40px;height:22px;flex-shrink:0;}
.st-toggle input{opacity:0;width:0;height:0;position:absolute;}
.st-slider{position:absolute;inset:0;background:rgba(20,22,15,.15);border-radius:99px;cursor:pointer;transition:background .15s;}
.st-toggle input:checked+.st-slider{background:var(--mint);}
.st-slider::before{content:'';position:absolute;width:16px;height:16px;left:3px;top:3px;background:#fff;border-radius:50%;transition:transform .15s;box-shadow:0 1px 3px rgba(0,0,0,.15);}
.st-toggle input:checked+.st-slider::before{transform:translateX(18px);}
.st-divider{height:1px;background:rgba(20,22,15,.08);margin:20px 0;border:none;}
.st-grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.st-member-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid rgba(20,22,15,.06);}
.st-member-row:last-child{border-bottom:none;}
.st-nav-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-3);padding:0 12px;margin:12px 0 6px;}
.st-badge{display:inline-flex;padding:3px 9px;border-radius:99px;font-size:11px;font-weight:700;font-family:var(--mono);}
@media(max-width:900px){.st-grid2{grid-template-columns:1fr;}}
@media(max-width:767px){
  .st-layout{flex-direction:column;}
  .st-nav{width:100%;height:auto;position:static;border-right:none;border-bottom:1px solid var(--line);display:flex;flex-direction:row;overflow-x:auto;padding:8px;gap:4px;-webkit-overflow-scrolling:touch;scrollbar-width:none;}
  .st-nav::-webkit-scrollbar{display:none;}
  .st-content{padding:20px 16px 60px;}
  .st-tab-btn{width:auto;white-space:nowrap;flex-shrink:0;margin-bottom:0;padding:8px 14px;}
  .st-nav-label{display:none;}
}
`;

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 42, height: 24, borderRadius: 99, border: 'none', cursor: 'pointer',
        background: checked ? 'var(--mint)' : 'var(--sunk)',
        position: 'relative', flexShrink: 0,
        transition: 'background .16s',
        boxShadow: checked ? 'none' : 'inset 0 0 0 1px var(--line)',
        padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3,
        left: checked ? 21 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(13,15,10,.3)',
        transition: 'left .16s',
      }} />
    </button>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <>
      <h2 className="st-h">{title}</h2>
      {sub && <p className="st-sub">{sub}</p>}
    </>
  );
}

// ─── Profile Tab ─────────────────────────────────────────────────────────────

function ProfileTab({ supabase, userId, email, meta }: { supabase: any; userId: string; email: string; meta: any }) {
  const [firstName, setFirstName] = useState(meta?.first_name ?? "");
  const [lastName, setLastName] = useState(meta?.last_name ?? "");
  const [jobTitle, setJobTitle] = useState(meta?.job_title ?? "");
  const [company, setCompany] = useState(meta?.company ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(meta?.avatar_url ?? null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const displayName = (firstName || lastName) ? `${firstName} ${lastName}`.trim() : email.split("@")[0];
  const initials = displayName.slice(0, 2).toUpperCase();

  async function handleSave() {
    setSaving(true);
    await supabase.auth.updateUser({ data: { first_name: firstName, last_name: lastName, job_title: jobTitle, company, avatar_url: avatarUrl } });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `avatars/${userId}/avatar.${ext}`;
    const { error } = await supabase.storage.from("photos").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("photos").getPublicUrl(path);
      setAvatarUrl(data.publicUrl + `?t=${Date.now()}`);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleRemoveAvatar() {
    const exts = ["jpg", "jpeg", "png", "webp"];
    await Promise.all(exts.map(ext => supabase.storage.from("photos").remove([`avatars/${userId}/avatar.${ext}`])));
    setAvatarUrl(null);
  }

  return (
    <>
      <SectionHeader title="Mon profil" sub="Informations personnelles visibles par votre équipe." />

      {/* Avatar */}
      <div className="st-card">
        <div className="st-label">Photo de profil</div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: avatarUrl ? "transparent" : "#7B5CF5", display: "grid", placeItems: "center", flexShrink: 0, overflow: "hidden", border: "3px solid var(--sunk)" }}>
            {avatarUrl
              ? <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: "var(--mono)" }}>{initials}</span>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={handleAvatarUpload} />
            <button className="st-btn-ghost" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? "Téléversement…" : "Changer la photo"}
            </button>
            {avatarUrl && (
              <button className="st-btn-danger" onClick={handleRemoveAvatar}>Supprimer la photo</button>
            )}
          </div>
        </div>
      </div>

      {/* Profile info */}
      <div className="st-card">
        <div className="st-label" style={{ marginBottom: 20 }}>Informations personnelles</div>
        <div className="st-grid2" style={{ marginBottom: 16 }}>
          <div>
            <label className="st-label">Prénom</label>
            <input className="st-input" type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Votre prénom" />
          </div>
          <div>
            <label className="st-label">Nom</label>
            <input className="st-input" type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Votre nom" />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label className="st-label">Email</label>
          <input className="st-input" type="email" value={email} disabled title="L'email ne peut pas être modifié ici" />
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>Contactez le support pour modifier votre email.</div>
        </div>
        <div className="st-grid2">
          <div>
            <label className="st-label">Poste / rôle</label>
            <input className="st-input" type="text" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Ex : Community manager" />
          </div>
          <div>
            <label className="st-label">Agence / entreprise</label>
            <input className="st-input" type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="Ex : votre agence" />
          </div>
        </div>
        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
          <button className="st-btn" onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement…" : saved ? "Enregistré" : "Enregistrer les modifications"}
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="st-card" style={{ borderColor: "rgba(220,38,38,.2)" }}>
        <div className="st-label" style={{ color: "#DC2626", marginBottom: 12 }}>Zone de danger</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 3 }}>Supprimer mon compte</div>
            <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Suppression définitive de votre compte et de toutes vos données.</div>
          </div>
          <a href="mailto:contact@klip.fr?subject=Suppression%20de%20compte%20Klip" className="st-btn-danger" style={{ textDecoration: "none" }}>
            Contacter le support
          </a>
        </div>
      </div>
    </>
  );
}

// ─── Security Tab ─────────────────────────────────────────────────────────────

function SecurityTab({ supabase, providers }: { supabase: any; providers: string[] }) {
  const isGoogleOnly = providers.length === 1 && providers.includes("google");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) { setMsg({ type: "err", text: "Les mots de passe ne correspondent pas." }); return; }
    if (next.length < 8) { setMsg({ type: "err", text: "8 caractères minimum." }); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: next });
    setSaving(false);
    if (error) { setMsg({ type: "err", text: error.message }); }
    else { setMsg({ type: "ok", text: "Mot de passe mis à jour." }); setCurrent(""); setNext(""); setConfirm(""); }
  }

  async function handleSignOutOthers() {
    setSigningOut(true);
    await (supabase.auth as any).signOut({ scope: "others" });
    setSigningOut(false);
    setMsg({ type: "ok", text: "Autres sessions déconnectées." });
  }

  const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );

  return (
    <>
      <SectionHeader title="Sécurité" sub="Gérez votre mot de passe et vos sessions actives." />

      <div className="st-card">
        <div className="st-label" style={{ marginBottom: 16 }}>Mot de passe</div>
        {isGoogleOnly ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "var(--ink-2)" }}>
            <span className="st-badge" style={{ background: "var(--mint-soft)", color: "var(--mint-2)" }}>Google</span>
            Vous êtes connecté via Google OAuth — aucun mot de passe à gérer.
          </div>
        ) : (
          <form onSubmit={handlePasswordChange} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label className="st-label">Mot de passe actuel</label>
              <input className="st-input" type="password" value={current} onChange={e => setCurrent(e.target.value)} placeholder="••••••••" />
            </div>
            <div>
              <label className="st-label">Nouveau mot de passe</label>
              <input className="st-input" type="password" value={next} onChange={e => setNext(e.target.value)} placeholder="8 caractères minimum" minLength={8} />
            </div>
            <div>
              <label className="st-label">Confirmer</label>
              <input className="st-input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" />
            </div>
            {msg && (
              <p style={{ fontSize: 13, color: msg.type === "ok" ? "var(--mint-2)" : "var(--warn)", fontWeight: 600 }}>{msg.text}</p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="st-btn" type="submit" disabled={saving || !next || !confirm}>
                {saving ? "Mise à jour…" : "Mettre à jour"}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="st-card">
        <div className="st-label" style={{ marginBottom: 12 }}>Sessions</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 3 }}>Déconnecter les autres appareils</div>
            <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Ferme toutes les sessions ouvertes sur d'autres appareils.</div>
          </div>
          <button className="st-btn-ghost" onClick={handleSignOutOthers} disabled={signingOut}>
            {signingOut ? "…" : "Déconnecter"}
          </button>
        </div>
        {msg?.type === "ok" && msg.text.includes("session") && (
          <p style={{ fontSize: 12.5, color: "var(--mint-2)", fontWeight: 600, marginTop: 10 }}>{msg.text}</p>
        )}
      </div>

      <div className="st-card">
        <div className="st-label" style={{ marginBottom: 12 }}>Authentification</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: "#fff", border: "1px solid rgba(20,22,15,.12)", display: "grid", placeItems: "center" }}>
            <GoogleIcon />
          </div>
          <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>Google</div>
          <span className="st-badge" style={{ background: providers.includes("google") ? "var(--mint-soft)" : "var(--sunk)", color: providers.includes("google") ? "var(--mint-2)" : "var(--ink-3)" }}>
            {providers.includes("google") ? "Connecté" : "Non connecté"}
          </span>
        </div>
      </div>
    </>
  );
}

// ─── Notifications Tab ────────────────────────────────────────────────────────

function NotificationsTab({ supabase, userId }: { supabase: any; userId: string }) {
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("user_preferences").select("*").eq("user_id", userId).maybeSingle();
      if (data) setPrefs(p => ({ ...p, ...data }));
      setLoaded(true);
    })();
  }, [supabase, userId]);

  function toggle(key: keyof UserPrefs) {
    setPrefs(p => ({ ...p, [key]: !p[key] }));
  }

  async function handleSave() {
    setSaving(true);
    await supabase.from("user_preferences").upsert(
      { user_id: userId, ...prefs, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const EMAIL_NOTIFS: { key: keyof UserPrefs; label: string; desc?: string }[] = [
    { key: "notif_email_publish_success", label: "Publication réussie", desc: "Confirmation quand un post est publié." },
    { key: "notif_email_publish_error", label: "Erreur de publication", desc: "Alerte quand une publication échoue." },
    { key: "notif_email_validation_request", label: "Contenu soumis pour validation", desc: "Pour les Managers — un Créa a soumis du contenu." },
    { key: "notif_email_validation_result", label: "Contenu validé ou refusé", desc: "Pour les Créas — résultat de la validation." },
    { key: "notif_email_reminder", label: "Rappel 1h avant publication", desc: "Notification avant chaque post programmé." },
    { key: "notif_email_weekly_summary", label: "Résumé hebdomadaire", desc: "Bilan de vos publications chaque lundi." },
  ];

  if (!loaded) return <div style={{ padding: "60px 0", textAlign: "center", color: "var(--ink-3)" }}>Chargement…</div>;

  return (
    <>
      <SectionHeader title="Notifications" sub="Choisissez les alertes que vous souhaitez recevoir." />

      <div className="st-card">
        <div className="st-label" style={{ marginBottom: 4 }}>Notifications email</div>
        {EMAIL_NOTIFS.map(({ key, label, desc }) => (
          <div key={key} className="st-toggle-row">
            <div>
              <div style={{ fontSize: 13.5, color: "var(--ink)", fontWeight: 600 }}>{label}</div>
              {desc && <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{desc}</div>}
            </div>
            <Toggle checked={prefs[key] as boolean} onChange={() => toggle(key)} />
          </div>
        ))}
      </div>

      <div className="st-card">
        <div className="st-label" style={{ marginBottom: 4 }}>Notifications in-app</div>
        <div className="st-toggle-row">
          <div>
            <div style={{ fontSize: 13.5, color: "var(--ink)", fontWeight: 600 }}>Alertes dans l'application</div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>Notifications visibles directement dans Klip.</div>
          </div>
          <Toggle checked={prefs.notif_inapp} onChange={() => toggle("notif_inapp")} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="st-btn" onClick={handleSave} disabled={saving}>
          {saving ? "Enregistrement…" : saved ? "Enregistré" : "Enregistrer les préférences"}
        </button>
      </div>
    </>
  );
}

// ─── Appearance Tab ───────────────────────────────────────────────────────────

const TIMEZONES: string[] = (() => {
  try { return (Intl as any).supportedValuesOf("timeZone") as string[]; }
  catch { return ["Europe/Paris","Europe/London","Europe/Berlin","Europe/Rome","Europe/Madrid","America/New_York","America/Chicago","America/Los_Angeles","America/Sao_Paulo","Asia/Tokyo","Asia/Dubai","Africa/Casablanca"]; }
})();

function AppearanceTab({ supabase, userId }: { supabase: any; userId: string }) {
  const [tz, setTz] = useState("Europe/Paris");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [timeFormat, setTimeFormat] = useState("24h");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("user_preferences").select("timezone,date_format,time_format").eq("user_id", userId).maybeSingle();
      if (data?.timezone) setTz(data.timezone);
      if (data?.date_format) setDateFormat(data.date_format);
      if (data?.time_format) setTimeFormat(data.time_format);
    })();
  }, [supabase, userId]);

  async function handleSave() {
    setSaving(true);
    await supabase.from("user_preferences").upsert(
      { user_id: userId, timezone: tz, date_format: dateFormat, time_format: timeFormat, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <>
      <SectionHeader title="Apparence" sub="Personnalisez l'affichage selon vos préférences." />

      <div className="st-card">
        <div style={{ marginBottom: 20 }}>
          <label className="st-label">Langue</label>
          <select className="st-input st-select" disabled>
            <option value="fr">Français</option>
          </select>
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>D'autres langues seront disponibles prochainement.</div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label className="st-label">Fuseau horaire</label>
          <select className="st-input st-select" value={tz} onChange={e => setTz(e.target.value)}>
            {TIMEZONES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          </select>
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>Utilisé pour la programmation des posts.</div>
        </div>

        <div className="st-grid2" style={{ marginBottom: 4 }}>
          <div>
            <div className="st-label" style={{ marginBottom: 10 }}>Format de date</div>
            {(["DD/MM/YYYY", "MM/DD/YYYY"] as const).map(f => (
              <label key={f} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer", fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>
                <input type="radio" name="date_format" value={f} checked={dateFormat === f} onChange={() => setDateFormat(f)} style={{ accentColor: "var(--mint)" }} />
                {f}
              </label>
            ))}
          </div>
          <div>
            <div className="st-label" style={{ marginBottom: 10 }}>Format d'heure</div>
            {[{ v: "24h", l: "24h  (14:30)" }, { v: "12h", l: "12h  (2:30 PM)" }].map(({ v, l }) => (
              <label key={v} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer", fontSize: 13.5, fontWeight: 500, color: "var(--ink)" }}>
                <input type="radio" name="time_format" value={v} checked={timeFormat === v} onChange={() => setTimeFormat(v)} style={{ accentColor: "var(--mint)" }} />
                {l}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
          <button className="st-btn" onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement…" : saved ? "Enregistré" : "Enregistrer"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Publication Tab ──────────────────────────────────────────────────────────

const TIMEZONES_PUB: string[] = (() => {
  try { return (Intl as any).supportedValuesOf("timeZone") as string[]; }
  catch { return ["Europe/Paris","Europe/London","Europe/Berlin","Europe/Rome","Europe/Madrid","America/New_York","America/Chicago","America/Los_Angeles"]; }
})();

function PubliSection({ supabase, userId }: { supabase: any; userId: string }) {
  const [tz, setTz] = useState("Europe/Paris");
  const [autoPublish, setAutoPublish] = useState(true);
  const [reminderBefore, setReminderBefore] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("user_preferences").select("timezone,notif_email_reminder").eq("user_id", userId).maybeSingle();
      if (data?.timezone) setTz(data.timezone);
      if (data?.notif_email_reminder !== undefined) setReminderBefore(data.notif_email_reminder);
    })();
  }, [supabase, userId]);

  async function handleSave() {
    setSaving(true);
    await supabase.from("user_preferences").upsert(
      { user_id: userId, timezone: tz, notif_email_reminder: reminderBefore, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const TIME_SLOTS = ['08:00', '12:30', '18:30', '21:00'];

  return (
    <>
      <SectionHeader title="Publication" sub="Configurez la publication automatique et vos créneaux préférés." />

      <div className="st-card">
        <div className="label" style={{ marginBottom: 4 }}>Automatisation</div>
        <div className="set-row">
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Publication automatique</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>Klip publie au créneau planifié sans intervention manuelle.</div>
          </div>
          <Toggle checked={autoPublish} onChange={setAutoPublish} />
        </div>
        <div className="set-row">
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Rappel 1h avant</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>Notification avant chaque publication programmée.</div>
          </div>
          <Toggle checked={reminderBefore} onChange={setReminderBefore} />
        </div>
      </div>

      <div className="st-card">
        <div className="label" style={{ marginBottom: 12 }}>Créneaux conseillés</div>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 14 }}>Créneaux à fort engagement selon votre audience. L'IA les utilise lors de la planification automatique.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TIME_SLOTS.map(t => (
            <span key={t} className="chip" style={{ background: 'var(--mint-soft)', color: 'var(--mint-2)', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 12.5, padding: '6px 14px' }}>{t}</span>
          ))}
          <span className="chip" style={{ background: 'var(--sunk)', color: 'var(--ink-3)', fontSize: 12, padding: '6px 14px', border: '1px dashed var(--line)', cursor: 'default' }}>Personnaliser — bientôt</span>
        </div>
      </div>

      <div className="st-card">
        <div className="label" style={{ marginBottom: 12 }}>Fuseau horaire</div>
        <select className="st-input st-select" value={tz} onChange={e => setTz(e.target.value)}>
          {TIMEZONES_PUB.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </select>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>Utilisé pour la programmation automatique des posts.</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="st-btn" onClick={handleSave} disabled={saving}>
          {saving ? "Enregistrement…" : saved ? "Enregistré ✦" : "Enregistrer"}
        </button>
      </div>
    </>
  );
}

// ─── Integrations Tab ─────────────────────────────────────────────────────────

function IntegrationsTab({ supabase }: { supabase: any }) {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("workspaces").select("id,name,instagram_account_id,instagram_username,facebook_page_id").order("created_at");
      setWorkspaces(data ?? []);
      setLoading(false);
    })();
  }, [supabase]);

  return (
    <>
      <SectionHeader title="Intégrations" sub="Comptes Instagram et Facebook connectés à vos clients." />

      <div className="st-card">
        <div className="st-label" style={{ marginBottom: 16 }}>Réseaux sociaux par client</div>
        {loading ? (
          <div style={{ color: "var(--ink-3)", fontSize: 13 }}>Chargement…</div>
        ) : workspaces.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--ink-3)", fontSize: 13 }}>
            Aucun client.{" "}
            <Link href="/workspace/new" style={{ color: "var(--mint)", fontWeight: 600 }}>Créer un client</Link>
          </div>
        ) : (
          workspaces.map((ws, i) => {
            const color = WS_COLORS[i % WS_COLORS.length];
            const hasIG = !!ws.instagram_account_id;
            const hasFB = !!ws.facebook_page_id;
            return (
              <div key={ws.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 0", borderBottom: "1px solid rgba(20,22,15,.06)" }}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: color, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                  {ws.name.slice(0, 2).toUpperCase()}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)", marginBottom: 5 }}>{ws.name}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: hasIG ? "var(--mint-soft)" : "var(--sunk)", color: hasIG ? "var(--mint-2)" : "var(--ink-3)" }}>
                      {hasIG ? `@${ws.instagram_username || "Instagram"}` : "Instagram non connecté"}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: hasFB ? "rgba(24,119,242,.12)" : "var(--sunk)", color: hasFB ? "#1877F2" : "var(--ink-3)" }}>
                      {hasFB ? "Facebook connecté" : "Facebook non connecté"}
                    </span>
                  </div>
                </div>
                <Link href={`/workspace/${ws.id}/parametres`} className="st-btn-ghost" style={{ textDecoration: "none" }}>
                  Gérer
                </Link>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

// ─── Agency Tab ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = { admin: "Administrateur", member: "Membre", viewer: "Observateur" };

function AgencyTab({ supabase, userId }: { supabase: any; userId: string }) {
  const [agency, setAgency] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [agencyName, setAgencyName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savedName, setSavedName] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: ag } = await supabase.from("agencies").select("*").eq("owner_id", userId).maybeSingle();
      if (ag) {
        setAgency(ag);
        setAgencyName(ag.name);
        const { data: mems } = await supabase.from("agency_members").select("*").eq("agency_id", ag.id).order("invited_at");
        setMembers(mems ?? []);
      }
    })();
  }, [supabase, userId]);

  async function handleSaveName() {
    if (!agency || !agencyName.trim()) return;
    setSavingName(true);
    await supabase.from("agencies").update({ name: agencyName.trim() }).eq("id", agency.id);
    setAgency((a: any) => ({ ...a, name: agencyName.trim() }));
    setSavingName(false);
    setSavedName(true);
    setTimeout(() => setSavedName(false), 2500);
  }

  async function handleRoleChange(memberId: string, role: string) {
    await supabase.from("agency_members").update({ role }).eq("id", memberId);
    setMembers(ms => ms.map(m => m.id === memberId ? { ...m, role } : m));
  }

  async function handleRemoveMember(memberId: string, memberUserId: string) {
    if (memberUserId === userId) return;
    if (!confirm("Retirer ce membre de l'agence ?")) return;
    await supabase.from("agency_members").delete().eq("id", memberId);
    setMembers(ms => ms.filter(m => m.id !== memberId));
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || !agency) return;
    setInviting(true);
    setInviteMsg(null);
    const res = await fetch("/api/invite-member", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail.trim(), agency_id: agency.id, role: inviteRole }),
    });
    setInviting(false);
    if (res.ok) {
      setInviteMsg({ type: "ok", text: `Invitation envoyée à ${inviteEmail}.` });
      setInviteEmail("");
      setTimeout(() => { setInviteMsg(null); setShowInvite(false); }, 3000);
    } else {
      const body = await res.json().catch(() => ({}));
      setInviteMsg({ type: "err", text: body.error ?? "Erreur lors de l'envoi." });
    }
  }

  if (!agency) return (
    <div style={{ padding: "60px 0", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
      Aucune agence trouvée. Créez un compte Agence depuis l'onboarding.
    </div>
  );

  return (
    <>
      <SectionHeader title="Mon agence" sub="Gérez votre agence, vos membres et leurs accès." />

      {/* Agency name */}
      <div className="st-card">
        <div className="st-label" style={{ marginBottom: 12 }}>Informations de l'agence</div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="st-label">Nom de l'agence</label>
            <input className="st-input" type="text" value={agencyName} onChange={e => setAgencyName(e.target.value)} />
          </div>
          <button className="st-btn" style={{ alignSelf: "flex-end", minWidth: 110 }} onClick={handleSaveName} disabled={savingName}>
            {savingName ? "…" : savedName ? "Enregistré" : "Enregistrer"}
          </button>
        </div>
      </div>

      {/* Members */}
      <div className="st-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div className="st-label" style={{ margin: 0 }}>Membres ({members.length})</div>
          <button className="st-btn-ghost" onClick={() => { setShowInvite(!showInvite); setInviteMsg(null); }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5 }}><path d="M12 5v14M5 12h14"/></svg>
            Inviter un membre
          </button>
        </div>

        {showInvite && (
          <div style={{ background: "var(--sunk)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <form onSubmit={handleInvite} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label className="st-label">Email</label>
                <input className="st-input" type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="membre@agence.com" />
              </div>
              <div>
                <label className="st-label">Rôle</label>
                <select className="st-input st-select" value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ minWidth: 160 }}>
                  {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <button className="st-btn" type="submit" disabled={inviting || !inviteEmail.trim()}>{inviting ? "Envoi…" : "Envoyer"}</button>
            </form>
            {inviteMsg && (
              <p style={{ fontSize: 12.5, color: inviteMsg.type === "ok" ? "var(--mint-2)" : "var(--warn)", fontWeight: 600, marginTop: 10 }}>{inviteMsg.text}</p>
            )}
          </div>
        )}

        {members.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: "var(--ink-3)", fontSize: 13 }}>Aucun membre pour l'instant.</div>
        ) : (
          members.map((m, i) => {
            const isSelf = m.user_id === userId;
            const color = WS_COLORS[i % WS_COLORS.length];
            return (
              <div key={m.id} className="st-member-row">
                <div style={{ width: 32, height: 32, borderRadius: 8, background: color, display: "grid", placeItems: "center", fontSize: 9, fontWeight: 800, color: "#fff", flexShrink: 0, fontFamily: "var(--mono)" }}>
                  {m.user_id.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
                    {isSelf ? "Vous" : `Membre ${m.user_id.slice(0, 8)}`}
                    {isSelf && <span className="st-badge" style={{ background: "var(--mint-soft)", color: "var(--mint-2)", fontSize: 9 }}>Propriétaire</span>}
                  </div>
                  {!m.accepted_at && <div style={{ fontSize: 11, color: "var(--warn)", marginTop: 2 }}>Invitation en attente</div>}
                </div>
                <select
                  className="st-input st-select"
                  value={m.role}
                  onChange={e => handleRoleChange(m.id, e.target.value)}
                  disabled={isSelf}
                  style={{ width: "auto", padding: "6px 28px 6px 10px", fontSize: 12, minWidth: 140 }}
                >
                  {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                {!isSelf && (
                  <button className="st-btn-danger" style={{ padding: "6px 12px", fontSize: 11 }} onClick={() => handleRemoveMember(m.id, m.user_id)}>
                    Retirer
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

// ─── Billing Tab ──────────────────────────────────────────────────────────────

function BillingTab({ accountType }: { accountType: string }) {
  const plans: Record<string, { name: string; price: string; desc: string }> = {
    solo: { name: "Studio", price: "29€ / mois", desc: "3 clients · 1 profil · Posts illimités · IA incluse" },
    agency: { name: "Agence", price: "96€ / mois", desc: "10 clients · 5 membres · Workflow validation · Rôles" },
  };
  const plan = plans[accountType] ?? plans.solo;

  return (
    <>
      <SectionHeader title="Facturation" sub="Votre plan actuel et l'historique de vos factures." />

      {/* Subscription hero */}
      <div style={{ position: 'relative', borderRadius: 'var(--r-xl)', overflow: 'hidden', padding: '24px 26px', marginBottom: 16, background: 'linear-gradient(120deg,#0A2418,var(--forest) 55%,#103A28)', color: 'var(--cream)' }}>
        <div className="halo-blob" style={{ width: 240, height: 240, right: -60, top: -130, background: 'var(--mint)', opacity: .4 }} />
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div className="label" style={{ color: 'var(--mint)', marginBottom: 8 }}>Votre abonnement</div>
            <h2 className="h-display" style={{ fontSize: 28, color: 'var(--cream)' }}>{plan.name}</h2>
            <p style={{ color: 'var(--cream-2)', marginTop: 6, fontSize: 13.5 }}>{plan.desc}</p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            <div className="num" style={{ fontSize: 34, color: 'var(--acid)' }}>{plan.price}</div>
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/stripe/portal', { method: 'POST' });
                  const j = await res.json();
                  if (res.ok && j?.url) { window.location.href = j.url; return; }
                  alert(j?.error || "Aucun abonnement actif à gérer pour le moment.");
                } catch { alert("Une erreur est survenue."); }
              }}
              className="btn btn-primary btn-sm"
              style={{ border: 'none', cursor: 'pointer' }}
            >
              Gérer mon abonnement
            </button>
            <Link href="/onboarding/plan" style={{ fontSize: 12.5, color: 'var(--cream-2)', textDecoration: 'underline' }}>Changer de plan</Link>
          </div>
        </div>
      </div>

      <div className="st-card">
        <div className="st-label" style={{ marginBottom: 12 }}>Historique des factures</div>
        <div style={{ textAlign: "center", padding: "28px 0", color: "var(--ink-3)", fontSize: 13 }}>
          Aucune facture disponible pour le moment.
          {/* TODO: connecter Stripe pour la gestion réelle des factures */}
        </div>
      </div>
    </>
  );
}

// ─── Help Tab ─────────────────────────────────────────────────────────────────

function HelpTab({ supabase, userId }: { supabase: any; userId: string }) {
  const router = useRouter();
  const [tourReset, setTourReset] = useState(false);

  async function handleResetTour() {
    setTourReset(true);
    // 1) réinitialise les flags locaux (tour + checklist de prise en main)
    resetOnboardingTour();
    resetOnboardingChecklist();
    // 2) réinitialise le flag serveur, sinon le tour se re-marque "terminé" au montage
    try {
      await supabase.from("user_settings").upsert(
        { user_id: userId, onboarding_completed: false, onboarding_completed_at: null },
        { onConflict: "user_id" },
      );
    } catch {}
    router.push("/dashboard");
  }

  const items = [
    {
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
      title: "Revoir le tutoriel de démarrage",
      desc: "Relancer le tour de découverte des fonctionnalités principales.",
      action: <button className="st-btn-ghost" onClick={handleResetTour} disabled={tourReset}>{tourReset ? "Redirection…" : "Revoir"}</button>,
    },
    {
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>,
      title: "Documentation",
      desc: "Guides et références pour utiliser Klip.",
      action: <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 600 }}>Bientôt disponible</span>,
    },
    {
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
      title: "Nous contacter",
      desc: "Une question ou un problème ? L'équipe Klip répond.",
      action: <a href="mailto:contact@klip.fr" className="st-btn-ghost" style={{ textDecoration: "none" }}>contact@klip.fr</a>,
    },
  ];

  return (
    <>
      <SectionHeader title="Aide & Tutoriel" sub="Ressources pour bien démarrer et utiliser Klip." />

      <div className="st-card">
        {items.map((item, i) => (
          <div key={item.title} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0", borderBottom: i < items.length - 1 ? "1px solid rgba(20,22,15,.06)" : "none" }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: "var(--sunk)", display: "grid", placeItems: "center", color: "var(--ink-2)", flexShrink: 0 }}>
              {item.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)", marginBottom: 3 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{item.desc}</div>
            </div>
            {item.action}
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <span style={{ fontSize: 12, color: "var(--ink-3)", background: "var(--sunk)", padding: "4px 14px", borderRadius: 99 }}>
          Klip v0.1.0 — Bêta privée
        </span>
      </div>
    </>
  );
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; agencyOnly?: boolean; hidden?: boolean }[] = [
  { id: "profile",       label: "Mon compte" },
  { id: "security",      label: "Sécurité" },
  { id: "notifications", label: "Notifications" },
  { id: "publi",         label: "Publication" },
  { id: "integrations",  label: "Comptes sociaux" },
  { id: "agency",        label: "Mon équipe", agencyOnly: true },
  { id: "billing",       label: "Facturation" },
  { id: "help",          label: "Aide & Tutoriel" },
  { id: "appearance",    label: "Apparence", hidden: true },
];

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  profile:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  security:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l7 3v5c0 5-3.5 9-7 11C8.5 19 5 15 5 10V5l7-3z"/></svg>,
  notifications: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  publi:         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3L11 14M22 3l-7 19-4-8-8-4 19-7Z"/></svg>,
  appearance:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5l4 4L7 21H3v-4L16.5 3.5z"/></svg>,
  integrations:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>,
  agency:        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  billing:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/></svg>,
  help:          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>,
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  const { isAgency } = useAccountType();
  const [tab, setTab] = useState<Tab>("profile");
  const [session, setSession] = useState<any>(null);
  const [accountType, setAccountType] = useState<string>("solo");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      setSession(session);
      const { data } = await supabase.from("user_settings").select("account_type").eq("user_id", session.user.id).maybeSingle();
      if (data?.account_type) setAccountType(data.account_type);
    })();
  }, [supabase, router]);

  if (!session) return null;

  const userId = session.user.id as string;
  const email = session.user.email as string ?? "";
  const meta = session.user.user_metadata ?? {};
  const providers = (session.user.app_metadata?.providers as string[]) ?? [session.user.app_metadata?.provider ?? "email"];

  const visibleTabs = TABS.filter(t => (!t.agencyOnly || isAgency) && !t.hidden);

  return (
    <div className="app">
      <style dangerouslySetInnerHTML={{ __html: ST_CSS }} />
      <Sidebar />
      <div className="work">
        <div className="topbar">
          <h1 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>Paramètres</h1>
        </div>
        <div className="scroll">
          <div className="page" style={{ paddingBottom: 0 }}>
            <div style={{ marginBottom: 24 }}>
              <div className="label" style={{ marginBottom: 8 }}>Votre compte</div>
              <h1 className="h-display" style={{ fontSize: 32 }}>Réglages</h1>
            </div>
          </div>
          <div className="st-layout">

            {/* Settings sidebar nav */}
            <nav className="st-nav">
              <div className="st-nav-label" style={{ marginTop: 4 }}>Mon compte</div>
              {visibleTabs.map(t => (
                <button key={t.id} className={`st-tab-btn${tab === t.id ? " on" : ""}`} onClick={() => setTab(t.id)}>
                  <span style={{ flexShrink: 0, color: tab === t.id ? 'var(--mint-2)' : undefined, opacity: tab === t.id ? 1 : 0.55 }}>{TAB_ICONS[t.id]}</span>
                  {t.label}
                </button>
              ))}
            </nav>

            {/* Tab content */}
            <div className="st-content">
              {tab === "profile"       && <ProfileTab       supabase={supabase} userId={userId} email={email} meta={meta} />}
              {tab === "security"      && <SecurityTab      supabase={supabase} providers={providers} />}
              {tab === "notifications" && <NotificationsTab supabase={supabase} userId={userId} />}
              {tab === "publi"         && <PubliSection     supabase={supabase} userId={userId} />}
              {tab === "appearance"    && <AppearanceTab    supabase={supabase} userId={userId} />}
              {tab === "integrations"  && <IntegrationsTab  supabase={supabase} />}
              {tab === "agency"        && <AgencyTab        supabase={supabase} userId={userId} />}
              {tab === "billing"       && <BillingTab       accountType={accountType} />}
              {tab === "help"          && <HelpTab          supabase={supabase} userId={userId} />}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

