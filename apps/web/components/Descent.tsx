"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// One layer of the dependency chain, in the order Bothy models it
// (docs/edth-dependency-visual-spec.md). Imagery is illustrative only.
const LAYERS = [
  { key: "Platform", img: "/descent/1-platform.jpg", line: "Start with the programme.", sub: "Which platforms are in scope?" },
  { key: "System", img: "/descent/2-system.jpg", line: "Open the system.", sub: "Subsystems and assemblies, each one a stored row." },
  { key: "Assembly", img: "/descent/3-assembly.jpg", line: "Follow it down to the board.", sub: "Every hop keeps its source version." },
  { key: "Component", img: "/descent/4-component.jpg", line: "To a single part.", sub: "Where the dependency stops being abstract." },
  { key: "Material", img: "/descent/5-material.jpg", line: "To the material inside it.", sub: "Gallium. Germanium. The element, not the vendor." },
  { key: "Source", img: "/descent/6-source.jpg", line: "To where it comes from.", sub: "Then back up, with a named owner for the next check." },
] as const;

export default function Descent() {
  const wrap = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    gsap.registerPlugin(ScrollTrigger);

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const layers = gsap.utils.toArray<HTMLElement>("[data-layer]", el);
      const caps = gsap.utils.toArray<HTMLElement>("[data-cap]", el);
      const last = layers.length - 1;

      gsap.set(layers.slice(1), { opacity: 0, scale: 0.55 });
      gsap.set(caps.slice(1), { opacity: 0, y: 40 });

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.6,
          onUpdate: (self) => setActive(Math.round(self.progress * last)),
        },
      });

      layers.forEach((layer, i) => {
        if (i < last) {
          tl.to(layer, { scale: 2.4, opacity: 0, ease: "power1.in", duration: 1 }, i);
          tl.fromTo(layers[i + 1], { scale: 0.55, opacity: 0 }, { scale: 1, opacity: 1, ease: "power1.out", duration: 1 }, i);
        }
        if (i > 0) tl.to(caps[i], { opacity: 1, y: 0, duration: 0.25 }, i - 0.4);
        if (i < last) tl.to(caps[i], { opacity: 0, y: -30, duration: 0.25 }, i + 0.15);
      });
      tl.to({}, { duration: 0.5 }); // hold on the last layer
    });

    return () => mm.revert();
  }, []);

  return (
    <div ref={wrap} className="descent" aria-label="Descent through the dependency chain">
      <div className="descent-stage">
        {LAYERS.map((l) => (
          <img key={l.key} data-layer src={l.img} alt="" loading="lazy" decoding="async" className="descent-layer" />
        ))}
        <div className="descent-scrim" aria-hidden />

        {LAYERS.map((l, i) => (
          <div key={l.key} data-cap className="descent-cap">
            <p className="eyebrow">
              {String(i + 1).padStart(2, "0")} · {l.key}
            </p>
            <h2 className="mt-4 text-[clamp(2.25rem,7vw,5.5rem)] font-semibold leading-[0.95] tracking-[-0.05em]" style={{ color: "var(--text-strong)" }}>
              {l.line}
            </h2>
            <p className="mt-5 max-w-md text-sm sm:text-base">{l.sub}</p>
          </div>
        ))}

        <ol className="descent-rail mono" aria-hidden>
          {LAYERS.map((l, i) => (
            <li key={l.key} data-on={i === active ? "true" : "false"}>
              {l.key}
            </li>
          ))}
        </ol>
        <p className="mono descent-note">Illustrative imagery · synthetic chain</p>
      </div>
    </div>
  );
}
