// Canvas drawing of the grid, the status line, and the animation-frame loop.
import { FAMILIES, clamp, hex2, noteName } from '../core/constants.js';
import { INST } from '../core/instruments.js';
import { laneValueAt } from '../core/song.js';
import { $, COLORS, applyDensity, canvas, ctx, curPat, curTrack, midi, rowsPerBar, rowsPerStrongBeat, sched, state, view } from './state.js';
import { computeLayout, currentCell } from './layout.js';
import { indexTrack, noteCovering } from './edit.js';
import { rowAtTick, grooveOf, FX_HELP } from '../core/render.js';
import { fxAtRow } from '../core/edit.js';
import { keyName } from '../core/scales.js';
import { inSel } from './selection.js';
import { gamepad, pollGamepad } from './gamepad.js';
import { syncPad, syncSelBar } from './pad.js';
import { syncMixer } from './mixer.js';
import { esc, syncPatternUI } from './sync.js';

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

export function draw() {
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.floor(canvas.clientWidth * dpr) || canvas.height !== Math.floor(canvas.clientHeight * dpr)) resize();
  const W = canvas.clientWidth, H = canvas.clientHeight;
  ctx.font = view.FONT; ctx.textBaseline = 'middle';
  const song = state.song;
  const playTick = sched.positionTick();
  let playRow = null, playPat = null;
  if (playTick != null && sched.rendered) {
    for (const s of sched.rendered.starts) if (playTick >= s.tick && playTick < s.tick + s.rows * s.ticksPerRow) { playPat = s.pattern; playRow = rowAtTick(song.patterns[s.pattern], playTick - s.tick); }
    if (state.follow && playPat != null && playPat !== state.pat) { state.pat = playPat; syncPatternUI(); }
  }
  const pat = curPat();
  const L = computeLayout();
  const headerH = view.ROW_H * 2 + 8;
  const visible = Math.max(1, Math.floor((H - headerH) / view.ROW_H));
  const centerRow = (playRow != null && state.follow && playPat === state.pat) ? playRow : state.cursor.row;
  // While a drag selection is in progress the view stays put (state.topLock) so rows don't slide under the pointer.
  const top = state.topLock != null ? state.topLock : centerRow - Math.floor(visible / 2);

  // Bring the cursor's track on screen after the cursor moved, but leave a hand-scrolled view alone.
  if (state.cursor.track >= 0 && state.ensureVisible) {
    const lay = L.tracks[state.cursor.track];
    if (lay.x - state.scrollX < L.gutter.w) state.scrollX = lay.x - L.gutter.w;
    if (lay.x + lay.w - state.scrollX > W) state.scrollX = lay.x + lay.w - W;
  }
  state.ensureVisible = false;
  state.scrollX = clamp(state.scrollX, 0, Math.max(0, L.totalW - W));

  ctx.fillStyle = COLORS.bg; ctx.fillRect(0, 0, W, H);
  const rpb = rowsPerBar(), rpBeat = rowsPerStrongBeat();
  const rowY = r => headerH + (r - top) * view.ROW_H;

  // Row backgrounds
  for (let r = Math.max(0, top); r < Math.min(pat.rows, top + visible + 1); r++) {
    const y = rowY(r);
    if (r % rpBeat === 0) { ctx.fillStyle = COLORS.beat; ctx.fillRect(0, y, W, view.ROW_H); }
    if (r === playRow && playPat === state.pat) { ctx.fillStyle = COLORS.play; ctx.fillRect(0, y, W, view.ROW_H); }
  }
  // Grid content, scrolled horizontally
  ctx.save();
  ctx.beginPath(); ctx.rect(L.gutter.w, headerH, W - L.gutter.w, H - headerH); ctx.clip();
  ctx.translate(-state.scrollX, 0);
  const cur = state.cursor;
  const cursorCell = cur.track >= 0 ? L.tracks[cur.track].cells[clamp(cur.cell, 0, L.tracks[cur.track].cells.length - 1)] : null;
  for (let r = Math.max(0, top); r < Math.min(pat.rows, top + visible + 1); r++) {
    const y = rowY(r);
    if (r % rpb === 0) { ctx.fillStyle = COLORS.bar; ctx.fillRect(L.gutter.w + state.scrollX, y, L.totalW, 1); }
  }
  for (let ti = 0; ti < L.tracks.length; ti++) {
    const lay = L.tracks[ti];
    if (lay.x + lay.w < state.scrollX || lay.x > state.scrollX + W) continue;
    const tr = lay.track, ins = INST[tr.instrument], fam = FAMILIES[ins.family];
    const idx = indexTrack(pat, tr.id);
    ctx.fillStyle = COLORS.line; ctx.fillRect(lay.x - view.charW * 0.75, headerH, 1, H - headerH);
    for (let r = Math.max(0, top); r < Math.min(pat.rows, top + visible + 1); r++) {
      const y = rowY(r), ym = y + view.ROW_H / 2;
      const starts = idx.starts.get(r) || {}, spans = idx.spans.get(r) || {};
      for (let ci = 0; ci < lay.cells.length; ci++) {
        const cell = lay.cells[ci];
        const isCursor = cur.track === ti && cell === cursorCell && r === cur.row;
        if (state.sel && inSel(lay.g0 + ci, r)) { ctx.fillStyle = COLORS.accent; ctx.globalAlpha = 0.22; ctx.fillRect(cell.x - 2, y, cell.w + 4, view.ROW_H); ctx.globalAlpha = 1; }
        if (isCursor) { ctx.fillStyle = COLORS.accent; ctx.fillRect(cell.x - 2, y + 1, cell.w + 4, view.ROW_H - 2); }
        const textColor = isCursor ? COLORS.cursorText : COLORS.text;
        if (cell.kind === 'note') {
          const ev = starts[cell.col];
          if (ev) { ctx.fillStyle = isCursor ? COLORS.cursorText : (tr.mute ? COLORS.num : fam.color); ctx.fillText(noteName(ev.pitch), cell.x, ym); }
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
          const v = laneValueAt(idx.dyn, r * pat.ticksPerRow, null);
          if (v != null && !isCursor) { ctx.fillStyle = fam.color; ctx.globalAlpha = 0.16; ctx.fillRect(cell.x, y + 2, cell.w * v / 127, view.ROW_H - 4); ctx.globalAlpha = 1; }
          const p = idx.dyn.find(x => x.tick === r * pat.ticksPerRow);
          ctx.fillStyle = p ? textColor : (isCursor ? COLORS.cursorText : COLORS.dim);
          ctx.fillText(p ? hex2(p.value) + (p.interp === 'lin' ? '~' : ' ') : '·', cell.x, ym);
        } else if (cell.kind === 'fx') {
          const f = idx.fx.find(x => x.tick === r * pat.ticksPerRow);
          ctx.fillStyle = f ? textColor : (isCursor ? COLORS.cursorText : COLORS.dim);
          ctx.fillText(f ? f.cmd + ' ' + hex2(f.value) : '·', cell.x, ym);
        }
      }
    }
  }
  ctx.restore();

  // Gutter: row numbers and tempo lane (fixed)
  ctx.fillStyle = COLORS.bg; ctx.fillRect(0, headerH, L.gutter.w - view.charW * 0.5, H - headerH);
  for (let r = Math.max(0, top); r < Math.min(pat.rows, top + visible + 1); r++) {
    const y = rowY(r), ym = y + view.ROW_H / 2;
    if (r % rpBeat === 0) { ctx.fillStyle = COLORS.beat; ctx.fillRect(0, y, L.gutter.w - view.charW * 0.5, view.ROW_H); }
    if (r === playRow && playPat === state.pat) { ctx.fillStyle = COLORS.play; ctx.fillRect(0, y, L.gutter.w - view.charW * 0.5, view.ROW_H); }
    ctx.fillStyle = r % rpb === 0 ? COLORS.accent : COLORS.num;
    ctx.fillText(String(r).padStart(3, '0'), L.gutter.rowX, ym);
    const isCursor = cur.track === -1 && r === cur.row;
    if (state.sel && inSel(0, r)) { ctx.fillStyle = COLORS.accent; ctx.globalAlpha = 0.22; ctx.fillRect(L.gutter.tempoX - 2, y, view.charW * 4 + 4, view.ROW_H); ctx.globalAlpha = 1; }
    if (isCursor) { ctx.fillStyle = COLORS.accent; ctx.fillRect(L.gutter.tempoX - 2, y + 1, view.charW * 4 + 4, view.ROW_H - 2); }
    const p = pat.tempo.find(x => x.tick === r * pat.ticksPerRow);
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
  const bandY = 8 + view.ROW_H / 2, nameY = view.ROW_H + 8 + view.ROW_H / 2;
  const labelEnd = new Map();          // first track of each family group -> where its label ends
  let i = 0;
  while (i < L.tracks.length) {
    const fam = INST[L.tracks[i].track.instrument].family;
    let j = i; while (j + 1 < L.tracks.length && INST[L.tracks[j + 1].track.instrument].family === fam) j++;
    const x0 = L.tracks[i].x, x1 = L.tracks[j].x + L.tracks[j].w - view.charW;
    ctx.fillStyle = FAMILIES[fam].color; ctx.fillRect(x0, 4, x1 - x0, 2);
    ctx.globalAlpha = 0.75; ctx.fillText(FAMILIES[fam].label, x0, bandY); ctx.globalAlpha = 1;
    labelEnd.set(i, x0 + ctx.measureText(FAMILIES[fam].label).width + view.charW);
    i = j + 1;
  }
  const anySolo = song.tracks.some(t => t.solo);
  L.tracks.forEach((lay, ti) => {
    const tr = lay.track, fam = FAMILIES[INST[tr.instrument].family];
    const silent = tr.mute || (anySolo && !tr.solo);
    ctx.fillStyle = silent ? COLORS.num : fam.color;
    ctx.fillText(tr.name, lay.x, nameY);
    if (tr.mute) ctx.fillRect(lay.x, nameY, ctx.measureText(tr.name).width, 1);
    if (tr.solo) { ctx.fillStyle = COLORS.accent; ctx.fillText('S', lay.x + ctx.measureText(tr.name).width + view.charW * 0.6, nameY); }
    const tag = 'ch' + tr.channel, tagX = lay.x + lay.w - view.charW * (tag.length + 1.5);
    if (!labelEnd.has(ti) || labelEnd.get(ti) <= tagX) { ctx.fillStyle = COLORS.num; ctx.fillText(tag, tagX, bandY); }
  });
  ctx.restore();
  ctx.fillStyle = COLORS.header; ctx.fillRect(0, 0, L.gutter.w - view.charW * 0.5, headerH);
  ctx.fillStyle = COLORS.num;
  ctx.fillText('row', L.gutter.rowX, view.ROW_H + 8 + view.ROW_H / 2);
  ctx.fillText('bpm', L.gutter.tempoX, view.ROW_H + 8 + view.ROW_H / 2);

  view.lastDraw = { L, top, headerH };
  syncPad(); syncSelBar(); syncMixer();
  updateStatus(playRow);
}

