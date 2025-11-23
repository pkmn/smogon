import {
  AbilityName, Generation, ID, ItemName, MoveName, NatureName,
  PokemonSet, Specie, StatID, StatsTable, Tier, TypeName,
} from '@pkmn/data';

// The structure of https://data.pkmn.cc/analyses/genN.json
interface GenAnalyses {
  [species: string]: {
    [tierid: string]: RawAnalysis;
  };
}

// The structure of https://data.pkmn.cc/analyses/genNtier.json
interface FormatAnalyses {
  [species: string]: RawAnalysis;
}

// The structure of https://data.pkmn.cc/sets/genN.json
interface GenSets {
  [species: string]: {
    [tierid: string]: {
      [name: string]: Moveset;
    };
  };
}

// The structure of https://data.pkmn.cc/sets/genNtier.json
interface FormatSets {
  [species: string]: {
    [name: string]: Moveset;
  };
}

// The raw analysis data from https://data.pkmn.cc/ - this needs to be joined with the sets data
// to form an Analysis which matches what is on Smogon.
interface RawAnalysis {
  outdated?: boolean;
  overview?: string;
  comments?: string;
  sets: {[name: string]: {description?: string; outdated?: boolean}};
  credits?: Credits;
}

// Copied from `smogon` package
interface Credits {
  teams: Array<{
    name: string;
    members: Member[];
  }>;
  writtenBy: Member[];
}

// Copied from `smogon` package
interface Member {
  user_id: number;
  username: string;
}

// The Team datatype from https://data.pkmn.cc/teams/genNtier.json
interface Team {
  name?: string;
  author?: string;
  data: PokemonSet[];
}

/**
 * The reconstituted analysis made from joining a RawAnalysis with the referenced Moveset objects.
 */
export interface Analysis extends Omit<RawAnalysis, 'sets'> {
  format: ID;
  sets: {[name: string]: Moveset & {description?: string; outdated?: boolean}};
}

/** A compressed version of the default smogon Moveset type which is smaller to serialize. */
export interface Moveset {
  level?: number | number[];
  ability: AbilityName | AbilityName[];
  item?: ItemName | ItemName[];
  nature?: NatureName | NatureName[];
  ivs?: Partial<StatsTable> | Partial<StatsTable>[];
  evs?: Partial<StatsTable> | Partial<StatsTable>[];
  moves: Array<MoveName | MoveName[]>;
  teratypes?: TypeName[];
}

/** A fairly sloppy definition of DeepPartial, but good enough for our use case. */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[P] extends ReadonlyArray<infer V>
      ? ReadonlyArray<DeepPartial<V>>
      : DeepPartial<T[P]>
};

/** @pkmn/stats output format for statistics. */
export interface DisplayStatistics<T = DisplayUsageStatistics> {
  battles: number;
  pokemon: {[name: string]: T};
  metagame: DisplayMetagameStatistics;
}

/** Output format for legacy smogon.com/stats reports converted to the new @pkmn/stats format. */
export interface LegacyDisplayStatistics extends
  Omit<DisplayStatistics<LegacyDisplayUsageStatistics>, 'metagame'> {
  metagame?: DisplayMetagameStatistics;
}

/** @pkmn/stats output format for Pokémon usage statistics. */
export interface DisplayUsageStatistics {
  lead?: Usage;
  usage: Usage;
  unique: Usage;
  win: Usage;

  count: number;
  weight: number | null;
  viability: [number, number, number, number];

  abilities: {[name: string]: number};
  items: {[name: string]: number};
  stats: {[stats: string]: number};
  moves: {[name: string]: number};
  teraTypes: {[name: string]: number};
  teammates: {[name: string]: number};
  counters: {[name: string]: [number, number, number]};
}

/**
 * Output format for the data for a specific Pokémon from legacy smogon.com/stats reports after
 * having been converted to the new @pkmn/stats format.
 */
export interface LegacyDisplayUsageStatistics
  extends Omit<DisplayUsageStatistics, 'unique' | 'win' | 'stats'> {
  happinesses?: {[happiness: string]: number};
  spreads: {[spreads: string]: number};
}

/** @pkmn/stats output format for metagame statistics. */
export interface DisplayMetagameStatistics {
  tags: {[tag: string]: number};
  stalliness: {
    histogram: Array<[number, number]>;
    mean: number;
    total: number;
  };
}

