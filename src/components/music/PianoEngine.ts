/**
 * A small additive piano synthesiser.
 *
 * No sample pack is bundled, so there is nothing to license: each note is built
 * from a few harmonic partials with a hammer-like attack and a decay that
 * shortens as the note gets shorter. It is not a recording of a grand piano,
 * and the README says so.
 */

export interface PlayEvent {
  midi: number | null;
  beats: number;
  index: number;
}

const PARTIALS: [number, number][] = [
  [1, 1],
  [2, 0.34],
  [3, 0.16],
  [4, 0.07],
  [5, 0.035],
  [6, 0.02],
];

export class PianoEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private nodes: AudioScheduledSourceNode[] = [];
  private frame = 0;
  private token = 0;

  async unlock(): Promise<void> {
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  /** Silence everything immediately. Safe to call when nothing is playing. */
  stop(): void {
    this.token += 1;
    if (this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
    const now = this.ctx?.currentTime ?? 0;
    for (const node of this.nodes) {
      try {
        node.stop(now);
      } catch {
        /* already stopped */
      }
      try {
        node.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    this.nodes = [];
  }

  play(
    events: PlayEvent[],
    secondsPerBeat: number,
    onIndex: (index: number | null) => void,
    onEnd: () => void,
  ): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    this.stop();
    const myToken = this.token;

    const startAt = ctx.currentTime + 0.12;
    let cursor = 0;
    const marks: { at: number; index: number }[] = [];

    for (const event of events) {
      const duration = event.beats * secondsPerBeat;
      if (event.midi !== null) this.voice(event.midi, startAt + cursor, duration * 0.95);
      marks.push({ at: startAt + cursor, index: event.index });
      cursor += duration;
    }
    const endAt = startAt + cursor;

    const tick = () => {
      if (myToken !== this.token) return;
      const now = ctx.currentTime;
      let current: number | null = null;
      for (const mark of marks) {
        if (now >= mark.at) current = mark.index;
      }
      onIndex(current);
      if (now < endAt + 0.2) {
        this.frame = requestAnimationFrame(tick);
      } else {
        onIndex(null);
        onEnd();
      }
    };
    this.frame = requestAnimationFrame(tick);
  }

  private voice(midi: number, when: number, duration: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const noteGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.5;
    filter.frequency.setValueAtTime(Math.min(12_000, freq * 14), when);
    filter.frequency.exponentialRampToValueAtTime(Math.max(700, freq * 3), when + Math.min(1.6, duration));
    noteGain.connect(filter);
    filter.connect(master);

    const release = when + Math.min(2.4, duration + 0.9);
    noteGain.gain.setValueAtTime(0.0001, when);
    noteGain.gain.exponentialRampToValueAtTime(0.2, when + 0.006);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, release);

    for (const [ratio, level] of PARTIALS) {
      const osc = ctx.createOscillator();
      osc.type = ratio === 1 ? 'triangle' : 'sine';
      // A touch of stretch makes the upper partials sound struck, not tuned.
      osc.frequency.value = freq * ratio * (1 + 0.0006 * ratio * ratio);
      const partialGain = ctx.createGain();
      partialGain.gain.value = level;
      osc.connect(partialGain);
      partialGain.connect(noteGain);
      osc.start(when);
      osc.stop(release + 0.15);
      this.nodes.push(osc);
    }
  }

  dispose(): void {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }
}
