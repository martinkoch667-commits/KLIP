/* lib/email.ts — envoi d'e-mails via Resend (REST API).
   Inactif tant que RESEND_API_KEY n'est pas défini (mode "prêt à brancher"). */

import crypto from "node:crypto";

const RESEND_API = "https://api.resend.com/emails";
const FROM = process.env.EMAIL_FROM ?? "KLIP <onboarding@resend.dev>";
const REPLY_TO = process.env.EMAIL_REPLY_TO ?? null;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://getklip.fr";

export const emailEnabled = () => !!process.env.RESEND_API_KEY;

/* ── Désinscription (RGPD) ────────────────────────────────────────────────────
   Jeton HMAC dérivé de l'email : pas de table de tokens à gérer, et un lien
   forgé sans le secret ne peut pas désinscrire quelqu'un d'autre.

   La clé est `UNSUBSCRIBE_SECRET`, séparée de `CRON_SECRET` À DESSEIN : les
   liens de désinscription vivent dans des mails déjà distribués, parfois depuis
   des mois. Si la clé bougeait avec le secret d'exploitation, faire tourner
   celui-ci casserait silencieusement le « me désinscrire » de tous les mails
   déjà partis. `UNSUBSCRIBE_SECRET` ne doit donc JAMAIS être modifiée.

   La vérification accepte aussi les clés de repli, pour que les liens émis
   avant l'introduction de cette variable continuent de fonctionner. */
function tokenFor(email: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(email.trim().toLowerCase()).digest("hex").slice(0, 20);
}

function unsubSecrets(): string[] {
  const list = [process.env.UNSUBSCRIBE_SECRET, process.env.CRON_SECRET, "klip-dev-secret"];
  return Array.from(new Set(list.filter((s): s is string => !!s)));
}

export function unsubToken(email: string): string {
  return tokenFor(email, unsubSecrets()[0]);
}

/** Vrai si le jeton correspond à l'email pour l'une des clés connues. */
export function verifyUnsubToken(email: string, token: string): boolean {
  if (!email || !token) return false;
  return unsubSecrets().some(secret => {
    const expected = tokenFor(email, secret);
    // timingSafeEqual exige des longueurs égales, sinon il lève.
    if (token.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  });
}

export function unsubUrl(email: string): string {
  const e = email.trim().toLowerCase();
  return `${APP_URL}/api/waitlist/unsubscribe?e=${encodeURIComponent(e)}&t=${unsubToken(e)}`;
}

export async function sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log("[email] RESEND_API_KEY absent — e-mail ignoré:", subject, "→", to);
    return false;
  }
  // Le lien de désinscription dépend du destinataire : les gabarits posent un
  // marqueur, on le résout ici pour que tous les modèles en héritent.
  const resolve = (s: string) =>
    s.replace(/\{\{UNSUB_URL\}\}/g, unsubUrl(to))
     .replace(/\{\{EMAIL_ENC\}\}/g, encodeURIComponent(to.trim().toLowerCase()));
  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to,
        subject,
        html: resolve(html),
        // Envoyer le HTML seul est un signal négatif pour les filtres : les
        // modèles qui fournissent une version texte la joignent en alternative.
        ...(text ? { text: resolve(text) } : {}),
        ...(REPLY_TO ? { reply_to: REPLY_TO } : {}),
      }),
    });
    if (!res.ok) {
      console.error("[email] Resend error:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] fetch error:", err);
    return false;
  }
}

/* ── Vocabulaire visuel de la DA landing v3 ───────────────────────────────────
   Les webfonts (Archivo, Oaks via Typekit) ne se chargent pas dans Gmail : les
   piles se replient sur Helvetica et Georgia. C'est voulu — le mot accent reste
   une serif surlignée en leaf, exactement la règle typo de la landing. */
