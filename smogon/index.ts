const latest = import('./latest.json');
const LATEST = (latest as unknown) as Promise<{
  [id: string]: [string, number] | [[string, number], [string, number]];
}>;

export type ID = '' | (string & { __isID: true });
export type GenerationNum = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type TypeName =
  'Normal' | 'Fighting' | 'Flying' | 'Poison' | 'Ground' | 'Rock' | 'Bug' | 'Ghost' | 'Steel' |
  'Fire' | 'Water' | 'Grass' | 'Electric' | 'Psychic' | 'Ice' | 'Dragon' | 'Dark' | 'Fairy' | '???';

export type StatID = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
export type StatsTable<T = number> = { [stat in StatID]: T };

export interface Analysis {
  format: string;
  outdated: string | null;
  overview: string;
  comments: string;
  movesets: Moveset[];
  credits: Credits;
}

export interface Moveset {
  name: string;
  description: string;
  pokemon: string;
  levels: number[];
  abilities: string[];
  items: string[];
  moveslots: Array<Array<{ move: string; type: TypeName | null }>>;
  evconfigs: StatsTable[];
  ivconfigs: StatsTable[];
  natures: string[];
  teratypes: (TypeName | 'Stellar')[];
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
  Happiness?: { [happiness: string]: number };
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
      DexDumpPokemonResponse
    ]
  ];
}

interface DexDumpPokemonResponse {
  languages: string[];
  learnset: string[];
  strategies: Analysis[];
}

const GENS = ['rb', 'gs', 'rs', 'dp', 'bw', 'xy', 'sm', 'ss', 'sv'];

const PARSE_REGEX = /dexSettings = ({.*})/;

function toID(text: any): ID {
  return ('' + text).toLowerCase().replace(/[^a-z0-9]+/g, '') as ID;
}

function toAlias(text: any) {
  return ('' + text).toLowerCase().replace(/[ _]+/, '-').replace(/[^a-z0-9-]+/g, '');
}

function toPokemonAlias(text: any) {
  const alias = toAlias(text);
  return alias === 'meowstic' ? 'meowstic-m' : alias; // sigh
}

