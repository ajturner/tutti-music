// Build the bundled sample set from VSCO 2 Community Edition (CC0, github.com/sgossner/VSCO-2-CE).
// For each Tutti instrument and articulation it lists the source folder, keeps one round robin per
// note at the softest and loudest dynamic layers, downloads the WAVs, trims and encodes them to mono
// AAC, and writes samples/<instrument>/map.json. Run: node scripts/build-samples.mjs [instrument...]
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const run = promisify(execFile);
import { execFileSync } from 'node:child_process';
let _tok;
function ghToken() { if (_tok === undefined) { try { _tok = execFileSync('gh', ['auth', 'token']).toString().trim(); } catch { _tok = ''; } } return _tok; }   // authenticated API calls: 5000/h instead of 60/h

export const REPOS = { VSCO: 'sgossner/VSCO-2-CE', VCSL: 'sgossner/VCSL' };
const REPO = REPOS.VSCO, RAW = 'https://raw.githubusercontent.com/' + REPO + '/master/';
const OUT = new URL('../samples/', import.meta.url).pathname;
const SECONDS = { sus: 6, trm: 6, rll: 6, mut: 6, stc: 3, piz: 4 };
export const NOTE_NUM = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// VSCO names octaves one lower than scientific pitch (its C3 is MIDI 60).
export const midiOf = s => { const m = /^([A-G])(#?)(-?\d)$/.exec(s); return m ? NOTE_NUM[m[1]] + (m[2] ? 1 : 0) + (parseInt(m[3], 10) + 2) * 12 : null; };

// instrument -> articulation -> source folder. Missing articulations fall back in the sampler.
const SOURCES = {
  'violins-1': { dir: 'Strings/Violin Section', arts: { sus: 'susVib', stc: 'Spic', piz: 'Pizz', trm: 'Trem' } },
  'violins-2': { alias: 'violins-1' },
  'violas':    { dir: 'Strings/Viola Section',  arts: { sus: 'susvib', stc: 'spic', piz: 'pizz', trm: 'trem' } },
  'cellos':    { dir: 'Strings/Cello Section',  arts: { sus: 'susvib', stc: 'spic', piz: 'pizzT', trm: 'trem' } },
  'basses':    { dir: 'Strings/Solo Contrabass', arts: { sus: 'SusVib', stc: 'Spic', piz: 'Pizz', trm: 'Trem' } },
  'horns':     { dir: 'Brass/F Horn',           arts: { sus: 'sus', stc: 'stac', mut: 'mute' } },
  'trumpets':  { dir: 'Brass/Trumpet',          arts: { sus: 'sus', stc: 'stac', mut: 'straightM-sus' } },
  'trombones': { dir: 'Brass/Tenor Trombone',   arts: { sus: 'sus', stc: 'stac' } },
  'flute':     { dir: 'Woodwinds/Flute',        arts: { sus: 'susvib', stc: 'stac' } },
  'oboe':      { dir: 'Woodwinds/Oboe',         arts: { sus: 'Sus', stc: 'Stacc' } },
  'clarinet':  { dir: 'Woodwinds/Clarinet',     arts: { sus: 'susLong', stc: 'stac' } },
  'bassoon':   { dir: 'Woodwinds/Bassoon',      arts: { sus: 'sus', stc: 'stac' } },
  'timpani':   { dir: 'Percussion/Timpani',     arts: { sus: '.', rll: 'Rolls' } },
};

export async function gh(pathname, repo = REPO) {
  const url = 'https://api.github.com/repos/' + repo + '/contents/' + pathname.split('/').map(encodeURIComponent).join('/');
  const headers = { 'User-Agent': 'tutti-build', Accept: 'application/vnd.github+json' };
  const token = process.env.GITHUB_TOKEN || ghToken(); if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(url + ' ' + res.status);
  return res.json();
}
// Parse "<prefix>_<art>_<NOTE>_v<N>[_rr<K>|_<K>][_Sum|_Main|_sum].wav" and timpani "TimpaniN_Hit_vN_rrK_Sum.wav".
export function parseName(name) {
  const base = name.replace(/\.wav$/i, '');
  const m = /(?:^|_)([A-G]#?-?\d)_v(\d+)(?:_(?:rr)?(\d+))?/.exec(base);
  if (m) return { note: midiOf(m[1]), layer: parseInt(m[2], 10), rr: m[3] ? parseInt(m[3], 10) : 1, drum: null };
  const t = /^Timpani(\d)_(?:Hit|Roll)_v(\d+)_rr(\d+)/.exec(base);
  if (t) return { note: null, layer: parseInt(t[2], 10), rr: parseInt(t[3], 10), drum: parseInt(t[1], 10) };
  return null;
}
// Timpani drums carry no note in their names; these were measured from the roll samples (see wavPitch for the
// method, which is unreliable on decaying hits). Override the estimate with the measured value.
const TIMPANI_PITCH = { 1: 42, 2: 35, 3: 48, 4: 49, 5: 53 };
// Pitch of a WAV by autocorrelation.
export function wavPitch(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let p = 12, fmt = null, data = null;
  while (p + 8 <= view.byteLength) {
    const id = String.fromCharCode(...buf.subarray(p, p + 4)), size = view.getUint32(p + 4, true);
    if (id === 'fmt ') fmt = { tag: view.getUint16(p + 8, true), ch: view.getUint16(p + 10, true), rate: view.getUint32(p + 12, true), bits: view.getUint16(p + 22, true) };
    if (id === 'data') { data = [p + 8, size]; break; }
    p += 8 + size + (size & 1);
  }
  if (!fmt || !data) return null;
  const bytes = fmt.bits / 8, frames = Math.min(Math.floor(data[1] / bytes / fmt.ch), fmt.rate * 2);
  const x = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    const o = data[0] + i * bytes * fmt.ch;
    x[i] = fmt.tag === 3 ? view.getFloat32(o, true) : bytes === 2 ? view.getInt16(o, true) / 32768 : bytes === 3 ? ((view.getUint8(o) | view.getUint8(o + 1) << 8 | view.getInt8(o + 2) << 16) / 8388608) : view.getInt32(o, true) / 2147483648;
  }
  // normalised autocorrelation; take the SHORTEST lag whose peak is within 85% of the best, which
  // avoids the sub-octave errors a plain maximum makes on rich or decaying tones
  const start = Math.floor(fmt.rate * 0.2), n = Math.min(x.length - start, fmt.rate);
  if (n < fmt.rate / 10) return null;
  const lo = Math.floor(fmt.rate / 2000), hi = Math.floor(fmt.rate / 35);
  let e = 0; for (let i = start; i < start + n; i++) e += x[i] * x[i];
  if (!e) return null;
  const ac = new Float64Array(hi + 2); let best = 0;
  for (let lag = lo; lag <= hi; lag++) { let s = 0; for (let i = start; i < start + n - lag; i += 2) s += x[i] * x[i + lag]; ac[lag] = s * 2 / e; if (ac[lag] > best) best = ac[lag]; }
  for (let lag = lo; lag <= hi; lag++) if (ac[lag] >= best * 0.85 && ac[lag] >= ac[lag - 1] && ac[lag] >= ac[lag + 1]) return Math.round(69 + 12 * Math.log2(fmt.rate / lag / 440));
  return null;
}
export async function download(pathname, repo = REPO) {
  const res = await fetch('https://raw.githubusercontent.com/' + repo + '/master/' + pathname.split('/').map(encodeURIComponent).join('/'));
  if (!res.ok) throw new Error(pathname + ' ' + res.status);
  return Buffer.from(await res.arrayBuffer());
}
export async function encode(wav, out, seconds) {
  const tmp = out + '.wav'; await writeFile(tmp, wav);
  const fade = Math.max(0.3, seconds - 0.8);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-ac', '1', '-ar', '44100', '-t', String(seconds), '-af', `afade=t=out:st=${fade}:d=0.8`, '-c:a', 'aac', '-b:a', '56k', out]);
  await run('rm', [tmp]);
}
export async function build(id) {
  const src = SOURCES[id]; if (src.alias) return;
  const dir = path.join(OUT, id); await mkdir(dir, { recursive: true });
  const zones = []; let n = 0;
  for (const [art, sub] of Object.entries(src.arts)) {
    const folder = sub === '.' ? src.dir : src.dir + '/' + sub;
    const files = (await gh(folder)).filter(f => f.type === 'file' && /\.wav$/i.test(f.name)).map(f => ({ name: f.name, meta: parseName(f.name) })).filter(f => f.meta);
    // group by note (or drum) and keep the softest and loudest layer, first round robin
    const groups = new Map();
    for (const f of files) { const k = f.meta.drum != null ? 'd' + f.meta.drum : 'n' + f.meta.note; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(f); }
    for (const [k, list] of groups) {
      const layers = [...new Set(list.map(f => f.meta.layer))].sort((a, b) => a - b);
      const pick = layers.length > 1 ? [layers[0], layers[layers.length - 1]] : layers;
      for (let li = 0; li < pick.length; li++) {
        const f = list.filter(x => x.meta.layer === pick[li]).sort((a, b) => a.meta.rr - b.meta.rr)[0];
        const out = path.join(dir, `${art}_${k}_${li}.m4a`), rel = folder + '/' + f.name;
        let note = f.meta.note;
        let wav = null;
        try { await stat(out); } catch { wav = await download(rel); await encode(wav, out, SECONDS[art] || 6); }
        if (note == null) note = f.meta.drum != null && TIMPANI_PITCH[f.meta.drum] ? TIMPANI_PITCH[f.meta.drum] : wavPitch(wav || (wav = await download(rel)));
        zones.push({ art, note, layer: pick.length > 1 ? li / (pick.length - 1) : 1, file: path.basename(out), source: rel });
        n++; process.stdout.write(`${id} ${art} ${k} L${li} -> ${note}\n`);
      }
    }
  }
  zones.sort((a, b) => a.art.localeCompare(b.art) || a.note - b.note || a.layer - b.layer);
  await writeFile(path.join(dir, 'map.json'), JSON.stringify({ instrument: id, source: 'VSCO 2 Community Edition (CC0) by Versilian Studios, converted', license: 'CC0-1.0', zones }, null, 1) + '\n');
  console.log(id + ': ' + n + ' samples');
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SOURCES);
for (const id of wanted) { try { await build(id); } catch (e) { console.error('FAILED', id, e.message); } }
// aliases share a folder: violins-2 uses violins-1's map
await writeFile(path.join(OUT, 'index.json'), JSON.stringify({ instruments: Object.fromEntries(Object.entries(SOURCES).map(([id, s]) => [id, s.alias || id])) }, null, 1) + '\n');
}
