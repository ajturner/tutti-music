// Sound banks: JSON files that add instruments (and their sample folders) at run time. The bundled
// catalogue lives in banks/index.json; any URL to a bank.json works too. Songs record the banks they
// use so opening a song loads them first.
import { INST, INSTRUMENTS, registerInstrument, unregisterInstrument, placeholderInstrument } from './instruments.js';

export const banks = new Map();          // id -> { id, name, description, url, instruments: [ids], includes: [ids], builtin }
banks.set('orchestra', { id: 'orchestra', name: 'Symphony orchestra', description: 'Woodwinds, brass, timpani and strings from VSCO 2 CE, plus two synths. Built in.', license: 'CC0-1.0', url: '', instruments: INSTRUMENTS.map(i => i.id), includes: [], builtin: true });
let catalog = null, catalogUrl = null;

export function setCatalogUrl(url) { catalogUrl = url; catalog = null; }
export async function loadCatalog() {
  if (catalog) return catalog;
  try { const r = await fetch(catalogUrl); catalog = r.ok ? (await r.json()).banks || [] : []; } catch { catalog = []; }
  return catalog;
}
export function catalogEntry(id) { return (catalog || []).find(b => b.id === id) || null; }
// Register a bank from its parsed JSON. `url` is where it came from, used to resolve sample folders.
export function installBank(json, url) {
  if (!json || !json.id || !Array.isArray(json.instruments)) throw new Error('not a Tutti bank');
  const base = url ? new URL('.', url).href : '';
  const ids = [];
  for (const def of json.instruments) {
    const d = Object.assign({}, def);
    if (d.samples && base) d.samples = new URL(d.samples.replace(/\/?$/, '/'), base).href;
    registerInstrument(d, json.id); ids.push(d.id);
  }
  const includes = (json.include || []).filter(id => INST[id]);
  banks.set(json.id, { id: json.id, name: json.name || json.id, description: json.description || '', license: json.license || '', url: url || '', instruments: ids, includes });
  return banks.get(json.id);
}
export async function loadBank(idOrUrl) {
  if (banks.has(idOrUrl)) return banks.get(idOrUrl);
  let url = idOrUrl;
  if (!/^https?:|^\.\.?\/|^\//.test(idOrUrl)) { await loadCatalog(); const e = catalogEntry(idOrUrl); if (!e) throw new Error('unknown bank ' + idOrUrl); url = new URL(e.url, catalogUrl).href; }
  const r = await fetch(url); if (!r.ok) throw new Error('bank ' + idOrUrl + ' ' + r.status);
  return installBank(await r.json(), url);
}
export function unloadBank(id, inUse = () => false) {
  const b = banks.get(id); if (!b || b.builtin) return false;
  for (const iid of b.instruments) if (!inUse(iid)) unregisterInstrument(iid);
  banks.delete(id); return true;
}
// Synchronous part: stand-ins for unknown instruments so the UI can draw the song immediately.
export function placeholdersFor(song) {
  const made = [];
  for (const tr of song.tracks) if (!INST[tr.instrument]) { placeholderInstrument(tr.instrument); made.push(tr.instrument); }
  return made;
}
// Make sure every instrument a song uses exists: load its banks, and stand in for anything still missing.
export async function ensureSongBanks(song) {
  const missing = [];
  for (const id of song.banks || []) { try { await loadBank(id); } catch { missing.push(id); } }
  for (const tr of song.tracks) if (!INST[tr.instrument] || INST[tr.instrument].bank === 'missing') { if (!INST[tr.instrument]) placeholderInstrument(tr.instrument); missing.push(tr.instrument); }
  return missing;
}
export const bankOf = instrumentId => (INST[instrumentId] || {}).bank || null;
