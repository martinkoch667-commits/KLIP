import { notFound } from 'next/navigation';

/* UN BANC D'ESSAI N'EXISTE PAS EN PRODUCTION.
 *
 * Ces pages servent à mesurer l'outil, pas à s'en servir : elles montrent des
 * témoins sabotés, des taux de rejet, la mécanique interne du juge. Laissées
 * ouvertes en ligne, elles seraient accessibles à qui connaît l'adresse — et
 * elles n'ont rien à y faire.
 *
 * Le rendu 404 est fait ICI, dans une mise en page de segment : le contrôle
 * s'applique à la page et à tout ce qui vivra sous elle, même écrit plus tard
 * par quelqu'un qui ignorerait cette règle.
 */
export default function BancLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound();
  return <>{children}</>;
}
