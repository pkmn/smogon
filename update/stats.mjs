#!/usr/bin/env node --no-warnings --experimental-specifier-resolution=node
'use strict';

import sourceMapSupport from 'source-map-support';
sourceMapSupport.install();

// This script crawls https://www.smogon.com/stats/ and produces:
//
//   - smogon/latest.json: a map from format => [[latest, count], [best, count]] | [latest, count]
//     for each format hosted on smogon.com/stats. This is used to power the smogon package's
//     smogon.Statistics.latestDate method.
//   - data/stats/state.json: contains the latest data processed as well as a mapping from supported
//     format => [total, count] where total is the total number of battles for the format over
//     the count months it has had stats. This is used to avoid having to go over all the previous
//     months when updating stats.
//   - data/stats/*.json: @pkmn/stats converted LegacyDisplayStatistics data for each of the *best*
//     dates for each supported format as indicated by smogon/latest.json.
//   - data/stats/index.json: an index of the [size, compressed size] for each of the
//     LegacyDisplayStatistics files.

import * as fs from 'fs';
import * as path from 'path';
import {fileURLToPath} from 'url';
import stringify from 'json-stringify-pretty-compact';
import * as wrapr from 'wrapr';

import * as zlib from 'zlib';
import * as util from 'util';
const gzip = util.promisify(zlib.gzip);

import * as stats from '@pkmn/stats';
import {Dex} from '@pkmn/sim';
import * as smogon from 'smogon';

const gens = stats.newGenerations(Dex);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const request = wrapr.retrying(wrapr.throttling(fetch, 5, 1000));

const N = 1e4;

const UNSUPPORTED = ['1v1', 'challengecup1vs1'];
const SPECIAL = /(gen[789](?:vgc20(?:19|21|22|23)|battlestadium(?:singles|doubles)))(.*)/;

async function convert(format, date) {
  const leads = !stats.isNonSinglesFormat(format) && !UNSUPPORTED.includes(format);
  const metagame = !UNSUPPORTED.includes(format);
  const gen = gens.get(format.startsWith('gen') ? +format.charAt(3) : 6);
  // FIXME: bug with gen9doublesou missing a report
  const weighted = format === 'gen9doublesou' && date == '2023-09' ? 1500 : true;
  const url = report => smogon.Statistics.url(date, format, weighted, report);

  return stats.Display.fromReports(gen,
    await (await request(url('usage'))).text(),
    await (await request(url('moveset'))).text(),
    await (await request(url('chaos'))).text(),
    metagame ? await (await request(url('metagame'))).text() : undefined,
    leads ? await (await request(url('leads'))).text() : undefined);
}

async function serialize(data, file) {
  // NOTE: This pretty stringify will result in ~10% larger files, though we don't care because
  // this will amount to significantly less after gzip and we want to have meaningful diffs
  const json = stringify(data);
  await fs.promises.writeFile(path.join(DATA, 'stats', file), json);
  const compressed = await gzip(json);
  return [json.length, compressed.length];
}

const DATA = path.resolve(__dirname, '../data');

// NOTE: Smogon doesn't have any analyses for this but we still consider it a supported format
const SUPPORTED = new Set(['gen8battlestadiumdoubles']);
for (const file of fs.readdirSync(path.join(DATA, 'sets'))) {
  if (file === 'index.json' || /gen\d.json/.test(file) || file.endsWith('nfe.json')) continue;
  const format = file.slice(0, file.indexOf('.'));
  SUPPORTED.add(format);
  // TODO: Smogon doesn't have analyses for most Generation 9 formats, so just carry over
  if (format.startsWith('gen8')) SUPPORTED.add(`gen9${format.slice(4)}`);
}

