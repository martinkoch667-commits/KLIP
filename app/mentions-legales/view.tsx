"use client";

import { useTranslations } from "next-intl";
import { LegalShell, LSection, LDivider, lProse, lLink } from "@/components/Legal";

export default function MentionsLegalesView() {
  const t = useTranslations('legalMentions');
  return (
    <LegalShell kicker={t('kicker')} title={t('title')} updated={t('updated')}>
      <p style={lProse}>
        {t.rich('intro', { b: (chunks) => <strong>{chunks}</strong> })}
      </p>

      <LDivider />

      <LSection n="1" title={t('section1Title')}>
        <div style={{ background: "var(--paper, #FAFAF8)", border: "1px solid rgba(13,15,10,.08)", borderRadius: 14, padding: "24px 28px" }}>
          <p style={{ ...lProse, marginBottom: 6 }}><strong>Martin Koch</strong></p>
          <p style={{ ...lProse, marginBottom: 6 }}>{t('soleProprietor')}</p>
          <p style={{ ...lProse, marginBottom: 6 }}>{t('sirenLabel')}</p>
          <p style={{ ...lProse, marginBottom: 6 }}>{t('addressLabel')}</p>
          <p style={{ ...lProse, marginBottom: 6 }}>{t('emailLabel')} <a href="mailto:getklipsaas@gmail.com" style={lLink}>getklipsaas@gmail.com</a></p>
          <p style={{ ...lProse, marginBottom: 0 }}>{t('vatLabel')}</p>
        </div>
      </LSection>

      <LDivider />

      <LSection n="2" title={t('section2Title')}>
        <p style={lProse}>{t('section2Text')}</p>
      </LSection>

      <LDivider />

      <LSection n="3" title={t('section3Title')}>
        <p style={lProse}>{t('section3Text1')}</p>
        <p style={lProse}>
          <strong>Vercel Inc.</strong> — 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis —{" "}
          <a href="https://vercel.com" style={lLink}>vercel.com</a>
        </p>
        <p style={lProse}>
          {t.rich('section3Text3', {
            b: (chunks) => <strong>{chunks}</strong>,
            l: (chunks) => <a href="https://supabase.com" style={lLink}>{chunks}</a>,
          })}
        </p>
      </LSection>

      <LDivider />

      <LSection n="4" title={t('section4Title')}>
        <p style={lProse}>
          {t('section4Text1')}
        </p>
        <p style={lProse}>
          {t('section4Text2')}
        </p>
      </LSection>

      <LDivider />

      <LSection n="5" title={t('section5Title')}>
        <p style={lProse}>
          {t('section5Text')}
        </p>
      </LSection>

      <LDivider />

      <LSection n="6" title={t('section6Title')}>
        <p style={lProse}>
          {t.rich('section6Text', {
            l1: (chunks) => <a href="/privacy" style={lLink}>{chunks}</a>,
            l2: (chunks) => <a href="/cookies" style={lLink}>{chunks}</a>,
          })}
        </p>
      </LSection>

      <LDivider />

      <LSection n="7" title={t('section7Title')}>
        <p style={lProse}>
          {t('section7Text')} <a href="mailto:getklipsaas@gmail.com" style={lLink}>getklipsaas@gmail.com</a>.
        </p>
      </LSection>
    </LegalShell>
  );
}
