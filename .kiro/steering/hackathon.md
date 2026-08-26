# Ready, Spec, Ship Hackathon delivery

The Kiro Ready, Spec, Ship Hackathon is complete (submitted Aug 2026). Keep the
bar it set: a fresh user — judge, collaborator, or future contributor — must be
able to clone, understand, run, and verify the project without paid services or
private credentials. Forward-looking direction lives in `docs/roadmap.md`.

## Submission readiness

- Keep `.kiro/steering/` committed and useful: it was required submission evidence and remains project steering.
- Keep the README accurate: setup, database/tunnel prerequisites, destructive reset warning, runnable commands, and validation steps must match the actual project.
- When changing a user-visible claim, demo behavior, external integration, or setup path, update the README and relevant `docs/` file in the same change.
- The demo video and README should explicitly show meaningful Kiro use: these project steering files, the agent-assisted implementation/validation workflow, and the resulting reproducible build.

## Quality bar

- Do not describe seeded or illustrative data as live functionality.
- Do not present a mocked, cached, or hard-coded result as a live provider response without an explicit label and provenance.
- Prefer features that work with no LLM key and recover cleanly from unavailable optional providers.
- Preserve a clean, repeatable rehearsal path for judges: setup → seed/reset if intended → run agent/web → refresh optional live context → exercise approval and audit.

Source: https://codingagents.fyi/hackathon/kiro/
