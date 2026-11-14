// Sequencer: the open phrase (or the open pattern) for one instrument, with a line per pitch and time running
// across. A drum kit has a line per sound of the kit; any other instrument has a line per note of the key, over its
// range. A second renderer over the same song, cursor and undo history as the tracker grid: the cursor's row is the
// tracker's row, the cursor's instrument is the tracker's instrument, and the line is a pitch. Notes are written
// through the core (toggleLineNote), so everything else in the app reads them as it reads any note.
// The view shows as many cells across as the screen holds, in whole beats or bars (pageRows), and pages the rest.
import { ART, FAMILIES, clamp } from '../core/constants.js';
import { SOUND, lineName, sequencerLines } from '../core/sounds.js';
import { inScale } from '../core/scales.js';
import { NOTE_COMMANDS, expandPlacements, noteCommandParts, noteCommands, placementAt, setNoteCommand } from '../core/song.js';
import { lineNoteAt, maxLength, noteCovering, pageRows, toggleLineNote } from '../core/edit.js';
import { $, activeKey, coarsePointer, curInstrument, curPattern, curPhrase, instrumentsShown, rowsPerBar, rowsPerBeat, state } from './state.js';
import { audition, withUndo } from './edit.js';
import { playPosition } from './transport.js';
import { esc } from './sync.js';

const MIN_CELL = 24, MIN_CELL_TOUCH = 34;   // narrowest cell, with its gap, in px
const STEP = { vel: 8, chance: 10, retrigger: 1, offset: 5 };
const FIELDS = ['vel', 'length', 'art', 'chance', 'retrigger', 'offset'];

const soundOf = tr => (tr && SOUND[tr.sound]) || null;
const isKit = tr => !!(soundOf(tr) && soundOf(tr).kit);
// The Sequencer is chosen (state.seq) and there is an instrument to show. In a song with no instruments the choice
// is kept and the tracker grid, with its way to add one, shows instead.
export const sequencerOn = () => !!state.seq && !!curInstrument();

let sig = '', curSig = '', lastPlay = null, shown = null, centre = '';   // shown: what the last build drew
export function setSequencer(on) {
  on = !!on;
  if (on) {
    if (!curInstrument()) { state.message = 'The Sequencer needs an instrument'; state.dirty = true; return false; }
    state.cursor.cell = 0; state.sel = null; state.selAnchor = null; state.selectMode = false; state.typing = null;
    if (!state.seq) state.seq = { pitch: null, all: false, len: 1 };
  } else state.seq = null;
  show();
  if (state.level !== 'song') (sequencerOn() ? $('sequencer') : $('grid')).focus({ preventScroll: true });
  return on;
}
export const toggleSequencer = () => setSequencer(!state.seq);
// Put the Sequencer, or the tracker grid, in the workspace.
let showing = null;
function show() {
  const on = sequencerOn(); if (on === showing) return;
  showing = on;
  if (on) document.body.dataset.seq = 'on'; else delete document.body.dataset.seq;
  $('sequencer').hidden = !on;
  sig = ''; curSig = ''; centre = ''; lastPlay = null; state.ensureVisible = true; state.dirty = true;
}

