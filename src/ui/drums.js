// Drum grid: the open phrase (or the open pattern) for one kit instrument, with a line per kit sound and time
// running across. A second renderer over the same song, cursor and undo history as the tracker grid: the cursor's
// row is the tracker's row, the cursor's instrument is the kit, and the line is a pitch of the kit. Hits are plain
// notes written through the core (toggleHit), so everything else in the app reads them as it reads any note.
// The view shows as many cells across as the screen holds, in whole beats or bars (pageRows), and pages the rest.
import { FAMILIES, clamp } from '../core/constants.js';
import { SOUND, kitLines } from '../core/sounds.js';
import { NOTE_COMMANDS, expandPlacements, noteCommandParts, noteCommands, placementAt, setNoteCommand } from '../core/song.js';
import { hitAt, noteCovering, pageRows, toggleHit } from '../core/edit.js';
import { $, activeKey, coarsePointer, curInstrument, curPattern, curPhrase, instrumentsShown, rowsPerBar, rowsPerBeat, state } from './state.js';
import { audition, withUndo } from './edit.js';
import { playPosition } from './transport.js';
import { esc } from './sync.js';

const MIN_CELL = 24, MIN_CELL_TOUCH = 34;   // narrowest cell, with its gap, in px
const STEP = { vel: 8, chance: 10, retrigger: 1, offset: 5 };
const FIELDS = ['vel', 'chance', 'retrigger', 'offset'];

const isKit = tr => !!(tr && SOUND[tr.sound] && SOUND[tr.sound].kit);
// Indices, among the instruments shown at this level, of the ones made from a kit.
export const kitInstruments = () => instrumentsShown().map((tr, i) => (isKit(tr) ? i : -1)).filter(i => i >= 0);
// The Drum grid is chosen (state.drums) and has a kit to show. In a song with no kit, or while a kit's bank is still
// loading, the choice is kept and the tracker grid shows until a kit is there.
export const drumsOn = () => !!(state.drums && state.drums.live);

let sig = '', lastPlay = null, shown = null;   // shown: what the last build drew ({ per, page, lines })
export function setDrums(on) {
  on = !!on;
  if (on) {
    const kits = kitInstruments();
    if (!kits.length) { state.message = 'The Drum grid needs an instrument made from a drum kit'; state.dirty = true; return false; }
    if (!kits.includes(state.cursor.instrument)) state.cursor.instrument = kits[0];
    state.cursor.cell = 0; state.sel = null; state.selAnchor = null; state.selectMode = false; state.typing = null;
    if (!state.drums) state.drums = { pitch: null, all: false, live: true };
  } else state.drums = null;
  show(on);
  if (state.level !== 'song') (on ? $('drumGrid') : $('grid')).focus({ preventScroll: true });
  return on;
}
// Put the Drum grid, or the tracker grid, in the workspace.
function show(live) {
  if (state.drums) state.drums.live = live;
  if (live) document.body.dataset.drums = 'on'; else delete document.body.dataset.drums;
  $('drumGrid').hidden = !live;
  sig = ''; lastPlay = null; state.ensureVisible = true; state.dirty = true;
}
export const toggleDrums = () => setDrums(!drumsOn());

// ---- What the grid shows ---------------------------------------------------------------------
// The kit instrument under the cursor with its loose notes, the notes its placements produce, and the lines.
function context() {
  const tr = curInstrument(); if (!isKit(tr)) return null;
  const phr = curPhrase(), ins = SOUND[tr.sound], mat = phr.material[tr.id];
  const loose = mat ? mat.notes : [];
  const placed = state.patternEdit ? [] : expandPlacements(state.song, phr, tr.id, 4, activeKey()).notes;
  const lines = kitLines(ins, [...new Set(loose.concat(placed).map(n => n.pitch))], state.drums.all);
  if (!lines.includes(state.drums.pitch)) state.drums.pitch = lines[0];
  return { tr, ins, phr, loose, placed, lines };
}
const rowOf = (phr, n) => Math.floor(n.tick / phr.ticksPerRow);
// The loose hit under the cursor, if any.
export function hitHere() {
  const tr = curInstrument(); if (!drumsOn() || !isKit(tr)) return null;
  return hitAt(curPhrase(), tr.id, state.drums.pitch, state.cursor.row);
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
  state.cursor.row = clamp(row, 0, phr.rows - 1); if (pitch != null) state.drums.pitch = pitch;
  state.typing = null; state.message = ''; state.dirty = true;
}

