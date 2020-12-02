import {promises as fs} from 'fs';
import * as path from 'path';

import {
  Generation,
  GenerationNum,
  Generations,
  ID,
  PokemonSet,
  Specie,
  SpeciesName,
  Tier,
} from '@pkmn/data';
import {Dex} from '@pkmn/dex';

import {Smogon, DeepPartial} from './index';

const gens = new Generations(Dex);
const gen = (num: GenerationNum) => gens.get(num);

const URL = 'https://data.pkmn.cc/';
const fetch = async (url: string) => {
  if (!url.startsWith(URL)) throw new Error(`Invalid url: '${url}'`);
  const name = path.resolve(__dirname, '../../data', url.slice(URL.length));
  return JSON.parse(await fs.readFile(name, 'utf8'));
};

// FIXME TODO test against modified @smogon/sets (remove validation?)
describe('Smogon', () => {
  test('analysis', async () => {
    const smogon = new Smogon(fetch);

    let analysis = (await smogon.analysis(gen(4), 'Gengar'))!;
    expect(analysis.format).toEqual('gen4ou');
    expect(analysis.overview.startsWith('Gengar\'s combination of power and')).toBe(true);
    expect(Object.keys(analysis.comments)).toEqual(['Other Options', 'Checks and Counters']);
    expect(analysis.comments['Other Options'].startsWith('Sludge Bomb was left out')).toBe(true);
    expect(analysis.credits.writtenBy.map(m => m.username))
      .toEqual(['Emeral', 'whistle', 'Philip7086', 'ShinyAzelf']);
    expect(analysis.sets.map(s => s.name))
      .toEqual(['Substitute + Pain Split', 'Taunt + Will-O-Wisp', 'Life Orb', 'Choice Scarf']);
    expect(analysis.sets[3].moves[4]).toEqual(['Hidden Power Fire', 'Explosion']);
  });

  test.todo('sets');
  test.todo('stats');

  test('fallbacks', () => {
    const smogon = new Smogon(fetch);
    expect(smogon.fallbacks(gen(1))).toEqual(['gen1ubers', 'gen1ou', 'gen1uu']);
    expect(smogon.fallbacks(gen(1), 2, 0)).toEqual(['gen1uu', 'gen1ou', 'gen1ubers']);
    expect(smogon.fallbacks(gen(2), 1)).toEqual(['gen2ou', 'gen2uu', 'gen2nu']);
    const formats = ['foo'] as ID[];
    expect(smogon.fallbacks(gen(7), 2, 3, formats)).toEqual(['foo', 'gen7uu', 'gen7ru']);
    expect(formats).toEqual(['foo', 'gen7uu', 'gen7ru']);
    expect(smogon.fallbacks(gen(8))).toEqual([
      'gen8ubers', 'gen8ou', 'gen8uu', 'gen8ru', 'gen8nu', 'gen8pu', 'gen8zu',
    ]);
  });

  test('match', () => {
    const match = (species: Specie, set: DeepPartial<PokemonSet>) =>
      (new Smogon(fetch) as any).match(species, set) as boolean;

    const greninja = gen(7).species.get('Greninja-Ash')!;
    expect(match(greninja, {ability: undefined})).toBe(false);
    expect(match(greninja, {ability: 'Battle Bond'})).toBe(true);
    expect(match(greninja, {ability: 'Protean'})).toBe(true);

    const venusaur = gen(7).species.get('Venusaur-Mega')!;
    expect(match(venusaur, {item: undefined})).toBe(false);
    expect(match(venusaur, {item: 'Venusaurite'})).toBe(true);
    expect(match(venusaur, {item: 'Leftovers'})).toBe(false);

    const arceus = gen(7).species.get('Arceus-Electric')!;
    expect(match(arceus, {item: undefined})).toBe(false);
    expect(match(arceus, {item: 'Electrium Z'})).toBe(false);
    expect(match(arceus, {item: 'Zap Plate'})).toBe(false);
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
    expect(names(6, 'Greninja-Ash')).toEqual(['Greninja', 'Greninja-Ash']);
    expect(names(7, 'Mimikyu-Busted')).toEqual(['Mimikyu', 'Mimikyu']);
    expect(names(8, 'Butterfree-Gmax')).toEqual(['Butterfree', 'Butterfree-Gmax']);
    expect(names(8, 'Sinistea-Antique')).toEqual(['Sinistea', 'Sinistea']);
    expect(names(7, 'Gourgeist-Large')).toEqual(['Gourgeist', 'Gourgeist-Large']);
    expect(names(7, 'Pikachu-Libre')).toEqual(['Pikachu', 'Pikachu']);
    expect(names(7, 'Pikachu-Starter')).toEqual(['Pikachu-Starter', 'Pikachu-Starter']);

    expect(name(4, 'Gastrodon-East')).toEqual('Gastrodon');
    expect(name(4, 'Gastrodon-East', true)).toEqual('Gastrodon-East');
    expect(name(4, 'Keldeo-Resolute')).toEqual('Keldeo');
    expect(name(4, 'Keldeo-Resolute', true)).toEqual('Keldeo-Resolute');
  });

  test('formats', () => {
    const formats = (gen: Generation, tier: Tier.Singles | Tier.Other, format?: string) =>
      (new Smogon(fetch) as any).formats(gen, tier, format) as ID[] | undefined;

    expect(formats(gen(1), 'NFE')).toEqual(['gen1uu', 'gen1ou', 'gen1ubers']);
    expect(formats(gen(1), 'UU')).toEqual(['gen1uu', 'gen1ou', 'gen1ubers']);
    expect(formats(gen(1), 'OU')).toEqual(['gen1ou', 'gen1uu', 'gen1ubers']);
    expect(formats(gen(1), 'Uber')).toEqual(['gen1ubers', 'gen1ou', 'gen1uu']);
    expect(formats(gen(1), 'Illegal')).toBeUndefined();
  });
});