// Session location: the URL hash names the open song and pattern (#song=<uid>&pat=<n>) so a refresh,
// a bookmark, or a shared link reopens the same place. The last opened song is also remembered as a
// fallback for a bare URL.
import { clamp } from '../core/constants.js';
import { state } from './state.js';

const LAST = 'tutti.last';
export function locationFor() {
  return '#song=' + encodeURIComponent(state.song.uid) + (state.pat ? '&pat=' + state.pat : '');
}
export function updateLocation() {
  const h = locationFor();
  if (location.hash !== h) history.replaceState(null, '', h);
  try { localStorage.setItem(LAST, state.song.uid); } catch { /* storage unavailable */ }
}
export function parseLocation() {
  const q = new URLSearchParams(location.hash.replace(/^#/, ''));
  return { uid: q.get('song'), pat: parseInt(q.get('pat'), 10) };
}
// Song index and pattern to open at startup: the URL first, then the last opened song.
export function restoreLocation() {
  const loc = parseLocation();
  let uid = loc.uid;
  if (!uid || !state.songs.some(s => s.uid === uid)) { try { uid = localStorage.getItem(LAST); } catch { uid = null; } }
  const index = state.songs.findIndex(s => s.uid === uid);
  if (index < 0) return null;
  const pat = Number.isInteger(loc.pat) && loc.uid === uid ? clamp(loc.pat, 0, state.songs[index].patterns.length - 1) : 0;
  return { index, pat };
}
