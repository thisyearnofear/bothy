"use client";

import Link from "next/link";
import { useEffect } from "react";
import LandingBackdrop from "../components/LandingBackdrop";
import { INTRO_KEY } from "../components/Intro";

// Landing = brand + thesis + the door, on the first paint. The story (the turn,
// the full definition, the generality close) is opt-in depth below the fold —
// progressive disclosure for judges with 10 seconds and judges with 10 minutes.
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

  useReveal();

  return (
    <main className="relative min-h-screen">
      <LandingBackdrop />

      <div className="relative">
        {/* hero — the whole pitch in ten words, and the door, zero scroll required */}
        <section className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <p className="mono fade-up text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
            both·y &nbsp;/ˈbɒθi/&nbsp; n. Scottish
          </p>
          <h1 className="fade-up mt-4 text-4xl font-semibold tracking-tight sm:text-5xl" style={{ color: "var(--text-strong)", animationDelay: "120ms" }}>
            The agent watches the hill.
            <br />
            The human owns the call.
          </h1>
          <div className="fade-up mt-8 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "240ms" }}>
            <button
              onClick={() => enter(false)}
              className="rounded-lg border-2 px-5 py-2.5 text-sm font-medium transition-transform active:scale-[0.96]"
              style={{ borderColor: "var(--text-strong)", color: "var(--text-strong)" }}
            >
              Enter the watch room
            </button>
            <button
              onClick={() => enter(true)}
              className="rounded-lg border px-5 py-2.5 text-sm transition-transform active:scale-[0.96]"
              style={{ borderColor: "var(--rule)", color: "var(--text-body)", background: "color-mix(in oklch, var(--page) 60%, transparent)" }}
            >
              watch the day happen in 20s
            </button>
          </div>
          <p className="mono fade-up mt-16 text-xs" style={{ color: "var(--text-faint)", animationDelay: "480ms" }}>
            ↓ the story
          </p>
        </section>

        {/* the turn — why this exists */}
        <section className="reveal mx-auto max-w-xl px-6 py-24 text-center">
          <p className="text-2xl font-semibold" style={{ color: "var(--text-strong)" }}>
            When the warning fails, someone gets a callout.
          </p>
          <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--text-body)" }}>
            Every winter, drivers strand on Cumbria&apos;s passes — not because no one saw it coming, but because the
            signals lived in five systems and no one had to look at them together. The people who pay are the ones who
            go out at 19:45 in the dark: mountain rescue, duty officers, farmers with a tractor.
          </p>
          <p className="mono mt-3 text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>
            Mountain Rescue England &amp; Wales teams answer over 1,000 callouts a year — many avoidable with earlier,
            better-placed warnings.
          </p>
        </section>

        {/* the thesis — what a bothy is, and what Bothy is */}
        <section className="reveal mx-auto max-w-xl px-6 pb-32 text-center">
          <p className="mono text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>
            A bothy, from Gaelic <em>bothan</em>: a shelter for walkers caught out in the hills. No booking, no staff —
            those inside decide together.
          </p>
          <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--text-body)" }}>
            Bothy is that shelter for the decision: not a dashboard, but a{" "}
            <span style={{ color: "var(--text-strong)" }}>decision case you can rewind</span> — every number cited,
            every decision signed by a human.
          </p>
          <p className="mono mt-16 text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>
            there are bothies for floods, fires and convoys too — same shelter, different hill
          </p>
        </section>
      </div>

      <footer className="mono absolute bottom-4 left-0 right-0 flex justify-center gap-4 text-xs" style={{ color: "var(--text-faint)" }}>
        <Link href="/watch?demo=1" className="underline">
          demo mode (skip intro)
        </Link>
      </footer>
    </main>
  );
}

/** Normal-flow scroll reveal: sections lift in as they enter the viewport. */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("revealed"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("revealed");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.2 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
