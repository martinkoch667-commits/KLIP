"use client";

/* Banc d'essai de l'étape 5 du parcours « nouveau client » : page temporaire,
 * hors du produit et réservée au développement.
 *
 * L'étape vit derrière l'authentification et quatre écrans de saisie : pour
 * juger sa mise en page il fallait recréer un client à chaque essai. On monte
 * donc le bloc seul, avec une charte bidon, exactement comme le banc du panneau
 * Texte.
 */

import React, { useMemo, useState } from "react";
import Step5Templates from "../workspace/new/step5";
import {
  charterSubPresets, DEFAULT_SUB_POS, DEFAULT_WORDS_PER_CAPTION, type SubCustom,
} from "../workspace/[id]/montage/[postId]/constants";

export default function BancEtape5() {
  if (process.env.NODE_ENV === "production") {
    return <p style={{ fontFamily: "system-ui", padding: 24 }}>Banc d&apos;essai réservé au développement.</p>;
  }
  return <BancEtape5Dev />;
}

function BancEtape5Dev() {
  const brand = { primary: "#E0563F", secondary: "#12303F", accent: "#F2C14E", font: "Oswald" };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const presets = useMemo(() => charterSubPresets(brand), []);

  const [presetId, setPresetId] = useState<string | null>(presets[0].id);
  const [styleId, setStyleId] = useState(presets[0].styleId);
  const [custom, setCustom] = useState<SubCustom>(presets[0].custom);
  const [advanced, setAdvanced] = useState(true);
  const [pos, setPos] = useState(DEFAULT_SUB_POS);
  const [maxWords, setMaxWords] = useState(DEFAULT_WORDS_PER_CAPTION);
  const [count, setCount] = useState(0);

  return (
    // Le padding gauche tient la place de la barre latérale : sans lui le
    // panneau de réglages disposerait de 256 px de plus qu'en vrai.
    <div style={{ minHeight: "100vh", background: "#FFFFFF", paddingLeft: "var(--sb-w)" }}>
      {/* Mêmes contraintes que la vraie page : c'est le <main> qui défile, et
          c'est lui qui rognerait un bloc trop large. */}
      <main className="ws-new-main" style={{ height: "100vh", overflowY: "auto", padding: "0 40px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", paddingTop: 40, paddingBottom: 120 }}>
          <Step5Templates
            clientName="Burger King"
            subPresets={presets}
            subPresetId={presetId}
            onPickPreset={(p) => { setPresetId(p.id); setStyleId(p.styleId); setCustom(p.custom); }}
            advanced={advanced}
            onToggleAdvanced={() => setAdvanced((v) => !v)}
            styleId={styleId}
            custom={custom}
            onCustomChange={(next) => { setPresetId(null); setCustom(next); }}
            pos={pos}
            onPosChange={setPos}
            maxWords={maxWords}
            onMaxWordsChange={setMaxWords}
            brandFont={brand.font}
            brandColors={[brand.primary, brand.secondary, brand.accent]}
            templateCount={count}
            onCreateTemplate={() => setCount((c) => c + 1)}
            loading={false}
            error={null}
          />
        </div>
      </main>
    </div>
  );
}
