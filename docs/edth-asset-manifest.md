# EDTH acquisition manifest

Date: 2026-10-03
POC: Bothy team lead
Status: Sources verified and selected. Follow-up live query/UI rehearsal completed for `gallium-chain`; no new graph import or IdP install.
TL;DR: Reuse the existing deep supply-chain graph, add one tested explanation query, and distinguish synthetic dependency evidence from authoritative gallium context. Spend remaining time on actual demo evidence and submission artifacts, not additional datasets.

## P0: assets for the submission story

### 1. Deep supply-chain graph and generator

The starter's platforms, parts, companies, facilities, ownership, supplier links, shipments, and disruption effects are synthetic. Country production figures and material relationships are approximate reference data; rounded shares are unsuitable for citation. [1, lines 16-25]

The dataset documentation releases generated data and the generator under MIT. [1, lines 199-203] GitHub's repository-level license metadata was null during inspection; do not describe every starter asset as MIT. Preserve relevant dataset notices before redistributing.

Acquisition targets:
- Repository: https://github.com/turing-db/turingdb-hackathon-defense
- Verified upstream revision: `a87d58b8bc9e4776f4fa9d38cca106dc9c49cafe` (observed GitHub main, not yet checked out locally).
- Store: `graphs/supply_chain_deep/` in that repository.
- Schema/provenance: `docs/supply_chain_deep.md`.
- Generator: `scripts/generate_supply_chain_deep.py`.
- Our existing graph setup: `graphs/README.md`.

Selection: use the existing local store first. The local directories were observed in the previous readiness check; their binary contents have not been matched to the pinned upstream revision. Copy or regenerate only into a separate location if missing or unsuitable. Do not overwrite an existing versioned store or retained ledger during rehearsal.

Why selected: it can support a visible modeled platform/component/material dependency without requiring sensitive real defence data. It does not establish an actual military platform BOM or programme exposure.

### 2. Official gallium context

USGS Mineral Commodity Summaries 2026 reports that China accounted for 99% of worldwide primary low-purity gallium production. [2, lines 62-62] Keep the product category and date qualification. Do not turn this into 99% of EU imports, high-purity production, or a particular platform's supply.

USGS describes GaAs- and GaN-based integrated circuits as used in many defence-related applications. [2, lines 94-94] This supports a relevance statement, not a named platform/component mapping.

Source: https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-gallium.pdf
Companion index: https://www.usgs.gov/centers/national-minerals-information-center/gallium-statistics-and-information

Use: one sourced supply-context card or slide. Preserve attribution, exact category, date, and estimate caveats. Cite/rephrase factual findings; blanket image/logo redistribution permission was not established in this research.

### 3. European relevance

The European Commission's 2023 critical raw materials list includes gallium. [3, lines 45-53]

Source: https://single-market-economy.ec.europa.eu/sectors/raw-materials/areas-specific-interest/critical-raw-materials_en

Use: explain why the question is relevant to European supply resilience. Link the official source. This shortlist does not rely on a strategic-material annex claim because the direct annex excerpt available here did not establish its entries. Classification does not prove any synthetic platform's exposure.

### 4. Native graph versioning documentation

TuringDB documents isolated Changes, checkout, commit submission, and `CALL db.history()`. [4, lines 140-166] Its time-travel example checks out a past commit and queries that snapshot. [4, lines 254-272]

Source: https://docs.turingdb.ai/concepts/versioning_system

Use: support a correctly described pinned replay. Our allowed simulation abandons changes; do not submit writes or imply it models mitigation. Only show a meaningful version comparison after running it against actual available history.

## Ready-to-test dependency explanation

The exact seven-stage BOM spine is documented in the starter. Platform, System, Subsystem, Assembly, Subassembly, Component and Material are typed levels in the graph. [1, lines 35-42] The starter documents typed bounded CONTAINS path quantifiers. [1, lines 120-124]

The query below was authored from that schema and subsequently live-tested at graph revision `fa702a0364247caf`. It is now the exact approved `gallium-chain` catalogue query, limited to ten sampled chain rows, not a full exposure count or shortest-path calculation.

```cypher
MATCH (p:Platform)-[:CONTAINS]->(s:System)-[:CONTAINS]->(ss:Subsystem)
-[:CONTAINS]->(a:Assembly)-[:CONTAINS]->(sa:Subassembly)-[:CONTAINS]->(c:Component)
-[:CONTAINS]->(m:Material)-[:CONTAINS]->{1,4}(g:Material {name:'Primary gallium'})
RETURN DISTINCT p.name, p.archetype, s.name, ss.name, a.name, sa.name,
 c.name, c.family, m.name, g.name
LIMIT 10
```

Validation steps:
1. On the public/synthetic pack, test the query on an isolated client with a bounded timeout. Verify actual property names and that returned rows match the intended typed relationships.
2. If direct component-to-primary-gallium edges exist, explicitly test a direct-material variant; the candidate above excludes those paths. Do not use absent sampled matches to imply no dependency.
3. Choose one returned chain, retain all intermediate labels and the graph revision, and inspect it before rendering. Display full chain evidence rather than drawing unreturned hops.
4. Add the tested exact query to the scenario catalogue and read policy, with regression and integration coverage. Do not loosen the arbitrary-query boundary.
5. Use names and source boundaries directly from captured rows; never label synthetic names as real weapon programmes.

