"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

/* Consigne de rédaction de la légende, au format du chat IA du montage.

   Même vocabulaire que `AiChatDock` : une carte blanche flottante, le texte
   posé dessus sans cadre, les actions en dessous, une pastille sombre ronde
   pour envoyer. Les styles `.mzchat-*` existent déjà dans globals.css, on les
   réutilise plutôt que d'en inventer un deuxième : l'app n'a pas besoin de deux
   façons de parler à une IA.

   Les suggestions du dessus sont des amorces, comme dans n'importe quel chat :
   elles évitent la page blanche, qui est le vrai frein quand on doit écrire une
   consigne pour la première fois. */

export default function CaptionPrompt({
  value, onChange, onSubmit, onCancel, busy,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const t = useTranslations("planning");
  const starters = [t("captionStarter1"), t("captionStarter2"), t("captionStarter3")];

  /* Dictée. On enregistre le micro puis on envoie l'audio à /api/transcribe,
     la même route que les sous-titres du montage, plutôt que la reconnaissance
     vocale du navigateur : celle-ci n'existe pas partout, et là où elle existe
     elle passe par les serveurs de l'éditeur du navigateur. Ici, le son ne sort
     pas de l'infrastructure du produit. */
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function toggleMic() {
    if (transcribing) return;
    if (recording) { recRef.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        // Le micro doit être relâché, sinon la pastille d'enregistrement reste
        // allumée dans l'onglet après la dictée.
        stream.getTracks().forEach(tr => tr.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 1200) return; // clic malheureux : rien à transcrire
        setTranscribing(true);
        try {
          const fd = new FormData();
          fd.append("audio", blob, "dictee.webm");
          const res = await fetch("/api/transcribe", { method: "POST", body: fd });
          const data = await res.json().catch(() => null);
          const said = (data?.segments ?? []).map((sg: { text: string }) => sg.text).join(" ").trim();
          if (said) onChange(value.trim() ? `${value.trim()} ${said}` : said);
        } catch { /* on laisse le champ tel quel : la personne peut taper */ }
        finally { setTranscribing(false); }
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch {
      // Micro refusé ou indisponible : le champ reste utilisable au clavier.
    }
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {starters.map(sug => (
          <button
            key={sug}
            type="button"
            onClick={() => onChange(value.trim() ? `${value.trim()} ${sug}` : sug)}
            disabled={busy}
            className="chip"
            style={{
              background: "var(--sunk)", color: "var(--ink-2)", border: "none", cursor: "pointer",
              fontFamily: "var(--sans)", fontWeight: 600, fontSize: 11.5, letterSpacing: 0,
            }}
          >
            {sug}
          </button>
        ))}
      </div>

      <div className="mzchat-input" style={{ margin: 0 }}>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={2}
          autoFocus
          placeholder={t("captionPromptPh")}
          onKeyDown={e => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit();
            if (e.key === "Escape") onCancel();
          }}
        />
        <div className="mzchat-actions">
          <span className="mzchat-hint">
            {busy ? t("captionWriting")
              : recording ? t("captionListening")
              : transcribing ? t("captionTranscribing")
              : t("captionPromptHint")}
          </span>
          <button
            type="button"
            onClick={toggleMic}
            disabled={busy || transcribing}
            className="mzchat-plus"
            title={t("captionDictate")}
            aria-label={t("captionDictate")}
            style={recording ? { background: "var(--warn-soft)", color: "var(--warn)" } : undefined}
          >
            {recording ? (
              <span style={{ width: 9, height: 9, borderRadius: 2, background: "currentColor", display: "block" }} />
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="mzchat-plus"
            title={t("captionCancel")}
            aria-label={t("captionCancel")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy || !value.trim()}
            className="mzchat-send"
            title={t("captionWrite")}
            aria-label={t("captionWrite")}
          >
            {busy ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="spin">
                <path d="M21 12a9 9 0 1 1-6.2-8.6" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