// ---- Editing ---------------------------------------------------------------------------------
// Write a hit on a line at a row, or remove the one there. One undo step.
export function drumToggle(pitch = state.drums.pitch, row = state.cursor.row) {
  const tr = curInstrument(); if (!drumsOn() || !isKit(tr)) return false;
  const phr = curPhrase();
  moveTo(pitch, row); row = state.cursor.row;
  if (guardPlacement(row)) return false;
  const there = hitAt(phr, tr.id, pitch, row);
  if (!there && ![0, 1, 2, 3].some(c => !noteCovering(phr, tr.id, c, row))) { state.message = 'All four note columns are taken on this row'; return false; }
  withUndo(() => {
    const res = toggleHit(phr, tr.id, pitch, row, 4);
    if (res.added) {   // the hit may need a note column the instrument (or the open pattern) does not have yet
      if (res.added.col >= tr.columns) tr.columns = res.added.col + 1;
      const ptn = curPattern(); if (ptn && ptn.columns <= res.added.col) ptn.columns = res.added.col + 1;
    }
  });
  if (!there) audition(tr, pitch, null);
  return true;
}
export function drumClear() {
  if (guardPlacement(state.cursor.row)) return false;
  return hitHere() ? drumToggle() : false;
}
// Change the velocity, chance, retrigger or offset of the hit under the cursor by one step. One undo step.
export function drumNudge(field, dir) {
  if (guardPlacement(state.cursor.row)) return false;
  const hit = hitHere(); if (!hit || !STEP[field]) return false;
  const was = field === 'vel' ? hit.vel : noteCommands(hit)[field];
  const to = field === 'vel' ? clamp(was + dir * STEP.vel, 1, 127) : clamp(was + dir * STEP[field], NOTE_COMMANDS[field][0], NOTE_COMMANDS[field][1]);
  if (to === was) return false;                                  // already at the end of its range: no undo step
  withUndo(() => { if (field === 'vel') hit.vel = to; else setNoteCommand(hit, field, to); });
  return true;
}
function movePage(d) {
  const per = shown ? shown.per : curPhrase().rows;
  moveTo(null, state.cursor.row + d * per);
}
function moveLine(d) {
  const lines = shown ? shown.lines : [], i = lines.indexOf(state.drums.pitch);
  if (lines.length) moveTo(lines[clamp(i + d, 0, lines.length - 1)], state.cursor.row);
}
function nextKit(d) {
  const kits = kitInstruments(), i = kits.indexOf(state.cursor.instrument);
  if (kits.length < 2) return;
  state.cursor.instrument = kits[((i + d) % kits.length + kits.length) % kits.length]; state.drums.pitch = null; state.message = ''; state.dirty = true;
}

// ---- Keys ------------------------------------------------------------------------------------
// Called before the tracker's key handler while the Drum grid shows. Returns true when the key is used up; false
// hands it on (Space, Return, Esc, undo and the quick keys do what they do in the tracker).
export function drumKey(e) {
  const k = e.key, code = e.code, sh = e.shiftKey;
  if (e.ctrlKey || e.metaKey) {
    const lower = k.toLowerCase();
    return ['a', 'c', 'x', 'v', 'd'].includes(lower);   // selection and clipboard belong to the tracker grid: not here
  }
  if (code === 'Minus' || k === '-' || k === '_') return drumNudge('vel', -1), true;
  if (code === 'Equal' || k === '=' || k === '+') return drumNudge('vel', 1), true;
  if (code === 'BracketLeft' || k === '[' || k === '{') return drumNudge('retrigger', -1), true;
  if (code === 'BracketRight' || k === ']' || k === '}') return drumNudge('retrigger', 1), true;
  if (code === 'Comma' || k === ',' || k === '<') return drumNudge(sh || k === '<' ? 'chance' : 'offset', -1), true;
  if (code === 'Period' || k === '.' || k === '>') return drumNudge(sh || k === '>' ? 'chance' : 'offset', 1), true;
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
    case 'Tab': nextKit(sh ? -1 : 1); return true;
    case 'Delete': case 'Backspace': drumClear(); return true;
    case ' ': case 'Enter': case 'Escape': case '?': return false;
  }
  if (k.toLowerCase() === 'x') { drumToggle(); return true; }
  if (code === 'Slash' && sh) return false;
  return k.length === 1;   // any other character would type a note into a grid that is not on screen
}

// ---- Rendering -------------------------------------------------------------------------------
const hitName = (line, row, n, pattern) => [line, 'row ' + row].concat(n ? ['vel ' + n.vel, ...noteCommandParts(n)] : [], pattern ? ['in pattern ' + pattern] : []).join(', ');
const valueText = (field, n) => {
  if (!n) return field;
  const c = noteCommands(n);
  if (field === 'vel') return 'vel ' + n.vel;
  if (field === 'chance') return 'chance ' + c.chance + '%';
  if (field === 'retrigger') return 'retrigger ×' + c.retrigger;
  return 'offset ' + (c.offset > 0 ? '+' : c.offset < 0 ? '−' : '') + Math.abs(c.offset) + '%';
};
const digest = notes => notes.map(n => n.tick + ':' + n.pitch + ':' + n.vel + ':' + (n.chance == null ? '' : n.chance) + ':' + (n.retrigger || '') + ':' + (n.offset || '')).join(' ');

