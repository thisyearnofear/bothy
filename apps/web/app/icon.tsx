import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#1d1f26",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          position: "relative",
          width: "100%",
        }}
      >
        <div
          style={{
            border: "18px solid #73bde8",
            borderRadius: "52px",
            display: "flex",
            height: 332,
            position: "absolute",
            transform: "rotate(-32deg)",
            width: 104,
          }}
        />
        <div
          style={{
            alignItems: "center",
            background: "#1d1f26",
            border: "12px solid #d9dde5",
            borderRadius: "999px",
            color: "#d9dde5",
            display: "flex",
            fontFamily: "ui-monospace, Menlo, monospace",
            fontSize: 180,
            fontWeight: 700,
            height: 284,
            justifyContent: "center",
            lineHeight: 1,
            width: 284,
          }}
        >
          B
        </div>
      </div>
    ),
    size
  );
}
