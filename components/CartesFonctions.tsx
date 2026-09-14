"use client";

/* Les fonctionnalités de Klip, chacune dans une carte « Curseurs » (Martin,
 * 2026-09-14 : « toute la présentation du logiciel dans ce style-là, adaptée à
 * chaque feature »). Même vocabulaire que la carte de l'offre et de la fenêtre
 * d'inscription : halo vert en L, fenêtre de navigateur coupée par le bord,
 * curseurs nommés, sélection violette. Chaque fenêtre montre une scène propre à
 * sa fonctionnalité, à la place d'une icône.
 *
 * Tout est en cqw (voir CarteCurseurs) : la carte garde ses proportions de
 * 300 à 420 px de large. Les textes sont ceux de `landing.features`.
 */

import { useTranslations } from "next-intl";
import { CARTE_CSS, Curseur, Fenetre, Selection } from "@/components/CarteCurseurs";

function Carte({ chemin, titre, texte, children, curseurs }: {
  chemin: string; titre: string; texte: string; children: React.ReactNode; curseurs?: React.ReactNode;
}) {
  return (
    <article className="fx cf-carte">
      <div className="fx-tete">
        <div className="fx-halo" />
        <Fenetre chemin={chemin}>
          {children}
          <span className="fx-lueur" />
        </Fenetre>
        {curseurs}
      </div>
      <div className="fx-texte">
        <h3 className="fx-h">{titre}</h3>
        <p className="fx-p">{texte}</p>
      </div>
    </article>
  );
}

/* ── Scènes ─────────────────────────────────────────────────────────────── */

function SceneEditeur() {
  return (
    <>
      <div className="cf-post">
        <span className="cf-post-marque">MAISON LOU</span>
        <Selection className="cf-post-titre">L&apos;été se<br />réserve</Selection>
        <span className="cf-post-tags"><i>#terrasse</i><i>#septembre</i></span>
      </div>
      <div className="cf-panneau">
        <span className="cf-lab">Charte</span>
        <span className="cf-pastilles"><i style={{ background: "#0C2A1D" }} /><i style={{ background: "#BDF2A0" }} /><i style={{ background: "#F4EFE6" }} /></span>
        <span className="cf-lab">Police</span>
        <span className="cf-chip is-on">Aa Archivo</span>
        <span className="cf-lab">Logo</span>
        <span className="cf-logo">ML</span>
      </div>
    </>
  );
}

function SceneMontage() {
  return (
    <>
      <div className="cf-reel">
        <span className="cf-reel-sous">ET ÇA, C&apos;EST</span>
        <span className="cf-reel-sous is-mot">MAISON</span>
      </div>
      <div className="cf-piste">
        <span className="cf-piste-lab">Vidéo</span>
        <span className="cf-clips"><i style={{ flex: 3, background: "#1FA878" }} /><i style={{ flex: 2, background: "#13603F" }} /><i style={{ flex: 4, background: "#2FD79B" }} /></span>
        <span className="cf-piste-lab">Sous-titres</span>
        <span className="cf-clips is-mots"><i style={{ flex: 2 }} /><i style={{ flex: 3 }} /><i style={{ flex: 2 }} /><i style={{ flex: 3 }} /></span>
        <span className="cf-tete-lecture" />
      </div>
    </>
  );
}

function SceneVoix() {
  return (
    <div className="cf-voix">
      <span className="cf-lab">Ton</span>
      <span className="cf-ligne">
        <Selection className="cf-chip is-on">Chaleureux</Selection>
        <span className="cf-chip">Punchy</span>
        <span className="cf-chip">Chic</span>
      </span>
      <span className="cf-lab">Mots à éviter</span>
      <span className="cf-ligne">
        <span className="cf-chip is-barre">promo</span>
        <span className="cf-chip is-barre">pas cher</span>
      </span>
    </div>
  );
}

function SceneLegende() {
  return (
    <div className="cf-legende">
      <span className="cf-lab">Légende générée</span>
      <span className="cf-texte-ia">La terrasse rouvre jeudi. On vous garde une table au soleil<i className="cf-caret" /></span>
      <span className="cf-ligne">
        <span className="cf-chip is-on">#terrasse</span>
        <span className="cf-chip">#faitmaison</span>
        <span className="cf-chip">#lyon</span>
      </span>
    </div>
  );
}

