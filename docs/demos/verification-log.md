# Verification log

What was actually run, on what, and what it proved. Written so a reviewer can
repeat it rather than trust it.

**Date:** 11 November 2026 · **Machine:** Windows, Node 24.22.1, Next.js 15.5.29.

---

## 1. Automated tests

```
$ npx vitest run
 ✓ tests/finance.test.ts            (22 tests)
 ✓ tests/music.test.ts              (16 tests)
 ✓ tests/skill.test.ts              (15 tests)
 ✓ tests/reconcile.real-data.test.ts(21 tests)
 Test Files  4 passed (4)
      Tests  74 passed (74)
```

Covers: minor-unit parsing and formatting, FX identity, PayPal per-currency fees,
18/118 GST, instalment remainder allocation, schedule anchoring, due-today
boundary, FIFO allocation, days-overdue, duplicate detection with and without a
reference, weak-vs-strong candidates, every real-data trap, resolution behaviour
(assign, cross-currency refusal, unallocated, approved refund), determinism,
skill validation failures, and all twelve keys × three tunes.

## 2. Number verification

```
$ npm run verify
31/31 checks passed
```

Pinned values, recomputed from `data/source/*.csv` on every run:

| Check | Value |
| --- | --- |
| Agreed fees | ₹610,315.00 |
| Credited | ₹474,236.00 |
| Outstanding | ₹136,079.00 |
| Overdue | ₹111,143.22 |
| Credit on account | ₹8,000.00 |
| Future instalments | ₹24,935.78 |
| Unallocated cash | ₹0.00 |
| October gross | ₹31,532.00 |
| October PayPal fees | ₹689.64 |
| October net | ₹30,842.36 |
| October GST | ₹2,593.22 |
| GST-applicable gross | ₹17,000.00 |

Trap cases: `P5036` duplicate, Diya ₹10,000 credited / ₹5,000 overdue, Aarav
₹8,000 credit, `P5016` in review, Tara's reminder held, `P5011` future-dated,
`P5037` unapplied, 4 open review items, 7 reminders ready, 1 held.

## 3. Compile and build

```
$ npx tsc --noEmit          exit 0, no output
$ npx next build            exit 0
  9 routes: /, /_not-found, /dhun, /dhun/[tuneId] (3 static),
            /fees, /fees/students/[studentId], /notes
```

## 4. HTTP

Dev server on port 3111, every route answered 200:

| Route | Bytes |
| --- | --- |
| `/` | 22,199 |
| `/dhun` | 25,931 |
| `/dhun/twinkle` | 45,471 |
| `/dhun/happy-birthday` | 39,918 |
| `/fees` | 275,686 |
| `/fees/students/S104` | 45,890 |
| `/notes` | 28,255 |

Rendered `/fees` contains ₹31,532.00, ₹689.64, ₹30,842.36 and ₹2,593.22 — the
figures are on the page, not only in tests.

## 5. Browser — Dhun at phone width (390 × 844)

Driven with real clicks and DOM reads.

| Check | Result |
| --- | --- |
| Page horizontally overflows the viewport | **No** (`scrollWidth` 374 ≤ 390) |
| Notation scrolls inside its own container | Yes |
| Columns rendered (Twinkle) | 42 |
| Bar lines | 12 |
| Key buttons | 12 |
| Default key | G |
| Note names in G major | G, A, B, C, D, E — no Gb |
| Any note name containing a digit | None |
| Swaras rendered | S R G M P D N |

Playback state machine, driven by clicking the actual button:

| Step | Observed |
| --- | --- |
| Click Play | `■ Stop`, `aria-pressed="true"`, 1 highlighted column |
| Click Stop | `▶ Play`, `aria-pressed="false"`, 0 highlighted |
| Click Play again | playing again |
| Change key to A **while playing** | playback stops, key A, row re-spells to A, B, C#, D, E, F# |

Note: an early click landed before React hydration and did nothing. That is a
test-timing artefact, not a product bug; the checks above use a hydrated page.

## 6. Browser — the fees workflow

On `/fees`, using the real form:

