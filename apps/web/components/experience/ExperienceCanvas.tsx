"use client";

import { useEffect, useRef, useState } from "react";
import type { SceneHandle, ScenePhase, SpecimenStage } from "../../lib/experienceScene";
import styles from "./experience.module.css";

interface Props {
  phase: ScenePhase;
  specimen: SpecimenStage[] | null;
  highlight: string | null;
  onPick: (column: string) => void;
  reducedMotion: boolean;
}

export default function ExperienceCanvas({ phase, specimen, highlight, onPick, reducedMotion }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const pickRef = useRef(onPick);
  const motionRef = useRef(reducedMotion);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  pickRef.current = onPick;
  motionRef.current = reducedMotion;

  useEffect(() => {
    let alive = true;
    let latchedFailed = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const controller = new AbortController();
    setStatus("loading");
    import("../../lib/experienceScene")
      .then((mod) => {
        if (!alive || latchedFailed || !canvas.isConnected) return null;
        return mod.createScene(canvas, {
          onPick: (column) => { if (alive && !latchedFailed) pickRef.current(column); },
          onContextLost: () => { if (alive) { latchedFailed = true; setStatus("failed"); } },
          reducedMotion: () => motionRef.current,
          signal: controller.signal,
        });
      })
      .then((handle) => {
        if (!alive || latchedFailed || controller.signal.aborted) { handle?.dispose(); return; }
        if (handle) { sceneRef.current = handle; setStatus("ready"); }
        else setStatus("failed");
      })
      .catch(() => { if (alive && !latchedFailed) setStatus("failed"); });
    return () => {
      alive = false;
      controller.abort();
      sceneRef.current = null;
    };
  }, [attempt]);

  useEffect(() => { if (status === "ready") sceneRef.current?.setSpecimen(specimen); }, [specimen, status]);
  useEffect(() => { if (status === "ready") sceneRef.current?.setPhase(phase); }, [phase, status]);
  useEffect(() => { if (status === "ready") sceneRef.current?.highlight(highlight); }, [highlight, status]);
  useEffect(() => { if (status === "ready") sceneRef.current?.setPhase(phase); }, [reducedMotion]);

  return (
    <div className={styles.canvasWrap}>
      {status !== "ready" && (
        <img src="/experience/terrain/terrain-fallback.svg" alt="" aria-hidden="true" className={styles.fallbackImg} />
      )}
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" hidden={status === "failed"} />
      {status === "failed" && (
        <div className={styles.canvasNote} role="status">
          <p>3D scene unavailable; the illustrative terrain still applies. The investigation below is unaffected.</p>
          <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => setAttempt((n) => n + 1)}>
            Retry 3D
          </button>
        </div>
      )}
      {status === "loading" && <p className={styles.canvasNote} role="status">Loading 3D atmosphere…</p>}
    </div>
  );
}
