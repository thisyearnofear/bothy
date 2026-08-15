# Design language & interface craft

The concept (Decide-Replay) lives in [dashboard.md](dashboard.md). This file is
the *craft* layer: how Bothy should look, move, and prioritise a decision.

- [impeccable](https://github.com/pbakaus/impeccable) — useful anti-pattern
  detectors for AI-slop and finish quality.
- [make-interfaces-feel-better](https://github.com/jakubkrehel/make-interfaces-feel-better)
  — useful principles for micro-interactions, hierarchy, and optical alignment.

## Mood: a situation room at 02:00

Cold, low-light, high contrast. Bothy is a shelter that is already watching the
hill: the interface should feel spatial and alive, but never distract from the
named person making the decision. The default is cool neutral slate; saturated
colour belongs to risk severity, with a restrained sky cursor for active time
and signal pins.

This is not a ban on atmosphere. Avoid generic purple gradients, neon fields,
glassmorphism, ubiquitous glow, and animation that has no job. Use actual
route, terrain, and evidence geometry to create atmosphere instead.

### Tokens (OKLCH, cool neutral ramp)

| token | value-ish | use |
|---|---|---|
| page | `10% 0.01 250` | ground / ambient map fallback |
| panel | `13-15% 0.01 250` | cards and decision records |
| rule | `22-24% 0.01 250` | structural dividers and selected states |
| text | 92% neutral · muted 65% · faint 55% | type hierarchy |
| severity | green → amber → orange → red (`lib.riskColor`) | risk **only** |
| cursor | cool sky, ~1px | active time, route cursor, signal pins |

- **Risk colour maps only to risk.** Approval is an official ledger treatment:
  bordered status, actor, and timestamp; it is not a green success state.
- **Colour + text label always.** Every severity has a word (`HIGH`,
  `ELEVATED`, and so on), never colour alone.

### Type and surfaces

- **Numerics, IDs, timestamps, scores:** monospace + `tabular-nums`. Equal-width
  digits stop the score/time from jiggling while the timeline moves.
- Headlines/body use system sans. One font for instruments, one for reading.
- Use concentric radii: outer radius = inner radius + padding.
- Use borders for structure/state and restrained shadows for depth. Avoid wide,
  nested-card walls; a decision record can be a solid, quiet surface.

## Workspace geometry

A watch room supports one decision, not a wall of widgets. Let the screen answer
three questions at a glance:

1. **What needs attention?** The route-priority rail ranks all routes at the
   replay cursor and keeps low-risk routes visible as a credibility line.
2. **What is happening and when did it become clear?** The map is the visual
   centre; the timeline lives directly below it as the replay controller, not
   as a detached analytics chart.
3. **What can the named officer approve?** The decision case is a distinct
   record beside the map, showing the horizon-bound draft, evidence, actor,
   and audit gate.

On wide screens, compose these as adjacent rails: priority | map + replay |
decision record. The map receives the most width. On narrow screens, present the
map and replay first, then the priority queue, then the decision record; this
preserves the visual story without forcing horizontal controls or hidden data.
The header is a compact command bar: scenario identity, replay mode, and only
operator controls.

## Motion and spatial atmosphere

Motion is allowed when it describes time, location, state, or causality. It
must stay deterministic from the replay data, remain interruptible, and settle
under `prefers-reduced-motion`.

| element | spec |
|---|---|
| Score/curve update | `ease-out`, **≤300 ms**, interruptible. Stepping feels like a seismograph tick. |
| Timeline scrubbing | **1:1 direct**. The pointer is the cursor; no delayed cinematic scrub. |
| Signal lands → pin | `opacity`/`blur`/`scale` (0→1, 4→0px, 0.25→1), ~200ms `ease-out`. |
| Route focus | camera moves to the selected corridor; short during replay, one longer settle on an explicit route change. |
| Approve | `active:scale-[0.96]`; a ledger receipt settles in, then the audit row appends. |
| Replay | opt-in; playhead, map, and pins advance together. Reduced motion falls back to a manual beat step. |
| Ambient map | non-interactive, very slow drift behind framing copy; never conveys a risk state or competes with controls. |

### Interaction boundaries — two surfaces, two laws

Bothy has exactly two kinds of surface, and motion law differs between them:

1. **Operational surfaces (the watch room).** *Time is the controller.* The
   scrubber and replay are the only things that advance the decision lens.
   Scroll inside the watch room may never drive time, pin content, hijack
   input, or restate the replay. This is non-negotiable: an officer under
   pressure must own the lens.
2. **Storytelling surfaces (the landing page, any narrative page).** *Scroll is
   a legitimate time surrogate.* The reader's scroll position may drive a
   camera flight, ink reveal, or copy staging — the Codrops "pinned map
   cinema" pattern is allowed here in a Bothy-legal form.

**Bothy-legal scroll cinema** means all of:

- **Native scroll only.** The page scrolls normally; sections are real document
  flow. No `position: fixed` body-lock, no GSAP ScrollTrigger pin/scrub, no
  wheel/touch capture. If the library needs to hijack scroll to work, the
  technique is wrong, not the rule.
- **Camera keyframes, not scrubbed frames.** Section anchors define discrete
  camera states (centre / zoom / bearing / pitch). On section change the map
  performs one interruptible `easeTo` (≤ 700ms, focus/expo easing). We do not
  sample scroll position every pixel and scrub the camera 1:1 — that produces
  the jank the pattern is infamous for. Scroll picks the *keyframe*; the camera
  flies there on its own.
- **Progressive enhancement.** Without JS or with tiles unavailable, the page
  is a complete, readable document. With `prefers-reduced-motion`, the camera
  jumps between keyframes with no flight and copy appears without staging.
- **Assets stay local-or-tiled.** Atmosphere comes from MapLibre tiles and our
  own geometry (route ink, pins), never from third-party hero images or
  external webfonts — the flake-wifi rule applies to decoration too.
- **One direction of influence.** Scroll may move the camera; the camera never
  moves the page. No scroll-snap traps, no forced scrolling to reveal a door.

**Runtime stance:** CSS + MapLibre + rAF + the View Transitions API remain the
default and are sufficient for every pattern in this document. A choreography
library (GSAP or similar) is permissible only for an isolated, non-critical
presentation sequence that produces a concrete benefit CSS/MapLibre cannot,
never captures scrolling, and has an equivalent reduced-motion state. Do not
add one merely to decorate the product.

### Atmospheric map backdrop

The most atmospheric moment is the framing page: let a dim, slowly drifting map
of the fells sit behind the copy so the shelter is already watching the hill.
This is an on-thesis visual, not a generic dark background.

- It is `aria-hidden`, non-interactive, and visually subdued enough for text to
  pass contrast checks without blur or glass layers.
- Drift occurs on a tens-of-seconds timescale. It pauses completely when reduced
  motion is requested.
- On storytelling surfaces the drift yields to scroll keyframes (above): the
  ambient patrol is what the camera does while the reader is still; section
  changes are what it does when they move.
- The map uses the same MapLibre language as the watch room, so the visual
  transition into the decision workspace feels earned.
- Dimming compounds: effective luminance = raster brightness × scrim
  transparency. Keep the product above ~0.3 so the fells read as terrain, not
  void.
- If terrain tiles are unavailable, retain a flat neutral surface and all copy,
  controls, and navigation.

## Cinematic map primitives

Borrow the language of map cinema; on operational surfaces borrow none of its
scroll mechanics:

| primitive | Bothy adaptation |
|---|---|
| map establishes place | a dim ambient background on the framing page; the watch room map remains interactive and evidence-led |
| camera follows a mark | the timeline cursor moves a route marker and gently follows the selected corridor |
| path draws itself | selected route ink reveals to the cursor; risk controls its colour and weight |
| signal arrives | a timestamped pin lands with its citation as the replay crosses the beat |
| focus changes | selecting a route performs one deliberate camera settle, not a perpetual camera tour |
| reported outcome | the backtest horizon becomes a hatched boundary; the sourced outcome stays ghosted until revealed, then the camera may hop once onto the outcome point |
| camera flight between scenes | landing sections define keyframes; entering the watch room may use a same-document or cross-document View Transition so the window becomes the instrument |

### Motion beats for the demo

- Landing flight: fells wide → descend toward the corridor → settle over the
  pass as the thesis appears → the door opens into the watch room.
- Replay: signals land, route ink grows, and the decision record stays pinned to
  the scenario horizon.
- On approval: one short settle, then quiet; the audit line becomes the receipt.
- Backtest reveal: crossing the horizon activates the sourced outcome without
  altering the frozen risk assessment; one beacon and, at most, one camera hop
  onto the outcome point.

## States to design explicitly

`loading` (first paint, skeleton in the shape of the room) · `empty` (no
scenario) · `error` (agent down / DB) · `reasoning` (agent trace streaming, the
room spotlights the trace) · `scrubbing` (time cursor) · `awaiting-approval` →
`approved`/`rejected` · `backtest` (hatched "agent's view ends here"; outcome
desaturated until the cursor crosses it).

## Motion budget

Use tokens rather than ad-hoc timings:

- durations: micro 80ms · standard 240ms · expressive 700ms · ambient 45-90s
- easings: base `cubic-bezier(.4,0,.2,1)` · focus/expo
  `cubic-bezier(.16,1,.3,1)` · settle `cubic-bezier(.2,.3,.2,1)`
- stagger: semantic chunks at ~120ms; reduced motion collapses timing to ~0

Keep movement fast and short for interactive states; ambient movement should be
slow enough to be felt rather than watched. Never use spring-bounce, 3D flips,
or ornamental motion that obscures a timestamp, score, or approval action.

## Locked tokens

Surfaces (OKLCH, cool neutral; test on a washed-out projector and bump the rule
when needed):

- page `oklch(13% 0.008 255)` · panel `oklch(17% 0.008 255)` · rule
  `oklch(28% 0.008 255)`
- text: strong `oklch(92% 0 0)` · body `oklch(70% 0 0)` · faint
  `oklch(52% 0 0)`
- LOW `oklch(72% 0.16 155)` · MODERATE `oklch(80% 0.14 85)` · ELEVATED
  `oklch(72% 0.17 55)` · HIGH `oklch(64% 0.21 25)`
- cursor `oklch(75% 0.11 230)`

Font/icon policy: system sans (`ui-sans-serif, system-ui, -apple-system, Segoe
UI`) plus `ui-monospace` only. Avoid a webfont download as a single point of
failure. Prefer a few inline SVG icons over a large icon dependency.
