const fs = require('fs/promises');
const path = require('path');

const stringify = require('json-stringify-pretty-compact');

const {Generations,} = require('@pkmn/data');
const {Dex, TeamValidator} = require('@pkmn/sim');
const {Smogon} = require('./build/index');


const URL = 'https://data.pkmn.cc/';
const fetch = async (url) => {
  if (!url.startsWith(URL)) throw new Error(`Invalid url: '${url}'`);
  const name = path.resolve(__dirname, '../data', url.slice(URL.length + 1));
  const json = JSON.parse(await fs.readFile(name, 'utf8'));
  return {json: () => Promise.resolve(json)};
};

const gens = new Generations(Dex);
const smogon = new Smogon(fetch);

const relevant = errors => {
  if (!errors) return false;
  for (const error of errors) {
    if (/must be shiny/.test(error)) continue;
    if (/must have a \w+ nature/.test(error)) continue;
    return true;
  }
  return false;
};

(async () => {
  for (const gen of gens) {
    const illegal = {};
    if (gen.num != 5) continue; // DEBUG
    for (const species of gen.species) {
      if (species.name !== 'Umbreon') continue; // DEBUG
      const validator = new TeamValidator(Smogon.format(gen, species));
      let stats;
      try { stats = await smogon.stats(gen, species.name); } catch {}
      if (!stats) continue;

      illegal[species.name] = {};

      const checked = new Set();;
      for (const m1 in stats.moves) {
        for (const m2 in stats.moves) {
          if (m1 === m2) continue;
          if (m1 === 'Nothing' || m2 === 'Nothing') continue;
          if (m1.startsWith('Hidden Power') && m2.startsWith('Hidden Power')) continue;
          const moves = m1 < m2 ? [m1, m2] : [m2, m1];
          const k = moves.join();
          if (checked.has(k)) continue;
          checked.add(k);

          let i = 0;
          for (const ability in stats.abilities) {
            const set = {species: species.name, ability, moves, evs: {hp: 10}};
            if (species.requiredItems) set.item = species.requiredItems[0];
            const invalid = validator.validateSet(set, {});
            if (relevant(invalid)) {
              illegal[species.name][k] = illegal[species.name][k] || [];
              illegal[species.name][k].push(ability);
              console.debug(`${species.name} ${ability} ${moves} ${validator.format}`, invalid);
            }
            i++;
          }
          if (illegal[species.name][k] && illegal[species.name][k].length === i) {
            illegal[species.name][k] = ['*'];
          }
        }
      }
      if (!Object.keys(illegal[species.name]).length) delete illegal[species.name];
    }
    // FIXME handle single move + ability
    // FIXME handle banned move...
    const pretty = {};
    for (const species in illegal) {
      pretty[species] = {};
      for (const key in illegal[species]) {
        const moves = key.split(',');
        for (const ability of illegal[species][key]) {
          pretty[species][ability] = pretty[species][ability]  || [];
          pretty[species][ability].push(moves);
        }
      }
      const keys = Object.keys(pretty[species]);
      if (keys.length === 1 && keys[0] === '*') {
        pretty[species] = pretty[species]['*'];
      }
    }
    console.log(stringify(pretty));
  }
})();