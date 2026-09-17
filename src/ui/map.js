// The map: where you are in the song and how to move between its levels. A song is read top to bottom as
// Song › Section › Phrase › Pattern. The Song level is the overview (songview.js); the Phrase level is the grid;
// a Pattern opens alone in the same grid. Enter drills in, the backquote key or a crumb goes back out.
import { phraseMeter, placementLabel, sectionsOfPhrase } from '../core/song.js';
import { keyName } from '../core/scales.js';
import { $, curPattern, curPhrase, curSection, sched, state } from './state.js';
import { editPatternHere, leavePattern, placementHere } from './edit.js';
import { esc, syncPhraseUI } from './sync.js';

export function setLevel(level) {
  state.level = level === 'song' ? 'song' : 'grid';
  document.body.dataset.level = state.level;
  $('songView').hidden = state.level !== 'song';
  state.dirty = true;
  if (state.level === 'song') $('songView').focus({ preventScroll: true }); else $('grid').focus({ preventScroll: true });
}
// The overview of the whole song.
export function openSong() { leavePattern(); setLevel('song'); state.message = ''; return true; }
// A phrase in the grid, seen in one of its sections, with the cursor on a track.
export function openPhrase(phraseIndex, sectionIndex, trackIndex) {
  const song = state.song; if (!song.phrases[phraseIndex]) return false;
  leavePattern();
  state.phr = phraseIndex;
  if (sectionIndex != null && song.sections[sectionIndex]) state.section = sectionIndex;
  else { const sec = sectionsOfPhrase(song, song.phrases[phraseIndex].id)[0]; if (sec && !curSection()) state.section = song.sections.indexOf(sec); }
  if (trackIndex != null && trackIndex >= 0) { state.cursor.track = Math.min(trackIndex, song.tracks.length - 1); state.cursor.cell = 0; state.ensureVisible = true; }
  state.cursor.row = Math.min(state.cursor.row, curPhrase().rows - 1);
  state.sel = null; state.selAnchor = null; state.typing = null; state.message = '';
  setLevel('grid'); syncPhraseUI();
  return true;
}
// One level out: pattern → phrase → song. Returns false at the top.
export function levelUp() {
  if (state.patternEdit) return leavePattern();
  if (state.level === 'grid') return openSong();
  return false;
}
// One level in from the grid: the pattern under the cursor. (The Song view drills in itself.)
export function levelDown() { return state.level === 'grid' ? editPatternHere() : false; }

let sig = '';
export function syncMap() {
  const el = $('map'); if (!el) return;
  const song = state.song, phr = song.phrases[state.phr], sec = curSection(), ptn = curPattern(), here = state.level === 'grid' && !ptn ? placementHere() : null;
  const item = sec ? song.arrangement.find(it => it.section === sec.id) : null, slot = sec && phr ? sec.phrases.find(sl => sl.phrase === phr.id) : null;
  const pm = phr ? phraseMeter(phr) : [4, 4];
  // where the playhead is, in the song's own words
  let now = '';
  const tick = sched.positionTick();
  if (tick != null && sched.rendered && !sched.rendered.pattern) {
    const st = sched.rendered.starts.find(s => tick >= s.tick && tick < s.tick + s.rows * s.ticksPerRow);
    if (st) { const ps = song.sections.find(x => x.id === st.section), pp = song.phrases[st.phrase]; now = (ps ? ps.name + ' › ' : '') + (pp ? pp.name : '') + (st.repeat ? ' ×' + (st.repeat + 1) : ''); }
  }
  const level = ptn ? 'pattern' : state.level === 'song' ? 'song' : 'phrase';
  const parts = [level, song.title, sec ? sec.name + '|' + (item ? item.repeat : 0) + '|' + keyName(sec.key) : '', phr ? phr.name + '|' + phr.rows + '|' + pm.join('/') + '|' + (slot ? slot.repeat : 1) : '', ptn ? ptn.name + '|' + ptn.rows : here ? placementLabel(here.placement, here.pattern.name) : '', now, song.sections.length];
  const next = parts.join('~|~'); if (next === sig) return; sig = next;
  const times = n => n > 1 ? ' <i>×' + n + '</i>' : '';
  const crumb = (lvl, label, name, detail, enabled, title) => `<button class="crumb${level === lvl ? ' on' : ''}" data-level="${lvl}"${enabled ? '' : ' disabled'} title="${esc(title)}"><small>${label}</small><b>${name}</b>${detail ? '<span>' + detail + '</span>' : ''}</button>`;
  el.innerHTML =
    crumb('song', 'Song', esc(song.title || 'Untitled'), song.sections.length + ' section' + (song.sections.length === 1 ? '' : 's'), true, 'The whole song: sections, phrases and patterns at a glance (` goes out a level)') + '<span class="sep">›</span>' +
    crumb('section', 'Section', sec ? esc(sec.name) + times(item ? item.repeat : 1) : '—', sec && sec.key ? esc(keyName(sec.key)) : '', !!sec, 'This section in the Song view') + '<span class="sep">›</span>' +
    crumb('phrase', 'Phrase', phr ? esc(phr.name) + times(slot ? slot.repeat : 1) : '—', phr ? phr.rows + ' rows · ' + pm.join('/') : '', !!phr, 'This phrase in the grid') + '<span class="sep">›</span>' +
    crumb('pattern', 'Pattern', ptn ? esc(ptn.name) : here ? esc(placementLabel(here.placement, here.pattern.name)) : '—', ptn ? ptn.rows + ' rows' : here ? 'Enter opens' : '', !!ptn || !!here, ptn ? 'The pattern open in the grid' : 'Open the pattern under the cursor (Enter)') +
    '<span class="spacer"></span>' + (now ? '<span class="now" title="Playing now">▶ ' + esc(now) + '</span>' : '');
}
export function wireMap({ focusSection } = {}) {
  $('map').addEventListener('click', e => {
    const b = e.target.closest('button[data-level]'); if (!b || b.disabled) return;
    const lvl = b.dataset.level;
    if (lvl === 'song') openSong();
    else if (lvl === 'section') { openSong(); if (focusSection) focusSection(state.section); }
    else if (lvl === 'phrase') openPhrase(state.phr, state.section);
    else if (lvl === 'pattern' && !state.patternEdit) { if (state.level !== 'grid') openPhrase(state.phr, state.section); editPatternHere(); }
    state.dirty = true;
  });
  document.body.dataset.level = state.level;
}
