"use client";

/* Banc d'essai : Konva re-mesure-t-il son texte quand on repose sa police ?
 *
 * Question précise, posée par le bug de l'aplat décalé : react-konva n'appelle
 * un setter que si la valeur CHANGE, donc un nœud texte mesuré avant l'arrivée
 * de sa police garde sa largeur de repli et centre ses lignes dessus. Le
 * correctif repose sur une seule hypothèse : poser une autre police puis
 * remettre la bonne force le recalcul. C'est ce que ce banc vérifie, avec la
 * version de Konva du projet.
 */

import React, { useEffect, useState } from "react";

export default function BancRemesure() {
  if (process.env.NODE_ENV === "production") {
    return <p style={{ fontFamily: "system-ui", padding: 24 }}>Banc d&apos;essai réservé au développement.</p>;
  }
  return <BancRemesureDev />;
}

function BancRemesureDev() {
  const [lignes, setLignes] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const Konva = (await import("konva")).default;
      const div = document.getElementById("scene-konva") as HTMLDivElement | null;
      if (!div) return;
      const stage = new Konva.Stage({ container: div, width: 460, height: 140 });
      const layer = new Konva.Layer();
      stage.add(layer);
      const t = new Konva.Text({
        x: 0, y: 40, width: 460, align: "center", text: "TEXTE 1",
        fontSize: 40, fontStyle: "bold", fontFamily: "Georgia", fill: "#14160F",
      });
      layer.add(t);
      layer.draw();

      const out: string[] = [];
      const dire = (quoi: string) => out.push(`${quoi} : largeur mesurée par Konva = ${t.getTextWidth().toFixed(1)} px`);

      dire("Georgia (départ)");
      const georgia = t.getTextWidth();

      // Ce que fait react-konva quand rien ne change : rien du tout.
      t.fontFamily("Georgia");
      dire("on repose la MÊME valeur");
      const memeValeur = t.getTextWidth();

      // Une police vraiment différente : la mesure doit changer.
      t.fontFamily("Impact");
      dire("police changée pour Impact");
      const impact = t.getTextWidth();

      // Le tour du correctif : une autre valeur, puis la bonne.
      t.fontFamily("klip-remesure");
      t.fontFamily("Georgia");
      dire("après le tour (autre valeur puis la bonne)");
      const apres = t.getTextWidth();
      layer.draw();

      out.push("");
      out.push(`Konva re-mesure quand la valeur change : ${impact !== georgia ? "OUI" : "NON"}`);
      out.push(`Reposer la même valeur ne change rien : ${memeValeur === georgia ? "OUI (donc un simple re-rendu ne suffit pas)" : "NON"}`);
      out.push(`Le tour ramène la bonne mesure : ${Math.abs(apres - georgia) < 0.01 ? "OUI" : "NON"}`);
      setLignes(out);
    })();
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: "var(--sans)", minHeight: "100vh", background: "var(--canvas)" }}>
      <h1 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Banc — re-mesure du texte Konva</h1>
      <div id="scene-konva" style={{ background: "#fff", width: 460, boxShadow: "var(--shadow-card)" }} />
      <pre style={{ marginTop: 16, fontFamily: "var(--mono)", fontSize: 12.5, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
        {lignes.join("\n") || "mesure en cours…"}
      </pre>
    </div>
  );
}
