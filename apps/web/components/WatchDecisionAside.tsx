"use client";

import type { ComponentProps } from "react";
import Detail from "./Detail";

type DetailProps = ComponentProps<typeof Detail>;

/** Right rail: the sticky decision case around Detail. Extracted from
 *  app/watch/page.tsx — state stays with the page; this is render only. */
export default function WatchDecisionAside(props: DetailProps) {
  return (
    <aside
      aria-label="Decision case"
      className="stage-in order-2 xl:order-3 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto xl:self-start"
      style={{ ["--stage" as string]: 3 }}
    >
      <section id="decision-case" className="rounded-lg border p-4" style={{ borderColor: "var(--rule)", background: "var(--panel)" }}>
        <Detail {...props} />
      </section>
    </aside>
  );
}
