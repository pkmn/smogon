import {
  AbilityName,
  Generation,
  ID,
  ItemName,
  MoveName,
  NatureName,
  PokemonSet,
  Specie,
  StatID,
  StatsTable,
  toID,
} from '@pkmn/data';
import {Credits, MovesetStatistics, Statistics} from 'smogon';

export interface Analysis extends Omit<RawAnalysis, 'sets'> {
  sets: Array<Moveset & {name: string, desc?: string}>;
}

interface RawAnalysis {
  overview?: string;
  comments?: string;
  sets: Array<{
    name: string,
    desc?: string
  }>;
  credits?: Credits;
}

export interface Moveset {
  levels?: number | number[];
  ability: AbilityName | AbilityName[];
  item?: ItemName | ItemName[];
  nature?: NatureName | NatureName[];
  ivs?: StatsTable[];
  evs?: StatsTable[];
  moves: Array<MoveName | MoveName[]>;
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[P] extends ReadonlyArray<infer V>
      ? ReadonlyArray<DeepPartial<V>>
      : DeepPartial<T[P]>
};

type Analyses = {
  [species: string]: {
    [formatid: string]: RawAnalysis
  }
};

type Sets = {
  [species: string]: {
    [formatid: string]: {
      [name: string]: Moveset
    }
  }
};

const URL = 'https://data.pkmn.cc/';

const FALLBACK = ['uber', 'ou', 'uu', 'ru', 'nu', 'pu', 'zu'] as ID[];
const LOWEST = [2, 4, 4, 4, 4, 5, 6, 6] as const;

const PREFIXES = ['Pichu', 'Basculin', 'Keldeo', 'Genesect', 'Vivillon', 'Magearna'];
const SUFFIXES = ['-Antique', '-Totem'];

/** TODO */
export class Smogon {
  private readonly fetch: (url: string) => Promise<{json(): Promise<any>}>;
  private readonly cache: {
    analyses: {[formatid: string]: Record<string, RawAnalysis>},
    sets: {[formatid: string]: Record<string, Record<string, Moveset>>},
    stats: {[formatid: string]: Record<string, MovesetStatistics>},
  };

  constructor(fetch: (url: string) => Promise<{json(): Promise<any>}>) {
    this.fetch = fetch;
    this.cache = {analyses: {}, sets: {}, stats: {}};
  }

  /** TODO */
  async analysis(gen: Generation, species: string | Specie, format?: ID, all = false) {
    if (typeof species === 'string') {
      const s = gen.species.get(species);
      if (!s) return undefined;
      species = s;
    }

    const formats = this.formats(gen, species, format);
    if (!formats) return undefined;

    const name = this.name(gen, species);
    let analyses: Record<string /* name */, RawAnalysis> = {};
    for (format of formats) {
      const data = await this.get('analyses', format);
      if (data) {
        analyses = data as Record<string, RawAnalysis>;
        if (analyses[name] && !all) break;
      }
    }

    const raw = analyses[name];
    if (!raw) return undefined;

    const sets = await this.movesets(name, [format!], all);
    if (!sets) return undefined;

    const analysis: Analysis = {
      format: raw.format,
      overview: raw.overview,
      comments: raw.comments,
      credits: raw.credits,
      sets: [],
    };

    for (const stub of raw.sets) {
      const set = sets[stub.name];
      if (set) {
        analysis.sets.push({
          name: stub.name,
          desc: stub.desc,
          ...set
        } as Moveset & {name: string, desc?: string});
      }
    }

    return analysis.sets.length ? analysis : undefined;
  }

