import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Klip — Le studio social pour agences";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Image Open Graph générée dynamiquement (tokens : forest #0C2A1D, mint #2FD79B)
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background:
            "radial-gradient(1000px 500px at 12% -10%, rgba(47,215,155,0.22), transparent 60%), linear-gradient(135deg, #0A2418 0%, #0C2A1D 55%, #103A28 100%)",
          color: "#EEEDE3",
          fontFamily: "sans-serif",
        }}
      >
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", fontSize: 56, fontWeight: 900, letterSpacing: "-0.04em" }}>
            <span>Kl</span>
            <span style={{ color: "#2FD79B" }}>ip</span>
            <span style={{ width: 14, height: 14, borderRadius: 999, background: "#2FD79B", marginLeft: 6, marginTop: 26 }} />
          </div>
        </div>

        {/* Tagline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.03em", maxWidth: 980 }}>
            Le studio social pour agences
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "rgba(238,237,227,0.7)", marginTop: 26, maxWidth: 860, lineHeight: 1.4 }}>
            Création visuelle, descriptions IA, planification et publication Instagram — tout dans un seul outil.
          </div>
        </div>

        {/* Feature chips */}
        <div style={{ display: "flex", gap: 14 }}>
          {["Éditeur visuel", "Descriptions IA", "Calendrier", "Publication auto"].map((t) => (
            <div
              key={t}
              style={{
                display: "flex",
                fontSize: 24,
                fontWeight: 700,
                color: "#EEEDE3",
                padding: "12px 22px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(238,237,227,0.16)",
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
