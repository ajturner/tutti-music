// Pocket view: the whole app on one phone screen, in the image of the M8. A context line naming the five levels
// (SO SE PH PA IN) with the one you are on lit and the playhead in the song's words; the level itself; a readout of
// what every instrument is sounding; and an on-screen pad with the game controller's eight buttons. The pad feeds
// the controller scheme (src/ui/gamepad.js) through state.padHeld, so directions move, A + direction edits the
// value under the cursor, B clears, Back modifies (and undoes alone), Start plays, Back + L/R change level. It is a
// second renderer and input surface over the same state, cursor and undo history as the full interface: nothing is
// lost by switching. Chosen in View, or by ?pocket in the address; remembered per browser.
import { noteName } from '../core/constants.js';
import { SOUND, SOUNDS } from '../core/sounds.js';
import { keyName } from '../core/scales.js';
import { addInstrument, addPhrase, addSection, addSlot, duplicateInstrument, INSTRUMENT_SETTINGS, instrumentDefaults, keyFor, nextPhraseName, nextSectionName, newSong, patternById, phraseMeter, placementLabel, removeInstrument, removeItem, removeSlot, deleteSection, sectionById, setInstrumentSound } from '../core/song.js';
import { renderSong, rowAtTick } from '../core/render.js';
import { $, curInstrument, curPattern, curPhrase, curSection, instrumentsShown, preloadSamples, sched, state } from './state.js';
import { withSongUndo, leavePattern, editPatternHere, cursorToInstrument, undo } from './edit.js';
import { openPhrase, openSong, setLevel } from './map.js';
import { songRows } from './songview.js';
import { playPhrase, playSection, playSong, stopAll } from './transport.js';
import { soundingNow } from './monitor.js';
import { esc, syncPhraseUI } from './sync.js';
import { offered } from './instruments.js';
import { addSong, download, selectSong } from './toolbar.js';
import { markEdited } from './storage.js';

const KEY = 'tutti.pocket.v1';
// What the buttons do here, one line under the level. A+ means A held while pressing.
const HINTS = {
  song: '<b>A</b> open phrase · <b>in</b> section · <b>A+▲▼</b> repeat · <b>B</b> remove · <b>Start</b> play from here',
  section: '<b>A</b> open phrase · <b>out</b> song · <b>in</b> phrase · <b>A+▲▼</b> repeat · <b>B</b> remove · <b>Back+◀▶</b> other section',
  phrase: '<b>A</b> note · <b>A+▲▼</b> pitch · <b>B</b> clear · <b>out</b> section · <b>in</b> pattern under ▸ · <b>Start</b> loop',
  pattern: '<b>A+▲▼</b> pitch · <b>B</b> clear · <b>out</b> phrase · <b>Start</b> loop',
  instrument: '<b>A+◀▶▲▼</b> value · <b>A</b> pick sound · <b>Back+A</b> duplicate · <b>Back+◀▶</b> other instrument · <b>B</b> on name removes',
  sounds: '<b>A</b> pick · <b>out</b> or <b>B</b> back',
  menu: '<b>A</b> pick · <b>out</b> or <b>B</b> back',
};
export const LEVELS = [['song', 'SO', 'Song: the arrangement'], ['section', 'SE', 'Section: its phrases'], ['phrase', 'PH', 'Phrase: the notes'], ['pattern', 'PA', 'Pattern: one voice'], ['instrument', 'IN', 'Instruments: sound, mix, tuning']];
const FIELDS = [['name', 'name'], ['sound', 'sound'], ['volume', 'volume'], ['pan', 'pan'], ['mute', 'mute'], ['solo', 'solo'], ['tune', 'tune'], ['cents', 'cents'], ['trim', 'trim dB'], ['release', 'release'], ['channel', 'channel'], ['columns', 'columns']];
let savedShow = null, sig = '', lastPlay = '', lastLive = '';

// ---- On and off ---------------------------------------------------------------------------------------
export function pocketOn() { return !!state.pocket; }
export function setPocket(on) {
  if (on === pocketOn()) return;
  if (on) {
    state.pocket = { level: state.level === 'song' ? 'song' : state.patternEdit ? 'pattern' : 'phrase', song: { row: 0, col: 0 }, sec: { row: 0 }, inst: { i: 0, row: 1 }, menu: null, sounds: null };
    savedShow = Object.assign({}, state.show); state.show = { vel: false, art: false, dyn: false, fx: false };   // note only
    state.cursor.cell = 0; state.sel = null; state.selAnchor = null;
    document.body.classList.add('pocket'); $('pocket').hidden = false; sig = ''; lastPlay = ''; lastLive = '';
    $('pocket').focus({ preventScroll: true });
  } else {
    state.pocket = null; document.body.classList.remove('pocket'); $('pocket').hidden = true; state.padHeld = {};
    if (savedShow) { state.show = savedShow; savedShow = null; }
    (state.level === 'song' ? $('songView') : $('grid')).focus({ preventScroll: true });
  }
  const box = $('pocketToggle'); if (box) box.checked = on;
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* no storage */ }
  state.dirty = true;
}
export function restorePocket() {
  const q = new URLSearchParams(location.search);
  let on = q.has('pocket') ? q.get('pocket') !== '0' : false;
  if (!q.has('pocket')) { try { on = localStorage.getItem(KEY) === '1'; } catch { on = false; } }
  if (on) setPocket(true);
}

