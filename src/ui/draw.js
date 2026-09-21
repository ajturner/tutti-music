// Canvas drawing of the grid, the status line, and the animation-frame loop.
import { FAMILIES, clamp, hex2, noteName } from '../core/constants.js';
import { SOUND } from '../core/sounds.js';
import { laneValueAt, expandPlacements, patternById, placementLabel, placementRows } from '../core/song.js';
import { $, COLORS, activeKey, applyDensity, canvas, ctx, curPhrase, curPattern, curSection, curInstrument, midi, rowsPerBar, rowsPerStrongBeat, sched, state, instrumentsShown, view } from './state.js';
import { computeLayout, currentCell, HEADER_ROWS, CELL_LABEL } from './layout.js';
import { indexInstrument, noteCovering, patternStatus } from './edit.js';
import { indexMaterial } from '../core/edit.js';
import { rowAtTick, grooveOf, FX_HELP } from '../core/render.js';
import { fxAtRow } from '../core/edit.js';
import { keyName } from '../core/scales.js';
import { inSel } from './selection.js';
import { gamepad, pollGamepad } from './gamepad.js';
import { renderPocket } from './pocket.js';
import { syncPad, syncSelBar } from './pad.js';
import { syncMixer } from './mixer.js';
import { syncMap } from './map.js';
import { songStatus, syncSongView } from './songview.js';
import { soundingNow } from './monitor.js';
import { esc, syncPhraseUI } from './sync.js';

