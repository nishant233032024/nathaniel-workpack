# Shruti — 5-minute Loom take (Part 4)

Architecture, not a native app. Single take, **targets 4:40**. The brief also asks
"what did you teach yourself last month" — that is your answer to give in your own
words, not a script. Budget 20 seconds for it and drop the diagram walk if you are
running long.

---

## Before you press record (3 minutes)

1. Open `docs/mac-app/shruti-flow.svg` **in a browser tab** — it renders as an
   image. Have the editable `.drawio` open in a second tab only if you want to
   show it exists.
2. Open `docs/mac-app/shruti-architecture.md` beside it, scrolled to section 1.
3. **Loom:** New video → *Screen and camera* → **Current tab** → 1080p → mic test.
4. Zoom the diagram so the whole flow fits **without scrolling**. You will trace
   it with the cursor, and a scroll mid-sentence kills the explanation.
5. Say the API claims out loud only if you can defend them. Every one is marked
   `[verified]` in the doc with an Apple documentation link — that is the reason
   the doc reads the way it does.

---

## 0:00 — 0:20 · What it is

> "Part 4, Shruti: a menu-bar mixer for macOS — per-app volume, EQ and routing.
> This is the architecture, not a shipped app. The brief asks for the plan, so
> here's the plan I'd defend in a design review."

## 0:20 — 0:55 · The diagram

Trace with the cursor, left to right:

> "Source app renders audio. A Core Audio **process tap** captures it. The tap is an
> input on a HAL **aggregate device**. My per-app engine sets gain and EQ, the mix
> goes to the hardware output. The UI is a separate process and never touches the
> audio thread."

## 0:55 — 1:35 · The one fact that decides everything

> "macOS 14.2 added process taps. `AudioHardwareCreateProcessTap` takes a
> `CATapDescription` and hands back an audio object. Two consequences.
>
> One: **no virtual audio driver** — no admin install, no BlackHole-style plug-in,
> just a narrow audio-capture permission.
>
> Two: capturing is not the same as controlling. To change what the user hears I
> have to capture the app, **mute** it, process it, and render it myself. That is
> the product — and it's also the whole risk."

Say the cost: "**Minimum macOS 14.2.** Older Macs get a clear 'this Mac is too old'
message, not a silently broken mixer."

## 1:35 — 2:10 · The failure you must design for

> "If I mute the source and my engine dies, the user loses audio completely. So:
> never mute until the replacement path is already running, a watchdog that
> restores the source at the first sign of trouble, and a menu-bar 'restore audio'
> that works even when everything else is broken."

> "Unplug mid-song? A device-change listener rebuilds the aggregate and reopens the
> output on the new device. If that fails, fall back to system output and **say so**
> in the menu bar rather than going silent."

## 2:10 — 2:55 · Shipping it

> "Developer ID signing, hardened runtime, minimal entitlements. Notarise with
> `notarytool submit --wait` then `stapler staple`, in CI on every release, so the
> app opens offline. Updates through Sparkle 2 with a signed appcast and a staged
> rollout. Licences sold through a merchant of record so VAT is their problem, and
> verified offline with an embedded public key — the audio engine never waits on a
> network call. Direct distribution, not the Mac App Store, at least at first: the
> sandbox is a poor fit for an audio product."

## 2:55 — 3:45 · Who buys, and how it launches

> "Three buyers in order of willingness to pay: students and teachers practising
> with recordings, producers juggling several apps, then podcasters who need one
> app ducked while another stays clear.
>
> Price hypothesis: **$29** one-time for individuals, **$59** for a studio licence,
> 14-day trial. A hypothesis to test, not a conclusion.
>
> Launch through the 127,000-subscriber channel: **don't announce a product**.
> Publish a lesson that couldn't exist without it — how to practise a fast passage
> by slowing the recording and lifting your own instrument. The app is on screen
> the way a metronome would be. The video stands alone if nobody buys. One pinned
> link. That's the whole campaign.
>
> The viral idea is **shareable practice mixes** — a teacher sends a preset, a
> student's Mac adopts it in one click, encoded in the URL so it needs no server.
>
> And the number I'd watch is **activation**: installs that build a custom mix in
> the first session and still have it applied on day seven. Not downloads."

## 3:45 — 4:20 · The three quick answers

Fast, one breath each:

> "Student pays twice: record the cash, hold the excess as credit on account, never
> silently keep it as income, and refund only as a separate approved event.
>
> Slow page on a cheap phone: measure first, then bytes, render-blocking work,
> main-thread JS — on a cheap Android the CPU is the constraint, so a smaller
> bundle beats a faster server.
>
> When not to let AI write the code: money movement, auth, destructive migrations,
> licence enforcement, and the real-time audio thread. I'll let it draft those, but
> not be the last reader."

## 4:20 — 4:40 · The AI mistake, and close

> "One thing the AI got wrong: it once assumed a €350 instalment plan split as 117,
> 117, 116 because a student had paid €117 — it copied the payment instead of
> computing the split. A test with the wrong expected value exposed it. That's
> exactly the error that would put a plausible wrong number in an architecture
> document, which is why every API claim here is marked verified with a source."

If you have your own "what I taught myself" answer, take it here and cut the
diagram walk to fifteen seconds.

---

## After

1. Sharing set to **Anyone with the link can view**.
2. Part 4 wants a **link to the flowchart**:
   `https://raw.githubusercontent.com/nishant233032024/nathaniel-workpack/main/docs/mac-app/shruti-flow.svg`
   — the raw URL renders as a picture; the GitHub blob page shows source.
3. Play the published video once and check the diagram is readable.

## If a take goes wrong

- **You can't remember an API name:** say "process tap" and keep going. The doc has
  the symbols; the video is the reasoning.
- **Diagram too small:** zoom the browser tab, not the recording. A cropped
  diagram at 100% beats a full one at 60%.
- **Ran past 4:50:** drop the three quick answers to the first two. They are a
  bonus criterion; the failure design and the launch plan are the substance.
