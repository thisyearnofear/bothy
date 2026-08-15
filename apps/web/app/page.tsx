"use client";

import Link from "next/link";
import { useEffect } from "react";
import LandingBackdrop from "../components/LandingBackdrop";
import { INTRO_KEY } from "../components/Intro";

const markSeen = () => {
  try {
    sessionStorage.setItem(INTRO_KEY, "1");
  } catch {
    /* noop */
  }
};

// Landing = brand + thesis + the door, on the first paint. The story (the turn,
// the full definition, the generality close) is opt-in depth below the fold —
// progressive disclosure for judges with 10 seconds and judges with 10 minutes.
export default function Landing() {
  useReveal();

  return (
    <main className="relative min-h-screen">
      <LandingBackdrop />

      <div className="relative z-10">
        {/* hero — the whole pitch in ten words, and the door, zero scroll required.
            camera keyframes (Bothy-legal scroll cinema): wide over the fells while the reader is still */}
        <section
          data-cam='{"id":"hero","center":[-3.1,54.5],"zoom":9,"pitch":35,"bearing":-18}'
          className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
        >
          <div className="fade-up" style={{ animationDelay: "80ms" }}>
            <h1 className="text-[clamp(5rem,17vw,10rem)] font-semibold leading-[0.8] tracking-[-0.075em]" style={{ color: "var(--text-strong)" }}>
              Bothy
            </h1>
            <p className="mono mt-5 text-xs uppercase tracking-[0.22em] sm:text-sm" style={{ color: "var(--cursor)" }}>
              Accountable winter access decisions
            </p>
          </div>
          <p
            className="mono fade-up mt-7 text-sm tracking-[0.18em]"
            style={{ color: "var(--text-body)", textShadow: "0 1px 16px var(--page)", animationDelay: "180ms" }}
          >
            both·y &nbsp;/ˈbɒθi/&nbsp; n. Scottish
          </p>
          <h2 className="fade-up mt-4 text-3xl font-semibold tracking-tight sm:text-5xl" style={{ color: "var(--text-strong)", animationDelay: "280ms" }}>
            The agent watches the hill.
            <br />
            The human owns the call.
          </h2>
          <div className="fade-up mt-8 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "240ms" }}>
            <Link
              href="/watch?demo=1"
              prefetch
              transitionTypes={["nav-forward"]}
              onClick={markSeen}
              className="rounded-lg border-2 px-5 py-2.5 text-sm font-medium transition-transform active:scale-[0.96]"
              style={{ borderColor: "var(--text-strong)", color: "var(--text-strong)" }}
            >
              Enter the watch room
            </Link>
            <Link
              href="/watch?replay=1"
              prefetch
              transitionTypes={["nav-forward"]}
              onClick={markSeen}
              className="rounded-lg border px-5 py-2.5 text-sm transition-transform active:scale-[0.96]"
              style={{ borderColor: "var(--rule)", color: "var(--text-body)", background: "color-mix(in oklch, var(--page) 60%, transparent)" }}
            >
              watch the day happen in 20s
            </Link>
          </div>
          <p className="mono fade-up mt-16 text-sm" style={{ color: "var(--text-body)", textShadow: "0 1px 16px var(--page)", animationDelay: "480ms" }}>
            ↓ the story
          </p>
        </section>

        {/* the turn — why this exists. camera descends toward the A66 corridor:
            the hill becomes a place, specific and real */}
        <section
          data-cam='{"id":"turn","center":[-2.11,54.51],"zoom":10,"pitch":48,"bearing":10}'
          className="reveal flex min-h-screen flex-col items-center justify-center px-6 text-center"
        >
          <h2 className="max-w-5xl text-[clamp(2.4rem,7vw,5.25rem)] font-semibold leading-[0.9] tracking-[-0.055em]" style={{ color: "var(--text-strong)" }}>
            When the warning fails,
            <br />
            someone gets a callout.
          </h2>
          <p className="mono mt-8 max-w-xl text-sm uppercase tracking-[0.18em]" style={{ color: "var(--text-body)", textShadow: "0 1px 16px var(--page)" }}>
            five systems · no one had to look together
          </p>
        </section>

        {/* the thesis — what Bothy is. camera settles over the pass:
            landscape becoming instrument */}
        <section
          data-cam='{"id":"thesis","center":[-2.11,54.51],"zoom":11,"pitch":18,"bearing":-4}'
          className="reveal flex min-h-screen flex-col items-center justify-center px-6 pb-24 text-center"
        >
          <h2 className="max-w-5xl text-[clamp(2.4rem,7vw,5.25rem)] font-semibold leading-[0.9] tracking-[-0.055em]" style={{ color: "var(--text-strong)" }}>
            Not a dashboard.
            <br />
            A case you can rewind.
          </h2>
          <p className="mono mt-8 max-w-xl text-xs uppercase tracking-widest sm:text-sm" style={{ color: "var(--cursor)" }}>
            every number cited · a human signs
          </p>
          <p className="mono mt-16 text-sm uppercase tracking-[0.18em]" style={{ color: "var(--text-body)", textShadow: "0 1px 16px var(--page)" }}>
            floods · fires · convoys — same shelter, different hill
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/watch?replay=1"
              prefetch
              transitionTypes={["nav-forward"]}
              onClick={markSeen}
              className="rounded-lg border-2 px-5 py-2.5 text-sm font-medium transition-transform active:scale-[0.96]"
              style={{ borderColor: "var(--text-strong)", color: "var(--text-strong)" }}
            >
              watch the day happen in 20s
            </Link>
            <Link
              href="/watch?demo=1"
              prefetch
              transitionTypes={["nav-forward"]}
              onClick={markSeen}
              className="rounded-lg border px-5 py-2.5 text-sm transition-transform active:scale-[0.96]"
              style={{ borderColor: "var(--rule)", color: "var(--text-body)", background: "color-mix(in oklch, var(--page) 60%, transparent)" }}
            >
              Enter the watch room
            </Link>
          </div>
        </section>
      </div>

      <footer className="mono relative z-10 flex justify-center gap-4 pb-8 text-sm" style={{ color: "var(--text-body)", textShadow: "0 1px 16px var(--page)" }}>
        <Link href="/watch?demo=1" prefetch transitionTypes={["nav-forward"]} onClick={markSeen} className="underline">
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
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
