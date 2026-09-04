'use client';

// L'écran qui manquait entre « compte Instagram connecté » et « la personne a
// des modèles ». Il lit le fil, en tire des compositions de départ, les montre,
// et enregistre celles que la personne garde.
//
// POURQUOI IL EXISTE. `/api/brand-dna/templates` savait déjà proposer des
// modèles d'après le fil d'une marque, mais rien dans le produit ne l'appelait :
// la route ne vivait que dans un banc d'essai. Un client fraîchement créé
// ouvrait donc un éditeur vide, et le compositeur, faute de modèles à
// privilégier, tirait au sort dans le catalogue général. C'est la cause du
// « ce n'est pas assez adapté à chaque client ».

import { useCallback, useEffect, useState } from 'react';
import { fontCssHrefs } from '@/lib/fontCatalog';
import {
  lireMarqueDepuisInstagram, adopterModeles, demanderVariantes, enregistrerAdn, libelleEtape,
  FORMATS_SORTIE, type Etape, type ModelePropose, type Variante, type CharteAppliquee, type PoliceImportee,
} from '@/lib/brandOnboarding';
import type { BrandDNA } from '@/lib/brandDNA';

type Calque = {
  type?: string; x?: number; y?: number; width?: number; height?: number;
  fill?: string; text?: string; fontSize?: number; fontFamily?: string;
  fontStyle?: string; align?: string; rotation?: number; opacity?: number;
  cornerRadius?: number; lineHeight?: number; letterSpacing?: number; uppercase?: boolean;
};

/** Aperçu d'un modèle : les mêmes calques que l'éditeur, à l'échelle. */
function Apercu({ elements, w, h, taille }: { elements: unknown[]; w: number; h: number; taille: number }) {
  const k = taille / w;
  return (
    <div style={{
      position: 'relative', width: taille, height: Math.round(h * k),
      overflow: 'hidden', borderRadius: 8, background: 'var(--sunk, #eee)', flexShrink: 0,
    }}>
      {(elements as Calque[]).map((e, i) => {
        const base: React.CSSProperties = {
          position: 'absolute',
          left: (e.x ?? 0) * k, top: (e.y ?? 0) * k,
          width: (e.width ?? 0) * k,
          transform: e.rotation ? `rotate(${e.rotation}deg)` : undefined,
          transformOrigin: 'left top',
          opacity: (e.opacity ?? 100) / 100,
        };
        if (e.type === 'image') {
          // La zone photo reste une zone : on montre sa place, pas une image
          // empruntée, puisque c'est le client qui posera la sienne.
          return <div key={i} style={{ ...base, height: (e.height ?? 0) * k, background: 'linear-gradient(135deg,#c9c9c4,#a9a9a3)' }} />;
        }
        if (e.type === 'rect' || e.type === 'shape') {
          return <div key={i} style={{
            ...base, height: (e.height ?? 0) * k, background: e.fill,
            borderRadius: e.cornerRadius ? e.cornerRadius * k : (e.type === 'shape' ? '50%' : 0),
          }} />;
        }
        if (e.type === 'text') {
          return <div key={i} style={{
            ...base,
            fontSize: Math.max(3, (e.fontSize ?? 12) * k),
            fontFamily: e.fontFamily ? `'${e.fontFamily}', 'Archivo', system-ui, sans-serif` : 'system-ui, sans-serif',
            color: e.fill,
            lineHeight: e.lineHeight ?? 1.15,
            letterSpacing: (e.letterSpacing ?? 0) * k,
            textAlign: (e.align as React.CSSProperties['textAlign']) ?? 'left',
            fontWeight: /bold/i.test(e.fontStyle ?? '') ? 800 : 500,
            fontStyle: /italic/i.test(e.fontStyle ?? '') ? 'italic' : 'normal',
            textTransform: e.uppercase ? 'uppercase' : 'none',
            whiteSpace: 'pre-wrap',
          }}>{e.text}</div>;
        }
        return null;
      })}
    </div>
  );
}

