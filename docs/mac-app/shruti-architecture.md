# Shruti — per-app audio control for macOS

Researched architecture, not a native implementation. The brief asks for the
plan: how sound travels, what runs where, how it is signed and sold.

Every API claim marked **[verified]** was checked against Apple's documentation
on 11 November 2026; the sources are listed at the end.

---

## 1. The one fact that decides the architecture

macOS 14.2 added **Core Audio process taps**:
`AudioHardwareCreateProcessTap(_:_:)` takes a `CATapDescription` and returns an
`AudioObjectID` **[verified]**. The tap is used as an **input stream on a HAL
aggregate device** **[verified]**. A tap can capture one process, a group, or the
whole system mix, and `CATapDescription.muteBehavior` can **mute the source
process's output** so that all of its audio goes to the tap **[verified]**.

Two consequences:

1. **No virtual audio driver is required.** Pre-14.2 designs needed a HAL plug-in
   (BlackHole-style, installed with admin rights). A tap needs no driver and no
   admin install — only a narrow audio-capture permission.
2. **Capturing and controlling are different things.** Capturing alone does not
   change what the user hears. To control an app you must capture it, mute it,
   process it, and render it yourself. That is the whole product, and it is also
   the whole risk: if the renderer stops, the app goes silent.

A second route exists: ScreenCaptureKit (macOS 13+) can capture app audio, but it
requires the Screen Recording permission, which is a much broader and scarier grant
for a mixer **[verified, secondary source]**. Shruti should use taps, with
ScreenCaptureKit as a fallback only if a tap cannot be created.

**Minimum macOS: 14.2.** In late 2026 that excludes a small, shrinking share of
musicians. Older systems get a clear "this Mac is too old" message rather than a
silently broken mixer.

---

## 2. Audio flow

```
 ┌──────────────┐   Core Audio render    ┌────────────────────────────┐
 │ Source app   │ ─────────────────────► │ Process tap                │
 │ Safari,      │                        │ CATapDescription           │
 │ Spotify,     │                        │ processes: [AudioObjectID] │
 │ Logic        │                        │ muteBehavior: .muted       │
 └──────────────┘                        └─────────────┬──────────────┘
                                                       │ input stream
                                                       ▼
                                         ┌────────────────────────────┐
                                         │ HAL aggregate device       │
                                         │ tap + (optionally) the     │
                                         │ hardware output device     │
                                         └─────────────┬──────────────┘
                                                       │ IOProc, real-time
                                                       ▼
                                         ┌────────────────────────────┐
                                         │ Audio engine (per app)     │
                                         │ gain → EQ → limiter        │
                                         │ Audio Units, no locks,     │
                                         │ no allocation, no Obj-C    │
                                         └─────────────┬──────────────┘
                                                       ▼
                                         ┌────────────────────────────┐
                                         │ Output Audio Unit          │
                                         │ default device or chosen   │
                                         │ interface                  │
                                         └─────────────┬──────────────┘
                                                       ▼
                                                Speakers / interface
```

The visible file is `shruti-flow.svg`; the editable one is `shruti-flow.drawio`.

### Why the aggregate device

A tap is not a device. It becomes usable by being listed as an input on an
aggregate device, which the app creates and owns. That aggregate is what the
IOProc reads from. When the hardware output changes, the aggregate is rebuilt.

### Where the muted audio goes

With `muteBehavior = .muted`, the source app's audio is removed from the normal
output and delivered to the tap. Shruti is now the only path to the speakers.
This is what kills doubled audio — and it is why the engine must be running
before the mute is applied, and must un-mute on every exit path.

---

## 3. Process and component boundaries

| Component | Runs where | Responsibility | Why there |
| --- | --- | --- | --- |
| Menu-bar app (SwiftUI, `MenuBarExtra`) | Main app process | UI, device list, per-app rows, presets, onboarding, permission prompts | Needs AppKit/SwiftUI and user interaction |
| Audio engine (C++/Swift, Core Audio HAL + Audio Units) | Same process, one high-priority IO thread | Aggregate device, IOProc, per-app gain/EQ, mixing, limiter | Lowest latency; avoids IPC on the audio thread |
| Settings store | Main process, `UserDefaults` + a versioned JSON blob | Per-app mixes, device choice, EQ curves | Survives crashes; readable for support |
| Optional XPC helper | Separate process | Watchdog and crash recovery: un-mute apps if the main app dies | A crash in the UI process must not leave the Mac silent |
| Launch agent | `SMAppService` | Start at login, restore last mix | Standard, user-visible in Login Items |

**Real-time rules for the IOProc:** no allocation, no locks, no Objective-C
messaging, no file or network I/O, no logging on the audio thread. Parameter
changes arrive through a lock-free ring buffer or atomics. Anything that needs to
allocate happens on the main thread and is handed over as a prepared buffer.

**Where a virtual driver is *not* needed:** anywhere in this design. That is the
point of taps. A driver would only come back if we needed to support macOS
before 14.2, or to appear as a device to apps that refuse to be tapped.

