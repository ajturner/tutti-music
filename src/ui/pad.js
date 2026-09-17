// On-screen entry pad for touch screens and the selection toolbar.
import { inScale } from '../core/scales.js';
import { FX_COMMANDS } from '../core/render.js';
import { ART } from '../core/constants.js';
import { INST } from '../core/instruments.js';
import { $, KEYMAP, activeKey, curTrack, sched, state, tracksShown } from './state.js';
import { currentCell } from './layout.js';
import { moveCell, moveRow, cursorToInstrument, setOctave, setStep, typeIntoCell, undo, placementHere, editPatternHere, transposePlacement, shiftPlacement, octavePlacement, dynamicsPlacement, repeatPlacement } from './edit.js';
import { placementLabel } from '../core/song.js';
import { clearSel, detachSel, selCells, selRect } from './selection.js';
import { changeLength, clearCell } from './edit.js';
import { playPhrase, stopAll } from './transport.js';

// ---- Touch pad ------------------------------------------------------------------------------
// Buttons feed the same key handlers as the keyboard, so entry behaves identically. The key row
// changes with the cell under the cursor: a piano octave for notes, hex digits for velocity and
// dynamics, decimal digits for tempo, the instrument's articulation names for the art column.
export const PAD_NOTES = [['C', 'z'], ['C\u266f', 's'], ['D', 'x'], ['D\u266f', 'd'], ['E', 'c'], ['F', 'v'], ['F\u266f', 'g'], ['G', 'b'], ['G\u266f', 'h'], ['A', 'n'], ['A\u266f', 'j'], ['B', 'm'], ['C+', ',']];
export let padSig = '';
export function padSigReset() { padSig = ''; }
export function padButton(label, cls, fn, title) {
  const b = document.createElement('button'); b.textContent = label; if (cls) b.className = cls; if (title) b.title = title;
  b.addEventListener('pointerdown', e => { e.preventDefault(); fn(); state.dirty = true; });
  b.addEventListener('click', e => e.preventDefault());
  return b;
}
export function syncPad() {
  if (!state.pad) return;
  const cell = currentCell(), tr = curTrack();
  const here = ['note', 'vel', 'art'].includes(cell.kind) ? placementHere() : null;
  const sig = [cell.kind, tr ? tr.sound : '', state.octave, state.step, sched.playing ? 1 : 0, state.selectMode ? 1 : 0, JSON.stringify(activeKey()), here ? placementLabel(here.placement, here.pattern.name) : ''].join(':');
  if (sig === padSig) return; padSig = sig;
  const keys = $('padKeys'); keys.innerHTML = '';
  if (here) {
    // A placement under the cursor: open its pattern, or change how it sounds here.
    keys.style.setProperty('--cols', 12);
    [['open', editPatternHere, 'Open the pattern'], ['\u22121', () => transposePlacement(-1), 'Down a semitone'], ['+1', () => transposePlacement(1), 'Up a semitone'], ['deg\u2193', () => shiftPlacement(-1), 'Down a scale degree'], ['deg\u2191', () => shiftPlacement(1), 'Up a scale degree'], ['detach', detachSel, 'Make these notes loose'],
     ['8va\u2212', () => octavePlacement(-1), 'Down an octave'], ['8va+', () => octavePlacement(1), 'Up an octave'], ['soft', () => dynamicsPlacement(-8), 'Softer'], ['loud', () => dynamicsPlacement(8), 'Louder'], ['rep\u2212', () => repeatPlacement(-1), 'Repeat less'], ['rep+', () => repeatPlacement(1), 'Repeat more']]
      .forEach(([l, f, t]) => keys.appendChild(padButton(l, 'small white', f, t)));
  } else if (cell.kind === 'note') {
    // Two rows like a keyboard: 8 white keys span 16 grid columns, black keys sit between them.
    keys.style.setProperty('--cols', 16);
    let col = 1;
    const key = activeKey();
    for (const [n, k] of PAD_NOTES) {
      const black = n.indexOf('\u266f') >= 0, off = KEYMAP[k], pitch = (state.octave + 1) * 12 + off;
      const b = padButton(n === 'C+' ? 'C' + (state.octave + 1) : n, (black ? 'black' : 'white') + (key && !inScale(key, pitch) ? ' out' : ''), () => typeIntoCell(k));
      if (black) b.style.gridColumn = (col - 1) + ' / span 2'; else { b.style.gridColumn = col + ' / span 2'; col += 2; }
      keys.appendChild(b);
    }
  } else if (cell.kind === 'fx') {
    keys.style.setProperty('--cols', 16);
    for (const c of FX_COMMANDS) { const b = padButton(c, 'small', () => typeIntoCell(c[0].toLowerCase())); b.style.gridColumn = 'span 3'; keys.appendChild(b); }
    const gap = document.createElement('span'); keys.appendChild(gap);
    for (const d of '0123456789abcdef') keys.appendChild(padButton(d.toUpperCase(), '', () => typeIntoCell(d)));
  } else if (cell.kind === 'art') {
    const arts = INST[tr.sound].articulations;
    keys.style.setProperty('--cols', arts.length * 2);
    arts.forEach((a, i) => keys.appendChild(padButton(a, 'small', () => typeIntoCell(String(i + 1)))));
  } else {
    const digits = cell.kind === 'tempo' ? '0123456789' : '0123456789abcdef';
    keys.style.setProperty('--cols', cell.kind === 'tempo' ? 12 : 16);
    for (const d of digits) keys.appendChild(padButton(d.toUpperCase(), '', () => typeIntoCell(d)));
    if (cell.kind !== 'vel') { keys.appendChild(padButton('ramp', 'small', () => typeIntoCell('l'))); keys.appendChild(padButton('hold', 'small', () => typeIntoCell('s'))); }
  }
  const nav = $('padNav'); nav.innerHTML = '';
  [['\u2191', () => moveRow(-1), 'Row up'], ['\u2193', () => moveRow(1), 'Row down'], ['\u2190', () => moveCell(-1), 'Field left'], ['\u2192', () => moveCell(1), 'Field right'],
   ['\u21e4', () => cursorToInstrument(-1), 'Previous instrument'], ['\u21e5', () => cursorToInstrument(1), 'Next instrument'],
   ['sel', () => { state.selectMode = !state.selectMode; padSig = ''; }, 'Drag selects instead of scrolling'],
   ['del', () => state.sel ? clearSel() : clearCell(), 'Clear'], ['\u21b6', undo, 'Undo']]
    .forEach(([l, f, t]) => nav.appendChild(padButton(l, l === 'sel' && state.selectMode ? 'act' : '', f, t)));
  const ctl = $('padCtl'); ctl.innerHTML = '';
  [['oct\u2212', () => setOctave(state.octave - 1), 'Octave down'], ['oct' + state.octave + '+', () => setOctave(state.octave + 1), 'Octave up'],
   ['stp\u2212', () => setStep(state.step - 1), 'Step down'], ['stp' + state.step + '+', () => setStep(state.step + 1), 'Step up'],
   ['len\u2212', () => changeLength(-1), 'Shorter note'], ['len+', () => changeLength(1), 'Longer note'],
   [sched.playing ? '\u25a0' : '\u25b6', () => sched.playing ? stopAll() : playPhrase(false), 'Play or stop the phrase']]
    .forEach(([l, f, t]) => ctl.appendChild(padButton(l, /^[\u25a0\u25b6]$/.test(l) ? 'act' : 'small', f, t)));
}
export let selBarSig = '';
export function syncSelBar() {
  const show = !!state.sel || state.selectMode;
  const bar = $('selbar'); bar.hidden = !show;
  if (!show) { selBarSig = ''; return; }
  const rect = selRect();
  const tracks = new Set(selCells(rect).map(c => c.track).filter(t => t >= 0));
  const arts = tracks.size ? [...new Set([...tracks].flatMap(t => INST[tracksShown()[t].sound].articulations))] : [];
  const sig = [rect.r0, rect.r1, rect.g0, rect.g1, arts.join(','), state.sel ? 1 : 0].join('|');
  if (sig === selBarSig) return; selBarSig = sig;
  $('selInfo').textContent = state.sel ? (rect.r1 - rect.r0 + 1) + ' rows × ' + (rect.g1 - rect.g0 + 1) + ' cells' : 'cursor cell';
  const sel = $('selArt'); sel.innerHTML = '<option value="">art…</option>' + arts.map(a => '<option value="' + a + '">' + a + ' ' + ART[a] + '</option>').join('');
}
export function setPad(on) {
  state.pad = on; document.body.classList.toggle('padon', on); $('padToggle').checked = on; padSig = ''; state.dirty = true;
}