// ---- Levels ---------------------------------------------------------------------------------------------
const pk = () => state.pocket;
export function pocketLevel() { const p = pk(); if (!p) return null; if (p.menu) return 'menu'; if (p.sounds) return 'sounds'; return p.level; }
export function goLevel(level, opts = {}) {
  const p = pk(), song = state.song; if (!p) return;
  p.menu = null; p.sounds = null;
  if (level === 'pattern') { if (!curPattern() && !editPatternHere()) return false; p.level = 'pattern'; setLevel('grid'); }
  else if (level === 'phrase') { if (opts.phrase != null) openPhrase(opts.phrase, opts.section, opts.instrument); else leavePattern(); setLevel('grid'); p.level = 'phrase'; }
  else if (level === 'section') { const sec = curSection(); if (!sec) { goLevel('song'); return; } openSong(); p.level = 'section'; p.sec.row = Math.max(0, Math.min(p.sec.row, sec.phrases.length)); }
  else if (level === 'instrument') { openSong(); p.level = 'instrument'; p.inst.i = Math.max(0, Math.min(song.instruments.length ? state.cursor.instrument : 0, song.instruments.length - 1)); }
  else { openSong(); p.level = 'song'; const m = songLines(); const at = m.lines.findIndex(l => l.kind === 'phrase' && l.r.pi === state.phr && l.r.block.si === state.section); if (at >= 0) p.song.row = at; p.song.col = Math.max(0, Math.min(state.cursor.instrument, song.instruments.length - 1)); }
  sig = ''; state.dirty = true; return true;
}
// Out a level and in a level, in the order of the context line.
const ORDER = ['song', 'section', 'phrase', 'pattern'];
export function pocketOut() { const l = pocketLevel(); if (l === 'menu' || l === 'sounds') { pk().menu = null; pk().sounds = null; sig = ''; state.dirty = true; return; } if (l === 'instrument') { goLevel('song'); return; } const i = ORDER.indexOf(l); if (i > 0) goLevel(ORDER[i - 1]); }
export function pocketIn() {
  const l = pocketLevel();
  if (l === 'song') { const line = songLines().lines[pk().song.row]; if (line && line.kind === 'phrase') { openRow(line.r); goLevel('section'); } else if (line && line.kind === 'bar') { state.section = line.b.si; goLevel('section'); } }
  else if (l === 'section') { const sec = curSection(), i = pk().sec.row; if (sec && sec.phrases[i]) goLevel('phrase', { phrase: state.song.phrases.findIndex(x => x.id === sec.phrases[i].phrase), section: state.song.sections.indexOf(sec), instrument: state.cursor.instrument }); }
  else if (l === 'phrase') { if (!goLevel('pattern')) { state.message = 'No pattern under the cursor: a ▸ tag opens one'; after(); } }
}
function openRow(r) { state.phr = r.pi; state.section = r.block.si; }

