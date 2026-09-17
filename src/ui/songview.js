// The Song view: the whole song at a glance, read top to bottom. Sections in playing order, each opening to its
// phrases, and for every phrase what each track plays: a thumbnail of the notes and the patterns placed there.
// It is the arrangement editor (add, repeat, reorder, rename, key) and the way in: Enter or a second tap opens
// the phrase on that track, a pattern chip opens that pattern. The patterns of the song are listed underneath.
import { FAMILIES, noteName } from '../core/constants.js';
import { INST } from '../core/instruments.js';
import { KEY_ROOTS, SCALE_NAMES, keyName } from '../core/scales.js';
import { addPhrase, addSection, addSlot, copyPhrase, deleteSection, expandMaterial, keyFor, moveIn, nextPhraseName, nextSectionName, patternById, patternUses, phraseIndex, phraseMeter, placementLabel, removeItem, removePattern, removeSlot, sectionById, sectionsNotArranged } from '../core/song.js';
import { renderSong } from '../core/render.js';
import { $, sched, state } from './state.js';
import { editPattern, redo, undo, withSongUndo } from './edit.js';
import { openPhrase } from './map.js';
import { playSection, playSong, stopAll } from './transport.js';
import { soundingNow } from './monitor.js';
import { esc, syncPhraseUI } from './sync.js';

const secColor = i => 'hsl(' + ((i * 67 + 205) % 360) + ' 46% 64%)';
const times = n => n > 1 ? '<i>×' + n + '</i>' : '';

// ---- The song as blocks (one per section occurrence) and phrase rows ---------------------------------
let model = { blocks: [], rows: [] };
export function songRows(song = state.song) {
  const blocks = [];
  song.arrangement.forEach((item, ai) => { const sec = sectionById(song, item.section); if (sec) blocks.push({ ai, item, sec, first: song.arrangement.findIndex(x => x.section === sec.id) === ai }); });
  for (const sec of sectionsNotArranged(song)) blocks.push({ ai: -1, item: null, sec, first: true });
  const rows = [];
  for (const b of blocks) { b.si = song.sections.indexOf(b.sec); b.rows = b.sec.phrases.map((slot, slotIndex) => ({ block: b, slotIndex, slot, pi: phraseIndex(song, slot.phrase) })).filter(r => r.pi >= 0); b.rows.forEach(r => { r.index = rows.length; rows.push(r); }); }
  return { blocks, rows };
}

// ---- Thumbnails ------------------------------------------------------------------------------------
// Notes of one track in one phrase as a tiny piano roll: loose notes solid, placed notes lighter.
function thumb(notes, len) {
  if (!notes.length) return '';
  let lo = 127, hi = 0; for (const n of notes) { if (n.pitch < lo) lo = n.pitch; if (n.pitch > hi) hi = n.pitch; }
  const span = Math.max(12, hi - lo + 1), pad = (span - (hi - lo + 1)) / 2, h = Math.max(7, 100 / span);
  const rects = notes.map(n => `<rect${n.placed ? ' class="pl"' : ''} x="${(n.tick / len * 100).toFixed(2)}" y="${((1 - (n.pitch - lo + pad + 1) / span) * 100).toFixed(1)}" width="${Math.max(1.2, n.len / len * 100 - 0.4).toFixed(2)}" height="${h.toFixed(1)}"/>`).join('');
  return `<svg class="thumb" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${rects}</svg>`;
}
function cellHtml(song, row, tr, ti) {
  const phr = song.phrases[row.pi], key = keyFor(song, phr, row.block.sec), m = phr.material[tr.id];
  const mat = expandMaterial(song, phr, tr.id, tr.columns || 1, key);
  const fam = (FAMILIES[(INST[tr.instrument] || {}).family] || FAMILIES.electronic).color;
  const chips = ((m && m.placements) || []).map(pl => { const ptn = patternById(song, pl.pattern); return ptn ? `<button class="ptn" data-act="ptn" data-pattern="${esc(ptn.id)}" data-prow="${pl.row}" title="Open pattern ${esc(ptn.name)} as placed here">${esc(placementLabel(pl, ptn.name))}</button>` : ''; });
  const shown = chips.slice(0, 2).join('') + (chips.length > 2 ? `<span class="more">+${chips.length - 2}</span>` : '');
  const loose = m ? m.notes.length : 0;
  const title = tr.name + ' in ' + phr.name + ': ' + (chips.length ? chips.length + ' placement' + (chips.length > 1 ? 's' : '') : 'no patterns') + ', ' + loose + ' loose note' + (loose === 1 ? '' : 's') + ' · Enter opens';
  return `<div class="svCell${mat && mat.notes.length ? '' : ' empty'}" data-row="${row.index}" data-t="${ti}" style="--fam:${fam}" title="${esc(title)}">${mat ? thumb(mat.notes, phr.rows * phr.ticksPerRow) : ''}<span class="chips">${shown}</span>${chips.length ? `<span class="pcount" title="${chips.length} placement${chips.length > 1 ? 's' : ''}">◆${chips.length}</span>` : ''}</div>`;
}

