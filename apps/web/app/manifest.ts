import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bothy — Programme impact",
    short_name: "Bothy",
    description: "Inspect defence supply-chain exposure and keep the evidence with the decision.",
    start_url: "/",
    display: "standalone",
    background_color: "#1d1f26",
    theme_color: "#1d1f26",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
