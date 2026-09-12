import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { convertirModele, type Charte } from '@/lib/templateVersRecette';
import { declinerSerie } from '@/lib/variantesRecette';
import { controlerRecette } from '@/lib/controleRecettes';

/* POST /api/atelier/decliner — « j'ai dessiné mes modèles, fais-m'en une série ».
 *
 * NE TOUCHE À RIEN. Cette route lit, convertit, décline et REND. Elle n'écrit
 * pas une ligne : c'est `/api/atelier/enregistrer` qui le fait, sur ce que
 * l'humain a retenu. Deux cents compositions injectées sans relecture, c'est
 * deux cents façons de découvrir un défaut chez un client.
 *
 * LE FORMAT EST CELUI DU MODÈLE, pas une constante. Un modèle dessiné en story
 * converti avec les dimensions d'un post carré donne des fractions fausses, donc
 * un dessin déformé — et rien ne le signale, parce que des fractions fausses
 * restent des fractions valides. */
export const maxDuration = 60;

const FMT: Record<string, [number, number]> = {
  'ig-portrait': [1080, 1350], 'ig-45': [1080, 1350], 'ig-square': [1080, 1080],
  'ig-story': [1080, 1920], facebook: [1200, 630],
};

export async function POST(request: NextRequest) {
  try {
    const sb = createRouteHandlerClient({ cookies });
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const { workspaceId, parModele } = await request.json();
    if (typeof workspaceId !== 'string' || !workspaceId) {
      return NextResponse.json({ error: 'workspaceId requis' }, { status: 400 });
    }
    const par = Math.max(1, Math.min(8, Number(parModele) || 4));

    // La charte du client CHEZ QUI le modèle a été dessiné : c'est elle qui dit
    // à quel rôle rattacher chaque couleur littérale. Sans elle, la conversion
    // rattache tout aux couleurs par défaut et le travail est perdu.
    const { data: ws } = await sb.from('workspaces')
      .select('name, sector, tone, primary_color, secondary_color, accent_color, font_family, font_secondary')
      .eq('id', workspaceId).single();
    if (!ws) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 });

    const charte: Charte = {
      name: ws.name, sector: ws.sector, tone: ws.tone,
      primary: ws.primary_color, secondary: ws.secondary_color, accent: ws.accent_color,
      display: ws.font_family, body: ws.font_secondary,
    };
    const sansCharte = !ws.primary_color && !ws.secondary_color && !ws.accent_color;

    const { data: tpls, error } = await sb.from('post_templates')
      .select('id, name, format_id, text_zones, pages')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })
      .limit(120)
      .then(r => (r.error
        ? sb.from('post_templates').select('id, name, format_id, text_zones')
            .eq('workspace_id', workspaceId).order('created_at', { ascending: true }).limit(120)
        : r));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const bases = [];
    const pertes: { modele: string; quoi: string[] }[] = [];
    for (const t of tpls ?? []) {
      const row = t as Record<string, unknown>;
      const [w, h] = FMT[String(row.format_id)] ?? FMT['ig-portrait'];
      // `pages` porte le modèle complet quand il en a plusieurs ; on ne décline
      // que la PREMIÈRE page : c'est elle qui décide si un post est lu.
      const pages = row.pages as Array<{ elements?: unknown[] }> | null;
      const els = Array.isArray(pages) && pages.length
        ? (pages[0]?.elements ?? [])
        : (row.text_zones as unknown[] ?? []);
      if (!Array.isArray(els) || els.length === 0) continue;

      const { recette, pertes: p } = convertirModele({
        elements: els, format: { w, h }, charte,
        id: `maison-${String(row.id).slice(0, 8)}`,
        nom: String(row.name || 'Sans nom'),
      });
      const fautes = controlerRecette(recette);
      bases.push({
        recette,
        // Un modèle dessiné à la main peut parfaitement être hors cadre : on le
        // DIT, on ne le corrige pas en douce et on ne le jette pas non plus.
        fautes: fautes.map(f => f.detail),
        pertes: p,
      });
      if (p.length) pertes.push({ modele: recette.name, quoi: p });
    }

    const variantes = declinerSerie(bases.map(b => b.recette), par);

    return NextResponse.json({
      charte: { ...charte, renseignee: !sansCharte },
      modeles: bases.length,
      variantes: variantes.length,
      total: bases.length + variantes.length,
      pertes,
      bases,
      series: variantes.map(v => ({
        recette: v.recette, geste: v.geste, emprunt: v.emprunt ?? null,
        parent: v.recette.id.replace(/-v\d+$/, ''),
      })),
    });
  } catch (e) {
    console.error('[atelier/decliner]', e);
    return NextResponse.json({ error: 'Déclinaison échouée' }, { status: 500 });
  }
}