function SceneClients() {
  const clients = [
    { nom: "Maison Lou", init: "ML", teintes: ["#0C2A1D", "#BDF2A0"], on: true },
    { nom: "Pepe Chicken", init: "PC", teintes: ["#EC001B", "#FFC700"] },
    { nom: "Café Lumière", init: "CL", teintes: ["#6B3E26", "#F2D7B6"] },
  ];
  return (
    <div className="cf-clients">
      {clients.map(c => {
        const ligne = (
          <span className="cf-client">
            <span className="cf-avatar" style={{ background: c.teintes[0], color: c.teintes[1] }}>{c.init}</span>
            <span className="cf-client-nom">{c.nom}</span>
            <span className="cf-pastilles is-petites">{c.teintes.map(t => <i key={t} style={{ background: t }} />)}</span>
          </span>
        );
        return c.on ? <Selection key={c.nom} className="cf-client-sel">{ligne}</Selection> : <span key={c.nom}>{ligne}</span>;
      })}
    </div>
  );
}

function ScenePublication() {
  const jours = ["L", "M", "M", "J", "V", "S", "D"];
  return (
    <div className="cf-planning">
      <span className="cf-semaine">{jours.map((j, i) => <i key={i} className={i === 3 ? "is-on" : ""}>{j}</i>)}</span>
      <span className="cf-grille">
        {jours.map((_, i) => (
          <span key={i} className="cf-jour">
            {(i === 0 || i === 5) && <span className="cf-vignette is-passee" />}
            {i === 3 && <Selection className="cf-vignette-sel"><span className="cf-vignette" /></Selection>}
          </span>
        ))}
      </span>
      <span className="cf-publie">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" /></svg>
        Jeu. 18:30 · publié automatiquement
      </span>
    </div>
  );
}

/* ── Styles propres aux scènes (le cadre commun vient de CARTE_CSS) ─────── */

