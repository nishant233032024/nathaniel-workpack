# The four recordings — runbook

Four videos, 5–10 minutes each, screen-share with your own voice. Natural, not
read. This file is a plan of shots, not a teleprompter.

**Live site:** <https://nathaniel-workpack.vercel.app>

---

## Before every take (2 minutes)

1. Close Slack, WhatsApp, mail. Turn off notifications and Do Not Disturb on.
2. Browser zoom **110%**. One window for the live site, a second for the repo,
   a third for the terminal. Never more than three or the text gets small.
3. Terminal font at 16pt or larger. Run `cd nathaniel-workpack` first so the
   prompt already looks right.
4. Confirm the app is in the state you are about to describe:
   ```bash
   npm run db:import     # local SQLite, says "already imported" if unchanged
   npm test              # 74 passing
   ```
   The live site needs no setup — it reads Postgres.
5. Say the date, your name, and which part it is in the first sentence. It makes
   the four videos easy to order later.

**Public repo:** <https://github.com/nishant233032024/nathaniel-workpack>. It is
live, so say it on camera if you want the link to carry weight — just check it
opens on the day you record.

---

## Part 1 — Dhun (about 7½ minutes)

**You need:** the real Dhun tune page on the left, your clone on the right, and
`src/lib/music/` open in the editor.

### Shots

**0:00 — the ask.** "Part one is a clone of Dhun: the shelf, a tune page, a piano,
and all twelve keys with the note names spelled correctly. Mine is live, and every
claim in this video is on that page."

**0:45 — side by side.** Real Dhun on the left, <https://nathaniel-workpack.vercel.app/dhun/twinkle>
on the right. Name what matches: the handwritten look, the rhythm sticks with the
number and the swara in each cell, the bar lines, the section colours, the star
rating, the desktop and phone layout. Then what is deliberately different, in one
breath: "my own data model and renderer, a synthesised piano rather than samples,
and three tunes instead of their whole shelf. This is not a pixel copy and I am
not going to pretend it is."

Resize the window narrower while you say the last sentence — the layout reflows
and the notation scrolls inside its own frame. That is a requirement, not a nicety.

**2:00 — one tune plays.** Press **Play**. Point at the highlighted column moving
with the sound. Press **Stop**, then **Play** again to show it restarts cleanly.
Say: "the numbers and swaras never change when the key changes. Only the note
names do."

**3:00 — twelve keys.** Click **D**, then **F**, then **A**. Point at the scale
spelling line above the notation changing each time. Then click **G** and point at
degree 7: "that is F sharp, not G flat. The letter comes from the degree's position
in the scale, and the accidental is whatever reaches the right pitch. One function
does this for all twelve keys."

Then the house rules: no octave digits anywhere — octaves live in the number
(`5'`, `,5`) — and the default key is G.

**4:15 — how a tune is stored.** Open `src/lib/music/tunes.ts`. Read one object
aloud from Twinkle: `{ degree: 5, beats: 1 }`. Say: "degree is the scale position,
not a note name, which is why transposing is free. Beats is a duration, so bar
lines can be computed instead of stored."

**5:15 — the spelling function.** Open `src/lib/music/keys.ts`, find `spellDegree`.
Explain in one breath: "letter from the degree, accidental from the difference
between the target pitch and the natural letter."

**6:00 — a fourth tune.** Still in `tunes.ts`: "a fourth tune is one more object
in this array. No renderer, route or playback change." Open
`tests/music.test.ts` and show the test that adds one and renders it.

**6:40 — live, the AI mistake, and the gaps.** Show the URL in the address bar
again, then say:

> "This is deployed. The AI's first version of Happy Birthday was one beat short,
> so the last bar never closed. A bar-count test caught it. I fixed the melody
> data, not the test."

Close with the gaps: synthesised piano, three tunes, no quiz or microphone. "I
know exactly what the next four tunes cost me — one object each."

### Do not say
- That it is a pixel-identical copy.
- Any specific tune count from their shelf unless you have it on screen.

---

## Part 2 — the fees desk (about 9½ minutes)

**You need:** the live fees page, the review queue, and `src/lib/` open.

### Shots

**0:00 — the shape.** <https://nathaniel-workpack.vercel.app/fees>. "25 students,
40 payment rows, reconciled as of 31 October 2026, Asia/Kolkata. It is live, and
the data behind it is Postgres, not a local file."

**0:45 — the money.** Read the four October figures slowly: **₹31,532.00** gross,
**₹689.64** PayPal, **₹30,842.36** net, **₹2,593.22** GST. Then the rule: "GST is
recognised on receipts from Indian students paid in INR, gross times 18 over 118,
extracted from the gross — never after the processor fee. The two USD receipts are
exports of service. An unapproved refund is excluded until a person approves it."

