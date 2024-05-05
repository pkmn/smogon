#!/usr/bin/env node --no-warnings --experimental-specifier-resolution=node
'use strict';

import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

// Creates an index file with the display names of each format Pokémon Showdown has supported.

import * as fs from 'fs';
import * as path from 'path';
import {fileURLToPath} from 'url';
import stringify from 'json-stringify-pretty-compact';

import {Dex} from '@pkmn/sim';

import NAMES from '../data/formats/index.json' with {type: 'json'};
import FORMATS from '../smogon/latest.json' with {type: 'json'};

const IGNORE = new Set([
  'gen8tiershiftcamomonsobtainable',
  'gen8vgc2021series9limitonerestrictedrestrictedlegendary',
]);

const SPECIAL = /^battlespotspecial(\d+)$/;
const VGC = /^vgc(\d{4})$/;
const PREFIXES = [
  ['pokebank', 'Pokebank'],
  ['predlc', 'Pre-DLC'],
  ['dlc1', 'DLC 1'],
];
const SUFFIXES = [
  ['alpha', 'Alpha'],
  ['beta', 'Beta'],
  ['suspect', 'Suspect'],
  ['suspecttest', 'Suspect Test'],
];
function getName(tier, prefix = false) {
  for (const [prefix, name] of PREFIXES) {
    if (tier.startsWith(prefix)) return getName(tier.slice(prefix.length), name);
  }
  if (NAMES[tier]) return prefix ? `${NAMES[tier]} (${prefix})` : NAMES[tier];
  let m = SPECIAL.exec(tier);
  if (m) return `Battle Spot Special #${m[1]}`;
  m = VGC.exec(tier);
  if (m) return `VGC ${m[1]}`;

  for (const [suffix, name] of SUFFIXES) {
    if (tier.endsWith(suffix)) {
      tier = tier.slice(0, -suffix.length);
      const n = getName(tier);
      return n ? `${n} (${prefix ? `${prefix} ${name}` : name})` : undefined;
    }
  }
  return undefined;
}

for (const format of Dex.formats.all()) {
  const tier = /gen\d/.test(format.id) ? format.id.slice(4) : format.id;

  if (!getName(tier)) {
    NAMES[tier] = tier.startsWith('bdsp')
      ? `BDSP ${format.name.slice(13)}`
      : format.name.slice(8);
  }
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