const CF_CSS = `
  .cf-grille-cartes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px;margin-top:52px;}
  @media(max-width:1020px){.cf-grille-cartes{grid-template-columns:repeat(2,minmax(0,1fr));}}
  @media(max-width:640px){.cf-grille-cartes{grid-template-columns:1fr;max-width:420px;margin-left:auto;margin-right:auto;}}
  .cf-carte{--vio:#6656D9;--ink:#10130B;--ink-3:#8A8D7D;font-family:var(--sans);}
  .cf-carte .fx-p{text-wrap:pretty;}

  .cf-lab{display:block;font-size:2.9cqw;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8A8D7D;}
  .cf-ligne{display:flex;flex-wrap:wrap;gap:2cqw;align-items:center;}
  .cf-chip{display:inline-flex;align-items:center;padding:1.3cqw 2.8cqw;border-radius:2.4cqw;background:#fff;
    font-size:3.6cqw;font-weight:700;color:#50544A;box-shadow:inset 0 0 0 1px rgba(16,19,11,.1);white-space:nowrap;}
  .cf-chip.is-on{background:#DDF8CF;color:#2E6A1D;box-shadow:inset 0 0 0 1.5px #A6E68A;}
  .cf-chip.is-barre{text-decoration:line-through;text-decoration-color:#C4452F;text-decoration-thickness:.5cqw;color:#8A8D7D;}
  .cf-pastilles{display:flex;gap:1.4cqw;}
  .cf-pastilles i{width:5cqw;height:5cqw;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(16,19,11,.12);}
  .cf-pastilles.is-petites i{width:3.4cqw;height:3.4cqw;}

  /* Éditeur */
  .cf-post{position:absolute;left:5cqw;top:4cqw;width:36cqw;height:46cqw;border-radius:2.6cqw;padding:3.4cqw;display:flex;flex-direction:column;
    justify-content:space-between;background:radial-gradient(130% 120% at 15% 0%,#22A36A,#0A2419 72%);box-shadow:0 3cqw 6cqw -3cqw rgba(7,33,23,.6);}
  .cf-post-marque{font-size:2.5cqw;font-weight:800;letter-spacing:.14em;color:rgba(255,255,255,.8);}
  .cf-post-titre{align-self:flex-start;font-family:var(--heavy);font-weight:900;font-style:italic;font-size:5.4cqw;line-height:1;
    text-transform:uppercase;letter-spacing:-.02em;color:#fff;--o:1.2cqw;}
  .cf-post-tags{display:flex;gap:1.2cqw;}
  .cf-post-tags i{font-style:normal;font-size:2.3cqw;font-weight:700;color:rgba(255,255,255,.9);padding:.8cqw 1.8cqw;border-radius:9cqw;background:rgba(255,255,255,.14);}
  .cf-panneau{position:absolute;left:46cqw;top:5cqw;width:36cqw;display:flex;flex-direction:column;gap:1.8cqw;padding:3.2cqw;border-radius:2.6cqw;background:#fff;
    box-shadow:0 0 0 1px rgba(16,19,11,.06),0 2.4cqw 5cqw -3cqw rgba(16,19,11,.3);}
  .cf-panneau .cf-lab:not(:first-child){margin-top:1.2cqw;}
  .cf-logo{display:grid;place-items:center;width:9cqw;height:9cqw;border-radius:2.2cqw;background:#0C2A1D;color:#BDF2A0;font-family:var(--heavy);font-weight:800;font-size:3.4cqw;}

  /* Montage */
  .cf-reel{position:absolute;left:5cqw;top:4cqw;width:24cqw;height:42cqw;border-radius:2.6cqw;overflow:hidden;display:flex;flex-direction:column;
    align-items:center;justify-content:flex-end;gap:.6cqw;padding-bottom:5cqw;
    background:linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(0,0,0,.45)),radial-gradient(120% 90% at 30% 20%,#F5B46A,#B4532A 60%,#4A1F12);}
  .cf-reel-sous{font-family:var(--heavy);font-weight:900;font-size:3.4cqw;color:#fff;text-shadow:0 .4cqw 1cqw rgba(0,0,0,.5);}
  .cf-reel-sous.is-mot{padding:.2cqw 1.4cqw;border-radius:1cqw;background:#BDF2A0;color:#1E3317;text-shadow:none;}
  .cf-piste{position:absolute;left:34cqw;top:8cqw;right:3cqw;display:flex;flex-direction:column;gap:1.6cqw;}
  .cf-piste-lab{font-size:2.8cqw;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8A8D7D;}
  .cf-clips{display:flex;gap:.8cqw;height:8cqw;}
  .cf-clips i{border-radius:1.4cqw;box-shadow:inset 0 0 0 1px rgba(255,255,255,.3);}
  .cf-clips.is-mots{height:5cqw;}
  .cf-clips.is-mots i{background:#E6E1FF;box-shadow:inset 0 0 0 1px #B9AEFF;}
  .cf-tete-lecture{position:absolute;left:44%;top:5cqw;bottom:-2cqw;width:.5cqw;border-radius:1cqw;background:#6656D9;}
  .cf-tete-lecture::before{content:"";position:absolute;top:-1.4cqw;left:50%;width:3cqw;height:3cqw;translate:-50% 0;border-radius:.8cqw .8cqw 50% 50%;background:#6656D9;}

  /* Voix, légende */
  .cf-voix,.cf-legende{position:absolute;left:6cqw;top:6cqw;right:6cqw;display:flex;flex-direction:column;gap:2.4cqw;}
  .cf-voix .cf-lab:not(:first-child),.cf-legende .cf-ligne{margin-top:2.4cqw;}
  .cf-voix .fx-sel{--o:1cqw;}
  .cf-texte-ia{display:block;padding:3.4cqw;border-radius:2.6cqw;background:#fff;font-size:4.1cqw;line-height:1.4;font-weight:600;color:#23261F;
    box-shadow:0 0 0 1px rgba(16,19,11,.06),0 2.4cqw 5cqw -3cqw rgba(16,19,11,.3);}
  .cf-caret{display:inline-block;width:.6cqw;height:4.4cqw;margin-left:.6cqw;vertical-align:-.8cqw;background:#6656D9;animation:cf-clignote 1s steps(1) infinite;}
  @keyframes cf-clignote{50%{opacity:0;}}

  /* Clients */
  .cf-clients{position:absolute;left:6cqw;top:5cqw;right:10cqw;display:flex;flex-direction:column;gap:2.6cqw;}
  .cf-client{display:flex;align-items:center;gap:2.6cqw;padding:2.2cqw 2.8cqw;border-radius:2.6cqw;background:#fff;
    box-shadow:0 0 0 1px rgba(16,19,11,.06),0 2cqw 4cqw -2.6cqw rgba(16,19,11,.3);}
  .cf-client-sel{--o:1cqw;display:block;}
  .cf-avatar{display:grid;place-items:center;width:8cqw;height:8cqw;border-radius:2cqw;font-family:var(--heavy);font-weight:800;font-size:3cqw;flex:none;}
  .cf-client-nom{flex:1;font-size:3.9cqw;font-weight:700;color:#23261F;}

  /* Publication */
  .cf-planning{position:absolute;left:6cqw;top:5cqw;right:6cqw;display:flex;flex-direction:column;gap:2cqw;}
  .cf-semaine,.cf-grille{display:grid;grid-template-columns:repeat(7,1fr);gap:1.4cqw;}
  .cf-semaine i{font-style:normal;text-align:center;font-size:3cqw;font-weight:800;color:#8A8D7D;}
  .cf-semaine i.is-on{color:#1FA878;}
  .cf-jour{position:relative;height:19cqw;border-radius:1.8cqw;background:#fff;box-shadow:inset 0 0 0 1px rgba(16,19,11,.07);padding:1.2cqw;}
  .cf-vignette{display:block;width:100%;height:13cqw;border-radius:1.2cqw;background:radial-gradient(120% 120% at 20% 0%,#22A36A,#0A2419 75%);}
  .cf-vignette.is-passee{opacity:.35;}
  .cf-vignette-sel{--o:.8cqw;display:block;}
  .cf-publie{align-self:flex-start;display:inline-flex;align-items:center;gap:1.6cqw;padding:1.6cqw 3cqw;border-radius:9cqw;background:#DDF8CF;color:#2E6A1D;
    font-size:3.4cqw;font-weight:800;box-shadow:inset 0 0 0 1.5px #A6E68A;}
  .cf-publie svg{width:4cqw;height:4cqw;fill:none;stroke:currentColor;stroke-width:2.2;}

  @media (prefers-reduced-motion: reduce){ .cf-caret{animation:none;} }
`;