export let lastStatus = '';
export function updateStatus(playRow) {
  const pat = curPat(), tr = curTrack(), cell = currentCell(), row = state.cursor.row;
  const parts = [];
  if (tr) {
    const ins = INST[tr.instrument];
    let s = '<b>' + tr.name + '</b> col ' + ((cell.col | 0) + 1) + ' row ' + row;
    const ev = noteCovering(pat, tr.id, cell.col | 0, row);
    if (ev) s += ' <b>' + noteName(ev.pitch) + '</b> vel ' + ev.vel + ' len ' + (ev.len / pat.ticksPerRow) + ' rows ' + (ev.art || ins.articulations[0]);
    parts.push(s);
    parts.push('articulations ' + ins.articulations.map((a, i) => '<b>' + (i + 1) + '</b>' + a).join(' '));
    parts.push('range ' + noteName(ins.range[0]) + '–' + noteName(ins.range[1]));
  } else parts.push('<b>tempo</b> row ' + row + ' (digits, L ramp, S hold)');
  if (cell.kind === 'fx') { const f = fxAtRow(pat, tr.id, row); parts.push('fx ' + (f ? '<b>' + f.cmd + ' ' + hex2(f.value) + '</b> ' + FX_HELP[f.cmd] : 'C R D A T pick a command, hex sets its value')); }
  parts.push('octave <b>' + state.octave + '</b>');
  parts.push('key <b>' + keyName(state.song.key) + '</b>' + (grooveOf(pat) ? ' | groove <b>on</b>' : ''));
  if (state.queued != null) parts.push('next <b>' + state.queued + ' ' + (state.song.patterns[state.queued] || {}).name + '</b>');
  parts.push('preview ' + (state.preview ? 'on' : 'off') + ' | MIDI ' + (midi.out ? '<b>' + esc(midi.out.name) + '</b>' : 'off'));
  if (state.sel) parts.push('selected <b>' + (state.sel.r1 - state.sel.r0 + 1) + '</b> rows × <b>' + (state.sel.g1 - state.sel.g0 + 1) + '</b> cells');
  if (midi.in) parts.push('MIDI in <b>' + esc(midi.in.name) + '</b>');
  if (gamepad.name) parts.push('\u{1F3AE} <b>' + esc(gamepad.name.replace(/\s*\(.*$/, '')) + '</b>');
  if (sched.playing) parts.push('<b>playing</b>' + (sched.loop ? ' (loop)' : '') + (playRow != null ? ' row ' + playRow : ''));
  if (state.message) parts.push('<span class="warn">' + state.message + '</span>');
  const html = parts.map(p => '<span>' + p + '</span>').join('');
  if (html !== lastStatus) { $('status').innerHTML = html; lastStatus = html; }
}

export function frame(now) {
  pollGamepad(now || performance.now());
  if (state.dirty || sched.playing) { state.dirty = false; draw(); }
  requestAnimationFrame(frame);
}