export default function ModelesDeMarque({
  workspaceId, name, sector, images, onFini,
}: {
  workspaceId: string;
  name?: string | null;
  sector?: string | null;
  /** Visuels fournis à la main : sert à éprouver la chaîne sans OAuth. */
  images?: string[];
  onFini?: (combien: number) => void;
}) {
  const [etape, setEtape] = useState<Etape | null>(null);
  const [erreur, setErreur] = useState('');
  const [modeles, setModeles] = useState<ModelePropose[] | null>(null);
  // CE QUE L'IA A COMPRIS, MONTRÉ. Sans ça, un jeu de modèles qui ne ressemble
  // pas au client ne dit pas OÙ ça casse : mauvaise lecture du fil, ou bonne
  // lecture et mauvais choix de composition. Deux corrections opposées.
  const [dna, setDna] = useState<BrandDNA | null>(null);
  // La charte RÉELLEMENT appliquée. C'est elle qui décide des polices et des
  // couleurs, jamais la composition : quand les modèles ne ressemblent pas au
  // client, c'est ici qu'il faut regarder en premier.
  const [charte, setCharte] = useState<CharteAppliquee | null>(null);
  const [polices, setPolices] = useState<PoliceImportee[]>([]);
  const [policesPretes, setPolicesPretes] = useState(0);
  const [gardes, setGardes] = useState<Set<string>>(new Set());
  const [enregistre, setEnregistre] = useState(0);
  const [occupe, setOccupe] = useState(false);
  // Variantes : d'autres compositions du même parti pris, déclinées par format.
  const [varDe, setVarDe] = useState<string | null>(null);
  const [variantes, setVariantes] = useState<Variante[] | null>(null);
  const [varOccupe, setVarOccupe] = useState(false);
  const [varCharte, setVarCharte] = useState<{ titre: string; texte: string; titreDeLaCharte: boolean } | null>(null);
  const [formats, setFormats] = useState<string[]>(['ig-portrait']);

  // LES POLICES DE LA MARQUE, CHARGÉES POUR L'APERÇU.
  //
  // La charte était bien lue et bien appliquée — les calques portaient
  // « ObviouslyDemo Black » — mais l'aperçu ne chargeait aucune feuille de
  // style : le navigateur ne connaissait pas la famille et retombait sur sa
  // police par défaut, un serif. D'où des modèles qui semblaient ignorer la
  // charte alors qu'ils la respectaient. Même mécanisme que l'éditeur, qui
  // charge ces familles depuis Google ou Fontshare selon le catalogue.
  useEffect(() => {
    if (!charte || typeof document === 'undefined') return;
    const familles = [charte.titre, charte.texte, charte.serif, charte.condense, charte.manuscrit].filter(Boolean);
    for (const { id, href } of fontCssHrefs(familles)) {
      if (document.getElementById(id)) continue;
      const lnk = document.createElement('link');
      lnk.id = id; lnk.rel = 'stylesheet'; lnk.href = href;
      document.head.appendChild(lnk);
    }
  }, [charte]);

  // LES POLICES DÉPOSÉES PAR LE CLIENT, et c'est le cas de toutes les vraies
  // chartes : elles ne sont dans aucun catalogue, donc `fontCssHrefs` ne peut
  // rien pour elles. Seule leur adresse permet de les afficher. Sans ça, un
  // client qui a déposé sa police voyait des modèles composés dans la police par
  // défaut du navigateur — un serif fin — et concluait que la charte était
  // ignorée alors qu'elle était appliquée.
  useEffect(() => {
    if (!polices.length || typeof document === 'undefined' || !document.fonts) return;
    let vivant = true;
    (async () => {
      for (const p of polices) {
        try {
          const ff = new FontFace(p.family, `url(${p.url})`, p.weight ? { weight: String(p.weight) } : undefined);
          await ff.load();
          if (!vivant) return;
          document.fonts.add(ff);
        } catch { /* une police illisible ne doit pas arrêter les autres */ }
      }
      // Un re-rendu pour que les aperçus déjà peints reprennent la bonne police.
      if (vivant) setPolicesPretes(n => n + 1);
    })();
    return () => { vivant = false; };
  }, [polices]);

  const analyser = useCallback(async () => {
    setErreur(''); setModeles(null); setEnregistre(0); setOccupe(true);
    try {
      const r = await lireMarqueDepuisInstagram({ workspaceId, name, sector, images, count: 6, onEtape: setEtape });
      setModeles(r.modeles); setDna(r.dna); setCharte(r.applique); setPolices(r.polices);
      // La mesure est CONSERVÉE : le compositeur lira ensuite `visual_dna` pour
      // choisir le terrain et la typographie de ce client, au lieu de repartir
      // d'une empreinte de son nom. Sans ça, on mesurait pour rien.
      void enregistrerAdn(workspaceId, r.dna);
      // Tout est retenu par défaut : la personne enlève ce qu'elle ne veut pas,
      // ce qui est plus rapide que de tout cocher.
      setGardes(new Set(r.modeles.map(m => m.recipeId)));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
    setEtape(null); setOccupe(false);
  }, [workspaceId, name, sector, images]);

  const enregistrer = useCallback(async () => {
    if (!modeles) return;
    const retenus = modeles.filter(m => gardes.has(m.recipeId));
    if (!retenus.length) return;
    setOccupe(true); setErreur('');
    try {
      const { enregistres } = await adopterModeles(workspaceId, retenus);
      setEnregistre(enregistres);
      onFini?.(enregistres);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
    setOccupe(false);
  }, [modeles, gardes, workspaceId, onFini]);

  const voirVariantes = useCallback(async (m: ModelePropose, fmts = formats) => {
    setVarDe(m.recipeId); setVariantes(null); setVarOccupe(true); setErreur('');
    try {
      const rep = await demanderVariantes({
        workspaceId, recipeId: m.recipeId, fields: m.fields, formats: fmts, count: 4,
      });
      setVariantes(rep.variantes);
      // Les variantes viennent d'une AUTRE route, qui reconstruit la charte de
      // son côté : ses polices doivent être chargées elles aussi, sinon les
      // aperçus retombent sur celle du navigateur alors que les modèles
      // au-dessus sont justes. Deux chemins, une seule charte.
      if (rep.polices?.length) setPolices(p => {
        const vus = new Set(p.map(x => x.family + x.url));
        return [...p, ...rep.polices!.filter(x => !vus.has(x.family + x.url))];
      });
      setVarCharte(rep.applique ?? null);
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)); }
    setVarOccupe(false);
  }, [workspaceId, formats]);

  const adopterVariante = useCallback(async (v: Variante) => {
    const r = v.rendus[0];
    if (!r) return;
    setVarOccupe(true);
    try {
      const { enregistres } = await adopterModeles(workspaceId, [{
        recipeId: v.recipeId, name: v.name, intention: v.desc.slice(0, 160),
        family: v.family, fields: v.fields, format_id: r.format_id, elements: r.elements,
      }]);
      onFini?.(enregistres);
      setEnregistre(n => n + enregistres);
    } catch (e) { setErreur(e instanceof Error ? e.message : String(e)); }
    setVarOccupe(false);
  }, [workspaceId, onFini]);

  const basculer = (id: string) => setGardes(s => {
    const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });

  return (
    <section style={{ border: '1.5px solid var(--line)', borderRadius: 14, padding: 20, background: 'var(--white)' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Vos modèles, tirés de votre compte</h3>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5, maxWidth: '62ch' }}>
        KLIP lit vos publications, en relève les couleurs, la typographie et la façon dont vous
        posez le texte, puis vous propose des modèles qui vous ressemblent. Vous les modifiez
        ensuite comme vous voulez.
      </p>

      {!modeles && (
        <button onClick={analyser} disabled={occupe} className="btn btn-dark"
          style={{ height: 44, padding: '0 18px', cursor: occupe ? 'default' : 'pointer' }}>
          {occupe ? `${libelleEtape(etape ?? 'pixels')}…` : (images?.length ? `Analyser ces ${images.length} visuels` : 'Analyser mon compte Instagram')}
        </button>
      )}

      {erreur && (
        <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--danger, #C2412A)', lineHeight: 1.45 }}>
          {erreur}
        </p>
      )}

      {dna && (
        <div style={{ border: '1.5px solid var(--line)', borderRadius: 12, padding: 14, marginBottom: 16, background: 'var(--sunk, #f6f5f2)' }}>
          <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
            Ce que KLIP a lu de votre compte
          </p>
          {dna.summary && <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.5 }}>{dna.summary}</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, fontSize: 12.5, lineHeight: 1.5 }}>
            <div>
              <b>Couleurs relevées</b>
              <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
                {(dna.brandColors ?? []).length === 0 && <span style={{ color: 'var(--ink-3)' }}>aucune</span>}
                {(dna.brandColors ?? []).map(c => (
                  <span key={c} title={c} style={{ width: 24, height: 24, borderRadius: 6, background: c, border: '1px solid rgba(0,0,0,.15)' }} />
                ))}
              </div>
            </div>
            <div><b>Typographie</b><br />{dna.register}</div>
            <div><b>Texte sur photo</b><br />{dna.textOnPhoto}</div>
            <div><b>Zones d&apos;écriture</b><br />{(dna.zones ?? []).join(', ') || '—'}</div>
            <div><b>Personnalité</b><br />{(dna.vibes ?? []).join(', ') || '—'}</div>
          </div>
          {(dna.dispositifs ?? []).length > 0 && (
            <div style={{ margin: '12px 0 0' }}>
              <b style={{ fontSize: 12.5 }}>Procédés repérés, et ils pèsent sur le choix :</b>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                {dna.dispositifs.map(d => (
                  <span key={d} style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                    background: 'var(--mint, #2FD79B)', color: '#06281C' }}>{d}</span>
                ))}
              </div>
            </div>
          )}
          {(dna.motifs ?? []).length > 0 && (
            <p style={{ margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.5 }}>
              <b>Gestes qui reviennent :</b> {dna.motifs.join(' ; ')}
            </p>
          )}
          {(dna.gaps ?? []).length > 0 && (
            <p style={{ margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-3)' }}>
              <b>Ce qu&apos;elle ne fait jamais :</b> {dna.gaps.join(' ; ')}
            </p>
          )}
          {charte && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
                Charte appliquée à ces modèles
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, fontSize: 12.5, lineHeight: 1.5 }}>
                <div>
                  <b>Titre</b><br />
                  <span style={{ fontFamily: `'${charte.titre}', sans-serif` }}>{charte.titre}</span>
                  <span style={{ color: charte.source.police === 'charte' ? 'var(--mint-ink, #0B6B4C)' : '#C2412A', fontWeight: 700 }}> · {charte.source.police}</span>
                </div>
                <div><b>Texte</b><br />{charte.texte}</div>
                <div><b>Identité</b><br />{charte.identiteNom}</div>
                <div>
                  <b>Couleurs</b>
                  <div style={{ display: 'flex', gap: 5, marginTop: 5, alignItems: 'center' }}>
                    {([['marque', charte.couleurs.marque], ['accent', charte.couleurs.accent], ['papier', charte.couleurs.papier], ['encre', charte.couleurs.encre]] as const).map(([n, c]) => (
                      <span key={n} title={`${n} ${c}`} style={{ width: 24, height: 24, borderRadius: 6, background: c, border: '1px solid rgba(0,0,0,.15)' }} />
                    ))}
                    <span style={{ marginLeft: 4, fontSize: 11.5, color: charte.source.marque === 'défaut' ? '#C2412A' : 'var(--ink-3)', fontWeight: 700 }}>
                      marque : {charte.source.marque}
                    </span>
                  </div>
                </div>
              </div>
              {(charte.source.marque === 'défaut' || charte.source.police !== 'charte') && (
                <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#C2412A', lineHeight: 1.5 }}>
                  <b>Voilà pourquoi les modèles ne vous ressemblent pas.</b>{' '}
                  {charte.source.marque === 'défaut' && "Aucune couleur de marque n'a été trouvée, ni déclarée dans la fiche du client, ni relevée sur le fil : les compositions repartent sur un terrain de secours. "}
                  {charte.source.police !== 'charte' && "La police de titre n'est pas celle du client : aucune n'est déclarée dans sa fiche, donc KLIP en déduit une. "}
                  Renseignez la charte du client, ou corrigez-la, et relancez : ce sont les mêmes compositions qui changeront de visage.
                </p>
              )}
            </div>
          )}
          <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.45 }}>
            Les polices et les couleurs viennent de la CHARTE, jamais de la composition. Si elles sont fausses ci-dessus, changer de compositions n&apos;y fera rien.
          </p>
        </div>
      )}

      {modeles && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, margin: '4px 0 16px' }}>
            {modeles.map(m => {
              const on = gardes.has(m.recipeId);
              return (
                <button key={m.recipeId} onClick={() => basculer(m.recipeId)} type="button"
                  style={{
                    border: on ? '2px solid var(--mint, #2FD79B)' : '1.5px solid var(--line)',
                    borderRadius: 12, padding: 8, background: 'var(--white)', cursor: 'pointer',
                    textAlign: 'left', width: 176, opacity: on ? 1 : 0.5,
                  }}>
                  <Apercu key={policesPretes} elements={m.elements} w={1080} h={1440} taille={158} />
                  <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 7, lineHeight: 1.25 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.3 }}>{m.intention}</div>
                  <span role="button" tabIndex={0}
                    onClick={(ev) => { ev.stopPropagation(); void voirVariantes(m); }}
                    onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.stopPropagation(); void voirVariantes(m); } }}
                    style={{ display: 'inline-block', marginTop: 8, fontSize: 11, fontWeight: 700,
                      color: varDe === m.recipeId ? 'var(--mint-ink, #0B6B4C)' : 'var(--ink-3)',
                      textDecoration: 'underline', cursor: 'pointer' }}>
                    Variantes
                  </span>
                </button>
              );
            })}
          </div>

          {varDe && (
            <div style={{ border: '1.5px solid var(--line)', borderRadius: 12, padding: 16, marginBottom: 16, background: 'var(--sunk, #f6f5f2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <strong style={{ fontSize: 13 }}>Variantes de ce modèle</strong>
                <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                  Même parti pris, autre dessin. Le format ne change que le cadrage : les compositions sont écrites en fractions.
                </span>
                <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', flexWrap: 'wrap' }}>
                  {FORMATS_SORTIE.map(f => (
                    <button key={f.id} type="button"
                      onClick={() => { const n = [f.id as string]; setFormats(n); const m = modeles.find(x => x.recipeId === varDe); if (m) void voirVariantes(m, n); }}
                      style={{ padding: '3px 9px', borderRadius: 20, border: '1px solid var(--line)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        background: formats[0] === f.id ? 'var(--ink)' : 'var(--white)', color: formats[0] === f.id ? '#fff' : 'var(--ink-3)' }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {varCharte && (
                <p style={{ fontSize: 11.5, margin: '0 0 10px', color: varCharte.titreDeLaCharte ? 'var(--ink-3)' : '#C2412A' }}>
                  Charte de ces variantes : titre <b>{varCharte.titre}</b>, texte <b>{varCharte.texte}</b>
                  {charte && varCharte.titre !== charte.titre && <> — <b>différente de celle des modèles ({charte.titre})</b>, c&apos;est un défaut.</>}
                </p>
              )}
              {varOccupe && <p style={{ fontSize: 12.5, color: 'var(--ink-3)', margin: 0 }}>Écriture des variantes…</p>}

              {!varOccupe && variantes && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {variantes.map(v => v.rendus.map(r => (
                    <div key={v.recipeId + r.format_id} style={{ width: 158 }}>
                      <Apercu key={policesPretes} elements={r.elements} w={r.w} h={r.h} taille={158} />
                      <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6, lineHeight: 1.25 }}>{v.name}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 1 }}>{r.label} · {v.family}</div>
                      <button type="button" onClick={() => void adopterVariante(v)} disabled={varOccupe}
                        style={{ marginTop: 6, width: '100%', padding: '6px 0', borderRadius: 7, border: '1.5px solid var(--line)',
                          background: 'var(--white)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                        Ajouter celle-ci
                      </button>
                    </div>
                  )))}
                </div>
              )}
            </div>
          )}

          {enregistre > 0 ? (
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--mint-ink, #0B6B4C)' }}>
              {enregistre} modèle{enregistre > 1 ? 's' : ''} ajouté{enregistre > 1 ? 's' : ''} à votre bibliothèque.
              Vous les retrouvez dans Modèles, et le compositeur s&apos;en sert désormais en priorité.
            </p>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={enregistrer} disabled={occupe || gardes.size === 0} className="btn btn-primary"
                style={{ height: 42, padding: '0 18px', cursor: gardes.size ? 'pointer' : 'default' }}>
                {occupe ? 'Enregistrement…' : `Garder ${gardes.size} modèle${gardes.size > 1 ? 's' : ''}`}
              </button>
              <button onClick={analyser} disabled={occupe} className="btn"
                style={{ height: 42, padding: '0 16px', border: '1.5px solid var(--line)', background: 'var(--white)', cursor: 'pointer' }}>
                En proposer d&apos;autres
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
