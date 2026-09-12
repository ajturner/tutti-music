// Build the bundled sound banks (banks/<id>/) from VSCO 2 CE and VCSL (both CC0). Each bank gets a
// bank.json listing its instruments with sample folders built like the orchestra set: softest and
// loudest layer per note, first round robin, mono AAC. Octave conventions differ per VCSL instrument,
// so each pitched instrument's offset is measured from a mid-range sample. Run: node scripts/build-banks.mjs [bank...]
import { mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { REPOS, gh, download, encode, wavPitch, midiOf } from './build-samples.mjs';
import { GM_DRUMS } from '../src/core/constants.js';

const OUT = new URL('../banks/', import.meta.url).pathname;
const SECONDS = { sus: 6, leg: 6, trm: 6, stc: 3, piz: 4, kit: 3 };
const DYN = { ppp: 0, pp: 1, p: 2, mp: 3, mf: 4, f: 5, ff: 6, fff: 7, soft: 1, med: 4, medium: 4, loud: 6, quiet: 1 };

// note, layer (higher = louder), round robin, from the many naming schemes in these libraries
function parse(name) {
  const base = name.replace(/\.wav$/i, '');
  const n = /(?:^|_)([A-G]#?-?\d)(?=_|$)/.exec(base);
  let layer = 1, m;
  if ((m = /_(?:vl|v|dyn)(\d+)(?=_|$)/i.exec(base))) layer = parseInt(m[1], 10);
  else if ((m = /_(ppp|pp|p|mp|mf|f|ff|fff|soft|med|medium|loud|quiet)(?=_|$)/i.exec(base))) layer = DYN[m[1].toLowerCase()];
  let rr = 1;
  if ((m = /_(?:rr|var|RR)(\d+)(?=_|$)/i.exec(base))) rr = parseInt(m[1], 10);
  else if ((m = /_(\d{2})$/.exec(base))) rr = parseInt(m[1], 10);
  return { note: n ? midiOf(n[1]) : null, layer, rr };
}
const src = (repo, dir) => ({ repo, dir });
// ---- bank definitions ----------------------------------------------------------------------------
const BANKS = {
  jazz: {
    name: 'Jazz combo', description: 'Piano, vibes, tenor sax, upright bass and a drum kit; plus the orchestral trumpets and trombones.',
    include: ['trumpets', 'trombones'],
    instruments: {
      'piano':       { name: 'Piano', family: 'keys', range: [21, 108], program: 0, arts: { sus: src('VCSL', 'Chordophones/Zithers/Upright Piano, Yamaha/Sustains') }, seconds: 8 },
      'vibraphone':  { name: 'Vibraphone', family: 'keys', range: [53, 89], program: 11, arts: { sus: src('VCSL', 'Idiophones/Struck Idiophones/Vibraphone/Hard Mallets') } },
      'tenor-sax':   { name: 'Tenor sax', family: 'woodwind', range: [44, 76], program: 66, arts: { sus: src('VCSL', 'Aerophones/Reed Aerophones/Tenor Saxophone/Vibrato'), stc: src('VCSL', 'Aerophones/Reed Aerophones/Tenor Saxophone/Staccato') } },
      'upright-bass': { name: 'Upright bass', family: 'strings', range: [28, 60], program: 32, artsOrder: ['piz', 'sus'], arts: { piz: src('VSCO', 'Strings/Solo Contrabass/Pizz'), sus: src('VSCO', 'Strings/Solo Contrabass/SusVib') } },
      'drum-kit':    { name: 'Drum kit', family: 'drums', range: [35, 52], program: 0, kit: {
        36: ['kick', src('VCSL', 'Membranophones/Struck Membranophones/Bass Drum 1'), /BDrumNew_hit/],
        38: ['snare', src('VCSL', 'Membranophones/Struck Membranophones/Snare Drum, Modern 1'), /Snare2_HitSN/],
        40: ['snare, snares off', src('VCSL', 'Membranophones/Struck Membranophones/Snare Drum, Modern 1'), /Snare2_HitNS/],
        39: ['clap', src('VCSL', 'Idiophones/Struck Idiophones/Claps'), /^Clap_rr/],
        42: ['closed hat', src('VCSL', 'Idiophones/Struck Idiophones/Hi-Hat Cymbal'), /HiHat_HitC_/],
        44: ['pedal hat', src('VCSL', 'Idiophones/Struck Idiophones/Hi-Hat Cymbal'), /HiHat_Close_/],
        46: ['open hat', src('VCSL', 'Idiophones/Struck Idiophones/Hi-Hat Cymbal'), /HiHat_HitO_/],
        45: ['tom', src('VCSL', 'Membranophones/Struck Membranophones/Tom 1/Stick'), /TomH_HitS_/],
        49: ['crash', src('VCSL', 'Idiophones/Struck Idiophones/Suspended Cymbal 1'), /susCymb1_hit_(mp|f|fff)\d/],
        51: ['ride bell', src('VCSL', 'Idiophones/Struck Idiophones/Suspended Cymbal 1'), /susCymb1_hit_bell_/],
      } },
    },
  },
  folk: {
    name: 'Folk group', description: 'Fiddle, folk harp, recorder, harmonica, frame drum and hand percussion; plus flute, clarinet, cellos and basses.',
    include: ['flute', 'clarinet', 'cellos', 'basses'],
    instruments: {
      'fiddle':    { name: 'Fiddle', family: 'strings', range: [55, 100], program: 110, arts: { sus: src('VSCO', 'Strings/Solo Violin/Arco Vib'), stc: src('VSCO', 'Strings/Solo Violin/spic'), piz: src('VSCO', 'Strings/Solo Violin/Pizz'), trm: src('VSCO', 'Strings/Solo Violin/Trem') } },
      'folk-harp': { name: 'Folk harp', family: 'plucked', range: [36, 84], program: 46, arts: { sus: src('VCSL', 'Chordophones/Composite Chordophones/Folk Harp') }, seconds: 5 },
      'recorder':  { name: 'Recorder', family: 'woodwind', range: [72, 98], program: 74, arts: { sus: src('VCSL', 'Aerophones/Edge-blown Aerophones/Baroque Soprano Recorder/Sustain'), stc: src('VCSL', 'Aerophones/Edge-blown Aerophones/Baroque Soprano Recorder/Staccato') } },
      'harmonica': { name: 'Harmonica', family: 'woodwind', range: [60, 96], program: 22, arts: { sus: src('VCSL', 'Aerophones/Free Aerophones/Harmonica-Hohner-Special20-C/Sustains/Normal'), leg: src('VCSL', 'Aerophones/Free Aerophones/Harmonica-Hohner-Special20-C/Sustains/Vib') } },
      'frame-drum': { name: 'Frame drum', family: 'drums', range: [36, 47], program: 0, kit: {
        36: ['large hit', src('VCSL', 'Membranophones/Struck Membranophones/Frame Drum'), /HDrumL_Hit_/],
        38: ['large muted', src('VCSL', 'Membranophones/Struck Membranophones/Frame Drum'), /HDrumL_HitMuted_/],
        40: ['large hand', src('VCSL', 'Membranophones/Struck Membranophones/Frame Drum'), /HDrumL_Hand/],
        43: ['small hit', src('VCSL', 'Membranophones/Struck Membranophones/Frame Drum'), /HDrumS_Hit_/],
        45: ['small muted', src('VCSL', 'Membranophones/Struck Membranophones/Frame Drum'), /HDrumS_HitMuted_/],
        47: ['small hand', src('VCSL', 'Membranophones/Struck Membranophones/Frame Drum'), /HDrumS_Hand/],
      } },
      'hand-percussion': { name: 'Hand percussion', family: 'drums', range: [42, 56], program: 0, kit: {
        42: ['tambourine', src('VCSL', 'Idiophones/Struck Idiophones/Tambourine 1'), /Tamb1_Hit_/],
        44: ['tambourine shake', src('VCSL', 'Idiophones/Struck Idiophones/Tambourine 1'), /Tamb1_Shake_/],
        46: ['tambourine roll', src('VCSL', 'Idiophones/Struck Idiophones/Tambourine 1'), /Tamb1_Roll_/],
        48: ['shaker', src('VCSL', 'Idiophones/Struck Idiophones/Shaker, Large'), /LShaker_Shake1D_/],
        50: ['shaker hit', src('VCSL', 'Idiophones/Struck Idiophones/Shaker, Large'), /LShaker_Hit_/],
        52: ['woodblock', src('VCSL', 'Idiophones/Struck Idiophones/Woodblock'), /^wood_click_(f|mp|pp)_/],
        54: ['cajon', src('VCSL', 'Idiophones/Struck Idiophones/Cajon'), /Cajon_hit1_/],
        56: ['bongo', src('VCSL', 'Membranophones/Struck Membranophones/Bongos'), /BongoH_Hit1_/],
      } },
    },
  },
  electronica: {
    name: 'Electronica', description: 'FM piano and clavisynth from a TX81Z, a synthesized drum machine, and lead, pad and pluck synth patches; plus the synth bass and arp.',
    include: ['synth-bass', 'synth-arp'],
    instruments: {
      'fm-piano':   { name: 'FM piano', family: 'keys', range: [24, 108], program: 5, arts: { sus: src('VCSL', 'Electrophones/TX81Z/FM Piano') }, seconds: 6 },
      'clavisynth': { name: 'Clavisynth', family: 'keys', range: [24, 108], program: 7, arts: { sus: src('VCSL', 'Electrophones/TX81Z/Clavisynth') }, seconds: 4 },
      'drum-machine': { name: 'Drum machine', family: 'drums', range: [35, 77], program: 0, synthKit: GM_DRUMS },
      'lead':  { name: 'Lead', family: 'electronic', range: [36, 96], program: 81, patch: { waves: [['sawtooth', -7, 0.5], ['sawtooth', 7, 0.5]], a: 0.01, d: 0.25, s: 0.7, r: 0.12, level: 0.24 } },
      'pad':   { name: 'Pad', family: 'electronic', range: [36, 96], program: 89, patch: { waves: [['sawtooth', -10, 0.35], ['triangle', 10, 0.5], ['sawtooth', 0, 0.3]], a: 0.6, d: 0.5, s: 0.85, r: 0.9, level: 0.2, lfo: 0.25 } },
      'pluck': { name: 'Pluck', family: 'electronic', range: [36, 96], program: 104, patch: { waves: [['square', 0, 0.5], ['sawtooth', 0, 0.3]], a: 0.003, d: 0.28, s: 0, r: 0.15, level: 0.28, oneShot: true } },
    },
  },
};

async function listFiles(s) { return (await gh(s.dir, REPOS[s.repo])).filter(f => f.type === 'file' && /\.wav$/i.test(f.name)).map(f => f.name); }
// Octave offset for an instrument: measure a mid-range sample and compare with its name.
async function octaveOffset(s, files, range) {
  const named = files.map(n => ({ n, p: parse(n) })).filter(x => x.p.note != null).sort((a, b) => a.p.note - b.p.note);
  if (!named.length) return 0;
  const picks = [0.35, 0.5, 0.65].map(f => named[Math.min(named.length - 1, Math.floor(named.length * f))]);
  const offs = [];
  for (const f of picks) { const m = wavPitch(await download(s.dir + '/' + f.n, REPOS[s.repo])); if (m != null) offs.push(Math.round((m - f.p.note) / 12) * 12); }
  if (!offs.length) return 0;
  offs.sort((a, b) => a - b); let off = offs[Math.floor(offs.length / 2)];
  // sanity: only whole-octave shifts of at most one octave, and the shifted notes must overlap the instrument's range
  const lo = named[0].p.note + off, hi = named[named.length - 1].p.note + off;
  if (![-12, 0, 12].includes(off) || (range && (lo > range[1] || hi < range[0]))) { process.stdout.write(`  octave offset ${s.dir.split('/').pop()}: ${off} rejected (from ${offs.join(',')}), using 0\n`); off = 0; }
  else process.stdout.write(`  octave offset ${s.dir.split('/').pop()}: ${off} (from ${offs.join(',')})\n`);
  return off;
}
async function pick(files, seconds, outDir, prefix, s, note, fixedNote) {
  const zones = [];
  const parsed = files.map(n => ({ n, p: parse(n) }));
  const groups = new Map();
  for (const f of parsed) { const k = fixedNote != null ? fixedNote : f.p.note; if (k == null) continue; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(f); }
  for (const [k, list] of groups) {
    const layers = [...new Set(list.map(f => f.p.layer))].sort((a, b) => a - b);
    const chosen = layers.length > 1 ? [layers[0], layers[layers.length - 1]] : layers;
    for (let li = 0; li < chosen.length; li++) {
      const f = list.filter(x => x.p.layer === chosen[li]).sort((a, b) => a.p.rr - b.p.rr)[0];
      const out = path.join(outDir, `${prefix}_n${k}_${li}.m4a`), rel = s.dir + '/' + f.n;
      try { await stat(out); } catch { await encode(await download(rel, REPOS[s.repo]), out, seconds); }
      zones.push({ art: prefix.split('_')[0], note: k + (note || 0), layer: chosen.length > 1 ? li / (chosen.length - 1) : 1, file: path.basename(out), source: s.repo + ':' + rel });
      process.stdout.write(`${path.basename(outDir)} ${prefix} n${k} L${li}\n`);
    }
  }
  return zones;
}
async function buildBank(id) {
  const bank = BANKS[id], dir = path.join(OUT, id); await mkdir(dir, { recursive: true });
  const defs = [];
  for (const [iid, d] of Object.entries(bank.instruments)) {
    const def = { id: iid, name: d.name, family: d.family, range: d.range, program: d.program || 0, articulations: d.artsOrder || Object.keys(d.arts || {}).length ? (d.artsOrder || Object.keys(d.arts)) : ['sus'] };
    if (d.patch) def.patch = d.patch;
    if (d.synthKit) { def.kit = d.synthKit; def.synthKit = true; }
    if (d.arts || d.kit) {
      const idir = path.join(dir, iid); await mkdir(idir, { recursive: true });
      let zones = [];
      for (const [art, s] of Object.entries(d.arts || {})) {
        const files = await listFiles(s); const off = await octaveOffset(s, files, d.range);
        zones = zones.concat(await pick(files, d.seconds || SECONDS[art] || 6, idir, art, s, off, null));
      }
      if (d.kit) {
        def.kit = {};
        for (const [n, [label, s, re]] of Object.entries(d.kit)) {
          def.kit[n] = label;
          const files = (await listFiles(s)).filter(f => re.test(f));
          zones = zones.concat(await pick(files, SECONDS.kit, idir, 'sus', s, 0, parseInt(n, 10)));
        }
      }
      zones.sort((a, b) => a.art.localeCompare(b.art) || a.note - b.note || a.layer - b.layer);
      await writeFile(path.join(idir, 'map.json'), JSON.stringify({ instrument: iid, source: 'VSCO 2 CE / VCSL (CC0) by Versilian Studios, converted', license: 'CC0-1.0', zones }, null, 1) + '\n');
      def.samples = './' + iid + '/';
    }
    defs.push(def);
  }
  await writeFile(path.join(dir, 'bank.json'), JSON.stringify({ $schema: 'https://ajturner.github.io/tutti-music/schema/tutti-bank.schema.json', id, name: bank.name, description: bank.description, license: 'CC0-1.0', source: 'VSCO 2 Community Edition and VCSL by Versilian Studios', include: bank.include || [], instruments: defs }, null, 1) + '\n');
  console.log(id + ': ' + defs.length + ' instruments');
}
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(BANKS);
for (const id of wanted) { try { await buildBank(id); } catch (e) { console.error('FAILED', id, e.stack || e.message); } }
await writeFile(path.join(OUT, 'index.json'), JSON.stringify({ banks: Object.entries(BANKS).map(([id, b]) => ({ id, name: b.name, description: b.description, url: id + '/bank.json' })) }, null, 1) + '\n');
