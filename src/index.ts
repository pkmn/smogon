const latest = import('./latest.json');
const LATEST = latest as unknown as Promise<{
  [id: string]: [string, number] | [[string, number], [string, number]];
}>;

export type ID = '' | (string & { __isID: true });
export type Generation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
// prettier-ignore
export type Type =
  | '???' | 'Normal' | 'Grass' | 'Fire' | 'Water' | 'Electric' | 'Ice' | 'Flying' | 'Bug' | 'Poison'
  | 'Ground' | 'Rock' | 'Fighting' | 'Psychic' | 'Ghost' | 'Dragon' | 'Dark' | 'Steel' | 'Fairy';

export type StatName = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
export type StatsTable<T = number> = { [stat in StatName]: T };

export interface Analysis {
  format: string;
  overview: string;
  comments: string;
  movesets: Moveset[];
  credits: Credits;
}

export interface Moveset {
  name: string;
  description: string;
  level: number;
  abilities: string[];
  items: string[];
  moveslots: Array<Array<{ move: string; type: Type | null }>>;
  evconfigs: StatsTable[];
  ivconfigs: StatsTable[];
  natures: string[];
}

export interface Credits {
  teams: Array<{
    name: string;
    members: Member[];
  }>;
  writtenBy: Member[];
}

export interface Member {
  user_id: number;
  username: string;
}

export interface UsageStatistics {
  info: {
    metagame: string;
    cutoff: number;
    'cutoff deviation': 0;
    'team type': ID | null;
    'number of battles': number;
  };
  data: { [name: string]: MovesetStatistics };
}

export interface MovesetStatistics {
  'Raw count': number;
  usage: number;
  // num GXE, max GXE, 1% GXE, 20% GXE
  'Viability Ceiling': [number, number, number, number];
  Abilities: { [ability: string]: number };
  Items: { [item: string]: number };
  Spreads: { [spread: string]: number };
  Happiness: { [happiness: string]: number };
  Moves: { [move: string]: number };
  Teammates: { [pokemon: string]: number };
  // n = sum(POKE1_KOED...DOUBLE_SWITCH)
  // p = POKE1_KOED + POKE1_SWITCHED_OUT / n
  // d = sqrt((p * (1 - p)) / n)
  'Checks and Counters': { [pokemon: string]: [number, number, number] };
}

interface DexSettings {
  injectRpcs: [
    unknown, // 'dump-gens'
    unknown, // 'dump-basics'
    [
      // 'dump-pokemon'
      string, // key
      {
        strategies: Analysis[];
        [key: string]: unknown;
      }
    ]
  ];
}

const GENS = ['rb', 'gs', 'rs', 'dp', 'bw', 'xy', 'sm', 'ss'];

function toID(text: any): ID {
  return ('' + text).toLowerCase().replace(/[^a-z0-9]+/g, '') as ID;
}

export const Analyses = new (class {
  readonly URL = 'https://www.smogon.com/dex/';

  /**
   * Returns the Analysis URL for a given pokemon and generation.
   */
  url(pokemon: string, gen: Generation = 8) {
    return `${Analyses.URL}${Analyses.gen(gen)}/pokemon/${toID(pokemon)}/`;
  }

  /**
   * Parses out the DexSettings object embedded in the raw HTML retrieved from the Smogon dex.
   */
  parse(raw: string) {
    const match = raw.match(/dexSettings = ({.*})/);
    if (!match) return undefined;
    return JSON.parse(match[1]) as DexSettings;
  }

  /**
   * Given either the raw HTML retrieved from the Smogon dex or the parsed DexSettings object,
   * returns a map of Analysis objects keyed by format or undefined if its input was invalid.
   */
  process(ds: string | DexSettings) {
    const parsed = typeof ds === 'string' ? Analyses.parse(ds) : ds;
    const valid =
      parsed &&
      parsed['injectRpcs'] &&
      parsed['injectRpcs'][2] &&
      parsed['injectRpcs'][2][1] &&
      parsed['injectRpcs'][2][1]['strategies'];
    if (!valid) return undefined;

    const analysesByFormat: Map<string, Analysis[]> = new Map();
    for (const analysis of parsed!['injectRpcs'][2][1]['strategies']) {
      let analyses = analysesByFormat.get(analysis.format);
      if (!analyses) {
        analyses = [];
        analysesByFormat.set(analysis.format, analyses);
      }
      analyses.push(analysis);
    }

    return analysesByFormat;
  }

  /**
   * Returns Smogon's display representation of the given gen.
   */
  gen(gen: Generation) {
    return GENS[gen - 1];
  }
})();

// Metagames which continued to be played after gen6, transitioning from a bare unqualified
// name to a 'gen6'-qualified one. Most migrated over on 2017-07, though the LATE metagames
// below were only given qualification from 2018 and onward.
// prettier-ignore
const LEGACY = new Set([
  '1v1', 'anythinggoes', 'battlespotdoubles', 'battlespotsingles', 'battlespottriples',
  'cap', 'lc', 'monotype', 'nu', 'ou', 'pu', 'randombattle', 'ru', 'ubers', 'uu',
  'balancedhackmons', 'doublesou', 'doublesuu', 'battlefactory', 'mixandmega', 'vgc2016',
  'ounoteampreview', 'customgame', 'doublescustomgame', 'triplescustomgame',
]);