// ---- What the view shows ---------------------------------------------------------------------
const rowOf = (phr, tick) => Math.floor(tick / phr.ticksPerRow);
const lastRow = (phr, n) => rowOf(phr, n.tick + n.len - 1);
// The instrument under the cursor with its loose notes, the notes its placements produce, and the lines.
function context() {
  const tr = curInstrument(), ins = soundOf(tr); if (!ins) return null;
  const phr = curPhrase(), mat = phr.material[tr.id], key = activeKey();
  const loose = mat ? mat.notes : [];
  const placed = state.patternEdit ? [] : expandPlacements(state.song, phr, tr.id, 4, key).notes;
  const used = [...new Set(loose.concat(placed).map(n => n.pitch))];
  const lines = sequencerLines(ins, key, used, state.seq.all);
  if (lines.length && !lines.includes(state.seq.pitch)) {
    // a kit starts on its first line; any other instrument on the line nearest its notes, or the middle of its range
    const want = state.seq.pitch != null ? state.seq.pitch : used.length ? used.slice().sort((a, b) => a - b)[used.length >> 1] : (ins.range[0] + ins.range[1]) / 2;
    state.seq.pitch = ins.kit ? lines[0] : lines.reduce((best, p) => (Math.abs(p - want) < Math.abs(best - want) ? p : best), lines[0]);
  }
  return { tr, ins, phr, key, loose, placed, lines };
}
// The loose note under the cursor: it starts there, or is held across the cursor's row.
export function noteHere() {
  const tr = curInstrument(); if (!sequencerOn() || !tr) return null;
  return lineNoteAt(curPhrase(), tr.id, state.seq.pitch, state.cursor.row);
}
// Rows inside a placement belong to the pattern, as in the tracker grid: say so instead of editing.
function guardPlacement(row) {
  const tr = curInstrument(); if (!tr || state.patternEdit) return false;
  const p = placementAt(state.song, curPhrase(), tr.id, row); if (!p) return false;
  state.message = 'Inside pattern ' + p.pattern.name + ': Enter edits the pattern, Detach makes these notes loose';
  state.dirty = true;
  return true;
}
function moveTo(pitch, row) {
  const phr = curPhrase();
  state.cursor.row = clamp(row, 0, phr.rows - 1); if (pitch != null) state.seq.pitch = pitch;
  state.typing = null; state.message = ''; state.dirty = true;
}

// ---- Editing ---------------------------------------------------------------------------------
// Write a note on a line at a row, or remove the one sounding there. One undo step. A new note on a kit is one row
// long; on any other instrument it is as long as the last length set here.
export function seqToggle(pitch = state.seq.pitch, row = state.cursor.row) {
  const tr = curInstrument(); if (!sequencerOn() || !tr) return false;
  const phr = curPhrase();
  moveTo(pitch, row); row = state.cursor.row;
  if (guardPlacement(row)) return false;
  const there = lineNoteAt(phr, tr.id, pitch, row);
  if (!there && ![0, 1, 2, 3].some(c => !noteCovering(phr, tr.id, c, row))) { state.message = 'All four note columns are taken on this row'; return false; }
  withUndo(() => {
    const res = toggleLineNote(phr, tr.id, pitch, row, 4, isKit(tr) ? 1 : state.seq.len);
    if (res.added) {   // the note may need a note column the instrument (or the open pattern) does not have yet
      if (res.added.col >= tr.columns) tr.columns = res.added.col + 1;
      const ptn = curPattern(); if (ptn && ptn.columns <= res.added.col) ptn.columns = res.added.col + 1;
    }
  });
  if (!there) { audition(tr, pitch, null); state.lastPitch = pitch; }
  return true;
}
export function seqClear() {
  if (guardPlacement(state.cursor.row)) return false;
  return noteHere() ? seqToggle() : false;
}
// Change the velocity, length, articulation, chance, retrigger or offset of the note under the cursor by one step.
// One undo step; at the end of a range nothing changes and no step is added.
export function seqNudge(field, dir) {
  if (guardPlacement(state.cursor.row)) return false;
  const tr = curInstrument(), phr = curPhrase(), n = noteHere(); if (!n) return false;
  if (field === 'length') {
    const tpr = phr.ticksPerRow, to = clamp(n.len + dir * tpr, tpr, maxLength(phr, tr.id, n.col, n.tick));
    if (to === n.len) return false;
    withUndo(() => { n.len = to; });
    state.seq.len = Math.max(1, Math.round(to / tpr));            // the next new note takes this length
    return true;
  }
  if (field === 'art') {
    const arts = soundOf(tr).articulations; if (arts.length < 2) return false;
    const i = Math.max(0, arts.indexOf(n.art || arts[0])), to = arts[((i + dir) % arts.length + arts.length) % arts.length];
    withUndo(() => { n.art = to === arts[0] ? null : to; });
    audition(tr, n.pitch, n.art);
    return true;
  }
  if (!STEP[field]) return false;
  const was = field === 'vel' ? n.vel : noteCommands(n)[field];
  const to = field === 'vel' ? clamp(was + dir * STEP.vel, 1, 127) : clamp(was + dir * STEP[field], NOTE_COMMANDS[field][0], NOTE_COMMANDS[field][1]);
  if (to === was) return false;
  withUndo(() => { if (field === 'vel') n.vel = to; else setNoteCommand(n, field, to); });
  return true;
}
function movePage(d) {
  const per = shown ? shown.per : curPhrase().rows;
  moveTo(null, state.cursor.row + d * per);
}
function moveLine(d) {
  const lines = shown ? shown.lines : [], i = lines.indexOf(state.seq.pitch);
  if (lines.length) moveTo(lines[clamp(i + d, 0, lines.length - 1)], state.cursor.row);
}
function nextInstrument(d) {
  const n = instrumentsShown().length; if (n < 2) return;
  state.cursor.instrument = ((state.cursor.instrument + d) % n + n) % n; state.seq.pitch = null; state.seq.all = false; state.message = ''; state.dirty = true;
}

