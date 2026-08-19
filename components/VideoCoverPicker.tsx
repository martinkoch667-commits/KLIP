"use client";

import { useEffect, useRef, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/* Choix de la miniature d'une vidéo, au moment de programmer.

   La miniature est la seule chose que voit un abonné qui fait défiler son fil :
   laisser Instagram prendre la première image, c'est souvent afficher un flou de
   démarrage ou un plan noir. Le montage permettait déjà de la choisir au
   curseur, mais seulement là-bas, et seulement pendant qu'on monte. Ici on la
   choisit au moment où l'on décide de publier, sans rouvrir l'éditeur.

   Deux voies : prendre une image de la vidéo, ou importer la sienne (une
   couverture dessinée dans l'éditeur, par exemple).

   La miniature vit dans `posts.thumbnail_url`, la même colonne que celle
   qu'écrit le montage : les deux chemins ne se contredisent pas. */

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
  const [at, setAt] = useState(0);
  const [busy, setBusy] = useState<"frame" | "file" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // On garde la vidéo silencieuse et non lue : elle ne sert qu'à se placer sur
  // une image. Sans `preload`, Safari ne rend rien tant qu'on n'a pas joué.
  useEffect(() => { setAt(0); setDur(0); }, [videoUrl]);

  async function upload(blob: Blob): Promise<string | null> {
    const path = `${workspaceId}/cover-${postId}-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("photos").upload(path, blob, { upsert: true, contentType: blob.type || "image/jpeg" });
    if (error) return null;
    return supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
  }

  async function save(url: string) {
    await supabase.from("posts").update({ thumbnail_url: url }).eq("id", postId);
    onChange(url);
  }

  async function takeFrame() {
    const v = videoRef.current;
    if (!v || busy) return;
    setBusy("frame"); setErr(null);
    try {
      // La vidéo affichée est déjà positionnée sur l'instant voulu : on peint
      // directement l'élément, sans recharger le fichier une deuxième fois.
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

  return (
    <div>
      <label className="label" style={{ display: "block", marginBottom: 6 }}>Miniature de la vidéo</label>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {/* Ce que verra l'abonné dans son fil. */}
        <div style={{ position: "relative", flex: "0 0 84px", width: 84, aspectRatio: "9 / 16", borderRadius: 8, overflow: "hidden", background: "#000", border: "1px solid var(--line)" }}>
          {value
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            : <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 10.5, color: "var(--ink-3)", textAlign: "center", padding: 8 }}>Première image</span>}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <video
            ref={videoRef}
            src={videoUrl}
            crossOrigin="anonymous"
            muted
            playsInline
            preload="metadata"
            onLoadedMetadata={e => setDur(e.currentTarget.duration || 0)}
            style={{ width: "100%", maxHeight: 108, borderRadius: 8, background: "#000", display: "block", objectFit: "contain" }}
          />
          <input
            type="range" min={0} max={Math.max(0.1, dur)} step={0.05} value={at}
            onChange={e => {
              const v = parseFloat(e.target.value);
              setAt(v);
              if (videoRef.current) videoRef.current.currentTime = v;
            }}
            style={{ width: "100%", marginTop: 8 }}
            aria-label="Instant de la miniature"
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: "var(--ink-3)" }}>
            <span>{at.toFixed(1)}s</span>
            <span>{dur ? `${dur.toFixed(1)}s` : ""}</span>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button onClick={takeFrame} disabled={busy !== null || !dur} className="btn btn-sm btn-ghost" style={{ height: 30, fontSize: 11.5 }}>
              {busy === "frame" ? "Enregistrement…" : "Prendre cette image"}
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={busy !== null} className="btn btn-sm btn-ghost" style={{ height: 30, fontSize: 11.5 }}>
              {busy === "file" ? "Envoi…" : "Importer une image"}
            </button>
            {value && (
              <button onClick={() => { onChange(null); supabase.from("posts").update({ thumbnail_url: null }).eq("id", postId).then(() => {}); }}
                disabled={busy !== null} className="btn btn-sm btn-ghost" style={{ height: 30, fontSize: 11.5, color: "var(--ink-3)" }}>
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
