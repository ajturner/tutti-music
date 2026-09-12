// Keys and scales: membership, snapping, and diatonic (scale-degree) transposition.
// A key is { root: 0-11, scale: <name> }. Pitches are MIDI numbers.
import { clamp } from './constants.js';

export const SCALES = {
  'major':            [0, 2, 4, 5, 7, 9, 11],
  'natural-minor':    [0, 2, 3, 5, 7, 8, 10],
  'harmonic-minor':   [0, 2, 3, 5, 7, 8, 11],
  'melodic-minor':    [0, 2, 3, 5, 7, 9, 11],
  'dorian':           [0, 2, 3, 5, 7, 9, 10],
  'phrygian':         [0, 1, 3, 5, 7, 8, 10],
  'lydian':           [0, 2, 4, 6, 7, 9, 11],
  'mixolydian':       [0, 2, 4, 5, 7, 9, 10],
  'pentatonic-major': [0, 2, 4, 7, 9],
  'pentatonic-minor': [0, 3, 5, 7, 10],
  'whole-tone':       [0, 2, 4, 6, 8, 10],
  'chromatic':        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};
export const SCALE_NAMES = Object.keys(SCALES);
export const KEY_ROOTS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const keyName = key => key ? KEY_ROOTS[key.root] + ' ' + key.scale : 'no key';
const steps = key => SCALES[key && key.scale] || SCALES.chromatic;

// Pitch class membership.
export function inScale(key, pitch) {
  if (!key) return true;
  return steps(key).includes((((pitch - key.root) % 12) + 12) % 12);
}
// Scale degree index for a pitch (0-based, unbounded across octaves), or the nearest degree at or
// below it when the pitch is not in the scale.
export function degreeOf(key, pitch) {
  const st = steps(key), rel = pitch - key.root, oct = Math.floor(rel / 12), pc = rel - oct * 12;
  let i = st.length - 1; while (i > 0 && st[i] > pc) i--;
  return oct * st.length + i;
}
export function pitchOfDegree(key, degree) {
  const st = steps(key), n = st.length, oct = Math.floor(degree / n), i = degree - oct * n;
  return key.root + oct * 12 + st[i];
}
// Move a pitch by whole scale degrees. Out-of-scale pitches snap to the degree below first.
export function transposeDiatonic(key, pitch, degrees) {
  if (!key) return clamp(pitch + degrees, 0, 127);
  return clamp(pitchOfDegree(key, degreeOf(key, pitch) + degrees), 0, 127);
}
// Nearest in-scale pitch: dir > 0 rounds up, dir < 0 rounds down, 0 picks the closer (ties go down).
export function snapToScale(key, pitch, dir = 0) {
  if (!key || inScale(key, pitch)) return clamp(pitch, 0, 127);
  const down = pitchOfDegree(key, degreeOf(key, pitch)), up = pitchOfDegree(key, degreeOf(key, pitch) + 1);
  if (dir > 0) return clamp(up, 0, 127);
  if (dir < 0) return clamp(down, 0, 127);
  return clamp(pitch - down <= up - pitch ? down : up, 0, 127);
}
