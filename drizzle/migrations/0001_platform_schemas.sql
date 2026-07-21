-- UNGRD Platform · Esquemas y tablas base (Fase 3)
-- Ejecutar: psql $DATABASE_URL -f drizzle/migrations/0001_platform_schemas.sql
-- Idempotente donde sea posible.

CREATE SCHEMA IF NOT EXISTS iam;
CREATE SCHEMA IF NOT EXISTS config;
CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS workflow;
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS analytics;

-- ── IAM ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS iam.dependencies (
  id          text PRIMARY KEY,
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  parent_id   text REFERENCES iam.dependencies(id),
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iam.permissions (
  id          text PRIMARY KEY,
  code        text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS iam.user_dependencies (
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  dependency_id   text NOT NULL REFERENCES iam.dependencies(id),
  is_primary      boolean NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, dependency_id)
);

-- ── CONFIG workflow (piloto) ────────────────────────────────
CREATE TABLE IF NOT EXISTS config.workflow_definitions (
  id          text PRIMARY KEY,
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  case_type   text NOT NULL,
  module_id   text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS config.workflow_versions (
  id              text PRIMARY KEY,
  definition_id   text NOT NULL REFERENCES config.workflow_definitions(id),
  version         integer NOT NULL,
  status          text NOT NULL DEFAULT 'active',
  config          jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (definition_id, version)
);

-- ── CORE cases ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS core.cases (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_code           text NOT NULL UNIQUE,
  case_type           text NOT NULL,
  module_id           text,
  title               text NOT NULL,
  status              text NOT NULL DEFAULT 'DRAFT',
  origin_dependency_id text REFERENCES iam.dependencies(id),
  current_version     integer NOT NULL DEFAULT 0,
  workflow_instance_id uuid,
  created_by          uuid REFERENCES public.users(id),
  assigned_dependency_id text REFERENCES iam.dependencies(id),
  metadata            jsonb NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  submitted_at        timestamptz,
  published_at        timestamptz,
  closed_at           timestamptz
);

CREATE INDEX IF NOT EXISTS core_cases_status_idx ON core.cases(status);
CREATE INDEX IF NOT EXISTS core_cases_type_idx ON core.cases(case_type);
CREATE INDEX IF NOT EXISTS core_cases_origin_idx ON core.cases(origin_dependency_id);

-- ── STAGING versions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staging.case_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         uuid NOT NULL REFERENCES core.cases(id) ON DELETE CASCADE,
  version_number  integer NOT NULL,
  status          text NOT NULL DEFAULT 'DRAFT',
  payload         jsonb NOT NULL DEFAULT '{}',
  content_hash    text,
  created_by      uuid REFERENCES public.users(id),
  dependency_id   text REFERENCES iam.dependencies(id),
  change_reason   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  submitted_at    timestamptz,
  approved_at     timestamptz,
  UNIQUE (case_id, version_number)
);

-- ── WORKFLOW ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow.instances (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id             uuid NOT NULL UNIQUE REFERENCES core.cases(id) ON DELETE CASCADE,
  definition_id       text NOT NULL REFERENCES config.workflow_definitions(id),
  definition_version  integer NOT NULL,
  status              text NOT NULL DEFAULT 'ACTIVE',
  current_step_ids    jsonb NOT NULL DEFAULT '[]',
  context             jsonb NOT NULL DEFAULT '{}',
  started_at          timestamptz NOT NULL DEFAULT now(),
  finished_at         timestamptz
);

ALTER TABLE core.cases
  DROP CONSTRAINT IF EXISTS cases_workflow_instance_fk;
-- link after instances exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cases_workflow_instance_fk'
  ) THEN
    ALTER TABLE core.cases
      ADD CONSTRAINT cases_workflow_instance_fk
      FOREIGN KEY (workflow_instance_id) REFERENCES workflow.instances(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS workflow.tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id     uuid NOT NULL REFERENCES workflow.instances(id) ON DELETE CASCADE,
  case_id         uuid NOT NULL REFERENCES core.cases(id) ON DELETE CASCADE,
  step_code       text NOT NULL,
  task_type       text NOT NULL,
  title           text NOT NULL,
  status          text NOT NULL DEFAULT 'PENDING',
  assignee_role   text,
  assignee_dependency_id text REFERENCES iam.dependencies(id),
  assignee_user_id uuid REFERENCES public.users(id),
  due_at          timestamptz,
  priority        text NOT NULL DEFAULT 'NORMAL',
  created_at      timestamptz NOT NULL DEFAULT now(),
  claimed_at      timestamptz,
  completed_at    timestamptz,
  result          jsonb
);