// ---- Rendering ---------------------------------------------------------------------------------------
const keySelects = key => `<select data-f="secKeyRoot" title="This section's own key: where a modulation lives. The notes stay put; the key decides what is in scale and where shifted placements land."><option value="">key: song's</option>${KEY_ROOTS.map((n, i) => `<option value="${i}"${key && key.root === i ? ' selected' : ''}>${n}</option>`).join('')}</select>` +
  (key ? `<select data-f="secKeyScale" title="Scale">${SCALE_NAMES.map(n => `<option${key.scale === n ? ' selected' : ''}>${n}</option>`).join('')}</select>` : '');
// A section's length in bars, from its phrases' rows, row sizes, meters and repeats.
function barsOf(song, sec) {
  let bars = 0;
  for (const sl of sec.phrases) { const phr = song.phrases.find(p => p.id === sl.phrase); if (!phr) continue; const [beats, unit] = phraseMeter(phr); bars += phr.rows * phr.ticksPerRow / (beats * 3840 / unit) * (sl.repeat || 1); }
  return Math.round(bars * 100) / 100;
}
function render() {
  const el = $('songBody');
  // A field being typed in commits before the rebuild, not during it (its change event would rebuild inside this one).
  if (el.contains(document.activeElement) && document.activeElement.matches('input')) document.activeElement.blur();
  const song = state.song; model = songRows(song);
  const tracks = song.tracks;
  const form = song.arrangement.map((it, ai) => { const sec = sectionById(song, it.section); return sec ? `<button class="formChip" data-act="goItem" data-ai="${ai}" style="--sec:${secColor(song.sections.indexOf(sec))}" title="Go to this section">${esc(sec.name)}${times(it.repeat)}</button>` : ''; }).join('');
  let html = `<div class="svGrid" style="--n:${tracks.length}"><div class="svRow svTracks"><div class="svLeft"><span class="svFormLabel">arrangement</span><span class="svForm">${form}</span></div>` +
    tracks.map((tr, ti) => { const fam = (FAMILIES[(INST[tr.instrument] || {}).family] || FAMILIES.electronic).color; return `<div class="svTrack" data-t="${ti}" style="--fam:${fam}" title="${esc(tr.name)}"><b>${esc(tr.name)}</b><span class="live" data-live="${esc(tr.id)}"></span></div>`; }).join('') + '</div>';
  for (const b of model.blocks) {
    const sec = b.sec;
    const others = song.phrases.filter(p => !sec.phrases.some(sl => sl.phrase === p.id));
    html += `<div class="svSec${b.ai < 0 ? ' spare' : ''}${b.first ? '' : ' again'}" data-ai="${b.ai}" data-sec="${esc(sec.id)}" style="--sec:${secColor(b.si)}"><div class="svSecIn">` +
      `<span class="swatch"></span><input data-f="secName" type="text" value="${esc(sec.name)}" size="9" title="Section name: Intro, Verse, Chorus, Bridge, A, B, Coda…" aria-label="Section name">` +
      (b.ai >= 0 ? `<label title="Play this section this many times here">×<input data-f="itemRepeat" type="number" min="1" max="64" value="${b.item.repeat}"><span class="count"></span></label>` : '<span class="dim" title="This section is not in the arrangement: add it, or delete it">unused</span>') +
      (b.first ? keySelects(sec.key) : '') +
      `<span class="secActs"><button data-act="playSec" title="Loop this section on its own until you stop it (⇧Space). Play and Space play the arrangement forward instead.">⟳ loop</button>` +
      (!b.first ? '' : `<select data-f="addPhrase" title="Add a phrase to this section"><option value="">+ phrase…</option><option value="new">new empty phrase</option><option value="copy">copy of the phrase under the cursor</option>${others.length ? '<optgroup label="reuse a phrase">' + others.map(p => `<option value="id:${esc(p.id)}">${esc(p.name)}</option>`).join('') + '</optgroup>' : ''}</select>`) +
      (b.ai >= 0 ? `<button data-act="itemUp" title="Earlier in the arrangement">↑</button><button data-act="itemDown" title="Later in the arrangement">↓</button><button data-act="itemRemove" title="Take this occurrence out of the arrangement">remove</button>`
                 : `<button data-act="arrange" title="Play this section at the end of the arrangement">add to arrangement</button><button data-act="secDelete" title="Delete this section and the phrases only it uses">delete</button>`) + '</span>' +
      `<span class="dim note"${b.first ? '' : ' title="The same section as above: edits show in both"'}>${b.first ? '' : '↺ '}${barsOf(song, sec)} bar${barsOf(song, sec) === 1 ? '' : 's'}</span></div></div>`;
    for (const r of b.rows) {
      const phr = song.phrases[r.pi], pm = phraseMeter(phr), shared = song.sections.filter(x => x !== sec && x.phrases.some(sl => sl.phrase === phr.id)).map(x => x.name);
      html += `<div class="svRow svPhrase" data-row="${r.index}" style="--sec:${secColor(b.si)}"><div class="svLeft"><input data-f="phrName" type="text" value="${esc(phr.name)}" size="7" aria-label="Phrase name" title="Phrase name">` +
        `<label title="Play this phrase this many times">×<input data-f="slotRepeat" type="number" min="1" max="64" value="${r.slot.repeat}"><span class="count"></span></label>` +
        `<span class="dim meta"${shared.length ? ` title="Also in ${esc(shared.join(', '))}: edits show there too"` : ''}>${phr.rows}r ${pm[0]}/${pm[1]}${shared.length ? ' ⇄' : ''}</span>` +
        `<span class="acts"><button data-act="open" title="Open this phrase in the grid (Enter)">open</button><button data-act="slotUp" title="Earlier in the section">↑</button><button data-act="slotDown" title="Later in the section">↓</button><button data-act="slotRemove" title="Take this phrase out of the section">×</button></span></div>` +
        tracks.map((tr, ti) => cellHtml(song, r, tr, ti)).join('') + '</div>';
    }
  }
  html += `<div class="svRow svAdd"><div class="svLeft"><select data-f="addSection" title="Add to the end of the arrangement"><option value="">+ section…</option><option value="new">new section</option>${song.sections.length ? '<optgroup label="play a section again">' + song.sections.map(x => `<option value="id:${esc(x.id)}">${esc(x.name)}</option>`).join('') + '</optgroup>' : ''}</select></div></div></div>`;
  // The patterns of the song: the reusable lines every placement above points at.
  const pats = song.patterns || [];
  if (pats.length) html += '<div class="svPatterns"><h3 title="Reusable lines, placed in phrases: what musicians call a motif, riff, lick or hook">Patterns</h3>' +
    ('<div class="ptnList">' + pats.map(p => `<div class="ptnCard" data-id="${esc(p.id)}">${thumb(p.material.notes, p.rows * p.ticksPerRow) || '<svg class="thumb"></svg>'}<input data-f="ptnName" type="text" value="${esc(p.name)}" size="10" aria-label="Pattern name"><span class="dim">${p.rows} rows · ${p.columns} col · ${patternUses(song, p.id)} use${patternUses(song, p.id) === 1 ? '' : 's'}</span><button data-act="ptnOpen" title="Open this pattern alone in the grid">open</button><button data-act="ptnRemove" title="Remove the pattern; every placement becomes loose notes">remove</button></div>`).join('') + '</div>') + '</div>';
  el.innerHTML = html;
  state.songCursor.row = Math.min(state.songCursor.row, Math.max(0, model.rows.length - 1));
  state.songCursor.track = Math.min(state.songCursor.track, Math.max(0, tracks.length - 1));
  paintCursor(); lastPlaying = -2; lastLive = ''; lastCount = '';
}
function paintCursor() {
  const el = $('songBody');
  for (const c of el.querySelectorAll('.cur')) c.classList.remove('cur');
  const c = el.querySelector(`.svCell[data-row="${state.songCursor.row}"][data-t="${state.songCursor.track}"]`);
  if (c) { c.classList.add('cur'); c.parentElement.classList.add('cur'); let sec = c.parentElement.previousElementSibling; while (sec && !sec.classList.contains('svSec')) sec = sec.previousElementSibling; if (sec) sec.classList.add('cur'); }
}
// The row under the cursor is the open phrase, seen in that section: the map, the phrase selector, Compose and
// the Play and Loop section buttons all follow it.
export function setSongCursor(row, track, reveal) {
  state.songCursor.row = Math.max(0, Math.min(model.rows.length - 1, row));
  state.songCursor.track = Math.max(0, Math.min(state.song.tracks.length - 1, track));
  const r = model.rows[state.songCursor.row];
  if (r && (state.phr !== r.pi || state.section !== r.block.si) && !(sched.playing && state.follow)) { state.phr = r.pi; state.section = r.block.si; syncPhraseUI(); }
  paintCursor(); state.dirty = true;
  if (reveal) { const c = $('songBody').querySelector('.svCell.cur'); if (c && c.scrollIntoView) c.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
}
// Put the cursor on the first phrase of a section's first occurrence (from the map's Section crumb).
export function focusSection(sectionIndex) {
  syncSongView(true);
  const r = model.rows.find(x => x.block.si === sectionIndex); if (r) setSongCursor(r.index, state.songCursor.track, true);
}

// ---- Per frame: rebuild when the song changed, then the playhead and the track monitor -------------------
let sig = '', lastPlaying = -2, lastLive = '', lastW = 0, lastLevel = '', lastCur = '', lastCount = '';
export function syncSongView(force) {
  if (state.level !== 'song') { lastLevel = state.level; return; }
  const next = state.rev + '|' + state.songIndex + '|' + state.song.uid;
  if (force || next !== sig) { sig = next; render(); }
  if (lastLevel !== 'song') {   // just came up from the grid: land on the phrase that was open, in its section
    lastLevel = 'song';
    const r = model.rows.find(x => x.pi === state.phr && x.block.si === state.section) || model.rows.find(x => x.pi === state.phr);
    if (r) setSongCursor(r.index, Math.max(0, Math.min(state.cursor.track, state.song.tracks.length - 1)), true);
  }
  const cur = state.songCursor.row + ':' + state.songCursor.track; if (cur !== lastCur) { lastCur = cur; paintCursor(); }
  const w = $('songView').clientWidth; if (w !== lastW) { lastW = w; $('songView').style.setProperty('--svW', w + 'px'); }
  const el = $('songBody'), tick = sched.positionTick(), rendered = sched.rendered;
  let playing = -1, pos = 0, item = -1, count = '';
  if (tick != null && rendered && !rendered.pattern) {
    const st = rendered.starts.find(s => tick >= s.tick && tick < s.tick + s.rows * s.ticksPerRow);
    if (st) {
      const r = model.rows.find(x => x.block.sec.id === st.section && x.slotIndex === st.slot && (rendered.scope || st.item < 0 || x.block.ai === st.item)) || model.rows.find(x => x.pi === st.phrase);
      if (r) {
        playing = r.index; pos = (tick - st.tick) / (st.rows * st.ticksPerRow); item = r.block.ai;
        // which time through: the section's count only means something while the arrangement plays
        const of = (i, n) => n > 1 ? (i + 1) + '/' + n : '';
        count = playing + '|' + (rendered.scope || !r.block.item ? '' : of(st.sectionRepeat, r.block.item.repeat)) + '|' + (rendered.starts.length > 1 || !sched.loop ? of(st.repeat, r.slot.repeat) : '');
      }
    }
  }
  if (playing !== lastPlaying) {
    for (const x of el.querySelectorAll('.playing')) x.classList.remove('playing');
    if (playing >= 0) { const row = el.querySelector(`.svPhrase[data-row="${playing}"]`); if (row) row.classList.add('playing'); const chip = el.querySelector(`.formChip[data-ai="${item}"]`); if (chip) chip.classList.add('playing'); }
    lastPlaying = playing;
    // Follow: the cursor rides the playing row, so the map, the phrase selector and the screen stay with the music.
    if (playing >= 0 && state.follow && !el.contains(document.activeElement)) {
      const r = model.rows[playing];
      state.songCursor.row = playing;
      if (state.phr !== r.pi || state.section !== r.block.si) { state.phr = r.pi; state.section = r.block.si; syncPhraseUI(); }
      paintCursor(); lastCur = state.songCursor.row + ':' + state.songCursor.track;
      const row = el.querySelector('.svPhrase.playing'); if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }
  if (count !== lastCount) {
    lastCount = count;
    for (const x of el.querySelectorAll('.count.on')) { x.textContent = ''; x.classList.remove('on'); }
    if (playing >= 0) {
      const [, secN, phrN] = count.split('|'), row = el.querySelector(`.svPhrase[data-row="${playing}"]`);
      let sec = row && row.previousElementSibling; while (sec && !sec.classList.contains('svSec')) sec = sec.previousElementSibling;
      for (const [host, text] of [[sec, secN], [row, phrN]]) { const c = text && host && host.querySelector('.count'); if (c) { c.textContent = text; c.classList.add('on'); } }
    }
  }
  if (playing >= 0) { const row = el.querySelector('.svPhrase.playing'); if (row) row.style.setProperty('--pos', (pos * 100).toFixed(1) + '%'); }
  const now = soundingNow(), live = JSON.stringify(now);
  if (live !== lastLive) {
    lastLive = live;
    for (const s of el.querySelectorAll('.live')) { const n = now[s.dataset.live]; s.textContent = n ? noteName(n.pitch) : ''; s.style.setProperty('--vel', n ? Math.round(n.vel / 127 * 100) + '%' : '0%'); s.parentElement.classList.toggle('sounding', !!n); }
  }
}

// ---- Actions -----------------------------------------------------------------------------------------
function changed(mutate, message) {
  withSongUndo(mutate);
  const song = state.song;
  state.phr = Math.min(state.phr, song.phrases.length - 1);
  if (message) state.message = message;
  syncPhraseUI(); syncSongView(true);
  setSongCursor(state.songCursor.row, state.songCursor.track);   // rows may have moved: the cursor row is the open phrase again
  state.dirty = true;
}
const blockOf = el => { const s = el.closest('.svSec'); return s ? model.blocks.find(b => String(b.ai) === s.dataset.ai && b.sec.id === s.dataset.sec) : null; };
const rowOf = el => { const r = el.closest('[data-row]'); return r ? model.rows[parseInt(r.dataset.row, 10)] : null; };
export function openRow(row, track) {
  if (!row) return false;
  return openPhrase(row.pi, row.block.si, track == null ? state.songCursor.track : track);
}
// The index into the rendered song's starts where a row first plays (for Play song from here).
function startOf(row) {
  const r = renderSong(state.song);
  return r.starts.findIndex(s => s.item === row.block.ai && s.slot === row.slotIndex && s.sectionRepeat === 0 && s.repeat === 0);
}
function onClick(e) {
  const song = state.song, act = e.target.closest('[data-act]'), cell = e.target.closest('.svCell');
  if (act) {
    const a = act.dataset.act, b = blockOf(act), r = rowOf(act);
    if (a === 'goItem') { const row = model.rows.find(x => x.block.ai === parseInt(act.dataset.ai, 10)); if (row) setSongCursor(row.index, state.songCursor.track, true); }
    else if (a === 'ptn' && r) { const ti = parseInt(act.closest('.svCell').dataset.t, 10); openRow(r, ti); state.cursor.row = Math.min(parseInt(act.dataset.prow, 10) || 0, song.phrases[r.pi].rows - 1); editPattern(act.dataset.pattern, song.tracks[ti].id); }
    else if (a === 'open' && r) openRow(r);
    else if (a === 'playSec' && b) { if (r) state.phr = r.pi; state.section = b.si; playSection(b.sec); }
    else if (a === 'slotUp' && r) changed(() => moveIn(r.block.sec.phrases, r.slotIndex, -1));
    else if (a === 'slotDown' && r) changed(() => moveIn(r.block.sec.phrases, r.slotIndex, 1));
    else if (a === 'slotRemove' && r) { let res; const name = song.phrases[r.pi].name; changed(() => { res = removeSlot(state.song, sectionById(state.song, r.block.sec.id), r.slotIndex); }); state.message = res === 'deleted' ? 'Removed ' + name + ' (its only use, so the phrase is gone · ⌘Z brings it back)' : res === 'kept' ? 'Took ' + name + ' out of this section; it is still used elsewhere' : 'A section keeps at least one phrase'; }
    else if (a === 'itemUp' && b) changed(() => moveIn(state.song.arrangement, b.ai, -1));
    else if (a === 'itemDown' && b) changed(() => moveIn(state.song.arrangement, b.ai, 1));
    else if (a === 'itemRemove' && b) { let ok; changed(() => { ok = removeItem(state.song, b.ai); }); state.message = ok ? (sectionsNotArranged(state.song).some(x => x.id === b.sec.id) ? b.sec.name + ' is out of the arrangement; it waits at the bottom until you add it back or delete it' : '') : 'The arrangement keeps at least one section'; }
    else if (a === 'arrange' && b) changed(() => { state.song.arrangement.push({ section: b.sec.id, repeat: 1 }); });
    else if (a === 'secDelete' && b) { let ok; changed(() => { ok = deleteSection(state.song, b.sec.id); }); state.message = ok ? 'Deleted section ' + b.sec.name + ' · ⌘Z brings it back' : 'The song keeps at least one arranged section'; }
    else if (a === 'ptnOpen') { const id = act.closest('.ptnCard').dataset.id; let trackId = null, pi = state.phr; song.phrases.forEach((p, i) => { for (const [tid, m] of Object.entries(p.material)) if (!trackId && (m.placements || []).some(x => x.pattern === id)) { trackId = tid; pi = i; } }); openPhrase(pi, null, trackId ? song.tracks.findIndex(t => t.id === trackId) : null); editPattern(id, trackId); }
    else if (a === 'ptnRemove') { const id = act.closest('.ptnCard').dataset.id; changed(() => removePattern(state.song, id), 'Removed the pattern; its placements are loose notes now'); }
    state.dirty = true; return;
  }
  if (cell && !e.target.closest('input, select, button')) {
    const row = parseInt(cell.dataset.row, 10), t = parseInt(cell.dataset.t, 10), same = row === state.songCursor.row && t === state.songCursor.track;
    setSongCursor(row, t);
    if (same || e.detail > 1) openRow(model.rows[row], t);   // a second tap on the cursor cell, or a double click, opens it
  }
}
function onChange(e) {
  const f = e.target.dataset.f; if (!f) return;
  const song = state.song, v = e.target.value, b = blockOf(e.target), r = rowOf(e.target);
  if (f === 'secName' && b) changed(() => { sectionById(state.song, b.sec.id).name = v.trim() || b.sec.name; });
  else if (f === 'itemRepeat' && b) changed(() => { state.song.arrangement[b.ai].repeat = Math.min(64, Math.max(1, parseInt(v, 10) || 1)); });
  else if (f === 'secKeyRoot' && b) changed(() => { const sec = sectionById(state.song, b.sec.id); sec.key = v === '' ? null : { root: parseInt(v, 10), scale: (sec.key && sec.key.scale) || (state.song.key && state.song.key.scale) || 'major' }; });
  else if (f === 'secKeyScale' && b) changed(() => { const sec = sectionById(state.song, b.sec.id); if (sec.key) sec.key.scale = v; });
  else if (f === 'phrName' && r) changed(() => { state.song.phrases[r.pi].name = v.trim() || song.phrases[r.pi].name; });
  else if (f === 'slotRepeat' && r) changed(() => { sectionById(state.song, r.block.sec.id).phrases[r.slotIndex].repeat = Math.min(64, Math.max(1, parseInt(v, 10) || 1)); });
  else if (f === 'ptnName') { const id = e.target.closest('.ptnCard').dataset.id; changed(() => { const p = patternById(state.song, id); if (p) p.name = v.trim() || p.name; }); }
  else if (f === 'addPhrase' && b && v) {
    const cur = model.rows[state.songCursor.row], like = song.phrases[cur && cur.block === b ? cur.pi : (b.rows[b.rows.length - 1] || {}).pi] || song.phrases[0];
    const after = cur && cur.block === b ? cur.slotIndex : null;
    let made = null;
    changed(() => { const s = state.song, sec = sectionById(s, b.sec.id), src = s.phrases.find(p => p.id === like.id);
      const phr = v === 'new' ? addPhrase(s, nextPhraseName(s, sec), src) : v === 'copy' ? copyPhrase(s, src, nextPhraseName(s, sec)) : s.phrases.find(p => 'id:' + p.id === v);
      if (phr) { addSlot(s, sec, phr.id, after); made = phr.id; } });
    if (made) { const row = model.rows.find(x => x.block.ai === b.ai && x.block.sec.id === b.sec.id && state.song.phrases[x.pi].id === made); if (row) setSongCursor(row.index, state.songCursor.track, true); }
  }
  else if (f === 'addSection' && v) {
    const cur = model.rows[state.songCursor.row], like = cur ? song.phrases[cur.pi] : song.phrases[0];
    changed(() => { const s = state.song; if (v === 'new') addSection(s, nextSectionName(s), s.phrases.find(p => p.id === like.id)); else { const sec = s.sections.find(x => 'id:' + x.id === v); if (sec) s.arrangement.push({ section: sec.id, repeat: 1 }); } });
    const last = model.blocks.filter(x => x.ai >= 0).pop(); if (last && last.rows[0]) setSongCursor(last.rows[0].index, state.songCursor.track, true);
  }
  $('songView').focus({ preventScroll: true });
}
// Play from the cursor row and keep going: through the phrase's repeats, the section's, then the next section.
// A section that is not in the arrangement has nowhere to go, so it loops; so does any section when asked to.
export function playHere(loopSection) {
  const row = model.rows[state.songCursor.row]; if (!row) return playSong(0);
  if (loopSection || row.block.ai < 0) { state.phr = row.pi; state.section = row.block.si; return playSection(row.block.sec); }
  const i = startOf(row); playSong(i >= 0 ? i : 0);
}
// Keys while the Song view is up. Arrows move the cell cursor, Enter opens, Space plays from here.
export function songKey(e) {
  const k = e.key, sh = e.shiftKey, c = state.songCursor, row = model.rows[c.row];
  if (e.ctrlKey || e.metaKey) { const l = k.toLowerCase(); if (l === 'z' && !sh) { undo(); syncPhraseUI(); return true; } if ((l === 'z' && sh) || l === 'y') { redo(); syncPhraseUI(); return true; } return false; }
  switch (k) {
    case 'ArrowUp': setSongCursor(c.row - 1, c.track, true); return true;
    case 'ArrowDown': setSongCursor(c.row + 1, c.track, true); return true;
    case 'ArrowLeft': setSongCursor(c.row, c.track - 1, true); return true;
    case 'ArrowRight': setSongCursor(c.row, c.track + 1, true); return true;
    case 'Home': setSongCursor(0, c.track, true); return true;
    case 'End': setSongCursor(model.rows.length - 1, c.track, true); return true;
    case 'Enter': openRow(row); return true;
    case 'Escape': stopAll(); return true;
    case ' ':
      if (sched.playing) stopAll();
      else playHere(sh);
      return true;
  }
  return false;
}
export function songStatus() {
  const row = model.rows[state.songCursor.row], song = state.song; if (!row) return '';
  const phr = song.phrases[row.pi], tr = song.tracks[state.songCursor.track], m = tr && phr.material[tr.id], pm = phraseMeter(phr);
  const names = ((m && m.placements) || []).map(pl => { const p = patternById(song, pl.pattern); return p ? placementLabel(pl, p.name) : ''; }).filter(Boolean);
  return '<b>' + esc(row.block.sec.name) + '</b> › <b>' + esc(phr.name) + '</b> ' + phr.rows + ' rows ' + pm.join('/') + ' · key <b>' + esc(keyName(keyFor(song, phr, row.block.sec))) + '</b>' +
    (tr ? ' · <b>' + esc(tr.name) + '</b> ' + (names.length ? esc(names.join(', ')) : 'no patterns') + ', ' + (m ? m.notes.length : 0) + ' loose' : '');
}
export function wireSongView() {
  const el = $('songBody');
  el.addEventListener('click', onClick);
  el.addEventListener('change', onChange);
  // Typing in a field must not move the cursor or play; Enter and Escape give the view its keys back.
  el.addEventListener('keydown', e => { if (e.target.matches('input, select')) { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') { e.target.blur(); $('songView').focus({ preventScroll: true }); } } });
}
