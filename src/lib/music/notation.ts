import {
  degreeLabel,
  getKey,
  midiFor,
  spellDegree,
  swaraFor,
  type KeyDef,
} from './keys';
import type { Tune, TuneNote } from './tunes';

export interface Glyph {
  kind: 'note' | 'rest';
  filled: boolean;
  stem: boolean;
  flags: number;
  dots: number;
}

export interface Column {
  index: number;
  note: TuneNote;
  degreeText: string;
  swara: string;
  noteName: string;
  midi: number | null;
  beats: number;
  startsBar: boolean;
  barIndex: number;
  glyph: Glyph;
}

function glyphFor(note: TuneNote): Glyph {
  if (note.rest) {
    return { kind: 'rest', filled: false, stem: false, flags: 0, dots: 0 };
  }
  const beats = note.beats;
  if (beats >= 4) return { kind: 'note', filled: false, stem: false, flags: 0, dots: 0 };
  if (beats >= 3) return { kind: 'note', filled: false, stem: true, flags: 0, dots: 1 };
  if (beats >= 2) return { kind: 'note', filled: false, stem: true, flags: 0, dots: 0 };
  if (beats >= 1.5) return { kind: 'note', filled: true, stem: true, flags: 0, dots: 1 };
  if (beats >= 1) return { kind: 'note', filled: true, stem: true, flags: 0, dots: 0 };
  if (beats >= 0.5) return { kind: 'note', filled: true, stem: true, flags: 1, dots: 0 };
  return { kind: 'note', filled: true, stem: true, flags: 2, dots: 0 };
}

/**
 * Turn a tune plus a key into the columns the page draws.
 *
 * Bars are found by walking the beat count, so a pickup bar works without a
 * special case in the renderer.
 */
export function buildColumns(tune: Tune, keyId: string): Column[] {
  const keyDef: KeyDef = getKey(keyId);
  const beatsPerBar = tune.meter.beats;
  let position = -(tune.pickupBeats ?? 0);
  let barIndex = 0;

  return tune.notes.map((note, index) => {
    const startsBar = position === 0 || mod(position, beatsPerBar) === 0;
    if (index > 0 && startsBar) barIndex += 1;
    if (index === 0) barIndex = 0;

    const rest = note.rest === true;
    const degree = note.degree ?? 1;
    const midi = rest ? null : midiFor(keyDef, degree, note.alter ?? 0, note.octave ?? 0);

    const column: Column = {
      index,
      note,
      degreeText: rest ? '' : degreeLabel(degree, note.octave ?? 0),
      swara: rest ? '' : swaraFor(degree, note.alter ?? 0),
      noteName: rest ? '' : spellDegree(keyDef, degree, note.alter ?? 0),
      midi,
      beats: note.beats,
      startsBar,
      barIndex,
      glyph: glyphFor(note),
    };

    position += note.beats;
    return column;
  });
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** Columns grouped by bar, for bar-number labels under the notation. */
export function barCount(columns: Column[]): number {
  return columns.length === 0 ? 0 : columns[columns.length - 1].barIndex + 1;
}
