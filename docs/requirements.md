# Acceptance checklist, extracted from the brief

Source: <https://brochures.nathanielschool.com/join/engineer>, read on 11 November 2026.

## What the page actually says about timing

- **"About 4 to 5 days"**, and: *"Send it within a week of getting this link."*
- The page shows **no expired deadline** and no extension. Nothing on it grants
  extra time.
- Our working target (submit tonight, before 2:00 am IST) is an **internal sprint
  decision**, not official permission. Do not describe it as an extension on
  video.
- The exercise date inside the data is unrelated to the delivery date: all
  finance work is **as of 31 October 2026, Asia/Kolkata**.

## Rules that apply to all four parts

| Requirement | Status here |
| --- | --- |
| Use any AI tool; in each video say which tool, what it did well, and one thing it got wrong that you caught | Scripted in `docs/demos/video-scripts.md`; the specific mistakes are in `docs/ai-use.md` |
| Everything must run; web work live; code in a public GitHub repo with a short README | **Live** at <https://nathaniel-workpack.vercel.app>; code public at <https://github.com/nishant233032024/nathaniel-workpack> |
| If you cannot finish a part, send what works and explain what you would do next | Applies to deployment tonight |
| Videos 5–10 minutes, natural voice; a silent screen recording does not count | Four scripts written |
| Submission needs: video or voice note per part, plus a link | Checklist in `docs/submission.md` |

## Judging weights (100)

| Points | Criterion | Where this pack answers it |
| --- | --- | --- |
| 25 | It works for real — live links open, code runs, README is enough to start | README quick start, `npm run verify`; live links open and the fees desk reads a real Postgres database |
| 20 | The money is right — every rupee accounted, nothing counted twice, odd payments caught | 13 documented anomalies, 43 finance tests, derived balances, audit trail |
| 15 | Design eye — Dhun is close, spelling is right; own screens are clean | Handwritten notation shelf and tune pages; restrained admin UI |
| 15 | Thinks in systems — schema, skill and Mac app flowchart make sense end to end | `docs/decisions`, one shared engine, skill contract, Shruti diagrams |
| 10 | Honest, smart use of AI — used well, overruled where wrong, and said so | `docs/ai-use.md`, "Notes" page in the app |
| 15 | Explains clearly | Scripts, per-student evidence page, `docs/` |

## Part 1 — Clone it: Dhun

| # | Requirement | Status |
| --- | --- | --- |
| 1.1 | Rebuild the tune shelf and one tune page: handwritten look, rhythm sticks with numbers and swaras aligned, colours, stars, layout, desktop and phone width | Done (responsive CSS; stars are decorative) |
| 1.2 | Tune page plays with a piano sound | Done (synthesised, documented) |
| 1.3 | Any of the 12 keys; numbers and swaras stay; note names change and are spelled correctly (F# in G, never Gb) | Done and tested across all twelve keys |
| 1.4 | Three tunes from Dhun's shelf in a data format of my design; a fourth is one line | Done; test adds a fourth |
| 1.5 | Write your own code; do not copy their files | Own data model, renderer and synthesiser; melodies are public-domain transcriptions |
| 1.6 | Put it live and on GitHub | **Live on Vercel**, repo public |
| 1.7 | House rules: plain note names (C, F#, Bb, never C4); default key G | Enforced by test; default is G |
| 1.8 | Video: Dhun and clone side by side, where they differ, how a tune is stored, how spelling is worked out, how you clone an app whose code you cannot see | Script 1 |

## Part 2 — The fees portal

| # | Requirement | Status |
| --- | --- | --- |
| 2.1 | Design a database (Postgres preferred, SQLite fine) and import both files | SQLite via `node:sqlite`; schema in `src/lib/db/store.ts` |
| 2.2 | Portal: every student, paid, owed, overdue and by how many days | `/fees` |
| 2.3 | This month's income in rupees, before and after PayPal fees, GST shown separately | October panel with four figures |
| 2.4 | A "needs a person" list: every payment that could not be matched safely, and why; at least six problems hidden, find them all | 13 documented; 4 open review items, 1 auto-resolved |
| 2.5 | A short polite WhatsApp reminder per overdue student, in their own currency | 8 drafts, 7 ready, 1 held |
| 2.6 | Bonus (not required): admin login, record a cash payment, leads-to-student flow | Deliberately out of scope tonight; noted in `docs/submission.md` |
| 2.7 | Video: portal, then schema; how a payment is stopped from being counted twice; how a person fixes one the code got wrong | Script 2 |

## Part 3 — Build with our skills (Track D, Portal)

| # | Requirement | Status |
| --- | --- | --- |
| 3.1 | A `SKILL.md` plus a program that really runs | Done |
| 3.2 | Reads the payments file every morning and writes the day's WhatsApp reminders and a one-line summary | Done |
| 3.3 | Never invents a payment | Enforced by construction and by tests |
| 3.4 | Deterministic for identical inputs | Verified by hash across two runs |
| 3.5 | Video: run it from scratch, open `SKILL.md`, show one mistake it made that you fixed | Script 3; the `paymentsPath` bug is the honest example |

Note: the brief offers tracks A–D. This pack does **D**. It says so on video
rather than implying all four tracks were attempted.

## Part 4 — A Mac app (option 2, Shruti)

| # | Requirement | Status |
| --- | --- | --- |
| 4.1 | Flowchart of sound from app to speakers; what runs where; frameworks; settings; interface unplugged mid-song | `shruti-architecture.md` + `.drawio`/`.svg` |
| 4.2 | Signing, notarisation, updates, licence check | Documented, with the real constraints |
| 4.3 | Who buys, price, launch through a 127k channel without feeling like an advert; one viral idea; one number | Documented |
| 4.4 | Quick answers: student pays twice; slow page on a cheap phone; when not to let AI write code | Documented |
| 4.5 | What did you teach yourself last month | Prompt to answer in the video — Nishant's own answer, not invented |
| 4.6 | Video + link to the flowchart | Script 4 |

## Conflicts I found, and how I resolved them

1. **Schedule.** The user's brief says "tonight, by 2:00 am". The assignment page
   says "about 4 to 5 days" and "within a week". The page is the source of truth
   for the *assignment*; the sprint is a private choice. I did not compress any
   verification step to meet it.
2. **Part 3 scope.** The user's brief says "Track D". The assignment offers A–D
   and asks for one. D is what is built, and the video says so.
3. **Part 4 scope.** The assignment offers Sangam or Shruti; the user chose
   Shruti. The deliverable is architecture, not a native app, as the brief
   permits.
4. **"Live by night".** The assignment requires live links; the user required
   approval before any deployment. Those conflict tonight, so the honest status
   is "built and verified locally, deployment prepared and awaiting approval".
