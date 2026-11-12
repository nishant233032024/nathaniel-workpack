# Submission pack

Read this before recording. It separates what is done, what is blocked on you,
and what must not be claimed.

## Timing

| | |
| --- | --- |
| Sprint start | Wed 11 Nov 2026, ~6:00 pm IST |
| Target | tonight, before midnight |
| Hard stop | Thu 12 Nov 2026, 2:00 am IST |
| Assignment page | says "about 4 to 5 days", "within a week of getting this link". It shows **no expired deadline and no extension**. |
| Fixed finance date | **31 October 2026, Asia/Kolkata** — unrelated to the delivery date |

The 2:00 am target is ours. Do not describe it as school-approved.

## Status

| Deliverable | State |
| --- | --- |
| Working Next.js app (Dhun + fees) | Done, builds, runs |
| Finance engine + 74 tests | Done, passing |
| SQLite schema, import, audit | Done |
| Skill (Track D) with CLI + outputs | Done, deterministic |
| Docs: requirements, decisions, reference, AI use, demos | Done |
| Shruti architecture + draw.io + SVG | Done |
| **GitHub repo pushed** | **Done:** https://github.com/nishant233032024/nathaniel-workpack (public) |
| **Live deployment** | **Done:** https://nathaniel-workpack.vercel.app — Dhun and the fees desk, both working |
| **Postgres backend configured** | **Done:** Neon free plan via the Vercel integration; 25 students + 40 payments imported |
| **Four videos** | **Not done — only you can record them** |
| **Submission form** | **Not done — needs your approval** |

## What only you can do

1. **Read `docs/decisions/0001-finance-rules.md`.** You will be asked why the
   first instalment is due on the start date, and why duplicate detection needs a
   reference. You should answer in your own words.
2. **Run the checks and watch them pass.**
   ```bash
   cd nathaniel-workpack
   npm install
   npm test          # 74 tests
   npm run verify    # recomputes the real numbers
   npm run typecheck
   npm run build
   ```
3. **Record four videos** using `docs/demos/video-scripts.md`. Different AI
   mistake in each, all of them real.
4. **Check both links** open: the live site and the public repo (below).
5. **Submit** and WhatsApp the school.

## Deploy checklist

**Status: done.** Frontend, server routes and the Postgres backend are live at
<https://nathaniel-workpack.vercel.app>. Data sits in a free-plan Neon Postgres
database connected through the Vercel Neon integration; `DATABASE_URL` is set in
the production environment and the two CSVs were imported once with
`npm run db:import:pg`.

The app runs on Node, and `node:sqlite` is perfect for a local admin tool but
cannot persist anything on Vercel's ephemeral filesystem. That is why there are
two storage implementations behind one interface (`src/lib/db/types.ts`): SQLite
locally, Postgres when `DATABASE_URL` is set.

What was actually done, and verified:

1. Deployed to Vercel (project `nathaniel-workpack`).
2. Provisioned a free-plan **Neon Postgres** database through the Vercel Neon
   integration and connected it to the production environment, so `DATABASE_URL`
   is injected at runtime and never committed to the repo.
3. Ran `npm run db:import:pg` once: 25 students, 40 payments, batch 1. A second
   run correctly wrote nothing.
4. Opened `/dhun` and `/fees` on the live URL, then exercised a real review
   decision (assign, then undo) and confirmed the derived ledger returned exactly
   to its starting figures.

**Do not** publish the portal with real student records and no authentication.
The data here is fictional, but the pattern is the one that would leak.

## What to say about what is not finished

Say it plainly, in this order:

1. What works and what you showed.
2. What is not finished yet (the videos, the form), and why.
3. Exactly what you would do next — the four steps in the deploy checklist.

The brief explicitly says a clear plan beats a broken demo.

## Submission form fields

From the brief's send page:

- Full name
- WhatsApp number with country code
- Email (optional)
- Website (optional)
- Part 1: screen-share video (5–10 min) + live link, GitHub link in the README
- Part 2: screen-share video + live link or GitHub (public)
- Part 3: screen-share video + GitHub link with `SKILL.md` and the program
- Part 4: video + link to the flowchart (draw.io / Figma / Drive "anyone with the
  link can view")
- Videos: YouTube **Unlisted** or Google Drive **anyone with the link**
- Paste each link before choosing the video; the page remembers submissions in
  the same browser
- After sending: WhatsApp **+91 98454 65411** to say it is done

## Final honesty pass

Before you press send, check that nothing in the submission claims:

- a live URL that is not live;
- a test that did not run;
- a screenshot you did not take;
- a total you did not compute;
- a deadline extension;
- someone else's project as your own.

Everything in this repo was generated here, except the two supplied CSVs and the
traditional melodies, which are public domain.
