"use client";

import { useEffect, useState } from "react";
import { readConsent, writeConsent } from "./consent";

// Dataset "KLIP Web" (Meta) — distinct de l'ID d'app Facebook Login (1998010880798347).
import { PIXEL_ID } from "@/lib/meta-pixel";

/* Charte landing v3 : carte blanche, encre, pilules, vert pastel --leaf comme
   seul accent (le mint fluo #2FD79B est réservé aux micro-accents de l'app). */
const CSS = `
.kc { position:fixed; left:16px; right:16px; bottom:16px; z-index:9999; max-width:660px; margin:0 auto;
  display:flex; flex-wrap:wrap; align-items:center; gap:18px; padding:18px 20px;
  border-radius:22px; background:var(--card,#FFFFFF); color:var(--ink,#10130B);
  font-family:var(--sans,'early-sans-variable',system-ui,sans-serif);
  box-shadow: inset 0 0 0 1px rgba(16,19,11,.10), 0 26px 60px -26px rgba(0,0,0,.45), 0 3px 12px rgba(16,19,11,.06);
  animation: kc-in .42s cubic-bezier(.22,.9,.3,1) both; }
@keyframes kc-in { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:none; } }

.kc-txt { flex:1 1 320px; min-width:0; }
.kc-eyebrow { font-weight:800; font-size:11.5px; letter-spacing:.16em; text-transform:uppercase;
  color:var(--ink-3,#8A8D7D); margin:0 0 6px; }
.kc-p { margin:0; font-size:13.5px; line-height:1.55; color:var(--ink-2,#50544A); text-wrap:pretty; }
.kc-a { color:var(--ink,#10130B); font-weight:700; white-space:nowrap; text-decoration:underline;
  text-decoration-color:var(--leaf,#BDF2A0); text-decoration-thickness:2px; text-underline-offset:3px;
  transition:text-decoration-color .2s; }
.kc-a:hover { text-decoration-color:var(--ink,#10130B); }

.kc-act { display:flex; gap:10px; flex-shrink:0; }
.kc-btn { font-family:inherit; font-size:14px; letter-spacing:-.01em; border:none; cursor:pointer;
  display:inline-flex; align-items:center; justify-content:center; padding:12px 20px; border-radius:999px;
  transition:box-shadow .2s, background .2s, color .2s; white-space:nowrap; }
.kc-ghost { font-weight:800; background:transparent; color:var(--ink,#10130B);
  box-shadow: inset 0 0 0 1.6px var(--line,rgba(16,19,11,.14)); }
.kc-ghost:hover { box-shadow: inset 0 0 0 2px var(--ink,#10130B); }
.kc-leaf { font-weight:800; background:var(--leaf,#BDF2A0); color:var(--leaf-ink,#1E3317);
  box-shadow: 0 14px 28px -14px rgba(120,190,90,.55); }
.kc-leaf:hover { background:var(--leaf-soft,#D9F8C7); }
.kc-btn:focus-visible { outline:2px solid var(--vio,#6656D9); outline-offset:3px; }

@media (max-width:560px) {
  .kc { gap:14px; padding:18px; border-radius:20px; }
  .kc-act { width:100%; }
  .kc-btn { flex:1 1 0; }
}
@media (prefers-reduced-motion: reduce) { .kc { animation:none; } }
`;

// Bandeau de consentement CNIL. N'apparaît que si un traceur publicitaire est
// configuré (Meta Pixel) et tant qu'aucun choix n'a été enregistré. Le pixel
// (MetaPixel) reste inactif tant que l'utilisateur n'a pas cliqué « Accepter ».
export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!PIXEL_ID) return;
    if (readConsent() === null) setVisible(true);
  }, []);

  if (!PIXEL_ID || !visible) return null;

  function decide(value: "granted" | "denied") {
    writeConsent(value);
    setVisible(false);
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="kc" role="dialog" aria-label="Consentement aux cookies de mesure d'audience">
        <div className="kc-txt">
          <p className="kc-eyebrow">Cookies</p>
          <p className="kc-p">
            Nous utilisons un traceur de mesure d&apos;audience (Meta) pour améliorer Klip. Vous
            pouvez l&apos;accepter ou le refuser.{" "}
            <a className="kc-a" href="/cookies">
              En savoir plus
            </a>
            .
          </p>
        </div>
        <div className="kc-act">
          <button className="kc-btn kc-ghost" onClick={() => decide("denied")}>
            Refuser
          </button>
          <button className="kc-btn kc-leaf" onClick={() => decide("granted")}>
            Accepter
          </button>
        </div>
      </div>
    </>
  );
}
