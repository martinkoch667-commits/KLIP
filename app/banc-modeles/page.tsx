'use client';

// Banc d'essai des modèles de marque.
//
// POURQUOI IL EXISTE. En local, `NEXT_PUBLIC_APP_URL` pointe sur la production :
// après l'autorisation, Meta renvoie sur Vercel et la boucle OAuth ne se ferme
// jamais. On ne pouvait donc pas éprouver la fonctionnalité sur sa machine, ce
// qui est exactement le moment où on en a besoin.
//
// La lecture du compte ne sert QU'À obtenir une liste d'adresses d'images. En la
// fournissant à la main, on exerce tout le reste : mesure des pixels, planche
// contact, lecture du style, choix des compositions, remplissage des textes, et
// l'enregistrement chez le client. Et surtout, cette page monte LE VRAI
// composant du produit, pas une copie : ce qu'on voit ici est ce que verra
// l'utilisateur à la dernière étape de la création.

import { useCallback, useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import ModelesDeMarque from '@/components/ModelesDeMarque';

type Ws = { id: string; name: string | null; sector: string | null };

const carte: React.CSSProperties = {
  border: '1px solid var(--line, #e2e2dc)', borderRadius: 14,
  padding: 20, background: 'var(--white, #fff)', marginBottom: 20,
};

export default function BancModeles() {
  const supabase = createClientComponentClient();
  const [wss, setWss] = useState<Ws[]>([]);
  const [wsId, setWsId] = useState('');
  const [urls, setUrls] = useState('');
  const [lance, setLance] = useState(false);
  const [err, setErr] = useState('');
  const [charge, setCharge] = useState(false);
  const [manuel, setManuel] = useState(false);
  // Fichiers déposés, convertis en data:. `readImage` les accepte tels quels et
  // court-circuite le proxy : ni expiration, ni CORS, ni blocage d'Instagram.
  const [fichiers, setFichiers] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('workspaces').select('id, name, sector').order('created_at', { ascending: false }).limit(50);
      setCharge(true);
      if (error) { setErr(error.message); setManuel(true); return; }
      setWss((data ?? []) as Ws[]);
      if (data?.length) setWsId(data[0].id);
      // Zéro client sans erreur, c'est la signature d'une session absente : les
      // règles de la base ne rendent que les workspaces de qui est connecté.
      // Sans ce message, le bouton restait grisé sans qu'on sache pourquoi.
      else { setErr("Aucun client lisible. Vous n'êtes probablement pas connecté sur localhost : ouvrez d'abord http://localhost:3000 et connectez-vous, puis revenez."); setManuel(true); }
    })();
  }, [supabase]);

  const collees = urls.split(/[\s,]+/).map(s => s.trim()).filter(s => /^https?:\/\//.test(s));
  const liste = [...fichiers, ...collees];
  // Une adresse de PAGE de publication ne rend pas de pixels : Instagram y sert
  // 600 Ko de JavaScript et plus aucune balise d'image depuis 2025. Le dire
  // AVANT de lancer évite un « 0 visuel lisible » incompréhensible.
  const pages = collees.filter(u => /instagram\.com\/(p|reel)\//.test(u));
  const ws = wss.find(w => w.id === wsId);

  const relancer = useCallback(() => { setLance(false); setTimeout(() => setLance(true), 0); }, []);

  return (
    <main style={{ padding: 26, maxWidth: 1080, margin: '0 auto', fontFamily: 'var(--sans, system-ui)' }}>
      <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Banc des modèles de marque</h1>
      <p style={{ margin: '0 0 22px', opacity: 0.72, fontSize: 14, lineHeight: 1.5, maxWidth: '68ch' }}>
        La même chaîne qu&apos;à la dernière étape de la création d&apos;un client, mais nourrie
        d&apos;adresses collées au lieu du compte Instagram. Tout le reste est identique, y compris
        l&apos;enregistrement : les modèles gardés atterrissent vraiment dans la bibliothèque du client choisi.
      </p>

      <section style={carte}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', opacity: .6, marginBottom: 6 }}>
          Client
        </label>
        {err && <p style={{ color: '#C2412A', fontSize: 13, margin: '0 0 8px' }}>{err}</p>}
        {manuel ? (
          <input value={wsId} onChange={e => { setWsId(e.target.value.trim()); setLance(false); }}
            placeholder="identifiant du client (le morceau après /workspace/ dans l'adresse)"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid var(--line, #e2e2dc)', fontSize: 13.5, fontFamily: 'ui-monospace, monospace', background: 'var(--white, #fff)' }} />
        ) : (
          <select value={wsId} onChange={e => { setWsId(e.target.value); setLance(false); }}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid var(--line, #e2e2dc)', fontSize: 14, background: 'var(--white, #fff)' }}>
            {!charge && <option value="">chargement…</option>}
            {wss.map(w => <option key={w.id} value={w.id}>{w.name || w.id}{w.sector ? ` — ${w.sector}` : ''}</option>)}
          </select>
        )}

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', opacity: .6, margin: '18px 0 6px' }}>
          Visuels — le plus simple : déposez les images
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '11px 16px', borderRadius: 9,
          border: '1.5px dashed var(--line, #c9c9c2)', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>
          <input type="file" accept="image/*" multiple style={{ display: 'none' }}
            onChange={async e => {
              const fs = Array.from(e.target.files ?? []);
              const lus = await Promise.all(fs.map(f => new Promise<string>(res => {
                const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f);
              })));
              setFichiers(lus); setLance(false);
            }} />
          Choisir des captures d&apos;écran de publications
        </label>
        {fichiers.length > 0 && (
          <p style={{ margin: '2px 0 10px', fontSize: 12.5, color: '#0B6B4C', fontWeight: 600 }}>
            {fichiers.length} image{fichiers.length > 1 ? 's' : ''} déposée{fichiers.length > 1 ? 's' : ''}.
          </p>
        )}

        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', opacity: .6, margin: '12px 0 6px' }}>
          Ou des adresses d&apos;images, une par ligne
        </label>
        <textarea value={urls} onChange={e => { setUrls(e.target.value); setLance(false); }} rows={7}
          placeholder={'https://…/post1.jpg\nhttps://…/post2.jpg\nhttps://…/post3.jpg'}
          style={{ width: '100%', padding: '11px 12px', borderRadius: 9, border: '1.5px solid var(--line, #e2e2dc)', fontFamily: 'ui-monospace, monospace', fontSize: 12.5, lineHeight: 1.6, resize: 'vertical', background: 'var(--white, #fff)' }} />
        <p style={{ margin: '7px 0 0', fontSize: 12.5, opacity: .65 }}>
          {liste.length} visuel{liste.length > 1 ? 's' : ''} en tout. Il en faut au moins trois : en dessous,
          une « couleur de marque » n&apos;est plus qu&apos;une couleur de photo. Une adresse doit pointer une
          IMAGE (elle finit en .jpg ou .webp), pas une page.
        </p>
        {pages.length > 0 && (
          <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#C2412A', lineHeight: 1.5 }}>
            {pages.length} de ces adresses sont des <b>pages de publication</b>, pas des images : elles ne
            rendront aucun pixel. Sur la publication ouverte dans le navigateur, faites un clic droit sur la
            photo puis « Copier l&apos;adresse de l&apos;image ». Ou plus simple : faites une capture d&apos;écran
            et déposez-la ci-dessus.
          </p>
        )}

        {liste.length > 0 && liste.length < 5 && (
          <ul style={{ margin: '8px 0 0', padding: '0 0 0 18px', fontSize: 11.5, opacity: .6, fontFamily: 'ui-monospace, monospace' }}>
            {liste.map((u, i) => <li key={i} style={{ wordBreak: 'break-all' }}>{u.startsWith('data:') ? `image déposée ${i + 1}` : u.slice(0, 110)}</li>)}
          </ul>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={relancer} disabled={!wsId || liste.length < 3}
            style={{ padding: '11px 18px', borderRadius: 9, border: 'none', cursor: liste.length >= 3 && wsId ? 'pointer' : 'default',
              background: liste.length >= 3 && wsId ? '#14160F' : '#cfcfc9', color: '#fff', fontWeight: 700, fontSize: 14 }}>
            Monter le banc
          </button>
          {/* UN BOUTON GRISÉ DOIT DIRE POURQUOI. Sans ça, on ne sait pas s'il
              manque un client ou des adresses, et on reste bloqué sans indice. */}
          {(!wsId || liste.length < 3) && (
            <span style={{ fontSize: 12.5, color: '#C2412A' }}>
              {!wsId
                ? 'Il manque le client : rien n’est sélectionné ci-dessus.'
                : `Il manque des visuels : ${liste.length} sur 3 minimum. Déposez des images, c'est le plus sûr.`}
            </span>
          )}
        </div>
      </section>

      {lance && wsId && (
        <ModelesDeMarque
          workspaceId={wsId}
          name={ws?.name ?? null}
          sector={ws?.sector ?? null}
          images={liste}
          onFini={(n) => console.log('[banc-modeles]', n, 'modèle(s) enregistré(s)')}
        />
      )}
    </main>
  );
}
