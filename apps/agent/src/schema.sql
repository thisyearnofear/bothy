-- Bothy schema.
-- PostGIS handles geometry (route lines, incident points).
-- NOTE: the demo image (postgis/postgis) ships without pgvector, so incident
-- embeddings are stored as real[] with a cosine() helper. Swapping to
-- pgvector in production is: CREATE EXTENSION vector; ALTER ... TYPE vector(64);
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE OR REPLACE FUNCTION cosine_sim(a real[], b real[]) RETURNS real AS $$
  SELECT COALESCE(SUM(x * y), 0)::real
  FROM unnest(a, b) AS t(x, y)
$$ LANGUAGE SQL IMMUTABLE;

CREATE TABLE IF NOT EXISTS routes (
  id            text NOT NULL,
  scenario      text NOT NULL,
  name          text NOT NULL,
  region        text NOT NULL,
  geom          geometry(LineString, 4326) NOT NULL,
  length_km     real NOT NULL,
  max_gradient  real NOT NULL,
  max_elev_m    real NOT NULL,
  exposure      real NOT NULL,
  ploughed      boolean NOT NULL,
  hazards       text[] NOT NULL,
  actor         text NOT NULL,
  lat           double precision NOT NULL,
  lng           double precision NOT NULL,
  PRIMARY KEY (scenario, id)
);

CREATE TABLE IF NOT EXISTS scenarios (
  id         text PRIMARY KEY,
  title      text NOT NULL,
  subtitle   text NOT NULL,
  start      timestamptz NOT NULL,
  now        timestamptz NOT NULL,   -- agent horizon
  full_end   timestamptz NOT NULL,
  outcome_at timestamptz,
  outcome    text
);

CREATE TABLE IF NOT EXISTS signal_events (
  id        text NOT NULL,
  scenario  text NOT NULL,
  kind      text NOT NULL,           -- warning | forecast | road | incident
  route_id  text,
  at        timestamptz NOT NULL,
  source    text NOT NULL,
  headline  text NOT NULL,
  detail    text NOT NULL,
  payload   jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (scenario, id)
);
CREATE INDEX IF NOT EXISTS idx_events_scenario_at ON signal_events (scenario, at);

CREATE TABLE IF NOT EXISTS incidents (
  id          text PRIMARY KEY,
  scenario    text NOT NULL,
  at          timestamptz NOT NULL,
  route_id    text NOT NULL,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL,
  hazard      text NOT NULL,
  severity    text NOT NULL,
  narrative   text NOT NULL,
  source      text NOT NULL,
  embedding   real[] NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_incidents_scenario ON incidents (scenario, at);

CREATE TABLE IF NOT EXISTS risk_snapshots (
  route_id   text NOT NULL,
  scenario   text NOT NULL,
  at         timestamptz NOT NULL,
  score      real NOT NULL,
  label      text NOT NULL,
  citations  jsonb NOT NULL,
  PRIMARY KEY (route_id, scenario, at)
);

CREATE TABLE IF NOT EXISTS assessments (
  id                text PRIMARY KEY,
  scenario          text NOT NULL,
  route_id          text NOT NULL,
  at                timestamptz NOT NULL,
  score             real NOT NULL,
  label             text NOT NULL,
  confidence        real NOT NULL,
  causal_chain      jsonb NOT NULL,
  evidence          jsonb NOT NULL,
  draft             text NOT NULL,
  responsible_actor text NOT NULL,
  priority          text NOT NULL,
  status            text NOT NULL DEFAULT 'pending',
  decision_note     text,
  decided_at        timestamptz,
  engine            text NOT NULL,
  tool_trace        jsonb NOT NULL DEFAULT '[]',
  phases            jsonb NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS audit_log (
  id       bigserial PRIMARY KEY,
  at       timestamptz NOT NULL DEFAULT now(),
  scenario text NOT NULL,
  actor    text NOT NULL,
  action   text NOT NULL,
  detail   text NOT NULL
);

-- External context is deliberately isolated from signal_events. It preserves
-- source provenance for operator-triggered snapshots without affecting the
-- deterministic scoring engine or frozen backtest evidence.
CREATE TABLE IF NOT EXISTS external_observations (
  id          bigserial PRIMARY KEY,
  snapshot_id text NOT NULL,
  scenario    text NOT NULL,
  route_id    text NOT NULL,
  provider    text NOT NULL,
  source_url  text NOT NULL,
  observed_at timestamptz,
  fetched_at  timestamptz,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  category    text NOT NULL,
  payload     jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_external_observations_scenario_route_ingested
  ON external_observations (scenario, route_id, ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_observations_snapshot
  ON external_observations (snapshot_id);

-- Watch-my-road subscriptions (AgentCore Memory pattern: durable
-- per-community preferences the agent reads before deciding who to notify).
CREATE TABLE IF NOT EXISTS subscriptions (
  id           bigserial PRIMARY KEY,
  route_id     text NOT NULL,
  scenario     text NOT NULL DEFAULT 'live',
  email        text NOT NULL,
  channel      text NOT NULL DEFAULT 'email',
  min_label    text NOT NULL DEFAULT 'ELEVATED',
  created_at   timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  UNIQUE (route_id, scenario, email)
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_route ON subscriptions (scenario, route_id);

-- Notification ledger: every ping the agent sends, with the causing assessment.
CREATE TABLE IF NOT EXISTS notifications (
  id            bigserial PRIMARY KEY,
  subscription_id bigint REFERENCES subscriptions (id) ON DELETE CASCADE,
  assessment_id text NOT NULL REFERENCES assessments (id) ON DELETE CASCADE,
  route_id      text NOT NULL,
  scenario      text NOT NULL,
  label         text NOT NULL,
  channel       text NOT NULL DEFAULT 'email',
  target        text NOT NULL,
  status        text NOT NULL DEFAULT 'queued',
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  sent_at       timestamptz,
  UNIQUE (subscription_id, assessment_id)
);
CREATE INDEX IF NOT EXISTS idx_notifications_assessment ON notifications (assessment_id);

