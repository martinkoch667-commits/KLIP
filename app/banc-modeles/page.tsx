"use client";

/* Banc d'essai de la page « Modèles » d'un client : réservé au développement.
 *
 * La page vit derrière l'authentification et un client en base. On la monte
 * donc avec une charte bidon et deux jeux de données : aucun modèle (l'état
 * vide, celui qu'on voit en arrivant) et quelques modèles (la grille). Le
 * bouton du haut bascule de l'un à l'autre.
 */

import React, { useState } from "react";
import { TemplatesView } from "../workspace/[id]/templates/page";

const CHARTE = {
  id: "banc", name: "PEPE CHICKEN",
  primary_color: "#FF4438", secondary_color: "#FFC600", accent_color: "#FFFFFF",
  brand_icon_url: "/icon-192.png", logo_url: null, logo_dark_url: null, font_family: "Oswald",
};

const MODELES = [
  { format_id: "ig-portrait", name: "Annonce du jour", from: "#FF4438", to: "#FFC600" },
  { format_id: "ig-story",    name: "Story promo",     from: "#12303F", to: "#FF4438" },
  { format_id: "ig-square",   name: "Citation",        from: "#FFC600", to: "#FFFFFF" },
  { format_id: "ig-portrait", name: "Nouveau plat",    from: "#0C2A1D", to: "#2FD79B" },
].map((m, i) => ({
  id: `tpl-${i}`, workspace_id: "banc", name: m.name, format_id: m.format_id,
  background_style: { type: "gradient" as const, colorFrom: m.from, colorTo: m.to, angle: 135 },
  text_zones: [{}, {}], pages: i === 1 ? [{}, {}, {}] : null,
  logo_placement: null, thumbnail_url: null, sort_order: i, created_at: "",
}));

export default function BancModeles() {
  if (process.env.NODE_ENV === "production") {
    return <p style={{ fontFamily: "system-ui", padding: 24 }}>Banc d&apos;essai réservé au développement.</p>;
  }
  return <BancModelesDev />;
}

function BancModelesDev() {
  const [plein, setPlein] = useState(false);
  const [filtre, setFiltre] = useState("all");

  return (
    <>
      <button
        onClick={() => setPlein(v => !v)}
        style={{ position: "fixed", right: 14, bottom: 14, zIndex: 999, padding: "8px 14px", borderRadius: 999,
                 background: "var(--forest)", color: "var(--cream)", border: "none", cursor: "pointer",
                 fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 700 }}>
        {plein ? "Voir l'état vide" : "Voir avec des modèles"}
      </button>
      <TemplatesView
        workspaceId="banc"
        workspace={CHARTE}
        templates={plein ? MODELES : []}
        loading={false}
        formatFilter={filtre}
        onFilter={setFiltre}
        onNew={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    </>
  );
}
