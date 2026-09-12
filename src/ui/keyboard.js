// Keyboard bindings. See the help panel for the scheme and its macOS constraints.
import { curPat, rowsPerBar, sched, state } from './state.js';
import { moveCell, moveRow, moveTrack, redo, setOctave, setRow, setStep, typeIntoCell, undo } from './edit.js';
import { clearSel, copySel, cutSel, deselect, duplicateSel, lengthSel, pasteSel, selExtend, selectTrackOrAll, transposeSel, transposeSelDiatonic } from './selection.js';
import { changeColumns, changeLength, clearCell } from './edit.js';
import { playPattern, playSong, stopAll } from './transport.js';

// ---- Keyboard -----------------------------------------------------------------------------
// macOS constraints this scheme is built around:
//   * Control + arrows are Mission Control and Spaces. The browser never sees them, so
//     Control is not used as a modifier at all.
//   * Option + almost any printable key produces a dead key or a special character, so
//     Option is left alone entirely.
//   * Command is used only where it already means the same thing natively: undo/redo, and
//     Cmd + Up/Down for start and end of the document. Unrecognised Command combinations
//     fall through so Cmd+R, Cmd+L, Cmd+W and friends keep working.
//   * Laptop keyboards have no PageUp/PageDown/Home/End without Fn, so every one of those
//     has a Shift+arrow or Cmd+arrow equivalent.
// Punctuation is matched on e.code (physical position) as well as e.key, so the bindings
// land on the same physical keys on a non-US layout.
window.addEventListener('keydown', e => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') { if (e.key === 'Escape' || e.key === 'Enter') e.target.blur(); return; }
  if (handleKey(e)) e.preventDefault();
});
export function handleKey(e) {
  if (e.altKey) return false;                                  // Option/Alt belongs to the OS
  const k = e.key, code = e.code, sh = e.shiftKey;
  if (e.ctrlKey || e.metaKey) {
    const lower = k.toLowerCase();
    if (lower === 'z' && !sh) { undo(); return true; }
    if ((lower === 'z' && sh) || lower === 'y') { redo(); return true; }
    if (lower === 'a') { selectTrackOrAll(); return true; }
    if (lower === 'c') { copySel(); return true; }
    if (lower === 'x') { cutSel(); return true; }
    if (lower === 'v') { pasteSel(); return true; }
    if (lower === 'd') { duplicateSel(); return true; }
    if (k === 'ArrowUp') { sh ? moveRow(-rowsPerBar()) : setRow(0); return true; }                    // ⌘↑ top, ⌘⇧↑ bar
    if (k === 'ArrowDown') { sh ? moveRow(rowsPerBar()) : setRow(curPat().rows - 1); return true; }  // ⌘↓ end, ⌘⇧↓ bar
    return false;                                              // let the browser have the rest
  }
  // With a selection, the octave/step and length keys act on the selection instead.
  if (state.sel) {
    if (code === 'Minus' || k === '-' || k === '_') { transposeSel(sh ? -12 : -1); return true; }
    if (code === 'Equal' || k === '=' || k === '+') { transposeSel(sh ? 12 : 1); return true; }
    if (code === 'BracketLeft' || k === '[' || k === '{') { lengthSel(-1); return true; }
    if (code === 'BracketRight' || k === ']' || k === '}') { lengthSel(1); return true; }
    if (code === 'Comma' || k === ',' || k === '<') { transposeSelDiatonic(-1); return true; }
    if (code === 'Period' || k === '.' || k === '>') { transposeSelDiatonic(1); return true; }
  }
  // Octave and step: the two keys to the right of 0. Shift switches from octave to step.
  if (code === 'Minus' || k === '-' || k === '_') {
    if (sh) { setStep(state.step - 1); state.message = 'Step ' + state.step; }
    else { setOctave(state.octave - 1); state.message = 'Octave ' + state.octave; }
    return true;
  }
  if (code === 'Equal' || k === '=' || k === '+') {
    if (sh) { setStep(state.step + 1); state.message = 'Step ' + state.step; }
    else { setOctave(state.octave + 1); state.message = 'Octave ' + state.octave; }
    return true;
  }
  // Brackets: note length. Shift switches to note columns (divisi) on the track.
  if (code === 'BracketLeft' || k === '[' || k === '{') { sh ? changeColumns(-1) : changeLength(-1); return true; }
  if (code === 'BracketRight' || k === ']' || k === '}') { sh ? changeColumns(1) : changeLength(1); return true; }
  switch (k) {
    case 'ArrowUp': sh ? selExtend(-1, 0) : moveRow(-1); return true;
    case 'ArrowDown': sh ? selExtend(1, 0) : moveRow(1); return true;
    case 'ArrowLeft': sh ? selExtend(0, -1) : moveCell(-1); return true;
    case 'ArrowRight': sh ? selExtend(0, 1) : moveCell(1); return true;
    case 'PageUp': moveRow(-rowsPerBar()); return true;
    case 'PageDown': moveRow(rowsPerBar()); return true;
    case 'Home': setRow(0); return true;
    case 'End': setRow(curPat().rows - 1); return true;
    case 'Tab': moveTrack(sh ? -1 : 1); return true;
    case ' ': if (sched.playing) stopAll(); else playPattern(sh); return true;
    case 'Enter': playSong(); return true;
    case 'Escape': if (state.sel) deselect(); else stopAll(); return true;
    case 'Delete': case 'Backspace': state.sel ? clearSel() : clearCell(); return true;
  }
  if (k.length === 1) return typeIntoCell(k);
  return false;
}
