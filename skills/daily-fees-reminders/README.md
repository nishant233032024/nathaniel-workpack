# daily-fees-reminders

Part 3, Track D. A morning skill that turns the payments export into the day's
WhatsApp reminder drafts and a one-line summary for the admin team.

Read [`SKILL.md`](./SKILL.md) for the contract an AI agent follows. This file is
the operator's view.

## Run it

```bash
npm install
npm run db:import                 # only needed for the portal, not the skill

npx tsx skills/daily-fees-reminders/run.ts \
  --students data/source/students.csv \
  --payments data/source/payments.csv \
  --as-of 2026-10-31
```

Outputs land in `skills/daily-fees-reminders/out/`:

- `reminders.csv` — one row per overdue student, `status` is `ready` or `held`
- `admin-summary.txt` — counts, money, and the three lists
- `review-report.json` — every uncertain row and why
- `run-manifest.json` — inputs by SHA-256, options, output hashes

## What it will not do

- Send a message. There is no transport in this program at all.
- Guess a student from a partial name or a similar email.
- Convert currency to force a match.
- Count a duplicate row twice.
- Treat a refund as income before a human approves it.
- Chase a future instalment.

## Tests

```bash
npx vitest run tests/skill.test.ts
```

The suite covers determinism (two runs must be byte-identical), the held
reminder, the duplicate row, the future-dated row, per-student currency, the
shared-engine guarantee, and each validation failure.

## Fixtures

`fixtures/students.csv` and `fixtures/payments.csv` are a four-student, nine-row
slice built to contain one of each hard case: a duplicate reference, an
abbreviated payer with a different email, and a payment dated after the as-of
date. `fixtures/payments-broken.csv` exists to prove the importer refuses a
non-numeric amount rather than skipping it.

## Scheduling

Not deployed. See the cron and launchd sketch at the end of `SKILL.md`.
