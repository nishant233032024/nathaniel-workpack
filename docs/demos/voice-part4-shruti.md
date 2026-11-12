# Part 4 voice note — Shruti (≈6:00, ~860 words)

Read at about 145 words a minute. Bracketed marks are breaths.

---

(0:00) I'm Nishant. Part 4 is Shruti: a menu-bar mixer for macOS, with per-app volume,
EQ and routing. I want to be clear up front — this is the architecture, not a shipped
app. The brief asks for the plan, so this is the plan I'd defend in a design review.

I'll describe the flow diagram in words, since this is a voice note. [breath]

Source apps render audio — Safari, Spotify, Logic. A Core Audio process tap captures
that audio. The tap is attached as an input on a HAL aggregate device. My per-app engine
applies gain and EQ, the mix goes to the aggregate, and the aggregate feeds the hardware
output. The interface is a separate process; it never touches the real-time audio thread.

The one fact that decides this architecture: macOS fourteen point two added process taps.
The call is AudioHardwareCreateProcessTap, it takes a CATapDescription, and it hands back
an audio object identifier. The tap is used as an input stream on an aggregate device,
and the description includes a mute behaviour that can mute the source app's output so
all of its audio goes to the tap instead.

Two consequences. [breath]

First: no virtual audio driver. Before fourteen point two, a design like this needed a
HAL plug-in installed with admin rights — the BlackHole approach. A tap needs no driver
and no admin install, just a narrow audio-capture permission. That's a much easier thing
to ask a musician to grant.

Second, and this is the whole product: capturing is not controlling. Capturing alone
doesn't change what anyone hears. To control an app you have to capture it, mute it,
process it, and render it yourself. That's the product — and that's also the risk,
because if my renderer stops, that app goes silent.

The cost is the minimum version: fourteen point two. Older Macs get a clear "this Mac is
too old" message, not a silently broken mixer. [breath]

Which leads to the failure you have to design for. If I mute the source and my engine
crashes, the user loses audio completely — not a degraded experience, a dead one.

So: never mute until the replacement path is already running. A watchdog that restores
the source at the first sign of trouble. And a menu-bar "restore audio" that works even
when everything else is broken. If I can't guarantee those three, I shouldn't ship the
mute at all.

Unplug a device mid-song and a device-change listener rebuilds the aggregate and reopens
the output on the new device. If that fails, fall back to the system output and say so
in the menu bar, rather than going quiet and leaving the user to guess. [breath]

Shipping it. Developer ID signing, hardened runtime, minimal entitlements. Notarise with
notarytool submit, wait, then staple so the app opens offline — in continuous
integration, on every release, not by hand. Updates through Sparkle two with a signed
appcast and a staged rollout, so a bad build doesn't reach everyone at once.

Licences sold through a merchant of record, so VAT and GST are their problem and not a
compliance project for a one-person studio. The app receives a signed licence file and
verifies it offline with an embedded public key; a periodic online check only for seat
counts. The audio engine never waits on a network call.

Direct distribution, not the Mac App Store, at least at first. The sandbox is a poor fit
for an audio product and the review cycle is slow. [breath]

Who buys, in order of willingness to pay: students and teachers practising with
recordings, who need "the track quieter and my instrument louder" every day. Then
producers and streamers juggling several apps. Then podcasters who need one app ducked
while another stays clear.

Price hypothesis: twenty-nine dollars one-time for individuals, fifty-nine for a studio
licence with two machines and commercial use, fourteen-day trial. A hypothesis to test,
not a conclusion — a one-time price matches what a music student can pay, and matches
what the incumbents charge.

Launching through a hundred and twenty-seven thousand subscribers without it feeling
like an advert: don't announce a product. Publish a lesson that couldn't exist without
it — how to practise a fast passage by slowing the recording and lifting your own
instrument. The app is on screen the way a metronome would be. The video stands alone if
nobody buys anything. One pinned comment with a link. That's the whole campaign. [breath]

The idea that could spread on its own: shareable practice mixes. A teacher builds a
preset — backing track down six decibels, metronome up two, my part up three — and sends
a link. A student opens it and their Mac adopts it in one click. Every share is a demo.
The hard part is making it work without a server: encode the preset in the URL.

The number I'd watch is activation: the share of installs that build a custom per-app mix
in the first session and still have it applied on day seven. Not downloads, not views.

Three quick answers. A student pays twice by mistake: the second payment is real cash, so
it's recorded and credited, and the excess becomes credit on account; the reminder is
suppressed; a refund is a separate approved event that reduces cash and reverses the
credit. Never silently kept as income.

A page is slow on a cheap phone: measure first, then bytes, render-blocking work and
main-thread JavaScript — on a cheap Android the CPU is the constraint, so a smaller
bundle beats a faster server.

When not to let AI write the code: money movement, auth, destructive migrations, licence
enforcement, and the real-time audio thread. I'll let it draft those; I won't let it be
the last reader. [breath]

One thing the AI got wrong here. It once assumed a three-hundred-and-fifty euro plan
split as one seventeen, one seventeen, one sixteen, because a student had paid one
seventeen — it copied the payment instead of computing the split. A test with the wrong
expected value exposed it.

That's precisely the error that would put a plausible wrong number into an architecture
document, which is why every API claim in this doc is marked verified, with a link to
Apple's documentation next to it.

The diagram and the write-up are in the public repository, under docs, slash mac-app.
