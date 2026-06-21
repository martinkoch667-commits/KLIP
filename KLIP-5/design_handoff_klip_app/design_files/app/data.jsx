/* data.jsx — KLIP app mock data: clients, brand kits, posts, activity */

const CLIENTS = [
  { id: 'lou',    name: 'Maison Lou',  handle: '@maisonlou',   industry: 'Restaurant',          color: '#1F7A4D', initials: 'ML', scheduled: 8,  pending: 2, followers: '12,4 k', following: 312, posts: 248, bio: 'Cuisine de saison · Paris 11e\nRéservations en ligne ↗', grad: 'linear-gradient(150deg,#2b8d57,#0c2a1d)' },
  { id: 'oreste', name: 'Café Oreste', handle: '@cafeoreste',  industry: 'Café · torréfacteur', color: '#C8732B', initials: 'CO', scheduled: 5,  pending: 0, followers: '8 932', following: 188, posts: 176, bio: 'Torréfacteur artisanal ☕\nGrains & espresso bar', grad: 'linear-gradient(150deg,#e0a05a,#7a4a16)' },
  { id: 'vel',    name: 'Studio Vél',  handle: '@studiovel',   industry: 'Atelier vélo',        color: '#2B5FE0', initials: 'SV', scheduled: 11, pending: 4, followers: '5 218', following: 421, posts: 132, bio: 'Atelier & réparation vélo\nMontreuil', grad: 'linear-gradient(150deg,#5a86e8,#1a2f6b)' },
  { id: 'brut',   name: 'Brut & Co',   handle: '@brutandco',   industry: 'Concept store',       color: '#222019', initials: 'BC', scheduled: 3,  pending: 1, followers: '21,7 k', following: 96, posts: 389, bio: 'Concept store · objets & éditions limitées', grad: 'linear-gradient(150deg,#4a463b,#15130e)' },
  { id: 'fab',    name: 'La Fabrique',  handle: '@lafabrique', industry: 'Boulangerie',         color: '#C4452F', initials: 'LF', scheduled: 6,  pending: 0, followers: '15,1 k', following: 204, posts: 301, bio: 'Boulangerie au levain\nFournée à 7h chaque matin', grad: 'linear-gradient(150deg,#d96a4a,#7a2417)' },
  { id: 'onde',   name: 'Onde',        handle: '@onde.studio', industry: 'Studio yoga',         color: '#5E8769', initials: 'ON', scheduled: 4,  pending: 3, followers: '6 745', following: 333, posts: 158, bio: 'Studio yoga & respiration 🌿\nCours du soir', grad: 'linear-gradient(150deg,#88b394,#2f4d38)' },
];

const STATUS = {
  draft:     { label: 'Brouillon',  fg: '#565A4E', bg: 'rgba(13,15,10,.07)' },
  pending:   { label: 'À valider',  fg: '#9A5B12', bg: 'rgba(200,115,43,.14)' },
  scheduled: { label: 'Planifié',   fg: '#0F5836', bg: 'rgba(31,122,77,.14)' },
  published: { label: 'Publié',     fg: '#0D0F0A', bg: 'var(--acid)' },
};

