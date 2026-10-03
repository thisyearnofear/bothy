import Link from "next/link";
import GraphPanel from "../../components/GraphPanel";

export const metadata = {
  title: "Defence programme exposure",
  description: "Explore supply-chain exposure and capture evidence for a programme-impact brief.",
};

export default function DefensePage() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-8 border-b pb-6" style={{ borderColor: "var(--rule)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="mono text-xs uppercase tracking-[0.2em]" style={{ color: "var(--cursor)" }}>Bothy</Link>
          <Link href="/watch?replay=1" className="text-xs underline">Earlier winter-road replay</Link>
        </div>
        <p className="mono mt-6 text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Defence supply-chain analysis</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl" style={{ color: "var(--text-strong)" }}>One disruption. Which programmes are exposed?</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed">Trace the dependencies, inspect the evidence, and prepare the next decision. Public/synthetic hackathon data, not live operational intelligence.</p>
      </header>
      <GraphPanel />
      <footer className="mt-8 border-t pt-4 text-xs leading-relaxed" style={{ borderColor: "var(--rule)", color: "var(--text-faint)" }}>
        Prototype boundary: evidence exploration and unapproved exports. Authenticated review, assigned actions, and outcome tracking are the next delivery gate. No cloud inference runs on this page.
      </footer>
    </main>
  );
}
