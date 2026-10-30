/** Watch-room footer: provenance line + the configured provider ids.
 *  Extracted from app/watch/page.tsx — render only. */
export default function WatchFooter({ scenarioId, compact, providers }: {
  scenarioId: string | null | undefined;
  compact: boolean;
  providers: { id: string }[];
}) {
  return (
    <footer className="mono mt-4 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs" style={{ color: "var(--text-faint)" }}>
      {/* the case switch lives in the header (CaseSwitch) and NextDoors —
          a third swap link here only duplicated them */}
      <span>
        {scenarioId === "live"
          ? `live context · map © OpenStreetMap`
          : scenarioId === "flood"
            ? `generalization proof · EA river gauges · map © OpenStreetMap`
            : "illustrative replay · modeled signals · map © OpenStreetMap"}
        {!compact && (providers.length ? ` · ${providers.map((p) => p.id).join(", ")}` : " · scripted")}
      </span>
    </footer>
  );
}
