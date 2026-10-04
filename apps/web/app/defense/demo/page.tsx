import PageHero from "../../../components/PageHero";
import DemoPlayer from "../../../components/DemoPlayer";

export const metadata = {
  title: "Two-minute demo",
  description: "A guided run: one question, four roles, an attempt to cheat, and proof nothing was rewritten.",
};

export default function DemoPage() {
  return (
    <main className="min-h-screen">
      <PageHero eyebrow="Guided demo · about two minutes" title="See it work, then see it refuse." lede="Real rules, synthetic data. Pause or step through at any time." image="2-system" />
      <div className="enter mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <DemoPlayer />
        <footer className="mt-12 border-t pt-4 text-xs leading-relaxed" style={{ borderColor: "var(--rule)", color: "var(--text-faint)" }}>
          <p>Synthetic and public evidence only. The graph query is live; the four-role walkthrough and attacks run the real approval, ownership and audit rules against a throwaway database. No operational effect is claimed.</p>
        </footer>
      </div>
    </main>
  );
}