// ---- Song level: the arrangement as rows × instruments ---------------------------------------------------
function songLines() {
  const m = songRows(state.song), lines = [];
  for (const b of m.blocks) { lines.push({ kind: 'bar', b }); for (const r of b.rows) lines.push({ kind: 'phrase', r, b }); }
  lines.push({ kind: 'add' });
  return { m, lines };
}
const code = name => { const w = name.trim().split(/\s+/); return (w.length > 1 ? w[0][0] + w[w.length - 1][0] : name.slice(0, 2)).padEnd(2, '·'); };
function cellText(phr, tr) {
  const m = phr.material[tr.id]; if (!m) return '··';
  const pl = (m.placements || [])[0], ptn = pl && patternById(state.song, pl.pattern);
  if (ptn) return code(ptn.name);
  return m.notes.length ? '≡≡' : '··';
}
function startOf(r) { const rs = renderSong(state.song); return rs.starts.findIndex(s => s.item === r.block.ai && s.slot === r.slotIndex && s.sectionRepeat === 0 && s.repeat === 0); }
function songHtml() {
  const song = state.song, { lines } = songLines(), p = pk().song, cols = song.instruments;
  const shown = colWindow(cols.length, p.col, 5);
  let h = `<div class="pkLine pkHead"><span class="pkName">${esc(song.title || 'Untitled')}</span>${shown.map(i => `<span class="pkCol${i === p.col ? ' cur' : ''}">${esc(cols[i].name.slice(0, 3))}</span>`).join('')}</div>`;
  lines.forEach((l, li) => {
    const cur = li === p.row;
    if (l.kind === 'bar') h += `<div class="pkLine pkBar${cur ? ' cur' : ''}${l.b.ai < 0 ? ' spare' : ''}" data-li="${li}"><span class="pkName">${esc(l.b.sec.name.toUpperCase())}</span><span class="pkRep">${l.b.ai >= 0 ? '×' + l.b.item.repeat : 'unused'}</span>${l.b.sec.key ? '<span class="pkKey">' + esc(keyName(l.b.sec.key)) + '</span>' : ''}</div>`;
    else if (l.kind === 'phrase') { const phr = song.phrases[l.r.pi]; h += `<div class="pkLine pkRow${cur ? ' cur' : ''}" data-li="${li}" data-ai="${l.b.ai}" data-slot="${l.r.slotIndex}"><span class="pkName">${esc(phr.name.slice(0, 5))}<i>${l.r.slot.repeat > 1 ? '×' + l.r.slot.repeat : ''}</i></span>${shown.map(i => `<span class="pkCell${cur && i === p.col ? ' cur' : ''}">${cellText(phr, cols[i])}</span>`).join('')}</div>`; }
    else h += `<div class="pkLine pkAdd${cur ? ' cur' : ''}" data-li="${li}">+ section</div>`;
  });
  return h;
}
// How many lines the body holds beyond a header of `less` lines.
function visibleRows(less) { const el = $('pkBody'); return Math.max(6, Math.floor((el ? el.clientHeight : 300) / 22) - less); }
function colWindow(n, cur, width) { if (n <= width) return [...Array(n).keys()]; const start = Math.max(0, Math.min(cur - 1, n - width)); return [...Array(width).keys()].map(i => start + i); }
function songInput(fire, held) {
  const p = pk().song, { lines } = songLines(), song = state.song, line = lines[p.row], n = song.instruments.length;
  const clampRow = () => { p.row = Math.max(0, Math.min(lines.length - 1, p.row)); };
  if (held.a) {
    if ((fire.up || fire.down) && line) { const d = fire.up ? 1 : -1; state.padUsed = true;
      if (line.kind === 'bar' && line.b.ai >= 0) withSongUndo(() => { const it = song.arrangement[line.b.ai]; it.repeat = Math.max(1, Math.min(64, it.repeat + d)); });
      else if (line.kind === 'phrase') withSongUndo(() => { const sl = sectionById(song, line.b.sec.id).phrases[line.r.slotIndex]; sl.repeat = Math.max(1, Math.min(64, sl.repeat + d)); });
      after(); return true; }
    if (fire.left || fire.right) { state.padUsed = true; p.col = Math.max(0, Math.min(n - 1, p.col + (fire.right ? 1 : -1))); after(); return true; }
    return true;
  }
  if (fire.up) { p.row--; clampRow(); after(); return true; }
  if (fire.down) { p.row++; clampRow(); after(); return true; }
  if (fire.left) { p.col = Math.max(0, p.col - 1); after(); return true; }
  if (fire.right) { p.col = Math.min(Math.max(0, n - 1), p.col + 1); after(); return true; }
  if (held.back && fire.up) { state.padUsed = true; for (let i = p.row - 1; i >= 0; i--) if (lines[i].kind === 'bar') { p.row = i; break; } after(); return true; }
  if (held.back && fire.down) { state.padUsed = true; for (let i = p.row + 1; i < lines.length; i++) if (lines[i].kind === 'bar') { p.row = i; break; } after(); return true; }
  if (fire.aUp && !state.padUsed && line) {
    if (line.kind === 'phrase') { openRow(line.r); goLevel('phrase', { phrase: line.r.pi, section: line.b.si, instrument: n ? p.col : null }); }
    else if (line.kind === 'bar') { state.section = line.b.si; state.phr = line.b.rows[0] ? line.b.rows[0].pi : state.phr; goLevel('section'); }
    else { let made; withSongUndo(() => { made = addSection(song, nextSectionName(song), curPhrase()); }); const m = songLines(); p.row = m.lines.findIndex(l => l.kind === 'bar' && l.b.ai === made.item); after(); }
    return true;
  }
  if (fire.bUp && !state.padUsed && line) {
    if (line.kind === 'bar') { let ok; withSongUndo(() => { ok = line.b.ai >= 0 ? removeItem(song, line.b.ai) : deleteSection(song, line.b.sec.id); }); if (!ok) state.message = 'The arrangement keeps at least one section'; }
    else if (line.kind === 'phrase') { let res; withSongUndo(() => { res = removeSlot(song, sectionById(song, line.b.sec.id), line.r.slotIndex); }); if (!res) state.message = 'A section keeps at least one phrase'; }
    clampRow(); after(); return true;
  }
  if (fire.start) {
    if (held.back) { state.padUsed = true; playSong(0); }
    else if (sched.playing) stopAll();
    else if (line && line.kind === 'phrase') { openRow(line.r); if (line.b.ai < 0) playSection(line.b.sec); else { const i = startOf(line.r); playSong(i >= 0 ? i : 0); } }
    else if (line && line.kind === 'bar' && line.b.rows[0]) { openRow(line.b.rows[0]); if (line.b.ai < 0) playSection(line.b.sec); else { const i = startOf(line.b.rows[0]); playSong(i >= 0 ? i : 0); } }
    else playSong(0);
    return true;
  }
  if (fire.backUp && !state.padUsed) { undo(); after(); return true; }
  return true;
}
function after() { sig = ''; state.dirty = true; }