// ---- Drawing ---------------------------------------------------------------------------------
export function resize() {
  applyDensity();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(canvas.clientWidth * dpr); canvas.height = Math.floor(canvas.clientHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = view.FONT; view.charW = ctx.measureText('0').width;
  state.dirty = true;
}
window.addEventListener('resize', resize);

// Text cut to a width, so narrow columns (note-only instruments on a phone) do not overlap their neighbours.
function fitText(text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let n = text.length; while (n > 1 && ctx.measureText(text.slice(0, n)).width > maxW) n--;
  return text.slice(0, n);
}
export function draw() {
  if (!canvas.clientWidth || !canvas.clientHeight) { syncPad(); syncSelBar(); syncMixer(); syncMap(); syncSongView(); updateStatus(null); return; }   // the Song view or a phone panel is up: keep the DOM views in step
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.floor(canvas.clientWidth * dpr) || canvas.height !== Math.floor(canvas.clientHeight * dpr)) resize();
  const W = canvas.clientWidth, H = canvas.clientHeight;
  ctx.font = view.FONT; ctx.textBaseline = 'middle';
  const song = state.song;
  const playTick = sched.positionTick();
  let playRow = null, playPhr = null, playStart = null;
  const phr = curPhrase();
  if (playTick != null && sched.rendered) {
    if (sched.rendered.pattern) { if (state.patternEdit && sched.rendered.pattern === state.patternEdit.id) { playPhr = state.phr; playRow = rowAtTick(phr, playTick); } }   // the open pattern looping on its own
    else for (const s of sched.rendered.starts) if (playTick >= s.tick && playTick < s.tick + s.rows * s.ticksPerRow) { playPhr = s.phrase; playStart = s; playRow = rowAtTick(song.phrases[s.phrase], playTick - s.tick); }
    if (state.follow && !state.patternEdit && playPhr != null && playPhr !== state.phr) { state.phr = playPhr; const si = playStart ? song.sections.findIndex(x => x.id === playStart.section) : -1; if (si >= 0) state.section = si; syncPhraseUI(); }
  }
  const L = computeLayout();
  const headerH = view.ROW_H * HEADER_ROWS + 8;
  const visible = Math.max(1, Math.floor((H - headerH) / view.ROW_H));
  const centerRow = (playRow != null && state.follow && playPhr === state.phr) ? playRow : state.cursor.row;
  // While a drag selection is in progress the view stays put (state.topLock) so rows don't slide under the pointer.
  const top = state.topLock != null ? state.topLock : centerRow - Math.floor(visible / 2);

  if (state.cursor.instrument >= L.instruments.length) state.cursor.instrument = L.instruments.length - 1;   // its instrument is gone: the last one, or the tempo column of a song with none
  // Bring the cursor's instrument on screen after the cursor moved, but leave a hand-scrolled view alone.
  if (state.cursor.instrument >= 0 && state.ensureVisible) {
    const lay = L.instruments[state.cursor.instrument];
    if (lay.x - state.scrollX < L.gutter.w) state.scrollX = lay.x - L.gutter.w;
    if (lay.x + lay.w - state.scrollX > W) state.scrollX = lay.x + lay.w - W;
  }
  state.ensureVisible = false;
  state.scrollX = clamp(state.scrollX, 0, Math.max(0, L.totalW - W));

  ctx.fillStyle = COLORS.bg; ctx.fillRect(0, 0, W, H);
  const rpb = rowsPerBar(), rpBeat = rowsPerStrongBeat();
  const rowY = r => headerH + (r - top) * view.ROW_H;

  // Row backgrounds
  for (let r = Math.max(0, top); r < Math.min(phr.rows, top + visible + 1); r++) {
    const y = rowY(r);
    if (r % rpBeat === 0) { ctx.fillStyle = COLORS.beat; ctx.fillRect(0, y, W, view.ROW_H); }
    if (r === playRow && playPhr === state.phr) { ctx.fillStyle = COLORS.play; ctx.fillRect(0, y, W, view.ROW_H); }
  }
  // Grid content, scrolled horizontally
  ctx.save();
  ctx.beginPath(); ctx.rect(L.gutter.w, headerH, W - L.gutter.w, H - headerH); ctx.clip();
  ctx.translate(-state.scrollX, 0);
  const cur = state.cursor;
  const cursorCell = cur.instrument >= 0 ? L.instruments[cur.instrument].cells[clamp(cur.cell, 0, L.instruments[cur.instrument].cells.length - 1)] : null;
  for (let r = Math.max(0, top); r < Math.min(phr.rows, top + visible + 1); r++) {
    const y = rowY(r);
    if (r % rpb === 0) { ctx.fillStyle = COLORS.bar; ctx.fillRect(L.gutter.w + state.scrollX, y, L.totalW, 1); }
  }
  for (let ti = 0; ti < L.instruments.length; ti++) {
    const lay = L.instruments[ti];
    if (lay.x + lay.w < state.scrollX || lay.x > state.scrollX + W) continue;
    const tr = lay.instrument, ins = SOUND[tr.sound], fam = FAMILIES[ins.family];
    const idx = indexInstrument(phr, tr.id);
    // Placements: the pattern's notes drawn dimmed under the instrument, a band over the rows, a tag on the first row.
    const mat = phr.material[tr.id], placements = state.patternEdit ? [] : (mat && mat.placements || []).map(pl => { const ptn = patternById(song, pl.pattern); return ptn ? Object.assign(placementRows(phr, pl, ptn), { pl, ptn }) : null; }).filter(Boolean);
    const pidx = placements.length ? indexMaterial(phr, expandPlacements(song, phr, tr.id, tr.columns, activeKey())) : null;
    const noteEnd = lay.cells.filter(c => c.kind === 'note' || c.kind === 'vel' || c.kind === 'art').reduce((m, c) => Math.max(m, c.x + c.w), lay.x);
    ctx.fillStyle = COLORS.line; ctx.fillRect(lay.x - view.charW * 0.75, headerH, 1, H - headerH);
    for (const pr of placements) {
      const y0 = rowY(Math.max(pr.r0, top)), y1 = rowY(Math.min(pr.r1, top + visible) + 1);
      if (y1 <= headerH || y0 >= H) continue;
      ctx.fillStyle = fam.color; ctx.globalAlpha = 0.09; ctx.fillRect(lay.x - 2, y0, noteEnd - lay.x + 4, y1 - y0); ctx.globalAlpha = 1;
      ctx.fillRect(lay.x - 2, y0, 2, y1 - y0);
    }
    for (let r = Math.max(0, top); r < Math.min(phr.rows, top + visible + 1); r++) {
      const y = rowY(r), ym = y + view.ROW_H / 2;
      const tag = placements.find(pr => pr.r0 === r);
      const pstarts = pidx ? (pidx.starts.get(r) || {}) : {}, pspans = pidx ? (pidx.spans.get(r) || {}) : {};
      const starts = Object.assign({}, pstarts, idx.starts.get(r) || {}), spans = Object.assign({}, pspans, idx.spans.get(r) || {});
      for (let ci = 0; ci < lay.cells.length; ci++) {
        const cell = lay.cells[ci];
        const isCursor = cur.instrument === ti && cell === cursorCell && r === cur.row;
        if (state.sel && inSel(lay.g0 + ci, r)) { ctx.fillStyle = COLORS.accent; ctx.globalAlpha = 0.22; ctx.fillRect(cell.x - 2, y, cell.w + 4, view.ROW_H); ctx.globalAlpha = 1; }
        if (isCursor) { ctx.fillStyle = COLORS.accent; ctx.fillRect(cell.x - 2, y + 1, cell.w + 4, view.ROW_H - 2); }
        const textColor = isCursor ? COLORS.cursorText : COLORS.text;
        if (tag) {   // the tag row names the pattern across the whole instrument
          if (cell === lay.cells[0]) {
            const label = '\u25b8' + placementLabel(tag.pl, tag.ptn.name);
            if (isCursor) { ctx.fillStyle = COLORS.accent; ctx.fillRect(cell.x - 2, y + 1, lay.w - view.charW * 0.5, view.ROW_H - 2); }
            ctx.fillStyle = isCursor ? COLORS.cursorText : COLORS.accent; ctx.fillText(label, cell.x, ym, lay.x + lay.w - view.charW - cell.x);
          }
          continue;
        }
        if (cell.kind === 'note') {
          const ev = starts[cell.col];
          if (ev && ev.placed) { ctx.fillStyle = isCursor ? COLORS.cursorText : fam.color; ctx.globalAlpha = isCursor ? 1 : 0.55; ctx.fillText(noteName(ev.pitch), cell.x, ym); ctx.globalAlpha = 1; }
          else if (ev) { ctx.fillStyle = isCursor ? COLORS.cursorText : (tr.mute ? COLORS.num : fam.color); ctx.fillText(noteName(ev.pitch), cell.x, ym); }
          else if (spans[cell.col]) { ctx.fillStyle = isCursor ? COLORS.cursorText : fam.color; ctx.globalAlpha = isCursor ? 1 : 0.45; ctx.fillRect(cell.x + view.charW * 1.35, y, 2, view.ROW_H); ctx.globalAlpha = 1; }
          else { ctx.fillStyle = isCursor ? COLORS.cursorText : COLORS.dim; ctx.fillText('···', cell.x, ym); }
        } else if (cell.kind === 'vel') {
          const ev = starts[cell.col];
          ctx.fillStyle = ev ? textColor : (isCursor ? COLORS.cursorText : COLORS.dim);
          ctx.fillText(ev ? hex2(ev.vel) : '··', cell.x, ym);
        } else if (cell.kind === 'art') {
          const evs = Object.values(starts), a = evs.find(e => e.art);
          ctx.fillStyle = a ? textColor : (isCursor ? COLORS.cursorText : COLORS.dim);
          ctx.fillText(a ? a.art : (evs.length ? ins.articulations[0] : '·'), cell.x, ym);
          if (!a && evs.length && !isCursor) { ctx.fillStyle = COLORS.num; ctx.fillText(ins.articulations[0], cell.x, ym); }
        } else if (cell.kind === 'dyn') {
          const v = laneValueAt(idx.dyn, r * phr.ticksPerRow, null);
          if (v != null && !isCursor) { ctx.fillStyle = fam.color; ctx.globalAlpha = 0.16; ctx.fillRect(cell.x, y + 2, cell.w * v / 127, view.ROW_H - 4); ctx.globalAlpha = 1; }
          const p = idx.dyn.find(x => x.tick === r * phr.ticksPerRow);
          ctx.fillStyle = p ? textColor : (isCursor ? COLORS.cursorText : COLORS.dim);
          ctx.fillText(p ? hex2(p.value) + (p.interp === 'lin' ? '~' : ' ') : '·', cell.x, ym);
        } else if (cell.kind === 'fx') {
          const f = idx.fx.find(x => x.tick === r * phr.ticksPerRow);
          ctx.fillStyle = f ? textColor : (isCursor ? COLORS.cursorText : COLORS.dim);
          ctx.fillText(f ? f.cmd + ' ' + hex2(f.value) : '·', cell.x, ym);
        }
      }
    }
  }
  ctx.restore();

  // Gutter: row numbers and tempo lane (fixed)
  ctx.fillStyle = COLORS.bg; ctx.fillRect(0, headerH, L.gutter.w - view.charW * 0.5, H - headerH);
  for (let r = Math.max(0, top); r < Math.min(phr.rows, top + visible + 1); r++) {
    const y = rowY(r), ym = y + view.ROW_H / 2;
    if (r % rpBeat === 0) { ctx.fillStyle = COLORS.beat; ctx.fillRect(0, y, L.gutter.w - view.charW * 0.5, view.ROW_H); }
    if (r === playRow && playPhr === state.phr) { ctx.fillStyle = COLORS.play; ctx.fillRect(0, y, L.gutter.w - view.charW * 0.5, view.ROW_H); }
    ctx.fillStyle = r % rpb === 0 ? COLORS.accent : COLORS.num;
    ctx.fillText(String(r).padStart(3, '0'), L.gutter.rowX, ym);
    const isCursor = cur.instrument === -1 && r === cur.row;
    if (state.sel && inSel(0, r)) { ctx.fillStyle = COLORS.accent; ctx.globalAlpha = 0.22; ctx.fillRect(L.gutter.tempoX - 2, y, view.charW * 4 + 4, view.ROW_H); ctx.globalAlpha = 1; }
    if (isCursor) { ctx.fillStyle = COLORS.accent; ctx.fillRect(L.gutter.tempoX - 2, y + 1, view.charW * 4 + 4, view.ROW_H - 2); }
    const p = phr.tempo.find(x => x.tick === r * phr.ticksPerRow);
    ctx.fillStyle = isCursor ? COLORS.cursorText : (p ? COLORS.text : COLORS.dim);
    ctx.fillText(p ? String(p.value).padStart(3, ' ') + (p.interp === 'lin' ? '~' : ' ') : '  ·', L.gutter.tempoX, ym);
  }
  ctx.fillStyle = COLORS.line; ctx.fillRect(L.gutter.w - view.charW * 0.5, headerH, 1, H - headerH);

  // Header
  ctx.fillStyle = COLORS.header; ctx.fillRect(0, 0, W, headerH);
  ctx.fillStyle = COLORS.line; ctx.fillRect(0, headerH - 1, W, 1);
  ctx.save();
  ctx.beginPath(); ctx.rect(L.gutter.w, 0, W - L.gutter.w, headerH); ctx.clip();
  ctx.translate(-state.scrollX, 0);
  const bandY = 8 + view.ROW_H / 2, nameY = view.ROW_H + 8 + view.ROW_H / 2, labelY = view.ROW_H * 2 + 8 + view.ROW_H / 2;
  const labelEnd = new Map();          // first instrument of each family group -> where its label ends
  let i = 0;
  while (i < L.instruments.length) {
    const fam = SOUND[L.instruments[i].instrument.sound].family;
    let j = i; while (j + 1 < L.instruments.length && SOUND[L.instruments[j + 1].instrument.sound].family === fam) j++;
    const x0 = L.instruments[i].x, x1 = L.instruments[j].x + L.instruments[j].w - view.charW;
    ctx.fillStyle = FAMILIES[fam].color; ctx.fillRect(x0, 4, x1 - x0, 2);
    const famLabel = fitText(FAMILIES[fam].label, Math.max(view.charW * 2, x1 - x0));
    ctx.globalAlpha = 0.75; ctx.fillText(famLabel, x0, bandY); ctx.globalAlpha = 1;
    for (let k = i; k <= j; k++) labelEnd.set(k, x0 + ctx.measureText(famLabel).width + view.charW);   // every instrument under the label
    i = j + 1;
  }
  const anySolo = instrumentsShown().some(t => t.solo), sounding = soundingNow();
  L.instruments.forEach((lay, ti) => {
    const tr = lay.instrument, fam = FAMILIES[SOUND[tr.sound].family];
    const silent = tr.mute || (anySolo && !tr.solo);
    ctx.fillStyle = silent ? COLORS.num : fam.color;
    const nameFull = state.patternEdit ? tr.name + ' \u00b7 pattern ' + (curPattern() || {}).name : tr.name, name = fitText(nameFull, lay.w - view.charW * (tr.solo ? 2 : 0.75));
    ctx.fillText(name, lay.x, nameY);
    if (tr.mute) ctx.fillRect(lay.x, nameY, ctx.measureText(name).width, 1);
    if (tr.solo) { ctx.fillStyle = COLORS.accent; ctx.fillText('S', lay.x + ctx.measureText(name).width + view.charW * 0.6, nameY); }
    // While playing, the note this instrument is sounding sits beside its name (or in its place in a narrow column).
    const live = sounding[tr.id];
    if (live) {
      const txt = noteName(live.pitch), nameW = ctx.measureText(name).width, x = lay.x + nameW + view.charW * (tr.solo ? 2 : 0.8);
      ctx.fillStyle = COLORS.accent; ctx.globalAlpha = 0.55 + 0.45 * live.vel / 127;
      if (x + ctx.measureText(txt).width <= lay.x + lay.w - view.charW * 0.5) ctx.fillText(txt, x, nameY);
      else { ctx.fillStyle = COLORS.header; ctx.globalAlpha = 1; ctx.fillRect(lay.x - 1, nameY - view.ROW_H / 2, lay.w - view.charW * 0.5, view.ROW_H); ctx.fillStyle = COLORS.accent; ctx.fillText(fitText(txt, lay.w - view.charW * 0.75), lay.x, nameY); }
      ctx.globalAlpha = 1;
    }
    // third row: what each cell holds, so a new user can read the columns
    ctx.fillStyle = COLORS.num; ctx.font = Math.round(parseInt(view.FONT, 10) * 0.78) + 'px ' + view.FONT.slice(view.FONT.indexOf(' ') + 1);   // small caps-sized labels fit inside each cell
    for (const cell of lay.cells) { const label = cell.kind === 'note' && cell.col > 0 ? ['2nd', '3rd', '4th'][cell.col - 1] : CELL_LABEL[cell.kind]; ctx.fillText(label, cell.x, labelY); }
    ctx.font = view.FONT;
    const tag = 'ch' + tr.channel, tagX = lay.x + lay.w - view.charW * (tag.length + 1.5);
    if (!labelEnd.has(ti) || labelEnd.get(ti) <= tagX) { ctx.fillStyle = COLORS.num; ctx.fillText(tag, tagX, bandY); }
  });
  ctx.restore();
  ctx.fillStyle = COLORS.header; ctx.fillRect(0, 0, L.gutter.w - view.charW * 0.5, headerH);
  ctx.fillStyle = COLORS.num;
  ctx.fillText('row', L.gutter.rowX, labelY);
  ctx.fillText('bpm', L.gutter.tempoX, labelY);

  view.lastDraw = { L, top, headerH };
  syncPad(); syncSelBar(); syncMixer(); syncMap(); syncSongView();
  updateStatus(playRow);
}