**1:45 — the student table.** Point at Diya Fernandes: "₹10,000 credited, ₹5,000
balance, ₹5,000 overdue." Then: "one of her two ₹5,000 rows is a duplicate export
line. If I counted both she would look fully paid, and we would stop chasing a
student who still owes money. That is the trap in this data."

**2:45 — the "needs a person" list.** Four open cards. Walk three, and for each
read the two lines on the card out loud — what happens to **cash**, what happens
to **student credit**:

- **P5016**, "Tara P.", different email from anyone on file → weak hint only, her
  reminder is held.
- **P5039**, Ravi pays ₹5,000 cash but is billed in EUR → currency mismatch, not
  converted silently.
- **P5037**, −₹15,000 "refund" → refunds are never inferred.

Say the line that answers their question directly: "a payment is counted once
because every row gets exactly one verdict, and the only thing the verdict changes
is cash and student credit — two separate fields, never a running balance."

**4:45 — fix one live, then undo.** On P5016 choose **S110 Tara Pillai** and press
**Assign**. The page re-renders: her credited goes ₹10,000 → ₹25,000, her balance
₹20,000 → ₹5,000, the held badge disappears, and the desk totals move by ₹15,000.

Say: "that is a real write to the live database, and the audit log recorded who
decided it."

Then press **Undo**. Everything returns: ₹10,000, ₹20,000, held, overdue ₹20,000
at 54 days. "The decision is reversed, but the audit log keeps both entries. That
is deliberate — you can always see that a person touched it."

**6:15 — the schema.** Open `src/lib/db/postgres.ts` and point at the tables:
students, payments, resolutions, import_batches, audit_log. Then the important
sentence: "**there is no balance column.** Balances are derived on every read, so
re-importing the file cannot double-count anything — there is no stored total to
double. The import itself is keyed on the SHA-256 of the pair of files, so a second
import writes nothing and says so."

**7:30 — one engine.** Open `src/lib/finance/reconcile.ts` briefly. "The portal and
the daily-reminder CLI both call this one function. There is exactly one
implementation of the money rules in this repo."

**8:15 — the anomalies.** Name the count: thirteen documented problems in the 40
rows, each handled explicitly and each with a test — duplicate reference, partial
name, currency mismatch, overpayment held as credit, future-dated payment, refund,
and instalments that do not divide evenly (the remainder is given one paisa at a
time to the earliest instalments, so the parts always add back to the fee).

**9:00 — the AI mistake and the honest caveat.**

> "The AI's first refund implementation recorded the cash but forgot to reverse the
> student's credit. Nina's balance stayed at zero after a ₹15,000 refund. A test
> asserting her credited amount caught it."

Then: "the desk has no login. The data here is fictional exercise data — but that
is the first thing I would add before this held a real student's record."

### Do not say
- That it is a production-ready finance system for a real school.
- That the portal is authenticated.

---

## Part 3 — the skill (about 6½ minutes)

**You need:** a terminal at the repo root, `skills/daily-fees-reminders/` open.

### Shots

**0:00 — what it is.** "Track D. Every morning it reads the two money exports,
works out who is genuinely overdue as of a given date, and writes the day's
WhatsApp drafts plus a one-line summary. It never sends a message and never invents
a payment."

**0:45 — run it from scratch.** Delete the output folder on camera, then type the
exact command from `SKILL.md`:

```bash
npx tsx skills/daily-fees-reminders/run.ts \
  --students data/source/students.csv \
  --payments data/source/payments.csv \
  --as-of 2026-10-31 \
  --out skills/daily-fees-reminders/out
```

Show the four files appearing. Open `reminders.csv`: point at one `ready` row, and
the one `held` row for Tara Pillai, and read its reason — an unresolved payment
could change her balance, so the reminder waits for a person.

**2:00 — open SKILL.md.** Walk the contract: inputs, rules, validation, forbidden
inferences, output shape, exit codes. Read one forbidden inference aloud: it must
never allocate a payment from a partial name, a similar email, or a shared surname.
"That is the whole safety story: refusing to guess is a feature."

**3:15 — determinism.** Run it a second time, then hash the content files:

```bash
sha256sum skills/daily-fees-reminders/out/reminders.csv \
          skills/daily-fees-reminders/out/admin-summary.txt
```

Same hashes as the first run. Say why it matters: "the admin can trust that
yesterday's list and today's list are produced the same way." Be precise if asked:
the `run-manifest.json` records a generation timestamp, so *it* differs; the three
content files do not.

**4:00 — failure behaviour.** Run it with a missing argument → exit code **2** and
the usage text. Then point it at the deliberately broken fixture → exit code **1**
and **no files written**. "It fails before it writes, so a bad morning never leaves
half a reminder list behind."

