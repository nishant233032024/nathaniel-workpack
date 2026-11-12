/**
 * Keys, spelling and transposition.
 *
 * The whole point of this module: a tune is stored as scale degrees, and the
 * letter name is *derived* from the key rather than looked up in a table. That
 * is what makes G major come out as F# and never Gb, and what keeps the numbers
 * and swaras identical in all twelve keys.
 */

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
/** Semitones above C for each natural letter. */
export const LETTER_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
/** Semitones above the tonic for a major scale. */
export const SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11];

export interface KeyDef {
  id: string;
  label: string;
  /** Enharmonic spelling of the same sounding key, shown as a note in the UI. */
  enharmonic?: string;
  tonicPc: number;
  /** Index into LETTERS for the tonic's letter. */
  tonicLetter: number;
  accidental: -1 | 0 | 1;
  /** MIDI note of the tonic used for playback (C3..B3 region). */
  midiBase: number;
}

function key(
  label: string,
  tonicPc: number,
  tonicLetter: number,
  accidental: -1 | 0 | 1,
  enharmonic?: string,
): KeyDef {
  return { id: label, label, tonicPc, tonicLetter, accidental, enharmonic, midiBase: 48 + tonicPc };
}

/**
 * Twelve selectable keys, one per pitch class.
 *
 * Where a key has two common names, the friendlier spelling is the label and
 * the other is shown beside it. All twelve are major keys; the tunes are all
 * major, so no mode is assumed away in the data model (see `mode` on a tune).
 */
export const KEYS: KeyDef[] = [
  key('C', 0, 0, 0),
  key('Db', 1, 1, -1, 'C#'),
  key('D', 2, 1, 0),
  key('Eb', 3, 2, -1, 'D#'),
  key('E', 4, 2, 0),
  key('F', 5, 3, 0),
  key('F#', 6, 3, 1, 'Gb'),
  key('G', 7, 4, 0),
  key('Ab', 8, 5, -1, 'G#'),
  key('A', 9, 5, 0),
  key('Bb', 10, 6, -1, 'A#'),
  key('B', 11, 6, 0),
];

export const DEFAULT_KEY_ID = 'G';

export function getKey(id: string): KeyDef {
  return KEYS.find((k) => k.id === id) ?? KEYS.find((k) => k.id === DEFAULT_KEY_ID)!;
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * Spell one scale degree in a key.
 *
 * The letter comes from the degree's position in the scale (degree 7 of G is
 * some kind of F), then the accidental is whatever is needed to reach the right
 * pitch. No lookup tables, no special cases per key.
 */
export function spellDegree(keyDef: KeyDef, degree: number, alter = 0): string {
  const letterIndex = mod(keyDef.tonicLetter + (degree - 1), 7);
  const targetPc = mod(keyDef.tonicPc + SCALE_STEPS[degree - 1] + alter, 12);
  const naturalPc = LETTER_SEMITONES[letterIndex];
  const diff = mod(targetPc - naturalPc + 6, 12) - 6; // -5..6
  if (diff > 2 || diff < -2) {
    // Only reachable for a non-diatonic alteration far from the letter; fall
    // back to the natural spelling rather than inventing a triple accidental.
    return LETTERS[letterIndex];
  }
  const accidental = diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff);
  return `${LETTERS[letterIndex]}${accidental}`;
}

const SWARA_LETTERS = ['S', 'R', 'G', 'M', 'P', 'D', 'N'];

/**
 * Swara for a degree, using the school's shorthand: komal (flattened) degrees
 * are lowercase, tivra Ma is M'. Shuddha (natural) degrees stay uppercase.
 */
export function swaraFor(degree: number, alter = 0): string {
  const base = SWARA_LETTERS[degree - 1] ?? '';
  if (alter === -1) return base.toLowerCase();
  if (alter === 1) return degree === 4 ? "M'" : base;
  return base;
}

/** "5" or "5'" or ",5" - the number as written on the board. */
export function degreeLabel(degree: number, octave = 0): string {
  if (octave > 0) return `${degree}${"'".repeat(octave)}`;
  if (octave < 0) return `${','.repeat(-octave)}${degree}`;
  return String(degree);
}

export function midiFor(keyDef: KeyDef, degree: number, alter = 0, octave = 0): number {
  return keyDef.midiBase + SCALE_STEPS[degree - 1] + alter + 12 * octave;
}

export function scaleSpelling(keyDef: KeyDef): string {
  return SCALE_STEPS.map((_, index) => spellDegree(keyDef, index + 1)).join(' ');
}
