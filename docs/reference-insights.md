# Reference insights

## First, an honest note about the material

The prompt says a shortlisted student's `package.json`, `README.md` and `SKILL.md`
are attached. **They are not present in this workspace or in this conversation.**
I checked the project folder: there is no such attachment, and no file from
another candidate. So I have not read them, and I will not pretend to have.

Everything in the "reference observation" column below is therefore marked for
what it is: a claim in the prompt, or a question the prompt asked me to
investigate. The "our decision" column is mine, made independently from the
assignment text and the real CSVs.

If the files are supplied later, re-run this table against them. The questions in
the last section are the ones I would ask first.

---

## Insights table

| Reference observation | Evidence | Useful principle | Risk or limitation | Our independent decision | Verification |
| --- | --- | --- | --- | --- | --- |
| The project had `package.json` scripts and shared libraries (`prompt claim`, unverified) | Not attached; cannot inspect | Put the finance rules in one shared module and call it from both the portal and the skill | A shared module can still hide two behaviours behind one name if the inputs differ | One engine, `src/lib/finance/reconcile.ts`, imported by both. No second implementation anywhere | `tests/skill.test.ts` asserts the skill and a direct engine call produce identical totals and fingerprint |
| A `SKILL.md` describes plain-language steps for an agent (`prompt claim`, unverified) | Not attached | An agent-facing contract should state inputs, rules and forbidden inferences in prose a human can audit | Docs drift from code unless something checks them | `SKILL.md` is written against the actual CLI; every validation rule in it exists in `lib.ts` and has a test | `tests/skill.test.ts` covers each validation branch |
| "Flagged" payments may be excluded from cash, from credit, or both (`open question`) | The brief says the file shows what the student paid, not what reached the school, and asks for a "needs a person" list | The honest answer is that these are **three different questions**: did money arrive, whose is it, and how much of the fee does it settle | A single "flagged" boolean hides which of the three is in doubt and makes the month's income wrong | Every review item states `cashTreatment` and `creditTreatment` separately, plus what a correction would do | `/fees` review cards; `PaymentLine.cashInrPaise` vs `creditMinor` are separate fields |
| An overpayment might still be genuine received cash (`open question`) | `P5038`: Aarav's fourth ₹8,000 on a ₹24,000 fee | Cash and student credit are not the same ledger | If overpayment is treated as revenue, the school overstates income and understates liability to the student | Counted as cash received **and** held as credit on account; the fee is never exceeded | `reconcile.real-data.test.ts` asserts ₹24,000 credited and ₹8,000 credit |
| An unmatched receipt might count as unallocated cash (`open question`) | `P5016`, `P5039`, `P5040` cannot be allocated safely | Real money with no owner is a liability, not revenue | Reporting it as income overstates the month and hides a real problem | Unmatched rows are **excluded from cash** until a human chooses "real cash, no student", which then reports it as unallocated cash | `unallocated` resolution branch; test asserts ₹5,000 appears only after the decision |
| The first instalment's date might or might not satisfy "before course start" (`open question`) | Brief: "the first before the start date" | Ambiguous rules must be configurable and documented, not silently picked | A one-day difference changes every days-overdue figure | Due **on** the start date by default, `--first-due day_before_start` available, both documented and tested | `tests/finance.test.ts` + skill test comparing both modes |
| Documented example totals might not match the files (`open question`) | No example totals were supplied to me | Never publish a number you have not recomputed | A copied total is the fastest way to fail the "money is right" criterion | Every figure in the README was computed by the engine from the CSVs and is asserted in `npm run verify` | `scripts/verify.ts` fails the build if a headline number moves |
| A shortlisted project likely prioritised a working vertical slice over breadth (`assumption`) | Nothing inspected | Ship the smallest thing that is correct end to end | Copying that shape without the reasoning produces a demo, not an understanding | Same principle applied independently: one app, one engine, four routes, no bonus features | Route list in `next build` output |

---

## What I deliberately did differently

Three low-cost differences, each with a problem, a tradeoff, and a test.

### 1. Cash, credit and unallocated cash are three numbers

- **User problem:** the admin cannot tell "money arrived" from "this student has
  paid" from "we have ₹5,000 nobody owns". One number cannot answer three
  questions, and the month's income goes wrong.
- **Tradeoff:** more fields, a busier table, and a queue that must be worked.
- **Why tonight:** it costs two extra integers per payment row, not a feature.
- **Tested by:** `P5038` (overpayment), `P5039` (unallocated), and the
  `unallocated` resolution branch.

### 2. Every number links to its source row

- **User problem:** when a balance looks wrong, the admin needs to see which line
  of which export produced it, not a total they must trust.
- **Tradeoff:** the portal must retain `source_row` and raw values, and the
  student page is bigger.
- **Why tonight:** it is one column and one page, and it is the difference
  between "the code says so" and "here is why".
- **Tested by:** `/fees/students/S104` showing row numbers; raw values preserved
  in the database.

### 3. Reminders are held, not suppressed

- **User problem:** sending a chase for ₹20,000 when a ₹15,000 receipt may belong
  to that student damages trust. Silently dropping the reminder hides the problem
  from the admin instead.
- **Tradeoff:** the admin sees a draft they cannot send, plus a reason — slightly
  more work, no wrong message.
- **Why tonight:** it is a boolean and a string.
- **Tested by:** `tests/skill.test.ts` asserts Tara's row is `held` and the
  summary counts it separately.

---

## Questions I would ask about the reference project, if it were supplied

1. Does "flagged" remove a payment from cash, from student credit, or both — and
   is that consistent everywhere?
2. Is a duplicate detected by reference, or by name/date/amount? The latter
   silently merges two genuine payments.
3. How is an overpayment represented — a negative balance, a credit field, or
   nothing? Only the second survives a reconciliation.
4. Are balances stored or derived? If stored, what makes a re-import idempotent?
5. Does the skill share the portal's engine, or re-implement it?
6. Are example totals in the README computed, or typed by hand?
7. Is GST taken from gross or from net of processor fees?
8. What happens to a payment dated after the as-of date?
9. Can a human undo a decision, and is the decision audited?
10. Are the CSV rows retained raw, or only in normalised form?

A conventional answer to all ten, honestly implemented, is worth more than a
novel one that cannot be explained.
