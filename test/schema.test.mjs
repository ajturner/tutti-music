// Validates the built-in songs and instruments against the published JSON Schemas.
import Ajv2020 from 'ajv/dist/2020.js';
import { readFile } from 'node:fs/promises';
import { EXAMPLES } from '../src/core/examples.js';
import { newSong } from '../src/core/song.js';
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

check('schema: new song validates', validSong(newSong()), errs(validSong));
for (const ex of EXAMPLES) {
  const s = JSON.parse(JSON.stringify(ex.build()));
  check('schema: example validates: ' + ex.title, validSong(s), errs(validSong));
  for (const tr of s.tracks) if (!INSTRUMENTS.some(i => i.id === tr.instrument)) fails.push('unknown instrument ' + tr.instrument);
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
const bad = newSong(); bad.phrases[0].material.fl = { notes: [{ tick: 0, len: 0, pitch: 60, vel: 100, col: 0, art: null }], dyn: [], expr: [] };
check('schema: rejects zero-length note', !validSong(bad));
const old = JSON.parse(JSON.stringify(newSong())); old.version = 2; old.order = old.arrangement; delete old.arrangement;
check('schema: rejects a version 2 file', !validSong(old));
const withPattern = newSong(); withPattern.patterns.push({ id: 'p', name: 'P', rows: 8, ticksPerRow: 240, columns: 1, material: { notes: [{ tick: 0, len: 240, pitch: 60, vel: 100, col: 0, art: null }], dyn: [], expr: [], fx: [], placements: [] } });
withPattern.phrases[0].material.fl = { notes: [], dyn: [], expr: [], fx: [], placements: [{ pattern: 'p', row: 4, transpose: 5, repeat: 2 }] };
check('schema: pattern and placement validate', validSong(withPattern), errs(validSong));
withPattern.phrases[0].material.fl.placements[0].chain = 'x';
check('schema: placement rejects unknown fields', !validSong(withPattern));
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASSED');
process.exit(fails.length ? 1 : 0);