(async () => {
  let index, info, state, begin;
  try {
    index = JSON.parse(fs.readFileSync(path.join(DATA, 'stats', 'index.json')));
    info = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../smogon', 'latest.json')));
    state = JSON.parse(fs.readFileSync(path.join(DATA, 'stats', 'state.json')));
    begin = new Date(state.last);
    begin.setUTCMonth(begin.getUTCMonth() + 1);
  } catch {
    index = {};
    info = {}; // format => [[latest, count], [best, count]] | [latest, count]
    state = {formats: {}};
    begin = new Date('2014-11');
  }

  const formats = {};

  const end = new Date(smogon.Statistics.latest(
    await (await request(smogon.Statistics.URL)).text()));
  end.setUTCDate(end.getUTCDate() + 1);

  for (const d = begin; d <= end; d.setUTCMonth(d.getUTCMonth() + 1)) {
    const month = `${d.getUTCMonth() + 1}`.padStart(2, '0');
    const date = `${d.getUTCFullYear()}-${month}`;
    state.last = date;
    const page = await (await request(`${smogon.Statistics.URL}${date}/`)).text();

    for (const line of page.split('\n')) {
      const m = line.match(/<a href="(.*)-\d+.txt"/);
      if (m) {
        const format = smogon.Statistics.canonicalize(m[1]);
        if (formats[format] && typeof formats[format][date] === 'number') continue;
        formats[format] = formats[format] || {};
        formats[format][date] = formats[format][date] || 0;

        // The JSON files are quite large and needing to download and parse them to then
        // extract the 'number of battles' field is much slower than instead grabbing the
        // basic stats file and doing the comparatively cheap regex search.
        const u = smogon.Statistics.url(date, format, 0, 'usage');
        const usage = await request(u);

        if (usage) {
          // https://www.smogon.com/stats/2016-10/cap-*.txt is invalid and doesn't match... *sigh*
          const m = (await usage.text()).match(/^ Total battles: (.*)/);
          if (m) formats[format][date] = Number(m[1]);
        }
      }
    }
  }

  const special = new Set();
  for (const [format, dates] of Object.entries(formats)) {
    let latest = [null, 0];
    let best = [null, 0];
    let total = 0;
    let i = 0;
    let updated = false;
    if (info[format] && state.formats[format]) {
      if (Array.isArray(info[format][0])) {
        latest = info[format][0];
        best = info[format][1];
      } else {
        latest = best = info[format];
      }
      total = state.formats[format][0];
      i = state.formats[format][1];
    }

    for (const date in dates) {
      if (!dates[date]) continue;
      total += dates[date];
      i++;

      latest = [date, dates[date]];
      // best = max or latest thats above a threshold
      const threshold = Math.min(N, total/i);
      if (dates[date] >= best[1] || dates[date] > threshold) {
        updated = true;
        best = latest;
      }
    }
    if (latest[0]) info[format] = best === latest ? latest : [latest, best];

    const m = SPECIAL.exec(format);
    if ((m || SUPPORTED.has(format)) && updated) {
      if (m) {
        special.add(m[1]);
      } else {
        index[`${format}.json`] = await serialize(await convert(format, best[0]), `${format}.json`);
      }
    }
    state.formats[format] = [total, i];
  }

  const bests = {}; // base => [format, [best, count]];
  for (const format in info) {
    for (const s of special) {
      if (format.startsWith(s)) {
        const best = Array.isArray(info[format][0]) ? info[format][1] : info[format];
        if (!bests[s]) {
          bests[s] = [format, best];
        } else if (best[0] > bests[s][1][0]) {
          bests[s] = [format, best];
        } else if (best[0] === bests[s][1][0] && best[1] > bests[s][1][1]) {
          bests[s] = [format, best];
        }
        break;
      }
    }
  }

  for (const base in bests) {
    const format = bests[base][0];
    const date = bests[base][1][0];
    index[`${base}.json`] = await serialize(await convert(format, date), `${base}.json`);
  }

  let sorted = {};
  for (const format of Object.keys(info).sort()) {
    sorted[format] = info[format];
  }
  fs.writeFileSync(path.resolve(__dirname, '../smogon/latest.json'), stringify(sorted));
  sorted = {last: state.last, formats: {}};
  for (const format of Object.keys(state.formats).sort()) {
    sorted.formats[format] = state.formats[format];
  }
  fs.writeFileSync(path.join(DATA, 'stats', 'state.json'), stringify(sorted));
  sorted = {};
  for (const file of Object.keys(index).sort()) {
    sorted[file] = index[file];
  }
  fs.writeFileSync(path.join(DATA, 'stats', 'index.json'), stringify(sorted));
})().catch(err => {
  console.error(err);
  process.exit(1);
});
