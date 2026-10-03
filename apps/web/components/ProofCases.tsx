"use client";

import Link from "next/link";
import { useRef } from "react";
import { CASES } from "../lib/cases";

// Drag-to-scroll rail. Native overflow scrolling stays the source of truth, so
// keyboard, touch, and screen readers work without the pointer handler.
export default function ProofCases() {
  const rail = useRef<HTMLUListElement>(null);
  const drag = useRef({ down: false, x: 0, left: 0, moved: false });

  return (
    <ul
      ref={rail}
      className="proof-rail"
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse" || !rail.current) return;
        drag.current = { down: true, x: e.clientX, left: rail.current.scrollLeft, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d.down || !rail.current) return;
        const dx = e.clientX - d.x;
        if (Math.abs(dx) > 4) d.moved = true;
        rail.current.scrollLeft = d.left - dx;
      }}
      onPointerUp={() => (drag.current.down = false)}
      onPointerLeave={() => (drag.current.down = false)}
      onClickCapture={(e) => {
        if (drag.current.moved) {
          e.preventDefault();
          e.stopPropagation();
          drag.current.moved = false;
        }
      }}
    >
      {CASES.map((c) => (
        <li key={c.id} className="proof-card">
          <Link href={c.href} prefetch draggable={false} className="block h-full p-6">
            <p className="mono text-xs uppercase tracking-widest" style={{ color: "var(--cursor)" }}>{c.kind}</p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight" style={{ color: "var(--text-strong)" }}>{c.name}</h3>
            <p className="mono mt-1 text-xs">{c.place}</p>
            <p className="mt-5 text-sm leading-relaxed">{c.blurb}</p>
            <p className="mono mt-6 text-xs uppercase tracking-wider" style={{ color: "var(--cursor)" }}>Enter →</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