/**
 * Counts of the raw (unweighted), real (unweighted only counting Pokémon that actually appear in
 * battle), and weighted usage for a Pokémon.
 */
export interface Usage {
  raw: number;
  real: number;
  weighted: number;
}

const URL = 'https://data.pkmn.cc/';

const PREFIXES = ['Pichu', 'Basculin', 'Keldeo', 'Genesect', 'Vivillon', 'Magearna'];
const SUFFIXES = ['-Antique', '-Totem'];

// Conversion between a Pokémon's Tier and a format suffix.
const FORMATS: {[key in Exclude<Tier.Singles | 'ZU' | 'ZUBL' | Tier.Other, 'NFE'>]: string} = {
  AG: 'anythinggoes',
  Uber: 'ubers', '(Uber)': 'ubers',
  OU: 'ou', '(OU)': 'ou', 'UUBL': 'ou',
  UU: 'uu', 'RUBL': 'uu',
  RU: 'ru', 'NUBL': 'ru',
  NU: 'nu', '(NU)': 'nu', 'PUBL': 'nu',
  PU: 'pu', '(PU)': 'pu', 'ZUBL': 'pu',
  ZU: 'zu',
  LC: 'lc',
  Unreleased: 'anythinggoes',
  Illegal: 'anythinggoes',
  CAP: 'cap', 'CAP NFE': 'cap', 'CAP LC': 'cap',
};

// Battle-only formes banned in various generations of Balanced Hackmons.
const BANS = {
  6: ['Groudon-Primal', 'Kyogre-Primal'],
  7: ['Groudon-Primal'],
  8: ['Cramorant-Gorging', 'Darmanitan-Galar-Zen'],
};

// eslint-disable-next-line max-len
const SPECIAL = /(gen[789](?:vgc20(?:19|21|22|23|24|25)(reg(?:ulation)?[a-z])?|battlestadium(?:singles|doubles)|bs(?:s|d)))(.*)/;
const TRANSLATE = {
  'gen8bss': 'gen8battlestadiumsingles',
  'gen8bsd': 'gen8battlestadiumdoubles',
};

/**
 * Utility class for working with data from Smogon, requires a fetch function to request data. By
 * default this class will fetch an entire generation's worth of data for analyses or sets even if a
 * format parameter is passed to these methods, but if initialized with minimal = true then only a
 * single format will be fetched if a format parameter is provided to the analyses or sets methods.
 * If no format parameter is passed and minimal = true then only data from formats which happen to
 * already be cached will be returned.
 * */
export class Smogon {
  private readonly fetch: (url: string) => Promise<{json(): Promise<any>}>;
  private readonly cache: {
    gen: {
      analyses: {[gen: number]: GenAnalyses};
      sets: {[gen: number]: GenSets};
    };
    format: {
      analyses: {[formatid: string]: FormatAnalyses};
      sets: {[formatid: string]: FormatSets};
      stats: {[formatid: string]: DisplayStatistics | LegacyDisplayStatistics};
      teams: {[formatid: string]: Team[]};
    };
  };
  private readonly minimal: boolean;

  constructor(fetch: (url: string) => Promise<{json(): Promise<any>}>, minimal = false) {
    this.fetch = fetch;
    this.cache = {
      gen: {analyses: {}, sets: {}},
      format: {analyses: {}, sets: {}, stats: {}, teams: {}},
    };
    this.minimal = minimal;
  }

  /**
   * Returns Analysis objects for the given Pokémon species and gen, optionally scoped to a
   * particular format.
   */
  async analyses(gen: Generation, species: string | Specie, format?: ID) {
    if (typeof species === 'string') {
      const s = gen.species.get(species);
      if (!s) return [];
      species = s;
    }

    const name = this.name(gen, species);
    const original = format;
    if (format) format = this.baseFormat(format);
    const data = {
      analyses: (await this.get('analyses', gen, format) as GenAnalyses)[name],
      sets: (await this.get('sets', gen, format) as GenSets)[name],
    };
    if (!data.analyses || !data.sets) return [];

    const result: Analysis[] = [];
    for (const tierid in data.analyses) {
      const f = `gen${gen.num}${tierid}` as ID;
      if (format && f !== format) continue;

      const a = data.analyses[tierid];
      const s = data.sets[tierid];
      if (!s) continue;

      const analysis: Analysis = {
        format: original || f,
        overview: a.overview,
        comments: a.comments,
        credits: a.credits,
        sets: {},
      };

      let present = false;
      for (const setName in a.sets) {
        const set = s[setName];
        if (set && this.match(species, this.toSet(species, set))) {
          present = true;
          analysis.sets[setName] = {
            description: a.sets[setName].description,
            ...set,
          } as Moveset & {description?: string};
        }
      }

      if (present) result.push(analysis);
    }

    return result;
  }