| Step | Tara Pillai (S110) | Credited KPI |
| --- | --- | --- |
| Before | ₹10,000 credited · ₹20,000 overdue · 54 days · **held** | ₹474,236.00 |
| Assign `P5016` → S110 | ₹25,000 credited · ₹5,000 overdue · 24 days · not held | ₹489,236.00 |
| Undo | ₹10,000 credited · ₹20,000 overdue · 54 days · **held** | ₹474,236.00 |

This exercises the server action, revalidation, the hold logic, and the audit
trail. The database was then reset and re-imported, so the shipped state is the
untouched source data.

## 7. Skill — from scratch

```
$ npx tsx skills/daily-fees-reminders/run.ts \
    --students data/source/students.csv \
    --payments data/source/payments.csv \
    --as-of 2026-10-31
✓ wrote 4 files … nothing was sent.
```

- 8 reminder drafts: 7 `ready`, 1 `held` (Tara, because `P5016` is unresolved).
- Two consecutive runs produced identical SHA-256 for `reminders.csv`
  (`2f6959c0…`) and `admin-summary.txt` (`4b4977d9…`).
- With `--resolutions data/resolutions.example.json`: credited ₹489,236.00,
  unallocated cash ₹5,000.00, 0 held, 2 need a person — the workflow moves the
  numbers, and the totals reconcile.
- Bad input is refused: a non-ISO `--as-of` and a non-numeric amount both exit 1
  and write nothing.

## 7b. Live deployment (Vercel)

Deployed on 11 November 2026 with the Vercel CLI, authenticated as
`changednishant-6622`.

**Production:** <https://nathaniel-workpack.vercel.app>

| Check | Result |
| --- | --- |
| `/`, `/dhun`, `/dhun/twinkle`, `/dhun/happy-birthday`, `/fees`, `/notes` | all **200** |
| Happy Birthday server-rendered columns | 29 |
| F♯ note cells in G major (live) | 2 |
| Gb note cells (live) | 0 |
| Note names containing digits (live) | 0 |
| Student names or totals in the public HTML | none |
| `/fees` behaviour with no database | honest "database not connected" notice, **not** a 500 |
| Hydration on the production bundle | Play → Stop → Play works; key change stops playback and re-spells to A major |
| Browser console on the live tune page | empty |

**Backend.** A free-plan Neon Postgres database was provisioned through the
Vercel Neon integration and connected to the project's production environment, so
`DATABASE_URL` is injected at runtime and never stored in the repository.
`npm run db:import:pg` imported **25 students and 40 payments** (batch 1, sha256
`b18dc3a2…`). Running the same command a second time reported the files as
already imported and wrote nothing, which is the idempotency guard doing its job.

Earlier in the session this adapter could not be tested at all — Docker's engine
was not running and no hosted database existed — so it was recorded as
unverified. That gap is now closed: the queries below ran against the deployed app
reading the real database.

### Live fees data (after the Neon import)

`/fees` returned **200** and **113,846 bytes**, with the "database not connected"
notice gone, and these figures read from Postgres:

| Figure | Live value |
| --- | --- |
| Agreed | ₹610,315.00 |
| Credited | ₹474,236.00 |
| Outstanding | ₹136,079.00 |
| Overdue | ₹111,143.22 |
| Credit on account | ₹8,000.00 |
| October gross | ₹31,532.00 |
| PayPal fee | ₹689.64 |
| Net | ₹30,842.36 |
| GST | ₹2,593.22 |

All match the local run exactly, which is the point of keeping one finance engine
behind both storage backends. `/fees/students/S101` returned 200 with that
student's own figures, and neither page contained a connection string, a
`neondb` hostname, or an `npg_` key.

### Live write path: assign, then undo

The last untested thing was a **write** through the deployed server action. On 12
November 2026 the P5016 review item ("Tara P.", INR 15,000, UPI, ref
PAY190122, only a first-name hint) was assigned to S110 Tara Pillai on the live
site, then undone.