CREATE INDEX IF NOT EXISTS workflow_tasks_case_idx ON workflow.tasks(case_id);
CREATE INDEX IF NOT EXISTS workflow_tasks_status_idx ON workflow.tasks(status);
CREATE INDEX IF NOT EXISTS workflow_tasks_assignee_idx ON workflow.tasks(assignee_user_id);

CREATE TABLE IF NOT EXISTS workflow.review_findings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         uuid NOT NULL REFERENCES core.cases(id) ON DELETE CASCADE,
  version_id      uuid REFERENCES staging.case_versions(id),
  task_id         uuid REFERENCES workflow.tasks(id),
  section_code    text,
  field_code      text,
  severity        text NOT NULL DEFAULT 'MEDIUM',
  status          text NOT NULL DEFAULT 'OPEN',
  observation     text NOT NULL,
  required_action text,
  responsible_dependency_id text REFERENCES iam.dependencies(id),
  due_at          timestamptz,
  created_by      uuid REFERENCES public.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);

CREATE TABLE IF NOT EXISTS workflow.event_outbox (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}',
  status      text NOT NULL DEFAULT 'PENDING',
  created_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempts    integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS workflow_outbox_pending_idx
  ON workflow.event_outbox(status) WHERE status = 'PENDING';

-- ── CORE assets (inventario oficial) ────────────────────────
CREATE TABLE IF NOT EXISTS core.assets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code      text NOT NULL UNIQUE,
  asset_type      text NOT NULL,
  name            text NOT NULL,
  status          text NOT NULL DEFAULT 'OPERATIVE',
  case_id         uuid REFERENCES core.cases(id),
  published_version_id uuid REFERENCES staging.case_versions(id),
  location_id     uuid,
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS core.legal_instruments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_code text NOT NULL UNIQUE,
  instrument_type text NOT NULL,
  title           text NOT NULL,
  valid_from      date,
  valid_to        date,
  status          text NOT NULL DEFAULT 'ACTIVE',
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS core.asset_instruments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        uuid NOT NULL REFERENCES core.assets(id) ON DELETE CASCADE,
  instrument_id   uuid NOT NULL REFERENCES core.legal_instruments(id),
  valid_from      date NOT NULL,
  valid_to        date,
  is_current      boolean NOT NULL DEFAULT true,
  source_case_id  uuid REFERENCES core.cases(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS core.locations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  departamento    text NOT NULL,
  municipio       text NOT NULL,
  description     text,
  lat             numeric(10, 7),
  lng             numeric(10, 7),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE core.assets
  DROP CONSTRAINT IF EXISTS assets_location_fk;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assets_location_fk') THEN
    ALTER TABLE core.assets
      ADD CONSTRAINT assets_location_fk
      FOREIGN KEY (location_id) REFERENCES core.locations(id);
  END IF;
END $$;

-- ── AUDIT extendida ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit.events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES public.users(id),
  dependency_id   text REFERENCES iam.dependencies(id),
  role            text,
  action          text NOT NULL,
  case_id         uuid,
  entity_type     text,
  entity_id       text,
  before_data     jsonb,
  after_data      jsonb,
  ip_address      text,
  request_id      text,
  reason          text,
  outcome         text NOT NULL DEFAULT 'SUCCESS',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_case_idx ON audit.events(case_id);
CREATE INDEX IF NOT EXISTS audit_events_at_idx ON audit.events(created_at);

-- ── ANALYTICS vistas materializables (placeholder) ──────────
CREATE TABLE IF NOT EXISTS analytics.pending_tasks_summary (
  dependency_id   text NOT NULL,
  task_type       text NOT NULL,
  pending_count   integer NOT NULL DEFAULT 0,
  overdue_count   integer NOT NULL DEFAULT 0,
  refreshed_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dependency_id, task_type)
);
