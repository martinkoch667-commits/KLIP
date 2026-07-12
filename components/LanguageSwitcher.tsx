'use client';

// Sélecteur de langue. Écrit le cookie klip-locale (lu côté serveur dans
// app/layout.tsx pour choisir le catalogue), puis recharge la page pour que le
// provider next-intl se réinitialise avec les nouveaux messages. Le rechargement
// complet garantit qu'aucun texte d'une ancienne langue ne subsiste.
import { useLocale } from 'next-intl';
import { LOCALES, LOCALE_LABELS, LOCALE_COOKIE, type Locale } from '@/lib/i18n/config';

export function LanguageSwitcher({ className }: { className?: string }) {
  const current = useLocale() as Locale;

  function change(next: string) {
    if (next === current) return;
    // 1 an, tout le site.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    window.location.reload();
  }

  return (
    <select
      className={className}
      value={current}
      onChange={(e) => change(e.target.value)}
      aria-label="Language"
    >
      {LOCALES.map((loc) => (
        <option key={loc} value={loc}>
          {LOCALE_LABELS[loc].flag} {LOCALE_LABELS[loc].name}
        </option>
      ))}
    </select>
  );
}