// ---- Keys ------------------------------------------------------------------------------------
// Called before the tracker's key handler while the Sequencer shows. Returns true when the key is used up; false
// hands it on (Space, Return, Esc, undo and the quick keys do what they do in the tracker).
export function seqKey(e) {
  const k = e.key, code = e.code, sh = e.shiftKey;
  if (e.ctrlKey || e.metaKey) return ['a', 'c', 'x', 'v', 'd'].includes(k.toLowerCase());   // selection and clipboard belong to the tracker grid: not here
  if (code === 'Minus' || k === '-' || k === '_') return seqNudge('vel', -1), true;
  if (code === 'Equal' || k === '=' || k === '+') return seqNudge('vel', 1), true;
  if (code === 'BracketLeft' || k === '[' || k === '{') return seqNudge('length', -1), true;      // as in the tracker grid
  if (code === 'BracketRight' || k === ']' || k === '}') return seqNudge('length', 1), true;
  if (code === 'Semicolon' || k === ';' || k === ':') return seqNudge('retrigger', -1), true;
  if (code === 'Quote' || k === "'" || k === '"') return seqNudge('retrigger', 1), true;
  if (code === 'Comma' || k === ',' || k === '<') return seqNudge(sh || k === '<' ? 'chance' : 'offset', -1), true;
  if (code === 'Period' || k === '.' || k === '>') return seqNudge(sh || k === '>' ? 'chance' : 'offset', 1), true;
  const rows = curPhrase().rows;
  switch (k) {
    case 'ArrowLeft': moveTo(null, (state.cursor.row - 1 + rows) % rows); return true;
    case 'ArrowRight': moveTo(null, (state.cursor.row + 1) % rows); return true;
    case 'ArrowUp': moveLine(-1); return true;
    case 'ArrowDown': moveLine(1); return true;
    case 'PageUp': movePage(-1); return true;
    case 'PageDown': movePage(1); return true;
    case 'Home': moveTo(null, 0); return true;
    case 'End': moveTo(null, rows - 1); return true;
    case 'Tab': nextInstrument(sh ? -1 : 1); return true;
    case 'Delete': case 'Backspace': seqClear(); return true;
    case ' ': case 'Enter': case 'Escape': case '?': return false;
  }
  if (k.toLowerCase() === 'x') { seqToggle(); return true; }
  if (k.toLowerCase() === 'a') { seqNudge('art', sh ? -1 : 1); return true; }
  if (code === 'Slash' && sh) return false;
  return k.length === 1;   // any other character would type a note into a grid that is not on screen
}

// ---- Rendering -------------------------------------------------------------------------------
const rowsText = n => n + (n === 1 ? ' row' : ' rows');
const lenRows = (phr, n) => Math.max(1, Math.round(n.len / phr.ticksPerRow));
// What a cell is called: the line, the row and, where a note starts, the note in full.
function cellName(cx, line, row, n, start, pattern) {
  const parts = [line, 'row ' + row];
  if (n && !start) parts.push('held from row ' + rowOf(cx.phr, n.tick));
  else if (n) {
    parts.push('vel ' + n.vel);
    if (lenRows(cx.phr, n) > 1) parts.push(rowsText(lenRows(cx.phr, n)));
    if (n.art && n.art !== cx.ins.articulations[0]) parts.push(ART[n.art] || n.art);
    parts.push(...noteCommandParts(n));
  }
  if (n && pattern) parts.push('in pattern ' + pattern);
  return parts.join(', ');
}
function valueText(cx, field, n) {
  if (!n) return field === 'art' ? 'articulation' : field;
  const c = noteCommands(n);
  if (field === 'vel') return 'vel ' + n.vel;
  if (field === 'length') return 'length ' + rowsText(lenRows(cx.phr, n));
  if (field === 'art') return ART[n.art || cx.ins.articulations[0]] || n.art || cx.ins.articulations[0];
  if (field === 'chance') return 'chance ' + c.chance + '%';
  if (field === 'retrigger') return 'retrigger ×' + c.retrigger;
  return 'offset ' + (c.offset > 0 ? '+' : c.offset < 0 ? '−' : '') + Math.abs(c.offset) + '%';
}
const digest = notes => notes.map(n => n.tick + ':' + n.len + ':' + n.pitch + ':' + n.vel + ':' + (n.art || '') + ':' + (n.chance == null ? '' : n.chance) + ':' + (n.retrigger || '') + ':' + (n.offset || '')).join(' ');

