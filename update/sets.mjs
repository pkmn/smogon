#!/usr/bin/env node --no-warnings --experimental-specifier-resolution=node
'use strict';

import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

// There are two logical ways to partition the analysis/set data - either by format or by
// generation. Splitting by format means that less data will need to be fetched as fetches can be
// more targetted, but comes with the the difficulty of determining *which* format(s) to fetch - a
// Pokémon may have strategies in multiple formats, may not have strategies for the format it is
// actually tiered in (a Pokémon's tier might change and analyses lag behind these changes), and the
// cost of fetching multiple formats (in case the Pokémon can't be found in the first format
// fetched) is seen as being worse than downloading slightly more upfront (especially given multiple
// fetches = multiple round trips and parsing). Instead, the API supports both fetching by
// generation (default - simplest and best expected latency) or by format if the format param is
// used and the class has been configured to be minimal with its downloads for scenarios where
// bandwidth/memory/disk space are a premium.

import * as fs from 'fs';
import * as path from 'path';
import {fileURLToPath} from 'url';
import * as util from 'util';
import * as zlib from 'zlib';
const gzip = util.promisify(zlib.gzip);

import {Dex, toID} from '@pkmn/sim';
import stringify from 'json-stringify-pretty-compact';
import sanitizeHtml from 'sanitize-html';
import {Analyses} from 'smogon';
import * as wrapr from 'wrapr';

const request = wrapr.retrying(wrapr.throttling(async args =>
  (await fetch(args.url, args.init)).json(), +process.argv[2] || 20, 1000));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(__dirname, '../data');

for (const file of fs.readdirSync(path.join(DATA, 'analyses'))) {
  if (file === 'index.md') continue;
  fs.unlinkSync(path.join(DATA, 'analyses', file));
}
for (const file of fs.readdirSync(path.join(DATA, 'sets'))) {
  if (file === 'index.md') continue;
  fs.unlinkSync(path.join(DATA, 'sets', file));
}

// Smogon and Pokémon Showdown disagree on format names - this mapping allows us to convert from
// the Smogon representation to the Pokémon Showdown one. Additionally, Smogon has some analyses
// for formats Pokémon Showdown doesn't support, so this also is effectively used as a list to
// allow those formats to be included. We also need to special case formats like VGC and BSS -
// these format names on Pokémon Showdown update frequently as new series are introduced yet
// Smogon treats all of the series as the same format.
const FORMATS = {
  ag: 'anythinggoes', nationaldexag: 'nationaldexag', nationaldexru: 'nationaldexru',
  nationaldexmonotype: 'nationaldexmonotype', lgpeou: 'letsgoou',
  bdspou: 'bdspou', bh: 'balancedhackmons', doubles: 'doublesou', uber: 'ubers',
  // NB: technically 'Farceus Uber' is different than Anything Goes...
  dwou: 'dreamworldou', zu: 'zu', nfe: 'nfe', farceusuber: 'anythinggoes', middlecup: 'middlecup',
  // Other Metagames
  almostanyability: 'almostanyability', mixandmega: 'mixandmega', godlygift: 'godlygift',
  camomons: 'camomons', stabmons: 'stabmons', pic: 'partnersincrime',
  partnersincrime: 'partnersincrime', draft: 'draft', inh: 'inheritance',
  // BSS
  bssseries1: 'battlestadiumsingles', bssseries2: 'battlestadiumsingles',
  bssseries12: 'battlestadiumsingles', bssseries13: 'battlestadiumsingles',
  battlestadiumsingles: 'battlestadiumsingles',
  // BSD + DW deciding to go rogue. VGC 22 Series 13 -> "BSD" Series 13 = BSD
  vgc22series13: 'battlestadiumdoubles', battlestadiumdoubles: 'battlestadiumdoubles',
  // VGC
  vgc11: 'vgc2011', vgc12: 'vgc2012', vgc14: 'vgc2014', vgc15: 'vgc2015', vgc16: 'vgc2016',
  vgc17: 'vgc2017', vgc18: 'vgc2018', vgc19: 'vgc2019', vgc20: 'vgc2020', vgc21: 'vgc2021',
  vgc22: 'vgc2022', vgc23series1: 'vgc2023', vgc23series2: 'vgc2023', vgc23series3: 'vgc2023',
  vgc23series4: 'vgc2023', vgc24regulatione: 'vgc2023', vgc24regulationf: 'vgc2024',
  vgc: 'vgc2024',
  // RBwhY?
  nintendocup1997: 'nc1997', nintendocup1998: 'nc1998', nintendocup1999: 'nc1999',
  lclevel100: 'lclevel100', petitcup: 'petitcup', pikacup: 'pikacup', monotype: 'monotype',
  pu: 'pu', lc: 'lc', '1v1': '1v1', '2v2doubles': '2v2doubles', stadiumou: 'stadiumou',
};
const ORDER = Object.keys(FORMATS);

