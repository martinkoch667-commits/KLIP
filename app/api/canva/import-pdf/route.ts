import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { extractPdf } from '@/lib/pdfStructure';
import { pdfToTemplate } from '@/lib/canvaImport';

export const runtime = 'nodejs';
export const maxDuration = 30;

// POST /api/canva/import-pdf
//
// Un PDF exporté (de Canva ou d'ailleurs) devient un modèle KLIP.
//
// Route serveur et pas navigateur : la lecture d'un PDF passe par `zlib`, qui
// n'existe pas côté client. Et c'est mieux ainsi, le jour où l'export viendra
// directement de l'API Canva : le fichier n'aura alors jamais à descendre
// jusqu'au navigateur.
//
// RIEN N'EST ÉCRIT EN BASE ICI. La route rend un modèle et un RAPPORT, et c'est
// le rapport qui compte : combien de blocs, quelles polices, ce qui n'a pas
// suivi, et une confiance. Un import approximatif présenté comme fidèle coûte
// plus cher qu'un import refusé, parce que le client le découvre en modifiant
// son modèle. Sous une confiance de 0,5, l'appelant doit proposer de garder
// l'image aplatie comme simple référence.
export async function POST(request: NextRequest) {
  const sb = createRouteHandlerClient({ cookies });
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  let bytes: Uint8Array;
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
    if (file.size > 25 * 1024 * 1024) return NextResponse.json({ error: 'Fichier trop lourd (25 Mo maximum)' }, { status: 413 });
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  // Un PDF commence par %PDF. Un PNG déguisé en .pdf doit être refusé ici et pas
  // ressortir en modèle vide sans explication.
  const entete = Array.from(bytes.slice(0, 4)).map(c => String.fromCharCode(c)).join('');
  if (entete !== '%PDF') {
    return NextResponse.json({ error: "Ce fichier n'est pas un PDF." }, { status: 415 });
  }

  try {
    const pages = extractPdf(bytes, 12);
    if (!pages.length) {
      return NextResponse.json({ error: 'Aucune page lisible dans ce PDF.' }, { status: 422 });
    }
    const tpl = pdfToTemplate(pages);
    if (!tpl) return NextResponse.json({ error: 'Conversion impossible.' }, { status: 422 });

    return NextResponse.json({
      template: tpl,
      source: pages.map(p => ({
        width: p.width, height: p.height,
        textes: p.texts.length, aplats: p.rects.length, images: p.images.length,
      })),
    });
  } catch (err) {
    console.error('[canva/import-pdf]', err);
    return NextResponse.json({ error: 'Lecture du PDF impossible' }, { status: 500 });
  }
}
