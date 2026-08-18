# Gabarits des e-mails d'authentification (Supabase)

Ces mails-là ne partent pas par `lib/email.ts` : c'est **Supabase Auth** qui les
envoie, à partir de gabarits stockés dans son tableau de bord. D'où le mail
anglais sans charte tant qu'on ne les remplace pas. Les fichiers de ce dossier
sont la version de référence, versionnée avec le code ; le tableau de bord n'en
est qu'une copie.

## Où les coller

Supabase → **Authentication → Emails → Templates**, puis pour chaque gabarit :
coller le contenu du fichier dans le champ **Message body (HTML)** et remplacer
l'objet.

| Gabarit Supabase | Fichier | Objet à mettre |
|---|---|---|
| Confirm signup | `confirm-signup.html` | `Confirmez votre adresse pour activer votre compte KLIP` |
| Reset Password | `reset-password.html` | `Votre nouveau mot de passe KLIP` |

Les autres gabarits (Magic Link, Invite user, Change Email Address,
Reauthentication) ne sont pas utilisés par l'app aujourd'hui : aucun écran
n'appelle `signInWithOtp` ni le changement d'adresse. Le jour où l'un d'eux
sert, partir de `confirm-signup.html` et n'adapter que le titre, le texte et le
libellé du bouton.

## Règles à respecter en modifiant

- **`{{ .ConfirmationURL }}`** est la variable Supabase, en syntaxe Go. Elle
  apparaît deux fois : sur le bouton et sur le lien de repli en clair. Garder
  les deux : une partie des clients de messagerie d'entreprise neutralisent les
  boutons, le lien nu est alors la seule porte de sortie.
- **URLs d'images absolues** (`https://getklip.fr/...`). Un chemin relatif ne
  veut rien dire dans une boîte mail.
- **Pas de lien de désinscription** : ce sont des mails transactionnels. On ne
  se désabonne pas de la confirmation de sa propre inscription, et le proposer
  ferait perdre le lien à qui cliquerait dessus.
- **Tables pour l'ossature, le fond et le bouton.** Outlook ignore le fond d'un
  `<div>` (carte blanche sur fond blanc) et mange le `padding` d'un `<a>`
  (bouton réduit à son texte). Le reste peut rester en `<div>`.
- **Fidélité à l'app, pas à la landing.** Ces mails sont des mails de compte :
  ils reprennent l'écran que l'utilisateur vient de quitter (`/register`) et
  celui où il arrive (le tableau de bord). D'où le fond canvas `#F3F4F7`, la
  carte blanche à 16px, le logo `logo-klip-dark.png` à 40px comme sur la carte
  d'inscription, et le bandeau forest avec surtitre mint + mot accent en oaks
  italique, soit la structure exacte du bandeau d'accueil du tableau de bord.
- **Pas de dégradé.** Le halo vert du bandeau produit n'existe pas ici : Gmail
  et Outlook ignorent les gradients CSS. L'aplat forest `#0C2A1D` porte
  l'identité tout seul, avec `bgcolor` en plus du `style` pour Outlook.
- **Un seul vert dans le bandeau : le leaf `#BDF2A0`.** C'est le vert du
  surlignage de la landing, donc surtitre et bouton s'alignent dessus. Le mint
  `#2FD79B` du tableau de bord a été écarté : deux verts proches dans le même
  bandeau se lisent comme une erreur.
- **Liens sur blanc en `#21B381`.** Ni le leaf ni le mint ne sont lisibles en
  texte sur fond blanc ; `--mint-2` garde la famille de teinte en restant
  lisible.

### Palette utilisée

| Rôle | Valeur | Jeton |
|---|---|---|
| Fond du message | `#F3F4F7` | `--canvas` |
| Bandeau | `#0C2A1D` | `--forest` |
| Accent / bouton | `#BDF2A0` | `--leaf` |
| Texte sur bouton | `#1E3317` | `--leaf-ink` |
| Texte du bandeau | `#EEEDE3` | `--cream` |
| Liens sur blanc | `#21B381` | `--mint-2` |

## Prévisualiser

```bash
sed 's|{{ .ConfirmationURL }}|https://example.com/lien|g' \
  supabase/email-templates/confirm-signup.html > /tmp/apercu.html && open /tmp/apercu.html
```
