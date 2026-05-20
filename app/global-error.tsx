'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <h2>Une erreur critique est survenue</h2>
        <button onClick={() => reset()}>Réessayer</button>
      </body>
    </html>
  );
}
