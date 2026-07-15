"use client";

import { useTranslations } from "next-intl";
import { LegalShell, LSection, LDivider, lProse, lList, lLi, lLink } from "@/components/Legal";

export default function CookiesView() {
  const t = useTranslations('legalCookies');
  const bTag = { b: (chunks: React.ReactNode) => <strong>{chunks}</strong> };
  return (
    <LegalShell kicker={t('kicker')} title={t('title')} updated={t('updated')}>
      <p style={lProse}>
        {t.rich('intro', bTag)}
      </p>

      <LDivider />

      <LSection n="1" title={t('section1Title')}>
        <p style={lProse}>
          {t.rich('section1Text1', bTag)}
        </p>
        <ul style={lList}>
          <li style={lLi}>{t.rich('section1Li1', bTag)}</li>
          <li style={lLi}>{t.rich('section1Li2', bTag)}</li>
        </ul>
        <p style={lProse}>
          {t('section1Text2')}
        </p>
      </LSection>

      <LDivider />

      <LSection n="2" title={t('section2Title')}>
        <p style={lProse}>
          {t.rich('section2Text1', bTag)}
        </p>
        <p style={lProse}>
          {t.rich('section2Text2', bTag)}
        </p>
        <p style={lProse}>
          {t('section2Text3')}
        </p>
      </LSection>

      <LDivider />

      <LSection n="3" title={t('section3Title')}>
        <p style={lProse}>
          {t('section3Text')}
        </p>
      </LSection>

      <LDivider />

      <LSection n="4" title={t('section4Title')}>
        <p style={lProse}>
          {t('section4Text')}
        </p>
      </LSection>

      <LDivider />

      <LSection n="5" title={t('section5Title')}>
        <p style={lProse}>
          {t.rich('section5Text', { l: (chunks) => <a href="/privacy" style={lLink}>{chunks}</a> })}{" "}
          <a href="mailto:getklipsaas@gmail.com" style={lLink}>getklipsaas@gmail.com</a>.
        </p>
      </LSection>
    </LegalShell>
  );
}
