# Engineering decisions

Deliberate choices and their rationale — so you can justify them to technical
judges and future you.

## Hand-rolled loop > LangGraph

The requirement is a **linear, bounded** loop (`detect → retrieve → reason →
recommend → act`) over a small, fixed toolset. LangGraph earns its keep on
complex branching multi-agent graphs; here it would be abstraction without a
payoff.

- **Auditable** — the whole path is readable in one file
  (`apps/agent/src/agent/loop.ts`), which matches the "narrow, auditable tools"
  safety story.
- **Debuggable live** — deterministic scripted brain = safe demo even if the
  LLM is down.
- **Fewer frameworks to explain** — one answer to "why not just call the tools
  directly?" (…we do — with an audit trail around them).

## No CopilotKit / no chat widget

CopilotKit nudges toward a chat UX. The pitch is explicitly *"we are not a
chatbot, we're a ranked, evidence-backed intervention workflow."* A chat panel
would undercut that. LLM-editable drafting, when needed, is a plain editable
text field + an "ask agent to revise" button.

## PostGIS present, pgvector swapped for a `real[]` cosine

The demo Postgres image ships with **PostGIS but not pgvector**, so incident
embeddings live in a `real[]` column with a `cosine_sim()` SQL helper and a
deterministic bag-of-words embedding. Swapping to pgvector in production is a
one-click extension + a type change (see `apps/agent/src/schema.sql`). Retrieval
shape (geo + date + hazard filter, then semantic rank) is identical either way.

## Scripted brain is a feature, not a fallback

The `create_human_review` tool is the single exit point for **both** brains. The
scripted brain runs the exact same read-tool order and produces the same trace,
so graders see a deterministic, repeatable "agent" without an API key — then the
LLM brain is the only variable when it's enabled and healthy.

## Risk model

Deterministic and transparent: active warnings × exposure × matched hazards,
forecast snow/temperature, closures/ploughing, recent incidents, historical
pattern. Every contribution is an evidence citation — the causal chain is built
verbatim from those citations.

Live Open-Meteo is **not** an input to this model. It is operator-fetched
context, persisted, and labelled off the score. News appears only as the A66
sourced outcome beyond the hatch. Audio, radio, and social are out of scope
until they can land as the same citation kinds.

## Repo hygiene

- ESLint flat config at the root (`npm run lint`), typecheck per workspace.
- Husky pre-commit: `lint-staged` (eslint fix) **and** `scripts/check-secrets.sh`
  (blocks known secret files + high-signal patterns in the staged diff).
  Add `gitleaks detect --source .` in CI for a heavier heuristics scan.
## Two severity tokens: graphics and text are different jobs

`riskColor` is locked at ≥3:1 (WCAG non-text) for map lines, dots, and tints.
Applied to text it fails AA — the first live watch run surfaced 12
contrast findings. `riskTextColor` keeps the same hues at raised lightness
(≥4.5:1 on `--panel`) for severity labels and score readouts. Two tokens so
neither job silently degrades the other — and so axe can tell us when a
future site picks the wrong one.

## Vendor CSS is a different cascade, override it accordingly

Third-party stylesheets bundled after `globals.css` win same-specificity
ties. MapLibre's `.maplibregl-popup-content` beat our panel override —
popups rendered on its white card and axe saw it before screenshots did.
Vendor overrides carry `!important` and live next to a comment saying why.

## Exotic dev ports on shared boxes

Web dev runs on :8477 — pinned in the dev script, QA default, CI, docs, and
`venue.sh`. Common ports collide with other projects and SSH tunnels on a
shared machine; the QA loop once audited a tunnelled login page on :3000
thinking it was the app. If a page-load check fails on every route at once,
check what's actually answering on the port before debugging the app.
