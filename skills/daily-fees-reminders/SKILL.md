# Skill: daily-fees-reminders

A morning job for the fees desk. It reads the school's two money exports, works
out who is overdue **as of a given date**, and writes the day's WhatsApp
reminders plus a one-line summary for the admin team.

It never sends a message, never invents a payment, and never guesses which
student a payment belongs to. When the money is uncertain, it holds the
reminder and says why.

---

## Purpose

Every morning the admin team needs two things before 9am:

1. A short, polite message for each student who is genuinely overdue.
2. A single summary line they can read in ten seconds.

Doing this by hand is where double-counted payments and wrong reminders come
from. This skill makes the arithmetic deterministic and puts every uncertain
case in front of a human.

## Inputs

| Input | Required | Meaning |
| --- | --- | --- |
| `--students` | yes | The students export (`student_id,name,email,country,course,start_date,plan,currency,course_fee`). |
| `--payments` | yes | The raw payments export (`payment_id,date,payer_name,payer_email,currency,amount,method,reference,note`). |
| `--as-of` | yes | The date to reconcile to, `YYYY-MM-DD`. Not today's date by accident. |
| `--out` | no | Output directory. Default `skills/daily-fees-reminders/out`. |
| `--resolutions` | no | JSON array of human decisions already made in the portal. |
| `--first-due` | no | `start_date` (default) or `day_before_start`. |
| `--strict-today` | no | Treat an obligation due exactly on the as-of date as overdue. |

No other inputs. No network access. No API keys.

## Exact command

From the repository root:

```bash
npx tsx skills/daily-fees-reminders/run.ts \
  --students data/source/students.csv \
  --payments data/source/payments.csv \
  --as-of 2026-10-31 \
  --out skills/daily-fees-reminders/out
```

With decisions recorded by a human:

```bash
npx tsx skills/daily-fees-reminders/run.ts \
  --students data/source/students.csv \
  --payments data/source/payments.csv \
  --as-of 2026-10-31 \
  --resolutions data/resolutions.json \
  --out skills/daily-fees-reminders/out
```

## Business rules

1. **Three instalments**, equal to the nearest minor unit. The remainder is
   given one unit at a time to the earliest instalments, so the parts always add
   back to the fee exactly. `full` plans are one obligation.
2. **First instalment** is due on the course start date (`--first-due
   day_before_start` for the stricter reading). Later ones are every 30 days,
   counted from that anchor — never from when the previous payment arrived.
3. **Overdue** means the due date is strictly before the as-of date. A payment
   due today is not yet missed unless `--strict-today` is passed.
4. **Days overdue** is measured from the oldest unsettled due date.
5. **A payment is only allocated** when the payer email matches a student
   exactly, or the payer name matches a student's full name exactly and
   uniquely. A partial name is a hint, never a match.
6. **The payment currency must equal the student's currency.** Otherwise the row
   waits, even when the email matches.
7. **Duplicate rows** are rows with the same payer, date, amount, currency and
   non-empty reference. They count once. Rows without a reference are never
   deduplicated.
8. **A negative amount is a refund**, and is ignored until a person approves it.
9. **Payments dated after the as-of date** are excluded from balances and
   receipts.
10. **Overpayment** beyond the fee stays as credit on account; it is not income.
11. **PayPal** keeps 4.4% of gross plus 0.30 in the payment currency. That fee
    reduces school receipts, never the student's credit.
12. **GST** is the 18/118 portion of gross receipts from students in India paid
    in INR. It is never extracted after deducting the processor fee.
13. **All money is integer minor units.** No floating point touches a balance.

## Validation

The skill fails — writing no files at all — when:

- a required argument is missing (exit 2);
- `--as-of` is not a real `YYYY-MM-DD` date (exit 1);
- an input file is missing or unreadable (exit 1);
- a required CSV column is missing, or any row has an unparseable amount,
  invalid date, or unsupported currency (exit 1);
- either file has no data rows (exit 1);
- the resolutions file is not JSON, is not an array, or contains an action
  outside `assign | duplicate | unallocated | accept_refund | hold` (exit 1).

It does **not** fail on data problems that a human should resolve — those become
review items and held reminders.

## Forbidden inferences

The skill must never:

- allocate a payment from a partial name, a similar email, or a shared surname;
- convert one currency into another to make a match work;
- deduplicate rows that have no reference;
- invent a refund, a waiver, or a discount;
- treat unallocated cash as revenue or as a student credit;
- chase a future instalment, or include future fees in an overdue amount;
- send anything, or produce a phone number that was not in the input;
- claim a payment was received when it was only expected.

## Human-review boundaries

A reminder is written but marked `held` when an unresolved payment could change
that student's balance — for example an unmatched receipt naming them, a
currency mismatch, or a refund awaiting approval. Held rows are listed
separately in the summary and never counted as ready to send.

## Failure behaviour

- Exit `0`: all four files written.
- Exit `1`: validation or input failure; nothing written; the reason and the
  failing row are printed.
- Exit `2`: usage error; the usage block is printed.

Outputs are built entirely in memory and only then written, so a crash cannot
leave yesterday's summary half-replaced.

## Output contract

| File | Contents |
| --- | --- |
| `reminders.csv` | `student_id,name,currency,overdue_amount,days_overdue,status,phone,message`. `status` is `ready` or `held`. Amount is a plain decimal in the student's own currency. `phone` is empty because the export has no phone column. |
| `admin-summary.txt` | Counts, INR totals, the month's receipts, then three lists: ready, held (with reasons), and needs-a-person. Ends with the input fingerprint. |
| `review-report.json` | Every review item with source row, reasons, candidates, treatments, plus totals and receipt figures. |
| `run-manifest.json` | Skill version, as-of date, input paths with SHA-256, option values, output hashes, and a generation timestamp. |

**Determinism.** For identical inputs, options and as-of date, `reminders.csv`,
`admin-summary.txt` and the financial contents of `review-report.json` are
byte-identical. The only file that changes between runs is `run-manifest.json`,
which carries `generatedAt` as operational metadata.

## Scheduling

This is a program with a documented contract, not a deployed scheduler. To run
it every weekday morning at 06:30 IST, a cron entry would be:

```cron
30 6 * * 1-6 cd /srv/nathaniel && npx tsx skills/daily-fees-reminders/run.ts \
  --students data/source/students.csv \
  --payments data/source/payments.csv \
  --as-of "$(date +\%F)" \
  --out /srv/nathaniel/out >> /var/log/fees-reminders.log 2>&1
```

On a Mac, `launchd` with `StartCalendarInterval` is the equivalent. **No
scheduler is deployed as part of this work pack.**
