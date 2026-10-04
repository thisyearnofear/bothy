"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** Native modal semantics provide focus containment and Escape dismissal. */
export default function Inspector({ label, title, children, disabled = false, onOpen }: {
  label: string; title: string; children: ReactNode; disabled?: boolean; onOpen?: () => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const panel = dialog.current;
    if (!panel) return;
    if (!panel.open) panel.showModal();
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = previous; };
  }, [open]);

  return <>
    <button ref={trigger} type="button" className="inspect-trigger" aria-haspopup="dialog" aria-controls={id}
      disabled={disabled} onClick={() => { onOpen?.(); setOpen(true); }}>
      <span>{label}</span><span aria-hidden="true">↗</span>
    </button>
    <dialog ref={dialog} id={id} className="inspector" aria-labelledby={`${id}-title`}
      onClose={() => { setOpen(false); trigger.current?.focus(); }}>
      <div className="inspector-head">
        <div><p className="docref">Inspection / reference</p><h2 id={`${id}-title`}>{title}</h2></div>
        <button type="button" className="btn" onClick={() => dialog.current?.close()} aria-label={`Close ${title}`}>Close ×</button>
      </div>
      <div className="inspector-body">{children}</div>
    </dialog>
  </>;
}
