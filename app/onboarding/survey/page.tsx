"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";

const SV_CSS = `
  .sv-wrap{min-height:100vh;background:var(--canvas);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;}
  .sv-logo{display:block;height:44px;width:auto;margin:0 auto 48px;}
  .sv-card{background:#fff;border-radius:20px;padding:40px 44px;width:100%;max-width:560px;box-shadow:0 2px 24px rgba(13,15,10,.07);}
  .sv-progress{display:flex;gap:6px;margin-bottom:36px;}
  .sv-bar{height:3px;flex:1;border-radius:99px;background:rgba(20,22,15,.1);transition:background .3s;}
  .sv-bar.done{background:var(--mint);}
  .sv-bar.active{background:var(--forest);}
  .sv-step{font-family:var(--sans);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(20,22,15,.4);margin-bottom:12px;}
  .sv-question{font-family:var(--display);font-weight:800;font-size:22px;color:var(--forest);letter-spacing:-.02em;line-height:1.2;margin-bottom:28px;}
  .sv-choices{display:flex;flex-direction:column;gap:10px;margin-bottom:32px;}
  .sv-choice{display:flex;align-items:center;gap:14px;padding:14px 18px;border-radius:12px;border:1.5px solid rgba(20,22,15,.12);background:#fff;cursor:pointer;text-align:left;font-family:var(--sans);font-size:14px;font-weight:600;color:var(--ink);transition:border-color .12s,background .12s;}
  .sv-choice:hover{border-color:var(--mint);background:var(--mint-soft);}
  .sv-choice.selected{border-color:var(--forest);background:rgba(12,42,29,.05);}
  .sv-choice-dot{width:18px;height:18px;border-radius:50%;border:2px solid rgba(20,22,15,.2);flex-shrink:0;display:grid;place-items:center;transition:border-color .12s,background .12s;}
  .sv-choice.selected .sv-choice-dot{border-color:var(--forest);background:var(--forest);}
  .sv-row{display:flex;align-items:center;justify-content:space-between;gap:12px;}
  .sv-skip{font-family:var(--sans);font-size:13px;font-weight:600;color:rgba(20,22,15,.4);background:none;border:none;cursor:pointer;padding:0;transition:color .12s;}
  .sv-skip:hover{color:var(--ink);}
  .sv-btn{padding:12px 28px;background:var(--forest);color:var(--canvas);font-family:var(--display);font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.06em;border-radius:8px;border:none;cursor:pointer;transition:background .15s,opacity .15s;}
  .sv-btn:hover:not(:disabled){background:var(--mint);color:var(--forest);}
  .sv-btn:disabled{opacity:.35;cursor:not-allowed;}
  .sv-btn-ghost{padding:12px 28px;background:transparent;color:rgba(20,22,15,.5);font-family:var(--display);font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.06em;border-radius:8px;border:1.5px solid rgba(20,22,15,.12);cursor:pointer;transition:border-color .12s,color .12s;}
  .sv-btn-ghost:hover{border-color:var(--ink);color:var(--ink);}
  @media(max-width:600px){
    .sv-wrap{padding:24px 16px;}
    .sv-card{padding:28px 20px;border-radius:14px;}
    .sv-question{font-size:18px;}
    .sv-choice{padding:12px 14px;font-size:13px;}
    .sv-btn{min-height:48px;padding:12px 20px;}
  }
`;

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
    router.push("/dashboard");
  }

  return (
    <div className="sv-wrap">
      <style dangerouslySetInnerHTML={{ __html: SV_CSS }} />

      <img src="/logo-klip-dark.png" alt="Klip" className="sv-logo"
        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />

      <div className="sv-card">
        {/* Progress bars */}
        <div className="sv-progress">
          {QUESTIONS.map((_, i) => (
            <div key={i} className={`sv-bar${i < step ? " done" : i === step ? " active" : ""}`} />
          ))}
        </div>

        <div className="sv-step">{t('questionOf', { step: step + 1, total: QUESTIONS.length })}</div>
        <div className="sv-question">{current.q}</div>

        <div className="sv-choices">
          {current.choices.map(choice => (
            <button
              key={choice}
              className={`sv-choice${selected === choice ? " selected" : ""}`}
              onClick={() => select(choice)}
            >
              <span className="sv-choice-dot">
                {selected === choice && (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                )}
              </span>
              {choice}
            </button>
          ))}
        </div>

        <div className="sv-row">
          <button className="sv-skip" onClick={skip} disabled={saving}>
            {t('skip')}
          </button>
          <button className="sv-btn" onClick={advance} disabled={!selected || saving}>
            {isLast ? (saving ? t('loading') : t('finish')) : t('next')}
          </button>
        </div>
      </div>
    </div>
  );
}
