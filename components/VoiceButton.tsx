"use client";

// Dictée vocale. Le bouton n'est pas un utilitaire discret : parler au produit
// est l'un de ses gestes les plus forts, donc il s'affiche en pilule leaf avec
// libellé, un halo d'appel tant qu'on ne l'a jamais utilisé, puis une capsule
// violette dont les barres suivent le niveau réel du micro pendant l'écoute.
//
// Fiabilité : la reconnaissance tourne en `continuous` et se relance seule tant
// que l'utilisateur n'a pas cliqué « Terminer » (sinon Chrome coupe au premier
// silence, et cliquer semblait « ne rien faire »). L'analyseur de niveau, lui,
// est un bonus : s'il gêne la capture, on le débranche et on repart sans lui.

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LOCALES, LOCALE_LABELS, isLocale, type Locale } from "@/lib/i18n/config";

const BAR_COUNT = 5;
const USED_KEY = "klip:voice-used";
const LANG_KEY = "klip:voice-lang";
// Plusieurs micros cohabitent sur une même page : quand l'un change de langue,
// les autres doivent suivre, sinon l'affichage ment sur la moitié des champs.
const LANG_EVENT = "klip:voice-lang-change";

// La reconnaissance a besoin d'une locale complète, pas d'un code court.
const SPEECH_LANG: Record<Locale, string> = {
  fr: "fr-FR", en: "en-US", es: "es-ES", de: "de-DE", it: "it-IT", pt: "pt-PT",
};

// Erreurs qui condamnent la session : inutile de relancer, il faut le dire.
const FATAL = new Set(["not-allowed", "service-not-allowed", "language-not-supported"]);

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

// Petit signal sonore : deux notes montantes au départ, descendantes à l'arrêt.
// Synthétisé à la volée — aucun fichier à charger, et le clic fait office de
// geste utilisateur, donc l'AudioContext démarre sans blocage navigateur.
function chime(up: boolean) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = new Ctx();
    const notes = up ? [587.33, 880] : [880, 587.33]; // ré5 → la5
    notes.forEach((f, i) => {
      const t0 = ctx.currentTime + i * 0.075;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.13, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.18);
    });
    window.setTimeout(() => void ctx.close().catch(() => {}), 500);
  } catch {
    /* pas de son, pas grave */
  }
}

