# Part 1 voice note — Dhun (≈6:00, ~820 words)

Read at about 140 words a minute. Bracketed marks are breaths, not words.

---

(0:00) Hi, I'm Nishant. This is Part 1 of the Nathaniel School of Music founding
engineer exercise: a rebuild of Dhun — the tune shelf, a tune page, a piano, and
all twelve keys with the note names spelled correctly.

There's no screen in a voice note, so I'll describe what's there and why it's built
that way. [breath]

Dhun's shelf is a row of cards. Each card has a handwritten title, a star rating,
the key, the time signature, and a strip of notation showing the opening phrase. My
shelf copies that shape: three cards, each with the title, the stars, the key, the
time signature, and a short preview of notes. Three tunes — Twinkle Twinkle Little
Star in four-four, Ode to Joy in four-four, and Happy Birthday in three-four, which
has a pickup bar: it starts on the last beat before the first full bar.

Open a tune and the page shows the title, a one-line instruction, a Play button, a
toggle for note names, and the notation itself.

The notation is where the real work is. Every note sits in a column. Above the note
is the rhythm — a stick, or a pair of sticks with a beam, the way a teacher draws it
on a whiteboard. Under the rhythm there are three rows: the number, the swara, and
the note name. So one cell reads: a stick, then the number five, then Pa, then the
letter G. [breath]

And here's the important part. The number and the swara are the same in every key.
A five is a five. A Pa is a Pa. Only the note name changes. That's the whole idea of
the app, and it's the thing I tested hardest.

The key row has twelve buttons — C, D flat, D, E flat, E, F, F sharp, G, A flat, A,
B flat, B. G is selected by default, because that's the house rule: teach in G. Click
D, and every note name changes while the numbers and swaras stay exactly where they
were.

Now the spelling, which is the part people get wrong. In G major the seventh degree
is F sharp, not G flat. Both are the same piano key. But the letter has to come from
the position in the scale: the seventh step of G is an F of some kind, so it's F
sharp. G flat would be a G, and that writes the wrong letter for the seventh degree.

I don't store note names at all. The name is computed: the letter comes from the
degree's position in the key, and the accidental comes from the difference between
the target pitch and that natural letter. One function does this for all twelve keys,
so I can't get an inconsistent answer in one key and a correct one in another.

There's a second house rule: no octave numbers in note names. You'll never see C four
or G five. Octaves live in the number itself — a small mark after it for an octave
up, before it for an octave down. The name stays plain; the octave stays where the
student reads it. [breath]

Playback is a piano sound, and it's synthesised. I built small additive tones with a
decay — a fundamental plus a few harmonics — rather than sampling a real piano. That
means nothing to license and nothing to copy, and I describe it honestly as a
synthesised piano, not a recording.

While it plays, the current column lights up so you can follow the sound. Stop stops
it immediately. Change key mid-playback and it stops and re-spells the page rather
than carrying on with the old names. Start again and it builds a fresh audio context.

Below the notation there's a section that shows how the tune is stored, and it shows
the real data. One note is an object with a scale degree, an optional alteration, an
octave, and a duration in beats. Twinkle begins: degree five, one beat. Degree five
again. Degree six, one beat.

That representation is why transposition is free — I never stored a note name to
begin with.

Bar lines aren't stored either. They're worked out by walking the beat count, so the
pickup bar in Happy Birthday needs no special case in the renderer. That looks like a
detail until you add a fourth tune. [breath]

Which is the last design point. A fourth tune is one more object in one file. No new
route, no renderer change, no playback change. There's a test that adds a tune and
renders it in a key it was never written in, to prove exactly that.

One thing the AI got wrong, and it's real. Its first version of Happy Birthday was
one beat short, so the final bar didn't close. A test that counts the beats in each
bar caught it. I fixed the melody data, not the test — the test was right and the
data was wrong, and that ordering matters, because the temptation is always to loosen
the check.

The honest gaps: the piano is synthesised rather than sampled, there are three tunes
rather than a catalogue, and there's no quiz or microphone feature.

What exists is live at nathaniel-workpack dot vercel dot app, under slash dhun, and
the code is public on GitHub at nishant two three three zero three two zero two four,
slash nathaniel-workpack.
