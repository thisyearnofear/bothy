# Decision Replay — the Dashboard Differentiator

There are many dashboards. Ours is not a dashboard. It is a **decision case you
can rewind** — one recommended action a duty officer must approve (or reject),
where reported facts are cited and time-stamped, illustrative inputs are marked,
and nothing happens automatically.

Framing decision-support → not alert-monitoring. (Deep dive: `docs/alignment.md`.)
The look/feel & micro-interactions: `docs/design.md` (situation-room UI, craft
rules, motion spec).

## Why generic dashboards lose (research)

- A systematic review of 75 studies: **information overload is the #1 dashboard
  problem** (46.7% of users). Screens are built to *display data* instead of
  *supporting a decision*. (UX Pilot, 12 Dashboard Design Principles.)
- Cognitive load (Sweller): working memory holds ~3–5 items (Miller). Cut
  **extraneous** load; keep only what serves **germane** (pattern) load.
- Dashboards are usually "logical but not narrative" — they lack *setting,
  sequence, contrast, climax*. Storytelling devices: **set the scene first,
  introduce ideas bit by bit, annotate the turning points** (Susie Lu).
- Winning demos: state the **problem first**, elevator pitch in the first
  seconds, **highly visual + interactive** (show it in use), stay concise
  (Devpost, hackathon winners).

## The one genuine mechanism: **Rewind the day**

A scrubbable **time cursor** running 00:00 → now across the road level risk
curve. As it crosses each weak signal the scene updates:

- the risk line ticks up and the **inflection point is annotated**
  ("08:20 closure → +0.30"); only the turning points get annotation, not every
  point;
- that signal pins itself on the **map** with its citation + timestamp;
- the **evidence list re-renders** to exactly what was known at that moment.

Playback ("watch the day happen in 20s") is a one‑button feature — the data is
already precomputed (`risk_snapshots`), so it's cheap and inherently cinematic.

## One screen, one decision

- **Headline first** — a warm, one‑sentence causal story ("A66 is HIGH:
  an amber warning + drifting closure meet an exposed, un‑ploughed road with a
  history of strandings.") Numbers come after, not before (set the scene).
- **Map** colored by risk **at the cursor** moment.
- **Right rail: the accountable gate** — draft warning, "Bothy never publishes
  automatically", **Approve / Reject** → timestamped audit line naming the
  responsible actor (highways duty officer / Cumbria CC).
- **Restraint:** top 3 routes, **labels + color, never** color alone
  (accessibility & legibility — credible detail judges notice).

## Spectacle for the demo

1. **Replay** — auto‑play the day; signals land and hooks light up.
2. **Backtest flash‑forward** — the replay separates modeled pre-closure signals
   from a reported A66 closure. The shown timestamps and lead time are clearly
   illustrative, rather than retrospective performance measurements.
3. **One line** to close on: *"Reported facts are sourced; modeled signals and
   timing are labelled so the decision trail stays honest."*

## Backtest evidence boundary

The A66 scenario is anchored to a reported event: ITV News reported on 13
February 2026 that heavy snow closed the A66 in both directions between the
A685 at Brough and the A67 at Bowes, with recovery resources supporting
stranded heavy vehicles; it later reported the route reopened. Source:
[ITV News — A66 closed in both directions due to heavy snow](https://www.itv.com/news/border/2026-02-13/a66-in-cumbria-closed-in-both-directions-due-to-heavy-snow).

The model’s precursor warning, forecast values, road-operation signals,
historical pattern, replay timestamps, and lead time are **illustrative demo
inputs**. They are useful for explaining how the decision replay works, but are
not offered as a historical weather record or as retrospective model validation.

## Intake (what comes in)

The score is a stack of **typed reports** — warning, forecast, road, incident —
each with a source and a weight. It is not a live OSINT vacuum.

- **In the score:** seeded weather warnings, forecasts, road operations, and
  incident/history citations.
- **In the room, not the score:** Open-Meteo on the Lake District desk.
  Operator-triggered fetch, frozen snapshot, labelled *not in the score*.
- **Beyond the hatch:** ITV News as the sourced A66 outcome. Not a news crawl;
  not agent evidence.
- **Not ingested in this build:** audio, radio, social. Same contract later:
  they become reports, or they do not land.

The watch room shows this as a quiet Intake strip. Do not add fake streams to
answer a modality question.

## 5-minute storyboard

- **Act 1 (15s)** Problem: a cold, snowy day; people get stuck is avoidable.
- **Act 2 (90s)** Mechanical: replay the live day → at the closure point; causal stack
  + map show the "the point it became inevitable".
- **Act 3 (60s)** Accountable: draft → **Approve** → audit line prints,
  "Bothy never acts alone."
- **Act 4 (90s)** Backtest: replay the illustrative pre-closure signals, then
  reveal the sourced A66 closure and explain the boundary between reported fact
  and model input.
- **Act 5 (15s)** Generality: floods, wildfire evacuation, logistics to
  "RiskOps" without saying it.

## Explicitly not building

- A 9‑KPI widget wall
- A chat pane / CopilotKit widget (we are not a chatbot)
- An alert/notification feed
- A regional‑blanket "city risk" view
- A live audio / radio / social firehose (modality without a citation)
## Build decisions (locked)

1. **Approve pins to the horizon, not the cursor.** The timeline cursor is a
   read-only replay lens over map/evidence/score. The decision rail (draft,
   actor, approve/reject) always represents the agent's assessment **at the
   scenario horizon** (live 14:30, backtest 21:30). Scrubbing never edits or
   re-pins the decision - you can't retroactively approve a warning at 08:20.
2. **Backtest reveal works by extending the scrub to `fullEnd`.** In backtest
   mode the scrubber runs 00:00 -> fullEnd. Past the horizon: hatched
   "beyond agent's view" band; the evidence/causal stack and risk curve freeze
   at 21:30 (the honesty cue). The cursor then reaches an outcome annotation for
   the sourced closure; it is not agent evidence or a recomputed risk state.
3. **The scrubber is a narrative controller, not a slider.** It snaps to
   signal arrivals (from `risk_snapshots.citations`) and supports keyboard
   Left/Right to jump beat-to-beat ("08:20 closure -> +0.30"). 20s autoplay
   lands on beats, or between them.
4. **Money shot (first paint):** live, cursor at now, top route expanded -
   headline sentence, HIGH + score, <=3 evidence chips, red route on the map,
   decision rail visible with a pulsing "awaiting duty officer". The pitch is
   legible with zero interaction.
5. **Evidence cap = 3 by weight, then "+n more reports".** The causal stack
   shows the heaviest citations first (kind, source, signed contribution, share
   bar), then the rest. Miller's ~3–5 still holds; ranking by weight stops a
   load-bearing road report hiding behind earlier warnings.
6. **Provenance + honesty everywhere:** each assessment tags `engine: llm |
   scripted`; the agent trace is a collapsible mono block under the stack (the
   "show the code path" moment); approve copy is "recorded - pending dispatch
   (demo)" - the UI never implies a message went out; LOW routes stay visible
   (a "not-a-wolf" credibility line, not filler).
7. **A11y:** the audit row append fires `aria-live="polite"`; the scrubber is a
   real `input[type=range]` (native keyboard + ARIA) with a visible time bubble;
   reduced-motion collapses scrub/travel animations.
