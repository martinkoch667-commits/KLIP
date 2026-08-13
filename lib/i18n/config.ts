// Configuration i18n centrale de KLIP.
// Système sans routing par URL : la langue active est portée par un cookie
// (klip-locale), lue côté serveur dans app/layout.tsx pour alimenter le
// NextIntlClientProvider. Ajouter une langue = ajouter son code ici + le fichier
// messages/<code>.json correspondant (aucun autre changement de code requis).

export const LOCALES = ['fr', 'en', 'es', 'de', 'it', 'pt'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'fr';

export const LOCALE_COOKIE = 'klip-locale';

// Libellés affichés dans le sélecteur — chaque langue dans sa propre langue
// (endonyme), plus un drapeau pour repérage visuel rapide.
export const LOCALE_LABELS: Record<Locale, { name: string; flag: string }> = {
  fr: { name: 'Français', flag: '🇫🇷' },
  en: { name: 'English', flag: '🇬🇧' },
  es: { name: 'Español', flag: '🇪🇸' },
  de: { name: 'Deutsch', flag: '🇩🇪' },
  it: { name: 'Italiano', flag: '🇮🇹' },
  pt: { name: 'Português', flag: '🇵🇹' },
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
