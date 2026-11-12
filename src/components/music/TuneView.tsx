'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_KEY_ID, KEYS, getKey, scaleSpelling } from '@/lib/music/keys';
import { buildColumns, type Column } from '@/lib/music/notation';
import type { Tune } from '@/lib/music/tunes';
import { PianoEngine } from './PianoEngine';

function RhythmGlyph({ column }: { column: Column }) {
  const { glyph } = column;
  if (glyph.kind === 'rest') {
    return (
      <svg viewBox="0 0 24 44" className="glyph" aria-hidden="true">
        <path
          d="M10 12c5 3-4 6 0 10 3 3-2 5 0 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 44" className="glyph" aria-hidden="true">
      {glyph.stem && <line x1="14.6" y1="32" x2="14.6" y2={glyph.flags > 0 ? 12 : 10} stroke="currentColor" strokeWidth="2.2" />}
      {glyph.flags > 0 && (
        <>
          <path d="M14.6 10c5 1.6 5.6 4 3.4 7.2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          {glyph.flags > 1 && (
            <path d="M14.6 15c5 1.6 5.6 4 3.4 7.2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          )}
        </>
      )}
      <ellipse
        cx="9"
        cy="32"
        rx="6"
        ry="4.2"
        fill={glyph.filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={glyph.filled ? 0 : 2.2}
        transform="rotate(-18 9 32)"
      />
      {glyph.dots > 0 && <circle cx="20" cy="32" r="1.9" fill="currentColor" />}
    </svg>
  );
}

export function TuneView({ tune }: { tune: Tune }) {
  const [keyId, setKeyId] = useState(tune.defaultKey || DEFAULT_KEY_ID);
  const [showNames, setShowNames] = useState(true);
  const [active, setActive] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const engineRef = useRef<PianoEngine | null>(null);

  const columns = useMemo(() => buildColumns(tune, keyId), [tune, keyId]);
  const keyDef = getKey(keyId);

  const stop = () => {
    engineRef.current?.stop();
    setPlaying(false);
    setActive(null);
  };

  // Changing key while something is playing must not leave a stray note behind.
  useEffect(() => {
    stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyId]);

  useEffect(() => {
    const onHide = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      engineRef.current?.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle() {
    if (playing) {
      stop();
      return;
    }
    const engine = (engineRef.current ??= new PianoEngine());
    await engine.unlock();
    setPlaying(true);
    engine.play(
      columns.map((column) => ({ midi: column.midi, beats: column.beats, index: column.index })),
      60 / tune.tempoBpm,
      setActive,
      () => setPlaying(false),
    );
  }

  return (
    <div className="tune-page">
      <div className="tune-toolbar">
        <button type="button" className={`btn ${playing ? 'btn--stop' : 'btn--primary'}`} onClick={toggle} aria-pressed={playing}>
          {playing ? '■ Stop' : '▶ Play'}
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => setShowNames((value) => !value)} aria-pressed={showNames}>
          {showNames ? 'Hide note names' : 'Show note names'}
        </button>
        <span className="tune-toolbar__meta">
          {tune.meter.beats}/{tune.meter.unit} · ♩ = {tune.tempoBpm} · {tune.mode} · key of {keyDef.label}
        </span>
      </div>

      <div className="notation">
        <div className="notation__scroll">
          <div
            className="notation__grid"
            style={{ '--cols': columns.length } as unknown as React.CSSProperties}
          >
            <div className="notation__gutter" aria-hidden="true">
              <div className="cell cell--rhythm">rhythm</div>
              <div className="cell cell--number">number</div>
              <div className="cell cell--swara">swara</div>
              <div className="cell cell--name">note</div>
            </div>
            {columns.map((column) => (
              <div
                key={column.index}
                className={[
                  'col',
                  column.startsBar ? 'col--bar' : '',
                  active === column.index ? 'col--active' : '',
                  column.note.rest ? 'col--rest' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-testid={column.index === 0 ? 'first-column' : undefined}
              >
                <div className="cell cell--rhythm">
                  <RhythmGlyph column={column} />
                </div>
                <div className="cell cell--number">{column.degreeText}</div>
                <div className="cell cell--swara">{column.swara}</div>
                <div className="cell cell--name">{showNames ? column.noteName : ''}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="keys" aria-label="Choose a key">
        <div className="keys__head">
          <h2>Play it in any key</h2>
          <p>
            The numbers and swaras never change. Only the spelled note names do — <strong>{scaleSpelling(keyDef)}</strong> in{' '}
            {keyDef.label} major.
          </p>
        </div>
        <div className="key-pills">
          {KEYS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`key-pill ${option.id === keyId ? 'key-pill--active' : ''}`}
              onClick={() => setKeyId(option.id)}
              aria-pressed={option.id === keyId}
              title={option.enharmonic ? `Also written as ${option.enharmonic}` : undefined}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="keys__footnote">
          Enharmonic labels: Db = C♯, Eb = D♯, F♯ = Gb, Ab = G♯, Bb = A♯. Note names are plain — no octave numbers, ever.
        </p>
      </section>
    </div>
  );
}
