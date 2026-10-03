import Link from "next/link";
import { cookies } from "next/headers";
import GraphPanel from "../../components/GraphPanel";
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

export default async function DefensePage() {
  const session = await resolveSession();
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
      <GraphPanel initialSession={session} />
      <footer className="mt-8 border-t pt-4 text-xs leading-relaxed" style={{ borderColor: "var(--rule)", color: "var(--text-faint)" }}>
        Prototype boundary: synthetic/public evidence and deterministic briefs. Review and owned-action APIs fail closed unless OIDC and the SSO session bridge are configured. Outcomes are owner-recorded, not proven operational impact. No cloud inference runs on this page.
      </footer>
    </main>
  );
}