import { NextRequest, NextResponse } from 'next/server';
import { Font } from 'fonteditor-core';

// Réparation des polices importées.
//
// POURQUOI CETTE ROUTE EXISTE
// Un fichier de police peut être un TrueType parfaitement valide et rester
// REFUSÉ par tous les navigateurs. Ils font passer chaque police du web dans un
// vérificateur strict, et les vieilles fontes y échouent. Diagnostiqué le 26/08
// sur une Poplar d'Adobe (1990) :
//
//   OTS parsing error: cmap: Range glyph reference too high (65535 > 199)
//
// Sa table de correspondance caractères→glyphes désignait le glyphe 65535 alors
// que la police n'en contient que 200. Le refus est SILENCIEUX : le texte tombe
// sur un serif de secours, et personne ne comprend pourquoi.
//
// La réponse « convertissez votre police en WOFF2 » n'en est pas une : c'est le
// format que tout le monde a sur son disque, et aucun community manager ne fera
// cette manipulation. C'est donc à KLIP de réparer.
//
// COMMENT
// Un simple aller-retour par `fonteditor-core` suffit : sa lecture normalise les
// tables et écarte les références hors limites, son écriture les reconstruit
// proprement. Vérifié dans un vrai navigateur — la police refusée avant l'est
// acceptée après, et s'affiche.
//
// On écrit du TTF et non du WOFF2 : le WOFF2 demande un module WebAssembly, une
// dépendance de plus à faire vivre en serverless pour un gain de poids qui ne
// change rien ici.

export const maxDuration = 30;

/** Poids maximal accepté. Une police dépasse rarement 2 Mo ; au-delà, c'est
 *  presque toujours autre chose qu'on nous envoie. */
const MAX = 5 * 1024 * 1024;

type FormatEntree = 'ttf' | 'otf' | 'woff' | 'woff2';

function formatDe(nom: string): FormatEntree | null {
  const ext = nom.toLowerCase().split('.').pop();
  return ext === 'ttf' || ext === 'otf' || ext === 'woff' || ext === 'woff2' ? ext : null;
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const fichier = form.get('font');
    if (!(fichier instanceof File)) {
      return NextResponse.json({ error: 'Aucun fichier reçu' }, { status: 400 });
    }
    if (fichier.size > MAX) {
      return NextResponse.json({ error: 'Fichier trop lourd (5 Mo maximum)' }, { status: 413 });
    }
    const type = formatDe(fichier.name);
    if (!type) {
      return NextResponse.json({ error: 'Format non reconnu : attendu .ttf, .otf, .woff ou .woff2' }, { status: 415 });
    }

    const entree = Buffer.from(await fichier.arrayBuffer());
    let sortie: Buffer;
    try {
      // `hinting: false` : les instructions TrueType des vieilles fontes sont
      // l'autre grande source de rejet, et elles ne servent à rien au rendu d'un
      // visuel exporté en image.
      const police = Font.create(entree, { type });
      sortie = Buffer.from(police.write({ type: 'ttf', hinting: false }) as ArrayBuffer);
    } catch (e) {
      console.error('[fonts/repair] police illisible', fichier.name, e);
      return NextResponse.json(
        { error: 'Ce fichier ne peut pas être lu comme une police. Vérifiez qu\'il n\'est pas protégé ou corrompu.' },
        { status: 422 },
      );
    }

    if (!sortie.length) {
      return NextResponse.json({ error: 'La réparation a produit un fichier vide' }, { status: 500 });
    }

    return new NextResponse(new Uint8Array(sortie), {
      status: 200,
      headers: {
        'Content-Type': 'font/ttf',
        'Content-Disposition': `attachment; filename="${fichier.name.replace(/\.[^.]+$/, '')}.ttf"`,
      },
    });
  } catch (e) {
    console.error('[fonts/repair] erreur', e);
    return NextResponse.json({ error: 'Réparation impossible' }, { status: 500 });
  }
}
