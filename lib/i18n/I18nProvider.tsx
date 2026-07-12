'use client';

// Fournit le contexte de traduction (next-intl) à tout l'arbre client.
// La langue + les messages sont résolus côté serveur dans app/layout.tsx (à
// partir du cookie klip-locale) et injectés ici, donc aucun flash de langue au
// chargement. Le changement de langue se fait via LanguageSwitcher (réécrit le
// cookie puis rafraîchit), pas via ce provider.
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import type { Locale } from './config';

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: AbstractIntlMessages;
  children: React.ReactNode;
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Europe/Paris">
      {children}
    </NextIntlClientProvider>
  );
}