export function syncSequencer() {
  const btn = $('seqBtn');
  show();
  if (btn) { btn.disabled = !curInstrument(); btn.classList.toggle('on', sequencerOn()); btn.setAttribute('aria-pressed', sequencerOn() ? 'true' : 'false'); }
  if (!sequencerOn()) return;
  const root = $('sequencer'), box = $('sqLines');
  if (state.level === 'song' || !box.clientWidth) return;                          // the Song view or a phone panel is up
  const cx = context(); if (!cx) return;
  const { tr, ins, phr, key, loose, placed, lines } = cx, shownIns = instrumentsShown();
  state.cursor.row = clamp(state.cursor.row, 0, phr.rows - 1);

  // How many cells fit across, and so which rows are on the page.
  const narrow = box.clientWidth < 520, label = narrow ? 72 : 112;
  const pad = parseFloat(getComputedStyle(box).paddingLeft) + parseFloat(getComputedStyle(box).paddingRight);
  const fit = Math.max(1, Math.floor((box.clientWidth - pad - label) / (coarsePointer() ? MIN_CELL_TOUCH : MIN_CELL)));
  const per = pageRows(phr, fit), pages = Math.ceil(phr.rows / per);
  const { row: playRow, phr: playPhr } = playPosition();
  const playing = playRow != null && playPhr === state.phr ? playRow : null;
  const page = Math.floor((playing != null && state.follow ? playing : state.cursor.row) / per);
  const r0 = page * per, r1 = Math.min(phr.rows, r0 + per);
  const covered = []; if (!state.patternEdit) for (let r = r0; r < r1; r++) covered[r] = placementAt(state.song, phr, tr.id, r);

  const next = [state.songIndex, state.phr, state.patternEdit ? state.patternEdit.id : '', tr.id, tr.name, tr.sound, !!ins.kit, phr.rows, phr.ticksPerRow, rowsPerBar(), rowsPerBeat(), per, page, label,
    state.seq.all, key ? key.root + key.scale : '', lines.join(), shownIns.map(t => t.name).join('|'), digest(loose), digest(placed), covered.map(c => (c ? c.pattern.id : '')).join()].join('~');
  const rebuilt = next !== sig;
  if (rebuilt) {
    sig = next; lastPlay = null; shown = { per, page, lines };
    root.style.setProperty('--sqCols', r1 - r0); root.style.setProperty('--sqLabel', label + 'px');
    root.style.setProperty('--sqHit', (FAMILIES[ins.family] || FAMILIES.drums).color);
    // bar: the instrument, the switch for more lines, the pager
    const sel = $('sqInst');
    sel.innerHTML = shownIns.map((t, i) => '<option value="' + i + '">' + esc(t.name) + '</option>').join('');
    sel.value = String(state.cursor.instrument); sel.hidden = shownIns.length < 2;
    $('sqName').textContent = tr.name + (state.patternEdit ? ' · pattern ' + ((curPattern() || {}).name || '') : ''); $('sqName').hidden = shownIns.length >= 2 && !state.patternEdit;
    const all = $('sqAll'), every = sequencerLines(ins, key, [], true).length, fewer = sequencerLines(ins, key, [], false).length;
    all.hidden = ins.kit ? every <= 12 : every === fewer;
    all.textContent = ins.kit ? (state.seq.all ? 'fewer' : 'all ' + every) : (state.seq.all ? 'in key' : 'all notes');
    all.title = ins.kit ? (state.seq.all ? 'Show the sounds in use and the usual ones' : 'Show every sound of the kit') : (state.seq.all ? 'Show the notes of the key, and any others in use' : 'Show every semitone of the range');
    $('sqPager').hidden = pages < 2;
    $('sqPage').textContent = (r0 + 1) + '–' + r1 + ' / ' + phr.rows;
    $('sqPrev').disabled = page <= 0; $('sqNext').disabled = page >= pages - 1;
    // lines: where each note starts and the cells it is held across
    const bar = rowsPerBar(), beat = rowsPerBeat(), at = new Map();
    const lay = (notes, mine) => { for (const n of notes) { const s = rowOf(phr, n.tick), e = lastRow(phr, n); for (let r = Math.max(s, r0); r <= Math.min(e, r1 - 1); r++) at.set(n.pitch + ':' + r, { n, mine, start: r === s }); } };
    lay(placed, false); lay(loose, true);
    let html = '<div class="sqLine sqRuler" aria-hidden="true"><span></span>';
    for (let r = r0; r < r1; r++) html += '<span' + (r % bar === 0 ? ' class="bar"' : '') + '>' + (r % beat === 0 ? r : '') + '</span>';
    html += '</div>';
    for (const pitch of lines) {
      const name = lineName(ins, pitch), labelCls = ['sqLabel'];
      if (!ins.kit && key && ((pitch - key.root) % 12 + 12) % 12 === 0) labelCls.push('tonic');
      if (!ins.kit && !inScale(key, pitch)) labelCls.push('out');
      html += '<div class="sqLine" role="row" data-line="' + pitch + '"><button class="' + labelCls.join(' ') + '" data-label="' + pitch + '" title="' + esc(name) + ': sound it">' + esc(name) + '</button>';
      for (let r = r0; r < r1; r++) {
        const hit = at.get(pitch + ':' + r), n = hit && hit.n, c = n ? noteCommands(n) : null;
        const cls = ['sqCell'];
        if (Math.floor(r / beat) % 2) cls.push('alt');
        if (r % bar === 0) cls.push('bar');
        if (covered[r]) cls.push('covered');
        if (n) {
          cls.push('on'); if (!hit.mine) cls.push('placed'); if (!hit.start) cls.push('held');
          if (c.chance < 100) cls.push('maybe');
          if (hit.start && c.offset < 0) cls.push('early'); if (hit.start && c.offset > 0) cls.push('late');
        }
        html += '<button class="' + cls.join(' ') + '" data-pitch="' + pitch + '" data-row="' + r + '"' + (n ? ' style="--v:' + (n.vel / 127).toFixed(2) + '"' : '') +
          ' aria-label="' + esc(cellName(cx, name, r, n, hit && hit.start, n && !hit.mine && covered[r] ? covered[r].pattern.name : '')) + '"' + (n ? ' aria-pressed="true"' : '') + '>' + (n && hit.start && c.retrigger > 1 ? '<i>' + c.retrigger + '</i>' : '') + '</button>';
      }
      html += '</div>';
    }
    box.innerHTML = html;
  }
  // the cursor and the strip under the grid: cheap, so a cursor move does not rebuild the lines
  const cur = state.seq.pitch + ':' + state.cursor.row;
  if (rebuilt || cur !== curSig) {
    curSig = cur;
    for (const el of box.querySelectorAll('.cur')) el.classList.remove('cur');
    const line = box.querySelector('.sqLine[data-line="' + state.seq.pitch + '"]');
    if (line) {
      line.querySelector('.sqLabel').classList.add('cur');
      const cell = line.querySelector('.sqCell[data-row="' + state.cursor.row + '"]'); if (cell) cell.classList.add('cur');
      // keep the cursor's line in view: centred when the instrument or phrase changes, else just visible
      const where = [state.songIndex, state.phr, state.patternEdit ? state.patternEdit.id : '', tr.id].join('~');
      if (where !== centre) { centre = where; box.scrollTop = Math.max(0, line.offsetTop - (box.clientHeight - line.offsetHeight) / 2); }
      else {
        const top = line.offsetTop, ruler = 18;
        if (top - ruler < box.scrollTop) box.scrollTop = Math.max(0, top - ruler);
        else if (top + line.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top + line.offsetHeight - box.clientHeight + 4;
      }
    }
    // the note under the cursor, loose (its values change here) or placed (they are the pattern's)
    const mine = lineNoteAt(phr, tr.id, state.seq.pitch, state.cursor.row);
    const n = mine || placed.find(x => x.pitch === state.seq.pitch && rowOf(phr, x.tick) <= state.cursor.row && lastRow(phr, x) >= state.cursor.row) || null;
    $('sqWhat').textContent = lineName(ins, state.seq.pitch) + ' · row ' + state.cursor.row;
    for (const f of FIELDS) {
      const el = root.querySelector('.sqVal[data-field="' + f + '"]');
      if (f === 'art') el.hidden = ins.articulations.length < 2;
      el.querySelector('output').textContent = valueText(cx, f, n);
      el.classList.toggle('off', !n);
      for (const b of el.querySelectorAll('button')) b.disabled = !mine;
    }
  }
  // playhead: the cells of the playing row, on the page that holds it
  if (playing !== lastPlay) {
    for (const el of box.querySelectorAll('.play')) el.classList.remove('play');
    if (playing != null) for (const el of box.querySelectorAll('.sqCell[data-row="' + playing + '"]')) el.classList.add('play');
    lastPlay = playing;
  }
}

// The cursor's line and row, and what is there, for the status line.
export function seqStatus() {
  const cx = sequencerOn() ? context() : null; if (!cx) return '';
  const { tr, ins, phr } = cx, n = noteHere();
  let s = '<b>' + esc(tr.name) + '</b> ' + esc(lineName(ins, state.seq.pitch)) + ' row ' + state.cursor.row;
  if (n) s += ' vel ' + n.vel + ' len ' + rowsText(lenRows(phr, n)) + ' ' + (n.art || ins.articulations[0]) + (noteCommandParts(n).length ? ' ' + noteCommandParts(n).join(' ') : '');
  return s + ' | ' + phr.rows + ' rows';
}

export function wireSequencer() {
  const root = $('sequencer'), box = $('sqLines'); if (!root) return;
  const btn = $('seqBtn');
  btn.onclick = () => toggleSequencer();
  // On a phone the transport bar is full, so the button sits with the tools in the top bar.
  const home = btn.parentNode, tools = document.querySelector('#topbar .tools'), mq = window.matchMedia('(max-width: 760px)');
  const place = () => { if (mq.matches && tools) tools.prepend(btn); else home.append(btn); };
  if (mq.addEventListener) mq.addEventListener('change', place);
  place();
  $('sqInst').onchange = e => { state.cursor.instrument = parseInt(e.target.value, 10); state.seq.pitch = null; state.seq.all = false; state.dirty = true; };
  $('sqAll').onclick = () => { state.seq.all = !state.seq.all; centre = ''; state.dirty = true; };
  $('sqPrev').onclick = () => movePage(-1);
  $('sqNext').onclick = () => movePage(1);
  // A tap writes or removes; a long press, or a click with Shift, only moves the cursor there.
  let held = null, quiet = false;
  box.addEventListener('pointerdown', e => {
    const cell = e.target.closest('.sqCell'); quiet = false; clearTimeout(held); if (!cell) return;
    held = setTimeout(() => { quiet = true; moveTo(+cell.dataset.pitch, +cell.dataset.row); if (navigator.vibrate) navigator.vibrate(15); }, 500);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) box.addEventListener(ev, () => clearTimeout(held));
  box.addEventListener('pointermove', e => { if (Math.abs(e.movementX) + Math.abs(e.movementY) > 6) clearTimeout(held); });
  box.addEventListener('scroll', () => clearTimeout(held), { passive: true });
  box.addEventListener('contextmenu', e => { if (e.target.closest('.sqCell')) e.preventDefault(); });
  box.addEventListener('click', e => {
    const lab = e.target.closest('.sqLabel');
    if (lab) { moveTo(+lab.dataset.label, state.cursor.row); audition(curInstrument(), +lab.dataset.label, null); return; }
    const cell = e.target.closest('.sqCell'); if (!cell) return;
    const pitch = +cell.dataset.pitch, row = +cell.dataset.row;
    if (quiet || e.shiftKey) { quiet = false; moveTo(pitch, row); return; }
    seqToggle(pitch, row);
  });
  $('sqStrip').addEventListener('click', e => {
    const b = e.target.closest('button[data-d]'); if (!b || b.disabled) return;
    seqNudge(b.closest('.sqVal').dataset.field, +b.dataset.d);
  });
  if (window.ResizeObserver) new ResizeObserver(() => { state.dirty = true; }).observe(box);
}
