---
workflow: general-video
flow: companion
storyboard: yes
message: "Agents, but accountable — a hill rest → wake arc with the human gate as the hero."
destination: hackathon-submission
aspect: 16:9
length: "4:30 (hard cap 5:00)"
language: en-GB
audience: AWS Agents-for-Humans judges; secondary duty teams + upland community
voice: en-GB, measured, quietly authoritative, no breathless AI demo cadence
narrative: arc
angle: live-takes-only; no slides; HyperFrames composited over real browser recordings
title: "Bothy — Agents, but accountable"
subtitle: "AWS Agents for Humans hackathon · bothy.trustfall.xyz"

## Intent

A 4:30 demo for the AWS Agents-for-Humans hackathon. The product is Bothy — an evidence-backed, human-approved winter-access decision agent for UK upland roads. The video must show the agent working end-to-end against the live production system at https://api.bothy.trustfall.xyz (web at https://bothyapp.netlify.app), and it must answer three judging anchors visibly on screen: (1) **the problem** — duty teams drown in fragmented winter signals; (2) **who it's for** — parish clerks, school offices, food banks, district resilience teams; (3) **why it matters** — hours of monitoring become one signed decision with receipts.

The telling is **rest → wake → accountable gate → generalize → close**. We deliberately open on a *quiet* room at dawn (no emergency) and let the agent wake up as the day unfolds — different from the standard "alarm + dashboard" demo format. The hero beat is the human Approve: the agent drafts, a named duty officer signs, nothing publishes alone. Every number on screen is live from the API and re-verified before recording.

## Customizations

- **Form:** general-video (HyperFrames composition), custom 1440p 16:9, single paused GSAP timeline, framework-owned media.
- **Capture:** 5 live browser takes via `agent-browser` against the deployed web at bothyapp.netlify.app. No slides, no mockups, no After Effects.
- **Composition treatment:**
  - Title cards / lower-thirds / closer / "Agents, but accountable." card are HTML+CSS, animated with GSAP.
  - Audio-reactive timeline ticker for the day-of arc (beep on each cited event as it lands).
  - Subtle CRT/darkroom vignette on screen takes; no logoscroll, no chart fly-ins.
  - A "rest" pre-beat overlay (animated breath dot, room monitor) opens the piece so the audience *feels* the room before any data appears.
- **Storyboard shape:** the 6-beat table in `docs/hackathon-agents-for-humans.md` §6 is the spine. Per-shot narration lines, gotchas, and pre-record verification commands are all in that file — re-run before recording.
- **VO:** English, en-GB, measured, quiet authority. ElevenLabs key plugged in once the silent cut is approved. Voiceover recorded AFTER screen takes so pacing is exact.
- **BGM:** stock ambient/electronic bed from HyperFrames media catalog at low gain; voiceover carve applied. Final bed chosen on the silent-cut pass.
- **Accounting hook on camera:** the shot list calls for the duty officer name `Demo Officer · Hackathon Take` to be visible on the audit receipt line so it's clearly not a real signoff (still satisfies the "named officer" rule). Strands `provenanceGuard` line is flashed on screen for ~10s as proof of "thorough Strands use."

## Deferred asks (after silent cut)

- ElevenLabs key (user has one, will hand over when happy with the silent cut).
- BGM track preference (default: stock ambient bed).
- Optional cloud-render in HyperFrames Cloud for hero-quality upscale if the local MP4 needs it.

## Run shape

- Companion flow with live storyboard — user reviews the silent MP4 before VO/BGM are added.
- First pass: silent cut, 4:30, voiceover text shown as captions so timing reads on screen.
- User gates: (1) silent cut approval → (2) VO+BGM pass → (3) final render.

## Notes

- Live API numbers (verified 2026-09-14):
  - A66 timeline: 02-11 LOW 0.18 → 02-12 04:00 MODERATE 0.32 → 09:00 ELEVATED 0.71 → 19:00 HIGH 0.86 → 19:30 HIGH 0.97.
  - Horizon at 21:30: A66 HIGH 0.97 with 6 citations.
  - Lead time: 09:00 ELEVATED → 23:40 outcome = 14h 40m.
  - Live: A5094 + B5311 both HIGH 0.97 (good "live desk" content for opening rest state).
  - Subscriptions: 2 already (chip will read "2 neighbours on watch").
- Strands providers live: Qwen + Venice. Strands trace line should show on the Approve shot; fall through to scripted if Qwen cold (document this in §6.2).
- Pre-record checklist lives in `docs/hackathon-agents-for-humans.md` §6.1 — re-run before pressing record.