export const Analyses = new (class {
  readonly URL = 'https://www.smogon.com/dex/';
  readonly RPC = '_rpc/dump-pokemon';

  /**
   * Returns the Analysis URL for a given pokemon and gen.
   * @deprecated use Analyses.request
   */
  url(pokemon: string, gen: GenerationNum = 9) {
    return `${Analyses.URL}${Analyses.gen(gen)}/pokemon/${toPokemonAlias(pokemon)}/`;
  }

  /**
   * Returns the Analysis RPC URL and request configuration for a given pokemon and gen.
   */
  request(pokemon: string, gen: GenerationNum = 9, language = 'en') {
    return {
      url: `${Analyses.URL}${Analyses.RPC}`,
      init: {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({gen: Analyses.gen(gen), alias: toPokemonAlias(pokemon), language}),
      },
    };
  }

  /**
   * Parses out the DexSettings object embedded in the raw HTML retrieved from the Smogon dex.
   */
  parse(raw: string) {
    const match = PARSE_REGEX.exec(raw);
    if (!match) return undefined;
    return JSON.parse(match[1]) as DexSettings;
  }

  /**
   * Given either the raw HTML retrieved from the Smogon dex, the parsed DexSettings object, or
   * an RPC response, returns a map of Analysis objects keyed by format or undefined if its input
   * was invalid.
   */
  process(ds: string | DexSettings | DexDumpPokemonResponse) {
    const parsed = typeof ds === 'string' ? Analyses.parse(ds) : ds;
    if (!parsed) return undefined;

    let strategies: Analysis[];
    if ('injectRpcs' in parsed) {
      const valid = parsed.injectRpcs[2]?.[1]?.['strategies'];
      if (!valid) return undefined;
      strategies = valid;
    } else {
      strategies = parsed.strategies;
    }

    const analysesByFormat: Map<string, Analysis[]> = new Map();
    for (const analysis of strategies) {
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
  gen(gen: GenerationNum) {
    return GENS[gen - 1];
  }
})();

// Metagames which continued to be played after gen6, transitioning from a bare unqualified
// name to a 'gen6'-qualified one. Most migrated over on 2017-07, though the LATE metagames
// below were only given qualification from 2018 and onward.
const LEGACY = new Set([
  '1v1', 'anythinggoes', 'battlespotdoubles', 'battlespotsingles', 'battlespottriples',
  'cap', 'lc', 'monotype', 'nu', 'ou', 'pu', 'randombattle', 'ru', 'ubers', 'uu',
  'balancedhackmons', 'doublesou', 'doublesuu', 'battlefactory', 'mixandmega', 'vgc2016',
  'ounoteampreview', 'customgame', 'doublescustomgame', 'triplescustomgame', 'purehackmons',
  'almostanyability',
]);

export type Report = 'usage' | 'leads' | 'moveset' | 'metagame' | 'chaos';

const RE = />(\d{4}-\d{2})\/</;

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
        const m = RE.exec(line);
        if (!m) continue;
        return m[1];
      }
    }
    throw new Error('Unexpected format for index');
  }

  /**
   * Given the HTML page returned from querying a URL listing available reports, returns the list of
   * available formats.
   */
  formats(page: string): string[] {
    const lines = page.split('\n');
    const formats: string[] = [];
    for (const line of lines) {
      if (line.startsWith('<a href=')) {
        const quote = line.indexOf('"', 9);
        const split = line.slice(9, quote).split('-');
        if (split.length !== 2) continue;
        if (!formats.length || formats[formats.length - 1] !== split[0]) formats.push(split[0]);
      }
    }
    return formats;
  }

  /**
   * Returns the URL of the reports for the given date and format, defaulting to providing the
   * highest detailed ('chaos') weighted stats available for the format in question. Unweighted
   * stats or stats of a specific weight or alternative reports may also be requested, though may be
   * absent depending on the date and format.
   */
  url(date: string, format: string, weighted: number | boolean = true, report: Report = 'chaos') {
    let formatid = toID(format);
    // When Gen 7 was released the naming scheme for 'current' formats was changed from
    // 'x' => 'genNx'. formatFor will translate between the two as approriate, but there
    // is an edge case for 2016-12 where both randombattle and gen6randombattle exist
    if (!(date === '2016-12' && ['gen6randombattle', 'randombattle'].includes(formatid))) {
      formatid = formatFor(formatid, date);
    }

    // If we've been given a weight then we use that, otherwise we use weightFor to
    // figure out what the highest weight cutoff for the format was (usually 1630 or 1695)
    const rating = weighted
      ? typeof weighted === 'number' ? weighted
      : weightFor(formatid, date)
      : 0;

    if (report === 'usage') return `${Statistics.URL}${date}/${formatid}-${rating}.txt`;
    const ext = report === 'chaos' ? 'json' : 'txt';
    return `${Statistics.URL}${date}/${report}/${formatid}-${rating}.${ext}`;
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
    return {date, count};
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

// Formats which were popular enough to use higher weightings when they were the current gen.
const POPULAR = {
  6: [
    'ou', 'oususpecttest', 'doublesou', 'randombattle',
    'smogondoubles', 'doublesou', 'doublesoususpecttest',
  ],
  7: [
    'gen7ou', 'gen7oususpecttest', 'gen7doublesou', 'gen7doublesoususpecttest',
    'gen7pokebankou', 'gen7pokebankoususpecttest', 'gen7pokebankdoublesou',
  ],
  8: ['gen8doublesou', 'gen8doublesoususpect', 'gen8ou', 'gen8oususpecttest'],
  9: ['gen9doublesou', 'gen9doublesoususpect', 'gen9ou', 'gen9oususpecttest'],
};

function weightFor(format: ID, date: string) {
  // NOTE: Legacy format notation is signficant here: gen6ou was only 'popular' while it was still
  // called 'ou' and thus we don't really care about the date.
  if (POPULAR[6].includes(format)) return 1695;
  // Gen 7 formats ceased to be 'popular' from 2020-02 onwards, though we need to check
  // gen7doublesou first as it had a weird discontinuity at the beginning of the format.
  if (format === 'gen7doublesou' && date < '2017-02') return 1630;
  if (POPULAR[7].includes(format)) return date > '2020-01' ? 1630 : 1695;
  // smogondoublessuspecttest only has two months of date, but 2015-04 had a higher weighting.
  if (format === 'smogondoublessuspecttest' && date === '2015-04') return 1695;
  if (POPULAR[8].includes(format)) return date > '2022-10' ? 1630 : 1695;
  return POPULAR[9].includes(format) ? 1695 : 1630;
}

const LATE = ['1v1', 'cap', 'monotype', 'balancedhackmons', 'mixandmega'];

const FORMAT_REGEX = /gen(\d)(.*)/;

function formatFor(format: ID, date: string) {
  // 2017-01/02 mark the last random battle statistics, at which point randombattle has been
  // renamed to its qualified form several months before the other formats
  if (['gen6randombattle', 'randombattle'].includes(format) && date > '2016-12') {
    return 'gen6randombattle' as ID;
  }

  const m = FORMAT_REGEX.exec(format);
  // Return if we've been given a format with the standard notation and its not Gen 6
  if (m && m[1] !== '6') return format;
  // Return the unqualified metagame if the format starts with 'gen6' but has been discontinued
  if (m && !LEGACY.has(m[2])) return m[2] as ID;

  if (m) {
    // If the format is 'gen6'-qualified but the date requested is before the standard 2017-06/07
    // migration (or was a late-migrating metagame and before 2017-12/2018-01), remove the qualifier
    return date < '2017-07' || (date < '2018-01' && LATE.includes(m[2])) ? (m[2] as ID) : format;
  } else {
    // If the format unqualified but the date requested is after the standard 2017-06/07 migration
    // (or was a late-migrating metagame and after 2017-12/2018-01), add the 'gen6'-qualifier
    return date > '2017-12' || (date > '2017-06' && !LATE.includes(format))
      ? (`gen6${format}` as ID)
      : format;
  }
}