Recommended display: two distinct panels, `Illustrative dependency in the starter model` and `Official material-supply context`. Any connector between them expresses the common material only, not a verified procurement relationship.

## P1: demo confidence components

### Keycloak, only if local browser sign-in is necessary

Keycloak documents OIDC discovery, authorization-code token exchange, refresh, and realm public-key endpoints. [5] Keycloak uses Apache License 2.0. [6]

Repository: https://github.com/keycloak/keycloak
Guide: https://www.keycloak.org/securing-apps/oidc-layers

Needed configuration: disposable local realm, confidential web client, exact redirect URI, PKCE, API audience mapper, matching issuer/JWKS, and configured analyst/reviewer/owner subjects. Test access-token acceptance, not just the login redirect. Preserve localhost-only demo boundary and never publish credentials or realm secrets.

This is an optional time-boxed integration, not a prerequisite for the graph demonstration. Keep existing signed-fixture bridge tests as the fallback; neither proves buyer-IdP compatibility. Estimated effort is half to one day including debugging, not a promise.

### Playwright for one narrow committed journey

Playwright Test supports existing projects, browser isolation, and Chromium/Firefox/WebKit; browser binaries are a setup dependency. [7] Playwright's license is Apache 2.0. [8]

Repository: https://github.com/microsoft/playwright
Guide: https://playwright.dev/docs/intro

Use: one reproducible analysis/citation/case workflow and a failure-path test. Keep test identity and SQLite state isolated. Do not publish authentication storage state. A tab-only mocked UI test must remain labeled as a fixture rehearsal. Installation and browser downloads have not been performed here.

## Presentation assets

Use original Bothy UI screenshots from the eventual live rehearsal and an authored dependency diagram based on actual returned nodes. The diagram specification is saved in `docs/edth-dependency-visual-spec.md`.

Do not use stock military imagery to imply a real platform relationship. No third-party military photo or EDTH/partner logo is acquired or rights-cleared by this research. Text references to technologies and official factual citations avoid unnecessary trademark/media-license risk. Dataset-specific attribution still applies to captured graph content.

## Defer

- Additional cyber/crime/drone/energy starter graphs: unrelated to the gallium story and additional provenance/setup surface.
- DLA parts catalogues or scraped defence-prime product mappings: not a verified platform BOM; access/reuse and relationship evidence remain unconfirmed.
- Live web-search enrichment in the operational rail: increases egress and provenance complexity. The research key is not needed for the deterministic demo.
- New model providers, alternate identity stacks, elaborate footage: no immediate proof advantage over the core live journey.

## Event and credential boundaries

The current October event page identifies the October 1–4 London hackathon and says participants may bring their own project. [9] The resources page returned HTTP 401. Specific TuringDB prize rules, build-window accounting, submission channel, and team number still require the supplied authenticated resources or organizer instructions. The user supplied Friday 18:00 to Sunday 4 October noon as the working build window; this is user-provided, not independently recovered from the protected page.

No research credential was stored, printed, sent to subagents, or used in an API request. Existing research access sufficed. Rotate the key shared in chat before reusing it in an application, and provide the replacement through a secret-management mechanism rather than committing it.

## Completion status

Sourced and verified: starter schema/provenance, official gallium/EU context, versioning guide, identity/testing candidates and license checks. Fetched reference text/PDF extraction is retained in session source artifacts. Durable project outputs are this manifest, research plan, and original visual specification.

Follow-up: the candidate was executed read-only against the existing local graph at `fa702a0364247caf`, added as the exact reviewed `gallium-chain` scenario, and rendered through the real sidecar/agent/UI. Ten sampled rows returned. The final material segment is bounded connectivity, not a returned list of intermediate material nodes. Live screenshots and a rendered six-slide HTML deck draft are available.

A subsequent disposable Node OIDC-provider rehearsal completed real browser sign-in, live graph capture, approval/assignment, separate owner sign-in and acknowledgment/outcome. It used fixed synthetic accounts, not Keycloak or a buyer IdP; see `demo-sso-rehearsal.md`.

Still not completed: new runtime dataset download, buyer IdP validation, committed browser test harness, live demo recording, final PDF production, public upload, or submission.

## References

- [1] Deep Defense Supply Chain - TuringDB Graph | https://github.com/turing-db/turingdb-hackathon-defense/blob/main/docs/supply_chain_deep.md
- [2] Gallium — Mineral Commodity Summaries 2026 | https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-gallium.pdf
- [3] Critical raw materials | https://single-market-economy.ec.europa.eu/sectors/raw-materials/areas-specific-interest/critical-raw-materials_en
- [4] Version Control in TuringDB | https://docs.turingdb.ai/concepts/versioning_system
- [5] Securing applications and services with OpenID Connect | https://www.keycloak.org/securing-apps/oidc-layers
- [6] Keycloak LICENSE.txt — Apache License 2.0 | https://github.com/keycloak/keycloak/blob/main/LICENSE.txt
- [7] Installation | Playwright | https://playwright.dev/docs/intro
- [8] Playwright License — Apache License 2.0 | https://github.com/microsoft/playwright/blob/main/LICENSE
- [9] European Defense Tech Hackathon - London | https://events.eurodefense.tech/european-defense-tech-hackathon-london-2