| | Before | After assign | After undo |
| --- | --- | --- | --- |
| Credited to fees | ₹474,236.00 | ₹489,236.00 | ₹474,236.00 |
| Still to collect | ₹136,079.00 | ₹121,079.00 | ₹136,079.00 |
| Overdue today | ₹111,143.22 | ₹96,143.22 | ₹111,143.22 |
| Held badges | 4 | 3 | 4 |
| Open review items | 4 | 3 | 4 |
| Tara credited / balance | ₹10,000 / ₹20,000 | ₹25,000 / ₹5,000 | ₹10,000 / ₹20,000 |
| Tara status | overdue, held, 54 days | overdue, 24 days | overdue, held, 54 days |
| P5016 card | open, Assign form | resolved by `admin@desk`, Undo | open, Assign form |

The days-overdue figure moves from 54 to 24 on assignment because the oldest
installment is paid off and a later one becomes the overdue one — not a bug.

After the undo, the rendered page was diffed against the pre-action capture: the
visible text is **identical except for two appended audit-trail lines**
(`resolve:assign` and `resolve:cleared`, both by `admin@desk`). That is exactly the
desired shape: balances are derived on every read, so removing the resolution
restores the ledger, while the audit log keeps both decisions on the record.

## 7d. Four-part readiness audit (12 November 2026)

Run end to end on the code that is deployed, after the fixes below.

| Check | Result |
| --- | --- |
| `npm test` | **74 passed**, 4 files |
| `npx tsc --noEmit` | clean |
| `npm run verify` | **31/31**, fingerprint `d6763b8fde8e0d42` |
| `npm run build` (clean `.next`) | green, all routes |
| Skill, run twice into separate directories | `reminders.csv` `2f6959c0…`, `admin-summary.txt` `4b4977d9…`, `review-report.json` `8c1ee14d…` — identical. `run-manifest.json` differs only in its `generatedAt` timestamp |
| Skill exit codes | missing argument → **2**; invalid payments file → **1** with **zero** files written |
| Live routes | `/`, `/dhun`, all three tunes, `/fees`, `/fees/students/S104`, `/notes` → **200** |
| Live 404s | unknown tune and unknown path → **404**, served by the app's own page |
| Part 4 artefacts | `shruti-flow.drawio` and `shruti-flow.svg` both well-formed XML; architecture doc carries all ten sections plus sources |

Fixes made in this pass. Each was a real defect, not polish:

1. **`npm run build:static` failed.** Next rejects server actions inside a static
   export, and the fees desk imports them, so the command errored out. The export
   path, its script and the superseded Sites deploy files are gone; there is one
   build mode now, and it is the one that is live.
2. **`.gitignore` would have dropped `.env.example`.** Stray CRLF lines at the end
   included `.env*`, which re-ignored the template after the `!` exception, so a
   public repo would have shipped with no env guidance. Rewritten and checked:
   `.env.example` is tracked, `.env` and `.vercel/` are not.
3. **The deployed 404 was Next's default page.** Added `src/app/not-found.tsx`,
   verified live.
4. **Docs still said the work was not deployed.** `requirements.md` and
   `submission.md` corrected, including the old "replace store.ts by hand"
   instructions, which no longer describe what was built.

The repo was pushed the same evening: **https://github.com/nishant233032024/nathaniel-workpack**
— public, 67 files, `main`, with `.env`, the SQLite file, `.vercel/` and
`node_modules/` all excluded and `.env.example` included.

Still not done: the **four videos** and the **submission form**.

## 8. What was not verified

- **Sound.** The synthesiser schedules notes and the transport behaves correctly,
  but nobody has listened to it. There is no automated audio assertion.
- **Safari, Firefox, iOS.** Only Chromium was exercised.
- **Deployment.** Not deployed, so the production host is untested.
- **Performance.** No Lighthouse run; `/fees` at 275 KB of HTML is untested on a
  slow device.
- **Postgres.** The live-deployment path changes only the storage adapter; it has
  not been run, so it is unverified.

## 9. Environment incident

Running `next build` while `next dev` was live corrupted the dev server's `.next`
directory (`Cannot find module './868.js'`), and the browser then hydrated
against a dead page. Fixed by stopping the dev server, deleting `.next`, and
restarting. Sequence for a reviewer: **build and dev are separate — do not leave
`next dev` running during `next build`.**
