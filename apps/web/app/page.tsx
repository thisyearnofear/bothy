"use client";

import Link from "next/link";
import { INTRO_KEY } from "../components/Intro";

// The standing framing page: definition -> turn -> thesis -> the door.
// Everything the dashboard will prove is promised here in one screen.
export default function Landing() {
  const enter = (replay: boolean) => {
    // coming from the landing, the framing is already seen — don't cold-open again
    try {
      sessionStorage.setItem(INTRO_KEY, "1");
    } catch {
      /* noop */
    }
    window.location.href = replay ? "/watch?replay=1" : "/watch?demo=1";
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="max-w-xl space-y-10 text-center">
        <div>
          <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
            both·y &nbsp;/ˈbɒθi/&nbsp; n. Scottish, from Gaelic <em>bothan</em>, “hut”
          </p>
          <p className="mt-3 text-lg leading-relaxed" style={{ color: "var(--text-body)" }}>
            A shelter for walkers caught out in the hills. No booking, no staff —{" "}
            <span style={{ color: "var(--text-strong)" }}>those inside decide together.</span>
          </p>
        </div>

        <div>
          <p className="text-2xl font-semibold" style={{ color: "var(--text-strong)" }}>
            When the warning fails, someone gets a callout.
          </p>
          <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--text-body)" }}>
            Every winter, drivers strand on Cumbria&apos;s passes — not because no one saw it coming, but because the
            signals lived in five systems and no one had to look at them together. The people who pay are the ones who
            go out at 19:45 in the dark: mountain rescue, duty officers, farmers with a tractor.
          </p>
          <p className="mono mt-3 text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>
            Mountain Rescue England & Wales teams answer over 1,000 callouts a year — many avoidable with earlier,
            better-placed warnings.
          </p>
        </div>

        <div>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-body)" }}>
            Bothy is not a dashboard. It is a{" "}
            <span style={{ color: "var(--text-strong)" }}>decision case you can rewind</span> — every number cited,
            every decision signed by a human. An agent watches the hill; a duty officer owns the call.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => enter(false)}
              className="rounded-lg border-2 px-4 py-2 text-sm font-medium transition-transform active:scale-[0.96]"
              style={{ borderColor: "var(--text-strong)", color: "var(--text-strong)" }}
            >
              Enter the watch room
            </button>
            <button
              onClick={() => enter(true)}
              className="rounded-lg border px-4 py-2 text-sm transition-transform active:scale-[0.96]"
              style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}
            >
              or watch the day happen in 20s
            </button>
          </div>
        </div>

        <p className="mono text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>
          there are bothies for floods, fires and convoys too — same shelter, different hill
        </p>
      </div>

      <footer className="mono absolute bottom-4 flex gap-4 text-xs" style={{ color: "var(--text-faint)" }}>
        <Link href="/watch?demo=1" className="underline">
          demo mode (skip intro)
        </Link>
      </footer>
    </main>
  );
}