  /** TODO */
  async sets(gen: Generation, species: string | Specie, format?: ID, all = false) {
    if (typeof species === 'string') {
      const s = gen.species.get(species);
      if (!s) return undefined;
      species = s;
    }

    const formats = this.formats(gen, species, format);
    if (!formats) return undefined;

    const name = this.name(gen, species);
    const movesets = await this.movesets(name, formats, all);
    if (!movesets) return undefined;

    const hackmons =
      (format?.endsWith('balancedhackmons') &&
      species.name !== 'Groundon-Primal' &&
      !(gen.num === 7 && species.name === 'Kyogre-Primal'));

    const speciesName = hackmons ? species.name : this.name(gen, species, true);

    const sets = [];
    for (const key in movesets) {
      const s = movesets[key];
      const set: DeepPartial<PokemonSet> = {
        name: key,
        species: speciesName,
        item: s.item?.[0],
        ability: s.ability?.[0],
        moves: s.moves.map(ms => ms[0]),
        level: s.level,
        nature: s.nature?.[0],
        ivs: s.ivs?.[0],
        evs: s.evs?.[0],
        gigantamax: species.isNonstandard === 'Gigantamax',
      };
      if (this.match(species, set)) sets.push(fixHP(gen, set));
    }

    return sets;
  }

  /** TODO */
  async stats(gen: Generation, species: string | Specie, format?: ID) {
    if (typeof species === 'string') {
      const s = gen.species.get(species);
      if (!s) return undefined;
      species = s;
    }

    const formats = this.formats(gen, species, format);
    if (!formats) return undefined;
    format = formats[0];

    let stats = this.cache.stats[format];
    if (!stats) {
      const latest = await Statistics.latestDate(format, true);
      if (!latest) return undefined;
      const response = await this.fetch(Statistics.url(latest.date, format));
      stats = this.cache.stats[format] = (await response.json()).data;
    }

    return stats[this.name(gen, species, false, true)];
  }

  /** TODO */
  fallbacks(gen: Generation, begin = 0, end: number = LOWEST[gen.num - 1], formats: ID[] = []) {
    if (begin < end) {
      for (; begin <= end; begin++) {
        const tier = FALLBACK[begin] === 'uber' ? 'ubers' : FALLBACK[begin];
        if (tier === 'ru' && gen.num < 5) continue;
        formats.push(`gen${gen.num}${tier}` as ID);
      }
    } else {
      for (; begin >= end; begin--) {
        const tier = FALLBACK[begin] === 'uber' ? 'ubers' : FALLBACK[begin];
        if (tier === 'ru' && gen.num < 5) continue;
        formats.push(`gen${gen.num}${tier}` as ID);
      }
    }
    return formats;
  }

  // TODO
  private async get(type: 'sets' | 'analyses', format: ID) {
    let data = this.cache[type][format];
    if (!data) {
      const response = await this.fetch(`${URL}/${type}/${format}.json`);
      data = this.cache[type][format] = await response.json();
    }
    return data;
  }

  // TODO
  private async movesets(
    name: string,
    formats: ID[],
    all: boolean,
  ) {
    let sets: Record<string /* species */, Record<string /* name */, Moveset>> = {};
    for (const format of formats) {
      const data = await this.get('sets', format);
      if (data) {
        sets = data as Record<string, Record<string, Moveset>>;
        if (sets[name] && !all) return sets[name];
      }
    }
    return sets[name];
  }

  // TODO
  private match(species: Specie, set: DeepPartial<PokemonSet>) {
    if (species.requiredAbility) return set.ability === species.requiredAbility;
    if (species.requiredItem) return set.item === species.requiredItem;
    if (species.requiredItems) return species.requiredItems.includes(set.item as ItemName);
    if (species.requiredMove) return set.moves!.includes(species.requiredMove);
    return true;
  }

