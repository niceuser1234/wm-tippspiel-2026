import { ImageResponse } from "next/og";

// WhatsApp-/Social-Link-Vorschau (1200×630). File-based Metadata-Convention:
// Next.js setzt daraus automatisch og:image + twitter:image.
export const alt = "WM 2026 Tippspiel — Haberstroh & Friends";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #166534 0%, #15803d 55%, #14a34a 100%)",
          color: "white",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* dezente Streifen-Textur */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            backgroundImage:
              "repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 64px, rgba(0,0,0,0) 64px, rgba(0,0,0,0) 128px)",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            fontSize: 120,
            fontWeight: 900,
            letterSpacing: -3,
          }}
        >
          ⚽ WM 2026
        </div>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 800, marginTop: 4 }}>
          Tippspiel
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 40,
            marginTop: 36,
            padding: "10px 28px",
            borderRadius: 9999,
            background: "rgba(255,255,255,0.15)",
            border: "2px solid rgba(255,255,255,0.35)",
          }}
        >
          🏆 Haberstroh & Friends
        </div>
        <div style={{ display: "flex", fontSize: 28, marginTop: 44, opacity: 0.85 }}>
          Tippen · Zittern · Topf gewinnen
        </div>
      </div>
    ),
    { ...size }
  );
}
