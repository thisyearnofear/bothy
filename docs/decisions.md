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