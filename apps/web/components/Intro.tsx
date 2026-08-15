"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The cold open: three staged beats — the bothy, the turn, the thesis —
 * played once per session over the living dashboard. Any key, click, or the
 * entry buttons dismiss it. ?demo=1 skips it entirely.
 */
export const INTRO_KEY = "bothy-intro-seen";

export default function Intro({ onEnter, onReplay }: { onEnter: () => void; onReplay: () => void }) {
  const [beat, setBeat] = useState(0);
  const [leaving, setLeaving] = useState(false);

  const close = useCallback(
    (fn?: () => void) => {
      setLeaving(true);
      try {
        sessionStorage.setItem(INTRO_KEY, "1");
      } catch {
        /* private mode — fine */
      }
      setTimeout(() => fn?.(), 180); // let the fade land
    },
    []
  );

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setBeat(2);
      return;
    }
    const ids = [setTimeout(() => setBeat(1), 4200), setTimeout(() => setBeat(2), 8400)];
    const key = () => close(onEnter);
    window.addEventListener("keydown", key);
    return () => {
      ids.forEach(clearTimeout);
      window.removeEventListener("keydown", key);
    };
  }, [close, onEnter]);

  return (
    <div
      role="dialog"
      aria-label="Bothy"
      className={`absolute inset-0 z-20 flex flex-col items-center justify-center px-6 transition-opacity duration-200 ${leaving ? "opacity-0" : "opacity-100"}`}
      style={{ background: "color-mix(in oklch, var(--page) 92%, transparent)" }}
      onClick={() => close(onEnter)}
    >
      <div className="max-w-xl space-y-8 text-center">
        {/* beat 1 — the wordmark + definition, same voice as the landing hero */}
        <div className={beat >= 0 ? "fade-up" : "opacity-0"}>
          <h1 className="text-[clamp(3.5rem,9vw,6rem)] font-semibold leading-[0.8] tracking-[-0.075em]" style={{ color: "var(--text-strong)" }}>
            Bothy
          </h1>
          <p className="mono mt-4 text-xs uppercase tracking-[0.22em] sm:text-sm" style={{ color: "var(--cursor)" }}>
            Accountable winter access decisions
          </p>
          <p className="mono mt-6 text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
            both·y &nbsp;/ˈbɒθi/&nbsp; n. Scottish, from Gaelic <em>bothan</em>, “hut”
          </p>
          <p className="mt-3 text-lg leading-relaxed" style={{ color: "var(--text-body)" }}>
            A shelter for walkers caught out in the hills. No booking, no staff —{" "}
            <span style={{ color: "var(--text-strong)" }}>those inside decide together.</span>
          </p>
        </div>

        {/* beat 2 — the turn */}
        {beat >= 1 && (
          <div className="fade-up">
            <p className="text-2xl font-semibold tracking-tight sm:text-3xl" style={{ color: "var(--text-strong)" }}>
              When the warning fails, someone gets a callout.
            </p>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-body)" }}>
              Every winter, drivers strand on Cumbria&apos;s passes — not because no one saw it coming, but because the
              signals lived in five systems and no one had to look at them together. The people who pay are the ones who
              go out at 19:45 in the dark: mountain rescue, duty officers, farmers with a tractor.
            </p>
          </div>
        )}

        {/* beat 3 — the thesis + the door */}
        {beat >= 2 && (
          <div className="fade-up">
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-body)" }}>
              Bothy is not a dashboard. It is a <span style={{ color: "var(--text-strong)" }}>decision case you can rewind</span>{" "}
              — every number cited, every decision signed by a human.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  close(onEnter);
                }}
                className="rounded-lg border-2 px-4 py-2 text-sm font-medium transition-transform active:scale-[0.96]"
                style={{ borderColor: "var(--text-strong)", color: "var(--text-strong)" }}
              >
                Enter the watch room
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  close(onReplay);
                }}
                className="rounded-lg border px-4 py-2 text-sm transition-transform active:scale-[0.96]"
                style={{ borderColor: "var(--rule)", color: "var(--text-body)" }}
              >
                or watch the day happen in 20s
              </button>
            </div>
            <p className="mono mt-6 text-xs" style={{ color: "var(--text-faint)" }}>
              any key to continue · there are bothies for floods, fires and convoys too — same shelter, different hill
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
