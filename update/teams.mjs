#!/usr/bin/env node --no-warnings --experimental-specifier-resolution=node
'use strict';

import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

// This script scrapes sample team information from threads linked in Pokémon
// Showdown's config/formats.ts and from https://www.smogon.com/roa/ and produces:
//
//   - data/teams/*.json: teams for each supported format, optionally with names
//     and author information.
//   - data/teams/index.json: an index of the [size, compressed size] for each of the
//     format files.

import * as fs from 'fs';
import * as path from 'path';
import {fileURLToPath} from 'url';
import * as util from 'util';
import * as zlib from 'zlib';
const gzip = util.promisify(zlib.gzip);

import {Team, Teams} from '@pkmn/sets';
import {Dex, TeamValidator, toID} from '@pkmn/sim';
import {JSDOM} from 'jsdom';
import stringify from 'json-stringify-pretty-compact';
import ts from "typescript";
import * as wrapr from 'wrapr';

const wrap = fn => wrapr.retrying(wrapr.throttling(fn, +process.argv[2] || 5, 1000), 100, 2000);

// pokepast.es chokes if we don't throttle
const request = wrap(async url => (await fetch(url)).json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(__dirname, '../data');

for (const file of fs.readdirSync(path.join(DATA, 'teams'))) {
  if (file === 'index.md') continue;
  fs.unlinkSync(path.join(DATA, 'teams', file));
}

const SMOGON = 'https://www.smogon.com/roa/';
const SHOWDOWN =
  'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/config/formats.ts';

const POST = /posts\/(\d+)\/?$/;
const SAMPLE = /"(http.*)".*ample/;
const GEN = /^gen\d$/;
const SCMS = /<script>window.scmsJSON = ({.*})<\/script>/;
const BY = /(.*)(?: \(by (.*)\)| (?:submitted )?by (.*)| \[(.*)\]$|, (.*)$| - ([^-]*)$)/;
const UNTITLED = /Untitled \d+/;
const GUEST = /Guest \d+/;

const IGNORE = [
  // Multiple formats within a single post
  'https://www.smogon.com/forums/posts/6431094/',
];

(async () => {
  // @pkmn/sim doesn't include the sample thread information because it prunes the data files so we
  // need to fetch it directly from source. The main concern here is that upstream will be ahead of
  // @pkmn/sim most of the time so the format being used for validations may be incorrect - this is
  // kind of unavoidable because even if we could "pin" the thread URLs by using a @pkmn/sim version
  // the *data* in the thread (which is what actually matters) is always going to be volatile
  let data;
  {
    const source = await (await fetch(SHOWDOWN)).text();
    const options = { compilerOptions: { module: ts.ModuleKind.CommonJS } };
    const result = ts.transpileModule(source, options);
    const exports = {};
    eval(result.outputText);
    data = exports.Formats;
  }

  const formats = {};
  const ignored = new Set();
  outer: for (const f of data) {
    if (!f.name || !f.threads) continue;
    for (const t of f.threads) {
      const m = SAMPLE.exec(t)
      if (m) {
        const url = m[1];
        if (IGNORE.includes(url)) {
          ignored.add(url)
          continue outer;
        }
        const format = Dex.formats.get(f.name);
        // TODO: Use @pkmn/mods to support mods
        if (!GEN.test(format.mod)) continue;
        if (!format.exists) {
          console.error(`Missing format '${format.name}'`);
          format.gen = +format.id[3];
          format.mod = format.id.slice(0, 4);
        }
        formats[format.id] = wrap(() => scrapeThread(format, url))();
        continue outer;
      }
    }
  }

  if (ignored.size !== IGNORE.length) {
    const msg = `${Array.from(ignored).sort().join('\n')}\n\nvs.\n\n${IGNORE.sort().join('\n')}`;
    throw new Error(`Mismatched ignored URLs:\n\n${msg}`);
  }

  const html = await (await fetch(SMOGON)).text();
  let m = SCMS.exec(html);
  for (const f of JSON.parse(m[1]).FORMATS) {
    if (!f.startsWith('gen')) continue;
    const format = Dex.formats.get(f);
    // TODO: Use @pkmn/mods to support mods
    if (!GEN.test(format.mod)) continue;
    if (!format.exists) {
      console.error(`Missing format '${format.name}'`);
      format.gen = +format.id[3];
      format.mod = format.id.slice(0, 4);
    }

    const url = `https://www.smogon.com/roa/sample-files/${format.id}.txt`;
    // Awkward because of concurrency, but we ultimately want to be able to dedupe the team info in
    // case both the threads and the ROA archives have the same data (which honestly should be
    // common but realistically one or both are going to be out of date)
    let existing = await formats[format.id] ?? [];
    if (!existing) formats[format.id] = Promise.resolve([]);
    const teams = await scrapeArchive(format, url, existing);
    if (teams.length) {
      formats[format.id] = Promise.resolve([...existing, ...teams]);
    }
  }

  const sorted = {};
  for (const key of Object.keys(formats).sort()) {
    sorted[key] = await serialize(await formats[key], `teams/${key}.json`);
  }
  fs.writeFileSync(path.join(DATA, 'teams/index.json'), stringify(sorted));
})().catch(err => {
  console.error(err);
  process.exit(1);
});

async function scrapeArchive(format, url, existing) {
  const teams = [];

  const dex = Dex.forFormat(format);
  // TODO: pkmn/ps#25
  const validator = format.id === 'gen9lc' ? undefined : new TeamValidator(format, dex);

  // Avoid adding teams which were already scraped from threads
  const seen = new Set();
  for (const {data} of existing) seen.add(JSON.stringify(data));

  const imports = Teams.importTeams(await (await fetch(url)).text());
  for (let {team, name} of imports) {
    if (team.length < 6) continue;
    try {
      team = clean(dex, validator, team);
    } catch (e) {
      console.error(`Failed to parse team from text`, e);
      continue;
    }
    if (seen.has(JSON.stringify(team))) continue;

    let author = undefined;
    // There's really no consistency with respect to distinguishing the author from the team name
    // but we make a best-effort attempt to do so
    const m = BY.exec(name);
    if (m) {
      name = m[1];
      author = m[2] ?? m[3] ?? m[4] ?? m[5] ?? m[6];
    }

    teams.push({name, author, data: team});
  }

  return teams;
}

async function scrapeThread(format, url) {
  const document = new JSDOM(await (await fetch(url)).text()).window.document;

  const dex = Dex.forFormat(format);
  // TODO: pkmn/ps#25
  const validator = format.id === 'gen9lc' ? undefined : new TeamValidator(format, dex);

  let teams = [];
  // Some sample team links are to one specific post (yay!) whereas others are to a thread. In the
  // latter case we need to hunt through the posts one-by-one to figure out which one "looks" like
  // it has data. The main confounder are some threads which list an "example" team in the OP to
  // demonstrate the format - to combat this we use the heuristic that if there's only one team in a
  // post then we keep looking.
  //
  // Upstream maintainers could help a lot here by *always* linking to a singular post...
  const m = POST.exec(url);
  if (m) {
    const post = document.getElementById(`post-${m[1]}`).parentElement;
    teams = await scrapeTeams(post, dex, validator);
  } else {
    for (const post of document.getElementsByClassName('message-body')) {
      teams = await scrapeTeams(post, dex, validator);
      if (teams.length > 1) break;
    }
  }
  if (!teams.length) throw new Error(`No teams found at ${url}`);
  return teams;
}

async function scrapeTeams(post, dex, validator) {
  let teams = [];

  // Some threads have a raw pokepast.es link but also link the sprites or name of the team so we
  // need to dedupe the URLs to avoid fetching them multiple times
  const fetched = new Set();
  for (const a of post.getElementsByTagName('a')) {
    if (spoiler(a)) continue;
    if (a.href.startsWith('https://pokepast.es')) {
      const link = `${a.href}${a.href.endsWith('/') ? 'json' : '/json'}`;
      if (fetched.has(link)) continue;
      const json = await request(link);
      fetched.add(link);

      try {
        const data = parse(json.paste, dex, validator);
        if (!data) continue;
        // Regrettably, the author and title here is *not* guaranteed to match the "true" author and
        // title specified in the body of the sample teams threads. Actually parsing this data out
        // of the post itself is kind of a fool's errand given how difficult it is to reconcile the
        // vastly inconsistent formatting used by each subcommunity --- curators concerned with
        // misattribution shouldwork to fix the problem at the source instead of here ("GIGO")
        const name = (!json.title || UNTITLED.test(json.title)) ? undefined : json.title;
        const author = (!json.author || GUEST.test(json.author)) ? undefined : json.author;
        teams.push({name, author, data});
      } catch (e) {
        console.error(`Failed to parse team from ${link}`, e);
      }
    }
  }

  if (teams.length > 1) return teams;

  teams = [];
  for (const block of post.querySelectorAll('.bbCodeSpoiler-content .bbCodeBlock-content')) {
    try {
      const data = parse(block.textContent, dex, validator);
      if (!data) continue;
      teams.push({data});
    } catch (e) {
      console.error(`Failed to parse team from importable`, e);
    }
  }

  return teams;
}

function spoiler(e) {
  while ((e = e.parentElement) && !e.classList.contains('bbCodeSpoiler-content'));
  return !!e;
}

function parse(s, dex, validator) {
  // Typically paragraphs of prose tend to get parsed by the team importer as having too many team
  // members or multiple moves etc. Some basic sanity checking on the "shape" of the team up front
  // allows us to fairly liberally attempt to parse every code block without getting lots of errors
  // from the team validator later on.
  let team;
  try {
    team = Team.import(s)?.team.slice(0, 6);
  } catch (e) {
    return undefined;
  }
  if (!team) return undefined;
  if (!team.some(s => s.moves?.length)) return undefined;

  return clean(dex, validator, team);
}

function clean(dex, validator, team) {
  team = team.map(set => fixSet(dex, set));
  const errors = validator?.validateTeam(team);
  // if (errors) throw new Error(`Invalid team:\n\n${s.trim()}\n\n===\n\n${errors.join('\n -' )}\n`);
  if (errors) throw new Error(errors.join('\n'));
  return Team.canonicalize(team, dex).map(s => pretty(dex, s, validator?.ruleTable?.defaultLevel));
}

function fixSet(dex, set) {
  const species = dex.species.get(set.species);

  // TODO: remove hardcode when no longer eventOnly
  if (['gougingfire', 'ragingbolt', 'ironcrown', 'ironboulder'].includes(species.id)) {
    set.ivs = {hp: 20, atk: 20, def: 20, spa: 20, spd: 20, spe: 20};
  }

  // the team validator will randomly assign a gender if we don't - use gen 2 rules
  if (dex.gen >= 2) {
    const atkDV = Math.floor((set.ivs?.atk || 31) / 2);
    const expectedGender = atkDV >= (species.genderRatio.F * 16) ? 'M' : 'F';
    set.gender = set.gender || species.gender || expectedGender;
  }

  // authors don't seem to realize you can't slash options into an export like you can an analysis
  set.ability = set.ability?.split(' / ')[0];
  set.item = set.item?.split(' / ')[0];
  set.moves = set.moves?.map(m => m.split(' / ')[0]);

  if (['none', 'noability'].includes(toID(set.ability))) set.ability = undefined;

  // validating with {removeNicknames: true} still complains about name length -_-
  set.name = undefined;

  return set;
}

function pretty(dex, set, level) {
  const base = dex.gen >= 3 ? 0 : 252;

  let count = 0;
  const ivs = {};
  for (const iv in set.ivs) {
    if (set.ivs[iv] === 31) continue;
    ivs[iv] = set.ivs[iv];
    count++;
  }
  set.ivs = count > 0 ? ivs : undefined;

  count = 0;
  const evs = {};
  for (const ev in set.evs) {
    if (set.evs[ev] === base) continue;
    evs[ev] = set.evs[ev];
    count++;
  }
  set.evs = count > 0 ? evs : undefined;

  if (set.level === level) set.level = undefined;

  set.species = dex.species.get(set.species).name;
  set.moves = set.moves.map(m => dex.moves.get(m).name);
  if (set.item) set.item = dex.items.get(set.item).name;
  if (set.ability) set.ability = dex.abilities.get(set.ability).name;
  if (set.nature) set.nature = dex.natures.get(set.nature).name;

  return set;
}

async function serialize(data, file) {
  // NOTE: This pretty stringify will result in ~10% larger files, though we don't care because
  // this will amount to significantly less after gzip and we want to have meaningful diffs
  const json = stringify(data, {maxLength: 400});
  await fs.promises.writeFile(path.join(DATA, file), json);
  const compressed = await gzip(json);
  return [json.length, compressed.length];
}
