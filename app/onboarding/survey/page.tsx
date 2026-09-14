"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import OnboardingShell from "@/components/OnboardingShell";
import AvisOrdinateur from "@/components/AvisOrdinateur";


export default function SurveyPage() {
  const t = useTranslations('onboardingSurvey');
  const supabase = createClientComponentClient();
  const router = useRouter();
  const [step, setStep] = useState(0);

  const QUESTIONS = [
    { q: t('q1'), choices: [t('q1c1'), t('q1c2'), t('q1c3'), t('q1c4')] },
    { q: t('q2'), choices: [t('q2c1'), t('q2c2'), t('q2c3'), t('q2c4')] },
    { q: t('q3'), choices: [t('q3c1'), t('q3c2'), t('q3c3'), t('q3c4')] },
    { q: t('q4'), choices: [t('q4c1'), t('q4c2'), t('q4c3'), t('q4c4')] },
  ];

  const [answers, setAnswers] = useState<(string | null)[]>(Array(QUESTIONS.length).fill(null));
  const [saving, setSaving] = useState(false);

  const current = QUESTIONS[step];
  const selected = answers[step];
  const isLast = step === QUESTIONS.length - 1;

  function select(choice: string) {
    setAnswers(prev => prev.map((a, i) => i === step ? choice : a));
  }

  async function advance() {
    if (isLast) {
      await finish();
    } else {
      setStep(s => s + 1);
    }
  }

  async function skip() {
    if (isLast) {
      await finish();
    } else {
      setStep(s => s + 1);
    }
  }

  async function finish() {
    setSaving(true);
    try {
      const filled = answers.map((a, i) => a ?? `skip:${i}`);
      await supabase.auth.updateUser({
        data: { onboarding_survey: filled },
      });
    } catch {
      // non-blocking
    }
    router.push("/dashboard?welcome=true");
  }

  /* Même case que le parcours d'essai (OnboardingShell) : juste après le
     paiement, l'ancien écran blanc sur fond beige cassait la continuité. */
  return (
    <OnboardingShell chemin="bienvenue" intro={
      <>
        <h1 className="ob-h1">{current.q}</h1>
        <p className="ob-sub">{t('questionOf', { step: step + 1, total: QUESTIONS.length })}</p>
        {step === 0 && <AvisOrdinateur fermable={false} style={{ marginTop: 14 }} />}
      </>
    } bas={
      <div className="ob-pied">
        <button className="ob-retour" onClick={skip} disabled={saving}>{t('skip')}</button>
        <button className="ob-suite" onClick={advance} disabled={!selected || saving}>
          {isLast ? (saving ? t('loading') : t('finish')) : t('next')}
        </button>
      </div>
    }>
      <div className="ob-chips">
        {current.choices.map(choice => (
          <button key={choice} type="button" className={"ob-chip" + (selected === choice ? " is-on" : "")}
            onClick={() => select(choice)}>
            {choice}
          </button>
        ))}
      </div>
    </OnboardingShell>
  );
}
