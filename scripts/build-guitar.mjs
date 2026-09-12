// Build the jazz bank's guitar from FreePats' Spanish Classical Guitar (CC0): download the SFZ+FLAC
// archive, read the SFZ key mapping, encode each sample to mono AAC, and write banks/jazz/guitar/map.json.
// Run: node scripts/build-guitar.mjs
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import os from 'node:os';
const run = promisify(execFile);
const URL7Z = 'https://freepats.zenvoid.org/Guitar/SpanishClassicalGuitar/SpanishClassicalGuitar-SFZ+FLAC-20190618.7z';
const OUT = new URL('../banks/jazz/guitar/', import.meta.url).pathname;
const tmp = await (await import('node:fs/promises')).mkdtemp(path.join(os.tmpdir(), 'scg-'));
const arc = path.join(tmp, 'scg.7z');
await writeFile(arc, Buffer.from(await (await fetch(URL7Z)).arrayBuffer()));
await run('bsdtar', ['-xf', arc, '-C', tmp]);
const root = path.join(tmp, (await readdir(tmp)).find(n => n.startsWith('SpanishClassicalGuitar')));
const sfz = await readFile((await readdir(root)).filter(n => n.endsWith('.sfz')).map(n => path.join(root, n))[0], 'utf8');
// regions: <region> sample=... lokey=.. hikey=.. pitch_keycenter=..  (values may be note names or numbers)
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const num = v => /^-?\d+$/.test(v) ? parseInt(v, 10) : (m => m ? NOTE[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12 : null)(/^([A-Ga-g])([#b]?)(-?\d)$/.exec(v));
const regions = [];
let defaults = {};
for (const block of sfz.split(/(?=<region>|<group>|<global>|<control>)/)) {
  const kv = Object.fromEntries([...block.matchAll(/(\w+)=([^\s]+)/g)].map(m => [m[1], m[2]]));
  if (block.startsWith('<group>') || block.startsWith('<global>')) { defaults = Object.assign({}, defaults, kv); continue; }
  if (!block.startsWith('<region>') || !kv.sample) continue;
  const r = Object.assign({}, defaults, kv);
  const key = r.pitch_keycenter != null ? num(r.pitch_keycenter) : num(r.key || r.lokey);
  regions.push({ sample: r.sample.replace(/\\/g, '/'), key, lovel: r.lovel ? +r.lovel : 0, hivel: r.hivel ? +r.hivel : 127 });
}
await mkdir(OUT, { recursive: true });
const zones = [];
const byKey = new Map();
for (const r of regions) { if (!byKey.has(r.key)) byKey.set(r.key, []); byKey.get(r.key).push(r); }
for (const [key, list] of byKey) {
  list.sort((a, b) => a.hivel - b.hivel);
  const picks = list.length > 1 ? [list[0], list[list.length - 1]] : list;
  for (let li = 0; li < picks.length; li++) {
    const src = path.join(root, picks[li].sample), out = path.join(OUT, `sus_n${key}_${li}.m4a`);
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-ac', '1', '-ar', '44100', '-t', '4', '-af', 'afade=t=out:st=3.2:d=0.8', '-c:a', 'aac', '-b:a', '56k', out]);
    zones.push({ art: 'sus', note: key, layer: picks.length > 1 ? li / (picks.length - 1) : 1, file: path.basename(out), source: 'FreePats SpanishClassicalGuitar-20190618/' + picks[li].sample });
    process.stdout.write(`guitar n${key} L${li}\n`);
  }
}
zones.sort((a, b) => a.note - b.note || a.layer - b.layer);
await writeFile(path.join(OUT, 'map.json'), JSON.stringify({ instrument: 'guitar', source: 'FreePats Spanish Classical Guitar (CC0), converted', license: 'CC0-1.0', zones }, null, 1) + '\n');
console.log('guitar: ' + zones.length + ' zones, keys ' + Math.min(...zones.map(z => z.note)) + '-' + Math.max(...zones.map(z => z.note)));
