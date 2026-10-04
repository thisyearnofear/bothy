"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const TARGET = "2026-11-27";

export default function HeroClock() {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => { setDays(Math.ceil((new Date(`${TARGET}T00:00:00Z`).getTime() - Date.now()) / 86_400_000)); }, []);
  return <Link href="/defense/stories/gallium" className="hero-clock" aria-label={days === null ? "Gallium export suspension deadline" : `${Math.abs(days)} days ${days < 0 ? "since" : "until"} the gallium export suspension is scheduled to end`}>
    <span className="story-days" aria-hidden>{days === null ? "··" : Math.abs(days)}</span>
    <span className="hero-clock-text">
      <b>{days !== null && days < 0 ? "days since" : "days until"}</b> China&rsquo;s suspension of its US gallium export ban is scheduled to end, 27 November 2026.
      <span className="mono hero-clock-go">What would your programmes need to know? →</span>
    </span>
  </Link>;
}