export function syncDrums() {
  const btn = $('drumsBtn'), kits = kitInstruments();
  if (state.drums && state.drums.live !== kits.length > 0) show(kits.length > 0);   // the last kit left, or a kit's bank arrived
  if (btn) { btn.disabled = !kits.length; btn.classList.toggle('on', drumsOn()); btn.setAttribute('aria-pressed', drumsOn() ? 'true' : 'false'); }
  if (!drumsOn()) return;
  if (!kits.includes(state.cursor.instrument)) { state.cursor.instrument = kits[0]; state.drums.pitch = null; }
  const root = $('drumGrid'), box = $('dgLines');
  if (state.level === 'song' || !box.clientWidth) return;                          // the Song view or a phone panel is up
  const cx = context(); if (!cx) return;
  const { tr, ins, phr, loose, placed, lines } = cx;
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

  const next = [state.songIndex, state.phr, state.patternEdit ? state.patternEdit.id : '', tr.id, tr.name, tr.sound, phr.rows, phr.ticksPerRow, rowsPerBar(), rowsPerBeat(), per, page, label,
    state.cursor.row, state.drums.pitch, state.drums.all, lines.join(), kits.map(i => instrumentsShown()[i].name).join('|'), digest(loose), digest(placed), covered.map(c => (c ? c.pattern.id : '')).join()].join('~');
  if (next !== sig) {
    sig = next; lastPlay = null; shown = { per, page, lines };
    root.style.setProperty('--dgCols', r1 - r0); root.style.setProperty('--dgLabel', label + 'px');
    root.style.setProperty('--dgHit', (FAMILIES[ins.family] || FAMILIES.drums).color);
    // bar: the instrument, the large-kit switch, the pager
    const sel = $('dgInst');
    sel.innerHTML = kits.map(i => '<option value="' + i + '">' + esc(instrumentsShown()[i].name) + '</option>').join('');
    sel.value = String(state.cursor.instrument); sel.hidden = kits.length < 2;
    $('dgName').textContent = tr.name + (state.patternEdit ? ' · pattern ' + ((curPattern() || {}).name || '') : ''); $('dgName').hidden = kits.length >= 2 && !state.patternEdit;
    const total = Object.keys(ins.kit).length, all = $('dgAll');
    all.hidden = total <= 12; all.textContent = state.drums.all ? 'fewer' : 'all ' + total;
    all.title = state.drums.all ? 'Show the sounds in use and the usual ones' : 'Show every sound of the kit';
    $('dgPager').hidden = pages < 2;
    $('dgPage').textContent = (r0 + 1) + '–' + r1 + ' / ' + phr.rows;
    $('dgPrev').disabled = page <= 0; $('dgNext').disabled = page >= pages - 1;
    // lines
    const bar = rowsPerBar(), beat = rowsPerBeat();
    const at = notes => { const m = new Map(); for (const n of notes) { const r = rowOf(phr, n); if (r >= r0 && r < r1) m.set(n.pitch + ':' + r, n); } return m; };
    const looseAt = at(loose), placedAt = at(placed);
    let html = '<div class="dgLine dgRuler" aria-hidden="true"><span></span>';
    for (let r = r0; r < r1; r++) html += '<span' + (r % bar === 0 ? ' class="bar"' : '') + '>' + (r % beat === 0 ? r : '') + '</span>';
    html += '</div>';
    for (const pitch of lines) {
      const name = ins.kit[pitch], curLine = pitch === state.drums.pitch;
      html += '<div class="dgLine" role="row"><button class="dgLabel' + (curLine ? ' cur' : '') + '" data-label="' + pitch + '" title="' + esc(name) + ': sound it">' + esc(name) + '</button>';
      for (let r = r0; r < r1; r++) {
        const mine = looseAt.get(pitch + ':' + r), n = mine || placedAt.get(pitch + ':' + r), c = n ? noteCommands(n) : null;
        const cls = ['dgCell'];
        if (Math.floor(r / beat) % 2) cls.push('alt');
        if (r % bar === 0) cls.push('bar');
        if (covered[r]) cls.push('covered');
        if (n) { cls.push('on'); if (!mine) cls.push('placed'); if (c.chance < 100) cls.push('maybe'); if (c.offset < 0) cls.push('early'); if (c.offset > 0) cls.push('late'); }
        if (curLine && r === state.cursor.row) cls.push('cur');
        html += '<button class="' + cls.join(' ') + '" data-pitch="' + pitch + '" data-row="' + r + '"' + (n ? ' style="--v:' + (n.vel / 127).toFixed(2) + '"' : '') +
          ' aria-label="' + esc(hitName(name, r, n, n && !mine && covered[r] ? covered[r].pattern.name : '')) + '"' + (n ? ' aria-pressed="true"' : '') + '>' + (n && c.retrigger > 1 ? '<i>' + c.retrigger + '</i>' : '') + '</button>';
      }
      html += '</div>';
    }
    box.innerHTML = html;
    // hit strip: the hit under the cursor, loose (its values change here) or placed (they are the pattern's)
    const key = state.drums.pitch + ':' + state.cursor.row, mine = looseAt.get(key), n = mine || placedAt.get(key);
    $('dgWhat').textContent = ins.kit[state.drums.pitch] + ' · row ' + state.cursor.row;
    for (const f of FIELDS) {
      const el = root.querySelector('.dgVal[data-field="' + f + '"]');
      el.querySelector('output').textContent = valueText(f, n);
      el.classList.toggle('off', !n);
      for (const b of el.querySelectorAll('button')) b.disabled = !mine;
    }
  }
  // playhead: the cells of the playing row, on the page that holds it
  if (playing !== lastPlay) {
    for (const el of box.querySelectorAll('.play')) el.classList.remove('play');
    if (playing != null) for (const el of box.querySelectorAll('[data-row="' + playing + '"]')) el.classList.add('play');
    lastPlay = playing;
  }
}

