"use client";

import { useEffect, useState } from "react";

const stamp = (d: Date) => `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}Z`;

// Honest marking: this is a demo on public data, so the banner says so rather than borrowing a real classification.
export default function MarkingBar() {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setNow(stamp(new Date()));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);
  return <div className="marking no-print" role="note">
    <span><b>Demonstration</b> · public data · not approved analysis</span>
    <span className="tnum" aria-label="Current UTC time">{now ?? "----------"}</span>
  </div>;
}
