"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function RegisterPage() {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", agency: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          first_name: form.firstName,
          last_name: form.lastName,
          agency: form.agency,
        },
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  const fields: { name: keyof typeof form; label: string; type: string; placeholder: string; autoComplete: string }[] = [
    { name: "firstName", label: "Prénom", type: "text", placeholder: "Martin", autoComplete: "given-name" },
    { name: "lastName", label: "Nom", type: "text", placeholder: "Koch", autoComplete: "family-name" },
    { name: "email", label: "Email", type: "email", placeholder: "martin@agence.com", autoComplete: "email" },
    { name: "password", label: "Mot de passe", type: "password", placeholder: "8 caractères minimum", autoComplete: "new-password" },
    { name: "agency", label: "Nom de l'agence", type: "text", placeholder: "Studio Klip", autoComplete: "organization" },
  ];

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/">
            <span className="font-syne font-extrabold text-5xl tracking-tight">
              <span className="text-white">Kl</span>
              <span className="text-acid">ip</span>
            </span>
          </Link>
          <p className="mt-3 text-sm font-inter text-white/40">
            Créez votre compte et commencez à produire
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {fields.slice(0, 2).map((field) => (
              <div key={field.name}>
                <label htmlFor={field.name} className="block mb-1.5 text-xs font-inter font-medium text-white/50 uppercase tracking-wider">
                  {field.label}
                </label>
                <input
                  id={field.name} name={field.name} type={field.type} required
                  autoComplete={field.autoComplete} value={form[field.name]}
                  onChange={handleChange} placeholder={field.placeholder}
                  className="w-full bg-white/5 border border-white/10 rounded px-3 py-2.5 text-sm font-inter text-white placeholder-white/20 focus:border-acid outline-none transition-colors"
                />
              </div>
            ))}
          </div>

          {fields.slice(2).map((field) => (
            <div key={field.name}>
              <label htmlFor={field.name} className="block mb-1.5 text-xs font-inter font-medium text-white/50 uppercase tracking-wider">
                {field.label}
              </label>
              <input
                id={field.name} name={field.name} type={field.type} required
                autoComplete={field.autoComplete}
                minLength={field.name === "password" ? 8 : undefined}
                value={form[field.name]} onChange={handleChange} placeholder={field.placeholder}
                className="w-full bg-white/5 border border-white/10 rounded px-3.5 py-2.5 text-sm font-inter text-white placeholder-white/20 focus:border-acid outline-none transition-colors"
              />
            </div>
          ))}

          {error && (
            <p className="text-xs font-inter text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full py-3 rounded bg-acid text-black text-sm font-inter font-bold hover:bg-acid/90 disabled:opacity-60 transition-colors mt-2"
          >
            {loading ? "Création…" : "Créer mon compte"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm font-inter text-white/30">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-acid hover:underline font-medium">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}
