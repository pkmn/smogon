export type ID = '' | string & { __isID: true };
export type Generation = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export interface StatsTable<T> {
  hp: T;
  atk: T;
  def: T;
  spa: T;
  spd: T;
  spe: T;
}

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
  moveslots: string[][];
  evconfigs: Array<StatsTable<number>>;
  ivconfigs: Array<StatsTable<number>>;
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

const GENS = ['rb', 'gs', 'rs', 'dp', 'bw', 'xy', 'sm'];

function toID(text: any): ID {
  return ('' + text).toLowerCase().replace(/[^a-z0-9]+/g, '') as ID;
}

export const Analyses = new (class {
  readonly URL = 'https://www.smogon.com/dex/';

  url(pokemon: string, gen: Generation = 7) {
    return `${Analyses.URL}${Analyses.gen(gen)}/pokemon/${toID(pokemon)}/`;
  }

  parse(raw: string) {
    const match = raw.match(/dexSettings = ({.*})/);
    if (!match) return undefined;
    return JSON.parse(match[1]) as DexSettings;
  }

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

  gen(gen: Generation) {
    return GENS[gen - 1];
  }
})();

export const Statistics = new (class {
  readonly URL = 'https://www.smogon.com/stats/';

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

  url(date: string, format: string, weighted = true) {
    const formatid = toID(format);
    const rating = weighted ? (formatid === 'gen7ou' ? 1825 : 1760) : 0;
    return `${Statistics.URL}${date}/chaos/${formatid}-${rating}.json`;
  }

  parse(raw: string) {
    return JSON.parse(raw) as UsageStatistics;
  }

  process(raw: string) {
    return Statistics.parse(raw);
  }
})();