const F_DISPLAY = `'Archivo','Helvetica Neue',Helvetica,Arial,sans-serif`;
const F_OAKS = `'oaks',Georgia,'Times New Roman',serif`;
const F_SANS = `-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;

/** Mot accent en Oaks surligné leaf — la signature typo de la landing v3. */
export const hl = (word: string) =>
  `<span style="font-family:${F_OAKS};font-weight:700;font-style:normal;background:#BDF2A0;color:#1E3317;border-radius:12px;padding:.04em .22em .12em;white-space:nowrap;">${word}</span>`;

/** Ruban leaf — reprise du bandeau défilant de la landing (figé, forcément). */
const RIBBON = `
  <div style="background:#BDF2A0;color:#1E3317;padding:10px 12px;text-align:center;white-space:nowrap;overflow:hidden;">
    <span style="font-family:${F_DISPLAY};font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">Créer</span>
    <span style="color:#1E3317;opacity:.5;padding:0 8px;">&#10022;</span>
    <span style="font-family:${F_OAKS};font-size:14px;font-style:italic;font-weight:700;">Rédiger</span>
    <span style="color:#1E3317;opacity:.5;padding:0 8px;">&#10022;</span>
    <span style="font-family:${F_DISPLAY};font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">Planifier</span>
    <span style="color:#1E3317;opacity:.5;padding:0 8px;">&#10022;</span>
    <span style="font-family:${F_OAKS};font-size:14px;font-style:italic;font-weight:700;">Valider</span>
    <span style="color:#1E3317;opacity:.5;padding:0 8px;">&#10022;</span>
    <span style="font-family:${F_DISPLAY};font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">Publier</span>
  </div>`;

const FONT_LINK = `<style>@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@700;800;900&display=swap');</style>`;

/** Capture réelle du hero de getklip.fr/fr (1080px, soit 2x la carte : net sur retina).
    Regénérable avec le script de capture ; toute refonte de la landing la périme.
    Réservée aux mails 3 et 4, qui montrent le produit : le mail 1 est volontairement
    en texte nu (voir `letter`), une image l'enverrait dans l'onglet Promotions. */
const HERO_BANNER = `
  <a href="${APP_URL}" style="display:block;margin:30px 0 4px;text-decoration:none;">
    <img src="${APP_URL}/klip-media/hero-site.jpg" alt="La page d'accueil de Klip : tous vos clients, un seul outil"
         width="540" style="display:block;width:100%;max-width:540px;height:auto;border:0;border-radius:20px;" />
  </a>`;

/* ── Gabarit marque ──────────────────────────────────────────────────────────
   Fond forest + carte blanche, comme le hero de la landing d'accès anticipé.
   `title` accepte du HTML : passer un mot dans hl() pour le surligner. */
