import type { Metadata } from "next";
import { site } from "../../lib/site";

export const metadata: Metadata = {
  title: "Winter Watch room",
  description:
    "Review route-specific winter access risks with cited signals, deterministic recommendations, named human approval, and an auditable decision trail.",
  alternates: {
    canonical: "/watch",
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "/watch",
    siteName: site.name,
    title: "Bothy Winter Watch — evidence to accountable action",
    description:
      "Review route-specific winter access risks with cited signals, deterministic recommendations, named human approval, and an auditable decision trail.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: site.socialImageAlt }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bothy Winter Watch — evidence to accountable action",
    description:
      "Review route-specific winter access risks with cited signals, deterministic recommendations, named human approval, and an auditable decision trail.",
    images: ["/opengraph-image"],
  },
};

export default function WatchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
