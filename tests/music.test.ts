import { describe, expect, it } from 'vitest';
import { KEYS, getKey, scaleSpelling, spellDegree, swaraFor } from '../src/lib/music/keys';
import { TUNES } from '../src/lib/music/tunes';
import { barCount, buildColumns } from '../src/lib/music/notation';

describe('key spelling', () => {
  it('offers exactly twelve keys, with G as the default', () => {
    expect(KEYS).toHaveLength(12);
    expect(new Set(KEYS.map((key) => key.tonicPc)).size).toBe(12);
    expect(getKey('G').label).toBe('G');
  });

  it('spells G major with F sharp, never G flat', () => {
    const names = scaleSpelling(getKey('G')).split(' ');
    expect(names).toEqual(['G', 'A', 'B', 'C', 'D', 'E', 'F#']);
    expect(names).not.toContain('Gb');
  });

  it('spells every tonic exactly as its key label', () => {
    for (const key of KEYS) {
      expect(spellDegree(key, 1)).toBe(key.label);
    }
  });

  it('uses flats where the key signature uses flats', () => {
    expect(scaleSpelling(getKey('F')).split(' ')).toEqual(['F', 'G', 'A', 'Bb', 'C', 'D', 'E']);
    expect(scaleSpelling(getKey('Bb')).split(' ')).toEqual(['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A']);
    expect(scaleSpelling(getKey('Db')).split(' ')).toEqual(['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C']);
  });

  it('uses sharps where the key signature uses sharps', () => {
    expect(scaleSpelling(getKey('D')).split(' ')).toEqual(['D', 'E', 'F#', 'G', 'A', 'B', 'C#']);
    expect(scaleSpelling(getKey('B')).split(' ')).toEqual(['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#']);
  });

  it('never produces a double accidental for a major scale', () => {
    for (const key of KEYS) {
      for (const name of scaleSpelling(key).split(' ')) {
        expect(name).toMatch(/^[A-G][#b]?$/);
      }
    }
  });
});

describe('swara notation', () => {
  it('keeps natural degrees uppercase', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((degree) => swaraFor(degree))).toEqual(['S', 'R', 'G', 'M', 'P', 'D', 'N']);
  });

  it('marks komal degrees lowercase and tivra Ma with an apostrophe', () => {
    expect(swaraFor(3, -1)).toBe('g');
    expect(swaraFor(7, -1)).toBe('n');
    expect(swaraFor(4, 1)).toBe("M'");
  });
});

describe('rendering a tune', () => {
  it('produces one column per note, in every key', () => {
    for (const tune of TUNES) {
      for (const key of KEYS) {
        const columns = buildColumns(tune, key.id);
        expect(columns).toHaveLength(tune.notes.length);
        expect(columns.map((column) => column.index)).toEqual(tune.notes.map((_, index) => index));
      }
    }
  });

  it('shows plain note names with no octave digits', () => {
    for (const tune of TUNES) {
      for (const key of KEYS) {
        for (const column of buildColumns(tune, key.id)) {
          if (column.noteName === '') continue;
          expect(column.noteName).toMatch(/^[A-G][#b]?$/);
          expect(column.noteName).not.toMatch(/\d/);
        }
      }
    }
  });

  it('keeps numbers and swaras identical when the key changes', () => {
    for (const tune of TUNES) {
      const reference = buildColumns(tune, 'G');
      for (const key of KEYS) {
        const columns = buildColumns(tune, key.id);
        expect(columns.map((c) => `${c.degreeText}|${c.swara}`)).toEqual(
          reference.map((c) => `${c.degreeText}|${c.swara}`),
        );
      }
    }
  });

  it('transposes the sounding pitch with the key', () => {
    const tune = TUNES[0];
    const inG = buildColumns(tune, 'G');
    const inA = buildColumns(tune, 'A');
    expect(inA[0].midi! - inG[0].midi!).toBe(2);
  });

  it('writes the octave markers into the number, not the note name', () => {
    const columns = buildColumns(TUNES[2], 'G');
    expect(columns.some((column) => column.degreeText.includes("'"))).toBe(true);
    expect(columns.every((column) => !/\d/.test(column.noteName))).toBe(true);
  });

  it('groups bars correctly, including the pickup in Happy Birthday', () => {
    expect(barCount(buildColumns(TUNES[0], 'G'))).toBe(12);

    const birthday = buildColumns(TUNES[2], 'G');
    const firstBar = birthday.filter((column) => column.barIndex === 0);
    expect(firstBar).toHaveLength(2); // the two pickup notes only
    expect(firstBar.reduce((sum, column) => sum + column.beats, 0)).toBe(1);
    // The pickup bar has no bar line before it, so one fewer start than bars.
    expect(birthday.filter((column) => column.startsBar)).toHaveLength(barCount(birthday) - 1);
    // Every phrase closes on the bar, so the tune ends on a bar boundary.
    expect(birthday.reduce((sum, column) => sum + column.beats, 0) % 3).toBe(1);
  });

  it('keeps rests silent but on the grid', () => {
    const birthday = buildColumns(TUNES[2], 'G');
    const rests = birthday.filter((column) => column.note.rest);
    expect(rests.length).toBeGreaterThan(0);
    for (const rest of rests) {
      expect(rest.midi).toBeNull();
      expect(rest.glyph.kind).toBe('rest');
      expect(rest.noteName).toBe('');
    }
  });

  it('accepts a fourth tune without touching the renderer', () => {
    const fourth = {
      id: 'fourth',
      shelfNumber: 4,
      title: 'A Fourth Tune',
      credit: 'Traditional',
      meter: { beats: 4, unit: 4 },
      tempoBpm: 90,
      mode: 'major' as const,
      defaultKey: 'G',
      notes: [{ degree: 5, beats: 2 }, { degree: 1, beats: 2 }],
    };
    const columns = buildColumns(fourth, 'Eb');
    expect(columns).toHaveLength(2);
    expect(columns.map((column) => column.noteName)).toEqual(['Bb', 'Eb']);
  });
});
