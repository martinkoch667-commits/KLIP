import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Page introuvable</h2>
      <Link href="/dashboard">Retour au dashboard</Link>
    </div>
  );
}
