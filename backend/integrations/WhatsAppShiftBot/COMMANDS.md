# WhatsApp Bot – Current Commands (v0.1)

> Scope: **Only the commands we currently use**. Parser and router accept the forms below. Times are optional and in `HH:MM` 24‑hour format.

---

## 1) Add a worker

**What it does:** Creates a new worker record (no phone).

**Syntax (aliases):**

```
add worker <full name>
worker add <full name>
add new worker <full name>
```

**Examples:**

```
add worker Maya Cohen
worker add "Yossi Levi"
```

**Notes:**

* Names are **case‑insensitive unique** (e.g., `maya cohen` ≡ `Maya Cohen`).
* Intended for admins.

---

## 2) Start shift for a worker

**What it does:** Records a **start** event for the named worker. If a time is provided, it will be used; otherwise, **now**.

**Syntax:**

```
start <name>
start shift <name>
start <name> at HH:MM
start shift <name> @ HH:MM
```

**Examples:**

```
start Maya Cohen
start shift Yossi Levi at 18:30
start nadav @ 09:05
```

**Notes:**

* `<name>` is required in this trimmed version.
* `HH:MM` is 24‑hour time.

---

## 3) End shift for a worker

**What it does:** Records an **end** event for the named worker. If a time is provided, it will be used; otherwise, **now**.

**Syntax:**

```
end <name>
end shift <name>
end <name> at HH:MM
end shift <name> @ HH:MM
```

**Examples:**

```
end Maya Cohen
end shift Yossi Levi at 23:45
end nadav @ 17:10
```

**Notes:**

* `<name>` is required in this trimmed version.
* `HH:MM` is 24‑hour time.

---

## Validation & Errors (what you’ll see)

* **Unknown command:**

  * `Commands: start shift <name> [at HH:MM] | end shift <name> [at HH:MM] | add worker <name>`
* **Missing name:**

  * `Usage: start shift <name> [at HH:MM]` or `Usage: end shift <name> [at HH:MM]`
* **Add worker without name:**

  * `Usage: add worker <full name>`

---

## Timezone & time capture

* If you include `HH:MM`, that value is used.
* If you omit time, the system records **now**.
* (Operational note) Server stores timestamps as `timestamptz`.

---

## Current implementation status

* **Parsing & routing:** Active for the three commands above.
* **DB effects:**

  * *Add worker* → inserts a worker (no phone, `is_quick=true`).
  * *Start/End* → inserts into `shift_events` with `kind` = `start`/`end`.
* **Idempotency:** duplicate message IDs are ignored with `✅ Already processed.`

> If you see an acknowledgment message but nothing changes in the DB, verify that the router’s DB calls are wired (or restore the `HandleShift` method).
