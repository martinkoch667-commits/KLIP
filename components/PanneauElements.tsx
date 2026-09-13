"use client";

/* components/PanneauElements.tsx — le panneau « Éléments » de l'éditeur.
 *
 * POURQUOI CE FICHIER EXISTE. Deux raisons.
 *
 * 1. UNE SEULE GRAMMAIRE. Le panneau avait poussé par couches : chaque famille
 *    avait fini par avoir sa propre pastille, son propre champ de recherche,
 *    sa propre taille de vignette. Ça se lit comme un brouillon. Ici, tout
 *    passe par les mêmes briques (`ChampRecherche`, `Puces`, `Couleurs`,
 *    `Grille`, `Tuile`) : une seule façon de chercher, de filtrer, de choisir
 *    une couleur, de cliquer une vignette.
 *
 * 2. ON PEUT LE REGARDER. Le middleware protège /workspace : sans session,
 *    l'éditeur est invisible. Ces vues sont des composants purs (données et
 *    rappels en entrée), donc /banc-formes les monte seules.
 */

import React from "react";
import ColorPicker from "@/components/ColorPicker";
import { FORMES, FAMILLES as FORME_FAMILLES, apercuForme, chercherFormes, type Forme, type FamilleForme } from "@/lib/formes";
import { ORNEMENTS, CATEGORIES as ORNEMENT_CATS, type OrnementCategorie } from "@/lib/ornaments";
import { KINDS as ASSET_KINDS, STYLES as ASSET_STYLES, type AssetKind } from "@/lib/assetBanks";
import { STICKERS, stickerDataUri, type Sticker } from "@/app/workspace/[id]/editor/[postId]/stickers";
import { GRILLES, type Grille } from "@/lib/grilles";
import { TEXTURES, textureDataUri, type Texture } from "@/lib/textures";
import { DEGRADES, FAMILLES_DEGRADE, chercherDegrades, degradeDataUri, type Degrade, type FamilleDegrade } from "@/lib/degrades";

// ─── Grammaire commune ───────────────────────────────────────────────────────

const TITRE: React.CSSProperties = {
  fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase',
  letterSpacing: '0.12em', fontFamily: 'var(--mono)', fontWeight: 800, margin: 0,
};
const AIDE: React.CSSProperties = { fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.45, margin: '0 0 10px' };
/** Damier : sans lui, on ne voit pas qu'un fond a été retiré. */
const DAMIER = 'repeating-conic-gradient(#e9e9e6 0% 25%, #ffffff 0% 50%) 50% / 14px 14px';

/** Un intitulé de section, avec au besoin une action à droite. */
export function Section({ titre, action, children }: { titre?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      {(titre || action) && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 9 }}>
          {titre ? <p style={TITRE}>{titre}</p> : <span />}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function BoutonTexte({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)' }}>
      {children}
    </button>
  );
}

/** Le champ de recherche du panneau. Un seul, partout. */
export function ChampRecherche({ valeur, onChange, onValider, placeholder }: {
  valeur: string; onChange: (v: string) => void; onValider?: (v: string) => void; placeholder: string;
}) {
  return (
    <div style={{ position: 'relative', marginBottom: 12 }}>
      <button type="button" onClick={() => onValider?.(valeur)} aria-label="Rechercher" tabIndex={-1}
        style={{ position: 'absolute', left: 10, top: 10, width: 20, height: 20, display: 'grid', placeItems: 'center', border: 'none', background: 'none', padding: 0, color: 'var(--ink-3)', cursor: onValider ? 'pointer' : 'default' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
      </button>
      <input value={valeur} onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onValider?.(valeur); } }}
        enterKeyHint="search" inputMode="search" autoCapitalize="none" autoCorrect="off" placeholder={placeholder}
        style={{ width: '100%', height: 40, padding: '0 12px 0 34px', borderRadius: 11, border: '1px solid transparent', background: 'var(--sunk)', color: 'var(--ink)', fontSize: 12.5, fontFamily: 'var(--sans)', outline: 'none', boxSizing: 'border-box' }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--leaf)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'transparent'; }} />
    </div>
  );
}