export default function VoiceButton({ value, onChange, compact = false, hint = false }: VoiceButtonProps) {
  const t = useTranslations("voice");
  const locale = useLocale();

  // Langue DICTÉE ≠ langue de l'interface : on peut très bien piloter une app en
  // anglais et parler français. On part de la langue de l'interface, puis le
  // choix de l'utilisateur prime et se retient (sinon la reconnaissance rend du
  // charabia, un moteur anglais sur une phrase française).
  const [lang, setLang] = useState<Locale>(isLocale(locale) ? locale : "en");
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<Locale>(lang);
  langRef.current = lang;

  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [blocked, setBlocked] = useState(false);   // micro refusé / indisponible
  const [fresh, setFresh] = useState(false);       // jamais dicté sur cet appareil
  const [reactive, setReactive] = useState(false); // analyseur audio branché
  const [seconds, setSeconds] = useState(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const wantRef = useRef(false);       // l'utilisateur veut dicter (≠ session en cours)
  const baseRef = useRef("");          // valeur au démarrage de la session courante
  const valueRef = useRef(value);      // dernière valeur connue du champ
  const meterOkRef = useRef(true);     // l'analyseur est-il encore le bienvenu ?
  const strikeRef = useRef(0);         // sessions mortes-nées d'affilée (pas de micro ?)
  const btnRef = useRef<HTMLButtonElement>(null);
  const langWrapRef = useRef<HTMLSpanElement>(null);
  const barsRef = useRef<(HTMLElement | null)[]>([]);
  const meterRef = useRef<{ ctx: AudioContext; stream: MediaStream; raf: number } | null>(null);

  valueRef.current = value;

  useEffect(() => {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    try {
      setFresh(!window.localStorage.getItem(USED_KEY));
      const saved = window.localStorage.getItem(LANG_KEY);
      if (isLocale(saved)) setLang(saved);
    } catch {
      setFresh(true);
    }
  }, []);

  useEffect(() => {
    const sync = (e: Event) => {
      const next = (e as CustomEvent).detail;
      if (isLocale(next)) setLang(next);
    };
    window.addEventListener(LANG_EVENT, sync);
    return () => window.removeEventListener(LANG_EVENT, sync);
  }, []);

  // Fermeture du menu de langue au clic ailleurs / à l'échap. Le test se fait
  // sur l'appartenance au menu (contains) et non sur la propagation : sinon le
  // pointerdown fermait le menu avant que le clic n'atteigne l'option.
  useEffect(() => {
    if (!langOpen) return;
    const onDown = (e: PointerEvent) => {
      if (langWrapRef.current?.contains(e.target as Node)) return;
      setLangOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLangOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [langOpen]);

  const stopMeter = useCallback(() => {
    const m = meterRef.current;
    meterRef.current = null;
    setReactive(false);
    if (!m) return;
    cancelAnimationFrame(m.raf);
    m.stream.getTracks().forEach((track) => track.stop());
    void m.ctx.close().catch(() => {});
  }, []);

  const startMeter = useCallback(async () => {
    if (!meterOkRef.current || meterRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // L'utilisateur a pu arrêter pendant la demande d'autorisation.
      if (!wantRef.current) {
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

  const finish = useCallback((wasBlocked = false) => {
    wantRef.current = false;
    recognitionRef.current = null;
    stopMeter();
    setRecording(false);
    if (wasBlocked) {
      setBlocked(true);
      window.setTimeout(() => setBlocked(false), 3200);
    }
  }, [stopMeter]);

  // Une session de reconnaissance. Chrome la coupe tout seul (silence, réseau,
  // limite de durée) : on la relance tant que `wantRef` est vrai.
  const startSession = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = new SR();
    r.lang = SPEECH_LANG[langRef.current] ?? SPEECH_LANG.en;
    r.interimResults = true;
    r.continuous = true;

    baseRef.current = valueRef.current;
    const startedAt = Date.now();
    let lastError = "";
    let gotResult = false;

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
      const spoken = (final + interim).trim();
      if (spoken) {
        gotResult = true;
        strikeRef.current = 0;
        onChange((prefix + spoken).trim());
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onerror = (e: any) => {
      lastError = e?.error ?? "";
      // L'analyseur de niveau se dispute la capture sur certaines machines :
      // on le sacrifie plutôt que la dictée.
      if (lastError === "audio-capture" || lastError === "aborted") {
        meterOkRef.current = false;
        stopMeter();
      }
    };

    r.onend = () => {
      if (!wantRef.current) { finish(); return; }
      if (FATAL.has(lastError)) { finish(true); return; }
      // Session morte-née (pas de micro branché, capture refusée par l'OS…) :
      // trois d'affilée et on arrête de s'acharner, on le dit à l'écran.
      if (!gotResult && Date.now() - startedAt < 700) {
        if (++strikeRef.current >= 3) { finish(true); return; }
      } else {
        strikeRef.current = 0;
      }
      // Relance : la valeur courante devient la nouvelle base, sinon le texte
      // déjà dicté serait répété au tour suivant.
      window.setTimeout(() => {
        if (!wantRef.current) { finish(); return; }
        try { startSession(); } catch { finish(true); }
      }, 180);
    };

    recognitionRef.current = r;
    r.start();
  }, [onChange, finish, stopMeter]);

  // Le bloc porteur du champ s'allume pendant l'écoute (cf. .voice-scope--live).
  useEffect(() => {
    const scope = btnRef.current?.closest("[data-voice-scope]");
    if (!scope) return;
    scope.classList.toggle("voice-scope--live", recording);
    return () => scope.classList.remove("voice-scope--live");
  }, [recording]);

  useEffect(() => {
    if (!recording) { setSeconds(0); return; }
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  useEffect(() => () => {
    wantRef.current = false;
    try { recognitionRef.current?.abort?.(); } catch { /* déjà fermée */ }
    stopMeter();
  }, [stopMeter]);

  function toggle() {
    if (wantRef.current) {
      // Arrêt demandé : on coupe d'abord l'intention, sinon onend relancerait.
      wantRef.current = false;
      chime(false);
      try { recognitionRef.current?.stop(); } catch { /* rien à arrêter */ }
      finish();
      return;
    }

    wantRef.current = true;
    strikeRef.current = 0;
    setBlocked(false);
    setRecording(true);
    chime(true);
    try {
      startSession();
    } catch {
      finish(true);
      return;
    }
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

  const showHint = hint && fresh && !recording && !blocked;
  const className = [
    "voice-pill",
    compact && !recording && !blocked ? "voice-pill--compact" : "",
    recording ? "voice-pill--live" : "",
    blocked ? "voice-pill--err" : "",
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
          <svg className="voice-mic" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
          {!compact && (
            <>
              {/* Le libellé bascule sur « Terminer » au survol : on sait ce que le clic va faire. */}
              <span className="voice-pill__txt voice-pill__txt--on">{t("listening")}</span>
              <span className="voice-pill__txt voice-pill__txt--off">{t("stop")}</span>
            </>
          )}
          <span className="voice-time">{mmss(seconds)}</span>
        </>
      ) : blocked ? (
        <span className="voice-pill__txt">{t("blocked")}</span>
      ) : (
        !compact && <span className="voice-pill__txt">{t("dictate")}</span>
      )}
    </button>
  );

  function pickLang(l: Locale) {
    setLang(l);
    setLangOpen(false);
    try { window.localStorage.setItem(LANG_KEY, l); } catch { /* mode privé */ }
    window.dispatchEvent(new CustomEvent(LANG_EVENT, { detail: l }));
  }

  return (
    <span className="voice-wrap">
      {button}

      {/* Langue de dictée — visible en permanence : c'est elle qui décide si la
          phrase est comprise ou transcrite en charabia. */}
      {!recording && !blocked && (
        <span className="voice-lang-wrap" ref={langWrapRef}>
          <button
            type="button"
            className="voice-lang"
            onClick={() => setLangOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={langOpen}
            title={t("langTitle")}
          >
            <span aria-hidden="true">{LOCALE_LABELS[lang].flag}</span>
            {lang.toUpperCase()}
          </button>
          {langOpen && (
            <span className="voice-lang-menu" role="listbox">
              {LOCALES.map((l) => (
                <button
                  key={l}
                  type="button"
                  role="option"
                  aria-selected={l === lang}
                  className={l === lang ? "on" : ""}
                  onClick={() => pickLang(l)}
                >
                  <span aria-hidden="true">{LOCALE_LABELS[l].flag}</span>
                  {LOCALE_LABELS[l].name}
                </button>
              ))}
            </span>
          )}
        </span>
      )}

      {showHint && <span className="voice-hint">{t("tip")}</span>}
    </span>
  );
}
