import {Generation, ID, Specie} from '@pkmn/data';

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
  // FIXME Moveset fields
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

type StatName = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
type StatsTable<T = number> = { [stat in StatName]: T };

export interface PokemonSet {
  name: string;
  species: ID;
  item?: ID;
  ability?: ID;
  moves: ID[];
  nature: ID;
  gender?: 'M' | 'F' | 'N';
  evs: StatsTable;
  ivs: StatsTable;
  level?: number;
  shiny?: boolean;
  hpType?: ID;
  gigantamax?: boolean;
}

const URL = 'https://data.pkmn.cc/';

// FIXME
/*
export namespace TierTypes {
  export type Singles = "AG" | "Uber" | "(Uber)" | "OU" | "(OU)" | "UUBL" | "UU" | "RUBL" | "RU" | "NUBL" | "NU" |
  "(NU)" | "PUBL" | "PU" | "(PU)" | "NFE" | "LC Uber" | "LC";
  export type Doubles = "DUber" | "(DUber)" | "DOU" | "(DOU)" | "DBL" | "DUU" | "(DUU)" | "NFE" | "LC Uber" | "LC";
  export type Other = "Unreleased" | "Illegal" | "CAP" | "CAP NFE" | "CAP LC";
}
*/

export class Smogon {
  private readonly fetch: (url: string) => Promise<{json(): Promise<any>}>;
  private readonly cache: { // FIXME
    analyses: {[name: string]: any},
    sets: {[name: string]: any},
  };
  static readonly FALLBACK = {
    1: ['uber', 'ou', 'uu'],
    2: ['uber', 'ou', 'uu', 'nu'],
    3: ['uber', 'ou', 'uu', 'nu'],
    4: ['ag', 'uber', 'ou', 'uu', 'nu'],
    5: ['uber', 'ou', 'uu', 'ru', 'nu'],
    6: ['ag', 'uber', 'ou', 'uu', 'ru', 'nu', 'pu'],
    7: ['ag', 'uber', 'ou', 'uu', 'ru', 'nu', 'pu', 'zu'],
    8: ['ag', 'uber', 'ou', 'uu', 'ru', 'nu', 'pu', 'zu'],
  } as const;

  constructor(fetch: (url: string) => Promise<{json(): Promise<any>}>) {
    this.fetch = fetch;
    this.cache = {analyses: {}, sets: {}};
  }

  // TODO all need to handle battle forme => base (but only where has write moves/abilities etc)
  analysis(gen: Generation, species: string | Specie) {
    if (typeof species === 'string') species = gen.species.get(species)!;

    // TODO also cache sets and stitch together!!
  }

  sets(gen: Generation, species: string | Specie, format?: ID) {
    if (typeof species === 'string') species = gen.species.get(species)!;

    // TODO findSets logic from dmg -
    return [] as PokemonSet[];
  }
}