/** Filtres en pastilles. Un seul dessin, quelle que soit la famille. */
export function Puces<T extends string | boolean>({ options, valeur, onChange }: {
  options: { id: T; label: string }[]; valeur: T; onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
      {options.map(o => {
        const actif = o.id === valeur;
        return (
          <button key={String(o.id)} onClick={() => onChange(o.id)}
            style={{ height: 27, padding: '0 12px', borderRadius: 20, cursor: 'pointer', fontSize: 11.5, fontWeight: 600, fontFamily: 'var(--sans)', border: 'none',
              background: actif ? 'var(--ink)' : 'var(--sunk)', color: actif ? '#fff' : 'var(--ink-2)' }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Choix de couleur : les pastilles de la charte, puis la pipette. */
export function Couleurs({ valeur, onChange, palette }: { valeur: string; onChange: (c: string) => void; palette: (string | null | undefined)[] }) {
  const teintes = (palette.filter(Boolean) as string[]).filter((c, i, l) => l.findIndex(v => v.toLowerCase() === c.toLowerCase()) === i).slice(0, 8);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
      {teintes.map(c => (
        <button key={c} onClick={() => onChange(c)} title={c}
          style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', padding: 0,
            border: valeur.toLowerCase() === c.toLowerCase() ? '2px solid var(--leaf)' : '1.5px solid var(--line)',
            boxShadow: c.toUpperCase() === '#FFFFFF' ? 'inset 0 0 0 1px var(--line)' : 'none' }} />
      ))}
      <span style={{ width: 1, height: 18, background: 'var(--line)', margin: '0 1px' }} />
      <ColorPicker value={valeur} onChange={onChange} />
    </div>
  );
}

export function Grille({ colonnes, children }: { colonnes: number; children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colonnes},1fr)`, gap: 8 }}>{children}</div>;
}

/** La vignette cliquable. Toutes les familles posent leur élément avec elle.
 *
 *  PAS DE CONTOUR. Un cadre gris autour d'une case déjà grise ajoute une ligne
 *  pour rien et fait bon marché (retour de Martin). La case est un aplat, le
 *  survol l'assombrit : c'est tout ce qu'il faut pour qu'elle se lise comme un
 *  bouton. */
export function Tuile({ onClick, titre, children, ratio = '1', fonce, damier, etiquette }: {
  onClick: () => void; titre: string; children: React.ReactNode;
  ratio?: string; fonce?: boolean; damier?: boolean; etiquette?: string;
}) {
  const fond = damier ? DAMIER : fonce ? '#3a3f36' : 'var(--sunk)';
  return (
    <button onClick={onClick} title={titre}
      style={{ aspectRatio: ratio, borderRadius: 10, border: 'none', cursor: 'pointer', padding: etiquette ? '9px 6px 7px' : 7,
        background: fond, display: 'grid', gridTemplateRows: etiquette ? '1fr auto' : '1fr',
        placeItems: 'center', gap: 4, overflow: 'hidden', transition: 'transform .14s, filter .14s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.filter = 'brightness(.95)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.filter = 'none'; }}>
      <span style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', minHeight: 0 }}>{children}</span>
      {etiquette && <span style={{ fontSize: 8.5, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{etiquette}</span>}
    </button>
  );
}

/** Onglets à filet, comme Canva : une seule rangée, qui défile si besoin. Les
 *  pastilles empilées sur trois lignes donnaient un panneau de formulaire. */
export function Onglets<T extends string>({ options, valeur, onChange }: {
  options: { id: T; label: string }[]; valeur: T; onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 14, overflowX: 'auto', marginBottom: 12, borderBottom: '1px solid var(--line)', scrollbarWidth: 'none' }}>
      {options.map(o => {
        const actif = o.id === valeur;
        return (
          <button key={o.id} onClick={() => onChange(o.id)}
            style={{ flexShrink: 0, border: 'none', background: 'none', padding: '0 0 8px', cursor: 'pointer',
              fontSize: 12.5, fontWeight: actif ? 800 : 600, fontFamily: 'var(--sans)',
              color: actif ? 'var(--ink)' : 'var(--ink-3)',
              boxShadow: actif ? 'inset 0 -2px 0 var(--ink)' : 'none' }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Petit interrupteur. */
export function Bascule({ actif, onChange, label }: { actif: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button onClick={() => onChange(!actif)} title={label}
      style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', fontFamily: 'var(--sans)' }}>
      <span style={{ width: 30, height: 18, borderRadius: 99, background: actif ? 'var(--ink)' : 'var(--line)', position: 'relative', transition: 'background .15s', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 2, left: actif ? 14 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} />
      </span>
      {label}
    </button>
  );
}

const IMG: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'contain', display: 'block' };

/** Ce que l'utilisateur a posé en dernier, par section. Le navigateur s'en
 *  souvient d'une séance à l'autre, sinon « utilisés récemment » ne veut rien
 *  dire le lendemain. */
export function useRecents(cle: string, max = 8): [string[], (id: string) => void] {
  const [liste, setListe] = React.useState<string[]>([]);
  React.useEffect(() => {
    try {
      const brut = localStorage.getItem(`klip-recents-${cle}`);
      if (brut) setListe(JSON.parse(brut) as string[]);
    } catch { /* stockage indisponible */ }
  }, [cle]);
  const memoriser = React.useCallback((id: string) => {
    setListe(prev => {
      const suite = [id, ...prev.filter(x => x !== id)].slice(0, max);
      try { localStorage.setItem(`klip-recents-${cle}`, JSON.stringify(suite)); } catch { /* ignoré */ }
      return suite;
    });
  }, [cle, max]);
  return [liste, memoriser];
}

/** Mots proposés sous une recherche. Un panneau vide qui attend qu'on tape
 *  n'est pas un panneau : on donne une porte d'entrée. */
export function Suggestions({ mots, onChoisir }: { mots: [string, string][]; onChoisir: (q: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
      {mots.map(([label, q]) => (
        <button key={q} onClick={() => onChoisir(q)}
          style={{ height: 25, padding: '0 11px', borderRadius: 20, border: 'none', background: 'var(--sunk)', color: 'var(--ink-2)', fontSize: 11, fontWeight: 600, fontFamily: 'var(--sans)', cursor: 'pointer' }}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '18px 0', margin: 0, lineHeight: 1.45 }}>{children}</p>;
}

// ─── Accueil : les catégories ────────────────────────────────────────────────

export type CategorieElement = { id: string; label: string; de: string; a: string; glyphe: (c: string) => React.ReactNode };

/** Les familles du panneau. Une vignette, une couleur, un dessin : c'est ce
 *  qui permet de reconnaître une catégorie sans lire son nom. */
export const CATEGORIES_ELEMENTS: CategorieElement[] = [
  { id: 'formes', label: 'Formes', de: '#6EA8FF', a: '#2F62D8', glyphe: () => (<>
    <rect x="2.5" y="2.5" width="8.6" height="8.6" rx="2" fill="#fff" opacity=".95"/>
    <circle cx="17.6" cy="6.8" r="4.3" fill="#fff" opacity=".62"/>
    <polygon points="12,21.6 5.8,12.6 18.2,12.6" fill="#fff" opacity=".82"/></>) },
  { id: 'illustrations', label: 'Illustrations', de: '#C29BFF', a: '#6B37D6', glyphe: c => (<>
    <rect x="2.2" y="4" width="19.6" height="16" rx="2.6" fill="#fff" opacity=".95"/>
    <circle cx="8" cy="9.6" r="2" fill={c}/>
    <path d="M3.4 19.6l5.2-5.4 3.4 2.9 4.2-4.7 4.6 5.9z" fill={c} opacity=".8"/></>) },
  { id: 'icones', label: 'Icônes', de: '#5BE3B0', a: '#0F9E76', glyphe: c => (<>
    <polygon points="12,2.2 14.8,8.8 21.8,9.4 16.5,14 18.2,21 12,17.2 5.8,21 7.5,14 2.2,9.4 9.2,8.8" fill="#fff"/>
    <circle cx="12" cy="12" r="2.1" fill={c} opacity=".45"/></>) },
  { id: 'stickers', label: 'Stickers', de: '#FFD466', a: '#E08A00', glyphe: c => (<>
    <path d="M5.2 2.4h13.6a2.8 2.8 0 0 1 2.8 2.8v8.6l-7.6 7.8H5.2a2.8 2.8 0 0 1-2.8-2.8V5.2a2.8 2.8 0 0 1 2.8-2.8z" fill="#fff" opacity=".96"/>
    <path d="M21.6 13.8h-5a2.8 2.8 0 0 0-2.8 2.8v5z" fill={c} opacity=".55"/>
    <circle cx="9" cy="9.4" r="1.9" fill={c} opacity=".6"/></>) },
  { id: 'ornements', label: 'Ornements', de: '#FF9E7A', a: '#E03E2F', glyphe: () => (<>
    <path d="M11 1.6l2.4 6.6 6.6 2.4-6.6 2.4-2.4 6.6-2.4-6.6-6.6-2.4 6.6-2.4z" fill="#fff"/>
    <circle cx="18.8" cy="18.4" r="2.6" fill="#fff" opacity=".66"/></>) },
  { id: 'cadres', label: 'Cadres photo', de: '#66D6C4', a: '#0C9B7E', glyphe: c => (<>
    <rect x="2.2" y="2.2" width="19.6" height="19.6" rx="3" fill="#fff" opacity=".95"/>
    <rect x="6.6" y="6.6" width="10.8" height="10.8" rx="1.8" fill={c} opacity=".55"/></>) },
  { id: 'badges', label: 'Badges', de: '#FF97B6', a: '#D6336C', glyphe: c => (<>
    <circle cx="12" cy="10" r="8" fill="#fff" opacity=".95"/>
    <path d="M8.4 16.4v6l3.6-2.2 3.6 2.2v-6z" fill="#fff" opacity=".7"/>
    <circle cx="12" cy="10" r="4" fill={c} opacity=".5"/></>) },
  { id: 'degrades', label: 'Dégradés', de: '#FF9FD0', a: '#6B4BD6', glyphe: () => (<>
    <defs><linearGradient id="kd-g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#fff" stopOpacity=".98"/><stop offset="1" stopColor="#fff" stopOpacity=".3"/>
    </linearGradient></defs>
    <rect x="2.4" y="2.4" width="19.2" height="19.2" rx="3" fill="url(#kd-g)"/></>) },
  { id: 'textures', label: 'Textures', de: '#C9B9A4', a: '#7A6550', glyphe: c => (<>
    <rect x="2.4" y="2.4" width="19.2" height="19.2" rx="3" fill="#fff" opacity=".95"/>
    <g fill={c} opacity=".75">
      <circle cx="7" cy="7" r="1.15"/><circle cx="12" cy="6" r="0.8"/><circle cx="17" cy="8" r="1.3"/>
      <circle cx="6" cy="12" r="0.85"/><circle cx="11.5" cy="11.5" r="1.35"/><circle cx="17.5" cy="13" r="0.9"/>
      <circle cx="7.5" cy="17" r="1.25"/><circle cx="13" cy="17.5" r="0.85"/><circle cx="17" cy="18" r="1.1"/>
    </g></>) },
  { id: 'motifs', label: 'Motifs', de: '#A8B6C6', a: '#495868', glyphe: () => (<g fill="#fff">
    <circle cx="6" cy="6" r="2.2"/><circle cx="12" cy="6" r="2.2" opacity=".75"/><circle cx="18" cy="6" r="2.2"/>
    <circle cx="6" cy="12" r="2.2" opacity=".75"/><circle cx="12" cy="12" r="2.2"/><circle cx="18" cy="12" r="2.2" opacity=".75"/>
    <circle cx="6" cy="18" r="2.2"/><circle cx="12" cy="18" r="2.2" opacity=".75"/><circle cx="18" cy="18" r="2.2"/></g>) },
];

/** L'accueil du panneau : on choisit une famille avant de voir son contenu. */
export function TuilesCategories({ onChoisir }: { onChoisir: (id: string) => void }) {
  return (
    /* Quatre par rangée, pas trois : les tuiles passaient pour de gros blocs.
       Canva les tient petites, on fait pareil, et le survol dit clairement
       laquelle on va ouvrir. */
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
      {CATEGORIES_ELEMENTS.map(c => (
        <button key={c.id} onClick={() => onChoisir(c.id)} title={c.label}
          style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', display: 'grid', gap: 6, justifyItems: 'center' }}
          onMouseEnter={e => { const t = e.currentTarget.firstElementChild as HTMLElement; if (t) { t.style.transform = 'translateY(-2px) scale(1.04)'; t.style.boxShadow = `0 5px 14px ${c.a}55, inset 0 1.5px 0 rgba(255,255,255,.5)`; } }}
          onMouseLeave={e => { const t = e.currentTarget.firstElementChild as HTMLElement; if (t) { t.style.transform = 'none'; t.style.boxShadow = `0 3px 8px ${c.a}33, inset 0 1.5px 0 rgba(255,255,255,.45), inset 0 -2px 5px rgba(0,0,0,.10)`; } }}>
          <span style={{ width: '100%', aspectRatio: '1', borderRadius: 13, display: 'grid', placeItems: 'center', transition: 'transform .14s, box-shadow .14s',
            background: `linear-gradient(155deg, ${c.de}, ${c.a})`,
            boxShadow: `0 3px 8px ${c.a}33, inset 0 1.5px 0 rgba(255,255,255,.45), inset 0 -2px 5px rgba(0,0,0,.10)` }}>
            <svg width="52%" height="52%" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.14))' }}>{c.glyphe(c.a)}</svg>
          </span>
          <span style={{ fontSize: 9.5, color: 'var(--ink-2)', fontWeight: 700, lineHeight: 1.15, textAlign: 'center' }}>{c.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Formes ──────────────────────────────────────────────────────────────────

export type EtatFormes = {
  couleur: string; setCouleur: (c: string) => void;
  query: string; setQuery: (q: string) => void;
  tout: FamilleForme | null; setTout: (f: FamilleForme | null) => void;
  /** Couleurs de la charte du client, proposées avant les couleurs neutres. */
  charte?: (string | null | undefined)[];
  onPoser: (f: Forme) => void;
};

/** La bibliothèque : une recherche, une couleur, puis les familles. */
export function BibliothequeFormes({ couleur, setCouleur, query, setQuery, tout, setTout, charte, onPoser }: EtatFormes) {
  const fonce = couleur.toUpperCase() === '#FFFFFF';
  const grille = (liste: Forme[], large: boolean) => (
    <Grille colonnes={large ? 2 : 5}>
      {liste.map(f => (
        <Tuile key={f.id} onClick={() => poser(f)} titre={f.nom} ratio={large ? '2.2' : '1'} fonce={fonce}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={apercuForme(f, couleur)} alt={f.nom} style={IMG} />
        </Tuile>
      ))}
    </Grille>
  );
  const [recents, memoriser] = useRecents('formes');
  const poser = (f: Forme) => { memoriser(f.id); onPoser(f); };
  const q = query.trim();
  const trouvees = q ? chercherFormes(q) : null;
  return (<>
    <ChampRecherche valeur={query} onChange={setQuery} placeholder="Rechercher une forme…" />
    {/* La couleur est choisie AVANT la pose : les vignettes la montrent, donc
        on voit ce qu'on va obtenir. Elle reste modifiable ensuite. */}
    <Couleurs valeur={couleur} onChange={setCouleur}
      palette={[...(charte ?? []), '#14160F', '#FFFFFF', '#FF5A3C', '#0038FF', '#9B5DE5']} />
    {trouvees ? (
      trouvees.length
        ? <Section titre={`${trouvees.length} forme${trouvees.length > 1 ? 's' : ''}`}>{grille(trouvees, false)}</Section>
        : <Message>Aucune forme pour « {q} ».</Message>
    ) : (<>
      {recents.length > 0 && (
        <Section titre="Utilisés récemment">
          {grille(FORMES.filter(f => recents.includes(f.id))
            .sort((a, b) => recents.indexOf(a.id) - recents.indexOf(b.id)).slice(0, 5), false)}
        </Section>
      )}
      {FORME_FAMILLES.map(fam => {
      const liste = FORMES.filter(f => f.famille === fam.id);
      if (!liste.length) return null;
      const large = fam.id === 'lignes' || fam.id === 'fleches';
      const ouverte = tout === fam.id;
      const montrees = ouverte ? liste : liste.slice(0, large ? 4 : 5);
      return (
        <Section key={fam.id} titre={fam.label}
          action={liste.length > montrees.length || ouverte
            ? <BoutonTexte onClick={() => setTout(ouverte ? null : fam.id)}>{ouverte ? 'Réduire' : 'Afficher tout'}</BoutonTexte>
            : undefined}>
          {grille(montrees, large)}
        </Section>
      );
      })}
    </>)}
  </>);
}

// ─── Illustrations : l'IA, puis les banques ──────────────────────────────────

/** Ce que la génération veut dire dans une section donnée : l'invite, le mot
 *  d'exemple, et s'il faut détourer. Un sticker se détoure, une texture non. */
export type ContexteIA = { titre: string; aide: string; exemple: string; detourerDefaut: boolean };

export const CONTEXTES_IA: Record<string, ContexteIA> = {
  illustrations: { titre: 'Créer un élément', aide: 'Décrivez ce que vous voulez. Quatre propositions, détourées, prêtes à poser.', exemple: 'un caillou en dessin aquarelle', detourerDefaut: true },
  textures: { titre: 'Créer une matière', aide: 'Décrivez la matière. Elle arrive en pleine page, prête à fusionner.', exemple: 'papier kraft froissé', detourerDefaut: false },
  degrades: { titre: 'Créer un dégradé', aide: 'Décrivez l’ambiance. Le dégradé arrive en pleine page.', exemple: 'coucher de soleil pêche et violet', detourerDefaut: false },
  stickers: { titre: 'Créer un sticker', aide: 'Décrivez le sticker. Il arrive détouré, contour compris.', exemple: 'un burger qui sourit', detourerDefaut: true },
  ornements: { titre: 'Créer un ornement', aide: 'Décrivez le tracé. Il arrive détouré, en noir.', exemple: 'une flèche dessinée à la main', detourerDefaut: true },
  icones: { titre: 'Créer une icône', aide: 'Décrivez le pictogramme. Il arrive détouré, en noir.', exemple: 'un panier en osier', detourerDefaut: true },
  motifs: { titre: 'Créer un motif', aide: 'Décrivez le motif. Il arrive en pleine page.', exemple: 'petites feuilles vertes espacées', detourerDefaut: false },
};

export type EtatIA = {
  contexte: ContexteIA;
  prompt: string; setPrompt: (v: string) => void;
  /** Détourer le fond après génération. Décoché, on garde l'image entière :
   *  c'est ce qu'il faut pour une texture ou un fond. */
  detourer: boolean; setDetourer: (v: boolean) => void;
  lancer: () => void;
  encours: boolean;
  etape: string | null;
  erreur: string | null;
  /** Les variantes proposées. Cliquer en pose une. */
  variantes: { uri: string; detoure: boolean }[];
  poser: (uri: string) => void;
};

export type EtatBanque = {
  kind: AssetKind; setKind: (k: AssetKind) => void;
  tout: boolean; setTout: (v: boolean) => void;
  query: string; setQuery: (q: string) => void;
  chercher: (q?: string) => void;
  encore: boolean; suite: () => void;
  items: { id: string; thumb: string; full: string; alt: string; source: string }[];
  chargement: boolean;
  note: string | null;
  onPoser: (url: string) => void;
};

/** Le bloc de génération. C'est la pièce dont le produit doit se vanter : elle
 *  rend un élément détouré, prêt à poser, ce que la plupart des éditeurs ne
 *  font pas. Elle est donc dessinée comme telle, pas comme un champ de plus. */
export function BlocIA({ ia }: { ia: EtatIA }) {
  const pret = ia.prompt.trim().length > 2 && !ia.encours;
  return (
    <div style={{ borderRadius: 16, padding: 14, marginBottom: 20, position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(152deg, color-mix(in srgb, var(--leaf) 58%, var(--paper)), color-mix(in srgb, var(--leaf-soft, var(--leaf)) 46%, var(--paper)) 62%, var(--paper))',
      boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--leaf) 62%, transparent)' }}>
      <style>{`@keyframes klip-pouls{0%,100%{opacity:.45}50%{opacity:.85}}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <span style={{ width: 22, height: 22, borderRadius: 7, display: 'grid', placeItems: 'center', background: 'var(--leaf-ink, #1E3317)', flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--leaf, #BDF2A0)"><path d="M12 2l2.3 6.4 6.4 2.3-6.4 2.3L12 19.4 9.7 13 3.3 10.7 9.7 8.4z"/></svg>
        </span>
        <p style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--leaf-ink, #1E3317)', margin: 0, letterSpacing: '-0.01em' }}>{ia.contexte.titre}</p>
      </div>
      <p style={{ fontSize: 11.5, color: 'color-mix(in srgb, var(--leaf-ink, #1E3317) 78%, transparent)', margin: '0 0 10px', lineHeight: 1.45 }}>
        {ia.contexte.aide}
      </p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 9 }}>
        <input value={ia.prompt} onChange={e => ia.setPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && pret) { e.preventDefault(); ia.lancer(); } }}
          placeholder={ia.contexte.exemple}
          style={{ flex: 1, minWidth: 0, height: 40, padding: '0 12px', borderRadius: 11, border: 'none', background: 'var(--white)', color: 'var(--ink)', fontSize: 12.5, fontFamily: 'var(--sans)', outline: 'none', boxSizing: 'border-box', boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--ink) 8%, transparent)' }} />
        <button onClick={() => pret && ia.lancer()} disabled={!pret}
          style={{ flexShrink: 0, height: 40, padding: '0 15px', borderRadius: 11, border: 'none', display: 'flex', alignItems: 'center', gap: 6,
            background: pret ? 'var(--leaf-ink, #1E3317)' : 'color-mix(in srgb, var(--leaf-ink) 14%, transparent)',
            color: pret ? 'var(--leaf, #BDF2A0)' : 'var(--ink-3)',
            fontSize: 12.5, fontWeight: 800, fontFamily: 'var(--sans)', cursor: pret ? 'pointer' : 'default' }}>
          {ia.encours ? 'En cours' : 'Générer'}
        </button>
      </div>
      <Bascule actif={ia.detourer} onChange={ia.setDetourer} label="Détourer le fond" />
      {!ia.detourer && (
        <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: '7px 0 0', lineHeight: 1.4 }}>
          Image entière : pour une texture, un motif ou un fond.
        </p>
      )}
      {ia.erreur && <p style={{ fontSize: 11.5, color: '#C4452F', margin: '9px 0 0', lineHeight: 1.4 }}>{ia.erreur}</p>}
      {(ia.encours || ia.variantes.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 11 }}>
          {ia.encours
            ? [0, 1, 2, 3].map(i => (
                <div key={i} style={{ aspectRatio: '1', borderRadius: 11, background: 'color-mix(in srgb, var(--ink) 9%, transparent)', animation: `klip-pouls 1.4s ease-in-out ${i * 0.16}s infinite` }} />
              ))
            : ia.variantes.map((v, i) => (
                <button key={i} onClick={() => ia.poser(v.uri)} title="Poser sur le visuel"
                  style={{ aspectRatio: '1', borderRadius: 11, border: 'none', cursor: 'pointer', padding: v.detoure ? 8 : 0, overflow: 'hidden',
                    background: v.detoure ? DAMIER : 'var(--white)', display: 'grid', placeItems: 'center', transition: 'transform .14s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.uri} alt="" style={{ width: '100%', height: '100%', objectFit: v.detoure ? 'contain' : 'cover', display: 'block' }} />
                </button>
              ))}
        </div>
      )}
      {ia.encours && ia.etape && <p style={{ fontSize: 11, color: 'var(--ink-3)', margin: '9px 0 0' }}>{ia.etape}</p>}
      {!ia.encours && ia.variantes.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 9 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Cliquez pour poser.</span>
          <BoutonTexte onClick={ia.lancer}>Relancer</BoutonTexte>
        </div>
      )}
    </div>
  );
}