**4:45 — the AI mistake.**

> "The first version passed `payments` where the engine wanted `paymentsPath`. The
> tests passed, the build passed, and the program could not start — it exited with
> 'payments file not found at undefined'. I only found it by running the CLI from
> scratch, which is exactly what this video does."

**5:30 — what it does not do.** "It is not scheduled anywhere. `SKILL.md` shows the
cron line; putting it on a schedule is a separate decision with its own failure
modes — a missed run, a stale file, a double run. I would rather ship a correct
manual tool tonight than a half-monitored cron job."

---

## Part 4 — Shruti (about 8 minutes)

**You need:** `docs/mac-app/shruti-flow.svg` open in a browser, and
`shruti-architecture.md` beside it.

### Shots

**0:00 — the product.** "A menu-bar mixer for macOS: per-app volume, EQ and
routing. I am not shipping a native app tonight — the brief asks for the
architecture, so this is the plan I would defend in a design review."

**0:45 — the diagram.** Trace it with the cursor: source app → process tap →
aggregate device → per-app engine → mix → output → speakers. Name what runs where:
the tap and the real-time render happen in the app's audio process; the UI is
separate and never blocks audio.

**2:00 — the one fact that decides everything.** "macOS 14.2 added Core Audio
process taps. `AudioHardwareCreateProcessTap` takes a `CATapDescription` and the tap
becomes an **input on a HAL aggregate device**. A tap can also mute the source
app's output. Two consequences: **no virtual audio driver**, so no admin install —
just a narrow audio-capture permission. And capturing is not controlling: to change
what the user hears I have to capture, mute, process and render it myself."

Say the cost of that: **minimum macOS 14.2**, and older Macs get a clear "too old"
message instead of a silently broken mixer.

**3:00 — the failure you must design for.** "If I mute the source and my engine
dies, the user loses audio completely. So: never mute until the replacement path is
running, a watchdog that restores the source at the first sign of trouble, and a
menu-bar 'restore audio' that always works."

**4:00 — unplug mid-song.** "A device-change listener rebuilds the aggregate and
reopens the output on the new device; if that fails, fall back to system output and
say so in the menu bar rather than going silent."

**4:45 — shipping it.** Developer ID signing, hardened runtime, minimal
entitlements; notarise with `notarytool submit --wait` then `stapler staple`, in CI
on every release; Sparkle 2 with a signed appcast and staged rollout; licences sold
through a merchant of record so VAT is their problem, verified offline with an
embedded public key, never blocking the audio engine on a network call. "Direct
distribution, not the Mac App Store at first — the sandbox is a poor fit for an
audio product."

**6:00 — who buys, price, launch.** Students and teachers practising with
recordings first, then producers and streamers, then podcasters. A one-time **$29**
for individuals and **$59** for a studio licence, 14-day trial — a hypothesis to
test, not a conclusion.

The 127,000-subscriber channel: "do not announce a product. Publish a lesson that
could not exist without it — how to practise a fast passage by slowing the
recording and lifting your own instrument. The tool is on screen the way a
metronome would be. The video stands alone if nobody buys. One pinned link. That is
the whole campaign."

One viral idea: **shareable practice mixes** — a teacher sends a mix preset, a
student's Mac adopts it in one click, encoded in the URL so it needs no server.

One number: **activation** — installs that create a custom per-app mix in the first
session and still have it applied on day seven. Not downloads, not views.

**7:15 — the three quick answers.** Twice-paid student → record the cash, hold the
excess as credit on account, never silently keep it as income; a refund is a
separate approved event. Slow page on a cheap phone → measure first, then bytes,
render-blocking work, main-thread JS, and only then framework-level changes; on a
cheap Android the CPU is the constraint. When not to let AI write the code → money
movement, auth, destructive migrations, licence enforcement, and the real-time
audio thread: "I will let it draft those, but not be the last reader. If I cannot
explain it or test it, it does not ship."

**7:45 — the AI mistake.**

> "The AI once assumed the €350 instalment schedule was 117, 117, 116 because a
> student paid €117 — it copied the payment instead of computing the split. A test
> whose expected value was the wrong one exposed it. That is exactly the error that
> would put a plausible wrong number in an architecture document, which is why every
> API claim in this doc is marked verified with a link to Apple's documentation."

---

## Say this in every video

Which tool, what it did well, and one specific thing it got wrong that you caught.
Use the different mistake listed in each part above — they are all real and recorded
in `docs/ai-use.md`.

**Never claim:** a deadline extension (the page says about 4–5 days and shows no
expired deadline), that all four tracks were attempted (this is Track D), that the
Mac app exists, or a link you have not opened on the day.
