// Session location: the URL hash names the open song and phrase (#song=<uid>&phrase=<id>) so a refresh,
// a bookmark, or a shared link reopens the same place. The last opened song is also remembered as a
// fallback for a bare URL.
import { state } from './state.js';

const LAST = 'tutti.last';
export function locationFor() {
  const phr = state.song.phrases[state.phr];
  return '#song=' + encodeURIComponent(state.song.uid) + (state.phr && phr ? '&phrase=' + encodeURIComponent(phr.id) : '');
}
export function updateLocation() {
  const h = locationFor();
  if (location.hash !== h) history.replaceState(null, '', h);
  try { localStorage.setItem(LAST, state.song.uid); } catch { /* storage unavailable */ }
}
export function parseLocation() {
  const q = new URLSearchParams(location.hash.replace(/^#/, ''));
  return { uid: q.get('song'), phrase: q.get('phrase') };
}
// Song index and phrase to open at startup: the URL first, then the last opened song.
export function restoreLocation() {
  const loc = parseLocation();
  let uid = loc.uid;
  if (!uid || !state.songs.some(s => s.uid === uid)) { try { uid = localStorage.getItem(LAST); } catch { uid = null; } }
  const index = state.songs.findIndex(s => s.uid === uid);
  if (index < 0) return null;
  const phr = loc.uid === uid && loc.phrase ? state.songs[index].phrases.findIndex(p => p.id === loc.phrase) : 0;
  return { index, phr: Math.max(0, phr) };
}
