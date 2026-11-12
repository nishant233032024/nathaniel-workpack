'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Tune } from '@/lib/music/tunes';

export function TuneCard({ tune }: { tune: Tune }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <article className="tune-card">
      <div className="tune-card__top">
        <span className="tune-card__num">Tune {tune.shelfNumber}</span>
        <span className="tune-card__stars" aria-hidden="true">
          ★★★
        </span>
      </div>

      <h2 className="tune-card__title">
        {revealed ? tune.title : <span className="tune-card__hidden">Guess the tune</span>}
      </h2>
      <p className="tune-card__credit">{revealed ? tune.credit : '\u00a0'}</p>

      <dl className="tune-card__meta">
        <div>
          <dt>Meter</dt>
          <dd>
            {tune.meter.beats}/{tune.meter.unit}
          </dd>
        </div>
        <div>
          <dt>Tempo</dt>
          <dd>♩ {tune.tempoBpm}</dd>
        </div>
        <div>
          <dt>Notes</dt>
          <dd>{tune.notes.filter((note) => !note.rest).length}</dd>
        </div>
      </dl>

      <div className="tune-card__actions">
        <button type="button" className="btn btn--ghost btn--small" onClick={() => setRevealed((value) => !value)}>
          {revealed ? 'Hide the answer' : 'Show the answer'}
        </button>
        <Link className="btn btn--primary btn--small" href={`/dhun/${tune.id}`}>
          Open tune
        </Link>
      </div>
    </article>
  );
}
