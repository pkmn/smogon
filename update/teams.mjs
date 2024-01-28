#!/usr/bin/env node --no-warnings --experimental-specifier-resolution=node
'use strict';

import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

// FIXME add comments

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

const request = wrapr.retrying(wrapr.throttling(async url =>
  (await fetch(url)).json(), +process.argv[2] || 20, 1000));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(__dirname, '../data');

for (const file of fs.readdirSync(path.join(DATA, 'teams'))) {
  fs.unlinkSync(path.join(DATA, 'teams', file));
}

// FIXME doc discrepancy between live and @pkmn/sim
const SHOWDOWN = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/config/formats.ts';
const SMOGON = 'https://www.smogon.com/roa/';

const POST = /posts\/(\d+)\/?$/;

const IGNORE = [
  // Uncurated user submitted teams
  'https://www.smogon.com/forums/threads/3632667/',
  // Multiple formats within a single post
  'https://www.smogon.com/forums/posts/6431094/',
];

(async () => {
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
      const m = /"(http.*)".*ample/.exec(t)
      if (m) {
        const url = m[1];
        if (IGNORE.includes(url)) {
          ignored.add(url)
          continue outer;
        }
        const format = Dex.formats.get(f.name);
        // TODO: Use @pkmn/mods to support mods
        if (!/^gen\d$/.test(format.mod)) continue;
        if (!Dex.forFormat(format)) throw new Error(`Missing format '${f.name}'`);
        formats[format.id] = scrapeThread(format, url);
        continue outer;
      }
    }
  }

  if (ignored.size !== IGNORE.length) {
    const msg = `${Array.from(ignored).sort().join('\n')}\n\nvs.\n\n${IGNORE.sort().join('\n')}`;
    throw new Error(`Mismatched ignored URLs:\n\n${msg}`);
  }

  const html = await (await fetch(SMOGON)).text();
  let m = /<script>window.scmsJSON = ({.*})<\/script>/.exec(html);
  for (const f of JSON.parse(m[1]).FORMATS) {
    const format = Dex.formats.get(f);
    // TODO: Use @pkmn/mods to support mods
    if (!/^gen\d$/.test(format.mod)) continue;
    if (!Dex.forFormat(format)) throw new Error(`Missing format '${f}'`);

    const url = `https://www.smogon.com/roa/sample-files/${format.id}.txt`;
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
  const validator = format.id === 'gen9lc' ? undefined : new TeamValidator(format, dex);

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
    let m =
      /(.*) \(by (.*)\)/.exec(name) ??
      /(.*) (?:submitted )?by (.*)$/.exec(name) ??
      /(.*) \[(.*)\]$/.exec(name) ??
      /(.*), (.*)$/.exec(name) ??
      /(.*) - ([^-]*)$/.exec(name);
    if (m) {
      name = m[1];
      author = m[2];
    }

    teams.push({name, author, data: team});
  }

  return teams;
}

async function scrapeThread(format, url) {
  const document = new JSDOM(await (await fetch(url)).text()).window.document;
  const dex = Dex.forFormat(format);
  const validator = format.id === 'gen9lc' ? undefined : new TeamValidator(format, dex);

  let teams = [];
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
        const name = (!json.title || /Untitled \d+/.test(json.title)) ? undefined : json.title;
        const author = (!json.author ||/Guest \d+/.test(json.author)) ? undefined : json.author;
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
  return Team.canonicalize(team, dex);
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

async function serialize(data, file) {
  // NOTE: This pretty stringify will result in ~10% larger files, though we don't care because
  // this will amount to significantly less after gzip and we want to have meaningful diffs
  const json = stringify(data, {maxLength: 1000});
  await fs.promises.writeFile(path.join(DATA, file), json);
  const compressed = await gzip(json);
  return [json.length, compressed.length];
}
