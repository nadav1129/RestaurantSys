# RestaurantSys – WhatsApp Bot Roadmap

**Status:** infrastructure + minimal code in place (back‑end nearly complete, WhatsApp compatibility + basic logic, initial LLM hooks).  
**Date:** 2025‑10‑09 (Asia/Jerusalem)

---

## 0) High‑level Overview
Our WhatsApp bot acts as the conversational front door to RestaurantSys: workers clock in/out, managers record reservations, and the system exports operational reports (payments, bottles, etc.). The back‑end is a .NET Minimal API with Postgres persistence. We have: WhatsApp webhook, intent parsing (NLU stub in place), idempotency, and basic domain logic.

**Near‑term goals:**
1) Payments per worker → export to Excel.  
2) Worker self‑registration → `workers` table insert + verification.  
3) Push reservations to Google Calendar.  
4) Aggregate bottle usage (all stations) → export to Notes/Markdown (or CSV).  
5) LLM support for all WhatsApp commands (natural language, tool‑calling).

We’ll also integrate: RabbitMQ/SQS, Kafka, LLM/AI, MongoDB, GitHub/GitLab, Kubernetes, Jenkins CI/CD, JWT, AWS.

---

## 1) Current Architecture (snapshot)

### 1.1 Components
- **API**: ASP.NET Core Minimal API (`/webhook/whatsapp`, `CommandRouter`, `IIntentParser`, `IIdempotencyStore`).
- **DB**: PostgreSQL (Docker), with tables: `workers`, `shift_events`, `reservations`, `products` (and planned payments tables, usage logs).
- **NLU/LLM**: lightweight parser today, planned tool‑calling LLM for commands.
- **Idempotency**: message receipts keyed by `messageId`.

### 1.2 Message Flow (WhatsApp → DB)
1. WhatsApp → Webhook (Meta Cloud API payload).  
2. Parse message → dedupe via idempotency store.  
3. NLU → Intent + entities.  
4. Route → domain handler (shift, reservation, report reqs).  
5. Persist → Postgres.  
6. Reply → WhatsApp (text + optional media later).

---

## 2) To‑Do Work Items (with schemas & endpoints)

### 2.1 Payments (per worker) + Excel export
**Goal:** compute each worker’s salary for a period and export.

**Tables (new):**
```sql
create table if not exists payroll_periods (
  period_id uuid primary key,
  starts_at timestamptz not null,
  ends_at   timestamptz not null,
  locked    boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists payroll_lines (
  line_id uuid primary key,
  period_id uuid not null references payroll_periods(period_id) on delete cascade,
  worker_id uuid not null references workers(worker_id),
  hours_worked numeric(10,2) not null default 0,
  hourly_rate numeric(10,2) not null default 0,
  tips_allocated numeric(12,2) not null default 0,
  bonuses numeric(12,2) not null default 0,
  deductions numeric(12,2) not null default 0,
  total_pay numeric(12,2) not null,
  computed_at timestamptz not null default now()
);
```

**Computation notes:**
- Derive `hours_worked` from `shift_events` (start/end pairs) per worker.
- Join with tip policy output (existing/planned) to populate `tips_allocated`.
- `total_pay = hours_worked*hourly_rate + tips_allocated + bonuses - deductions`.

**API outline:**
- `POST /payroll/periods` (create period)  
- `POST /payroll/periods/{id}/compute`  
- `GET  /payroll/periods/{id}/export.xlsx` (stream Excel)

**Excel export:** ClosedXML or EPPlus via an `IReportExporter` abstraction.

**WhatsApp commands:**
- "export payments for Sept" → triggers compute + sends link to .xlsx

---

### 2.2 Worker self‑registration
**Goal:** let a worker register their phone and name.

**Table (exists):** `workers(worker_id, full_name, phone_e164, is_admin)`

**Flow:**
1. Worker sends: `register John Doe` (or "my name is John Doe").  
2. We verify phone via incoming `from` (WhatsApp sender).  
3. Insert into `workers` (unique `phone_e164`).

**API outline:**
- `POST /workers/register` (server‑side invoked by router)  
- `GET  /workers/me` (resolve by phone)

**WhatsApp commands:**
- "register <full name>"  
- "who am I" → returns worker info

---

### 2.3 Reservations → Google Calendar
**Goal:** every new reservation creates/updates a GCal event.

**Table (exists):** `reservations(reservation_id, name, party_size, starts_at, google_event_id, created_by_worker, created_at)`

**Flow:**
- On reservation create/update: enqueue `ReservationUpserted` → Google Sync worker.  
- Google service: create/update event (store `google_event_id`).

**API outline:**
- `POST /reservations` (creates)  
- `PUT  /reservations/{id}` (updates)

**WhatsApp commands:**
- "reserve for 4 at 20:30 for Nadav"  
- "move Nadav to 21:00"

**Notes:** service account with Calendar API. Map `starts_at` to event start; default duration 90 mins unless specified.

---

### 2.4 Bottle usage aggregation (all stations) → export
**Goal:** compute consumed bottles by product across stations and export.

