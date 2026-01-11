/* =========================================================
   Platform DB schema (Control Plane)
   - owners -> tenants -> branches
   - deployments (k8 namespace / helm release / status)
   - routing (host/path -> deployment)
   - db bindings (where tenant DB lives; store secret refs, not passwords)
   - scaling policies (HPA intent)
   - audit events (optional but very useful)
   ========================================================= */

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;  /* gen_random_uuid() */
CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS platform;
SET search_path TO platform, public;

/* -----------------------------
   Enums
------------------------------*/
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_status') THEN
    CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'deleted');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deployment_status') THEN
    CREATE TYPE deployment_status AS ENUM ('pending', 'deploying', 'ready', 'failed', 'deleted');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'db_provider') THEN
    CREATE TYPE db_provider AS ENUM ('postgres', 'neon', 'supabase', 'rds', 'other');
  END IF;
END $$;

/* -----------------------------
   Timestamps helper
------------------------------*/
CREATE OR REPLACE FUNCTION platform.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

/* -----------------------------
   Owners (the account that owns tenants)
------------------------------*/
CREATE TABLE IF NOT EXISTS owners (
  owner_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  email        citext UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_owners_updated
BEFORE UPDATE ON owners
FOR EACH ROW EXECUTE FUNCTION platform.set_updated_at();

/* -----------------------------
   Tenants (a business)
   slug is used in domains/urls: e.g. {slug}.restaurantsys.com
------------------------------*/
CREATE TABLE IF NOT EXISTS tenants (
  tenant_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL REFERENCES owners(owner_id) ON DELETE RESTRICT,
  slug         text NOT NULL UNIQUE,
  display_name text NOT NULL,
  status       tenant_status NOT NULL DEFAULT 'active',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_tenants_owner ON tenants(owner_id);

CREATE TRIGGER trg_tenants_updated
BEFORE UPDATE ON tenants
FOR EACH ROW EXECUTE FUNCTION platform.set_updated_at();

/* -----------------------------
   Branches (optional)
   branch_code is tenant-local identifier: "main", "tlv", "branch2"
------------------------------*/
CREATE TABLE IF NOT EXISTS branches (
  branch_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  branch_code  text NOT NULL,
  display_name text NOT NULL,
  status       tenant_status NOT NULL DEFAULT 'active',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, branch_code)
);

CREATE INDEX IF NOT EXISTS ix_branches_tenant ON branches(tenant_id);

CREATE TRIGGER trg_branches_updated
BEFORE UPDATE ON branches
FOR EACH ROW EXECUTE FUNCTION platform.set_updated_at();

/* -----------------------------
   DB bindings
   IMPORTANT: do NOT store passwords here.
   Store reference to a K8 Secret name/key (or external secret id).
   One binding can be per tenant or per branch.
------------------------------*/
CREATE TABLE IF NOT EXISTS db_bindings (
  db_binding_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  branch_id       uuid REFERENCES branches(branch_id) ON DELETE CASCADE,

  provider        db_provider NOT NULL DEFAULT 'postgres',
  host            text NOT NULL,
  port            int NOT NULL DEFAULT 5432,
  database_name   text NOT NULL,
  username        text NOT NULL,

  /* where the password/connstring is stored (k8 secret, vault, etc.) */
  secret_ref      text NOT NULL,  /* e.g. "k8:ns/secretName#key" */

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  /* allow either tenant-level or branch-level uniqueness */
  UNIQUE (tenant_id, branch_id)
);

CREATE INDEX IF NOT EXISTS ix_db_bindings_tenant ON db_bindings(tenant_id);

CREATE TRIGGER trg_db_bindings_updated
BEFORE UPDATE ON db_bindings
FOR EACH ROW EXECUTE FUNCTION platform.set_updated_at();

/* -----------------------------
   Deployments (what exists in Kubernetes)
   Can be per tenant or per branch (branch_id optional).
------------------------------*/
CREATE TABLE IF NOT EXISTS deployments (
  deployment_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  branch_id       uuid REFERENCES branches(branch_id) ON DELETE CASCADE,

  cluster_name    text NOT NULL DEFAULT 'default',
  k8_namespace    text NOT NULL,
  helm_release    text NOT NULL,

  desired_version text,   /* image tag/chart version you want */
  current_version text,   /* what is actually running */

  status          deployment_status NOT NULL DEFAULT 'pending',
  last_error      text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (cluster_name, k8_namespace, helm_release)
);

CREATE INDEX IF NOT EXISTS ix_deployments_tenant ON deployments(tenant_id);
CREATE INDEX IF NOT EXISTS ix_deployments_branch ON deployments(branch_id);

CREATE TRIGGER trg_deployments_updated
BEFORE UPDATE ON deployments
FOR EACH ROW EXECUTE FUNCTION platform.set_updated_at();

/* -----------------------------
   Routing rules (how traffic maps to a deployment)
   Typical:
     host = "abc.restaurantsys.com" path_prefix="/"
   Or branch path routing:
     host = "abc.restaurantsys.com" path_prefix="/branch2"
------------------------------*/
CREATE TABLE IF NOT EXISTS routing_rules (
  route_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id uuid NOT NULL REFERENCES deployments(deployment_id) ON DELETE CASCADE,

  host          text NOT NULL,
  path_prefix   text NOT NULL DEFAULT '/',
  is_primary    boolean NOT NULL DEFAULT false,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (host, path_prefix)
);

CREATE INDEX IF NOT EXISTS ix_routes_deployment ON routing_rules(deployment_id);

CREATE TRIGGER trg_routes_updated
BEFORE UPDATE ON routing_rules
FOR EACH ROW EXECUTE FUNCTION platform.set_updated_at();

/* -----------------------------
   Scaling policy (your desired HPA settings)
------------------------------*/
CREATE TABLE IF NOT EXISTS scaling_policies (
  scaling_policy_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id     uuid NOT NULL UNIQUE REFERENCES deployments(deployment_id) ON DELETE CASCADE,

  enabled           boolean NOT NULL DEFAULT true,
  min_replicas      int NOT NULL DEFAULT 1,
  max_replicas      int NOT NULL DEFAULT 3,
  cpu_target_pct    int NOT NULL DEFAULT 70,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CHECK (min_replicas >= 1),
  CHECK (max_replicas >= min_replicas),
  CHECK (cpu_target_pct BETWEEN 10 AND 95)
);

CREATE TRIGGER trg_scaling_updated
BEFORE UPDATE ON scaling_policies
FOR EACH ROW EXECUTE FUNCTION platform.set_updated_at();

/* -----------------------------
   Audit log (optional but recommended)
------------------------------*/
CREATE TABLE IF NOT EXISTS audit_events (
  event_id     bigserial PRIMARY KEY,
  occurred_at  timestamptz NOT NULL DEFAULT now(),

  actor_owner_id uuid REFERENCES owners(owner_id) ON DELETE SET NULL,

  action      text NOT NULL,     /* e.g. "tenant.create", "deploy.install" */
  entity_type text NOT NULL,     /* "tenant", "deployment", ... */
  entity_id   uuid,              /* id of entity */
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_audit_occurred_at ON audit_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_entity ON audit_events(entity_type, entity_id);

COMMIT;