// ---- Section level: its phrases ---------------------------------------------------------------------------
function sectionHtml() {
  const song = state.song, sec = curSection(), p = pk().sec; if (!sec) return '<div class="pkLine dim">no section</div>';
  const item = song.arrangement.find(it => it.section === sec.id);
  let h = `<div class="pkLine pkHead"><span class="pkName">${esc(sec.name.toUpperCase())}</span><span class="pkRep">${item ? '×' + item.repeat : 'unused'}</span><span class="pkKey">${esc(keyName(keyFor(song, null, sec)))}</span></div>`;
  sec.phrases.forEach((sl, i) => { const phr = song.phrases.find(x => x.id === sl.phrase); if (!phr) return; h += `<div class="pkLine pkRow${i === p.row ? ' cur' : ''}"><span class="pkName">${esc(phr.name.slice(0, 6))}</span><span class="pkRep">×${sl.repeat}</span><span class="dim">${phr.rows}r ${phraseMeter(phr).join('/')}</span></div>`; });
  h += `<div class="pkLine pkAdd${p.row === sec.phrases.length ? ' cur' : ''}">+ phrase</div>`;
  return h;
}
function sectionInput(fire, held) {
  const song = state.song, sec = curSection(), p = pk().sec; if (!sec) { goLevel('song'); return true; }
  const n = sec.phrases.length;
  if (held.a) {
    if ((fire.up || fire.down) && sec.phrases[p.row]) { state.padUsed = true; withSongUndo(() => { const sl = sec.phrases[p.row]; sl.repeat = Math.max(1, Math.min(64, sl.repeat + (fire.up ? 1 : -1))); }); after(); }
    return true;
  }
  if (fire.up) { p.row = Math.max(0, p.row - 1); after(); return true; }
  if (fire.down) { p.row = Math.min(n, p.row + 1); after(); return true; }
  if (held.back && (fire.left || fire.right)) { state.padUsed = true; const si = Math.max(0, Math.min(song.sections.length - 1, state.section + (fire.right ? 1 : -1))); state.section = si; const s2 = song.sections[si]; if (s2.phrases[0]) state.phr = song.phrases.findIndex(x => x.id === s2.phrases[0].phrase); p.row = 0; syncPhraseUI(); after(); return true; }
  if (fire.aUp && !state.padUsed) {
    if (sec.phrases[p.row]) goLevel('phrase', { phrase: song.phrases.findIndex(x => x.id === sec.phrases[p.row].phrase), section: song.sections.indexOf(sec), instrument: state.cursor.instrument });
    else { withSongUndo(() => { const like = curPhrase(); const phr = addPhrase(song, nextPhraseName(song, sec), like); addSlot(song, sec, phr.id); }); after(); }
    return true;
  }
  if (fire.bUp && !state.padUsed && sec.phrases[p.row]) { let res; withSongUndo(() => { res = removeSlot(song, sec, p.row); }); if (!res) state.message = 'A section keeps at least one phrase'; p.row = Math.min(p.row, sec.phrases.length); after(); return true; }
  if (fire.start) { if (sched.playing) stopAll(); else if (held.back) { state.padUsed = true; playSong(0); } else { if (sec.phrases[p.row]) state.phr = song.phrases.findIndex(x => x.id === sec.phrases[p.row].phrase); playSection(sec); } return true; }
  if (fire.backUp && !state.padUsed) { undo(); after(); return true; }
  return true;
}