  // TODO
  private name(gen: Generation, species: Specie, specific = false, stats = false) {
    if (species.isMega || species.isPrimal || species.name === 'Greninja-Ash') {
      return stats ? species.name : species.baseSpecies;
    }

    if (species.battleOnly) {
      return Array.isArray(species.battleOnly) ? species.battleOnly[0] : species.battleOnly;
    }

    if (species.name.endsWith('-Gmax')) {
      return stats ? species.name : species.baseSpecies;
    }

    if (specific) return species.name;

    if (gen.species.get(species.baseSpecies)!.cosmeticFormes?.includes(species.name) ||
        PREFIXES.some(prefix => species.name.startsWith(prefix))) {
      return species.baseSpecies;
    }

    const suffixed = stats
      ? species.name.endsWith('-Antique')
      : SUFFIXES.some(suffix => species.name.endsWith(suffix));
    if (suffixed) return species.baseSpecies;

    if (species.name.startsWith('Pikachu') && species.name !== 'Pikachu-Starter') {
      return species.baseSpecies;
    }

    return species.name;
  }

  // TODO
  private formats(gen: Generation, species: Specie, format?: ID): ID[] | undefined {
    if (format) {
      if (format.includes('doubles')) {

      } else {
        // turn format into tier, + do tier order
        // if format cant be turned into tier, just return [format]
      }

    }


    let id = toID(tier);
    if (id === 'illegal' || id === 'unreleased') return undefined;
    if (id.startsWith('cap')) return [`gen${gen.num}cap`] as ID[];
    if (id.startsWith('lc')) return [`gen${gen.num}lc`] as ID[];
    if (id === 'ag') {
      return [`gen${gen.num}anythinggoes` as ID, ...this.formats(gen, 'Uber', format)!];
    }

    let begin =
      id === 'nfe' ? LOWEST[gen.num - 1] :
      id.endsWith('bl') ? FALLBACK.indexOf(id.slice(0, -2) as ID) - 1
      : FALLBACK.indexOf(id);

    return this.fallbacks(gen, begin, 0, this.fallbacks(gen, begin));
  }
}

/*
export namespace TierTypes {
  export type Singles = "AG" | "Uber" | "(Uber)" | "OU" | "(OU)" | "UUBL" | "UU" | "RUBL" | "RU" | "NUBL" | "NU" |
  "(NU)" | "PUBL" | "PU" | "(PU)" | "NFE" | "LC Uber" | "LC";
  export type Doubles = "DUber" | "(DUber)" | "DOU" | "(DOU)" | "DBL" | "DUU" | "(DUU)" | "NFE" | "LC Uber" | "LC";
  export type Other = "Unreleased" | "Illegal" | "CAP" | "CAP NFE" | "CAP LC";
}
*/

// static readonly FALLBACK = {
//   1: ['uber', 'ou', 'uu'],
//   2: ['uber', 'ou', 'uu', 'nu'],
//   3: ['uber', 'ou', 'uu', 'nu'],
//   4: ['ag', 'uber', 'ou', 'uu', 'nu'],
//   5: ['uber', 'ou', 'uu', 'ru', 'nu'],
//   6: ['ag', 'uber', 'ou', 'uu', 'ru', 'nu', 'pu'],
//   7: ['ag', 'uber', 'ou', 'uu', 'ru', 'nu', 'pu', 'zu'],
//   8: ['ag', 'uber', 'ou', 'uu', 'ru', 'nu', 'pu', 'zu'],
// } as const;


// TODO
function fixHP(gen: Generation, set: DeepPartial<PokemonSet>) {
  const hp = set.moves!.find(m => m.startsWith('Hidden Power'));
  if (hp) {
    let fill = gen.num <= 2 ? 30 : 31;
    const type = hp.slice(13);
    if (type && gen.types.getHiddenPower(gen.stats.fill(set.ivs || {}, fill)).type !== type) {
      if (!set.ivs || (gen.num >= 7 && (!set.level || set.level === 100))) {
        set.hpType = type;
        fill = 31;
      } else if (gen.num === 2) {
        const dvs = {...gen.types.get(type)!.HPdvs};
        let stat: StatID;
        for (stat in dvs) {
          dvs[stat]! *= 2;
        }
        set.ivs = {...dvs, ...set.ivs};
        set.ivs.hp = gen.stats.getHPDV(set.ivs);
      } else {
        set.ivs = {...gen.types.get(type)!.HPivs, ...set.ivs};
      }
    }
  }
  return set;
}
