# Part 2 voice note — the fees desk (≈6:00, ~860 words)

Read at about 145 words a minute. Bracketed marks are breaths.

---

(0:00) I'm Nishant. Part 2 is the fees portal: twenty-five students, forty payment
rows, reconciled as of the thirty-first of October, twenty twenty-six, India time.
It's live, and it reads a real Postgres database, not a local file.

I'll be specific with numbers, because the numbers are the point. [breath]

Six figures sit across the top. Agreed fees, six hundred and ten thousand, three
hundred and fifteen rupees. Credited to fees, four hundred and seventy-four thousand,
two hundred and thirty-six rupees. Still to collect, one hundred and thirty-six
thousand and seventy-nine rupees. Overdue today, one hundred and eleven thousand, one
hundred and forty-three rupees and twenty-two paise. Held on account, eight thousand
rupees. Unallocated cash, zero.

Those are derived every time the page loads. There is no stored balance anywhere in
that database.

October receipts are separate, because they're a cash question, not a debt question.
Gross receipts in October: thirty-one thousand, five hundred and thirty-two rupees,
across four receipts. PayPal kept six hundred and eighty-nine rupees and sixty-four
paise. Net: thirty thousand, eight hundred and forty-two rupees and thirty-six paise.
And GST included: two thousand, five hundred and ninety-three rupees and twenty-two
paise, on seventeen thousand rupees of Indian receipts.

The GST rule matters. It applies to receipts from students in India, paid in rupees,
and it's extracted from the gross — gross times eighteen over one hundred and
eighteen — never after the processor fee. The two dollar receipts are exports of
service and carry no GST here. [breath]

Now the student table. Every student, their fee, what they've paid, what's left, how
far overdue, and a status badge: paid, due, overdue, on account, or needs a person.

Diya Fernandes, for example: fifteen thousand agreed, ten thousand credited, five
thousand outstanding, five thousand of it overdue by ten days. And the reason she
isn't further along is the trap in this data: two of her payments look identical —
same payer, same date, same amount, same reference, ten thousand in total. Only one of
them is real cash. If you counted both she'd look fully paid and you'd stop chasing
someone who still owes five thousand rupees.

That's the duplicate detection rule: same payer, same date, same amount, and a
non-empty reference. Without a reference it stays in review, because two genuine
payments can look identical. [breath]

Which is the next section: needs a person. Four open items, plus one the code
resolved automatically. Nothing here has been guessed.

Item one, five zero one six. The payer is "Tara P." — a partial name — with an email
that matches no student. There's a Tara Pillai on the roster, so the page offers her as
a weak hint, clearly labelled as weak: a first name is not a match. Her reminder is
held until a human decides.

Item two, five zero three nine. Ravi Kumar is billed in euros, but this payment is five
thousand rupees in cash. That's a currency mismatch. It is not silently converted.

Item three, five zero four zero. Omar Sethi, billed in dollars, paid three hundred and
thirty rupees by PayPal. Same problem.

Item four, five zero three seven. A minus fifteen thousand rupee row with the note
"refund, moved to a later batch". Refunds are never inferred. It stays out of both cash
and credit until a person approves it. [breath]

For each of those cards the page shows two separate lines: what happens to cash today,
and what happens to student credit. That separation is the answer to "how do you stop
a payment being counted twice". Every row gets exactly one verdict, and the verdict
moves cash and credit as two separate things.

Actions are limited to what this data actually needs: assign to a student, with an
explicit tick if it crosses currencies; treat as real cash with no student; approve a
refund; hold; and undo.

I ran that on the live site. Assigning five zero one six to Tara Pillai moved her
credited from ten thousand to twenty-five thousand, her balance from twenty thousand
to five thousand, released her hold, and moved the desk totals by fifteen thousand.
Then I pressed undo, and every figure went back to where it started. The audit log kept
both entries, deliberately: you can always see that a person touched it, and what they
did. [breath]

The database stores inputs and decisions only — students, payments, resolutions, import
batches, audit log. There is no balance column. That's why re-importing the same files
can't double-count: there's no running total to double. The import is keyed on a
fingerprint of the two files, so a second import writes nothing and says so.

Thirteen problems are documented in these forty rows, each handled explicitly, each with
a test: the duplicate, the partial name, the currency mismatches, an overpayment kept as
credit rather than revenue, a payment dated after the as-of date excluded from October,
a genuine partial payment, and instalments that don't divide evenly — where the
remainder goes one paisa at a time to the earliest instalments so the parts always add
back to the fee. [breath]

One thing the AI got wrong. Its first refund implementation recorded the cash but forgot
to reverse the student's credit, so Nina Khan's balance stayed at zero after a fifteen
thousand rupee refund was approved. A test asserting her credited amount caught it.

The honest caveat: this desk has no login. The data is fictional exercise data, but that's
the first thing I'd add before it held a real student's record.

It's live at nathaniel-workpack dot vercel dot app, slash fees.
