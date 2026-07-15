"use client";

import { useTranslations } from "next-intl";
import { LegalShell, LSection, LDivider, LTodo, lProse, lList, lLi, lLink } from "@/components/Legal";

export default function ConditionsView() {
  const t = useTranslations('legalConditions');
  const richTags = {
    b: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
    todo: (chunks: React.ReactNode) => <LTodo>{chunks}</LTodo>,
  };
  return (
    <LegalShell kicker={t('kicker')} title={t('title')} updated={t('updated')}>
      <p style={lProse}>
        {t.rich('intro', richTags)}
      </p>

      <LDivider />

      <LSection n="1" title={t('section1Title')}>
        <p style={lProse}>
          {t('section1Text')}
        </p>
      </LSection>

      <LDivider />

      <LSection n="2" title={t('section2Title')}>
        <ul style={lList}>
          <li style={lLi}>{t('section2Li1')}</li>
          <li style={lLi}>{t('section2Li2')}</li>
          <li style={lLi}>{t('section2Li3')}</li>
        </ul>
      </LSection>

      <LDivider />

      <LSection n="3" title={t('section3Title')}>
        <ul style={lList}>
          <li style={lLi}>{t.rich('section3Li1', richTags)}</li>
          <li style={lLi}>{t.rich('section3Li2', richTags)}</li>
          <li style={lLi}>{t.rich('section3Li3', richTags)}</li>
          <li style={lLi}>{t.rich('section3Li4', richTags)}</li>
          <li style={lLi}>{t.rich('section3Li5', richTags)}</li>
        </ul>
      </LSection>

      <LDivider />

      <LSection n="4" title={t('section4Title')}>
        <p style={lProse}>{t('section4Text')}</p>
      </LSection>

      <LDivider />

      <LSection n="5" title={t('section5Title')}>
        <ul style={lList}>
          <li style={lLi}>{t('section5Li1')}</li>
          <li style={lLi}>{t('section5Li2')}</li>
          <li style={lLi}>{t('section5Li3')}</li>
        </ul>
      </LSection>

      <LDivider />

      <LSection n="6" title={t('section6Title')}>
        <ul style={lList}>
          <li style={lLi}>{t('section6Li1')}</li>
          <li style={lLi}>{t('section6Li2')}</li>
          <li style={lLi}>{t('section6Li3')}</li>
        </ul>
      </LSection>

      <LDivider />

      <LSection n="7" title={t('section7Title')}>
        <p style={lProse}>
          {t('section7Text')}
        </p>
      </LSection>

      <LDivider />

      <LSection n="8" title={t('section8Title')}>
        <p style={lProse}>
          {t.rich('section8Text', richTags)}
        </p>
      </LSection>

      <LDivider />

      <LSection n="9" title={t('section9Title')}>
        <p style={lProse}>{t('section9Text')} <a href="mailto:getklipsaas@gmail.com" style={lLink}>getklipsaas@gmail.com</a>.</p>
      </LSection>
    </LegalShell>
  );
}
