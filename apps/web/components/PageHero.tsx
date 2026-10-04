import Link from "next/link";
import ScatterHeading from "./ScatterHeading";
import BothyMark from "./BothyMark";

export function SiteHeader({ className = "" }: { className?: string }) {
  return (
    <header className={`flex items-center justify-between px-5 py-6 sm:px-10 ${className}`}>
      <Link href="/" className="flex items-center gap-3" aria-label="Bothy — shelter for uncertain decisions">
        <BothyMark />
        <span className="text-xl font-semibold tracking-tight" style={{ color: "var(--text-strong)" }}>Bothy</span>
        <span className="mono hidden text-[11px] uppercase tracking-widest sm:inline" style={{ color: "var(--text-faint)" }}>Shelter for uncertain decisions.</span>
      </Link>
      <nav className="flex gap-6 text-sm" aria-label="Main navigation">
        <Link href="/experience/gallium" className="nav-link underline-offset-4 hover:underline">Explore Bothy</Link>
        <Link href="/defense" className="nav-link underline-offset-4 hover:underline">Workspace</Link>
        <Link href="/pilot" className="nav-link underline-offset-4 hover:underline">Pilot</Link>
      </nav>
    </header>
  );
}

// Compact version of the landing hero: same plates, same type, short enough
// that the working surface below stays above the fold.
export default function PageHero({ eyebrow, title, lede, image }: { eyebrow: string; title: string; lede?: string; image: string }) {
  return (
    <section className="page-hero">
      <div className="page-hero-bg" style={{ backgroundImage: `url("/descent/${image}.jpg")` }} aria-hidden />
      <SiteHeader className="relative z-10" />
      <div className="page-hero-body px-5 pb-8 pt-10 sm:px-10 sm:pb-10 sm:pt-16">
        <p className="eyebrow">{eyebrow}</p>
        <ScatterHeading text={title} className="mt-3 max-w-4xl text-[clamp(2rem,5.5vw,4.25rem)] font-semibold leading-[0.98] tracking-[-0.05em]" style={{ color: "var(--text-strong)" }} />
        {lede && <p className="mt-4 max-w-xl text-sm sm:text-base">{lede}</p>}
      </div>
    </section>
  );
}
