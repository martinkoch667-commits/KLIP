"use client";

import { useEffect, useRef, useState } from "react";

interface VoiceButtonProps {
  value: string;
  onChange: (v: string) => void;
}

export default function VoiceButton({ value, onChange }: VoiceButtonProps) {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const baseRef = useRef(""); // value at the moment recording started

  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    }
  }, []);

  if (!supported) return null;

  function toggle() {
    if (recording) {
      recognitionRef.current?.stop();
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = new SR();
    r.lang = "fr-FR";
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

    r.onend = () => setRecording(false);
    r.onerror = () => setRecording(false);

    recognitionRef.current = r;
    r.start();
    setRecording(true);
  }

  return (
    <>
      <style>{`
        @keyframes mic-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(221,42,123,.4); }
          60% { box-shadow: 0 0 0 6px rgba(221,42,123,.0); }
        }
      `}</style>
      <button
        type="button"
        onClick={toggle}
        title={recording ? "Arrêter l'enregistrement" : "Dicter"}
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          flexShrink: 0,
          border: recording ? "none" : "1px solid var(--line)",
          background: recording ? "#DD2A7B" : "transparent",
          color: recording ? "#fff" : "var(--ink-3)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.15s, color 0.15s, border 0.15s",
          animation: recording ? "mic-pulse 1.2s ease-in-out infinite" : "none",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0" />
          <path d="M12 19v3" />
          <path d="M8 22h8" />
        </svg>
      </button>
    </>
  );
}
