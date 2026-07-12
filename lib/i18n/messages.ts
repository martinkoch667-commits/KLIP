// Chargement des catalogues de traduction. Import statique des 6 langues (les
// fichiers sont petits et le bundling statique évite tout aléa de résolution
// dynamique de chemin au build). getMessages() renvoie le catalogue de la langue
// demandée, avec repli sur le français si absent.
import type { Locale } from './config';
import { DEFAULT_LOCALE } from './config';

import fr from '@/messages/fr.json';
import en from '@/messages/en.json';
import es from '@/messages/es.json';
import de from '@/messages/de.json';
import it from '@/messages/it.json';
import pt from '@/messages/pt.json';

type Messages = typeof fr;

const CATALOGS: Record<Locale, Messages> = { fr, en, es, de, it, pt };

export function getMessages(locale: Locale): Messages {
  return CATALOGS[locale] ?? CATALOGS[DEFAULT_LOCALE];
}
