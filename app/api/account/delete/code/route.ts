import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { codeCourant, VALIDITE_MIN } from "@/lib/deletion-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Envoi du code qui débloque la suppression du compte.
 *
 * Deux rôles. Le premier est de vérifier que la personne a bien accès à la
 * boîte mail du compte : sans cela, un ordinateur laissé ouvert suffit à
 * effacer le travail d'une agence. Le second est de laisser passer quelques
 * minutes entre la décision et le geste — le temps qu'il faut pour changer
 * d'avis.
 *
 * La raison du départ voyage avec : c'est la seule occasion d'apprendre
 * pourquoi quelqu'un s'en va, et elle part à l'équipe, pas dans une table. */

const MOTIFS: Record<string, string> = {
  prix: "Trop cher",
  manque: "Une fonction me manquait",
  inutilise: "Je ne m'en sers plus",
  concurrent: "Je pars chez un concurrent",
  bugs: "Trop de problèmes techniques",
  autre: "Autre",
};

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const email = (session.user.email ?? "").trim();
  if (!email) return NextResponse.json({ error: "Ce compte n'a pas d'adresse e-mail." }, { status: 400 });

  const { motif, detail } = await req.json().catch(() => ({ motif: null, detail: null }));
  const code = codeCourant(session.user.id);

  const envoye = await sendEmail(
    email,
    `Votre code de suppression : ${code}`,
    `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#14160F">
       <p style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8B8E7F;margin:0 0 10px">Klip</p>
       <h1 style="font-size:22px;line-height:1.25;margin:0 0 14px">Vous avez demandé à supprimer votre compte</h1>
       <p style="font-size:15px;line-height:1.6;margin:0 0 22px">
         Entrez ce code dans Klip pour terminer. Il est valable ${VALIDITE_MIN} minutes.
       </p>
       <p style="font-size:34px;font-weight:800;letter-spacing:.16em;margin:0 0 22px;padding:16px 20px;background:#F1F2F5;border-radius:14px;text-align:center">${code}</p>
       <p style="font-size:14px;line-height:1.6;color:#5A5E50;margin:0 0 8px">
         Une fois la suppression confirmée, vos espaces clients, vos publications, vos visuels et vos fichiers
         seront effacés définitivement, et votre abonnement sera résilié.
       </p>
       <p style="font-size:14px;line-height:1.6;color:#5A5E50;margin:0">
         <strong>Vous n'avez rien demandé ?</strong> Ignorez ce message : sans ce code, rien ne sera supprimé.
         Changez votre mot de passe pour être tranquille.
       </p>
     </div>`,
    `Votre code de suppression Klip : ${code}\n\n`
      + `Valable ${VALIDITE_MIN} minutes. Entrez-le dans Klip pour terminer.\n\n`
      + `Vous n'avez rien demandé ? Ignorez ce message : sans ce code, rien ne sera supprimé.`,
  );

  if (!envoye) {
    // Mieux vaut le dire que laisser quelqu'un attendre un mail qui ne
    // partira pas : l'envoi est désactivé tant que Resend n'est pas branché.
    return NextResponse.json(
      { error: "L'envoi du code a échoué. Écrivez-nous, on supprimera le compte à la main." },
      { status: 502 },
    );
  }

  // Notification interne, au mieux : elle ne doit jamais faire échouer la demande.
  const equipe = process.env.EMAIL_TEAM ?? process.env.EMAIL_REPLY_TO;
  if (equipe && motif) {
    const libelle = MOTIFS[motif] ?? motif;
    sendEmail(
      equipe,
      `Départ annoncé : ${email}`,
      `<p><strong>${email}</strong> a demandé la suppression de son compte.</p>
       <p>Motif : <strong>${libelle}</strong></p>
       ${detail ? `<p>Détail : ${String(detail).slice(0, 800)}</p>` : ""}`,
    ).catch(() => {});
  }

  return NextResponse.json({ ok: true, validiteMin: VALIDITE_MIN });
}
