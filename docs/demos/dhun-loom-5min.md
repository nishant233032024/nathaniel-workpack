# Dhun — 5-minute Loom take

A single-take script for **Loom, screen + voice, sharing this browser tab**. Timed
to land at **4:40**, so it stays under Loom's 5-minute free limit with room to
breathe.

Speak naturally. The quoted lines are what to say, not a word-for-word
performance.

---

## Before you press record (3 minutes)

1. **Two tabs open, in this order:**
   - Tab 1: the real Dhun tune page (their site), left of your clone.
   - Tab 2: <https://nathaniel-workpack.vercel.app/dhun/twinkle>
   - Tab 3: the repo, already open at `src/lib/music/tunes.ts`.
2. **Hide the bookmarks bar** (Ctrl+Shift+B) and close every other tab.
3. Notifications off, Do Not Disturb on, Slack/WhatsApp closed.
4. Browser zoom **110%** — fonts read well on a 1080p recording.
5. **Loom settings:** New video → *Screen and camera* → **Current tab** (cleaner
   than a full desktop capture, no stray windows) → 1080p → mic tested with a
   10-second clip you watch back.
6. **Do a 15-second test recording and watch it.** Check the audio level bar
   moves and the notation is legible. Deleting a bad take costs nothing; a
   recorded 5 minutes that is unreadable costs the whole submission.
7. Have the live URL typed in a scratch note so you can paste it on camera
   without fumbling.

---

## 0:00 — 0:25 · Say who and what

> "I'm Nishant. This is Part 1 of the Nathaniel founding-engineer exercise: a
> rebuild of Dhun — the tune shelf, a tune page, a piano, and all twelve keys with
> the note names spelled correctly. It's deployed, and everything I show you is
> the live site."

## 0:25 — 1:10 · Side by side with the real thing

Switch to the real Dhun tab, then back to your clone. Point at the same parts on
both: rhythm sticks, the number under each note, the swara, the bar lines, the
section colour, the star rating.

> "I matched the structure, not the pixels. What's the same: rhythm sticks with a
> number and a swara in every cell, bar lines, the handwritten feel, and a layout
> that survives a narrow window. What's different, on purpose: my own renderer and
> data model, a synthesised piano instead of samples, and three tunes instead of
> their whole catalogue. I'm not going to claim it's identical."

Drag the window narrower for two seconds so the layout reflows. That is a stated
requirement, so show it rather than assert it.

## 1:10 — 2:00 · One tune, playing

Tab 2. Press **Play**. Let it run for four or five notes, cursor on the
highlighted column.

> "It plays with a piano sound, and the column moves with the audio. Three things
> sit in every cell: the rhythm, the number, and the swara. The note name is
> derived — it's not stored."

Press **Stop**, then **Play** again to show a clean restart.

## 2:00 — 2:50 · Twelve keys, and the spelling

Click **D**, then **F**, then **A**. Point at the spelling line above the
notation each time. Then click **G** and point at degree 7.

> "The numbers and swaras never move — a '5' is a '5' in every key. Only the
> spelled note names change. In G major, degree 7 is **F sharp**, not G flat:
> the letter comes from the position in the scale, and the accidental is
> whatever reaches the right pitch. One function does this for all twelve keys."

Point at the note row: "No octave digits anywhere — octaves live in the number,
`5'` or `,5`. That's a house rule here."

## 2:50 — 3:35 · How a tune is stored

Tab 3, `src/lib/music/tunes.ts`.

> "A tune is an array of note objects: a scale degree, an optional alteration, an
> octave, and a duration in beats. Because it stores a degree and not a note
> name, transposing is free. Because it stores durations, bar lines are computed
> by walking the beat count — which is why Happy Birthday's pickup bar needs no
> special case in the renderer."

Scroll to show the four-line object. "A fourth tune is one more object here. No
renderer change, no new route, no playback change."

## 3:35 — 4:15 · The spelling function

Open `src/lib/music/keys.ts`, land on `spellDegree` (line 78).

> "One function, twelve keys. Letter from the degree's position, accidental from
> the difference between the target pitch and that natural letter. That's the
> whole trick — and it's why G major gives F sharp and D major gives F sharp and
> C sharp without a table of special cases."

## 4:15 — 4:40 · Live link, the AI mistake, and the gap

> "It's live at nathaniel-workpack.vercel.app, and the code is public on GitHub
> under nishant233032024.
>
> One thing the AI got wrong: its first version of Happy Birthday was one beat
> short, so the last bar never closed. A bar-count test caught it. I fixed the
> melody data, not the test — the test was right.
>
> And the honest gap: the piano is synthesised, not sampled, and there are three
> tunes, not fifty. A fourth costs me one object."

Stop recording.

---

## After

1. Loom puts the link on your clipboard; if not, copy it from the video page.
2. Set sharing to **Anyone with the link can view**.
3. Paste it into the Part 1 video field, with
   `https://nathaniel-workpack.vercel.app/dhun` beside it as the live link.
4. Watch the first 30 seconds of the published version before you submit — you
   are checking audio and legibility, not your performance.

## If a take goes wrong

- **Stumble over words:** stop, breathe, restart the sentence. Loom is one take;
  a clean restart mid-sentence is normal and faster than re-recording.
- **Notation unreadable:** you were probably at 100% zoom, not 110%.
- **Ran past 4:50:** cut the side-by-side section to 30 seconds, not the key
  demonstration. The twelve keys and the F♯ explanation are the marks.
