// Validates the built-in songs and instruments against the published JSON Schemas.
import Ajv2020 from 'ajv/dist/2020.js';
import { readFile } from 'node:fs/promises';
import { EXAMPLES } from '../src/core/examples.js';
import { newSong, orchestraSong } from '../src/core/song.js';
import { INSTRUMENTS } from '../src/core/instruments.js';
import { installBank } from '../src/core/banks.js';
for (const b of ['jazz', 'folk', 'electronica']) installBank(JSON.parse(await readFile(new URL('../banks/' + b + '/bank.json', import.meta.url))), 'file:///banks/' + b + '/bank.json');

const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addFormat('uri', /^https?:\/\/\S+$/);
const songSchema = JSON.parse(await readFile(new URL('../schema/tutti-song.schema.json', import.meta.url)));
const instSchema = JSON.parse(await readFile(new URL('../schema/tutti-instrument.schema.json', import.meta.url)));
const bankSchema = JSON.parse(await readFile(new URL('../schema/tutti-bank.schema.json', import.meta.url)));
ajv.addSchema(instSchema);
const validSong = ajv.compile(songSchema), validInst = ajv.compile(instSchema), validBank = ajv.compile(bankSchema);
const fails = [];
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails.push(name); };
const errs = v => (v.errors || []).slice(0, 3).map(e => e.instancePath + ' ' + e.message).join('; ');

check('schema: new song validates', validSong(orchestraSong()), errs(validSong));
for (const ex of EXAMPLES) {
  const s = JSON.parse(JSON.stringify(ex.build()));
  check('schema: example validates: ' + ex.title, validSong(s), errs(validSong));
  for (const tr of s.instruments) if (!INSTRUMENTS.some(i => i.id === tr.sound)) fails.push('unknown instrument ' + tr.sound);
}
for (const ins of INSTRUMENTS) check('schema: instrument validates: ' + ins.id, validInst(ins), errs(validInst));
{
  const { readdir } = await import('node:fs/promises');
  const dir = new URL('../banks/', import.meta.url);
  for (const d of (await readdir(dir, { withFileTypes: true })).filter(x => x.isDirectory())) {
    const b = JSON.parse(await readFile(new URL(d.name + '/bank.json', dir)));
    check('schema: bank validates: ' + d.name, validBank(b), errs(validBank));
  }
}
const bad = orchestraSong(); bad.phrases[0].material.fl = { notes: [{ tick: 0, len: 0, pitch: 60, vel: 100, col: 0, art: null }], dyn: [], expr: [] };
check('schema: rejects zero-length note', !validSong(bad));
for (const v of [2, 3]) { const old = JSON.parse(JSON.stringify(orchestraSong())); old.version = v; check('schema: rejects a version ' + v + ' file', !validSong(old)); }
const flat = JSON.parse(JSON.stringify(orchestraSong())); delete flat.sections;
check('schema: a saved song names its sections', !validSong(flat));
const withPattern = orchestraSong(); withPattern.patterns.push({ id: 'p', name: 'P', rows: 8, ticksPerRow: 240, columns: 1, material: { notes: [{ tick: 0, len: 240, pitch: 60, vel: 100, col: 0, art: null }], dyn: [], expr: [], fx: [], placements: [] } });
withPattern.phrases[0].material.fl = { notes: [], dyn: [], expr: [], fx: [], placements: [{ pattern: 'p', row: 4, transpose: 5, shift: -2, octave: 1, dynamics: -16, repeat: 2 }] };
check('schema: pattern and placement validate', validSong(withPattern), errs(validSong));
withPattern.phrases[0].material.fl.placements[0].chain = 'x';
check('schema: placement rejects unknown fields', !validSong(withPattern));
delete withPattern.phrases[0].material.fl.placements[0].chain;
withPattern.patterns[0].material.placements = [{ pattern: 'p', row: 0 }];
check('schema: a pattern cannot place a pattern', !validSong(withPattern));
withPattern.patterns[0].material.placements = [];
withPattern.arrangement[0].follows = { fl: 1 };
check('schema: follows is gone', !validSong(withPattern));
{
  const { normalizeSong, arrangementText } = await import('../src/core/song.js');
  const md = await readFile(new URL('../docs/domain.md', import.meta.url), 'utf8');
  const example = JSON.parse(md.match(/```json\n([\s\S]*?)```/)[1].replace('"c1f0…"', '"c1f0"'));
  check('docs: the domain model example validates', validSong(example), errs(validSong));
  let text = ''; try { text = arrangementText(normalizeSong(example)); } catch (e) { text = e.message; }
  check('docs: the domain model example loads as A×2 Bridge A', text === 'A×2 Bridge A', text);
}
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
process.exit(fails.length ? 1 : 0);
