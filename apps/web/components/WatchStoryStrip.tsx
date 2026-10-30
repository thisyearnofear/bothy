import type { RiskSnapshot } from "../../../packages/shared/src/types";

/** One-line story: "<route> is <label>: <headline> <score>". Extracted from
 *  app/watch/page.tsx — render only. */
export default function WatchStoryStrip({ name, snap, color, headline }: {
  name: string;
  snap: RiskSnapshot;
  color: string;
  headline: string;
}) {
  return (
    <section
      className="stage-in mb-4 rounded-lg border px-4 py-3"
      style={{ borderColor: "var(--rule)", background: "var(--panel)", ["--stage" as string]: 0 }}
    >
      <p className="max-w-5xl text-base leading-relaxed" style={{ color: "var(--text-body)" }}>
        {name} is{" "}
        <span className="font-semibold" style={{ color }}>
          {snap.label}
        </span>
        : {headline}{" "}
        <span className="mono tnum" style={{ color }}>
          {snap.score.toFixed(2)}
        </span>
      </p>
      {/* no citation chips here — the sentence names the top signals and
          "Why this rank" beside it carries the weights; chips were a repeat */}
    </section>
  );
}