// ---- Phrase and pattern levels: rows × instruments, note only --------------------------------------------
function gridHtml() {
  const song = state.song, phr = curPhrase(), ptn = curPattern(), trs = instrumentsShown(), c = state.cursor, rows = phr.rows;
  const shown = colWindow(trs.length, Math.max(0, c.instrument), 3);
  const key = keyName(keyFor(song, phr, curSection()));
  let h = `<div class="pkLine pkHead"><span class="pkName">${ptn ? 'PA ' + esc(ptn.name) : esc(phr.name)}</span><span class="dim">${phraseMeter(phr).join('/')} · ${esc(key)}</span></div>`;
  h += `<div class="pkLine pkCols"><span class="pkNum"></span>${shown.map(i => `<span class="pkCol${i === c.instrument ? ' cur' : ''}">${esc(trs[i].name.slice(0, 6))}</span>`).join('')}</div>`;
  const visible = visibleRows(2), top = Math.max(0, Math.min(c.row - Math.floor(visible / 2), rows - visible));
  const perTrack = shown.map(i => { const m = phr.material[trs[i].id] || { notes: [], placements: [] }; const notes = new Map(); for (const n of m.notes) if (n.col === 0 || n.col == null) notes.set(Math.floor(n.tick / phr.ticksPerRow), n); const pls = new Map(); for (const pl of (m.placements || [])) { const pt = patternById(song, pl.pattern); if (pt) pls.set(pl.row, { pl, pt, rows: pt.rows * (pl.repeat || 1) }); } return { notes, pls }; });
  for (let r = top; r < Math.min(rows, top + visible); r++) {
    h += `<div class="pkLine pkRow${r === c.row ? ' cur' : ''}${r % 4 === 0 ? ' beat' : ''}" data-row="${r}"><span class="pkNum">${String(r).padStart(2, '0')}</span>`;
    shown.forEach((i, k) => {
      const t = perTrack[k], pl = t.pls.get(r), cur = r === c.row && i === c.instrument;
      let inside = false; for (const [at, x] of t.pls) if (r > at && r < at + x.rows) inside = true;
      const n = t.notes.get(r);
      h += `<span class="pkCell${cur ? ' cur' : ''}${inside ? ' inside' : ''}">${pl ? '▸' + esc(placementLabel(pl.pl, pl.pt.name).slice(0, 7)) : n ? esc(noteName(n.pitch)) : '···'}</span>`;
    });
    h += '</div>';
  }
  return h;
}

