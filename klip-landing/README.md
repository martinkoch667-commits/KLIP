# KLIP — Landing page (export autonome)

Dossier complet et autonome de la landing KLIP. Aucune dépendance à Next.js :
il fonctionne tout seul, sur n'importe quel hébergeur ou en local.

## Comment l'ouvrir
- **En local** : double-clique sur `index.html` (il s'ouvre dans ton navigateur).
- **En ligne** : dépose le dossier entier sur n'importe quel hébergeur statique
  (Netlify, Vercel, OVH, o2switch, GitHub Pages…). La page d'accueil est `index.html`.

## Arborescence
```
klip-landing/
├── index.html              ← la page (structure + contenu)
├── css/
│   └── style.css           ← tout le design (couleurs, typo, mise en page)
├── js/
│   └── main.js             ← interactions (menu, FAQ, toggle prix, animations)
├── assets/
│   └── images/
│       ├── logo-dark.png       logo KLIP foncé (fond clair)
│       ├── logo-mint.png       logo KLIP vert (fond foncé)
│       ├── favicon-32.png      icône d'onglet
│       ├── dashboard.png       capture — hero
│       ├── editeur.png         capture — éditeur visuel
│       ├── calendrier.png      capture — calendrier éditorial
│       ├── publication.png     capture — file de publication
│       └── montage.png         capture — montage vidéo
└── README.md               ← ce fichier
```

## Modifier facilement
- **Le texte** → `index.html` (tout est en clair, en français).
- **Les couleurs / le style** → `css/style.css`, section `:root` en haut (variables).
- **Les images** → remplace un fichier dans `assets/images/` en gardant le même nom.
- **Les prix** → dans `index.html`, section « TARIFS » (attributs `data-m` mensuel /
  `data-y` annuel).

## Note sur les polices
Les polices (Archivo, Fraunces, Hanken Grotesk) se chargent depuis Google Fonts,
donc le rendu exact nécessite une connexion internet. Sans connexion, la page
reste lisible avec des polices de secours. Pour un rendu 100 % hors-ligne, il
faut télécharger les polices en `.woff2` et les servir depuis `assets/fonts/`.
