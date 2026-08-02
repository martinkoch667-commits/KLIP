import type { Metadata } from 'next';
import SurveyView from './survey-view';

export const metadata: Metadata = {
  title: 'Aidez-moi à construire Klip — 5 questions',
  description: "Cinq questions aux premiers inscrits sur Klip pour orienter ce qui sera développé d'ici l'ouverture.",
  robots: { index: false, follow: false },
};

// Le lien envoyé par email porte ?e=<email> pour pré-remplir le champ.
export default function Page({ searchParams }: { searchParams: { e?: string } }) {
  const e = typeof searchParams?.e === 'string' ? searchParams.e.trim().toLowerCase() : '';
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : '';
  return <SurveyView initialEmail={valid} />;
}