  /**
   * Returns PokemonSet objects for the given Pokémon species and gen, optionally scoped to a
   * particular format.
   */
  async sets(gen: Generation, species: string | Specie, format?: ID) {
    if (typeof species === 'string') {
      const s = gen.species.get(species);
      if (!s) return [];
      species = s;
    }

    const name = this.name(gen, species);
    if (format) format = this.baseFormat(format);
    const data = (await this.get('sets', gen, format) as GenSets)[name];
    if (!data) return [];

    // Hackmons allows for various Pokémon to be in their battle-only state.
    const hackmons =
      format?.endsWith('balancedhackmons') && !(BANS as any)[gen.num]?.includes(species.name);
    const speciesName = hackmons ? species.name : this.name(gen, species, true);

    const sets = [];
    for (const tierid in data) {
      if (format && `gen${gen.num}${tierid}` !== format) continue;
      for (const setName in data[tierid]) {
        const set = this.toSet(species, data[tierid][setName], setName, speciesName);
        if (hackmons || this.match(species, set)) sets.push(this.fixIVs(gen, set));
      }
    }

    return sets;
  }

  /**
   * Returns weighted moveset usage statistics information for the given Pokémon species and gen for
   * the species' default format or the optional format provided.
   */
  async stats(
    gen: Generation, species: string | Specie, format?: ID
  ) {
    if (typeof species === 'string') {
      const s = gen.species.get(species);
      if (!s) return undefined;
      species = s;
    }

    format = this.baseFormat((format || Smogon.format(gen, species))!);

    let stats = this.cache.format.stats[format];
    if (!stats) {
      const response = await this.fetch(`${URL}/stats/${format}.json`);
      stats = this.cache.format.stats[format] = await response.json();
    }

    return stats.pokemon[this.name(gen, species, false, true)];
  }

  /** Returns sample teams for a given format. */
  async teams(format: ID) {
    format = this.baseFormat(format);

    let teams = this.cache.format.teams[format];
    if (!teams) {
      const response = await this.fetch(`${URL}/teams/${format}.json`);
      teams = this.cache.format.teams[format] = await response.json();
    }

    return teams;
  }

  /** Returns the format ID for the 'native' format of a species in the given gen. */
  static format(gen: Generation, species: string | Specie) {
    if (typeof species === 'string') {
      const s = gen.species.get(species);
      if (!s) return undefined;
      species = s;
    }
    const tierid = species.tier === 'NFE' ? (gen.num < 6 ? 'nu' : 'pu') : FORMATS[species.tier];
    return `gen${gen.num}${tierid}` as ID;
  }

  // Certain special formats like specific VGC or BSS series get reduced down to a 'base' format.
  private baseFormat(format: ID) {
    const m = SPECIAL.exec(format);
    if (!m) return format;
    const id = (TRANSLATE[m[1] as keyof typeof TRANSLATE] || m[1]) as ID;
    return m[2] ? id.slice(0, 11) as ID : id;
  }

  // Fetch analysis or set data for a specific gen and cache the result.
  private async get(type: 'sets' | 'analyses', gen: Generation, format?: ID) {
    let data = this.cache.gen[type][gen.num];
    if (!data) {
      if (this.minimal) {
        if (format) {
          let d = this.cache.format[type][format] as any;
          if (!d) {
            const response = await this.fetch(`${URL}/${type}/${format}.json`);
            d = this.cache.format[type][format] = await response.json();
          }
          const tierid = format.slice(4);
          const result: GenAnalyses | GenSets = {};
          for (const species in d) result[species] = {[tierid]: d[species]};
          return result;
        } else {
          const result: GenAnalyses | GenSets = {};
          for (const f in this.cache.format[type]) {
            const d = this.cache.format[type][f] as any;
            const tierid = f.slice(4);
            for (const species in d) {
              if (result[species]) {
                result[species][tierid] = d[species];
              } else {
                result[species] = {[tierid]: d[species]};
              }
            }
          }
          return result;
        }
      } else {
        const response = await this.fetch(`${URL}/${type}/gen${gen.num}.json`);
        data = this.cache.gen[type][gen.num] = await response.json();
      }
    }
    return data;
  }

