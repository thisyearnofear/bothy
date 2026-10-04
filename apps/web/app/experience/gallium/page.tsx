import { cookies } from "next/headers";
import Experience from "../../../components/experience/Experience";
import { SiteHeader } from "../../../components/PageHero";
import { SESSION_COOKIE, openSession } from "@/lib/session";
import type { DefenseSession } from "../../../lib/api";

export const metadata = {
  title: "Gallium dependency — cinematic investigation",
  description: "A guided trace of one captured gallium dependency: real synthetic evidence, honest gaps, human handoff.",
};

export const dynamic = "force-dynamic";

const ANONYMOUS: DefenseSession = { configured: false, authenticated: false, roles: [] };

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

export default async function GalliumExperience() {
  const session = await resolveSession();
  return (
    <main className="min-h-screen">
      <SiteHeader />
      <Experience initialSession={session} />
      <footer className="border-t px-5 py-4 text-xs sm:px-10" style={{ borderColor: "var(--rule)", color: "var(--text-faint)" }}>
        Prototype · synthetic/public evidence · not live intelligence.
      </footer>
    </main>
  );
}
