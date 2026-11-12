# Part 3 voice note — the skill (≈6:00, ~800 words)

Read at about 140 words a minute. Bracketed marks are breaths.

---

(0:00) I'm Nishant. Part 3 is Track D, and the deliverable is a skill called
daily-fees-reminders: a morning job for the fees desk.

Every morning it reads the school's two money exports, works out who is genuinely
overdue as of a given date, and writes the day's WhatsApp drafts plus a one-line
summary for the admin team. It never sends a message. It never invents a payment. And
when the money is uncertain, it holds the reminder and says why. [breath]

It's a command line program, run from the repository root. The command is in the skill
file, and it's four arguments: the students export, the payments export, the date to
reconcile to, and an output folder. The date is explicit — you cannot accidentally
reconcile to today when the exercise is fixed at the thirty-first of October.

Run it and it writes four files. The reminders as a CSV. A plain-text summary for the
admin team. A review report in JSON, listing every payment that needs a person and why.
And a run manifest that records exactly which input files produced this run, by
checksum, so a list of reminders can always be traced back to the data behind it.

The summary is the bit an admin actually reads. Here's the headline from the real run:
twenty-five students, eight overdue, seven ready, one held, four need a person. Then
the money: agreed fees, credited, outstanding, overdue, held on account. Then October
receipts, with processor fees and GST shown separately. [breath]

Eight overdue, but only seven drafts. The eighth is held, and that's the feature I care
most about. Tara Pillai owes twenty thousand rupees, and there's a payment of fifteen
thousand sitting in the review queue that might belong to her — a partial name and an
email that matches nobody. If it does belong to her, her balance is wrong. So the skill
doesn't send a reminder quoting a number that might be wrong. It holds it and prints the
reason.

I'd rather annoy an admin than send a student a demand for money they may already have
paid. [breath]

The reminders themselves are one per overdue student, in that student's own currency.
A euro student gets euros, a dollar student gets dollars, a rupee student gets rupees.
Each one quotes only the overdue amount, never a future instalment, and contains no
invented links or phone numbers. There is no phone number column in the export, so the
draft says so plainly, in the message, rather than pretending to have a recipient.

Now the contract, which is the skill file. It lists the inputs, the rules, the
validation, the output shape, and the exit codes. The most important section is the
forbidden inferences: the skill must never allocate a payment from a partial name, a
similar email, or a shared surname. Refusing to guess is the design.

And it shares its engine with the portal — the same reconciliation function. There is
exactly one implementation of the money rules in this repository, so the CLI and the
desk cannot disagree about a rupee. [breath]

Determinism: run it twice and the content is identical. The reminders file hashes the
same both times, the summary hashes the same both times, the review report too. Same
inputs, same as-of date, same output — so yesterday's list and today's list are
comparable, and an admin can trust that nothing shifted except the data.

One precise caveat: the manifest carries a generation timestamp. That's deliberate —
operational metadata must not change financial output, but you should be able to see
when a run happened.

Failure behaviour is the other half of trust. Run it with a missing argument and it
exits with code two and prints the usage. Point it at a deliberately broken payments
file and it exits with code one and writes nothing. Nothing. It fails before it writes,
so a bad file never leaves half a reminder list behind for someone to send by mistake.
[breath]

One thing the AI got wrong. Its first version passed "payments" where the engine wanted
"paymentsPath". The unit tests passed, the production build passed, and the program
couldn't start — it exited with "payments file not found at undefined". I only found it
by running the command from scratch, which is exactly what this video is doing.

That's the lesson I'd keep: a passing test suite says the code I tested works, not that
the thing I built runs.

And the honest limit: it isn't scheduled anywhere. The skill file shows the cron shape,
but putting it on a schedule brings its own failure modes — a missed run, a stale
export, a run twice in a day. I'd rather ship a correct manual tool tonight than a
half-monitored cron job I can't defend.

The code, the skill file and the program are in the public repository at nishant two
three three zero three two zero two four, slash nathaniel-workpack, under skills, slash
daily-fees-reminders.