export function VueIllustrations({ banque }: { banque: EtatBanque }) {
  return (<>
    {/* Une seule bibliothèque. L'utilisateur cherche une illustration, pas un
        fournisseur : le choix « Domaine public ou IconScout » lui demandait de
        savoir ce qu'il ne peut pas savoir. Les deux sont interrogées ensemble
        et la provenance reste sur la vignette. */}
    <p style={TITRE}>Bibliothèque</p>
    <div style={{ height: 9 }} />
    <Onglets options={ASSET_KINDS.map(k => ({ id: k.id, label: k.label }))} valeur={banque.kind}
      onChange={k => { banque.setKind(k); banque.chercher(banque.query); }} />
    <ChampRecherche valeur={banque.query} onChange={banque.setQuery} onValider={q => banque.chercher(q)}
      placeholder="fleur, texture, gravure…" />
    {!banque.items.length && !banque.chargement && (
      <Suggestions mots={[['Nature', 'nature'], ['Nourriture', 'food'], ['Botanique', 'botanical'], ['Gravure', 'engraving'], ['Abstrait', 'abstract'], ['Personnage', 'character']]}
        onChoisir={q => { banque.setQuery(q); banque.chercher(q); }} />
    )}
    {banque.chargement ? <Message>Chargement…</Message>
      : banque.note ? <Message>{banque.note}</Message>
      : banque.items.length ? (<>
          <Grille colonnes={3}>
            {banque.items.map(it => (
              <Tuile key={it.id} onClick={() => banque.onPoser(it.full)} titre={`${it.alt} · ${it.source}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.thumb} alt={it.alt} loading="lazy" style={{ ...IMG, objectFit: 'cover' }} />
              </Tuile>
            ))}
          </Grille>
          {banque.encore && (
            <button onClick={banque.suite} disabled={banque.chargement}
              style={{ width: '100%', height: 38, marginTop: 8, borderRadius: 11, border: 'none', background: 'var(--sunk)', color: 'var(--ink-2)', fontSize: 12, fontWeight: 700, fontFamily: 'var(--sans)', cursor: 'pointer' }}>
              Voir plus
            </button>
          )}
        </>)
      : <Message>Cherchez un mot pour voir la bibliothèque.</Message>}
    {/* La licence n'est pas un filtre parmi d'autres : c'est ce qui décide si
        le client a le droit de publier. Discret, mais dit. */}
    <div style={{ marginTop: 12 }}>
      <Bascule actif={banque.tout} onChange={v => { banque.setTout(v); banque.chercher(banque.query); }}
        label="Inclure les éléments premium" />
      {banque.tout && (
        <p style={{ ...AIDE, margin: '7px 0 0' }}>
          Un élément premium n&apos;est pas licencié pour la publication tant qu&apos;il n&apos;a pas été téléchargé chez IconScout.
        </p>
      )}
    </div>
  </>);
}

// ─── Icônes (Iconify) ────────────────────────────────────────────────────────

export function VueIcones({ query, setQuery, chercher, chargement, resultats, couleur, setCouleur, charte, urlIcone, onPoser }: {
  query: string; setQuery: (q: string) => void; chercher: (q: string) => void;
  chargement: boolean; resultats: string[];
  couleur: string; setCouleur: (c: string) => void; charte?: (string | null | undefined)[];
  urlIcone: (nom: string, couleur: string, taille: number) => string;
  onPoser: (nom: string) => void;
}) {
  return (<>
    <ChampRecherche valeur={query} onChange={setQuery} onValider={chercher} placeholder="flèche, panier, café…" />
    {!resultats.length && !chargement && (
      <Suggestions mots={[['Étoile', 'star'], ['Flèche', 'arrow'], ['Cœur', 'heart'], ['Panier', 'basket'], ['Café', 'coffee'], ['Feuille', 'leaf'], ['Horloge', 'clock'], ['Épingle', 'pin']]}
        onChoisir={q => { setQuery(q); chercher(q); }} />
    )}
    <Couleurs valeur={couleur} onChange={setCouleur} palette={[...(charte ?? []), '#14160F', '#FFFFFF']} />
    {chargement ? <Message>Chargement…</Message>
      : resultats.length === 0 ? <Message>Aucune icône. Essayez un mot en anglais.</Message>
      : (
        <Grille colonnes={5}>
          {resultats.map(nom => (
            <Tuile key={nom} onClick={() => onPoser(nom)} titre={nom} fonce={couleur.toUpperCase() === '#FFFFFF'}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urlIcone(nom, couleur, 48)} alt="" style={IMG} />
            </Tuile>
          ))}
        </Grille>
      )}
  </>);
}

// ─── Stickers ────────────────────────────────────────────────────────────────

export function VueStickers({ couleur, setCouleur, charte, onPoser, onVoirTout }: {
  couleur: string; setCouleur: (c: string) => void; charte?: (string | null | undefined)[];
  onPoser: (s: Sticker) => void; onVoirTout: () => void;
}) {
  const fonce = couleur.toUpperCase() === '#FFFFFF';
  const [recents, memoriser] = useRecents('stickers');
  const poser = (st: Sticker) => { memoriser(st.id); onPoser(st); };
  const vignette = (st: Sticker) => (
    <Tuile key={st.id} onClick={() => poser(st)} titre={st.name} fonce={!!st.recolor && fonce}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={stickerDataUri(st, couleur)} alt={st.name} style={IMG} />
    </Tuile>
  );
  return (<>
    <Couleurs valeur={couleur} onChange={setCouleur}
      palette={[...(charte ?? []), '#14160F', '#FFFFFF', '#FF5A3C', '#FFD400', '#0038FF', '#9B5DE5']} />
    {recents.length > 0 && (
      <Section titre="Utilisés récemment">
        <Grille colonnes={4}>{STICKERS.filter(st => recents.includes(st.id))
          .sort((a, b) => recents.indexOf(a.id) - recents.indexOf(b.id)).slice(0, 8).map(vignette)}</Grille>
      </Section>
    )}
    <Section titre="Les plus utilisés" action={<BoutonTexte onClick={onVoirTout}>Afficher tout ({STICKERS.length})</BoutonTexte>}>
      <Grille colonnes={4}>{STICKERS.slice(0, 16).map(vignette)}</Grille>
    </Section>
  </>);
}

// ─── Ornements ───────────────────────────────────────────────────────────────

export function VueOrnements({ cat, setCat, couleur, setCouleur, charte, urlOrnement, onPoser }: {
  cat: OrnementCategorie; setCat: (c: OrnementCategorie) => void;
  couleur: string; setCouleur: (c: string) => void; charte?: (string | null | undefined)[];
  urlOrnement: (id: string, couleur: string) => string;
  onPoser: (id: string) => void;
}) {
  const liste = ORNEMENTS.filter(o => o.cat === cat);
  const [recents, memoriser] = useRecents('ornements');
  const poser = (id: string) => { memoriser(id); onPoser(id); };
  const vignette = (o: { id: string; nom: string }) => (
    <Tuile key={o.id} onClick={() => poser(o.id)} titre={o.nom} fonce={couleur.toUpperCase() === '#FFFFFF'}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={urlOrnement(o.id, couleur)} alt={o.nom} style={IMG} />
    </Tuile>
  );
  return (<>
    <Puces options={ORNEMENT_CATS.map(c => ({ id: c.id, label: c.label }))} valeur={cat} onChange={setCat} />
    <Couleurs valeur={couleur} onChange={setCouleur} palette={[...(charte ?? []), '#14160F', '#FFFFFF']} />
    {recents.length > 0 && (
      <Section titre="Utilisés récemment">
        <Grille colonnes={4}>{ORNEMENTS.filter(o => recents.includes(o.id))
          .sort((a, b) => recents.indexOf(a.id) - recents.indexOf(b.id)).slice(0, 8).map(vignette)}</Grille>
      </Section>
    )}
    <Grille colonnes={4}>{liste.map(vignette)}</Grille>
  </>);
}

// ─── Cadres photo : les compositions ─────────────────────────────────────────

/** Le paysage témoin, dessiné dans la case d'un aperçu. `<svg>` imbriqué :
 *  il établit sa propre fenêtre, donc il rogne proprement. */
function CaseTemoin({ x, y, w, h, id }: { x: number; y: number; w: number; h: number; id: string }) {
  return (
    <svg x={x} y={y} width={w} height={h} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#BFE3F7" /><stop offset="1" stopColor="#E8F5FD" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${id})`} />
      <ellipse cx="30" cy="27" rx="15" ry="9" fill="#fff" />
      <ellipse cx="44" cy="30" rx="11" ry="7" fill="#fff" />
      <ellipse cx="72" cy="18" rx="10" ry="6" fill="#fff" opacity="0.85" />
      <path d="M0 70C16 60 32 66 50 70c18 4 34-2 50-9v39H0z" fill="#A8D26D" />
      <path d="M0 82C20 74 38 80 57 82c19 2 30-2 43-6v24H0z" fill="#7FB945" />
    </svg>
  );
}

export function VueCadres({ onGrille, format = 0.8 }: {
  onGrille: (g: Grille) => void;
  /** Largeur / hauteur de la page, pour que la vignette ait la vraie forme. */
  format?: number;
}) {
  return (<>
    <p style={AIDE}>Posez une composition, puis cliquez dans une case pour y mettre votre image.</p>
    <Grille colonnes={3}>
      {GRILLES.map(g => (
        <button key={g.id} onClick={() => onGrille(g)} title={g.nom}
          style={{ aspectRatio: String(format), borderRadius: 10, border: 'none', background: 'var(--sunk)', cursor: 'pointer', padding: 5, transition: 'transform .14s, filter .14s' }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.filter = 'brightness(.96)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.filter = 'none'; }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
            {g.cellules.map((k, i) => (
              <CaseTemoin key={i} id={`${g.id}-${i}`}
                x={k.x * 100 + 1.2} y={k.y * 100 + 1.2}
                w={Math.max(1, k.w * 100 - 2.4)} h={Math.max(1, k.h * 100 - 2.4)} />
            ))}
          </svg>
        </button>
      ))}
    </Grille>
  </>);
}

// ─── Badges ──────────────────────────────────────────────────────────────────

const BADGES = ['NOUVEAU', 'PROMO', '-20%', 'ÉDITION LIMITÉE', 'OUVERT', 'BIENTÔT'];

export function VueBadges({ couleur, onPoser }: { couleur: string; onPoser: (texte: string) => void }) {
  return (<>
    <p style={AIDE}>Un bloc de texte sur aplat, aux couleurs de la charte. Le texte reste modifiable.</p>
    <div style={{ display: 'grid', gap: 7 }}>
      {BADGES.map(b => (
        <button key={b} onClick={() => onPoser(b)}
          style={{ height: 46, borderRadius: 11, border: 'none', background: 'var(--sunk)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 12px', transition: 'filter .14s, transform .14s' }}
          onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(.95)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.transform = 'none'; }}>
          <span style={{ background: couleur, color: '#fff', fontFamily: 'Archivo, var(--sans)', fontWeight: 800, fontSize: 12.5, letterSpacing: '.05em', padding: '6px 12px', borderRadius: 7 }}>{b}</span>
        </button>
      ))}
    </div>
  </>);
}

// ─── Dégradés ────────────────────────────────────────────────────────────────

export function VueDegrades({ query, setQuery, tout, setTout, onPoser }: {
  query: string; setQuery: (q: string) => void;
  tout: FamilleDegrade | null; setTout: (f: FamilleDegrade | null) => void;
  onPoser: (d: Degrade) => void;
}) {
  const [recents, memoriser] = useRecents('degrades');
  const poser = (d: Degrade) => { memoriser(d.id); onPoser(d); };
  const vignette = (d: Degrade) => (
    <button key={d.id} onClick={() => poser(d)} title={d.nom}
      style={{ aspectRatio: '1', borderRadius: 10, border: 'none', cursor: 'pointer', padding: 0, overflow: 'hidden',
        background: DAMIER, transition: 'transform .14s, filter .14s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.filter = 'brightness(.97)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.filter = 'none'; }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={degradeDataUri(d, 180, 180)} alt={d.nom} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </button>
  );
  const q = query.trim();
  const trouves = q ? chercherDegrades(q) : null;
  const magiques = [DEGRADES[0], DEGRADES[10], DEGRADES[16], DEGRADES[24], DEGRADES[30], DEGRADES[36]].filter(Boolean);
  return (<>
    <ChampRecherche valeur={query} onChange={setQuery} placeholder="voile, halo, trame…" />
    {trouves ? (
      trouves.length
        ? <Section titre={`${trouves.length} dégradé${trouves.length > 1 ? 's' : ''}`}><Grille colonnes={3}>{trouves.map(vignette)}</Grille></Section>
        : <Message>Aucun dégradé pour « {q} ».</Message>
    ) : (<>
      {recents.length > 0 && (
        <Section titre="Utilisés récemment">
          <Grille colonnes={3}>{DEGRADES.filter(d => recents.includes(d.id))
            .sort((a, b) => recents.indexOf(a.id) - recents.indexOf(b.id)).slice(0, 6).map(vignette)}</Grille>
        </Section>
      )}
      <Section titre="Recommandations">
        <Grille colonnes={3}>{magiques.map(vignette)}</Grille>
      </Section>
      {FAMILLES_DEGRADE.map(fam => {
        const liste = DEGRADES.filter(d => d.famille === fam.id);
        if (!liste.length) return null;
        const ouverte = tout === fam.id;
        const montres = ouverte ? liste : liste.slice(0, 6);
        return (
          <Section key={fam.id} titre={fam.label}
            action={liste.length > montres.length || ouverte
              ? <BoutonTexte onClick={() => setTout(ouverte ? null : fam.id)}>{ouverte ? 'Réduire' : 'Afficher tout'}</BoutonTexte>
              : undefined}>
            <Grille colonnes={3}>{montres.map(vignette)}</Grille>
          </Section>
        );
      })}
    </>)}
  </>);
}

// ─── Textures ────────────────────────────────────────────────────────────────

export type EtatBanqueTextures = {
  query: string; setQuery: (q: string) => void;
  chercher: (q: string) => void;
  chargement: boolean;
  items: { id: string; thumb: string; full: string; alt: string }[];
  onPoser: (url: string) => void;
};

export function VueTextures({ surSelection, onPoser, banque }: {
  /** Un calque est sélectionné : la matière se posera dessus. */
  surSelection: boolean;
  onPoser: (t: Texture) => void;
  /** Photos de matière, cherchées dans la banque. */
  banque: EtatBanqueTextures;
}) {
  const [recents, memoriser] = useRecents('textures');
  const poser = (t: Texture) => { memoriser(t.id); onPoser(t); };
  const vignette = (t: Texture) => (
    <button key={t.id} onClick={() => poser(t)} title={t.nom}
      style={{ aspectRatio: '1', borderRadius: 10, border: 'none', background: 'var(--sunk)', cursor: 'pointer', padding: 0, overflow: 'hidden', position: 'relative', transition: 'transform .14s, filter .14s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.filter = 'brightness(.96)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.filter = 'none'; }}>
      {/* L'aperçu montre la matière SUR une couleur, avec son vrai mode de
          fusion : une texture seule, sur fond blanc, ne se voit pas. */}
      <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(140deg, var(--mint, #2FD79B), var(--forest, #0C2A1D))' }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={textureDataUri(t, 180, 180)} alt={t.nom}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', mixBlendMode: t.fusion, opacity: Math.min(1, t.opacite / 100 + 0.25) }} />
      <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '10px 4px 4px', fontSize: 8.5, fontFamily: 'var(--mono)', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '.04em', background: 'linear-gradient(transparent, rgba(0,0,0,.45))' }}>{t.nom}</span>
    </button>
  );
  return (<>
    <p style={AIDE}>
      {surSelection
        ? 'La matière se pose sur le calque sélectionné, par-dessus.'
        : 'La matière se pose sur toute la page. Sélectionnez un calque d’abord pour ne l’appliquer qu’à lui.'}
    </p>

    {/* Les matières photographiées d'abord : c'est ce qu'on cherche en
        premier quand on vient ici. Le grain calculé est un réglage, pas une
        vitrine. */}
    <ChampRecherche valeur={banque.query} onChange={banque.setQuery} onValider={banque.chercher}
      placeholder="papier, béton, marbre…" />
    <Suggestions mots={[['Papier', 'paper texture'], ['Froissé', 'crumpled paper'], ['Béton', 'concrete wall texture'], ['Marbre', 'marble texture'], ['Aquarelle', 'watercolor texture'], ['Tissu', 'fabric texture'], ['Bois', 'wood texture'], ['Métal', 'metal texture'], ['Grain', 'grain noise texture'], ['Encre', 'ink texture']]}
      onChoisir={q => { banque.setQuery(q); banque.chercher(q); }} />
    {banque.chargement ? <Message>Chargement…</Message>
      : banque.items.length ? (
        <Section titre="Matières photographiées">
          <Grille colonnes={3}>
            {banque.items.map(it => (
              <Tuile key={it.id} onClick={() => banque.onPoser(it.full)} titre={it.alt || 'Matière'}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.thumb} alt={it.alt} loading="lazy" style={{ ...IMG, objectFit: 'cover' }} />
              </Tuile>
            ))}
          </Grille>
        </Section>
      ) : <Message>Cherchez une matière, ou choisissez un mot.</Message>}

    {recents.length > 0 && (
      <Section titre="Utilisés récemment">
        <Grille colonnes={3}>{TEXTURES.filter(t => recents.includes(t.id))
          .sort((a, b) => recents.indexOf(a.id) - recents.indexOf(b.id)).slice(0, 6).map(vignette)}</Grille>
      </Section>
    )}

    <Section titre="Grain et trames">
      <Grille colonnes={3}>{TEXTURES.map(vignette)}</Grille>
    </Section>
  </>);
}

// ─── Motifs ──────────────────────────────────────────────────────────────────

export const MOTIFS: { id: string; label: string; motif: (c: string) => string }[] = [
  { id: 'a', label: 'Pois', motif: c => `<pattern id='a' width='44' height='44' patternUnits='userSpaceOnUse'><circle cx='12' cy='12' r='6' fill='${c}'/></pattern>` },
  { id: 'b', label: 'Rayures', motif: c => `<pattern id='b' width='28' height='28' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'><rect width='10' height='28' fill='${c}'/></pattern>` },
  { id: 'c', label: 'Grille', motif: c => `<pattern id='c' width='40' height='40' patternUnits='userSpaceOnUse'><path d='M40 0H0V40' fill='none' stroke='${c}' stroke-width='3'/></pattern>` },
  { id: 'd', label: 'Vagues', motif: c => `<pattern id='d' width='60' height='30' patternUnits='userSpaceOnUse'><path d='M0 15 Q15 0 30 15 T60 15' fill='none' stroke='${c}' stroke-width='4'/></pattern>` },
  { id: 'e', label: 'Chevrons', motif: c => `<pattern id='e' width='40' height='24' patternUnits='userSpaceOnUse'><path d='M0 22 L20 4 L40 22' fill='none' stroke='${c}' stroke-width='4'/></pattern>` },
  { id: 'f', label: 'Confettis', motif: c => `<pattern id='f' width='60' height='60' patternUnits='userSpaceOnUse'><rect x='8' y='10' width='10' height='10' rx='2' fill='${c}' transform='rotate(20 13 15)'/><circle cx='44' cy='20' r='5' fill='${c}'/><rect x='30' y='42' width='9' height='9' rx='2' fill='${c}' transform='rotate(-15 34 46)'/></pattern>` },
  { id: 'g', label: 'Croix', motif: c => `<pattern id='g' width='40' height='40' patternUnits='userSpaceOnUse'><path d='M14 20h12M20 14v12' stroke='${c}' stroke-width='3' stroke-linecap='round'/></pattern>` },
  { id: 'h', label: 'Écailles', motif: c => `<pattern id='h' width='40' height='20' patternUnits='userSpaceOnUse'><path d='M0 20a20 20 0 0 1 40 0' fill='none' stroke='${c}' stroke-width='3'/></pattern>` },
  { id: 'i', label: 'Triangles', motif: c => `<pattern id='i' width='36' height='32' patternUnits='userSpaceOnUse'><polygon points='18,4 34,28 2,28' fill='${c}'/></pattern>` },
];

export const svgMotif = (id: string, motif: (c: string) => string, couleur: string) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'><defs>${motif(couleur)}</defs><rect width='600' height='600' fill='url(#${id})'/></svg>`;

export function VueMotifs({ couleur, setCouleur, charte, onPoser }: {
  couleur: string; setCouleur: (c: string) => void; charte?: (string | null | undefined)[];
  onPoser: (svg: string) => void;
}) {
  return (<>
    <p style={AIDE}>Le motif se pose en fond, sur toute la page.</p>
    <Couleurs valeur={couleur} onChange={setCouleur} palette={[...(charte ?? []), '#14160F', '#FFFFFF']} />
    <Grille colonnes={3}>
      {MOTIFS.map(m => {
        const svg = svgMotif(m.id, m.motif, couleur);
        return (
          <Tuile key={m.id} onClick={() => onPoser(svg)} titre={m.label} fonce={couleur.toUpperCase() === '#FFFFFF'}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} alt={m.label} style={{ ...IMG, objectFit: 'cover' }} />
          </Tuile>
        );
      })}
    </Grille>
  </>);
}