export let lastStatus = '';
export function updateStatus(playRow) {
  const phr = curPhrase(), tr = curInstrument(), cell = currentCell(), row = state.cursor.row;
  const parts = [];
  if (state.level === 'song') { const st = songStatus(); if (st) parts.push(st); if (sched.playing) parts.push('<b>playing</b>'); if (state.message) parts.push('<span class="warn">' + state.message + '</span>'); const h = parts.map(x => '<span>' + x + '</span>').join(''); if (h !== lastStatus) { $('status').innerHTML = h; lastStatus = h; } return; }
  if (state.patternEdit) parts.push('<b class="warn">pattern ' + esc((curPattern() || {}).name || '') + '</b> Esc returns to phrase ' + state.phr);
  const ps = patternStatus(); if (ps) parts.push(ps);
  if (tr) {
    const ins = SOUND[tr.sound];
    let s = '<b>' + tr.name + '</b> col ' + ((cell.col | 0) + 1) + ' row ' + row;
    const ev = noteCovering(phr, tr.id, cell.col | 0, row);
    if (ev) s += ' <b>' + noteName(ev.pitch) + '</b>' + (ins.kit && ins.kit[ev.pitch] ? ' ' + esc(ins.kit[ev.pitch]) : '') + ' vel ' + ev.vel + ' len ' + (ev.len / phr.ticksPerRow) + ' rows ' + (ev.art || ins.articulations[0]);
    if (ins.kit && !ev) s += ' kit: ' + Object.entries(ins.kit).map(([n, l]) => noteName(+n) + ' ' + esc(l)).join(', ');
    parts.push(s);
    parts.push('articulations ' + ins.articulations.map((a, i) => '<b>' + (i + 1) + '</b>' + a).join(' '));
    parts.push('range ' + noteName(ins.range[0]) + '–' + noteName(ins.range[1]));
  } else parts.push('<b>tempo</b> row ' + row + ' (digits, L ramp, S hold)');
  if (cell.kind === 'fx') { const f = fxAtRow(phr, tr.id, row); parts.push('fx ' + (f ? '<b>' + f.cmd + ' ' + hex2(f.value) + '</b> ' + FX_HELP[f.cmd] : 'C R D A T pick a command, hex sets its value')); }
  parts.push('octave <b>' + state.octave + '</b> step <b>' + state.step + '</b>');
  parts.push('key <b>' + keyName(activeKey()) + '</b>' + (phr.key ? ' (phrase)' : (curSection() && curSection().key) ? ' (section)' : '') + (grooveOf(phr) ? ' | groove <b>on</b>' : ''));
  if (state.queued != null) parts.push('next <b>' + state.queued + ' ' + (state.song.phrases[state.queued] || {}).name + '</b>');
  parts.push('<a data-panel="view" title="Open View: preview and sound">preview ' + (state.preview ? (state.sound === 'samples' ? 'samples' : 'synth') + (state.loadingSamples ? ' <span class="warn">loading ' + esc(state.loadingSamples) + '</span>' : '') : 'off') + '</a> | <a data-panel="connect" title="Open Connect">MIDI ' + (midi.out ? '<b>' + esc(midi.out.name) + '</b>' : 'off') + '</a>');
  if (state.sel) parts.push('selected <b>' + (state.sel.r1 - state.sel.r0 + 1) + '</b> rows × <b>' + (state.sel.g1 - state.sel.g0 + 1) + '</b> cells');
  if (midi.in) parts.push('MIDI in <b>' + esc(midi.in.name) + '</b>');
  if (gamepad.name) parts.push('\u{1F3AE} <b>' + esc(gamepad.name.replace(/\s*\(.*$/, '')) + '</b>');
  const cs = $('controllerStatus'); if (cs) { const t = gamepad.name ? 'Connected: ' + gamepad.name : 'No controller'; if (cs.textContent !== t) cs.textContent = t; }
  if (state.record) parts.push('<b class="warn">REC</b> notes land on the passing row');
  if (sched.playing) parts.push('<b>playing</b>' + (sched.loop ? ' (loop)' : '') + (playRow != null ? ' row ' + playRow : ''));
  if (state.message) parts.push('<span class="warn">' + state.message + '</span>');
  const html = parts.map(p => '<span>' + p + '</span>').join('');
  if (html !== lastStatus) { $('status').innerHTML = html; lastStatus = html; }
}

let lastDrawError = '';
export function frame(now) {
  try {
    pollGamepad(now || performance.now());
    if (state.dirty || sched.playing) { state.dirty = false; const none = $('emptyAdd'); if (none) none.hidden = state.song.instruments.length > 0; if (state.pocket) renderPocket(); else draw(); }
  } catch (e) {
    // never let one bad frame stop the loop; report once per distinct error
    if (e.message !== lastDrawError) { lastDrawError = e.message; console.error('draw:', e); state.message = 'Display error: ' + e.message; }
  }
  requestAnimationFrame(frame);
}
