"use client";
import React, { useState } from "react";
import MediaThumb from "@/components/MediaThumb";

function aspectForType(t?: string | null): string {
  if (t === "story" || t === "reel") return "9 / 16";
  if (t === "carrousel") return "1 / 1";
  return "4 / 5";
}

// ─── Aperçu du rendu publié ──────────────────────────────────────────────────
// Volet de droite de la fenêtre de post : on écrit à gauche, on voit à droite ce
// que verra l'abonné. Jusqu'ici on programmait un post sans jamais voir son rendu
// réel — la légende, le nom du compte et le cadrage n'apparaissaient nulle part
// ensemble. Structure reprise de l'éditeur de publication de Metricool.
export interface PreviewAccount { name?: string | null; instagram_username?: string | null; logo_url?: string | null }

export default function PostPreviewPane({ workspace, mediaUrl, caption, postType, platforms, compact, mediaHeight }: {
  workspace: PreviewAccount | null;
  mediaUrl?: string | null;
  caption: string;
  postType?: string | null;
  platforms?: string[];
  /** Version resserrée : sans la barre d'actions ni le rappel de coupure. */
  compact?: boolean;
  /** Hauteur imposée au média (ex. "min(56vh, 620px)") : le format 9:16 tient
      alors dans le volet au lieu de le faire défiler. */
  mediaHeight?: string;
}) {
  const available = platforms && platforms.length ? platforms : ["instagram"];
  const [platform, setPlatform] = useState<string>(available[0]);
  const [expanded, setExpanded] = useState(false);
  const active = available.includes(platform) ? platform : available[0];
  const handle = workspace?.instagram_username || workspace?.name || "votrecompte";
  const isIg = active === "instagram";
  // Instagram tronque autour de 125 caractères, Facebook autour de 250.
  const limit = isIg ? 125 : 250;
  const tooLong = caption.length > limit;
  const shown = expanded || !tooLong ? caption : caption.slice(0, limit).trimEnd() + "…";

  // Une story ou un reel ne se regardent pas comme un post de fil : plein écran,
  // pas de barre d'actions, pas de légende sous l'image. Les afficher dans la
  // carte du fil donnait un aperçu faux (retour Martin).
  const isFullScreen = postType === "story" || postType === "reel";

  if (isFullScreen && isIg) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="label" style={{ margin: 0 }}>Aperçu du rendu</span>
          <span className="chip" style={{ marginLeft: "auto", background: "var(--sunk)", color: "var(--ink-2)" }}>
            {postType === "reel" ? "Reel" : "Story"}
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{
            position: "relative",
            width: mediaHeight ? "auto" : "100%",
            height: mediaHeight,
            maxWidth: "100%",
            aspectRatio: "9 / 16",
            borderRadius: 16,
            overflow: "hidden",
            background: "#000",
            boxShadow: "0 6px 18px -10px rgba(13,15,10,.35)",
          }}>
            {mediaUrl ? <MediaThumb raw={mediaUrl} /> : <div style={{ width: "100%", height: "100%", background: "var(--sunk)" }} />}

            {/* Barre de progression : le repère visuel d'une story. */}
            {postType === "story" && (
              <div style={{ position: "absolute", top: 8, left: 10, right: 10, height: 2.5, borderRadius: 2, background: "rgba(255,255,255,.35)" }}>
                <div style={{ width: "38%", height: "100%", borderRadius: 2, background: "#fff" }} />
              </div>
            )}

            {/* Compte, en surimpression comme dans l'app */}
            <div style={{ position: "absolute", top: postType === "story" ? 18 : 12, left: 10, right: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", overflow: "hidden", background: "rgba(255,255,255,.25)", flexShrink: 0, display: "grid", placeItems: "center", boxShadow: "0 0 0 1.5px rgba(255,255,255,.8)" }}>
                {workspace?.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/proxy-image?url=${encodeURIComponent(workspace.logo_url)}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>{handle.slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{handle}</span>
              <span style={{ marginLeft: "auto", color: "#fff", fontSize: 15, lineHeight: 1, textShadow: "0 1px 3px rgba(0,0,0,.6)" }}>···</span>
            </div>

            {/* Un reel garde sa légende en bas et sa colonne d'actions à droite. */}
            {postType === "reel" && (
              <>
                <div style={{ position: "absolute", right: 8, bottom: 16, display: "flex", flexDirection: "column", gap: 14, color: "#fff", filter: "drop-shadow(0 1px 3px rgba(0,0,0,.6))" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z" /></svg>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 20.5l1.6-4.9A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" /></svg>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                </div>
                {caption && (
                  <div style={{ position: "absolute", left: 10, right: 46, bottom: 14, fontSize: 11.5, lineHeight: 1.4, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,.7)" }}>
                    <span style={{ fontWeight: 700 }}>{handle}</span> {caption.slice(0, 90)}{caption.length > 90 ? "…" : ""}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {postType === "story" && caption && !compact && (
          <p style={{ margin: 0, fontSize: 11, color: "var(--ink-3)", lineHeight: 1.45 }}>
            La légende n&apos;apparaît pas sur une story : elle sert au contexte interne et à la republication.
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span className="label" style={{ margin: 0 }}>Aperçu du rendu</span>
        {available.length > 1 && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            {available.map(p => (
              <button key={p} onClick={() => setPlatform(p)}
                style={{ padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "var(--sans)",
                  border: `1px solid ${active === p ? (p === "instagram" ? "#E1306C" : "#1877F2") : "var(--line)"}`,
                  background: active === p ? (p === "instagram" ? "#E1306C15" : "#1877F215") : "transparent",
                  color: active === p ? (p === "instagram" ? "#E1306C" : "#1877F2") : "var(--ink-3)" }}>
                {p === "instagram" ? "Instagram" : "Facebook"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Maquette du téléphone */}
      <div style={{ borderRadius: 14, border: "1px solid var(--line)", background: "var(--white)", overflow: "hidden", boxShadow: "0 6px 18px -10px rgba(13,15,10,.25)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 11px" }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", overflow: "hidden", background: "var(--sunk)", flexShrink: 0, display: "grid", placeItems: "center" }}>
            {workspace?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/proxy-image?url=${encodeURIComponent(workspace.logo_url)}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 12, fontWeight: 800, color: "var(--ink-3)" }}>{handle.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{handle}</div>
            {!isIg && <div style={{ fontSize: 10.5, color: "var(--ink-3)" }}>À l&apos;instant · 🌍</div>}
          </div>
          <span style={{ marginLeft: "auto", color: "var(--ink-3)", fontSize: 15, lineHeight: 1 }}>···</span>
        </div>

        {/* Facebook met la légende AU-DESSUS du média, Instagram en dessous. */}
        {!isIg && caption && (
          <div style={{ padding: "0 11px 9px", fontSize: 12.5, lineHeight: 1.45, color: "var(--ink)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{shown}</div>
        )}

        {/* Média : piloté par la LARGEUR par défaut, par la HAUTEUR quand l'appelant
            impose `mediaHeight` (fenêtre de programmation). Un Reel 9:16 dépassait
            sinon du volet et on ne voyait jamais le post en entier. `max-width`
            reprend la main si la largeur dérivée déborde. */}
        {/* Le fond noir ne couvre QUE le média : posé sur la rangée entière, il
            encadrait la photo de deux barres noires (retour Martin). */}
        <div style={{ display: "flex", justifyContent: "center", background: "var(--sunk)" }}>
          <div style={{
            width: mediaHeight ? "auto" : "100%",
            height: mediaHeight,
            maxWidth: "100%",
            aspectRatio: aspectForType(postType),
            background: "var(--sunk)",
            overflow: "hidden",
          }}>
            {mediaUrl ? <MediaThumb raw={mediaUrl} /> : <div style={{ width: "100%", height: "100%", background: "var(--sunk)" }} />}
          </div>
        </div>

        {isIg && (
          <>
            <div style={{ display: "flex", gap: 12, padding: "9px 11px 4px", color: "var(--ink)" }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/></svg>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 20.5l1.6-4.9A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z"/></svg>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ marginLeft: "auto" }}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </div>
            {caption && (
              <div style={{ padding: "0 11px 12px", fontSize: 12.5, lineHeight: 1.45, color: "var(--ink)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                <span style={{ fontWeight: 700 }}>{handle}</span> {shown}
              </div>
            )}
          </>
        )}
      </div>

      {tooLong && !compact && (
        <button onClick={() => setExpanded(v => !v)}
          style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11.5, fontWeight: 700, color: "var(--ink-2)", fontFamily: "var(--sans)" }}>
          {expanded
            ? "Replier comme dans l’app"
            : `Coupé à ${limit} caractères — voir la légende entière`}
        </button>
      )}
      {tooLong && !expanded && !compact && (
        <p style={{ margin: 0, fontSize: 11, color: "var(--ink-3)", lineHeight: 1.4 }}>
          Au-delà, l&apos;abonné doit toucher « plus » : place l&apos;essentiel avant la coupe.
        </p>
      )}
    </div>
  );
}