// Iterating through dex.species.all() returns a bunch of formes that Smogon either doesn't support
// or will simply redirect to the base species - instead we filter to only the 'eligible' Pokémon to
// return just the set of Pokémon Smogon will actually have unique analyses for.
const NONSTANDARD = ['Unobtainable', 'Gigantamax'];
const PREFIXES = ['Pichu', 'Basculin', 'Keldeo', 'Genesect', 'Vivillon', 'Magearna'];
const SUFFIXES = ['-Antique', '-Totem'];
function eligible(gen, species) {
  // Note that we can't include species.tier === 'Illegal' because of National Dex...
  if (!species.exists || species.gen > gen) return false;
  if (species.name.endsWith('-Crowned')) return true; // no clue
  if (species.battleOnly || NONSTANDARD.includes(species.isNonstandard)) return false;
  if (species.baseSpecies === species.name) return true;
  if (PREFIXES.some(prefix => species.name.startsWith(prefix))) return false;
  if (SUFFIXES.some(suffix => species.name.endsWith(suffix))) return false;
  if (species.name.startsWith('Pikachu') && species.name !== 'Pikachu-Starter') return false;
  return true;
}

(async () => {
  const index = {analyses: {}, sets: {}};
  for (let gen = 1; gen <= 9; gen++) {
    const dex = Dex.forGen(gen);

    const imports = [];
    for (const species of dex.species.all()) {
      if (!eligible(gen, species)) continue;
      imports.push(importPokemon(dex, gen, species));
    }

    const data = {gen: {analyses: {}, sets: {}}, format: {analyses: {}, sets: {}}};
    for (const results of await Promise.all(imports)) {
      if (!results) continue;
      for (const name in results) {
        const {sets, analyses} = results[name];
        data.gen.analyses[name] = analyses;
        data.gen.sets[name] = sets;
        for (const tierid in analyses) {
          const format = `gen${gen}${tierid}`;
          data.format.analyses[format] = data.format.analyses[format]  || {};
          data.format.analyses[format][name] = analyses[tierid];
          data.format.sets[format] = data.format.sets[format] || {};
          data.format.sets[format][name] = sets[tierid];
        }
      }
    }

    index.analyses[`gen${gen}.json`] =
      await serialize(data.gen.analyses, `analyses/gen${gen}.json`);
    index.sets[`gen${gen}.json`] =
      await serialize(data.gen.sets, `sets/gen${gen}.json`);
    for (const format in data.format.analyses) {
      index.analyses[`${format}.json`] =
        await serialize(data.format.analyses[format], `analyses/${format}.json`);
      index.sets[`${format}.json`] =
        await serialize(data.format.sets[format], `sets/${format}.json`);
    }
  }

  const sorted = {analyses: {}, sets: {}};
  for (const key of Object.keys(index.analyses).sort()) {
    sorted.analyses[key] = index.analyses[key];
    sorted.sets[key] = index.sets[key];
  }
  fs.writeFileSync(path.join(DATA, 'analyses/index.json'), stringify(sorted.analyses));
  fs.writeFileSync(path.join(DATA, 'sets/index.json'), stringify(sorted.sets));
})().catch(err => {
  console.error(err);
  process.exit(1);
});

