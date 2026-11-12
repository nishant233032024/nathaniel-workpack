# AI use: what the agent did, and what it got wrong

This is the log Nishant can speak to on video. Everything here is verifiable by
running the commands named.

## Tool

An AI coding agent (Freebuff / Buffy) driving this repository directly: reading
the brief, downloading the CSVs, writing code, running tests and builds. The
human set the rules: exact money, no fabrication, no copying, verify everything.

## What the agent did well

- **Volume with structure.** It produced a coherent project quickly: a typed
  finance domain, a CSV importer, a reconciliation engine, a SQLite layer, two
  UIs, a CLI, and tests — all sharing one engine.
- **It read the data before designing.** The anomaly list came from actually
  reading all 40 rows, not from imagination.
- **It kept the invariants explicit.** Integer minor units, derived balances,
  idempotent import, audit log — the rules were stated and then enforced.
- **It refused to guess.** When asked to handle "Tara P.", it produced a weak
  hint and a held reminder rather than a confident wrong match.

## What it got wrong, and how it was caught

These are the honest "one thing it got wrong" stories. Each was found by running
something, not by reading.

### 1. A refund that didn't refund

The first implementation recorded an approved refund as negative cash but forgot
to reverse the student's credit. Nina Khan's balance stayed at zero after a
₹15,000 refund was approved. **Caught by** the integration test asserting
`creditedMinor === 1_500_000`. Fixed by making an approved refund a single event
that moves cash and credit together.

### 2. The agent's arithmetic was worse than the engine's

The agent wrote a test expecting €350 to split as 117 / 117 / 116 — treating the
student's rounded €117 payment as if it were the schedule. The engine said
116.67 each and was right. **Caught by** a failing test whose expected value was
the wrong one. The fix was to correct the test, and to keep the 33 cents as
credit — which is what actually happens to the student's money.

### 3. The skill that could not find its own input

`run.ts` passed `payments` where the engine expected `paymentsPath`. The skill
exited 1 with "payments file not found at undefined". **Caught by** running the
CLI from scratch, exactly the demo the video asks for. This is the best example
for the recording: the tests passed, the build passed, and the program still
could not run.

### 4. Types that didn't allow silence

Rests were modelled without a degree, but the type required one, so
`next build` failed on three rest notes. Caught by `tsc --noEmit`. Fixed by
making the degree optional on a rest and defaulting at the render boundary.

### 5. A melody whose bars didn't add up

Happy Birthday's last phrase was one beat short, so the final bar did not close.
**Caught by** a bar-count assertion. The fix was to correct the melody data, not
to loosen the test.

### 6. A test that proved nothing

An early "allocates oldest-first" test allocated exactly one instalment and
asserted the result was *partial* — it was fully paid. The test was wrong, and
would have passed a broken allocator. **Caught by** the assertion failing on a
correct implementation.

## What the human must check before submitting

The agent cannot do these, and claiming otherwise would be dishonest:

1. Read `docs/decisions/0001-finance-rules.md` and be able to defend each choice.
2. Run `npm run verify` and watch the numbers.
3. Record the four videos in your own voice, including the mistakes above.
4. Confirm both links open: the live site (Vercel, with a Neon Postgres database)
   and the public repo. Both are done; a dead link on the day is still your call.
5. Delete nothing from `docs/`; the reviewer reads it.

## Standing rules the agent worked under

- Never invent a payment, a total, a test result or a URL.
- Never copy another candidate's code or prose.
- Never describe something as run when it was not run.
- Prefer refusing to match over guessing.
- If a check cannot run, say so.
