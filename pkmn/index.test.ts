import {promises as fs} from 'fs';
import * as path from 'path';

import {GenerationNum, Generations, PokemonSet, Specie} from '@pkmn/data';
import {Dex} from '@pkmn/dex';

import {Smogon, DeepPartial} from './index';

const gens = new Generations(Dex, d => !!d.exists);
const gen = (num: GenerationNum) => gens.get(num);

const URL = 'https://data.pkmn.cc/';
const fetch = async (url: string) => {
  if (!url.startsWith(URL)) throw new Error(`Invalid url: '${url}'`);
  const name = path.resolve(__dirname, '../../data', url.slice(URL.length));
  return JSON.parse(await fs.readFile(name, 'utf8'));
};

// FIXME TODO test against modified @smogon/sets (remove validation?)
describe('Smogon', () => {
  test.todo('analyses');
  test.todo('sets');
  test.todo('stats');

  test('match', () => {
    const match = (species: Specie, set: DeepPartial<PokemonSet>) =>
      (new Smogon(fetch) as any).match(species, set) as boolean;

    const greninja = gen(7).species.get('Greninja-Ash')!;
    expect(match(greninja, {ability: undefined})).toBe(false);
    expect(match(greninja, {ability: 'Battle Bond'})).toBe(true);
    expect(match(greninja, {ability: 'Protean'})).toBe(false);

    const venusaur = gen(7).species.get('Venusaur-Mega')!;
    expect(match(venusaur, {item: undefined})).toBe(false);
    expect(match(venusaur, {item: 'Venusaurite'})).toBe(true);
    expect(match(venusaur, {item: 'Leftovers'})).toBe(false);

    const arceus = gen(7).species.get('Arceus-Electric')!;
    expect(match(arceus, {item: undefined})).toBe(false);
    expect(match(arceus, {item: 'Electrium Z'})).toBe(true);
    expect(match(arceus, {item: 'Zap Plate'})).toBe(true);
    expect(match(arceus, {item: 'Meadow Plate'})).toBe(false);

    const meloetta = gen(7).species.get('Meloetta-Pirouette')!;
    expect(match(meloetta, {moves: ['Return']})).toBe(false);
    expect(match(meloetta, {moves: ['Return', 'Relic Song']})).toBe(true);
  });

  test('name', () => {
    const name = (n: GenerationNum, s: string, specific = false, stats = false) => {
      const g = gen(n);
      return (new Smogon(fetch) as any).name(g, g.species.get(s)!, specific, stats) as string;
    };
    const names = (n: GenerationNum, s: string) => [name(n, s), name(n, s, false, true)];

    expect(names(6, 'Venusaur-Mega')).toEqual(['Venusaur', 'Venusaur-Mega']);
    expect(names(6, 'Kyogre-Primal')).toEqual(['Kyogre', 'Kyogre-Primal']);
    expect(names(7, 'Greninja-Ash')).toEqual(['Greninja', 'Greninja-Ash']);
    expect(names(7, 'Mimikyu-Busted')).toEqual(['Mimikyu', 'Mimikyu']);
    expect(names(8, 'Butterfree-Gmax')).toEqual(['Butterfree', 'Butterfree-Gmax']);
    expect(names(8, 'Sinistea-Antique')).toEqual(['Sinistea', 'Sinistea']);
    expect(names(7, 'Gumshoos-Totem')).toEqual(['Gumshoos', 'Gumshoos-Totem']);
    expect(names(7, 'Pikachu-Libre')).toEqual(['Pikachu', 'Pikachu']);
    expect(names(7, 'Pikachu-Starter')).toEqual(['Pikachu-Starter', 'Pikachu-Starter']);

    expect(name(4, 'Gastrodon-East')).toEqual('Gastrodon');
    expect(name(4, 'Gastrodon-East', true)).toEqual('Gastrodon-East');
    expect(name(5, 'Keldeo-Resolute')).toEqual('Keldeo');
    expect(name(5, 'Keldeo-Resolute', true)).toEqual('Keldeo-Resolute');
  });

  test.todo('toSet');
  test.todo('fixHP');
});