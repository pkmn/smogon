#!/usr/bin/env node --no-warnings --input-type=module --experimental-specifier-resolution=node
'use strict';

import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

// Creates an index file with the display names of each format Pokémon Showdown has supported.

import * as fs from 'fs';
import * as path from 'path';
import {fileURLToPath} from 'url';
import stringify from 'json-stringify-pretty-compact';

import {Dex} from '@pkmn/sim';

import NAMES from '../data/formats/index.json';
import FORMATS from '../smogon/latest.json';

const IGNORE = new Set([
  'gen8tiershiftcamomonsobtainable',
  'gen8vgc2021series9limitonerestrictedrestrictedlegendary',
]);

const SPECIAL = /^battlespotspecial(\d+)$/;
const VGC = /^vgc(\d{4})$/;
const SUFFIXES = [['alpha', 'Alpha'], ['beta', 'Beta'], ['suspecttest', 'Suspect Test']];
function getName(tier, pokebank = false) {
  if (tier.startsWith('pokebank')) return getName(tier.slice(8), true);
  if (NAMES[tier]) return pokebank ? `${NAMES[tier]} (Pokebank)` : NAMES[tier];
  let m = SPECIAL.exec(tier);
  if (m) return `Battle Spot Special #${m[1]}`;
  m = VGC.exec(tier);
  if (m) return `VGC ${m[1]}`;

  for (const [suffix, name] of SUFFIXES) {
    if (tier.endsWith(suffix)) {
      tier = tier.slice(0, -suffix.length);
      const n = getName(tier,);
      return n ? `${n} (${pokebank ? `Pokebank ${name}` : name})` : undefined;
    }
  }
  return undefined;
}

for (const format of Dex.formats.all()) {
  const tier = /gen\d/.test(format.id) ? format.id.slice(4) : format.id;
  if (!getName(tier)) NAMES[tier] = format.name.slice(8);
}

const missing = [];
for (const key in FORMATS) {
  if (IGNORE.has(key)) continue;
  const tier = /gen\d/.test(key) ? key.slice(4) : key;
  const name = getName(tier);
  if (!name) missing.push(key);
}

const sorted = {};
for (const format of Object.keys(NAMES).sort()) {
  sorted[format] = NAMES[format];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
fs.writeFileSync(path.resolve(__dirname, '../data/formats/index.json'), stringify(sorted));

if (missing.length) {
  console.error(missing);
  process.exit(1);
}
