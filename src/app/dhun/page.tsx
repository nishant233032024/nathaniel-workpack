import type { Metadata } from 'next';
import { TuneCard } from '@/components/music/TuneCard';
import { TUNES } from '@/lib/music/tunes';

export const metadata: Metadata = {
  title: 'Dhun — the tune shelf',
  description: 'A melody homework book: rhythm, numbers and swaras, playable in twelve keys.',
};

export default function DhunShelfPage() {
  return (
    <div className="wrap">
      <section className="shelf-head">
        <p className="eyebrow">Part 1 · the shelf</p>
        <h1>Guess the tune</h1>
        <p className="lede">
          Every tune is written the way it is written on the board: the rhythm on top, the number under it, then the
          swara. <strong>1</strong> is Sa (do). An apostrophe lifts a number an octave (<strong>5&apos;</strong>); a
          comma drops it (<strong>,5</strong>).
        </p>
      </section>

      <div className="tune-grid">
        {TUNES.map((tune) => (
          <TuneCard key={tune.id} tune={tune} />
        ))}
      </div>

      <p className="shelf-foot">
        Three tunes from Dhun&apos;s shelf, stored as data. A fourth tune is one more object in{' '}
        <code>src/lib/music/tunes.ts</code> — no renderer, route or playback change.
      </p>
    </div>
  );
}
