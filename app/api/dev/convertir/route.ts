import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { convertirModele } from '@/lib/templateVersRecette';
import { buildDesignElements, effectiveMax } from '@/lib/designSystem';
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
      // LE CONTRÔLE QUI COMPTE VRAIMENT : après `buildDesignElements`, donc
      // après le re-calage et l'auto-ajustement, deux blocs porteurs de rôle se
      // marchent-ils encore dessus ? C'est l'état que l'oeil voit, pas celui de
      // la recette.
      chevauchementsAuRendu: (() => {
        const fields: Record<string, string> = {};
        for (const sl of recette.slots) fields[sl.key] = (sl.exemple || '').trim() || 'Texte';
        const els = buildDesignElements(recette, {
          fields, brand: { primary: w?.primary_color, secondary: w?.secondary_color, accent: w?.accent_color,
            name: w?.name, sector: w?.sector, tone: w?.tone, display: w?.font_family, body: w?.font_secondary } as never,
          w: 1080, h: 1350, hasPhoto: recette.nodes.some(n => n.k === 'photo'),
        }) as Record<string, unknown>[];
        const t = els.filter(e => e.type === 'text' && e.role);
        const boite = (e: Record<string, unknown>) => ({
          y1: Number(e.y) || 0,
          y2: (Number(e.y) || 0) + (Number(e.maxLines) || 1) * (Number(e.fontSize) || 0) * (Number(e.lineHeight) || 1.15),
          x1: Number(e.x) || 0, x2: (Number(e.x) || 0) + (Number(e.width) || 0),
        });
        const out: string[] = [];
        for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) {
          const a = boite(t[i]), b = boite(t[j]);
          const dy = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
          const dx = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
          if (dy > 2 && dx > 2) out.push(`${t[i].role} × ${t[j].role} sur ${Math.round(dy)} px`);
        }
        // Texte SORTI du cadre : le défaut le plus visible et le moins pardonnable.
        for (const e of t) {
          const b = boite(e);
          if (b.y2 > 1350 + 4) out.push(`${e.role} dépasse le bas de ${Math.round(b.y2 - 1350)} px`);
          if (b.y1 < -4) out.push(`${e.role} dépasse le haut de ${Math.round(-b.y1)} px`);
          if (b.x2 > 1080 + 4) out.push(`${e.role} dépasse la droite de ${Math.round(b.x2 - 1080)} px`);
        }
        // Texte posé sur une forme PLEINE (badge, pastille, aplat).
        const f = els.filter(e => ['rect','circle','vector','star'].includes(String(e.type))
          && Number(e.opacity ?? 100) > 55 && !e.scrim);
        for (const e of t) {
          const a = boite(e);
          for (const sh of f) {
            const x1 = Number(sh.x) || 0, y1 = Number(sh.y) || 0;
            const w2 = Number(sh.width) || 0, h2 = Number(sh.height) || 0;
            if (!w2 || !h2) continue;
            if (x1 <= 2 && y1 <= 2 && h2 >= 1350 * 0.9) continue; // le fond
            const dy = Math.min(a.y2, y1 + h2) - Math.max(a.y1, y1);
            const dx = Math.min(a.x2, x1 + w2) - Math.max(a.x1, x1);
            if (dy > 6 && dx > 6) out.push(`${e.role} posé sur une forme (${Math.round(dy)} px)`);
          }
        }
        return out;
      })(),
      effectiveMaxOk: recette.slots.every(sl => effectiveMax(recette, sl) > 0),
      positions: (() => {
        const fields: Record<string, string> = {};
        for (const sl of recette.slots) fields[sl.key] = (sl.exemple || '').trim() || 'Texte';
        const els = buildDesignElements(recette, {
          fields, brand: { primary: w?.primary_color, secondary: w?.secondary_color, accent: w?.accent_color,
            name: w?.name, sector: w?.sector, tone: w?.tone, display: w?.font_family, body: w?.font_secondary } as never,
          w: 1080, h: 1350, hasPhoto: recette.nodes.some(n => n.k === 'photo'),
        }) as Record<string, unknown>[];
        return els.filter(e => e.type === 'text').map(e =>
          `${e.role ?? 'figé'} x=${e.x} y=${e.y} w=${e.width} taille=${e.fontSize} lignes=${e.maxLines ?? '-'} rot=${e.rotation ?? 0}`);
      })(),
      // CE QUE LA DÉDUCTION SEULE AURAIT DONNÉ, rôles déclarés ignorés : c'est
      // le cas de quelqu'un qui dessine sans rien déclarer, donc le cas visé.
      deduction: deduireRoles((els as Record<string, unknown>[]).map(e => ({ ...e, role: undefined })) as never)
        .map(x => `${x.role ?? 'figé'} ← ${x.texte.slice(0, 22)} (${x.pourquoi.slice(0, 40)})`),
    });
  }
  return NextResponse.json({ modeles: out.length, resultats: out });
}
