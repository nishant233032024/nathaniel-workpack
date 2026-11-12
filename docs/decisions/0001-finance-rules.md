# Decision record 0001 — the money rules

Every rule below is either given by the assignment or chosen by me. Where it is
my choice, the alternative is named, because the reviewer should be able to
disagree with a decision rather than discover it.

## Given by the exercise

| Rule | Value |
| --- | --- |
| As-of date | 2026-10-31, Asia/Kolkata |
| Instalments | three, equal |
| First instalment | before the course start date |
| Later instalments | every 30 days |
| FX | 1 USD = ₹84, 1 EUR = ₹91, fixed |
| PayPal | 4.4% of gross + 0.30, in the payment's currency |
| GST | fees paid in India include 18% GST, shown separately |

## 1. Money representation

**Decision:** every amount is an integer in the currency's minor unit (paise,
cents). Formatting is the only place a decimal point exists.

**Why:** `0.1 + 0.2 !== 0.3`. A portal that sums floats will eventually disagree
with itself by a paisa, and then nobody trusts any of it.

**Consequence:** the FX conversion is exact by construction. All three supported
currencies have 100 minor units per major unit, so `paise = cents × 84`. A test
asserts this identity.

## 2. The first instalment due date

**Decision:** due **on** the course start date. Configurable to the day before
(`firstInstalmentOffsetDays: -1`).

**Why:** "before the course starts" means payable before the first lesson. Treating
the start date itself as the due date is the reading that matches how the source
payments behave (most arrive a few days early) and it avoids inventing a due date
the school never wrote down.

**Alternative:** `start_date − 1`. It changes days-overdue by one for every
student and no balances. Both are in the tests.

## 3. The 30-day anchor

**Decision:** instalment *n* is due `first_due + 30 × (n − 1)`. The anchor is the
start date, never the previous payment's arrival date.

**Why:** otherwise a late payment silently moves every later deadline, and a
student who pays late is never overdue again. That would flatter the numbers.

**Alternative:** rolling 30 days from each actual payment.

## 4. Is something due today overdue?

**Decision:** no. Overdue means `due_date < as_of` strictly. `--strict-today`
flips it.

**Why:** the admin chases what has been missed. Calling today's obligation
overdue on the morning it is due produces a wrong reminder.

**Consequence:** days overdue is measured from the oldest unsettled due date, so
"₹20,000, 54 days" means the oldest unpaid instalment is 54 days late.

## 5. Splitting a fee that does not divide evenly

**Decision:** the remainder is handed out one minor unit at a time to the
**earliest** instalments. €350 becomes 116.67 / 116.67 / 116.66.

**Why:** the parts must always add back to the fee exactly, and the result must
not depend on iteration order.

**Alternative:** put the remainder last (116.66 / 116.67 / 116.67) or round the
first instalment up only. Any choice is defensible; the invariant is not.

## 6. Credit applied to instalments

**Decision:** oldest-first.

**Why:** it gives one answer to "which instalment is this money for?" and makes
the overdue figure the tail of the schedule rather than an accident of ordering.

## 7. Duplicate detection

**Decision:** a row is a duplicate when payer, date, amount, currency **and a
non-empty reference** all match an earlier row. The earlier row keeps the money.

**Why:** a repeated export line is the most dangerous artefact in this data. But
two genuine payments can share a name, a date and an amount, so a reference is
required before anything is collapsed. Rows without a reference are never
deduplicated.

**Consequence:** `P5036` is ignored, and Diya is ₹5,000 short instead of fully
paid. There is a test for exactly this.

## 8. Identity matching

**Decision:** a payment is allocated only on an exact email match, or an exact
unique full-name match. Partial names produce a **weak hint** that a human must
act on. No fuzzy score ever allocates money.

**Why:** money assigned to the wrong student is worse than money left in a queue.
"Tara P." with a different email is exactly the case where a confident guess
would be wrong often enough to matter.

## 9. Currency

**Decision:** the payment currency must equal the student's billing currency.
A mismatch goes to review. A human can accept a cross-currency allocation
explicitly, which converts at the fixed rate and is recorded as such.

**Why:** ₹5,000 from Ravi (a EUR student) and ₹330 from Omar (a USD student) are
either mistakes, tips, or payments for something else. None of those should be
guessed. And INR does not imply India: GST follows the student's country, not the
currency symbol.

## 10. Refunds

**Decision:** a negative amount is never applied automatically. On approval it
becomes a separate event that reduces cash **and** reverses the student credit,
reopening their balance.

**Why:** the brief says not to invent refunds. `P5037` ("refund: moved to a later
batch") is a human decision, and until it is made Nina's account must not pretend
either that she paid ₹30,000 or that she owes ₹15,000.

## 11. Overpayment

**Decision:** anything credited beyond the fee is `overpaymentCreditMinor`, held
on account. It is not revenue and it does not reduce another student's balance.

**Consequence:** Aarav's extra ₹8,000 shows as credit, and the "agreed fees"
total does not move.

## 12. Cash versus credit versus revenue

**Decision:** three separate numbers, always:

- **gross cash received** — money that actually arrived, converted to INR;
- **unallocated cash** — arrived, owned by no student yet;
- **student credit** — money applied to a fee.

**Why:** collapsing them is how a portal starts lying. The brief's own wording —
"flagged", "the file shows what the student paid, not what reached us" — only
makes sense with the distinction.

**Terminology:** the portal says "receipts", not "revenue". No recognised revenue
is modelled, so it must not claim to be.

## 13. PayPal fees

**Decision:** 4.4% of gross, rounded to the payment currency's minor unit, plus
0.30, converted to INR at the fixed rate. It reduces school receipts only.

**Why:** the student paid the gross amount, so their balance falls by the gross.
The school receives less. Two different questions, two different numbers.

**Consequence:** Sam's $110 costs $5.14 (4.84 + 0.30) = ₹431.76; Maya's $63 costs
$3.07 = ₹257.88.

## 14. GST

**Decision:** GST is recognised only when the student's country is India **and**
the receipt is in INR: `GST = gross × 18 / 118`. Exports of service (the USD
receipts) carry none here. Unallocated cash carries none until it is attributed.

**Why:** GST follows the place of supply, not the currency. The brief warns
against equating INR with Indian GST applicability, so the country is checked
explicitly.

**Rounding:** per receipt, to the paisa, then summed. For October that is
₹1,372.88 + ₹1,220.34 = ₹2,593.22.

**Order of operations:** GST is extracted from **gross**, never from gross minus
the processor fee. The fee is a cost of collection, not a reduction in the
consideration.

**What this is not:** a tax filing. The data has no GSTIN and no place-of-supply
evidence beyond the student's country.

## 15. Future-dated payments

**Decision:** a payment dated after the as-of date is excluded from balances and
from the month's receipts, and listed separately.

**Why:** a portal that reports "today" must not include money dated next week.
`P5011` (8 Nov) is the only one.

## 16. Derived balances, not stored balances

**Decision:** the database holds source rows, human decisions, import batches and
an audit log. Every balance is computed on read.

**Why:** it makes re-import idempotent by construction. There is no counter that
can be incremented twice, so "import the file again" cannot change a rupee.

**Cost:** a little CPU per page load. At 40 rows that is free; at 40,000 it would
need a materialised view, which would then need the same care.

## 17. Reminder safety

**Decision:** a reminder is drafted for every overdue student, but marked
**held** when an open review item could change that student's balance.

**Why:** telling a student they owe ₹20,000 when a ₹15,000 receipt may be theirs
is the kind of error that costs a school a customer. `SKILL.md` forbids the
inference; the test asserts Tara's draft is held.