---

## 4. Settings and recovery

- **Saved settings:** per-app bundle ID → {gain, EQ curve, mute, output routing},
  plus a global default and named presets. Stored in `UserDefaults` for speed and
  exported to JSON for support and backup.
- **Restore on launch:** rebuild the aggregate, re-create taps for the saved
  bundle IDs, apply gains, and only then mute. If any step fails, that app stays
  un-muted and is shown as "not controlled".
- **Device change (unplug mid-song):** a property listener on the default output
  device tears down the old aggregate and builds a new one on the new device.
  The audible gap is a few tens of milliseconds; the app shows a brief
  "switching to MacBook speakers" notice rather than going silent. If the new
  device cannot be opened, fall back to the system default and keep the apps
  un-muted.
- **App quit / crash:** the mute is a property of a live tap. When the process
  dies, the tap is destroyed and the source app's audio returns to normal. That
  is a safety property of the design, not an accident — but the XPC watchdog
  exists because it must be tested, not assumed.
- **Feedback loops:** never allow a tap whose output device is also its input.
  Shruti refuses to route an app back into itself and shows why.
- **Latency:** one IOProc buffer. At 128 frames / 48 kHz that is ~2.7 ms; at 512
  it is ~10.7 ms. Expose a "low latency" toggle that trades CPU for buffer size,
  because a musician monitoring themselves cares and a podcast listener does not.
- **Sample-rate mismatch:** the aggregate runs at the output device's rate; taps
  are resampled by the HAL. Show the rate in the UI when it differs, because
  "why does it sound slightly wrong" is usually this.

---

## 5. Frameworks

| Need | Framework / API |
| --- | --- |
| Enumerate apps and their audio processes | Core Audio (`AudioHardwareProcess`, `kAudioHardwarePropertyProcessObjectList`) |
| Capture per-app audio | Core Audio taps — `CATapDescription`, `AudioHardwareCreateProcessTap` (14.2+) |
| Combine streams | `AudioHardwareCreateAggregateDevice`, `AudioHardwareAggregateDevice` |
| Real-time IO | `AudioDeviceCreateIOProcIDWithBlock` / `AudioDeviceStart` |
| Gain, EQ, limiting | Audio Units (`kAudioUnitSubType_…EQ`, `kAudioUnitSubType_PeakLimiter`) or a hand-written biquad chain |
| Output to a device | `AudioUnit` of type output, or `AVAudioEngine` for a simpler path |
| UI | SwiftUI (`MenuBarExtra`, `Settings`), AppKit where needed |
| Device hot-plug | `AudioObjectAddPropertyListenerBlock` on the default output device |
| Launch at login | `SMAppService.mainApp` |

**AVFoundation:** appropriate for playback of our own audio and for simple
routing, but the per-app capture and the mute live in Core Audio. Using
`AVAudioEngine` for the whole graph is tempting and is the right call for a v1 if
the EQ needs are modest — but it must still be fed by the aggregate device, and
the mute behaviour still comes from the tap.

---

## 6. Permissions and entitlements