  // Returns whether or not the provided set is a match for the forme of the species provided.
  private match(species: Specie, set: DeepPartial<PokemonSet>) {
    if (species.requiredAbility) return set.ability === species.requiredAbility;
    if (species.requiredItem) return set.item === species.requiredItem;
    if (species.requiredItems) return species.requiredItems.includes(set.item as ItemName);
    if (species.requiredMove) return set.moves!.includes(species.requiredMove);
    return true;
  }

  // Returns the name of the species in the provided gen that the data will be keyed as, optionally
  // returning a specific cosmetic forme or the key for stats as opposed to for sets/analyses.
  private name(gen: Generation, species: Specie, specific = false, stats = false) {
    if (species.name === 'Greninja-Ash') return stats ? species.name : species.baseSpecies;
    if (species.isMega || species.isPrimal || species.name.endsWith('-Crowned')) {
      return species.name;
    }

    if (species.battleOnly) {
      return Array.isArray(species.battleOnly) ? species.battleOnly[0] : species.battleOnly;
    }

    if (species.name.endsWith('-Gmax')) {
      return stats ? species.name : species.baseSpecies;
    }

    if (specific) return species.name;

    if (gen.species.get(species.baseSpecies)?.cosmeticFormes?.includes(species.name) ||
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

  // Returns a PokemonSet for the species given a Moveset, optionally named by name and for the
  // specific speciesName (eg. used to set a specific cosmetic forme).
  private toSet(species: Specie, s: Moveset, name?: string, speciesName?: string) {
    return {
      name,
      species: speciesName || species.name,
      item: Array.isArray(s.item) ? s.item[0] : s.item,
      ability: Array.isArray(s.ability) ? s.ability[0] : s.ability,
      moves: s.moves.map(ms => Array.isArray(ms) ? ms[0] : ms),
      level: Array.isArray(s.level) ? s.level[0] : s.level,
      nature: Array.isArray(s.nature) ? s.nature[0] : s.nature,
      ivs: Array.isArray(s.ivs) ? s.ivs[0] : s.ivs,
      evs: Array.isArray(s.evs) ? s.evs[0] : s.evs,
      gigantamax: species.isNonstandard === 'Gigantamax',
      teraType: Array.isArray(s.teratypes) ? s.teratypes[0] : s.teratypes,
    } as DeepPartial<PokemonSet>;
  }

  // Attempt to correct a set's IVs if the Pokémon has Hidden Power and the IVs don't match the
  // required IVs for the given gen or the expected HP DV doesn't match in RBY/GSC.
  private fixIVs(gen: Generation, set: DeepPartial<PokemonSet>) {
    const hp = set.moves!.find(m => m.startsWith('Hidden Power'));
    if (hp) {
      const type = gen.types.get(hp.slice(13));
      if (type && gen.types.getHiddenPower(gen.stats.fill({...set.ivs}, 31)).type !== type.name) {
        if (!set.ivs || (gen.num >= 7 && (!set.level || set.level === 100))) {
          set.hpType = type.name;
        } else if (gen.num === 2) {
          const ivs: Partial<StatsTable> = {};
          for (const s in type.HPdvs) {
            const stat = s as StatID;
            ivs[stat] = gen.stats.toIV(type.HPdvs[stat]!);
            set.ivs[stat] = set.ivs[stat] ?? ivs[stat];
          }
          const actual = gen.types.getHiddenPower(gen.stats.fill({...set.ivs}, 31));
          if (!(actual.type === type.name && actual.power === 70)) {
            set.ivs = ivs;
          }
        } else {
          for (const s in type.HPivs) {
            const stat = s as StatID;
            set.ivs[stat] = set.ivs[stat] ?? type.HPivs[stat];
          }
          const actual = gen.types.getHiddenPower(gen.stats.fill({...set.ivs}, 31));
          if (!(actual.type === type.name && actual.power === (gen.num < 6 ? 70 : 60))) {
            set.ivs = type.HPivs;
          }
        }
      }
    }
    if (gen.num <= 2 && set.ivs) {
      const expectedHPDV = gen.stats.getHPDV(set.ivs);
      if (expectedHPDV !== gen.stats.toDV(set.ivs.hp ?? 31)) {
        set.ivs.hp = gen.stats.toIV(gen.stats.getHPDV(set.ivs));
      }
    }
    return set;
  }
}