/* posts — spread across a reference week. day = 0..30 within "septembre" */
const POSTS = [
  { id: 'p1',  client: 'lou',    title: 'L’été se réserve maintenant', caption: 'La lumière de fin d’été sur nos tables. Nouvelle carte, réservations ouvertes pour septembre. ✦', day: 3,  time: '18:30', status: 'scheduled', tone: 'Chic',    grad: 'linear-gradient(150deg,#2b8d57,#0c2a1d)', big: true },
  { id: 'p2',  client: 'oreste', title: 'Nouvelle carte ↗',           caption: 'Septembre, on remet le couvert. Nouvelle sélection de grains, en boutique dès jeudi.', day: 4,  time: '08:00', status: 'scheduled', tone: 'Punchy',  grad: 'linear-gradient(150deg,#e0a05a,#7a4a16)' },
  { id: 'p3',  client: 'vel',    title: 'On recrute.',                  caption: 'Notre atelier s’agrandit. On cherche un·e mécanicien·ne passionné·e. Lien en bio.', day: 4,  time: '12:15', status: 'pending',   tone: 'Direct',  grad: 'linear-gradient(150deg,#5a86e8,#1a2f6b)' },
  { id: 'p4',  client: 'fab',    title: 'Pain du jour',                 caption: 'Le levain n’attend pas. Fournée de campagne à partir de 7h.', day: 5,  time: '07:30', status: 'scheduled', tone: 'Chaleureux', grad: 'linear-gradient(150deg,#d96a4a,#7a2417)' },
  { id: 'p5',  client: 'onde',   title: 'Respirez',                     caption: 'Nouveau cycle de cours du soir. Première séance offerte ce mardi.', day: 6,  time: '19:00', status: 'pending',   tone: 'Doux',    grad: 'linear-gradient(150deg,#88b394,#2f4d38)' },
  { id: 'p6',  client: 'lou',    title: 'Menu d’automne',               caption: 'Les premières courges arrivent en cuisine. Aperçu du menu d’automne.', day: 8,  time: '12:00', status: 'draft',     tone: 'Chic',    grad: 'linear-gradient(150deg,#3a6b48,#16261b)' },
  { id: 'p7',  client: 'vel',    title: 'Réparation express',           caption: 'Crevaison ? On vous remet en selle en 20 minutes, sans rendez-vous.', day: 9,  time: '17:00', status: 'scheduled', tone: 'Direct',  grad: 'linear-gradient(150deg,#3f6fd6,#13245a)' },
  { id: 'p8',  client: 'oreste', title: 'Atelier dégustation',          caption: 'Samedi matin : atelier découverte autour des cafés d’Éthiopie. 8 places.', day: 11, time: '10:00', status: 'scheduled', tone: 'Chic',    grad: 'linear-gradient(150deg,#caa14a,#6e4d1c)' },
  { id: 'p9',  client: 'brut',   title: 'Édition limitée',              caption: 'La collaboration est en ligne. Série numérotée, disponible en boutique.', day: 12, time: '11:00', status: 'pending',   tone: 'Minimal', grad: 'linear-gradient(150deg,#4a463b,#15130e)' },
  { id: 'p10', client: 'lou',    title: 'Soir de vendredi',             caption: 'Ambiance, vin nature et petites assiettes. On garde une table pour vous.', day: 13, time: '18:00', status: 'scheduled', tone: 'Chic',    grad: 'linear-gradient(150deg,#2b8d57,#0c2a1d)' },
  { id: 'p11', client: 'fab',    title: 'Brioche feuilletée',           caption: 'Le week-end commence ici. Quantités limitées, on vous attend.', day: 13, time: '08:30', status: 'published', tone: 'Chaleureux', grad: 'linear-gradient(150deg,#e07a5a,#8a2c1c)' },
  { id: 'p12', client: 'onde',   title: 'Week-end retraite',            caption: 'Une journée pour ralentir. Inscriptions ouvertes pour la retraite d’octobre.', day: 16, time: '09:00', status: 'draft',     tone: 'Doux',    grad: 'linear-gradient(150deg,#7aa687,#2f4d38)' },
];

const ACTIVITY = [
  { who: 'Camille',  what: 'a planifié', target: 'L’été se réserve maintenant', client: 'lou',    when: 'il y a 12 min' },
  { who: 'Yanis',    what: 'a généré une description pour', target: 'On recrute.', client: 'vel',  when: 'il y a 40 min' },
  { who: 'Klip',     what: 'a publié', target: 'Brioche feuilletée', client: 'fab', when: 'il y a 2 h', auto: true },
  { who: 'Léa',      what: 'a laissé un commentaire sur', target: 'Édition limitée', client: 'brut', when: 'il y a 3 h' },
  { who: 'Camille',  what: 'a créé un brouillon', target: 'Menu d’automne', client: 'lou', when: 'hier' },
];

const TONES = {
  Chic:       'La lumière de fin d’été sur nos tables. Nouvelle carte, réservations ouvertes pour septembre. ✦\n\n#maisonlou #artdevivre #septembre',
  Punchy:     'Septembre, on remet le couvert 🔥 Nouvelle carte, résa en bio — ça part vite.\n\n#maisonlou #foodie #septembre',
  Minimal:    'Septembre. Nouvelle carte. Réservez.\n\n#maisonlou',
  Chaleureux: 'On a hâte de vous retrouver autour de la nouvelle carte. Réservations ouvertes pour tout septembre 🌿\n\n#maisonlou #septembre',
};

const clientById = (id) => CLIENTS.find(c => c.id === id);
const DOW = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTH = 'Septembre 2026';

Object.assign(window, { CLIENTS, STATUS, POSTS, ACTIVITY, TONES, clientById, DOW, MONTH });
