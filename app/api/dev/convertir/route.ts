import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { convertirModele } from '@/lib/templateVersRecette';
import { variantesDe } from '@/lib/variantesRecette';
import { controlerRecette } from '@/lib/controleRecettes';
import { cadreDe } from '@/lib/formatsEditeur';
import { deduireRoles } from '@/lib/deduireRoles';

// Contrôle de bout en bout du convertisseur, sur de VRAIS modèles enregistrés.
// DÉVELOPPEMENT UNIQUEMENT. Il lit avec la clé de service pour pouvoir tourner
// sans session : c'est ce qui permet de vérifier la chaîne avant de demander à
// quelqu'un d'y passer un après-midi.
export const dynamic = 'force-dynamic';


export async function GET() {
  if (process.env.NODE_ENV === 'production') return new NextResponse(null, { status: 404 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: tpls } = await sb.from('post_templates')
    .select('id, name, format_id, text_zones, pages, workspace_id, background_style').limit(200);
  const { data: wss } = await sb.from('workspaces')
    .select('id, name, sector, tone, primary_color, secondary_color, accent_color, font_family, font_secondary');
  const parWs = new Map((wss ?? []).map(w => [w.id, w]));

  const out = [];
  for (const t of tpls ?? []) {
    const row = t as Record<string, unknown>;
    const pages = row.pages as Array<{ elements?: unknown[] }> | null;
    const els = Array.isArray(pages) && pages.length ? (pages[0]?.elements ?? []) : (row.text_zones as unknown[] ?? []);
    if (!Array.isArray(els) || !els.length) continue;
    const w = parWs.get(String(row.workspace_id));
    const [fw, fh] = cadreDe(row.format_id);

    const { recette, pertes } = convertirModele({
      elements: els, format: { w: fw, h: fh },
      charte: {
        name: w?.name, sector: w?.sector, tone: w?.tone,
        primary: w?.primary_color, secondary: w?.secondary_color, accent: w?.accent_color,
        display: w?.font_family, body: w?.font_secondary,
      },
      fond: row.background_style as { type?: string; color?: string } | null,
      id: `maison-${String(row.id).slice(0, 8)}`, nom: String(row.name || 'Sans nom'),
    });
    const v = variantesDe(recette, [], 4);
    out.push({
      modele: recette.name, client: w?.name ?? '?',
      calques: els.length, noeuds: recette.nodes.length,
      champs: recette.slots.map(s => `${s.key}(${s.max})`),
      couleurs: Array.from(new Set(recette.nodes.map(n => (n as { fill?: string }).fill).filter(Boolean))),
      polices: Array.from(new Set(recette.nodes.filter(n => n.k === "text").map(n => (n as { font?: string }).font).filter(Boolean))),
      fautes: controlerRecette(recette).map(f => f.detail),
      pertes,
      variantes: v.map(x => x.geste),
      // CE QUE LA DÉDUCTION SEULE AURAIT DONNÉ, rôles déclarés ignorés : c'est
      // le cas de quelqu'un qui dessine sans rien déclarer, donc le cas visé.
      deduction: deduireRoles((els as Record<string, unknown>[]).map(e => ({ ...e, role: undefined })) as never)
        .map(x => `${x.role ?? 'figé'} ← ${x.texte.slice(0, 22)} (${x.pourquoi.slice(0, 40)})`),
    });
  }
  return NextResponse.json({ modeles: out.length, resultats: out });
}