**Tables (new or confirm existing):**
```sql
create table if not exists bottle_usage (
  id uuid primary key,
  product_id uuid not null references products(product_id),
  station text not null,                -- e.g., 'bar1','bar2','waiter1'
  ml_used numeric(10,2) not null,
  used_at timestamptz not null default now(),
  worker_id uuid references workers(worker_id)
);
```

**Aggregation query (example):**
```sql
select p.name,
       sum(bu.ml_used) as total_ml,
       round(sum(bu.ml_used)/1000.0, 2) as liters
from bottle_usage bu
join products p on p.product_id = bu.product_id
where bu.used_at between $1 and $2
group by p.name
order by total_ml desc;
```

**Export format options:**
- Markdown or CSV via WhatsApp link, or push to a shared Notes doc (Markdown file in S3/Git).  
- Endpoint: `GET /reports/bottles?from=...&to=...&format=md|csv`.

**WhatsApp commands:**
- "bottles today" → returns summary table  
- "export bottles this week"

---

### 2.5 LLM support for WhatsApp commands
**Goal:** natural language interface for all commands + tool calling.

**Approach:**
- Intents → functions (tool schema) mapped to API actions: `StartShift`, `EndShift`, `AddReservation`, `ExportPayments`, `RegisterWorker`, `BottleReport`, etc.
- Use a **Router LLM** to pick tool + fill arguments; back‑end validates and executes.
- Keep deterministic fallbacks (regex / rule‑based) for critical ops.

**Security:**
- Enforce JWT/auth for management commands and admin‑only tasks.

---

## 3) Tech Adoption Plan (why/where/when)

> The goal is to **use** each technology with a meaningful, minimal surface initially (MVP), then deepen as needed.

### 3.1 RabbitMQ **or** AWS SQS (choose one primary)
- **Use‑case:** decouple webhook from slow tasks (Google Calendar sync, Excel export).  
- **MVP:** publish `ReservationUpserted`, `PayrollPeriodComputed`, `BottleReportRequested`.  
- **Choice guidance:**
  - If we deploy on AWS early → **SQS** (managed, simple).  
  - If we stay self‑hosted/containers → **RabbitMQ** (Docker service + UI).

### 3.2 Kafka (analytics & streaming)
- **Use‑case:** optional stream of operational events for later analytics dashboards (event sourcing light).  
- **MVP:** mirror `shift_events`, `reservations`, `bottle_usage` to Kafka topics via outbox → Kafka Connect.  
- **Note:** heavier operational cost; keep as *nice‑to‑have* after SQS/Rabbit.

### 3.3 LLM / AI‑ML
- **Use‑case:** intent classification + tool calling; later forecasting (sales, staffing).  
- **MVP:** Router LLM with deterministic validators.  
- **Future:** fine‑tune tips/policy optimizer; demand forecasting.

### 3.4 MongoDB (⚠️ DBeaver vs MongoDB)
- **Clarification:** *DBeaver* is a DB GUI client, not a database. *MongoDB* is a NoSQL database.  
- **Use‑case:** semi‑structured logs (webhook payloads, LLM traces), chat transcripts, idempotency receipts.  
- **MVP:** store raw WhatsApp messages + LLM call logs in Mongo for quick retrieval.

### 3.5 GitHub/GitLab
- **Use‑case:** source control, issues, PRs.  
- **MVP:** GitHub repo with Actions; or GitLab with Jenkins if preferred.

### 3.6 Kubernetes
- **Use‑case:** later stage orchestration (API, workers, Rabbit/Kafka as Helm charts).  
- **MVP:** stick to Docker Compose locally; define K8s manifests/Helm for prod later.

### 3.7 Jenkins (CI/CD)
- **Use‑case:** build, test, containerize, deploy.  
- **MVP:** GitHub Actions may be simpler; if we must use Jenkins: pipeline to build API image, run tests, push to ECR, deploy to ECS/EKS.

### 3.8 JWT
- **Use‑case:** protect management endpoints and bot admin commands.  
- **MVP:** issue short‑lived JWTs for dashboard/API; WhatsApp requests are downstream‑trusted but mapped to worker identity.

### 3.9 AWS
- **Use‑case:** hosting (ECS/EKS), messaging (SQS), secrets (SSM/Secrets Manager), file storage (S3), DB (RDS Postgres, MSK/Kafka).  
- **MVP:** ECS on Fargate + SQS + S3 + Secrets Manager.

---

## 4) Interfaces & Contracts

### 4.1 Messaging Contracts
```json
// ReservationUpserted
{
  "reservationId": "uuid",
  "name": "string",
  "partySize": 4,
  "startsAt": "2025-10-09T20:30:00+03:00",
  "googleEventId": "string|null"
}

// BottleReportRequested
{
  "from": "2025-10-01T00:00:00Z",
  "to":   "2025-10-08T23:59:59Z",
  "format": "md|csv",
  "replyTo": "whatsapp:+972..." // for bot response
}
```

### 4.2 LLM Tool Schemas (examples)
```json
{
  "name": "AddReservation",
  "parameters": {
    "type": "object",
    "properties": {
      "name": {"type":"string"},
      "partySize": {"type":"integer", "minimum":1},
      "startsAt": {"type":"string", "format":"date-time"}
    },
    "required": ["name","partySize","startsAt"]
  }
}
```

