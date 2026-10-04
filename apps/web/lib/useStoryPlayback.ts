"use client";

import { useEffect, useRef, useState } from "react";
import { BEAT_MS, playbackRemaining } from "./storyPlayback";

export function useStoryPlayback(last: number, autoplay: boolean) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [remaining, setRemaining] = useState(BEAT_MS);
  const [finished, setFinished] = useState(false);
  const started = useRef(false);
  const left = useRef(BEAT_MS);
  const deadline = useRef<number | null>(null);

  useEffect(() => {
    if (autoplay && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      started.current = true;
      setPlaying(true);
    }
  }, [autoplay]);

  useEffect(() => {
    if (!autoplay && index >= last) { setPlaying(false); setFinished(true); }
  }, [autoplay, index, last]);

  useEffect(() => {
    if (!playing || index >= last) { deadline.current = null; return; }
    const end = performance.now() + left.current;
    deadline.current = end;
    const tick = setInterval(() => setRemaining(playbackRemaining(end, performance.now())), 100);
    const advance = setTimeout(() => {
      left.current = BEAT_MS;
      setRemaining(BEAT_MS);
      setIndex((value) => Math.min(last, value + 1));
    }, left.current);
    return () => { clearInterval(tick); clearTimeout(advance); };
  }, [playing, index, last]);

  const pause = () => {
    if (deadline.current !== null) {
      left.current = playbackRemaining(deadline.current, performance.now());
      setRemaining(left.current);
    }
    setPlaying(false);
  };
  const go = (next: number) => {
    started.current = true;
    left.current = BEAT_MS;
    deadline.current = null;
    setRemaining(BEAT_MS);
    setIndex(Math.max(0, Math.min(last, next)));
    setFinished(false);
    setPlaying(false);
  };
  const play = () => {
    if (finished || (index >= last && !autoplay)) { go(0); setPlaying(true); return; }
    if (!started.current) {
      started.current = true;
      setIndex((value) => Math.min(last, value + 1));
    }
    setPlaying(true);
  };
  return { index, playing, remaining, finished, go, pause, play,
    reset: () => { go(0); started.current = false; },
    complete: () => { setFinished(true); setPlaying(false); },
  };
}