export const Statistics = new (class {
  readonly URL = 'https://www.smogon.com/stats/';

  /**
   * Given the HTML page returned from querying the Statistics.URL, returns the most recent
   * date stats are available for. This should usually be the beginning of the current month,
   * but this approach is more robust due to timezone differences and delays in publishing.
   */
  latest(page: string): string {
    const lines = page.split('\n');
    let i = lines.length;
    while (i--) {
      const line = lines[i];
      if (line.startsWith('<a href=')) {
        return line.slice(9, 16);
      }
    }
    throw new Error('Unexpected format for index');
  }

  /**
   * Returns the URL of the detailed ('chaos') stats for the given date and format, defaulting
   * to providing the highest weighted stats available for the format in question. Unweighted
   * stats or stats of a specific weight may also be requested, though may be absent depending
   * on the date and format.
   */
  url(date: string, format: string, weighted: number | boolean = true) {
    let formatid = toID(format);
    // When Gen 7 was released the naming scheme for 'current' formats was changed from
    // 'x' => 'genNx'. formatFor will translate between the two as approriate, but there
    // is an edge case for 2016-12 where both randombattle and gen6randombattle exist
    if (!(date === '2016-12' && ['gen6randombattle', 'randombattle'].includes(formatid))) {
      formatid = formatFor(formatid, date);
    }

    // If we've been given a weight then we use that, otherwise we use weightFor to
    // figure out what the highest weight cutoff for the format was (usually 1760 or 1825)
    // prettier-ignore
    const rating = weighted
      ? typeof weighted === 'number' ? weighted
      : weightFor(formatid, date)
      : 0;

    return `${Statistics.URL}${date}/chaos/${formatid}-${rating}.json`;
  }

  /**
   * Returns the date and count of the latest stats available for the given format at the time
   * this package was published. If best is provided, it will return the date and count for the
   * most recent month where a substantial enough amount of data was gathered. Returns undefined
   * if there is no data present. Note the accuracy of this function depends on the data in
   * latest.json being kept up to date.
   */
  async latestDate(format: string, best = false) {
    format = Statistics.canonicalize(toID(format));
    const data = (await LATEST)[format];
    if (!data) return undefined;
    const [date, count] = (Array.isArray(data[0]) ? data[+best] : data) as [string, number];
    return { date, count };
  }

  /**
   * Returns the canconical format name for the given format.
   */
  canonicalize(format: string) {
    return LEGACY.has(format) ? `gen6${format}` : format;
  }

  /**
   * Processes what was fetched from the URL returned by Statistics.url into UsageStatistics.
   */
  process(raw: string) {
    return JSON.parse(raw) as UsageStatistics;
  }
})();

// prettier-ignore
const POPULAR = [
  'gen8ou', 'gen8doublesou', 'gen7ou', 'gen7doublesou',
  'ou', 'doublesou', 'smogondoubles', 'randombattle',
];

function weightFor(format: ID, date: string) {
  // gen7doublesu ou and smogondoublessuspecttest have used different weights over the years
  if (format === 'gen7doublesou' && date < '2017-02') return 1760;
  if (format === 'smogondoublessuspecttest' && date === '2015-04') return 1825;
  // Otherwise, formats deemed 'popular' are assigned higher weight. Note that legacy format
  // notation is signficant here: gen6ou was only 'popular' while it was still called 'ou'
  return POPULAR.includes(format) ? 1825 : 1760;
}

const LATE = ['1v1', 'cap', 'monotype', 'balancedhackmons', 'mixandmega'];

function formatFor(format: ID, date: string) {
  // 2017-01/02 mark the last random battle statistics, at which point randombattle has been
  // renamed to its qualified form several months before the other formats
  if (['gen6randombattle', 'randombattle'].includes(format) && date > '2016-12') {
    return 'gen6randombattle' as ID;
  }

  const m = format.match(/gen(\d)(.*)/);
  // Return if we've been given a format with the standard notation and its not Gen 6
  if (m && m[1] !== '6') return format as ID;
  // Return the unqualified metagame if the format starts with 'gen6' but has been discontinued
  if (m && !LEGACY.has(m[2])) return m[2] as ID;

  if (m) {
    // If the format is 'gen6'-qualified but the date requested is before the standard 2017-06/07
    // migration (or was a late-migrating metagame and before 2017-12/2018-01), remove the qualifier
    return date < '2017-07' || (date < '2018-01' && LATE.includes(m[2])) ? (m[2] as ID) : format;
  } else {
    // If the format unqualified but the date requested is after the standard 2017-06/07 migration
    // (or was a late-migrating metagame and after 2017-12/2018-01), add the 'gen6'-qualifier
    return date > '2017-12' || (date > '2017-06' && LATE.includes(format))
      ? (`gen6${format}` as ID)
      : format;
  }
}
