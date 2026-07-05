import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Klip",
  description: "How Klip collects, uses and protects your personal data.",
};

export default function PrivacyPolicy() {
  return (
    <div style={{ background: "var(--canvas, #F5F4F0)", minHeight: "100vh", fontFamily: "var(--sans, 'DM Sans', sans-serif)" }}>

      {/* Top bar */}
      <header style={{ borderBottom: "1px solid rgba(13,15,10,.08)", padding: "0 32px", height: 56, display: "flex", alignItems: "center", background: "var(--paper, #FAFAF8)" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <img src="/logo-klip-dark.png" alt="Klip" style={{ height: 28, width: "auto" }} />
        </Link>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--ink-3, #9A9B97)" }}>Privacy Policy</span>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px 96px" }}>

        {/* Title */}
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-3, #9A9B97)", marginBottom: 12, fontFamily: "var(--display, 'Archivo Black', sans-serif)" }}>
            Legal
          </p>
          <h1 style={{ fontFamily: "var(--display, 'Archivo Black', sans-serif)", fontWeight: 900, fontSize: 40, color: "var(--ink, #0D0F0A)", letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 14 }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: 14, color: "var(--ink-3, #9A9B97)", fontWeight: 500 }}>
            Last updated June 11, 2026
          </p>
        </div>

        {/* Intro */}
        <p style={prose}>
          This Privacy Policy describes how <strong>Klip</strong> ("we", "us", "our") — operated by Martin Koch, micro-entreprise SIREN&nbsp;931920821 — collects, uses and protects your personal information when you use our service at <strong>getklip.fr</strong>. By using Klip, you agree to the practices described below.
        </p>

        <Divider />

        {/* 1 */}
        <Section n="1" title="Information We Collect">
          <SubHeading>Account data</SubHeading>
          <p style={prose}>When you create an account we collect your <strong>name</strong>, <strong>email address</strong>, and a <strong>hashed password</strong> (never stored in plain text).</p>

          <SubHeading>Client / workspace data</SubHeading>
          <p style={prose}>For each client workspace you create we store the <strong>client name</strong>, <strong>brand colours</strong>, <strong>typography settings</strong>, and any <strong>brand assets you upload</strong> (logos, fonts, images).</p>

          <SubHeading>Instagram data</SubHeading>
          <p style={prose}>When you connect an Instagram account via OAuth we store the account's <strong>username</strong>, <strong>Instagram account ID</strong>, and an <strong>OAuth access token</strong>. This token is stored securely on our servers and is <em>never</em> exposed in the browser or sent to third parties other than Meta's API.</p>

          <SubHeading>Content data</SubHeading>
          <p style={prose}>We store the <strong>posts you create</strong> inside Klip, including uploaded visuals, AI-generated descriptions, scheduled dates, and publication status.</p>
        </Section>

        <Divider />

        {/* 2 */}
        <Section n="2" title="How We Use Your Data">
          <ul style={list}>
            <li style={li}>Provide, operate and improve the Klip service</li>
            <li style={li}>Publish content to Instagram <strong>on your behalf</strong>, strictly when you initiate the action and have granted explicit OAuth permission</li>
            <li style={li}>Generate AI captions and visual copy based on your visuals and brand settings</li>
            <li style={li}>Contact you for account-related communications and support</li>
            <li style={li}>Comply with legal obligations</li>
          </ul>
          <p style={prose}>We do not use your data for advertising, profiling, or any purpose beyond delivering the service you signed up for.</p>
        </Section>

        <Divider />

        {/* 3 */}
        <Section n="3" title="Data Sharing">
          <p style={prose}>
            <strong>We never sell your data to third parties.</strong> Data is shared only with the following sub-processors, strictly to operate the service:
          </p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <Th>Sub-processor</Th>
                <Th>Purpose</Th>
                <Th>Privacy policy</Th>
              </tr>
            </thead>
            <tbody>
              <Tr cols={["Supabase", "Database & file storage", "supabase.com/privacy"]} />
              <Tr cols={["Anthropic", "AI caption generation", "anthropic.com/privacy"]} />
              <Tr cols={["Meta / Instagram", "OAuth authentication & post publishing", "privacycenter.instagram.com"]} />
              <Tr cols={["Vercel", "Application hosting & CDN", "vercel.com/legal/privacy-policy"]} />
            </tbody>
          </table>
          <p style={prose}>Each sub-processor is bound by its own privacy policy and applicable data protection regulations.</p>
        </Section>

        <Divider />

        {/* 4 */}
        <Section n="4" title="Instagram Data">
          <ul style={list}>
            <li style={li}>Klip accesses your Instagram account exclusively through <strong>Meta's official OAuth flow</strong> — we never ask for your Instagram password.</li>
            <li style={li}>
              Permissions requested: <code style={code}>instagram_business_basic</code> and <code style={code}>instagram_business_content_publish</code>.
            </li>
            <li style={li}>These permissions are used solely to display your account stats and publish posts you have approved inside Klip.</li>
            <li style={li}>You can <strong>revoke access at any time</strong> from your Instagram account settings under Apps &amp; Websites.</li>
            <li style={li}>OAuth access tokens are stored encrypted in our database and are <strong>never exposed client-side</strong> or included in API responses to the browser.</li>
          </ul>
          <p style={prose}>
            To request immediate deletion of your Instagram data:&nbsp;
            <a href="https://getklip.fr/data-deletion" style={link}>getklip.fr/data-deletion</a>
          </p>
        </Section>

        <Divider />

        {/* 5 */}
        <Section n="5" title="Data Retention">
          <ul style={list}>
            <li style={li}>Your data is retained for as long as your account is active.</li>
            <li style={li}>If you delete your account, all personal data and associated content will be permanently deleted <strong>within 30 days</strong>.</li>
            <li style={li}>Backup copies may persist for up to 30 additional days before being purged from all systems.</li>
          </ul>
        </Section>

        <Divider />

        {/* 6 */}
        <Section n="6" title="Your Rights (GDPR)">
          <p style={prose}>If you are located in the European Economic Area you have the following rights regarding your personal data:</p>
          <ul style={list}>
            <li style={li}><strong>Right of access</strong> — obtain a copy of the data we hold about you</li>
            <li style={li}><strong>Right to rectification</strong> — correct inaccurate or incomplete data</li>
            <li style={li}><strong>Right to erasure</strong> — request deletion of your personal data</li>
            <li style={li}><strong>Right to data portability</strong> — receive your data in a structured, machine-readable format</li>
            <li style={li}><strong>Right to object</strong> — object to processing based on legitimate interests</li>
            <li style={li}><strong>Right to restriction</strong> — request that we restrict processing of your data</li>
          </ul>
          <p style={prose}>
            To exercise any of these rights, contact us at <a href="mailto:getklipsaas@gmail.com" style={link}>getklipsaas@gmail.com</a>.
            We will respond within 30 days.
          </p>
          <p style={prose}>
            To request data deletion:&nbsp;
            <a href="https://getklip.fr/data-deletion" style={link}>getklip.fr/data-deletion</a>
          </p>
        </Section>

        <Divider />

        {/* 7 */}
        <Section n="7" title="Security">
          <ul style={list}>
            <li style={li}>All data is transmitted over <strong>HTTPS / TLS</strong></li>
            <li style={li}>Instagram access tokens are <strong>encrypted at rest</strong> in the database</li>
            <li style={li}><strong>Row Level Security (RLS)</strong> is enforced on all database tables — each user can only access their own data</li>
            <li style={li}>Passwords are hashed using bcrypt via Supabase Auth — we never see your plain-text password</li>
            <li style={li}>File storage buckets are access-controlled by authenticated user ID</li>
          </ul>
          <p style={prose}>Despite our efforts, no method of transmission over the internet is 100% secure. If you discover a security vulnerability please report it to <a href="mailto:getklipsaas@gmail.com" style={link}>getklipsaas@gmail.com</a>.</p>
        </Section>

        <Divider />

        {/* 8 */}
        <Section n="8" title="Contact &amp; Data Controller">
          <div style={{ background: "var(--paper, #FAFAF8)", border: "1px solid rgba(13,15,10,.08)", borderRadius: 14, padding: "24px 28px", marginTop: 8 }}>
            <p style={{ ...prose, marginBottom: 6 }}><strong>Martin Koch</strong></p>
            <p style={{ ...prose, marginBottom: 6 }}>Micro-entreprise — SIREN&nbsp;931920821</p>
            <p style={{ ...prose, marginBottom: 6 }}>
              Email:&nbsp;<a href="mailto:getklipsaas@gmail.com" style={link}>getklipsaas@gmail.com</a>
            </p>
            <p style={{ ...prose, marginBottom: 0 }}>
              Data deletion:&nbsp;
              <a href="https://getklip.fr/data-deletion" style={link}>getklip.fr/data-deletion</a>
            </p>
          </div>
        </Section>

        <Divider />

        <p style={{ ...prose, color: "var(--ink-3, #9A9B97)", fontSize: 13 }}>
          We may update this Privacy Policy from time to time. When we do, we will revise the "Last updated" date at the top of this page. Continued use of the service after changes constitutes acceptance of the updated policy.
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
