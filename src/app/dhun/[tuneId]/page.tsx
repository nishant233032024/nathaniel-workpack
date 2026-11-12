import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { TuneView } from '@/components/music/TuneView';
import { TUNES, getTune } from '@/lib/music/tunes';

export function generateStaticParams() {
  return TUNES.map((tune) => ({ tuneId: tune.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ tuneId: string }> }): Promise<Metadata> {
  const { tuneId } = await params;
  const tune = getTune(tuneId);
  return { title: tune ? `${tune.title} — Dhun` : 'Tune — Dhun' };
}

export default async function TunePage({ params }: { params: Promise<{ tuneId: string }> }) {
  const { tuneId } = await params;
  const tune = getTune(tuneId);
  if (!tune) notFound();

  return (
    <div className="wrap">
      <Link className="back-link" href="/dhun">
        ← All tunes
      </Link>

      <section className="tune-head">
        <div>
          <p className="eyebrow">
            Tune {tune.shelfNumber} · {tune.credit}
          </p>
          <h1>{tune.title}</h1>
          <p className="lede">
            Read it as numbers, sing it as swaras, then move it to any key. The notes change spelling; the numbers and
            swaras do not move.
          </p>
        </div>
      </section>

      <TuneView tune={tune} />

      <section className="card card--flat explain">
        <h2>How this tune is stored</h2>
        <p>
          One note is one object: a scale degree, an optional alteration, an octave and a duration in beats. Bar lines
          are worked out by walking the beat count, so a pickup bar needs no special case.
        </p>
        <pre>
          <code>{`{ degree: 5, beats: 1 }      // Pa, one beat
{ degree: 7, beats: 2 }      // Ni, two beats
{ degree: 1, octave: 1 }     // Sa an octave up, written 1'`}</code>
        </pre>
        <p>
          The spelled note name is derived from the key, not stored: the letter comes from the degree&apos;s position in
          the scale, and the accidental is whatever reaches the right pitch. In G major, degree 7 is on the F line, so
          it comes out <strong>F♯</strong> — never Gb.
        </p>
      </section>
    </div>
  );
}
