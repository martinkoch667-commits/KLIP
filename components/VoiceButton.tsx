"use client";

// Dictée vocale. Le bouton n'est pas un utilitaire discret : parler au produit
// est l'un de ses gestes les plus forts, donc il s'affiche en pilule leaf avec
// libellé, un halo d'appel tant qu'on ne l'a jamais utilisé, puis une capsule
// violette dont les barres suivent le niveau réel du micro pendant l'écoute.

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

const BAR_COUNT = 5;
const USED_KEY = "klip:voice-used";

// La reconnaissance a besoin d'une locale complète, pas d'un code court.
const SPEECH_LANG: Record<string, string> = {
  fr: "fr-FR", en: "en-US", es: "es-ES", de: "de-DE", it: "it-IT", pt: "pt-PT",
};

interface VoiceButtonProps {
  value: string;
  onChange: (v: string) => void;
  /** Pilule sans libellé, pour les rangées serrées. */
  compact?: boolean;
  /** Affiche la pastille « nouveau » tant que la dictée n'a jamais servi. */
  hint?: boolean;
}

function mmss(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function VoiceButton({ value, onChange, compact = false, hint = false }: VoiceButtonProps) {
  const t = useTranslations("voice");
  const locale = useLocale();

  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [fresh, setFresh] = useState(false);      // jamais dicté sur cet appareil
  const [reactive, setReactive] = useState(false); // analyseur audio branché
  const [seconds, setSeconds] = useState(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const baseRef = useRef("");                      // valeur au démarrage de la dictée
  const btnRef = useRef<HTMLButtonElement>(null);
  const barsRef = useRef<(HTMLElement | null)[]>([]);
  const meterRef = useRef<{ ctx: AudioContext; stream: MediaStream; raf: number } | null>(null);
  const wantMeterRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    try {
      setFresh(!window.localStorage.getItem(USED_KEY));
    } catch {
      setFresh(true);
    }
  }, []);

  const stopMeter = useCallback(() => {
    wantMeterRef.current = false;
    const m = meterRef.current;
    meterRef.current = null;
    setReactive(false);
    if (!m) return;
    cancelAnimationFrame(m.raf);
    m.stream.getTracks().forEach((track) => track.stop());
    void m.ctx.close().catch(() => {});
  }, []);

  const startMeter = useCallback(async () => {
    wantMeterRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // L'utilisateur a pu arrêter pendant la demande d'autorisation.
      if (!wantMeterRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.72;
      ctx.createMediaStreamSource(stream).connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const step = Math.floor(data.length / BAR_COUNT);
      const loop = () => {
        analyser.getByteFrequencyData(data);
        for (let i = 0; i < BAR_COUNT; i++) {
          let sum = 0;
          for (let j = i * step; j < (i + 1) * step; j++) sum += data[j];
          const level = Math.min(1, sum / step / 110);
          const bar = barsRef.current[i];
          // Écriture directe dans le DOM : 60 rendus React/s pour 5 barres, non.
          if (bar) bar.style.transform = `scaleY(${(0.16 + level * 0.84).toFixed(3)})`;
        }
        if (meterRef.current) meterRef.current.raf = requestAnimationFrame(loop);
      };

      meterRef.current = { ctx, stream, raf: 0 };
      setReactive(true);
      meterRef.current.raf = requestAnimationFrame(loop);
    } catch {
      // Micro refusé pour l'analyse ou navigateur récalcitrant : barres animées.
      setReactive(false);
    }
  }, []);

  // Le bloc porteur du champ s'allume pendant l'écoute (cf. .voice-scope--live).
  useEffect(() => {
    const scope = btnRef.current?.closest("[data-voice-scope]");
    if (!scope) return;
    scope.classList.toggle("voice-scope--live", recording);
    return () => scope.classList.remove("voice-scope--live");
  }, [recording]);

  useEffect(() => {
    if (!recording) {
      setSeconds(0);
      return;
    }
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    stopMeter();
  }, [stopMeter]);

  function toggle() {
    if (recording) {
      recognitionRef.current?.stop();
      stopMeter();
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = new SR();
    r.lang = SPEECH_LANG[locale] ?? SPEECH_LANG.en;
    r.interimResults = true;
    r.continuous = false;

    baseRef.current = value;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }
      const prefix = baseRef.current ? baseRef.current + " " : "";
      if (final) {
        onChange((prefix + final.trim()).trim());
      } else if (interim) {
        onChange((prefix + interim).trim());
      }
    };

    const end = () => {
      setRecording(false);
      stopMeter();
    };
    r.onend = end;
    r.onerror = end;

    recognitionRef.current = r;
    r.start();
    setRecording(true);
    void startMeter();

    if (fresh) {
      setFresh(false);
      try {
        window.localStorage.setItem(USED_KEY, "1");
      } catch {
        /* mode privé : le halo réapparaîtra, ce n'est pas grave */
      }
    }
  }

  if (!supported) return null;

  const showHint = hint && fresh && !recording;
  const className = [
    "voice-pill",
    compact && !recording ? "voice-pill--compact" : "",
    recording ? "voice-pill--live" : "",
    fresh && !recording ? "voice-pill--new" : "",
  ].filter(Boolean).join(" ");

  const button = (
    <button
      ref={btnRef}
      type="button"
      onClick={toggle}
      aria-pressed={recording}
      aria-label={recording ? t("stopTitle") : t("startTitle")}
      title={recording ? t("stopTitle") : t("startTitle")}
      className={className}
    >
      <span className="voice-pill__ic" aria-hidden="true">
        {recording ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <rect x="5" y="5" width="14" height="14" rx="3.5" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <path d="M12 19v3" />
            <path d="M8 22h8" />
          </svg>
        )}
      </span>

      {recording ? (
        <>
          <span className={`voice-bars${reactive ? "" : " voice-bars--idle"}`} aria-hidden="true">
            {Array.from({ length: BAR_COUNT }).map((_, i) => (
              <i key={i} ref={(el) => { barsRef.current[i] = el; }} />
            ))}
          </span>
          {!compact && <span className="voice-pill__txt">{t("listening")}</span>}
          <span className="voice-time">{mmss(seconds)}</span>
        </>
      ) : (
        !compact && <span className="voice-pill__txt">{t("dictate")}</span>
      )}
    </button>
  );

  if (!showHint) return button;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {button}
      <span className="voice-hint">{t("tip")}</span>
    </span>
  );
}