// ---- Instrument level: one instrument as a list of values -----------------------------------------------
function valueText(tr, f) {
  switch (f) {
    case 'name': return tr.name; case 'sound': return (SOUND[tr.sound] || {}).name || tr.sound;
    case 'pan': return tr.pan === 64 ? 'C' : tr.pan < 64 ? 'L' + (64 - tr.pan) : 'R' + (tr.pan - 64);
    case 'mute': case 'solo': return tr[f] ? 'on' : 'off';
    case 'tune': case 'cents': return (tr[f] > 0 ? '+' : '') + tr[f]; case 'trim': return (tr.trim > 0 ? '+' : '') + tr.trim; case 'release': return '×' + tr.release;
    default: return String(tr[f]);
  }
}
function instrumentHtml() {
  const song = state.song, p = pk().inst, tr = song.instruments[p.i];
  if (!tr) return `<div class="pkLine pkHead"><span class="pkName">INSTRUMENTS</span><span class="dim">none yet</span></div><div class="pkLine pkAdd cur">+ instrument</div>`;
  let h = `<div class="pkLine pkHead"><span class="pkName">IN ${p.i + 1}/${song.instruments.length}</span><span class="dim">L R next</span></div>`;
  FIELDS.forEach(([f, label], i) => { h += `<div class="pkLine pkRow${i === p.row ? ' cur' : ''}"><span class="pkLabel">${label}</span><span class="pkVal${i === p.row ? ' cur' : ''}">${esc(valueText(tr, f))}</span></div>`; });
  h += `<div class="pkLine pkAdd${p.row === FIELDS.length ? ' cur' : ''}">+ instrument</div>`;
  return h;
}
function stepField(tr, f, d, big) {
  const S = INSTRUMENT_SETTINGS[f];
  if (f === 'volume') tr.volume = Math.max(0, Math.min(127, tr.volume + d * (big ? 10 : 1)));
  else if (f === 'pan') tr.pan = Math.max(0, Math.min(127, tr.pan + d * (big ? 10 : 1)));
  else if (f === 'channel') tr.channel = Math.max(1, Math.min(16, tr.channel + d));
  else if (f === 'columns') tr.columns = Math.max(1, Math.min(4, tr.columns + d));
  else if (f === 'mute' || f === 'solo') tr[f] = d > 0;
  else if (S) { const step = f === 'trim' ? (big ? 3 : 0.5) : f === 'release' ? (big ? 1 : 0.25) : (big ? 10 : 1); tr[f] = Math.round((tr[f] + d * step) * 100) / 100; instrumentDefaults(tr); }
  else if (f === 'sound') { const list = SOUNDS.filter(offered), i = list.findIndex(s => s.id === tr.sound), next = list[(i + d + list.length) % list.length]; if (next) setInstrumentSound(state.song, tr.id, next.id); preloadSamples(); }
}
function instrumentInput(fire, held) {
  const song = state.song, p = pk().inst, tr = song.instruments[p.i], n = song.instruments.length;
  if (!tr) { if (fire.aUp) openSounds('add'); else if (fire.backUp && !state.padUsed) { undo(); after(); } return true; }
  const [f] = FIELDS[p.row] || [];
  if (held.a) {
    if (f && (fire.up || fire.down || fire.left || fire.right)) { state.padUsed = true; withSongUndo(() => stepField(tr, f, fire.up || fire.right ? 1 : -1, fire.left || fire.right)); after(); }
    return true;
  }
  if (fire.up) { p.row = Math.max(0, p.row - 1); after(); return true; }
  if (fire.down) { p.row = Math.min(FIELDS.length, p.row + 1); after(); return true; }
  if (held.back && fire.left) { state.padUsed = true; p.i = Math.max(0, p.i - 1); state.cursor.instrument = p.i; after(); return true; }
  if (held.back && fire.right) { state.padUsed = true; p.i = Math.min(n - 1, p.i + 1); state.cursor.instrument = p.i; after(); return true; }
  if (fire.aUp && !state.padUsed) {
    if (held.back) { state.padUsed = true; let made; withSongUndo(() => { made = duplicateInstrument(song, tr.id); }); p.i = song.instruments.indexOf(made); }
    else if (p.row === FIELDS.length) openSounds('add');
    else if (f === 'sound') openSounds('set');
    else if (f === 'mute' || f === 'solo') withSongUndo(() => { tr[f] = !tr[f]; });
    else if (f === 'name') { const v = window.prompt('Instrument name', tr.name); if (v != null && v.trim()) withSongUndo(() => { tr.name = v.trim(); }); }
    after(); return true;
  }
  if (fire.bUp && !state.padUsed && f === 'name') { withSongUndo(() => removeInstrument(song, tr.id)); p.i = Math.max(0, Math.min(p.i, song.instruments.length - 1)); state.cursor.instrument = song.instruments.length ? p.i : -1; after(); return true; }
  if (fire.start) { if (sched.playing) stopAll(); else if (held.back) { state.padUsed = true; playSong(0); } else playPhrase(false); return true; }
  if (fire.backUp && !state.padUsed) { undo(); after(); return true; }
  return true;
}
// The sounds on offer, to add an instrument from or to give one another sound.
function openSounds(mode) { const p = pk(); const list = SOUNDS.filter(offered); const tr = state.song.instruments[p.inst.i]; p.sounds = { mode, row: Math.max(0, mode === 'set' && tr ? list.findIndex(s => s.id === tr.sound) : 0) }; after(); }
function soundsHtml() {
  const p = pk().sounds, list = SOUNDS.filter(offered);
  const visible = visibleRows(1), top = Math.max(0, Math.min(p.row - Math.floor(visible / 2), list.length - visible));
  let h = `<div class="pkLine pkHead"><span class="pkName">${p.mode === 'add' ? '+ INSTRUMENT' : 'SOUND'}</span><span class="dim">A picks · B back</span></div>`;
  list.slice(top, top + visible).forEach((s, k) => { const i = top + k; h += `<div class="pkLine pkRow${i === p.row ? ' cur' : ''}"><span class="pkName">${esc(s.name)}</span><span class="dim">${esc(s.bank)}</span></div>`; });
  return h;
}
function soundsInput(fire) {
  const p = pk(), s = p.sounds, list = SOUNDS.filter(offered);
  if (fire.up) { s.row = Math.max(0, s.row - 1); after(); return true; }
  if (fire.down) { s.row = Math.min(list.length - 1, s.row + 1); after(); return true; }
  if (fire.lb || fire.bUp) { p.sounds = null; after(); return true; }
  if (fire.aUp && list[s.row]) {
    const song = state.song, id = list[s.row].id;
    if (s.mode === 'add') { let made; withSongUndo(() => { made = addInstrument(song, id); }); p.inst.i = song.instruments.indexOf(made); p.inst.row = 1; state.cursor.instrument = p.inst.i; }
    else { const tr = song.instruments[p.inst.i]; if (tr) withSongUndo(() => setInstrumentSound(song, tr.id, id)); }
    preloadSamples(); p.sounds = null; after(); return true;
  }
  return true;
}