// Fetch a Pokémon's analysis and split out the sets from the analysis text, compressing the
// set information and sanitizing the analysis text. If the Pokémon doesn't have any strategies we
// simply return undefined to ensure it will be elided during serialization.
async function importPokemon(dex, gen, species) {
  const json = await request(Analyses.request(species, gen));
  if (!json || !json.strategies.length) return undefined;

  const imports = {};
  for (const analysis of json.strategies.sort((a, b) => {
    // Sort to ensure that outdated info for the same format comes second (and implicitly outdated
    // VGC/BSS formats come after as well)
    if (a.format === b.format) return a.outdated ? (b.outdated ? 0 : 1) : -1;
    const aid = toID(a.format);
    const bid = toID(b.format);
    const ao = ORDER.indexOf(aid);
    const bo = ORDER.indexOf(bid);
    return ao >= 0 && bo >= 0 ? bo - ao : bid.localeCompare(aid);
  })) {
    const tier = toID(analysis.format);
    if (tier === 'limbo' || tier.endsWith('rentals')) continue;
    let format = `gen${gen}${FORMATS[tier] || tier}`;
    // NB: we can't simply check Format.exists because @pkmn/sim doesn't support all mods
    if (Dex.formats.get(format).effectType !== 'Format' && !FORMATS[tier]) {
      throw new Error(`Unknown format: ${format} (${tier}) for gen ${gen} ${species.name}`);
    }
    format = format.slice(4); // trim gen<N> to save space (BUG)

    const analyses = {};
    for (const ms of analysis.movesets) {
      const pokemon = dex.species.get(ms.pokemon);
      analyses[pokemon.name] ||= {};
      imports[pokemon.name] ||= {analyses: {}, sets: {}};
      imports[pokemon.name].sets[format] ||= {};
      imports[pokemon.name].sets[format][ms.name] || {};
      if (!imports[pokemon.name].sets[format][ms.name]) {
        analyses[pokemon.name][ms.name] = {description: sanitize(ms.description)};
        imports[pokemon.name].sets[format][ms.name] = compress(gen, format, ms, pokemon);
      }
    }

    for (const pokemon in imports) {
      if (!analyses[pokemon]) continue;
      if  (imports[pokemon].analyses[format]) {
        for (const set in analyses[pokemon]) {
          imports[pokemon].analyses[format].sets[set] = {
            outdated: true,
            ...analyses[pokemon][set],
          }
        }
        continue;
      }
      imports[pokemon].analyses[format] = {
        outdated: !!analysis.outdated || undefined,
        overview: sanitize(analysis.overview),
        comments: sanitize(analysis.comments),
        sets: analyses[pokemon],
        credits: !analysis.credits.teams.length && !analysis.credits.writtenBy.length
            ? undefined : analysis.credits,
      };
    }
  }

  return imports;
}

// Remove any fields from the Moveset that contain redundant info that we can just fill back in
// later in order to save space on disk and over the wire.
function compress(gen, format, set, species) {
  return {
    level:
      !set.levels.length || set.levels.length === 1 && set.levels.length === expectedLevel(format)
        ? undefined : set.levels.length === 1 ? set.level : set.levels,
    moves: set.moveslots.map(ms => {
      const moves = ms.map(s => s.type ? `${s.move} ${s.type}` : s.move);
      return (moves.length === 1) ? moves[0] : moves;
    }),
    ability: !set.abilities.length ||
      (set.abilities.length === 1 && set.abilities[0] === species.abilities[0])
        ? undefined : set.abilities.length === 1 ? set.abilities[0] : set.abilities,
    item: (!set.items.length || set.items[0] === 'No Item')
      ? undefined : set.items.length === 1 ? set.items[0] : set.items,
    nature: set.natures.length ?
      set.natures.length === 1 ? set.natures[0] : set.natures : undefined,
    ivs: set.ivconfigs.length ? compressValues(set.ivconfigs, 31) : undefined,
    evs: set.evconfigs.length ? compressValues(set.evconfigs, gen < 3 ? 252 : 0) : undefined,
    teratypes: set.teratypes.length ?
      set.teratypes.length == 1 ? set.teratypes[0] : set.teratypes : undefined,
  };
}

// Not very sophisticated, but good enough for our purposes.
function expectedLevel(format) {
  if (format.startsWith('vgc')) return 50;
  if (format.endsWith('lc')) return 5;
  return 100;
}

// Removes redundant info from IVs/EVs that can be inferred.
const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
function compressValues(values, elide) {
  const vs = [];
  for (const value of values) {
    const v = {};
    for (const stat of STATS) {
      if (value[stat] !== elide) v[stat] = value[stat];
    }
    // Smogon will specify all 0's for EVs on certain sets...
    if (Object.keys(v).length) vs.push(v);
  }
  return vs.length === 1 ? vs[0] : vs;
}

// We run any HTML through sanitize-html to ensure its not problematic (though in general its
// fairly safe to assume Smogon C&C staff is not being malicious...) while also removing any
// relative self-links that would not work when displaying the analysis info on another domain and
// spurious newlines. We also elide the sample set placeholder descriptions if present.
const PLACEHOLDER = /sample set/i;
function sanitize(html) {
  if (!html) return undefined;
  const clean = sanitizeHtml(html, {
    transformTags: {
      'a': (tagName, attribs) => {
        return (attribs.href.startsWith('/')) ? {tagName: ''} : {tagName, attribs};
      }
    }
  }).replace(/\n/g, ' ');
  // NOTE: 200 is an incredibly scientific number pulled directly out of my ass
  return PLACEHOLDER.test(clean) && clean.length < 200 ? undefined : clean.trim();
}

async function serialize(data, file) {
  // NOTE: This pretty stringify will result in ~10% larger files, though we don't care because
  // this will amount to significantly less after gzip and we want to have meaningful diffs
  const json = stringify(data, {maxLength: 1000});
  await fs.promises.writeFile(path.join(DATA, file), json);
  const compressed = await gzip(json);
  return [json.length, compressed.length];
}
