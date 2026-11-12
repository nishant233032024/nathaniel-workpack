# Part 4 voice note — Shruti (≈6:00, ~860 words)

Read at about 145 words a minute. Bracketed marks are breaths.

---

(0:00) I'm Nishant. Part 4 is Shruti: a menu-bar mixer for macOS, with per-app volume,
EQ and routing. To be clear up front — this is the architecture, not a shipped app. The
brief asks for the plan, so this is the plan I'd defend in a design review.

I'll describe the diagram in words, since this is a voice note. [breath]

Source apps render audio. A Core Audio process tap captures it. The tap is attached as
an input on a HAL aggregate device. My per-app engine applies gain and EQ, the mix goes
to the aggregate, and the aggregate feeds the hardware output. The interface is a
separate process and never touches the real-time audio thread.

Frameworks: Swift and SwiftUI for the menu bar and settings, Core Audio for the engine,
and a small XPC service so a UI crash can't take the audio with it. Settings cover
per-app gain and EQ, a default output, a global bypass, and a "restore audio" item that
stays present even when the rest of the app is unhappy. One permission — audio capture —
described in the info plist. [breath]

The one fact that decides this architecture: macOS fourteen point two added process taps.
The call is AudioHardwareCreateProcessTap, it takes a CATapDescription, and it returns an
audio object identifier. The tap is used as an input stream on an aggregate device, and
the description's mute behaviour can mute the source app's output so all of its audio goes
to the tap.

Two consequences. First: no virtual audio driver — no admin install, no BlackHole-style
plug-in, just a narrow audio-capture permission, which is a much easier thing to ask a
musician to grant.

Second, and this is the whole product: capturing is not controlling. Capturing alone
changes nothing about what anyone hears. To control an app you capture it, mute it,
process it, and render it yourself. That's the product — and that's the risk, because if
my renderer stops, that app goes silent.

The cost is the minimum version, fourteen point two. Older Macs get a clear "this Mac is
too old" message, not a silently broken mixer. [breath]

Which is the failure you have to design for. Mute plus a crash equals no audio at all —
not degraded, gone.

So: never mute until the replacement path is already running. A watchdog that restores
the source at the first sign of trouble. And a menu-bar "restore audio" that works when
everything else is broken. Unplug a device mid-song and a change listener rebuilds the
aggregate and reopens the output; if that fails, fall back to system output and say so in
the menu bar rather than going quiet. [breath]

Shipping it. Developer ID signing, hardened runtime, minimal entitlements. Notarise with
notarytool then staple so the app opens offline — in continuous integration, on every
release, not by hand. Sparkle two for updates, with a signed appcast and a staged rollout
so a bad build doesn't reach everyone at once.

Licences sold through a merchant of record, so VAT is their problem and not a compliance
project for a one-person studio. The app verifies a signed licence offline with an
embedded public key; the audio engine never waits on a network call.

Direct distribution, not the Mac App Store, at least at first. The sandbox is a poor fit
for an audio product and the review cycle is slow.

Who buys, in order of willingness to pay: students and teachers practising with
recordings, who need "the track quieter, my instrument louder" every day. Then producers
and streamers juggling several apps. Then podcasters who need one app ducked while
another stays clear.

Price hypothesis: twenty-nine dollars one-time for individuals, fifty-nine for a studio
licence with two machines and commercial use, fourteen-day trial. A hypothesis to test,
not a conclusion. [breath]

Launching through a hundred and twenty-seven thousand subscribers without it feeling like
an advert: don't announce a product. Publish a lesson that couldn't exist without it —
how to practise a fast passage by slowing the recording and lifting your own instrument.
The app is on screen the way a metronome would be. The video stands alone if nobody buys
anything. One pinned link. That's the whole campaign.

The idea that could spread by itself: shareable practice mixes. A teacher sends a preset,
a student's Mac adopts it in one click, encoded in the URL so it needs no server. Every
share is a demo.

The number I'd watch is activation — installs that build a custom per-app mix in the
first session and still have it applied on day seven. Not downloads, not views. [breath]

Three quick answers. A student pays twice: record the cash, hold the excess as credit on
account, never as income, and refund only as a separate approved event. A slow page on a
cheap phone: measure first, then bytes and main-thread work — on a cheap Android the CPU
is the constraint, so a smaller bundle beats a faster server. When not to let AI write
code: money movement, auth, destructive migrations, licence enforcement, and the
real-time audio thread.

One thing the AI got wrong: it once assumed a three-hundred-and-fifty euro plan split as
one seventeen, one seventeen, one sixteen, because a student had paid one seventeen — it
copied the payment instead of computing the split. A test with the wrong expected value
exposed it.

That's exactly the error that would put a plausible wrong number into an architecture
document, which is why every API claim here is marked verified, with a link to Apple's
documentation beside it.

The diagram and the write-up are in the public repository, under docs, slash mac-app.
