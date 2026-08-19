"use client";

import { useEffect, useRef, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* Choix de la miniature d'une vidéo, au moment de programmer.

   La miniature est la seule chose que voit un abonné qui fait défiler son fil :
   laisser Instagram prendre la première image, c'est souvent afficher un flou de
   démarrage ou un plan noir. Le montage permettait déjà de la choisir au
   curseur, mais seulement là-bas, et seulement pendant qu'on monte. Ici on la
   choisit au moment où l'on décide de publier, sans rouvrir l'éditeur.

   Deux voies : prendre une image de la vidéo, ou importer la sienne.

   La miniature vit dans `posts.thumbnail_url`, la même colonne que celle
   qu'écrit le montage, et part vers Instagram en `cover_url`.

   Mise en forme : les deux visuels ont la MÊME hauteur et chacun le ratio de sa
   source. Un cadre de largeur fixe donnait de grandes bandes noires autour d'une
   vidéo verticale, ce qui faisait tache au milieu d'un formulaire propre. */

const BOX_H = 132; // hauteur commune des deux aperçus

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
  const [dur, setDur] = useState(0);
  const [aspect, setAspect] = useState(9 / 16);
  const [at, setAt] = useState(0);
  const [busy, setBusy] = useState<"frame" | "file" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Lecture des dimensions et de la durée. `onLoadedMetadata` ne suffit pas :
  // quand le fichier est déjà en cache, l'événement peut avoir eu lieu avant que
  // React n'attache le gestionnaire, et l'aperçu resterait alors au ratio par
  // défaut. On lit donc aussi l'état de l'élément au montage.
  function readMeta(v: HTMLVideoElement) {
    if (v.duration && isFinite(v.duration)) setDur(v.duration);
    if (v.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight);
  }

  useEffect(() => {
    setAt(0); setDur(0);
    const v = videoRef.current;
    if (v && v.readyState >= 1) readMeta(v);
  }, [videoUrl]);

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
    } catch {
      setErr("L'image n'a pas pu être envoyée. Réessayez.");
    } finally {
      setBusy(null);
    }
  }

  const pct = dur > 0 ? (at / dur) * 100 : 0;
  const frame: React.CSSProperties = {
    height: BOX_H, borderRadius: 10, overflow: "hidden", background: "#000",
    boxShadow: "inset 0 0 0 1px var(--line)", flexShrink: 0,
  };

  return (
    <div>
      <label className="label" style={{ display: "block", marginBottom: 8 }}>Miniature de la vidéo</label>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* Ce que verra l'abonné dans le fil. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ ...frame, width: BOX_H * aspect, display: "grid", placeItems: "center" }}>
            {value
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              : <span style={{ fontSize: 10.5, color: "var(--cream-3)", textAlign: "center", padding: 10, lineHeight: 1.4 }}>Aucune<br />miniature</span>}
          </div>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--ink-3)", textAlign: "center" }}>
            {value ? "Choisie" : "Par défaut"}
          </span>
        </div>

        {/* Le film, à parcourir. */}
        <div style={{ flex: 1, minWidth: 190 }}>
          <div style={{ ...frame, width: BOX_H * aspect, maxWidth: "100%" }}>
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

          <input
            className="ed-range"
            type="range" min={0} max={Math.max(0.1, dur)} step={0.05} value={at}
            onChange={e => {
              const v = parseFloat(e.target.value);
              setAt(v);
              if (videoRef.current) videoRef.current.currentTime = v;
            }}
            style={{
              width: "100%", marginTop: 12,
              // Remplissage à la couleur de la marque, sans dépendre du bleu du navigateur.
              background: `linear-gradient(90deg, var(--leaf) ${pct}%, rgba(13,15,10,.16) ${pct}%)`,
            }}
            aria-label="Instant de la miniature"
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>
            <span>{at.toFixed(1)}s</span>
            <span>{dur ? `${dur.toFixed(1)}s` : ""}</span>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button onClick={takeFrame} disabled={busy !== null || !dur} className="btn btn-sm" style={{ height: 30, fontSize: 11.5 }}>
              {busy === "frame" ? "Enregistrement…" : "Prendre cette image"}
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={busy !== null} className="btn btn-sm btn-ghost" style={{ height: 30, fontSize: 11.5 }}>
              {busy === "file" ? "Envoi…" : "Importer"}
            </button>
            {value && (
              <button onClick={() => save(null)} disabled={busy !== null} className="btn btn-sm btn-ghost" style={{ height: 30, fontSize: 11.5, color: "var(--ink-3)" }}>
                Retirer
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={importFile} style={{ display: "none" }} />
          </div>

          {err && <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--warn)" }}>{err}</p>}
        </div>
      </div>
    </div>
  );
}