// ---- The menu: what a pocket needs of Files ----------------------------------------------------------------
function menuItems() { return [['full', 'Full view'], ['new', 'New song'], ['save', 'Save .json'], ['load', 'Load .json'], ...state.songs.map((s, i) => ['song:' + i, (i === state.songIndex ? '● ' : '  ') + (s.title || 'Untitled')])]; }
export function openMenu() { const p = pk(); if (!p) return; p.menu = { row: 0 }; p.sounds = null; after(); }
function menuHtml() { const p = pk().menu, items = menuItems(); return `<div class="pkLine pkHead"><span class="pkName">MENU</span><span class="dim">A picks · B back</span></div>` + items.map(([id, label], i) => `<div class="pkLine pkRow${i === p.row ? ' cur' : ''}${id.startsWith('song:') ? ' pkSong' : ''}"><span class="pkName">${esc(label)}</span></div>`).join(''); }
function menuInput(fire) {
  const p = pk(), m = p.menu, items = menuItems();
  if (fire.up) { m.row = Math.max(0, m.row - 1); after(); return true; }
  if (fire.down) { m.row = Math.min(items.length - 1, m.row + 1); after(); return true; }
  if (fire.bUp || fire.lb) { p.menu = null; after(); return true; }
  if (fire.aUp) { const [id] = items[m.row]; p.menu = null; menuAction(id); after(); return true; }
  return true;
}
function menuAction(id) {
  const song = state.song;
  if (id === 'full') setPocket(false);
  else if (id === 'new') { addSong(Object.assign(newSong(), { title: 'Untitled ' + (state.songs.length + 1) })); goLevel('instrument'); }
  else if (id === 'save') download((song.title || 'tutti').replace(/[^\w.-]+/g, '_') + '.json', new Blob([JSON.stringify(song, null, 1)], { type: 'application/json' }));
  else if (id === 'load') $('file').click();
  else if (id.startsWith('song:')) { selectSong(parseInt(id.slice(5), 10)); goLevel('song'); }
}

// ---- Input from the pad (through the controller scheme) --------------------------------------------------
// Called by pollGamepad with each frame's presses. Returns true when the level here consumed them; the phrase and
// pattern levels are the grid's, so the controller's own rules apply there.
export function pocketInput(fire, held) {
  if (!pk()) return false;
  const l = pocketLevel();
  if (fire.a || fire.b || fire.back) state.padUsed = false;
  if (l === 'menu') return menuInput(fire, held);
  if (l === 'sounds') return soundsInput(fire, held);
  // L goes out a level and R in, with nothing held; Back + L/R does the same, as on a controller
  if (fire.lb && !held.a && !held.b) { if (held.back) state.padUsed = true; pocketOut(); return true; }
  if (fire.rb && !held.a && !held.b) { if (held.back) state.padUsed = true; pocketIn(); return true; }
  if (l === 'song') return songInput(fire, held);
  if (l === 'section') return sectionInput(fire, held);
  if (l === 'instrument') return instrumentInput(fire, held);
  // phrase and pattern: the grid's rules, but left and right step between instruments (the first note column of each
  // is all that shows), and the view is kept on the cursor
  if ((fire.left || fire.right) && !held.a && !held.b) { cursorToInstrument(fire.right ? 1 : -1); state.cursor.cell = 0; after(); return true; }
  if (fire.up || fire.down || fire.aUp || fire.bUp || fire.lb || fire.rb || fire.backUp) after();
  return false;
}

