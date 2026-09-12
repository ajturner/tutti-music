// Autosave: songs persist in this browser's localStorage. Every song that was created, loaded, or
// edited is stored under its uid; built-in examples are stored only once edited and can be reset.
import { EXAMPLES } from '../core/examples.js';
import { normalizeSong } from '../core/song.js';
import { state } from './state.js';

const KEY = 'tutti.songs.v1';
export const persisted = new Set();      // uids of songs that are written on save
let timer = 0;

function store() {
  try { return globalThis.localStorage; } catch { return null; }
}
export function saveNow() {
  const ls = store(); if (!ls) return false;
  const songs = state.songs.filter(s => persisted.has(s.uid));
  try { ls.setItem(KEY, JSON.stringify(songs)); return true; } catch { return false; }
}
// Called after any edit: remembers the current song and writes shortly after the last change.
export function markEdited(song = state.song) {
  if (song && song.uid) persisted.add(song.uid);
  clearTimeout(timer); timer = setTimeout(saveNow, 400);
}
// Merge stored songs into the list: an edited example replaces the built-in copy in place,
// anything else is appended. Returns how many were restored.
export function restoreSongs() {
  const ls = store(); if (!ls) return 0;
  let stored = [];
  try { stored = JSON.parse(ls.getItem(KEY) || '[]'); } catch { stored = []; }
  let n = 0;
  for (const raw of stored) {
    let s; try { s = normalizeSong(raw); } catch { continue; }
    const i = state.songs.findIndex(x => x.uid === s.uid);
    if (i >= 0) state.songs[i] = s; else state.songs.push(s);
    persisted.add(s.uid); n++;
  }
  if (state.songs.length) state.song = state.songs[Math.min(state.songIndex, state.songs.length - 1)];
  return n;
}
// Remove the current song from storage; a built-in example returns to its pristine copy.
// Returns the index to select afterwards.
export function deleteCurrentSong() {
  const i = state.songIndex, s = state.song;
  persisted.delete(s.uid);
  const ex = EXAMPLES.find(e => e.uid === s.uid);
  if (ex) state.songs[i] = ex.build();
  else state.songs.splice(i, 1);
  saveNow();
  return Math.min(i, state.songs.length - 1);
}
