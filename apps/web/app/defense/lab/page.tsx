import PageHero from "../../../components/PageHero";
import StressLab from "../../../components/StressLab";

export const metadata = {
  title: "Stress-test lab",
  description: "Try to break the approval, ownership and audit rules, and see what they refuse.",
};

export default function LabPage() {
  return (
    <main className="min-h-screen">
      <PageHero eyebrow="Stress-test lab" title="Try to break the workflow." lede="Six attempts to skip, fake or rewrite a decision. See what is refused." image="4-component" />
      <div className="enter mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <StressLab />
        <footer className="mt-12 border-t pt-4 text-xs leading-relaxed" style={{ borderColor: "var(--rule)", color: "var(--text-faint)" }}>
          <p>Synthetic fixtures only. The audit chain detects edits to stored entries; it is not an authenticated signature and does not protect against an attacker who can rewrite the whole chain.</p>
        </footer>
      </div>
    </main>
  );
}
