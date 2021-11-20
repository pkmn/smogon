#!/usr/bin/env node --no-warnings --experimental-specifier-resolution=node
'use strict';

import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

// Creates an index file with the size of Pokémon Showdown's assets for each generation.
// BUG: Pokémon Showdown actually copies sprites redundantly when it shouldn't, so something like
// `gen2g` contains `gen2` assets for the Pokémon that didn't receive unique sprites in Gold. This
// is useful for simplicity but results it useless duplicate information being fetched.

import * as fs from 'fs';
import * as path from 'path';
import {fileURLToPath} from 'url';
import fetch from 'node-fetch';
import * as wrapr from 'wrapr';
import stringify from 'json-stringify-pretty-compact';
import probe from 'probe-image-size';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const size = wrapr.retrying(wrapr.throttling(probe));

const ASSETS = {
  default: [
    'gen5-back-shiny', 'gen5-back', 'gen5-shiny', 'gen5',
    'substitutes/gen5-back', 'substitutes/gen5',
    'trainers', 'types',
    'pokemonicons-sheet.png', 'pokemonicons-pokeball-sheet.png', 'itemicons-sheet.png',
  ],
  gen1: ['gen1-back', 'gen1', 'substitutes/gen1-back', 'substitutes/gen1'],
  gen1rb: ['gen1rb'],
  gen1rg: ['gen1rg'],
  gen2: ['gen2-back-shiny', 'gen2-back', 'gen2-shiny', 'gen2'],
  gen2g: ['gen2g'],
  gen2s: [ 'gen2s'],
  gen3: [
    'gen3-back-shiny', 'gen3-back', 'gen3-shiny', 'gen3',
    'substitutes/gen3-back', 'substitutes/gen3',
  ],
  gen3rs: ['gen3rs-shiny', 'gen3rs'],
  gen3frlg: ['gen3frlg'],
  gen4: [
    'gen4-back-shiny', 'gen4-back', 'gen4-shiny', 'gen4',
    'substitutes/gen4-back', 'substitutes/gen4',
  ],
  gen4dp: ['gen4dp-shiny', 'gen4dp'],
  gen5ani: [ 'gen5ani-back-shiny', 'gen5ani-back', 'gen5ani-shiny', 'gen5ani'],
  ani: ['ani-back-shiny', 'ani-back', 'ani-shiny', 'ani'],
  dex: ['dex-shiny', 'dex'],
};

const DATA = path.resolve(__dirname, '../data');
try { fs.unlinkSync(path.join(DATA, 'imgs', 'index.json')); } catch {}

const MAX = +process.argv[2] || 50;
const URL = 'https://play.pokemonshowdown.com/sprites';
const HREF = /href="(.*?\.(png|gif))"/;

(async () => {
  const index = {};
  const state = {};
  for (const source in ASSETS) {
    index[source] = 0;
    for (const asset of ASSETS[source]) {
      if (asset.endsWith('png')) {
        const size = (await probe(`${URL}/${asset}`)).length;
        index[source] += size;
        state[asset] = size;
      } else {
        const page = await (await fetch(`${URL}/${asset}`)).text();
        let imgs = [];
        for (const line of page.split('\n')) {
          const m = HREF.exec(line);
          if (m) imgs.push(size(`${URL}/${asset}/${m[1]}`));
          if (imgs.length >= MAX) {
            for (const img of await Promise.all(imgs)) {
              index[source] += img.length;
              state[img.url.slice(URL.length + 1)] = img.length;
            }
            imgs = [];
          }
        }
        for (const img of await Promise.all(imgs)) {
          index[source] += img.length;
          state[img.url.slice(URL.length + 1)] = img.length;
        }
      }
    }
  }

  fs.writeFileSync(path.join(DATA, 'imgs', 'index.json'), stringify(index));
  const sorted = {};
  for (const asset of Object.keys(state).sort()) {
    sorted[asset] = state[asset];
  }
  fs.writeFileSync(path.join(DATA, 'imgs', 'state.json'), stringify(sorted));
})().catch(err => {
  console.error(err);
  process.exit(1);
});
