// The map: where you are in the song and how to move between its levels. A song is read top to bottom as
// Song › Section › Phrase › Pattern. The Song level is the overview (songview.js); the Phrase level is the grid;
// a Pattern opens alone in the same grid. Enter drills in, the backquote key or a crumb goes back out.
import { phraseMeter, placementLabel, sectionsOfPhrase } from '../core/song.js';
import { keyName } from '../core/scales.js';
import { $, curPattern, curPhrase, curSection, sched, state } from './state.js';
import { editPatternHere, leavePattern, placementHere } from './edit.js';
import { esc, syncKeyUI, syncPhraseUI } from './sync.js';
import { setPanel } from './panels.js';

export function setLevel(level) {
  state.level = level === 'song' ? 'song' : 'grid';
  document.body.dataset.level = state.level;
  $('songView').hidden = state.level !== 'song';
  // the transport says what it will do at this level
  const song = state.level === 'song', play = $('playPhrase'), sec = $('playSection'), all = $('playSong');
  play.querySelector('.full').textContent = song ? 'Play from here' : 'Play phrase';
  play.title = song ? 'Play the arrangement on from the cursor row, through every repeat (Space)' : 'Loop the open phrase (Space)';
  sec.textContent = 'Loop section'; sec.title = 'Loop the section under the cursor on its own until you stop it' + (song ? ' (⇧Space)' : '');
  all.title = song ? 'Play the arrangement from the top' : 'Play the arrangement from where the open phrase first sounds (Enter)';
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
  if (trackIndex != null && trackIndex >= 0) { state.cursor.track = Math.min(trackIndex, song.instruments.length - 1); state.cursor.cell = 0; state.ensureVisible = true; }
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
  const SETS = { song: 'Song key', section: 'Section key', phrase: 'Phrase: name, rows, row size, meter, groove, key', pattern: 'Pattern: name and rows' };
  const crumb = (lvl, label, name, detail, enabled, title) => `<span class="crumbWrap"><button class="crumb${level === lvl ? ' on' : ''}" data-level="${lvl}"${enabled ? '' : ' disabled'} title="${esc(title)}"><small>${label}</small><b>${name}</b>${detail ? '<span>' + detail + '</span>' : ''}</button>${enabled && (lvl !== 'pattern' || ptn) ? `<button class="crumbSet" data-set="${lvl}" title="${SETS[lvl]}" aria-label="${SETS[lvl]}">▾</button>` : ''}</span>`;
  el.innerHTML =
    crumb('song', 'Song', esc(song.title || 'Untitled'), song.sections.length + ' section' + (song.sections.length === 1 ? '' : 's'), true, 'The whole song: sections, phrases and patterns at a glance (` goes out a level)') + '<span class="sep">›</span>' +
    crumb('section', 'Section', sec ? esc(sec.name) + times(item ? item.repeat : 1) : '—', sec && sec.key ? esc(keyName(sec.key)) : '', !!sec, 'This section in the Song view') + '<span class="sep">›</span>' +
    crumb('phrase', 'Phrase', phr ? esc(phr.name) + times(slot ? slot.repeat : 1) : '—', phr ? phr.rows + ' rows · ' + pm.join('/') : '', !!phr, 'This phrase in the grid') + '<span class="sep">›</span>' +
    crumb('pattern', 'Pattern', ptn ? esc(ptn.name) : here ? esc(placementLabel(here.placement, here.pattern.name)) : '—', ptn ? ptn.rows + ' rows' : '', !!ptn || !!here, ptn ? 'The pattern open in the grid' : 'Open the pattern under the cursor (Enter)') +
    '<span class="spacer"></span>' + (now ? '<span class="now" title="Playing now">▶ ' + esc(now) + '</span>' : '');
}
// The settings of a level, in one sheet: the song's key, a section's key, or the open phrase (or pattern) with its
// name, rows, row size, meter, groove and key. Opened from the ▾ beside each crumb.
export function openLevel(scope) {
  const el = $('levelPanel'), song = state.song, sec = curSection(), phr = curPhrase(), ptn = curPattern();
  if (scope === 'pattern') scope = 'phrase';
  if (scope === 'section' && !sec) scope = 'song';
  $('keyScope').value = scope; syncKeyUI();
  el.dataset.scope = ptn && scope === 'phrase' ? 'pattern' : scope;
  $('levelTitle').textContent = scope === 'song' ? 'Song · ' + (song.title || 'Untitled') : scope === 'section' ? 'Section · ' + sec.name : ptn ? 'Pattern · ' + ptn.name : 'Phrase · ' + (phr ? phr.name : '');
  if (state.panel !== 'level') setPanel('level');
}
export function wireMap({ focusSection } = {}) {
  $('keyScope').addEventListener('change', () => { if (state.panel === 'level') openLevel($('keyScope').value); });
  $('map').addEventListener('click', e => {
    const set = e.target.closest('button[data-set]'); if (set) { if (state.panel === 'level' && $('levelPanel').dataset.scope === set.dataset.set) setPanel(null); else openLevel(set.dataset.set); return; }
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
