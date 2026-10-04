export const BEAT_MS = 8000;
export const playbackRemaining = (deadline: number, now: number) => Math.max(0, Math.min(BEAT_MS, deadline - now));
export const playbackSeconds = (remaining: number) => Math.ceil(Math.max(0, remaining) / 1000);
