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
  Tier,
} from '@pkmn/data';
import {Credits, UsageStatistics, Statistics} from 'smogon';

// The structure of https://data.pkmn.cc/analyses/genN.json
type GenAnalyses = {
  [species: string]: {
    [tierid: string]: RawAnalysis
  }
};

// The structure of https://data.pkmn.cc/analyses/genNtier.json
type FormatAnalyses = {
  [species: string]: RawAnalysis
};

// The structure of https://data.pkmn.cc/sets/genN.json
type GenSets = {
  [species: string]: {
    [tierid: string]: {
      [name: string]: Moveset
    }
  }
};

// The structure of https://data.pkmn.cc/sets/genNtier.json
type FormatSets = {
  [species: string]: {
      [name: string]: Moveset
  }
};

// The raw analysis data from https://data.pkmn.cc/ - this needs to be joined with the sets data
// to form an Analysis which matches what is on Smogon.
interface RawAnalysis {
  overview?: string;
  comments?: string;
  sets: Array<{
    name: string,
    desc?: string
  }>;
  credits?: Credits;
}

// The reconstituted analysis made from joining a RawAnalysis with the referenced Moveset objects.
export interface Analysis extends Omit<RawAnalysis, 'sets'> {
  format: ID;
  sets: Array<Moveset & {name: string, desc?: string}>;
}

// A compressed version of the default smogon Moveset which is smaller to serialize.
export interface Moveset {
  level?: number | number[];
  ability: AbilityName | AbilityName[];
  item?: ItemName | ItemName[];
  nature?: NatureName | NatureName[];
  ivs?: Partial<StatsTable> | Partial<StatsTable>[];
  evs?: Partial<StatsTable> | Partial<StatsTable>[];
  moves: Array<MoveName | MoveName[]>;
}

// A fairly sloppy definition of DeepPartial, but good enough for our use case.
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[P] extends ReadonlyArray<infer V>
      ? ReadonlyArray<DeepPartial<V>>
      : DeepPartial<T[P]>
};

const URL = 'https://data.pkmn.cc/';

const PREFIXES = ['Pichu', 'Basculin', 'Keldeo', 'Genesect', 'Vivillon', 'Magearna'];
const SUFFIXES = ['-Antique', '-Totem'];

// Conversion between a Pokémon's Tier and a format suffix.
const FORMATS: {[key in Tier.Singles | Tier.Other]: string} = {
  AG: 'anythinggoes',
  Uber: 'ubers', '(Uber)': 'ubers',
  OU: 'ou', '(OU)': 'ou', 'UUBL': 'ou',
  UU: 'uu', 'RUBL': 'uu',
  RU: 'ru', 'NUBL': 'ru',
  NU: 'nu', '(NU)': 'nu', 'PUBL': 'nu',
  PU: 'pu', '(PU)': 'pu', 'NFE': 'pu',
  LC: 'lc',
  Unreleased: 'anythinggoes',
  Illegal: 'anythinggoes',
  CAP: 'cap', 'CAP NFE': 'cap', 'CAP LC': 'cap',
};

/** Utility class for working with data from Smogon, requires a fetch function to request data. */
export class Smogon {
  private readonly fetch: (url: string) => Promise<{json(): Promise<any>}>;
  private readonly cache: {
    gen: {
      analyses: {[gen: number]: GenAnalyses},
      sets: {[gen: number]: GenSets},
    },
    format: {
      analyses: {[formatid: string]: FormatAnalyses},
      sets: {[formatid: string]: FormatSets},
      stats: {[formatid: string]: UsageStatistics['data']},
    }
  };
  private readonly minimal: boolean; // TODO

  constructor(fetch: (url: string) => Promise<{json(): Promise<any>}>, minimal = false) {
    this.fetch = fetch;
    this.cache = {gen: {analyses: {}, sets: {}}, format: {analyses: {}, sets: {}, stats: {}}};
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
    const data = {
      analyses: (await this.get('analyses', gen) as GenAnalyses)[name],
      sets: (await this.get('sets', gen) as GenSets)[name],
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
        format: f,
        overview: a.overview,
        comments: a.comments,
        credits: a.credits,
        sets: [],
      };

      for (const stub of a.sets) {
        const set = s[stub.name];
        if (set && this.match(species, this.toSet(species, set))) {
          analysis.sets.push({
            name: stub.name,
            desc: stub.desc,
            ...set
          } as Moveset & {name: string, desc?: string});
        }
      }

      if (analysis.sets.length) result.push(analysis);
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
    const data = (await this.get('sets', gen) as GenSets)[name];
    if (!data) return [];

    const hackmons =
      (format?.endsWith('balancedhackmons') &&
      species.name !== 'Groundon-Primal' &&
      !(gen.num === 7 && species.name === 'Kyogre-Primal'));

    const speciesName = hackmons ? species.name : this.name(gen, species, true);

    const sets = [];
    for (const tierid in data) {
      if (format && `gen${gen.num}${tierid}` !== format) continue;
      for (const name in data[tierid]) {
        const set = this.toSet(species, data[tierid][name], name, speciesName);
        if (this.match(species, set)) sets.push(this.fixHP(gen, set));
      }
    }

    return sets;
  }

  /**
   * Returns moveset usage statistics information for the given Pokémon species and gen for the
   * species' default format or the optional format provided.
   */
  async stats(gen: Generation, species: string | Specie, format?: ID) {
    if (typeof species === 'string') {
      const s = gen.species.get(species);
      if (!s) return undefined;
      species = s;
    }

    format = format || `gen${gen.num}${FORMATS[species.tier]}` as ID;

    let stats = this.cache.format.stats[format];
    if (!stats) {
      const latest = await Statistics.latestDate(format, true);
      if (!latest) return undefined;
      const response = await this.fetch(Statistics.url(latest.date, format));
      stats = this.cache.format.stats[format] = (await response.json()).data;
    }

    return stats[this.name(gen, species, false, true)];
  }

  // Fetch analysis or set data for a specific gen and cache the result.
  private async get(type: 'sets' | 'analyses', gen: Generation) {
    let data = this.cache.gen[type][gen.num];
    if (!data) {
      const response = await this.fetch(`${URL}/${type}/gen${gen.num}.json`);
      data = this.cache.gen[type][gen.num] = await response.json();
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
    } as DeepPartial<PokemonSet>;
  }

  // Clobber a set's IVs if the Pokémon has Hidden Power and the IVs don't match the required IVs
  // for the given gen.
  private fixHP(gen: Generation, set: DeepPartial<PokemonSet>) {
    const hp = set.moves!.find(m => m.startsWith('Hidden Power'));
    if (hp) {
      const type = gen.types.get(hp.slice(13));
      if (type && gen.types.getHiddenPower(gen.stats.fill({...set.ivs}, 31)).type !== type.name) {
        if (!set.ivs || (gen.num >= 7 && (!set.level || set.level === 100))) {
          set.hpType = type.name;
        } else if (gen.num === 2) {
          const ivs: Partial<StatsTable> = {};
          for (const stat in type.HPdvs) {
            ivs[stat as StatID] = gen.stats.toIV(type.HPdvs[stat as StatID]!);
          }
          ivs.hp = gen.stats.toIV(gen.stats.getHPDV(set.ivs));
          set.ivs = ivs;
        } else {
          set.ivs = type.HPivs;
        }
      }
    }
    return set;
  }
}