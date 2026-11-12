import { DEFAULT_KEY_ID } from './keys';

export interface TuneNote {
  /** Scale degree 1-7. 1 is Sa / do. Absent on a rest. */
  degree?: number;
  /** Semitone alteration: -1 flat, 0 natural, +1 sharp. */
  alter?: number;
  /** Octaves away from the tonic's octave. */
  octave?: number;
  /** Length in beats, where one beat is the meter's lower number. */
  beats: number;
  rest?: boolean;
}

export interface Tune {
  id: string;
  /** Position on the Dhun shelf, used for the "Tune 3" label. */
  shelfNumber: number;
  title: string;
  credit: string;
  meter: { beats: number; unit: number };
  tempoBpm: number;
  mode: 'major' | 'minor';
  defaultKey: string;
  /** Beats of anacrusis before the first full bar. */
  pickupBeats?: number;
  notes: TuneNote[];
}

/**
 * Three tunes taken from Dhun's shelf. The melodies are traditional and in the
 * public domain; the notation data below is my own transcription, written from
 * the melody rather than copied from Dhun's files.
 *
 * Adding a fourth tune means adding one object to this array. No renderer,
 * route or playback code changes.
 */
export const TUNES: Tune[] = [
  {
    id: 'twinkle',
    shelfNumber: 3,
    title: 'Twinkle Twinkle Little Star',
    credit: 'Traditional',
    meter: { beats: 4, unit: 4 },
    tempoBpm: 100,
    mode: 'major',
    defaultKey: DEFAULT_KEY_ID,
    notes: [
      { degree: 1, beats: 1 }, { degree: 1, beats: 1 }, { degree: 5, beats: 1 }, { degree: 5, beats: 1 },
      { degree: 6, beats: 1 }, { degree: 6, beats: 1 }, { degree: 5, beats: 2 },
      { degree: 4, beats: 1 }, { degree: 4, beats: 1 }, { degree: 3, beats: 1 }, { degree: 3, beats: 1 },
      { degree: 2, beats: 1 }, { degree: 2, beats: 1 }, { degree: 1, beats: 2 },
      { degree: 5, beats: 1 }, { degree: 5, beats: 1 }, { degree: 4, beats: 1 }, { degree: 4, beats: 1 },
      { degree: 3, beats: 1 }, { degree: 3, beats: 1 }, { degree: 2, beats: 2 },
      { degree: 5, beats: 1 }, { degree: 5, beats: 1 }, { degree: 4, beats: 1 }, { degree: 4, beats: 1 },
      { degree: 3, beats: 1 }, { degree: 3, beats: 1 }, { degree: 2, beats: 2 },
      { degree: 1, beats: 1 }, { degree: 1, beats: 1 }, { degree: 5, beats: 1 }, { degree: 5, beats: 1 },
      { degree: 6, beats: 1 }, { degree: 6, beats: 1 }, { degree: 5, beats: 2 },
      { degree: 4, beats: 1 }, { degree: 4, beats: 1 }, { degree: 3, beats: 1 }, { degree: 3, beats: 1 },
      { degree: 2, beats: 1 }, { degree: 2, beats: 1 }, { degree: 1, beats: 2 },
    ],
  },
  {
    id: 'ode-to-joy',
    shelfNumber: 5,
    title: 'Ode to Joy',
    credit: 'Beethoven, Symphony No. 9',
    meter: { beats: 4, unit: 4 },
    tempoBpm: 104,
    mode: 'major',
    defaultKey: DEFAULT_KEY_ID,
    notes: [
      { degree: 3, beats: 1 }, { degree: 3, beats: 1 }, { degree: 4, beats: 1 }, { degree: 5, beats: 1 },
      { degree: 5, beats: 1 }, { degree: 4, beats: 1 }, { degree: 3, beats: 1 }, { degree: 2, beats: 1 },
      { degree: 1, beats: 1 }, { degree: 1, beats: 1 }, { degree: 2, beats: 1 }, { degree: 3, beats: 1 },
      { degree: 3, beats: 1.5 }, { degree: 2, beats: 0.5 }, { degree: 2, beats: 2 },
      { degree: 3, beats: 1 }, { degree: 3, beats: 1 }, { degree: 4, beats: 1 }, { degree: 5, beats: 1 },
      { degree: 5, beats: 1 }, { degree: 4, beats: 1 }, { degree: 3, beats: 1 }, { degree: 2, beats: 1 },
      { degree: 1, beats: 1 }, { degree: 1, beats: 1 }, { degree: 2, beats: 1 }, { degree: 3, beats: 1 },
      { degree: 2, beats: 1.5 }, { degree: 1, beats: 0.5 }, { degree: 1, beats: 2 },
    ],
  },
  {
    id: 'happy-birthday',
    shelfNumber: 2,
    title: 'Happy Birthday',
    credit: 'Traditional',
    meter: { beats: 3, unit: 4 },
    tempoBpm: 96,
    mode: 'major',
    defaultKey: DEFAULT_KEY_ID,
    // "Hap-py" starts on the last beat of the bar, so the first bar is short.
    pickupBeats: 1,
    notes: [
      { degree: 5, beats: 0.5 }, { degree: 5, beats: 0.5 },
      { degree: 6, beats: 1 }, { degree: 5, beats: 1 }, { degree: 1, octave: 1, beats: 1 },
      { degree: 7, beats: 2 }, { rest: true, beats: 1 },
      { degree: 5, beats: 0.5 }, { degree: 5, beats: 0.5 },
      { degree: 6, beats: 1 }, { degree: 5, beats: 1 }, { degree: 2, octave: 1, beats: 1 },
      { degree: 1, octave: 1, beats: 2 }, { rest: true, beats: 1 },
      { degree: 5, beats: 0.5 }, { degree: 5, beats: 0.5 },
      { degree: 5, octave: 1, beats: 1 }, { degree: 3, octave: 1, beats: 1 }, { degree: 1, octave: 1, beats: 1 },
      { degree: 7, beats: 1 }, { degree: 6, beats: 1 }, { rest: true, beats: 1 },
      { degree: 4, octave: 1, beats: 0.5 }, { degree: 4, octave: 1, beats: 0.5 },
      { degree: 3, octave: 1, beats: 1 }, { degree: 1, octave: 1, beats: 1 }, { degree: 2, octave: 1, beats: 1 },
      { degree: 1, octave: 1, beats: 2 }, { rest: true, beats: 1 },
    ],
  },
];

export function getTune(id: string): Tune | undefined {
  return TUNES.find((tune) => tune.id === id);
}