- **`NSAudioCaptureUsageDescription`** in Info.plist, with a sentence a user can
  evaluate ("Shruti captures the audio of the apps you choose so it can adjust
  their volume"). macOS prompts the first time an aggregate containing a tap is
  started **[verified]**.
- **No Screen Recording permission** for the tap path — that is a real selling
  point over ScreenCaptureKit-based tools.
- **Hardened runtime** with `com.apple.security.device.audio-input` if we ever
  take microphone input; not needed for taps alone.
- **App Sandbox:** the honest position is that a per-app mixer is a poor fit for
  the sandbox and should ship outside the Mac App Store, signed with a Developer
  ID. If a sandboxed build is attempted later, audio capture and the aggregate
  device must be re-verified under the sandbox before promising it.

---

## 7. Risk register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| User loses all audio because we muted and then crashed | Medium | Severe | Mute only after the render path is live; XPC watchdog; un-mute on every exit path; tested with a forced crash |
| Permission denied or revoked | Medium | High | Detect, explain, keep the app un-muted and functional as a viewer |
| Doubled audio (tap + original both audible) | Medium | High | `muteBehavior = .muted`; an explicit "test tone" check during onboarding |
| Feedback loop | Low | Severe | Refuse self-routing; never tap our own output |
| Interface unplugged mid-song | High | Medium | Device listener; rebuild aggregate; visible fallback to system output |
| Latency complaints | Medium | Medium | Buffer-size control, honest numbers in the UI |
| CPU spikes on many apps | Medium | Medium | One mix bus, not one graph per app; limiter; report CPU in the menu |
| DRM-protected audio cannot be tapped | Medium | Medium | Detect and show "this app can't be controlled" rather than pretending |
| Sample-rate mismatch | Medium | Low | Show the rate; let the HAL resample |
| Notarisation rejected | Low | High | Automate `notarytool` in CI and staple the ticket |
| Licence bypass | Medium | Medium | Signed licence file, offline verification, merchant of record |
| Apple changes tap behaviour | Low | High | Fallback path via ScreenCaptureKit; keep the abstraction thin |

The first row is the one to design around. A mixer that can silence a Mac is one
crash away from a refund and a bad review.

---

## 8. Distribution

1. **Sign** with a Developer ID Application certificate; enable the hardened
   runtime; keep the entitlements minimal.
2. **Notarise** with `notarytool submit --wait`, then `stapler staple` so the app
   opens offline. Do it in CI on every release, not by hand.
3. **Update** with Sparkle 2: signed appcast (EdDSA), HTTPS feed, delta updates,
   and a staged rollout so a bad build does not reach everyone at once.
4. **Licence check:** sell through a merchant of record (Paddle or Lemon Squeezy)
   so VAT/GST is their problem, not ours. The app receives a signed licence file
   containing the product, expiry and machine allowance; verification is offline
   with an embedded public key, and a periodic online check only for seat counts.
   Never block the audio engine on a network call.
5. **Not the Mac App Store**, at least at first: the sandbox is a poor fit and the
   review process slows a fast-moving audio product. Direct distribution plus
   Sparkle is the norm for this category.

---

## 9. How it sells

**Who buys.** Three groups, in order of willingness to pay:

1. **Students and teachers** practising with recordings — they need "the track
   quieter, my instrument louder", quickly, every day.
2. **Producers and streamers** juggling several apps — they need routing and
   separate levels without a patchbay.
3. **Podcasters and callers** — they need one app ducked and another clear.

**Price hypothesis.** A one-time **$29** for individuals, **$59** for a studio
licence (two machines, commercial use), with a 14-day trial. A subscription
would be easier to grow but harder to defend in a market where the incumbents are
one-time purchases; a one-time price also matches what a music student can pay.
This is a hypothesis to test, not a conclusion.

**Launch through a 127,000-subscriber channel without it feeling like an advert.**
Do not announce a product. Publish a lesson that could not exist without it:
"how to practise a fast passage by slowing the recording and lifting your own
instrument". Shruti appears as the tool on screen, the way a metronome would. The
video stands alone if nobody buys anything. Then a pinned comment and a link,
once. That is the whole campaign.

**One idea that could go viral.** **Shareable practice mixes.** A teacher creates
a mix preset — "Grade 3 exam: backing track −6 dB, metronome +2 dB, my part +3 dB" —
and sends a link. A student opens it and their Mac adopts it in one click. It
spreads through teachers, it is genuinely useful, and every share is a demo. The
hard part is making it work without a server: encode the preset in the URL.

**The one number to watch.** **Activation:** the share of installs that create a
custom per-app mix in the first session *and* still have it applied on day seven.
Not downloads, not views. If activation is high, the product is doing the job and
paid acquisition is worth trying; if it is low, no amount of channel reach will
help.

---

## 10. Three quick answers

**A student pays twice by mistake.** The portal does not delete or net anything.
The second payment is real cash, so it is recorded, credited to the student, and
the excess beyond the fee becomes **credit on account**. The reminder for that
student is suppressed, and the review queue shows the duplicate decision. If the
student wants the money back, an admin approves a **refund as a separate event**
which reduces cash and reverses the credit — never inferred, always recorded.
The one thing the portal must never do is silently keep it as income.

**A page is slow on a cheap phone — where do you look first?** Measure before
changing anything: real field data if it exists, otherwise Lighthouse on a
throttled CPU and a slow network. Then, in order: bytes shipped (bundle, images,
fonts), render-blocking resources, main-thread JavaScript, and only then
framework-level work. On a cheap Android the CPU is usually the binding
constraint, so a smaller bundle and less hydration beats a faster server. Fix the
largest measured cost, re-measure, repeat.

**When would you not let AI write the code?** When the cost of a plausible wrong
answer is high and the test is weak: money movement and reconciliation, auth and
permissions, destructive migrations, licence enforcement, cryptography, and the
real-time audio thread. I would still let it draft those — I would not let it be
the last reader. The rule I used on this work pack: if I cannot explain it or
test it, it does not ship.

---

## Sources

- Apple, *AudioHardwareCreateProcessTap(_:_:)* — macOS 14.2+, `CATapDescription`
  in, `AudioObjectID` out: <https://developer.apple.com/documentation/coreaudio/audiohardwarecreateprocesstap(_:_:)>
- Apple, *Capturing system audio with Core Audio taps* — tap as an aggregate
  device input, `muteBehavior`, `NSAudioCaptureUsageDescription`, macOS 14.2+:
  <https://developer.apple.com/documentation/coreaudio/capturing-system-audio-with-core-audio-taps>
- Apple, *CATapDescription* — initialisers, `processes`, `muteBehavior`,
  `isPrivate`: <https://developer.apple.com/documentation/coreaudio/catapdescription>
- Apple, *Core Audio* — `AudioHardwareAggregateDevice`, `AudioHardwareProcess`,
  `AudioHardwareTap`: <https://developer.apple.com/documentation/coreaudio>