// The cursor's line and row, and what is there, for the status line.
export function drumStatus() {
  const cx = drumsOn() ? context() : null; if (!cx) return '';
  const { tr, ins, phr } = cx, n = hitHere();
  let s = '<b>' + esc(tr.name) + '</b> ' + esc(ins.kit[state.drums.pitch] || '') + ' row ' + state.cursor.row;
  if (n) s += ' vel ' + n.vel + (noteCommandParts(n).length ? ' ' + noteCommandParts(n).join(' ') : '');
  return s + ' | ' + phr.rows + ' rows';
}

export function wireDrums() {
  const root = $('drumGrid'), box = $('dgLines'); if (!root) return;
  $('drumsBtn').onclick = () => toggleDrums();
  // On a phone the transport bar is full, so the button sits with the tools in the top bar.
  const btn = $('drumsBtn'), home = btn.parentNode, tools = document.querySelector('#topbar .tools'), mq = window.matchMedia('(max-width: 760px)');
  const place = () => { if (mq.matches && tools) tools.prepend(btn); else home.append(btn); };
  if (mq.addEventListener) mq.addEventListener('change', place);
  place();
  $('dgInst').onchange = e => { state.cursor.instrument = parseInt(e.target.value, 10); state.drums.pitch = null; state.dirty = true; };
  $('dgAll').onclick = () => { state.drums.all = !state.drums.all; state.dirty = true; };
  $('dgPrev').onclick = () => movePage(-1);
  $('dgNext').onclick = () => movePage(1);
  // A tap writes or removes; a long press, or a click with Shift, only moves the cursor there.
  let held = null, quiet = false;
  box.addEventListener('pointerdown', e => {
    const cell = e.target.closest('.dgCell'); quiet = false; clearTimeout(held); if (!cell) return;
    held = setTimeout(() => { quiet = true; moveTo(+cell.dataset.pitch, +cell.dataset.row); if (navigator.vibrate) navigator.vibrate(15); }, 500);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) box.addEventListener(ev, () => clearTimeout(held));
  box.addEventListener('pointermove', e => { if (Math.abs(e.movementX) + Math.abs(e.movementY) > 6) clearTimeout(held); });
  box.addEventListener('contextmenu', e => { if (e.target.closest('.dgCell')) e.preventDefault(); });
  box.addEventListener('click', e => {
    const lab = e.target.closest('.dgLabel');
    if (lab) { moveTo(+lab.dataset.label, state.cursor.row); audition(curInstrument(), +lab.dataset.label, null); return; }
    const cell = e.target.closest('.dgCell'); if (!cell) return;
    const pitch = +cell.dataset.pitch, row = +cell.dataset.row;
    if (quiet || e.shiftKey) { quiet = false; moveTo(pitch, row); return; }
    drumToggle(pitch, row);
  });
  $('dgHit').addEventListener('click', e => {
    const b = e.target.closest('button[data-d]'); if (!b || b.disabled) return;
    drumNudge(b.closest('.dgVal').dataset.field, +b.dataset.d);
  });
  if (window.ResizeObserver) new ResizeObserver(() => { state.dirty = true; }).observe(box);
}
