"use client";

import { useId, useRef, useState, type ReactNode } from "react";

export interface Lens { id: string; label: string; caption?: string; content: ReactNode }

/** Switch the working lens without discarding form state in inactive panels. */
export default function LensTabs({ label, items, variant = "reference" }: {
  label: string; items: Lens[]; variant?: "reference" | "gates";
}) {
  const uid = useId();
  const [selected, setSelected] = useState(items[0]?.id);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const active = Math.max(0, items.findIndex((item) => item.id === selected));
  if (!items.length) return null;
  return <div className={`lens-tabs lens-${variant}`}>
    <div className="lens-rail" role="tablist" aria-label={label}>
      {items.map((item, index) => <button key={item.id} ref={(el) => { buttons.current[index] = el; }}
        type="button" role="tab" id={`${uid}-tab-${index}`} aria-controls={`${uid}-panel-${index}`}
        aria-label={item.caption ? `${item.label}: ${item.caption}` : item.label}
        aria-selected={index === active} tabIndex={index === active ? 0 : -1}
        onClick={() => setSelected(item.id)} onKeyDown={(event) => {
          const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
          if (!direction && event.key !== "Home" && event.key !== "End") return;
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + direction + items.length) % items.length;
          setSelected(items[next].id); buttons.current[next]?.focus();
        }}>
        {variant === "gates" && <span className="docref" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>}
        <strong>{item.label}</strong>{item.caption && <span>{item.caption}</span>}
      </button>)}
    </div>
    {items.map((item, index) => <div key={item.id} id={`${uid}-panel-${index}`} role="tabpanel"
      aria-labelledby={`${uid}-tab-${index}`} tabIndex={0} hidden={index !== active} className="lens-panel">
      {item.content}
    </div>)}
  </div>;
}