export default function CartesFonctions() {
  const t = useTranslations("landing.features");
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CARTE_CSS + CF_CSS }} />
      <div className="cf-grille-cartes">
        <Carte chemin="editeur" titre={t("mainTitle")} texte={t("mainText")}
          curseurs={<Curseur nom="Vous" teinte="violet" style={{ left: "40%", top: "40cqw" }} />}>
          <SceneEditeur />
        </Carte>
        <Carte chemin="montage" titre={t("f5t")} texte={t("f5d")}
          curseurs={<Curseur nom="Couper" teinte="ambre" style={{ left: "58%", top: "30cqw", ["--d" as string]: "-1s" }} />}>
          <SceneMontage />
        </Carte>
        <Carte chemin="voix" titre={t("f1t")} texte={t("f1d")}
          curseurs={<Curseur nom="Vous" teinte="vert" style={{ left: "46%", top: "36cqw", ["--d" as string]: "-2s" }} />}>
          <SceneVoix />
        </Carte>
        <Carte chemin="legendes" titre={t("f2t")} texte={t("f2d")}
          curseurs={<Curseur nom="IA" teinte="violet" style={{ left: "72%", top: "52cqw", ["--d" as string]: "-.6s" }} />}>
          <SceneLegende />
        </Carte>
        <Carte chemin="clients" titre={t("f3t")} texte={t("f3d")}
          curseurs={<Curseur nom="Vous" teinte="ambre" fleche="haut-droite" style={{ left: "62%", top: "30cqw", ["--d" as string]: "-1.6s" }} />}>
          <SceneClients />
        </Carte>
        <Carte chemin="planning" titre={t("f4t")} texte={t("f4d")}
          curseurs={<Curseur nom="Vous" teinte="vert" style={{ left: "50%", top: "44cqw", ["--d" as string]: "-2.4s" }} />}>
          <ScenePublication />
        </Carte>
      </div>
    </>
  );
}
