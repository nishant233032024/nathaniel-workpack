# The skill — 5-minute Loom take (Part 3, Track D)

Single take, screen + voice, **targets 4:40** so it fits Loom's 5-minute free
limit. Quoted lines are what to say; the timings are what to hit.

---

## Before you press record (3 minutes)

1. Terminal at the repo root, font **16pt or larger**, prompt already showing
   `nathaniel-workpack`.
2. Editor open with, in this order:
   - `skills/daily-fees-reminders/SKILL.md`
   - `skills/daily-fees-reminders/out/reminders.csv`
3. Run the command once **before recording** to confirm it works, then delete the
   output folder so the take starts clean:
   ```bash
   rm -rf skills/daily-fees-reminders/out
   ```
4. **Loom:** New video → *Screen and camera* → **Current tab** (the terminal tab)
   → 1080p → mic test, watch 10 seconds back.
5. Notifications off. Nothing else on screen — no client names, no browser tabs
   with personal accounts.

---

## 0:00 — 0:25 · What it is and why

> "Part 3, Track D: a skill called daily-fees-reminders. Every morning it reads
> the school's two money exports, works out who is genuinely overdue as of a given
> date, and writes the day's WhatsApp drafts plus a one-line summary. It never
> sends anything and never invents a payment."

## 0:25 — 1:15 · Run it from scratch

Type the command from `SKILL.md` on camera — do not paste it:

```bash
npx tsx skills/daily-fees-reminders/run.ts \
  --students data/source/students.csv \
  --payments data/source/payments.csv \
  --as-of 2026-10-31 \
  --out skills/daily-fees-reminders/out
```

> "Four files: the reminders, a summary for the admin team, a review report, and a
> run manifest that records exactly which inputs produced this run."

Point at the manifest's `sha256` and `inputFingerprint`.

## 1:15 — 2:05 · Read the output like an admin

Open `reminders.csv`. Point at one `ready` row, then the `held` row.

> "Eight overdue students. Seven get a draft; one is **held**. Tara Pillai's ₹20,000
> is held because an unresolved payment — P5016 — could change her balance. A
> reminder built on a number that might be wrong is worse than no reminder."

Open `admin-summary.txt` and read the headline:

> "25 students, 8 overdue, 7 ready, 1 held, 4 need a person. One line they can read
> in ten seconds."

## 2:05 — 2:50 · The contract

Open `SKILL.md`. Walk it down, do not read it out.

> "Inputs, rules, validation, forbidden inferences, output shape, exit codes. The
> important part is what it is forbidden to do: it must never allocate a payment
> from a partial name, a similar email, or a shared surname. Refusing to guess is
> the feature — the same engine runs behind the portal, so the skill and the desk
> can never disagree about a rupee."

## 2:50 — 3:30 · Determinism

Run it a second time, then hash two files:

```bash
sha256sum skills/daily-fees-reminders/out/reminders.csv \
          skills/daily-fees-reminders/out/admin-summary.txt
```

> "Same hashes as the first run: 2f6959c0 for the reminders, 4b4977d9 for the
> summary. Identical inputs, identical as-of date, identical output — so
> yesterday's list and today's list are comparable."

Be precise if you want extra credit: "the manifest does carry a generation
timestamp, deliberately — operational metadata must not change financial output."

## 3:30 — 4:05 · How it fails

Run it with a missing argument → exit **2** and usage text. Then point it at the
deliberately broken fixture → exit **1**.

> "It fails **before** it writes. A bad input file never leaves half a reminder
> list behind for someone to send by mistake."

## 4:05 — 4:40 · The AI mistake and the honest limit

> "One thing the AI got wrong: the first version passed `payments` where the engine
> wanted `paymentsPath`. The tests passed, the build passed, and the program
> couldn't start — it exited with 'payments file not found at undefined'. I only
> found it by running the CLI from scratch, which is what this video just did.
>
> And it isn't scheduled anywhere. SKILL.md shows the cron shape; putting it on a
> schedule brings its own failure modes — a missed run, a stale export, a double
> run — and I'd rather ship a correct manual tool than a half-monitored cron job."

Stop.

---

## After

1. Loom → sharing set to **Anyone with the link can view**.
2. Part 3 wants a **GitHub link containing `SKILL.md` and the program**:
   `https://github.com/nishant233032024/nathaniel-workpack`
3. Check the published video plays and the terminal text is legible at full
   screen. Terminal captures fall apart at small font sizes.

## If a take goes wrong

- **Typo in the command:** let the shell error show, fix it, carry on. You are
  demonstrating a tool, not a magic trick.
- **Hashes don't match:** you changed the as-of date or the input file between
  runs. Both are visible in the manifest — that is the point of the manifest.
- **Ran long:** cut the "read the output like an admin" section to one row, never
  the held-reminder explanation. The held reminder is the whole safety story.
