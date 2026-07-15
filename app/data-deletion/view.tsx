"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export default function DataDeletionView() {
  const t = useTranslations('dataDeletion');
  const bTag = { b: (chunks: React.ReactNode) => <strong>{chunks}</strong> };
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--canvas)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "60px 24px",
      fontFamily: "var(--sans)",
    }}>
      <div style={{ maxWidth: 640, width: "100%" }}>

        {/* Logo */}
        <div style={{ marginBottom: 40 }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <img src="/logo-klip-dark.png" alt="Klip" style={{ height: 32, width: "auto" }} />
          </Link>
        </div>

        <h1 style={{
          fontFamily: "var(--display)", fontWeight: 800, fontSize: 32,
          color: "var(--ink)", letterSpacing: "-0.02em", marginBottom: 12,
        }}>
          {t('title')}
        </h1>

        <p style={{ fontSize: 14, color: "var(--ink-2)", marginBottom: 32, lineHeight: 1.7 }}>
          {t('intro')}
        </p>

        {/* Section 1 */}
        <section style={{ marginBottom: 28 }}>
          <h2 style={{
            fontFamily: "var(--display)", fontWeight: 700, fontSize: 16,
            color: "var(--ink)", marginBottom: 10, letterSpacing: "-0.01em",
          }}>
            {t('section1Title')}
          </h2>
          <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.7 }}>
            {t('section1Intro')}
          </p>
          <ul style={{ marginTop: 10, paddingLeft: 20, fontSize: 14, color: "var(--ink-2)", lineHeight: 2 }}>
            <li>{t('li1')}</li>
            <li>{t('li2')}</li>
            <li>{t('li3')}</li>
            <li>{t('li4')}</li>
          </ul>
        </section>

        {/* Section 2 */}
        <section style={{ marginBottom: 28 }}>
          <h2 style={{
            fontFamily: "var(--display)", fontWeight: 700, fontSize: 16,
            color: "var(--ink)", marginBottom: 10, letterSpacing: "-0.01em",
          }}>
            {t('section2Title')}
          </h2>
          <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.7, marginBottom: 12 }}>
            {t('section2Intro')}
          </p>

          <div style={{
            background: "var(--card)", border: "1px solid var(--line-2)",
            borderRadius: "var(--r)", padding: "18px 20px", marginBottom: 12,
          }}>
            <p style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 6 }}>
              {t('option1Title')}
            </p>
            <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
              {t.rich('option1Text', bTag)}
            </p>
          </div>

          <div style={{
            background: "var(--card)", border: "1px solid var(--line-2)",
            borderRadius: "var(--r)", padding: "18px 20px",
          }}>
            <p style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 6 }}>
              {t('option2Title')}
            </p>
            <p style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
              {t('option2TextPre')}{" "}
              <a
                href="mailto:getklipsaas@gmail.com"
                style={{ color: "var(--mint-2)", fontWeight: 600, textDecoration: "none" }}
              >
                getklipsaas@gmail.com
              </a>{" "}
              {t('option2TextPost')}
            </p>
          </div>
        </section>

        {/* Section 3 */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{
            fontFamily: "var(--display)", fontWeight: 700, fontSize: 16,
            color: "var(--ink)", marginBottom: 10, letterSpacing: "-0.01em",
          }}>
            {t('section3Title')}
          </h2>
          <ul style={{ paddingLeft: 20, fontSize: 14, color: "var(--ink-2)", lineHeight: 2 }}>
            <li>{t('del1')}</li>
            <li>{t('del2')}</li>
            <li>{t('del3')}</li>
            <li>{t('del4')}</li>
          </ul>
        </section>

        {/* Footer */}
        <div style={{ borderTop: "1px solid var(--line-2)", paddingTop: 24 }}>
          <p style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.6 }}>
            {t('footerTextPre')}{" "}
            <a
              href="mailto:getklipsaas@gmail.com"
              style={{ color: "var(--ink-2)", textDecoration: "underline" }}
            >
              getklipsaas@gmail.com
            </a>.
          </p>
        </div>

      </div>
    </div>
  );
}
