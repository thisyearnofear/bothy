"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

// Deterministic offsets so server and client render identical markup.
const rand = (seed: number) => { const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; };

export default function ScatterHeading({ text, className, style }: { text: string; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) { setVisible(true); return; }
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); io.disconnect(); } }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const total = text.replace(/\s/g, "").length;
  let index = 0;
  return <h1 ref={ref} className={className} style={style} aria-label={text}>
    {text.split(" ").map((word, w) => <span key={w} aria-hidden style={{ display: "inline-block", whiteSpace: "nowrap", marginRight: "0.28em" }}>
      {[...word].map((letter, l) => {
        const i = index++;
        const style: CSSProperties = visible
          ? { transitionDelay: `${(i / total) * 380 + Math.abs(rand(i + 7)) * 220}ms` }
          : { transform: `translate3d(${rand(i + 1) * 0.9}em, ${rand(i + 3) * 0.7}em, 0) rotate(${rand(i + 5) * 24}deg)`, opacity: 0, filter: "blur(6px)" };
        return <span key={l} className="scatter-letter" data-in={visible} style={style}>{letter}</span>;
      })}
    </span>)}
  </h1>;
}