// ---- Rendering ---------------------------------------------------------------------------------------------
export function renderPocket() {
  const p = pk(); if (!p) return;
  const song = state.song, l = pocketLevel();
  const next = [l, state.rev, state.songIndex, song.uid, state.phr, state.section, state.patternEdit && state.patternEdit.id, state.cursor.row, state.cursor.instrument, p.song.row, p.song.col, p.sec.row, p.inst.i, p.inst.row, p.menu && p.menu.row, p.sounds && p.sounds.row, state.message].join('~|~');
  if (next !== sig) {
    sig = next;
    $('pkLevels').innerHTML = LEVELS.map(([id, code, title]) => `<button data-lvl="${id}" class="${(l === 'sounds' ? 'instrument' : l) === id ? 'on' : ''}" title="${title}">${code}</button>`).join('');
    $('pkBody').innerHTML = l === 'menu' ? menuHtml() : l === 'sounds' ? soundsHtml() : l === 'song' ? songHtml() : l === 'section' ? sectionHtml() : l === 'instrument' ? instrumentHtml() : gridHtml();
    const cur = $('pkBody').querySelector('.pkLine.cur'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
    $('pkMsg').textContent = state.message || '';
    $('pkHint').innerHTML = HINTS[l] || '';
    lastPlay = '';
  }
  // the playhead, in the song's words and on the rows
  let now = '', playRow = -1, playAi = -1, playSlot = -1;
  const tick = sched.positionTick(), rendered = sched.rendered;
  if (tick != null && rendered) {
    if (rendered.pattern) { if (curPattern() && rendered.pattern === curPattern().id) playRow = rowAtTick(curPhrase(), tick); now = '▶ ' + curPattern().name; }
    else { const st = rendered.starts.find(s => tick >= s.tick && tick < s.tick + s.rows * s.ticksPerRow); if (st) { const sec = song.sections.find(x => x.id === st.section), ph = song.phrases[st.phrase]; now = '▶ ' + (sec ? sec.name + ' › ' : '') + (ph ? ph.name : '') + (st.repeat ? ' ' + (st.repeat + 1) : ''); playAi = st.item; playSlot = st.slot; if (st.phrase === state.phr) playRow = rowAtTick(song.phrases[st.phrase], tick - st.tick); } }
  }
  const play = now + '|' + playRow + '|' + playAi + '|' + playSlot;
  if (play !== lastPlay) {
    lastPlay = play; $('pkNow').textContent = now;
    for (const x of $('pkBody').querySelectorAll('.playing')) x.classList.remove('playing');
    if (l === 'phrase' || l === 'pattern') { const row = $('pkBody').querySelector(`.pkRow[data-row="${playRow}"]`); if (row) row.classList.add('playing'); }
    else if (l === 'song' && playAi >= 0) { const row = $('pkBody').querySelector(`.pkRow[data-ai="${playAi}"][data-slot="${playSlot}"]`); if (row) row.classList.add('playing'); }
  }
  const sounding = soundingNow(), live = JSON.stringify(sounding) + '|' + song.instruments.map(t => t.id).join();
  if (live !== lastLive) {
    lastLive = live;
    $('pkLive').innerHTML = song.instruments.map(t => { const n = sounding[t.id]; return `<span class="${n ? 'on' : ''}" style="--vel:${n ? Math.round(n.vel / 127 * 100) : 0}%"><b>${esc(t.name.slice(0, 3))}</b>${n ? esc(noteName(n.pitch)) : '···'}</span>`; }).join('');
  }
}

// ---- Wiring: the pad, the context line, the keyboard --------------------------------------------------------
const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', x: 'a', X: 'a', z: 'b', Z: 'b', Shift: 'back', Enter: 'start', a: 'lb', A: 'lb', s: 'rb', S: 'rb', q: 'lb', w: 'rb' };
export function wirePocket() {
  const root = $('pocket'); if (!root) return;
  state.padHeld = {}; state.padTaps = {};
  const pad = $('pkPad');
  const press = (btn, on) => { if (on) { state.padHeld[btn] = true; (state.padTaps || (state.padTaps = {}))[btn] = true; } else delete state.padHeld[btn]; const el = pad.querySelector(`[data-btn="${btn}"]`); if (el) el.classList.toggle('held', on); };
  pad.addEventListener('pointerdown', e => { const b = e.target.closest('[data-btn]'); if (!b) return; e.preventDefault(); b.setPointerCapture && b.setPointerCapture(e.pointerId); press(b.dataset.btn, true); });
  const release = e => { const b = e.target.closest('[data-btn]'); if (b) press(b.dataset.btn, false); };
  pad.addEventListener('pointerup', release); pad.addEventListener('pointercancel', release); pad.addEventListener('lostpointercapture', release);
  pad.addEventListener('contextmenu', e => e.preventDefault());
  $('pkLevels').addEventListener('click', e => { const b = e.target.closest('button[data-lvl]'); if (b) goLevel(b.dataset.lvl); });
  $('pkMenuBtn').addEventListener('click', () => { if (pk().menu) { pk().menu = null; after(); } else openMenu(); });
  root.addEventListener('keydown', e => {
    if (e.target.matches('input, select')) return;
    if (e.key === 'Escape') { e.preventDefault(); if (pk().menu || pk().sounds) { pk().menu = null; pk().sounds = null; after(); } else openMenu(); return; }
    const btn = KEYS[e.key]; if (!btn) return; e.preventDefault(); if (!e.repeat) press(btn, true);
  });
  root.addEventListener('keyup', e => { const btn = KEYS[e.key]; if (btn) press(btn, false); });
  window.addEventListener('blur', () => { state.padHeld = {}; for (const el of pad.querySelectorAll('.held')) el.classList.remove('held'); });
  const box = $('pocketToggle'); if (box) box.onchange = e => setPocket(e.target.checked);
  restorePocket();
}
