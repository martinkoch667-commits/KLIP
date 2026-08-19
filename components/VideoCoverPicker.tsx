"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* Choix de la miniature d'une vidéo, au moment de programmer.

   La miniature est la seule chose que voit un abonné qui fait défiler son fil :
   laisser Instagram prendre la première image, c'est souvent afficher un flou de
   démarrage ou un plan noir. Le montage permettait déjà de la choisir au
   curseur, mais seulement là-bas, et seulement pendant qu'on monte.

   Replié par défaut. Un lecteur, un curseur et trois boutons posés en permanence
   dans le formulaire, c'était une deuxième interface au milieu de la première,
   pour un réglage qu'on ne touche qu'une fois. Ne reste que la vignette
   actuelle et un bouton ; le reste s'ouvre en fenêtre.

   La miniature vit dans `posts.thumbnail_url`, la même colonne que celle
   qu'écrit le montage, et part vers Instagram en `cover_url`. */

const BOX_H = 168;

export default function VideoCoverPicker({
  videoUrl, postId, workspaceId, value, onChange,
}: {
  videoUrl: string;
  postId: string;
  workspaceId: string;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const supabase = createClientComponentClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dur, setDur] = useState(0);
  const [aspect, setAspect] = useState(9 / 16);
  const [at, setAt] = useState(0);
  const [busy, setBusy] = useState<"frame" | "file" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  // `onLoadedMetadata` peut avoir eu lieu avant que React n'attache le
  // gestionnaire quand le fichier est déjà en cache : on lit aussi l'élément.
  function readMeta(v: HTMLVideoElement) {
    if (v.duration && isFinite(v.duration)) setDur(v.duration);
    if (v.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight);
  }

  useEffect(() => {
    if (!open) return;
    setAt(0); setErr(null);
    const v = videoRef.current;
    if (v && v.readyState >= 1) readMeta(v);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, videoUrl]);

  async function upload(blob: Blob): Promise<string | null> {
    const path = `${workspaceId}/cover-${postId}-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("photos").upload(path, blob, { upsert: true, contentType: blob.type || "image/jpeg" });
    if (error) return null;
    return supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
  }

  async function save(url: string | null) {
    await supabase.from("posts").update({ thumbnail_url: url }).eq("id", postId);
    onChange(url);
  }

  async function takeFrame() {
    const v = videoRef.current;
    if (!v || busy) return;
    setBusy("frame"); setErr(null);
    try {
      // La vidéo affichée est déjà placée sur l'instant voulu : on peint
      // directement l'élément, sans recharger le fichier une seconde fois.
      const c = document.createElement("canvas");
      c.width = v.videoWidth || 720;
      c.height = v.videoHeight || 1280;
      c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
      const blob: Blob | null = await new Promise(res => c.toBlob(b => res(b), "image/jpeg", 0.86));
      if (!blob) throw new Error("frame");
      const url = await upload(blob);
      if (!url) throw new Error("upload");
      await save(url);
      setOpen(false);
    } catch {
      setErr("L'image n'a pas pu être enregistrée. Réessayez.");
    } finally {
      setBusy(null);
    }
  }

  async function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr("Choisissez une image."); return; }
    setBusy("file"); setErr(null);
    try {
      const url = await upload(file);
      if (!url) throw new Error("upload");
      await save(url);
      setOpen(false);
    } catch {
      setErr("L'image n'a pas pu être envoyée. Réessayez.");
    } finally {
      setBusy(null);
    }
  }

  const pct = dur > 0 ? (at / dur) * 100 : 0;

  return (
    <div>
      <label className="label" style={{ display: "block", marginBottom: 6 }}>Miniature de la vidéo</label>

      {/* Replié : ce que verra l'abonné, et de quoi l'ouvrir. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 44, height: 58, borderRadius: 8, overflow: "hidden", background: "#000", flexShrink: 0, boxShadow: "inset 0 0 0 1px var(--line)", display: "grid", placeItems: "center" }}>
          {value
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            : <span style={{ fontSize: 9, color: "rgba(255,255,255,.5)", textAlign: "center", lineHeight: 1.3, padding: 4 }}>1re<br />image</span>}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>
            {value ? "Miniature choisie" : "Miniature par défaut"}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.4 }}>
            {value ? "C'est elle qui s'affichera dans le fil." : "Instagram prendra la première image de la vidéo."}
          </div>
        </div>
        <button onClick={() => setOpen(true)} className="btn btn-sm btn-ghost" style={{ marginLeft: "auto", height: 30, fontSize: 11.5, flexShrink: 0 }}>
          {value ? "Modifier" : "Choisir"}
        </button>
      </div>

      {/* Déplié : la fenêtre. Rendue dans <body> pour ne dépendre d'aucun
          conteneur de la page (défilement, transformations, z-index). */}
      {open && mounted && createPortal(
        <div
          role="dialog" aria-modal="true" aria-label="Miniature de la vidéo"
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(7,33,23,.62)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 420, background: "var(--card, #fff)", borderRadius: "var(--r-l, 18px)", padding: "18px 18px 16px", boxShadow: "0 40px 90px -30px rgba(7,33,23,.55)", fontFamily: "var(--sans)" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 15, color: "var(--ink)" }}>Miniature de la vidéo</span>
              <button onClick={() => setOpen(false)} className="mzchat-plus" style={{ marginLeft: "auto" }} aria-label="Fermer">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ height: BOX_H, width: BOX_H * aspect, maxWidth: "100%", borderRadius: 12, overflow: "hidden", background: "#000", boxShadow: "inset 0 0 0 1px var(--line)" }}>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  crossOrigin="anonymous"
                  muted
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={e => readMeta(e.currentTarget)}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>
            </div>

            <input
              className="ed-range"
              type="range" min={0} max={Math.max(0.1, dur)} step={0.05} value={at}
              onChange={e => {
                const v = parseFloat(e.target.value);
                setAt(v);
                if (videoRef.current) videoRef.current.currentTime = v;
              }}
              style={{ width: "100%", marginTop: 14, background: `linear-gradient(90deg, var(--leaf) ${pct}%, rgba(13,15,10,.16) ${pct}%)` }}
              aria-label="Instant de la miniature"
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>
              <span>{at.toFixed(1)}s</span>
              <span>{dur ? `${dur.toFixed(1)}s` : ""}</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button onClick={takeFrame} disabled={busy !== null || !dur} className="btn btn-primary btn-sm" style={{ height: 32, fontSize: 12 }}>
                {busy === "frame" ? "Enregistrement…" : "Prendre cette image"}
              </button>
              <button onClick={() => fileRef.current?.click()} disabled={busy !== null} className="btn btn-ghost btn-sm" style={{ height: 32, fontSize: 12 }}>
                {busy === "file" ? "Envoi…" : "Importer"}
              </button>
              {value && (
                <button onClick={() => { save(null); setOpen(false); }} disabled={busy !== null}
                  style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "var(--ink-3)" }}>
                  Retirer
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={importFile} style={{ display: "none" }} />
            </div>

            {err && <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "var(--warn)" }}>{err}</p>}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
