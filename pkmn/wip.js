const fs = require('fs/promises');
const path = require('path');

const stringify = require('json-stringify-pretty-compact');

const {Generations} = require('@pkmn/data');
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
  if (!errors) return {fail: false};
  for (const error of errors) {
    if (/only obtainable/.test(error)) return {event: true};
    // These errors are easily correctable
    if (/must be shiny/.test(error)) continue;
    if (/must have a \w+ nature/.test(error)) continue;
    return {fail: true};
  }
  return {fail: false};
};

(async () => {
  const all = {};
  for (const gen of gens) {
    const illegal = {};
    //if (gen.num !== 6) continue; // debug
    outer: for (const species of gen.species) {
      //if (species.name !== 'Lickitung') continue; // debug
      const validator = new TeamValidator(Smogon.format(gen, species));
      let stats;
      try { stats = await smogon.stats(gen, species.name); } catch {}
      if (!stats) continue;

      illegal[species.name] = {};
      let first = undefined;
      let collapse = true;
      for (const ability in stats.abilities) {
        if (species.requiredAbility && ability !== species.requiredAbility) continue;
        first = illegal[species.name][ability] = {};
        for (const m1 in stats.moves) {
          if (m1 === 'Nothing' || m1.startsWith('Hidden Power')) continue;
          let total = 0;
          const fail = [];
          for (const m2 in stats.moves) {
            if (m1 === m2) continue;
            if (m2 === 'Nothing' || m2.startsWith('Hidden Power')) continue;
            if (illegal[species.name][ability][m2] == true) continue;
            if (species.requiredMove && !(m1 === species.requiredMove || m2 === species.requiredMove)) continue;

            const set = {species: species.name, ability, moves: [m1, m2], evs: {hp: 10}};
            if (species.requiredItems) set.item = species.requiredItems[0];
            const invalid = validator.validateSet(set, {});
            const type = relevant(invalid);
            if (type.event) {
              illegal[species.name] = 'event';
              continue outer;
            } else if (type.fail) {
              fail.push(m2);
            }
            //if (invalid) console.debug(ability, invalid, type);

            total++;
          }

          if (fail.length === total) {
            for (const m in stats.moves) {
              if (m === 'Nothing' || m.startsWith('Hidden Power')) continue;
              if (m == m1) break;
              if (illegal[species.name][ability][m] === true) continue;

              illegal[species.name][ability][m] = illegal[species.name][ability][m].filter(move => move !== m1);
              if (!illegal[species.name][ability][m].length) {
                delete illegal[species.name][ability][m];
              }
            }
            illegal[species.name][ability][m1] = true;
          } else if (fail.length) {
            illegal[species.name][ability][m1] = fail;
          }
        }

        let total = 0;
        for (const key in illegal[species.name][ability]) {
          const list = illegal[species.name][ability][key];
          if (list === true) continue;

          let i = list.length;
          while (i--) {
            const other = illegal[species.name][ability][list[i]];
            if (!other) continue;
            if (other.includes(key) && other.length > list.length) {
              list.splice(i, 1);
            } else {
              illegal[species.name][ability][list[i]] = other.filter(m => m !== key);
             if (!illegal[species.name][ability][list[i]].length) {
                delete illegal[species.name][ability][list[i]];
              }
            }
          }
          if (!list.length) {
            delete illegal[species.name][ability][key];
          }
          total++;
        }
        if (!Object.keys(illegal[species.name][ability]).length) {
          delete illegal[species.name][ability];
          collapse = false;
        } else if (!total) {
          illegal[species.name][ability] = true;
        }
      }

      if (collapse) {
        let diff = false;
        let template = JSON.stringify(first);
        for (const ability in stats.abilities) {
          if (JSON.stringify(illegal[species.name][ability]) !== template) {
            diff = true;
            break;
          }
        }
        if (!diff && first) illegal[species.name] = first;
      }

      if (!Object.keys(illegal[species.name]).length) delete illegal[species.name];
    }
    all[gen.num] = illegal;
  }
  console.log(stringify(all));
})();
