# Design language & interface craft

The concept (Decide‑Replay) lives in [dashboard.md](dashboard.md). This file is
the *craft* layer: how it should look and feel, grounded in these references:

- [impeccable](https://github.com/pbakaus/impeccable) — 59 concrete anti‑pattern
  detectors: AI‑slop (bounce‑easing, purple gradients, dark glows, glass), plus
  quality (line length, cramped padding, touch targets, skipped headings).
- [make-interfaces-feel-better](https://github.com/jakubkrehel/make-interfaces-feel-better)
  — micro‑interactions: concentric radii, optical alignment, shadows vs borders,
  motion restraint, tabular numbers.
- [aura.build components](https://www.aura.build/browse/components) — a component
  gallery for art‑direction reference (page is JS‑only; browse it visually).

## Mood: a situation room at 02:00

Cold, low‑light, high contrast. The **only** saturated colour is risk severity
(and a barely‑used cursor line). Everything else is neutral slate. This is the
deliberate opposite of "generic AI‑tool glow" (impeccable: *no purple gradients,
no neon‑cyan fields, no glassmorphism, no bounce‑ease, no pure black/white*).

### Tokens (OKLCH, cool neutral ramp)

| token | value-ish | use |
|------|-----------|-----|
| page | `10% 0.01 250` | ground |
| panel | `13–15% 0.01 250` | cards |
| rule | `22–24% 0.01 250` | 1px dividers / borders |
| text | 92% neutral · muted 65% · faint 55% | type |
| severity | green → amber → orange → red (`lib.riskColor`) | risk **only** |
| cursor | cool sky, ~1px | active time + signal pins |

- **Risk colour maps only to risk.** Approval is *not* green (that collides with
  LOW risk). Approval is an official "ledger" treatment: bordered status chip +
  actor + timestamp, neutral with a strong border.
- **Colour + text label always** (impeccable & a11y): every severity uses an
  accompanying word (`HIGH`, `ELEVATED`, …), never colour alone.

### Type

- **Numerics, IDs, timestamps, scores: monospace + `tabular-nums`.** Equal‑width
  digits stop the risk score/time from jiggling while the timeline scrubs
  (make-interfaces-feel-better: *tabular numbers*).
- Headlines/body: system sans. One font for instruments, one for reading.

### Surfaces

- **Concentric radii**: outer `= inner + padding` (inner elements never look
  pinched).
- **Shadows for elevation, borders for structure/state**: layered transparent
  `box-shadow` for depth; keep borders for dividers and *selected / approved /
  focus* states (make-interfaces-feel-better #3).
- Cards are **compact, flat, sharply bounded** — no wide/nested cards, no glass.

## Motion & micro‑interactions (applied to Decider)

Rules from make‑interfaces‑feel‑better, mapped to our specific elements:

| element | spec |
|---------|------|
| Score/curve update | `ease-out`, **≤300 ms**, interruptible (CSS transition, not keyframes). Stepping feels like a seismograph tick. |
| Timeline scrubbing | **1:1 direct** (no lag, no long tween) — the pointer is the cursor. |
| Signal lands → pin | animate in with `opacity`/`blur`/`scale` (0→1, 4→0 px, 0.25→1), ~200 ms `ease-out`; position pinned at the x‑coordinate. |
| Enter/exit panels | stagger semantic chunks by ~100 ms; exits = small fixed `translateY`, softer than enters, `ease-out`. |
| Approve press | `active:scale-[0.96]` (never below 0.95); don't invert layout on press. |
| Approve success | a **ledger receipt** slides in (`translateY`, `ease-out`): `Status · 15/8 14:02 · Cumbria CC Winter Duty Officer`; audit row appends after ~100 ms. Official and final, like a stamp. |
| "Awaiting duty officer" | subtle pulse on the Approve control only (restraint — one active object). |
| Replay (auto‑play) | opt‑in; playhead eases with a gentle `cubic-bezier`; **disabled under `prefers-reduced-motion`** (falls back to a manual scrub). |

### Do / don't

**Do:** tabular numerics; optical centring on icon buttons; small touch targets
≥ 44px; lay out in the existing styling system (Tailwind) only; review by
playing motion at **10% speed** and walking every state (hover, focus, active,
loading, empty, error).

**Don't:** spring‑bounce easings (`bounce: 0` always); purple/gradient overlays;
dark glows on every card; glass blur behind panels; plain‑black/white; digital
clock‑style jiggle; animate things that aren't interactive.

## States to design (each one explicitly)

`loading` (first paint) · `empty` (no scenario) · `error` (agent down / DB) ·
`reasoning` (agent trace streaming) · `scrubbing` (time cursor) ·
`awaiting-approval` → `approved`/`rejected` · `backtest` (hatched "agent's view
ends here"; the reported outcome is desaturated/ghosted until the cursor crosses
it — an epistemic-honesty cue that doubles as the reveal).
## Cinematic map primitives (borrowed from Codrops "Dark Cluster")

A scroll-driven map-cinema demo (GSAP + ScrollTrigger + motionPath: a pinned map,
a dot travels a path, the camera follows it, the path draws itself, the map
expands to focus). We borrow its motion language but drive it with time, not
scroll, so Rewind stays the controller.

| borrowed | our adaptation |
|---|---|
| pinned map; camera follows the mark | timeline cursor pans/zooms the map (MapLibre easeTo) toward the top-risk route |
| path draws itself (DrawSVG) | selected route polyline reveals up to the cursor; risk = stroke colour+width (risk-as-ink) |
| a dot riding a path | a small risk-cursor marker drifting to the peak-risk location as you scrub |
| map expand / collapse | select a route, focus its corridor with incident+historical pins; toggle back to overview |
| expo easing | snappy cubic-bezier(0.16,1,0.3,1); direct scrub, <=300ms, interruptible |
| scale settle-pulse | quick scale 1->1.04->1 / camera ease + beacon flash, only on threshold cross and on Approve |
| pinned hero info card | decision case stays pinned beside the living map; a subtle "card of record" on the audit line |

### Motion beats for drama (all cheap)
- Replay = a slow camera fly-through of the day: signals ping, the path draws,
  ending on a settle + "Awaiting duty officer".
- On Approve: one quick settle pulse, then quiet.
- Backtest reveal: crossing the agent horizon fires a beacon flash and hops the
  camera onto the actual-outcome point while the hatched band fades to ghost.

### Implementation notes
- MapLibre easeTo/flyTo/jumpTo are our camera - we do NOT need GSAP for the map.
  Drive with requestAnimationFrame, throttled, cubic-bezier easing, and always
  snap to the final state under prefers-reduced-motion.
- Self-draw: animate line-dasharray/line-dashoffset for a traveling "signal
  pulse" on the line (more on-thesis than drawSVG), or pad coordinates to the
  elapsed fraction for a true grow.
- Reject scroll-jank (pin + scrub): hijacking scroll reduces judge control and
  is risky live. Time is the controller.
- Reject the single-entity metaphor (a dot on a bike path): we have many weak
  signals, not one dot.

## Motion tokens + the 12-principles filter

Sources: transitions.dev (tokenize motion, never hardcode a duration) and the
12 Principles of Animation (staging, anticipation, easing, follow-through,
appeal). Adopt the *discipline*, skip the libraries (keep deps minimal - CSS /
WAAPI + MapLibre camera + browser View Transitions cover all of it).

### Tokens (refer to these, never a raw number)
- durations: micro 80ms - standard 240ms - expressive 700ms
- easings: base `cubic-bezier(.4,0,.2,1)` - focus/expo `cubic-bezier(.16,1,.3,1)`
  (big camera flights) - settle `cubic-bezier(.2,.3,.2,1)`
- stagger base 120ms; reduced-motion = collapse to ~0

### Apply the principles as a filter
- Anticipation: cue the Approve-ledger beat; a one-step settle before Replay runs.
- Staging: sequence entry (map -> case -> risk line), never everything at once.
- Ease in/out, NO bounce: bounce: 0 always. Use the token easings.
- Follow-through / secondary: let a beacon pulse "drain" after the settle; panels
  overlap slightly as they exit into the next.
- Timing: fast + short (80-300ms) so motion reads invisible against a living map.
- Appeal: the craft that compounds (tabular digits, concentric radii, layered
  shadows, one rich accent) = a believable instrument, not a template.
- Reject: exaggeration / squash-and-stretch-as-realism, 3D flips, bounce-in.
- Live<->Backtest switch + route-focus uses the native View-Transitions API
  (free, GPU-efficient) instead of a JS animation framework.

## Locked tokens (pinned values - don't improvise)

Surfaces (OKLCH, cool neutral; test on a washed-out projector, bump the rule):
- page `oklch(13% 0.008 255)` - panel `oklch(17% 0.008 255)` - rule `oklch(28% 0.008 255)`
- text: strong `oklch(92% 0 0)` - body `oklch(70% 0 0)` - faint `oklch(52% 0 0)`
Severity (>=3:1 against page, always with a text label):
- LOW `oklch(72% 0.16 155)` - MODERATE `oklch(80% 0.14 85)` - ELEVATED `oklch(72% 0.17 55)` - HIGH `oklch(64% 0.21 25)`
Cursor `oklch(75% 0.11 230)`.
Font/icon policy: system sans (`ui-sans-serif, system-ui, -apple-system, Segoe UI`) +
`ui-monospace` stack only - NO webfont download (flake wifi = single point of
failure). Icons: a few, inline SVG, no icon library.
