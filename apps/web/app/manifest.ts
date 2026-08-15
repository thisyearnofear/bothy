import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bothy — Winter Watch",
    short_name: "Bothy",
    description: "Evidence-backed, human-approved winter access decisions for UK upland roads.",
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