---

## 5) Security & Auth
- **JWT** for admin dashboard + protected APIs.  
- WhatsApp phone mapping → `workers.phone_e164` for identity.  
- **Idempotency** for webhooks to prevent double‑processing.  
- Store secrets in **AWS Secrets Manager**; never in repo.

---

## 6) DevOps & Environments

### 6.1 Configuration (.env sample)
```
ASPNETCORE_URLS=http://0.0.0.0:8080
DB__CONN=Host=localhost;Port=5433;Username=postgres;Password=postgres;Database=restaurantsys
WHATSAPP__VERIFY_TOKEN=...
AWS__REGION=eu-central-1
S3__BUCKET=restaurantsys-reports
MQ__KIND=SQS   # or RABBIT
MONGO__URI=mongodb://localhost:27017
JWT__ISSUER=https://restaurantsys.local
JWT__AUDIENCE=restaurantsys
JWT__KEY=change-me
```

### 6.2 CI/CD Checklist
- [ ] Build + unit tests  
- [ ] DB migrations (Flyway/liquibase or EF migrations)  
- [ ] Container image build & tag  
- [ ] Push to registry (ECR)  
- [ ] Deploy (ECS service update)  
- [ ] Smoke test endpoint `/health`  
- [ ] Rollback on failure

---

## 7) Testing Strategy
- **Unit tests**: intent parsing, handlers (shift, reservations, payroll calc), exporters.  
- **Integration tests**: DB round‑trip, webhook idempotency, SQS queue publish/consume.  
- **Contract tests**: message schemas for events.  
- **E2E**: simulate WhatsApp webhook → DB → export link.

---

## 8) Command Catalogue (WhatsApp)
- **Shifts**: `start shift`, `end shift`, `who am i`  
- **Registration**: `register <full name>`  
- **Reservations**: `reserve for <N> at <time> for <name>`, `move <name> to <time>`, `cancel reservation <name>`  
- **Reports**: `export payments <period>`, `bottles today`, `bottles this week`, `help`

---

## 9) Milestones & Timeline (proposed)
1. **M1 – Reports & Registration (1–2 days)**  
   - Payroll tables + compute + Excel export endpoint  
   - Worker register command + API  
2. **M2 – GCal Sync (1 day)**  
   - ReservationUpserted → SQS/Rabbit consumer → Google Calendar
3. **M3 – Bottles Report (1 day)**  
   - `bottle_usage` table, aggregation + export
4. **M4 – LLM Tools (1–2 days)**  
   - Tool schemas + router + guardrails
5. **M5 – AWS & CI (1–2 days)**  
   - S3 report uploads, SQS wiring, GitHub Actions/Jenkins pipeline

---

## 10) Risks & Mitigations
- **Webhook payload changes** → Strong schema validation + logging (Mongo).  
- **Double events** → Idempotency keys + unique constraints.  
- **Timezones** → normalize to UTC; display in local tz (Asia/Jerusalem).  
- **LLM hallucinations** → strict tool schemas + server validation.

---

## 11) Open Questions (to revisit)
- Payment/tip policy variants? (service charge, taxes, night shifts).  
- Default reservation duration? (90m vs per station).  
- Bottle usage source of truth: POS entries vs explicit usage logs.

---

## 12) Implementation Stubs (C# sketches)

```csharp
// Excel export service
public interface IPayrollExporter { Task<Stream> ExportAsync(Guid periodId, CancellationToken ct); }

// Queue publisher
public interface IEventBus { Task PublishAsync<T>(string topic, T payload, CancellationToken ct); }

// LLM tool router contract
public interface ICommandTool
{
    string Name { get; }
    Task<CommandResult> ExecuteAsync(JsonElement args, CancellationToken ct);
}
```

---

## 13) Done vs Next
**Done:** webhook, parsing skeleton, DB base, idempotency, minimal commands.  
**Next:** implement M1 tasks (payroll + registration), then M2 (GCal), then M3 (bottles), then M4 (LLM), then M5 (AWS/CI).

---

### Appendix A – SQL handy snippets
```sql
-- Hours per worker between dates
with pairs as (
  select worker_id,
         kind,
         at,
         lead(kind) over (partition by worker_id order by at) as next_kind,
         lead(at)   over (partition by worker_id order by at) as next_at
  from shift_events
)
select worker_id,
       sum(case when kind='start' and next_kind='end'
                then extract(epoch from (next_at - at))/3600.0 else 0 end) as hours
from pairs
where at between $1 and $2
group by worker_id;
```

```sql
-- Unique phone constraint (already present):
-- alter table workers add constraint uq_workers_phone unique (phone_e164);
```

---

> **Notes for future you:** If you need a GUI for Postgres, DBeaver is great. MongoDB is a separate NoSQL DB; you can still view it in DBeaver or MongoDB Compass. Keep events/messages small and stable; push heavy data (Excel/Markdown) to S3 and only send links over WhatsApp.

