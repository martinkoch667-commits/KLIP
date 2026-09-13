import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { DESIGN_RECIPES } from '@/lib/designSystem';
import { oublierCatalogue } from '@/lib/recettesBase';

/* LE CATALOGUE DE LA MAISON — celui où l'IA pioche pour TOUS les clients.
 *
 * CE QUE CETTE ROUTE FAIT, ET POURQUOI ELLE EST À PART. Une composition
 * enregistrée par l'atelier naît de portée « client » : elle ne sert que le
 * compte qui l'a dessinée, et la politique RLS INTERDIT à un utilisateur de la
 * passer en « catalogue ». C'est volontaire — sans cette barrière, n'importe
 * quel compte pousserait ses dessins dans le vivier de tous les autres.
 *
 * Faire entrer une composition dans le catalogue est donc une décision de
 * PLATEFORME, pas une action d'utilisateur. Elle passe par la clé de service, et
 * elle est réservée aux adresses listées dans `KLIP_ADMIN_EMAILS`.
 *
 * ⚠ SANS CETTE VARIABLE, LA ROUTE REFUSE TOUT LE MONDE. C'est le bon défaut :
 * une route de plateforme qui s'ouvre faute de configuration est une porte
 * laissée entrouverte. Tant que KLIP n'a qu'un opérateur, la liste tient en une
 * adresse ; le jour où il y en a plusieurs, c'est ici qu'on posera un vrai rôle.
 */
export const dynamic = 'force-dynamic';

function estAdmin(email: string | undefined): boolean {
  const liste = (process.env.KLIP_ADMIN_EMAILS ?? '')
    .split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  return !!email && liste.includes(email.toLowerCase());
}

function service() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** Tout le vivier tel qu'il est servi : les recettes du CODE, plus les lignes de
 *  la base, chacune avec sa provenance et son état. C'est la seule vue où l'on
 *  voit le catalogue en entier — le code seul en cache la moitié, la base seule
 *  en cache l'autre. */
export async function GET() {
  const sb = createRouteHandlerClient({ cookies });
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { data } = await sb.from('design_recipes')
    .select('recipe_id, name, family, photo, description, nodes, slots, source, geste, portee, active, workspace_id, created_at')
    .limit(2000);

  const enBase = new Map((data ?? []).map(r => [r.recipe_id, r]));

  const duCode = DESIGN_RECIPES.map(r => {
    const masque = enBase.get(r.id);
    return {
      recipe_id: r.id, name: r.name, family: r.family, photo: r.photo,
      description: r.desc, nodes: r.nodes, slots: r.slots,
      origine: 'code' as const,
      geste: null as string | null,
      portee: 'catalogue',
      active: masque ? masque.active !== false : true,
      workspace_id: null as string | null,
    };
  });

  const deLaBase = (data ?? [])
    .filter(r => !DESIGN_RECIPES.some(x => x.id === r.recipe_id))
    .map(r => ({ ...r, origine: r.portee === 'catalogue' ? 'catalogue' : 'client' }));

  return NextResponse.json({
    total: duCode.length + deLaBase.length,
    code: duCode.length,
    catalogue: deLaBase.filter(r => r.portee === 'catalogue').length,
    client: deLaBase.filter(r => r.portee !== 'catalogue').length,
    admin: estAdmin(session.user.email),
    compositions: [...deLaBase, ...duCode],
  });
}

/** Passer une composition dans le catalogue de la maison, ou l'en retirer. */
export async function POST(request: NextRequest) {
  const sb = createRouteHandlerClient({ cookies });
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  if (!estAdmin(session.user.email)) {
    return NextResponse.json({
      error: "Réservé à la plateforme. Ajoute ton adresse dans KLIP_ADMIN_EMAILS pour l'activer.",
    }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.recipeIds)
    ? body.recipeIds.filter((x: unknown) => typeof x === 'string') : [];
  const vers = body?.portee === 'client' ? 'client' : 'catalogue';
  if (!ids.length) return NextResponse.json({ error: 'recipeIds requis' }, { status: 400 });

  // ON NE PROMEUT QUE CE QUI APPARTIENT À CELUI QUI DEMANDE. La clé de service
  // ignore la RLS : sans cette vérification faite à la main, la route
  // laisserait déplacer les compositions de n'importe qui.
  const { data: siennes } = await sb.from('design_recipes').select('recipe_id').in('recipe_id', ids);
  const autorises = new Set((siennes ?? []).map(r => r.recipe_id));
  const retenus = ids.filter(id => autorises.has(id));
  if (!retenus.length) return NextResponse.json({ error: 'Aucune composition accessible' }, { status: 404 });

  // Une composition de catalogue n'appartient plus à un client : on détache le
  // workspace, sinon sa suppression emporterait une pièce du catalogue commun.
  const { error } = await service().from('design_recipes')
    .update(vers === 'catalogue' ? { portee: 'catalogue', workspace_id: null } : { portee: 'client' })
    .in('recipe_id', retenus);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  oublierCatalogue();
  return NextResponse.json({ ok: true, deplacees: retenus.length, portee: vers });
}

/** Masquer ou rétablir une composition DU CODE.
 *
 * Les 162 recettes écrites en dur n'ont pas de ligne en base : il n'y a rien à
 * désactiver. On INSÈRE donc une ligne portant leur identifiant et `active:
 * false`, que `catalogueDe` traite comme un masque. Rétablir, c'est effacer ce
 * masque — la recette du code reprend sa place, intacte.
 *
 * C'est une décision de plateforme comme la promotion : retirer une composition
 * du catalogue la retire pour TOUS les clients.
 */
export async function PUT(request: NextRequest) {
  const sb = createRouteHandlerClient({ cookies });
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  if (!estAdmin(session.user.email)) {
    return NextResponse.json({
      error: "Réservé à la plateforme. Ajoute ton adresse dans KLIP_ADMIN_EMAILS pour l'activer.",
    }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.recipeId === 'string' ? body.recipeId.trim() : '';
  const masquer = body?.masquer !== false;
  if (!id) return NextResponse.json({ error: 'recipeId requis' }, { status: 400 });

  const duCode = DESIGN_RECIPES.find(r => r.id === id);
  if (!duCode) return NextResponse.json({ error: 'Cette composition ne vient pas du code' }, { status: 400 });

  const svc = service();
  if (!masquer) {
    // Rétablir : on efface le masque, et la recette du code reprend sa place.
    const { error } = await svc.from('design_recipes').delete().eq('recipe_id', id).eq('source', 'masque');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    oublierCatalogue();
    return NextResponse.json({ ok: true, active: true });
  }

  // Le masque porte le dessin d'origine : si la recette disparaît un jour du
  // code, la ligne reste lisible et on sait ce qu'elle écartait.
  const { error } = await svc.from('design_recipes').upsert({
    recipe_id: id, name: duCode.name, family: duCode.family,
    vibe: duCode.vibe ?? [], intents: duCode.intents ?? [],
    photo: duCode.photo, description: duCode.desc,
    nodes: duCode.nodes, slots: duCode.slots,
    source: 'masque', portee: 'catalogue', workspace_id: null, active: false,
  }, { onConflict: 'recipe_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  oublierCatalogue();
  return NextResponse.json({ ok: true, active: false });
}
