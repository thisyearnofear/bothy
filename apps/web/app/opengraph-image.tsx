import { ImageResponse } from "next/og";
import { site } from "../lib/site";

export const alt = site.socialImageAlt;

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#1d1f26",
          color: "#d9dde5",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: "64px 72px",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            border: "10px solid #73bde8",
            borderRadius: "999px",
            display: "flex",
            height: 690,
            opacity: 0.72,
            position: "absolute",
            right: -96,
            top: -58,
            transform: "rotate(-29deg)",
            width: 146,
          }}
        />
        <div style={{ color: "#8e96a5", display: "flex", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 25, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Bothy · Winter Watch
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 860 }}>
          <div style={{ display: "flex", fontSize: 82, fontWeight: 700, letterSpacing: "-0.055em", lineHeight: 1.02 }}>
            The hill is uncertain.
          </div>
          <div style={{ color: "#73bde8", display: "flex", fontSize: 82, fontWeight: 700, letterSpacing: "-0.055em", lineHeight: 1.02 }}>
            The decision is accountable.
          </div>
          <div style={{ color: "#b7bdc9", display: "flex", fontSize: 31, lineHeight: 1.35, marginTop: 34, maxWidth: 760 }}>
            Evidence-backed, human-approved winter access decisions for UK upland roads.
          </div>
        </div>
        <div style={{ alignItems: "center", display: "flex", gap: 18 }}>
          <div style={{ background: "#73bde8", borderRadius: "50%", display: "flex", height: 14, width: 14 }} />
          <div style={{ color: "#8e96a5", display: "flex", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 22, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Detect · Retrieve · Reason · Human approval · Audit
          </div>
        </div>
      </div>
    ),
    size
  );
}
