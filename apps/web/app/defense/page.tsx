import Link from "next/link";
import PageHero from "../../components/PageHero";
import { cookies } from "next/headers";
import GraphPanel from "../../components/GraphPanel";
import DefenseSavedCase from "../../components/DefenseSavedCase";
import DefenseWorkspace from "../../components/DefenseWorkspace";
import DefenseOnboarding from "../../components/DefenseOnboarding";
import { defenseMode } from "../../lib/workspace";
import { SESSION_COOKIE, openSession } from "@/lib/session";
import type { DefenseSession } from "../../lib/api";

export const metadata = {
  title: "Defence programme exposure",
  description: "Explore supply-chain exposure and capture evidence for a programme-impact brief.",
};

export const dynamic = "force-dynamic";

const ANONYMOUS: DefenseSession = { configured: false, authenticated: false, roles: [] };

// Resolve the session server-side so the first paint is already correct. The
// agent remains the only authority on roles; this only decides whether to send a
// bearer. `GET /api/defense/session` is public on the agent, so an anonymous
// visitor still learns whether OIDC is configured rather than seeing a wrong
// "not configured" flash before hydration.
async function resolveSession(): Promise<DefenseSession> {
  const sealed = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await openSession(sealed);
  const agentUrl = process.env.AGENT_URL ?? "http://localhost:8787";
  try {
    const response = await fetch(`${agentUrl}/api/defense/session`, {
      headers: session ? { authorization: `Bearer ${session.accessToken}` } : undefined,
      cache: "no-store",
    });
    if (!response.ok) return ANONYMOUS;
    return (await response.json()) as DefenseSession;
  } catch {
    return ANONYMOUS;
  }
}

export default async function DefensePage({ searchParams }: { searchParams: Promise<{ brief?: string | string[]; mode?: string | string[]; scenario?: string | string[] }> }) {
  const session = await resolveSession();
  const params = await searchParams;
  const { brief } = params;
  const mode = defenseMode(params);
  const savedId = typeof brief === "string" && brief ? brief : null;
  return (
    <main className="min-h-screen">
      <PageHero
        eyebrow="Defence supply-chain analysis"
        title={mode === "workspace" ? "Operations workspace" : mode === "onboarding" ? "Rehearse the handoff." : mode === "case" ? "Case record" : "Trace the exposure."}
        lede={mode === "onboarding" ? "Four steps. Three roles. Synthetic evidence." : undefined}
        image={mode === "workspace" ? "5-material" : mode === "onboarding" ? "3-assembly" : mode === "case" ? "4-component" : "2-system"}
      />
      <div className="enter mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {savedId ? <DefenseSavedCase id={savedId} initialSession={session} /> : mode === "onboarding" ? <DefenseOnboarding /> : mode === "investigation" ? <><p className="mb-4 text-sm"><Link href="/defense" className="underline">Back to workspace</Link> · New investigation · public/synthetic evidence</p><GraphPanel initialSession={session} /></> : <DefenseWorkspace initialSession={session} />}
      <footer className="mt-12 border-t pt-4 text-xs leading-relaxed" style={{ borderColor: "var(--rule)", color: "var(--text-faint)" }}>
        <p>Prototype · synthetic/public evidence · not live intelligence.</p>
        <details className="mt-2">
          <summary className="cursor-pointer underline underline-offset-4">Prototype boundary</summary>
          <p className="mt-2 max-w-3xl">Briefs are deterministic. Review and owned-action APIs fail closed unless OIDC and the SSO session bridge are configured. Outcomes are owner-recorded, not proven operational impact. No cloud inference runs on this page.</p>
        </details>
      </footer>
      </div>
    </main>
  );
}