function shell(title: string, bodyHtml: string, cta?: { label: string; href: string }): string {
  const LOGO = `${APP_URL}/logo-klip-mint.png`;
  return `${FONT_LINK}
  <div style="background:#0C2A1D;padding:40px 16px;font-family:${F_SANS};">
    <div style="max-width:540px;margin:0 auto;">
      <!-- Header -->
      <div style="text-align:center;padding:8px 0 26px;">
        <img src="${LOGO}" alt="Klip" height="30" style="height:30px;width:auto;display:inline-block;" />
      </div>
      <!-- Card -->
      <div style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 30px 60px -30px rgba(0,0,0,.5);">
        ${RIBBON}
        <div style="padding:34px 34px 30px;">
          <h1 style="margin:0 0 18px;font-family:${F_DISPLAY};font-size:29px;line-height:1.12;color:#14160F;letter-spacing:-.035em;font-weight:800;">${title}</h1>
          <div style="font-size:15.5px;line-height:1.7;color:#5A5E50;">${bodyHtml}</div>
          ${cta ? `<div style="margin-top:28px;"><a href="${cta.href}" style="display:inline-block;background:#BDF2A0;color:#1E3317;font-family:${F_DISPLAY};font-weight:800;font-size:15px;text-decoration:none;padding:15px 28px;border-radius:999px;">${cta.label} &nbsp;&#8599;</a></div>` : ""}
        </div>
        <div style="padding:18px 34px;border-top:1px solid rgba(13,15,10,.08);font-size:12.5px;color:#8B8E7F;">
          KLIP — l'outil tout-en-un pour gérer l'Instagram de tous vos clients.
        </div>
      </div>
      <!-- Footer -->
      <div style="text-align:center;padding:22px 0 4px;font-size:12px;color:rgba(238,237,227,.5);">
        Vous recevez cet email car vous êtes inscrit·e sur Klip · <a href="${APP_URL}" style="color:#BDF2A0;text-decoration:none;">getklip.fr</a><br/>
        <a href="{{UNSUB_URL}}" style="color:rgba(238,237,227,.5);text-decoration:underline;">Ne plus recevoir ces emails</a>
      </div>
    </div>
  </div>`;
}

/* ── Gabarit « écrit à la main » ───────────────────────────────────────────────
   Pour les mails de contenu : pas de carte, pas de bouton géant, ça ressemble à
   un vrai message tapé par un humain — c'est ce qui fait répondre les gens. */
function plain(bodyHtml: string, cta?: { label: string; href: string }, afterCta?: string): string {
  return `${FONT_LINK}
  <div style="background:#FBFBFC;padding:30px 16px 34px;font-family:${F_SANS};">
    <div style="max-width:520px;margin:0 auto;font-size:16px;line-height:1.72;color:#14160F;">
      <div style="padding-bottom:26px;">
        <a href="${APP_URL}" style="text-decoration:none;">
          <img src="${APP_URL}/logo-klip-dark.png" alt="Klip" height="26" style="height:26px;width:auto;border:0;display:block;" />
        </a>
      </div>
      ${bodyHtml}
      ${cta ? `<div style="margin:28px 0 24px;"><a href="${cta.href}" style="display:inline-block;background:#BDF2A0;color:#1E3317;font-family:${F_DISPLAY};font-weight:800;font-size:15.5px;letter-spacing:-.01em;text-decoration:none;padding:16px 30px;border-radius:999px;box-shadow:0 12px 26px -14px rgba(120,190,90,.9);">${cta.label} &nbsp;&#8599;</a></div>` : ""}
      ${afterCta ?? ""}
      <div style="margin-top:34px;padding-top:18px;border-top:1px solid rgba(13,15,10,.10);font-size:12px;line-height:1.6;color:#8B8E7F;">
        Martin · <a href="${APP_URL}" style="color:#8B8E7F;">getklip.fr</a><br/>
        Vous recevez ce mail car vous êtes sur la liste d'accès anticipé.
        <a href="{{UNSUB_URL}}" style="color:#8B8E7F;">Me retirer de la liste</a>.
      </div>
    </div>
  </div>`;
}

/** Un modèle rendu. `text` est la version texte nu envoyée en parallèle du HTML :
    sans elle, un mail HTML seul est un signal négatif pour les filtres. */
type Mail = { subject: string; html: string; text?: string };

/* ── Rendu « lettre » ────────────────────────────────────────────────────────
   L'allure d'un mail écrit à la main, pas d'une newsletter. Le fond reste blanc,
   sans carte ni bandeau, et la seule image est le logo posé dans la signature,
   là où on l'attend dans un vrai mail. Ce qui envoie un message en Promotions,
   c'est le bandeau pleine largeur, le fond coloré et le gros bouton rond — pas
   une signature ni un lien mis en valeur.

   Le sondage est le seul lien du corps : ni renvoi vers la home, ni pied de page
   de désinscription. C'est un choix explicite de Martin, pour que le message
   passe pour un mail personnel — il n'y a donc AUCUN mécanisme de désabonnement
   sur les modèles rendus ici, ni lien ni en-tête `List-Unsubscribe`, et les
   destinataires n'ont que la réponse au mail pour se retirer. Les gabarits
   `plain` et `shell` gardent, eux, leur lien de désinscription.

   Le bouton est volontairement discret — angles à 8px, pas de relief, pas de
   pleine largeur. Le grossir, c'est reprendre le risque de l'onglet Promotions. */
function letter(bodyHtml: string): string {
  return `<div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15.5px;line-height:1.65;color:#1F1F1F;max-width:600px;">
${bodyHtml}
      <p style="margin:26px 0 0;">
        <img src="${APP_URL}/logo-klip-dark.png" alt="Klip" height="20" style="height:20px;width:auto;border:0;vertical-align:middle;" />
        <span style="font-size:13px;color:#777777;vertical-align:middle;padding-left:9px;">Martin — je construis Klip</span>
      </p>
</div>`;
}

/** Lien d'action de la lettre : assez visible pour se voir, assez sobre pour ne
    pas ressembler à un bouton de campagne marketing. */
const softButton = (label: string, href: string) =>
  `<a href="${href}" style="display:inline-block;background:#BDF2A0;color:#1E3317;font-weight:700;font-size:15px;text-decoration:none;padding:11px 20px;border-radius:8px;">${label}</a>`;

/* ── Modèles ─────────────────────────────────────────────────────────────── */
export const emails = {
  welcome: () => ({
    subject: "Bienvenue sur KLIP — votre essai a démarré",
    html: shell(
      "Bienvenue 👋",
      `Votre espace KLIP est prêt et votre <strong>essai gratuit de 7 jours</strong> vient de démarrer. Importez vos visuels, générez vos légendes par IA et planifiez vos publications — pour tous vos clients, au même endroit.`,
      { label: "Ouvrir mon tableau de bord", href: `${APP_URL}/dashboard` }
    ),
  }),
  trialReminder: (daysLeft: number) => ({
    subject: `Il vous reste ${daysLeft} jour${daysLeft > 1 ? "s" : ""} d'essai sur KLIP`,
    html: shell(
      `Plus que ${daysLeft} jour${daysLeft > 1 ? "s" : ""} d'essai`,
      `Votre essai gratuit se termine bientôt. Pour continuer à gérer vos clients sans interruption, choisissez une offre — sans engagement, résiliable à tout moment.`,
      { label: "Choisir mon offre", href: `${APP_URL}/abonnement` }
    ),
  }),
  trialEnded: () => ({
    subject: "Votre essai KLIP est terminé",
    html: shell(
      "Votre essai est arrivé à terme",
      `Votre essai gratuit de 7 jours est terminé. Vos données sont conservées : choisissez une offre pour reprendre là où vous vous êtes arrêté.`,
      { label: "Reprendre avec une offre", href: `${APP_URL}/abonnement` }
    ),
  }),
  clientApproved: (postLabel: string, clientName?: string) => ({
    subject: `✅ ${clientName || 'Votre client'} a approuvé un post`,
    html: shell(
      "Post approuvé par le client 🎉",
      `Bonne nouvelle : <strong>${clientName || 'votre client'}</strong> vient d'approuver le post <strong>« ${postLabel} »</strong>.<br/><br/>Il est prêt à être programmé/publié.`,
      { label: "Voir le calendrier", href: `${APP_URL}/calendar` }
    ),
  }),
  clientRevision: (postLabel: string, comment: string, clientName?: string) => ({
    subject: `✍️ ${clientName || 'Votre client'} demande une modification`,
    html: shell(
      "Modification demandée par le client",
      `<strong>${clientName || 'Votre client'}</strong> a demandé une modification sur <strong>« ${postLabel} »</strong> :<br/><br/>
       <span style="display:block;background:#FEF3C7;border-left:3px solid #F59E0B;border-radius:8px;padding:12px 14px;color:#92400E;font-style:italic;">${comment}</span>`,
      { label: "Voir le post", href: `${APP_URL}/calendar` }
    ),
  }),
  waitlistConfirm: () => ({
    subject: "C'est noté, vous êtes sur la liste d'accès anticipé Klip 🎉",
    html: shell(
      "Vous êtes bien inscrit·e !",
      `Merci d'avoir rejoint la <strong>liste d'accès anticipé de Klip</strong>.<br/><br/>
       On vous prévient <strong>par email dès l'ouverture</strong>, avant tout le monde, avec vos avantages réservés aux premiers : <strong>accès prioritaire</strong>, <strong>tarif fondateur</strong> et <strong>onboarding offert</strong>.<br/><br/>
       À très vite 👋`
    ),
  }),
  launch: () => ({
    subject: "🚀 Klip est ouvert, votre accès anticipé est prêt",
    html: shell(
      "Ça y est, Klip ouvre ses portes !",
      `Vous étiez sur la liste d'accès anticipé : <strong>bienvenue parmi les premiers</strong>.<br/><br/>
       Gérez l'Instagram de tous vos clients au même endroit : création de visuels, IA, calendrier, validation client, publication.<br/><br/>
       Vos <strong>avantages d'accès anticipé</strong> (tarif fondateur + onboarding offert) vous attendent. Cliquez ci-dessous pour créer votre compte.`,
      { label: "Activer mon accès anticipé", href: `${APP_URL}/register` }
    ),
  }),
  /* ── Séquence pré-ouverture (1 mail / semaine, voir `sequence` plus bas) ──── */

  // S1 — Prise de contact. Objectif unique : faire remplir le sondage.
  // Rendu en texte nu (`letter`) : ce mail se présente comme écrit à la main, il
  // doit en avoir l'air. Habillé, il partait dans l'onglet Promotions de Gmail.
  nurture1: (): Mail => {
    const survey = `${APP_URL}/sondage?e={{EMAIL_ENC}}`;
    return {
      subject: "Vous êtes là avant tout le monde",
      html: letter(
        `      <p style="margin:0 0 15px;">Salut,</p>
      <p style="margin:0 0 15px;">Je suis Martin, je construis Klip.</p>
      <p style="margin:0 0 15px;">Vous faites partie des premiers inscrits sur la liste d'accès anticipé. Assez peu nombreux pour que je vous écrive à la main plutôt que de vous envoyer une newsletter automatique, alors autant en profiter.</p>
      <p style="margin:0 0 15px;">Klip ouvre dans un peu moins d'un mois. Le logiciel est en finalisation, je suis sur les derniers réglages.</p>
      <p style="margin:0 0 15px;">D'ici là, j'aimerais savoir à qui je parle.</p>
      <p style="margin:0 0 15px;">Qui vous êtes, ce que vous gérez aujourd'hui, et surtout ce qui vous a donné envie de vous inscrire. J'ai mis ça en 5 questions, deux minutes, pas une de plus. Ça me permet de vous montrer les bonnes choses d'ici l'ouverture, et de vous accompagner correctement au démarrage plutôt que de vous lâcher devant un écran vide.</p>
      <p style="margin:0 0 15px;">C'est par ici :</p>
      <p style="margin:0 0 22px;">${softButton("Répondre aux 5 questions", survey)}</p>
      <p style="margin:0 0 15px;">Si on n'a pas encore eu l'occasion d'échanger sur ce que vous faites, c'est le bon moment. Et si on s'est déjà parlé, par message ou sur Instagram, n'hésitez pas à y répondre quand même : ça me permet de tout retrouver au même endroit le jour de l'ouverture.</p>
      <p style="margin:0 0 15px;">Et si le formulaire vous saoule : répondez juste à ce mail en me racontant votre semaine type. Je lis tout, je réponds à tout.</p>
      <p style="margin:0 0 15px;">À bientôt,<br/>Martin</p>`
      ),
      text: `Salut,

Je suis Martin, je construis Klip.

Vous faites partie des premiers inscrits sur la liste d'accès anticipé. Assez peu nombreux pour que je vous écrive à la main plutôt que de vous envoyer une newsletter automatique, alors autant en profiter.

Klip ouvre dans un peu moins d'un mois. Le logiciel est en finalisation, je suis sur les derniers réglages.

D'ici là, j'aimerais savoir à qui je parle.

Qui vous êtes, ce que vous gérez aujourd'hui, et surtout ce qui vous a donné envie de vous inscrire. J'ai mis ça en 5 questions, deux minutes, pas une de plus. Ça me permet de vous montrer les bonnes choses d'ici l'ouverture, et de vous accompagner correctement au démarrage plutôt que de vous lâcher devant un écran vide.

C'est par ici : ${survey}

Si on n'a pas encore eu l'occasion d'échanger sur ce que vous faites, c'est le bon moment. Et si on s'est déjà parlé, par message ou sur Instagram, n'hésitez pas à y répondre quand même : ça me permet de tout retrouver au même endroit le jour de l'ouverture.

Et si le formulaire vous saoule : répondez juste à ce mail en me racontant votre semaine type. Je lis tout, je réponds à tout.

À bientôt,
Martin`,
    };
  },

  // S2 — Valeur pure. Zéro vente, zéro produit. On donne, c'est tout.
  nurture2: () => ({
    subject: "Le problème n'est jamais la création",
    html: plain(
      `<p style="margin:0 0 16px;">Salut,</p>
       <p style="margin:0 0 16px;">Cette semaine, pas de Klip. Juste un constat que presque tous les community managers à qui j'ai parlé m'ont répété, avec les mêmes mots.</p>
       <p style="margin:0 0 16px;"><strong>Le problème n'est jamais la création. C'est de retrouver.</strong></p>
       <p style="margin:0 0 16px;">Vous savez faire un beau post. Ce qui vous mange vos soirées, c'est de retrouver le logo du client, sa palette, la police qu'il aime, le visuel validé il y a trois semaines, le fichier « FINAL_v3_vraiment_final.psd ». Multiplié par six clients.</p>
       <p style="margin:0 0 16px;">Trois choses qui changent tout, à mettre en place ce week-end :</p>
       <p style="margin:0 0 14px;"><strong>1. Une charte par client, écrite une seule fois.</strong><br/>
       Pas dans votre tête : dans un document. Trois couleurs en hexa, deux polices, cinq mots que la marque dit, cinq mots qu'elle ne dit jamais. Vous ne redécidez plus jamais. Le gain n'est pas le temps de recherche, c'est de ne plus avoir à trancher à 23 h.</p>
       <p style="margin:0 0 14px;"><strong>2. Batchez par étape, pas par post.</strong><br/>
       Ne faites pas « post 1 de A à Z, puis post 2 de A à Z ». Faites tous les visuels d'affilée, puis toutes les légendes d'affilée, puis toute la programmation. Changer de type de tâche coûte beaucoup plus cher que changer de client.</p>
       <p style="margin:0 0 16px;"><strong>3. Un seul canal de validation.</strong><br/>
       Le jour où la validation passe par WhatsApp <em>plus</em> mail <em>plus</em> vocal, c'est perdu. Un lien, une page, un « ok » ou un commentaire écrit. Et une règle annoncée au client : ce qui n'est pas écrit là n'existe pas.</p>
       <p style="margin:0 0 16px;">Rien de tout ça ne demande un outil. Mais si vous vous demandez ce que je construis : Klip, c'est exactement ces trois points, en automatique.</p>
       <p style="margin:0 0 16px;">La semaine prochaine, je vous ouvre le capot, captures à l'appui.</p>
       <p style="margin:0 0 16px;">Martin</p>
       <p style="margin:0;font-size:14.5px;color:#5A5E50;"><em>PS. Si vous n'avez pas encore répondu aux 5 questions, c'est <a href="${APP_URL}/sondage?e={{EMAIL_ENC}}" style="color:#14160F;">par ici</a>. On est un tout petit groupe : chaque réponse pèse lourd.</em></p>`
    ),
  }),

  // S3 — Le produit + l'annonce de la date. Gabarit marque, plus léché.
  nurture3: () => ({
    subject: "L'intérieur de Klip (et la date d'ouverture)",
    html: shell(
      `Ce que vous allez avoir ${hl("entre les mains")}`,
      `Comme promis, j'ouvre le capot. Klip, c'est <strong>un seul espace pour gérer l'Instagram de tous vos clients</strong> :
       <br/><br/>
       <strong>· Un espace par client.</strong> Charte, ton de voix, historique. Vous changez de client d'un clic, et l'outil change de voix avec vous.<br/><br/>
       <strong>· Un éditeur visuel</strong> type Canva/Adobe, sauf qu'il connaît déjà les couleurs et les polices de la marque.<br/><br/>
       <strong>· Des légendes IA</strong> écrites dans la voix du client, pas dans celle d'un robot.<br/><br/>
       <strong>· Un calendrier et une validation client sur un lien.</strong> Fini les allers-retours WhatsApp.<br/><br/>
       <strong>· La publication Instagram directe</strong>, programmée à l'heure que vous voulez.
       <br/><br/>
       <span style="display:block;background:#F1F2F5;border-radius:12px;padding:16px 18px;">
         <strong style="color:#14160F;">Ouverture : dans deux semaines.</strong><br/>
         Vous recevrez le lien avant tout le monde. Et parce que vous étiez là avant : <strong>accès prioritaire</strong>, <strong>tarif fondateur bloqué à vie</strong> et <strong>onboarding en visio avec moi, offert</strong>.
       </span>`,
      { label: "Voir Klip en détail", href: `${APP_URL}/acces-anticipe` }
    ),
  }),

  // S4 — Ouverture.
  nurture4: () => ({
    subject: "C'est ouvert, votre accès anticipé est prêt 🚀",
    html: shell(
      `Klip ${hl("ouvre ses portes")}`,
      `Ça y est. Vous étiez sur la liste avant tout le monde : <strong>votre accès est actif</strong>.
       <br/><br/>
       Créez votre compte avec l'email qui reçoit ce message, et vos avantages fondateurs s'appliquent automatiquement :
       <br/><br/>
       <strong>· Tarif fondateur, bloqué à vie</strong> : il n'augmentera jamais pour vous, quoi qu'il arrive aux tarifs publics.<br/><br/>
       <strong>· Onboarding en visio, offert</strong> : trente minutes avec moi pour paramétrer vos premiers clients ensemble.<br/><br/>
       <strong>· Une ligne directe</strong> : vous répondez à ce mail, ça tombe sur ma boîte.
       <br/><br/>
       Merci d'avoir attendu. Sincèrement : sur une liste aussi courte, chaque inscription a compté.`,
      { label: "Activer mon accès anticipé", href: `${APP_URL}/register` }
    ),
  }),

  // S4 + 3 jours — relance courte pour ceux qui n'ont pas encore créé leur compte.
  nurture5: () => ({
    subject: "Je vous garde votre place jusqu'à dimanche",
    html: plain(
      `<p style="margin:0 0 16px;">Salut,</p>
       <p style="margin:0 0 16px;">Klip est ouvert depuis trois jours et je vois que vous n'avez pas encore activé votre accès. Aucun souci, je sais ce que c'est, une semaine chargée.</p>
       <p style="margin:0 0 16px;">Je vous dis juste où on en est : <strong>le tarif fondateur reste réservé jusqu'à dimanche soir</strong>. Après, je bascule sur les tarifs publics et je ne pourrai plus le rattraper pour vous.</p>
       <p style="margin:0 0 16px;">Créer le compte prend une minute, et il y a sept jours d'essai, vous ne payez rien pour voir si ça vous va.</p>`,
      { label: "Activer mon accès", href: `${APP_URL}/register` },
      `<p style="margin:0 0 16px;">Et si Klip ne correspond pas à ce que vous cherchiez, répondez-moi en un mot pour me dire pourquoi. C'est l'info la plus utile que vous puissiez me donner.</p>
       <p style="margin:0;">Martin</p>`
    ),
  }),

  // Notification interne — un utilisateur vient de signaler un bug ou une idée.
  bugReport: (r: { kind: string; message: string; email?: string | null; pageUrl?: string | null }) => {
    const label = r.kind === 'idee' ? 'Idée' : r.kind === 'autre' ? 'Message' : 'Bug';
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return {
      subject: `[Klip] ${label} signalé${r.email ? ` par ${r.email}` : ''}`,
      html: shell(
        `${label} signalé`,
        `<span style="display:block;background:#F1F2F5;border-radius:12px;padding:14px 16px;white-space:pre-wrap;color:#14160F;">${esc(r.message)}</span>
         <br/>
         <strong>De&nbsp;:</strong> ${r.email ? esc(r.email) : 'utilisateur non connecté'}<br/>
         <strong>Page&nbsp;:</strong> ${r.pageUrl ? esc(r.pageUrl) : '—'}`,
      ),
    };
  },

  paymentConfirmed: (planLabel: string) => ({
    subject: "Votre abonnement KLIP est actif ✓",
    html: shell(
      "Merci, votre abonnement est actif",
      `Votre offre <strong>${planLabel}</strong> est désormais active. Bon travail sur KLIP&nbsp;! Vous pouvez gérer votre abonnement à tout moment depuis vos réglages.`,
      { label: "Aller au tableau de bord", href: `${APP_URL}/dashboard` }
    ),
  }),
};

/* ── Séquence pré-ouverture ───────────────────────────────────────────────────
   Un mail par semaine jusqu'à l'ouverture. Envoi via /api/waitlist/campaign?n=X
   (voir la route pour le mode aperçu / test / envoi réel). */
export const sequence: { n: number; when: string; goal: string; tpl: () => Mail }[] = [
  { n: 1, when: "S1 — maintenant",        goal: "Se présenter et faire remplir le sondage", tpl: emails.nurture1 },
  { n: 2, when: "S2 — +7 jours",          goal: "Donner de la valeur, sans rien vendre",    tpl: emails.nurture2 },
  { n: 3, when: "S3 — +14 jours",         goal: "Montrer le produit et annoncer la date",   tpl: emails.nurture3 },
  { n: 4, when: "S4 — jour d'ouverture",  goal: "Faire créer le compte",                    tpl: emails.nurture4 },
  { n: 5, when: "S4 + 3 jours",           goal: "Relancer ceux qui n'ont pas activé",       tpl: emails.nurture5 },
] as const;

export const sequenceStep = (n: number) => sequence.find(s => s.n === n) ?? null;
