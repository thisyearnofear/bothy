import type { Beat } from "../lib/stories";
import type { GraphRun } from "../lib/api";

export default function StoryVisual({ beat, index, days, run }: { beat: Beat; index: number; days: number | null; run: GraphRun | null }) {
  const row = run?.rows[0];
  return <figure className={`story-visual visual-${beat.act ? "task" : index === 0 ? "notice" : index === 1 ? "restriction" : "window"}`} aria-label="Gallium briefing illustration">
    <figcaption className="visual-caption"><span className="docref">{beat.act ? "Synthetic exposure / captured sample" : "Public policy / schematic"}</span><span className="docref">0{index + 1}</span></figcaption>
    {beat.act ? <>
      <div className="visual-deadline"><span className="visual-number">{days === null ? "—" : Math.abs(days)}</span><div><strong>{days !== null && days < 0 ? "Days since" : "Days remaining"}</strong><span>27 November 2026</span><small>US-specific suspension schedule, not a universal procurement deadline</small></div></div>
      <ol className="visual-chain">{[["Material", "g.name"], ["Component", "c.name"], ["Platform", "p.name"]].map(([label, key]) => <li key={key}><span className="docref">{label}</span><strong>{row && typeof row[key] === "string" ? String(row[key]) : "Awaiting captured evidence"}</strong></li>)}</ol>
      <p className="hint">Grouped hierarchy, not direct edges. Inventory and qualified alternatives remain unverified.</p>
    </> : index === 0 ? <>
      <div className="policy-notice"><span className="docref">Export licensing / announced</span><strong>Ga <span>+ Ge</span></strong><div className="notice-rule" /><p>Gallium &amp; germanium</p><span className="notice-stamp">Licensing required</span></div>
      <div className="notice-runway"><b>{days ?? "29"}</b><span>days of notice</span><span className="runway-line" aria-hidden="true" /><span>1 Aug 2023<br />takes effect</span></div>
    </> : index === 1 ? <>
      <div className="restriction-route"><div><span className="docref">Origin</span><strong>China</strong></div><div className="route-stop" aria-hidden="true"><span /><b>×</b><span /></div><div><span className="docref">Destination</span><strong>United States</strong></div></div>
      <p className="restriction-word">Prohibited</p><p className="hint">Gallium · germanium · antimony · superhard materials</p><p className="docref">Announcement No. 46 / 3 December 2024</p>
    </> : <>
      <div className="window-label"><span className="docref">Suspended ≠ lifted</span><strong>{days ?? "383"} <small>days</small></strong></div>
      <div className="policy-window"><span>9 Nov 2025</span><div aria-hidden="true"><i /><i /><i /><i /><i /></div><span>27 Nov 2026</span></div>
      <p className="window-warning">Military end-user prohibition remains</p><p className="hint">A temporary US-specific policy window, not unrestricted military access.</p>
    </>}
  </figure>;
}
