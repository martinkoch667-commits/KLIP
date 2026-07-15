"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export default function PrivacyPolicyView() {
  const t = useTranslations('legalPrivacy');
  const introTags = { b1: (chunks: React.ReactNode) => <strong>{chunks}</strong>, b2: (chunks: React.ReactNode) => <strong>{chunks}</strong> };
  const b1 = { b1: (chunks: React.ReactNode) => <strong>{chunks}</strong> };
  const b1b2b3 = { b1: (chunks: React.ReactNode) => <strong>{chunks}</strong>, b2: (chunks: React.ReactNode) => <strong>{chunks}</strong>, b3: (chunks: React.ReactNode) => <strong>{chunks}</strong>, em: (chunks: React.ReactNode) => <em>{chunks}</em> };
  const b1b2b3b4 = { b1: (chunks: React.ReactNode) => <strong>{chunks}</strong>, b2: (chunks: React.ReactNode) => <strong>{chunks}</strong>, b3: (chunks: React.ReactNode) => <strong>{chunks}</strong>, b4: (chunks: React.ReactNode) => <strong>{chunks}</strong> };
  const bOnly = { b: (chunks: React.ReactNode) => <strong>{chunks}</strong> };
  const bCode = { b: (chunks: React.ReactNode) => <strong>{chunks}</strong>, code: (chunks: React.ReactNode) => <code style={code}>{chunks}</code> };

  return (
    <div style={{ background: "var(--canvas, #F5F4F0)", minHeight: "100vh", fontFamily: "var(--sans, 'DM Sans', sans-serif)" }}>

      {/* Top bar */}
      <header style={{ borderBottom: "1px solid rgba(13,15,10,.08)", padding: "0 32px", height: 56, display: "flex", alignItems: "center", background: "var(--paper, #FAFAF8)" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <img src="/logo-klip-dark.png" alt="Klip" style={{ height: 28, width: "auto" }} />
        </Link>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--ink-3, #9A9B97)" }}>{t('topBarLabel')}</span>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px 96px" }}>

        {/* Title */}
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-3, #9A9B97)", marginBottom: 12, fontFamily: "var(--display, 'Archivo Black', sans-serif)" }}>
            {t('kicker')}
          </p>
          <h1 style={{ fontFamily: "var(--display, 'Archivo Black', sans-serif)", fontWeight: 900, fontSize: 40, color: "var(--ink, #0D0F0A)", letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 14 }}>
            {t('title')}
          </h1>
          <p style={{ fontSize: 14, color: "var(--ink-3, #9A9B97)", fontWeight: 500 }}>
            {t('updated')}
          </p>
        </div>

        {/* Intro */}
        <p style={prose}>
          {t.rich('intro', introTags)}
        </p>

        <Divider />

        {/* 1 */}
        <Section n="1" title={t('section1Title')}>
          <SubHeading>{t('sub1')}</SubHeading>
          <p style={prose}>{t.rich('sub1Text', b1b2b3)}</p>

          <SubHeading>{t('sub2')}</SubHeading>
          <p style={prose}>{t.rich('sub2Text', b1b2b3b4)}</p>

          <SubHeading>{t('sub3')}</SubHeading>
          <p style={prose}>{t.rich('sub3Text', b1b2b3)}</p>

          <SubHeading>{t('sub4')}</SubHeading>
          <p style={prose}>{t.rich('sub4Text', b1)}</p>
        </Section>

        <Divider />

        {/* 2 */}
        <Section n="2" title={t('section2Title')}>
          <ul style={list}>
            <li style={li}>{t('use1')}</li>
            <li style={li}>{t.rich('use2', bOnly)}</li>
            <li style={li}>{t('use3')}</li>
            <li style={li}>{t('use4')}</li>
            <li style={li}>{t('use5')}</li>
          </ul>
          <p style={prose}>{t('section2Outro')}</p>
        </Section>

        <Divider />

        {/* 3 */}
        <Section n="3" title={t('section3Title')}>
          <p style={prose}>
            {t.rich('section3Text1', bOnly)}
          </p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <Th>{t('thSubprocessor')}</Th>
                <Th>{t('thPurpose')}</Th>
                <Th>{t('thPrivacyPolicy')}</Th>
              </tr>
            </thead>
            <tbody>
              <Tr cols={["Supabase", t('purposeSupabase'), "supabase.com/privacy"]} />
              <Tr cols={["Anthropic", t('purposeAnthropic'), "anthropic.com/privacy"]} />
              <Tr cols={["Meta / Instagram", t('purposeMeta'), "privacycenter.instagram.com"]} />
              <Tr cols={["Vercel", t('purposeVercel'), "vercel.com/legal/privacy-policy"]} />
            </tbody>
          </table>
          <p style={prose}>{t('section3Text2')}</p>
        </Section>

        <Divider />

        {/* 4 */}
        <Section n="4" title={t('section4Title')}>
          <ul style={list}>
            <li style={li}>{t.rich('ig1', bOnly)}</li>
            <li style={li}>{t.rich('ig2', bCode)}</li>
            <li style={li}>{t('ig3')}</li>
            <li style={li}>{t.rich('ig4', bOnly)}</li>
            <li style={li}>{t.rich('ig5', bOnly)}</li>
          </ul>
          <p style={prose}>
            {t('ig6Pre')}&nbsp;
            <a href="https://getklip.fr/data-deletion" style={link}>getklip.fr/data-deletion</a>
          </p>
        </Section>

        <Divider />

        {/* 5 */}
        <Section n="5" title={t('section5Title')}>
          <ul style={list}>
            <li style={li}>{t('ret1')}</li>
            <li style={li}>{t.rich('ret2', bOnly)}</li>
            <li style={li}>{t('ret3')}</li>
          </ul>
        </Section>

        <Divider />

        {/* 6 */}
        <Section n="6" title={t('section6Title')}>
          <p style={prose}>{t('rightsIntro')}</p>
          <ul style={list}>
            <li style={li}>{t.rich('right1', bOnly)}</li>
            <li style={li}>{t.rich('right2', bOnly)}</li>
            <li style={li}>{t.rich('right3', bOnly)}</li>
            <li style={li}>{t.rich('right4', bOnly)}</li>
            <li style={li}>{t.rich('right5', bOnly)}</li>
            <li style={li}>{t.rich('right6', bOnly)}</li>
          </ul>
          <p style={prose}>
            {t('rightsText1Pre')} <a href="mailto:getklipsaas@gmail.com" style={link}>getklipsaas@gmail.com</a>.
            {" "}{t('rightsText1Post')}
          </p>
          <p style={prose}>
            {t('rightsText2Pre')}&nbsp;
            <a href="https://getklip.fr/data-deletion" style={link}>getklip.fr/data-deletion</a>
          </p>
        </Section>

        <Divider />

        {/* 7 */}
        <Section n="7" title={t('section7Title')}>
          <ul style={list}>
            <li style={li}>{t.rich('sec1', bOnly)}</li>
            <li style={li}>{t.rich('sec2', bOnly)}</li>
            <li style={li}>{t.rich('sec3', bOnly)}</li>
            <li style={li}>{t('sec4')}</li>
            <li style={li}>{t('sec5')}</li>
          </ul>
          <p style={prose}>{t('secOutro')} <a href="mailto:getklipsaas@gmail.com" style={link}>getklipsaas@gmail.com</a>.</p>
        </Section>

        <Divider />

        {/* 8 */}
        <Section n="8" title={t('section8Title')}>
          <div style={{ background: "var(--paper, #FAFAF8)", border: "1px solid rgba(13,15,10,.08)", borderRadius: 14, padding: "24px 28px", marginTop: 8 }}>
            <p style={{ ...prose, marginBottom: 6 }}><strong>Martin Koch</strong></p>
            <p style={{ ...prose, marginBottom: 6 }}>{t('company')}</p>
            <p style={{ ...prose, marginBottom: 6 }}>
              {t('emailLabel')}&nbsp;<a href="mailto:getklipsaas@gmail.com" style={link}>getklipsaas@gmail.com</a>
            </p>
            <p style={{ ...prose, marginBottom: 0 }}>
              {t('dataDeletionLabel')}&nbsp;
              <a href="https://getklip.fr/data-deletion" style={link}>getklip.fr/data-deletion</a>
            </p>
          </div>
        </Section>

        <Divider />

        <p style={{ ...prose, color: "var(--ink-3, #9A9B97)", fontSize: 13 }}>
          {t('footer')}
        </p>

      </main>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const prose: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.75,
  color: "var(--ink-2, #3D3F3A)",
  marginBottom: 14,
};

const list: React.CSSProperties = {
  paddingLeft: 22,
  marginBottom: 14,
};

const li: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.75,
  color: "var(--ink-2, #3D3F3A)",
  marginBottom: 6,
};

const link: React.CSSProperties = {
  color: "var(--mint-2, #1FA87D)",
  textDecoration: "underline",
  textUnderlineOffset: 3,
};

const code: React.CSSProperties = {
  fontFamily: "var(--mono, monospace)",
  fontSize: 13,
  background: "rgba(13,15,10,.06)",
  padding: "2px 6px",
  borderRadius: 5,
  color: "var(--ink, #0D0F0A)",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginBottom: 16,
  fontSize: 14,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 8 }}>
      <h2 style={{ fontFamily: "var(--display, 'Archivo Black', sans-serif)", fontWeight: 900, fontSize: 22, color: "var(--ink, #0D0F0A)", letterSpacing: "-0.02em", marginBottom: 18, display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontFamily: "var(--mono, monospace)", fontSize: 13, fontWeight: 700, color: "var(--ink-3, #9A9B97)", minWidth: 20 }}>{n}.</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-3, #9A9B97)", marginBottom: 6, marginTop: 18, fontFamily: "var(--display, 'Archivo Black', sans-serif)" }}>
      {children}
    </h3>
  );
}

function Divider() {
  return <hr style={{ border: "none", borderTop: "1px solid rgba(13,15,10,.07)", margin: "36px 0" }} />;
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ textAlign: "left", padding: "8px 12px", background: "rgba(13,15,10,.04)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-3, #9A9B97)", borderBottom: "1px solid rgba(13,15,10,.08)" }}>
      {children}
    </th>
  );
}

function Tr({ cols }: { cols: [string, string, string] }) {
  return (
    <tr>
      {cols.map((c, i) => (
        <td key={i} style={{ padding: "10px 12px", borderBottom: "1px solid rgba(13,15,10,.05)", fontSize: 14, color: i === 0 ? "var(--ink, #0D0F0A)" : "var(--ink-2, #3D3F3A)", fontWeight: i === 0 ? 600 : 400, verticalAlign: "top" }}>
          {c}
        </td>
      ))}
    </tr>
  );
}
