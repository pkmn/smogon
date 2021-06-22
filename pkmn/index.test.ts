import {promises as fs} from 'fs';
import * as path from 'path';

import {
  AbilityName,
  Generation,
  GenerationNum,
  Generations,
  ID,
  ItemName,
  MoveName,
  PokemonSet,
  Specie,
} from '@pkmn/data';
import {Dex} from '@pkmn/dex';

import {Analysis, Smogon, DeepPartial, Moveset} from './index';

const gens = new Generations(Dex, d => !!d.exists);
const gen = (num: GenerationNum) => gens.get(num);

const URL = 'https://data.pkmn.cc/';
const fetch = async (url: string) => {
  if (url.startsWith('https://www.smogon.com/stats/') && url.endsWith('nu-1630.json')) {
    const name = path.resolve(__dirname, '../smogon/fixtures/gen6nu.json');
    const json = JSON.parse(await fs.readFile(name, 'utf8'));
    return {json: () => Promise.resolve(json)};
  }
  if (!url.startsWith(URL)) throw new Error(`Invalid url: '${url}'`);
  const name = path.resolve(__dirname, '../data', url.slice(URL.length + 1));
  const json = JSON.parse(await fs.readFile(name, 'utf8'));
  return {json: () => Promise.resolve(json)};
};

describe('Smogon', () => {
  test('analyses', async () => {
    const sets = (as: Analysis[]) => as.map(a => a.sets.map(s => s.name));
    const fail = [false];
    const smogon = new Smogon(url => {
      if (fail[0]) throw new Error('404');
      return fetch(url);
    });

    fail[0] = true;
    await expect(smogon.analyses(gen(2), 'Blastoise', 'gen2uu' as ID)).rejects.toThrow();
    fail[0] = false;

    expect(await smogon.analyses(gen(1), 'Fakemon')).toEqual([]);
    expect(await smogon.analyses(gen(2), 'Snorlax', 'gen2faketier' as ID)).toEqual([]);

    fail[0] = true;
    // NB: gen2 has already been cached
    expect(sets(await smogon.analyses(gen(2), 'Blastoise', 'gen2uu' as ID)))
      .toEqual([['Spinstoise (Rapid Spin)']]);
    fail[0] = false;

    expect(sets(await smogon.analyses(gen(2), 'Blastoise')))
      .toEqual([['Spinstoise (Rapid Spin)'], ['Bulky Water', 'RestTalk']]);
    expect(sets(await smogon.analyses(gen(8), 'Darmanitan-Galar-Zen', 'gen8ubers' as ID)))
      .toEqual([['Belly Drum']]);
    expect((await smogon.analyses(gen(3), 'Gengar', 'gen3ou' as ID))[0].overview)
      .toMatch('Gengar is a centralizing threat in ADV OU');
    let clefable = await smogon.analyses(gen(4), 'Clefable');
    expect(clefable[0].format).toBe('gen4uu');
    expect(clefable[0].sets[0].moves[0]).toEqual(['Ice Beam', 'Encore']);

    let nidoking = await smogon.analyses(gen(5), 'Nidoking', 'gen5ou' as ID);
    expect(nidoking).toHaveLength(1);
    fail[0] = true;
    expect(await smogon.analyses(gen(5), 'Nidoking')).toHaveLength(3);
    fail[0] = false;

    const minimal = new Smogon(url => {
      if (fail[0]) throw new Error('404');
      return fetch(url);
    }, true);

    fail[0] = true;
    await expect(minimal.analyses(gen(2), 'Blastoise', 'gen2uu' as ID)).rejects.toThrow();
    fail[0] = false;

    expect(await minimal.analyses(gen(1), 'Fakemon')).toEqual([]);
    await expect(minimal.analyses(gen(2), 'Snorlax', 'gen2faketier' as ID)).rejects.toThrow();

    fail[0] = true;
    // NB: should still fail because the entire gen2 chunk should not have been fetched
    await expect(minimal.analyses(gen(2), 'Blastoise', 'gen2uu' as ID)).rejects.toThrow();
    fail[0] = false;

    expect(sets(await minimal.analyses(gen(2), 'Blastoise', 'gen2uu' as ID)))
      .toEqual([['Spinstoise (Rapid Spin)']]);
    expect(sets(await minimal.analyses(gen(2), 'Blastoise')))
      .toEqual([['Spinstoise (Rapid Spin)'], ['Bulky Water', 'RestTalk']]);
    expect(sets(await minimal.analyses(gen(8), 'Darmanitan-Galar-Zen', 'gen8ubers' as ID)))
      .toEqual([['Belly Drum']]);
    expect((await minimal.analyses(gen(3), 'Gengar', 'gen3ou' as ID))[0].overview)
      .toMatch('Gengar is a centralizing threat in ADV OU');
    clefable = await minimal.analyses(gen(4), 'Clefable');
    expect(clefable[0].format).toBe('gen4uu');
    expect(clefable[0].sets[0].moves[0]).toEqual(['Ice Beam', 'Encore']);

    nidoking = await minimal.analyses(gen(5), 'Nidoking', 'gen5ou' as ID);
    expect(nidoking).toHaveLength(1);
    fail[0] = true;
    expect(await minimal.analyses(gen(5), 'Nidoking')).toEqual(nidoking);
    fail[0] = false;
    expect(await minimal.analyses(gen(5), 'Nidoking')).toHaveLength(3);
  });

  test('sets', async () => {
    const names = (ps: DeepPartial<PokemonSet>[]) => ps.map(p => p.name);
    const fail = [false];
    const smogon = new Smogon(url => {
      if (fail[0]) throw new Error('404');
      return fetch(url);
    });

    fail[0] = true;
    await expect(smogon.sets(gen(2), 'Blastoise', 'gen2uu' as ID)).rejects.toThrow();
    fail[0] = false;

    expect(await smogon.sets(gen(1), 'Fakemon')).toEqual([]);
    expect(await smogon.sets(gen(2), 'Snorlax', 'gen2faketier' as ID)).toEqual([]);

    fail[0] = true;
    // NB: gen2 has already been cached
    expect(names(await smogon.sets(gen(2), 'Blastoise', 'gen2uu' as ID)))
      .toEqual(['Spinstoise (Rapid Spin)']);
    fail[0] = false;

    expect(names(await smogon.sets(gen(2), 'Blastoise')))
      .toEqual(['Spinstoise (Rapid Spin)', 'Bulky Water', 'RestTalk']);
    expect(names(await smogon.sets(gen(8), 'Darmanitan-Galar-Zen', 'gen8ubers' as ID)))
      .toEqual(['Belly Drum']);
    expect((await smogon.sets(gen(4), 'Gastrodon-East'))[0].species).toEqual('Gastrodon-East');
    expect((await smogon.sets(gen(4), 'Moltres'))[0].ivs).toEqual({atk: 2, spa: 30});
    expect((await smogon.sets(gen(7), 'Kyogre-Primal', 'gen7balancedhackmons' as ID))[0].species)
      .toEqual('Kyogre-Primal');

    let nidoking = await smogon.sets(gen(5), 'Nidoking', 'gen5ou' as ID);
    expect(nidoking).toHaveLength(2);
    fail[0] = true;
    expect(await smogon.sets(gen(5), 'Nidoking')).toHaveLength(5);
    fail[0] = false;

    const minimal = new Smogon(url => {
      if (fail[0]) throw new Error('404');
      return fetch(url);
    }, true);

    fail[0] = true;
    await expect(minimal.sets(gen(2), 'Blastoise', 'gen2uu' as ID)).rejects.toThrow();
    fail[0] = false;

    expect(await minimal.sets(gen(1), 'Fakemon')).toEqual([]);
    await expect(minimal.sets(gen(2), 'Snorlax', 'gen2faketier' as ID)).rejects.toThrow();

    fail[0] = true;
    // NB: should still fail because the entire gen2 chunk should not have been fetched
    await expect(minimal.sets(gen(2), 'Blastoise', 'gen2uu' as ID)).rejects.toThrow();
    fail[0] = false;

    expect(names(await minimal.sets(gen(2), 'Blastoise', 'gen2uu' as ID)))
      .toEqual(['Spinstoise (Rapid Spin)']);
    expect(names(await minimal.sets(gen(2), 'Blastoise')))
      .toEqual(['Spinstoise (Rapid Spin)', 'Bulky Water', 'RestTalk']);
    expect(names(await minimal.sets(gen(8), 'Darmanitan-Galar-Zen', 'gen8ubers' as ID)))
      .toEqual(['Belly Drum']);
    expect((await minimal.sets(gen(4), 'Gastrodon-East'))[0].species).toEqual('Gastrodon-East');
    expect((await minimal.sets(gen(4), 'Moltres'))[0].ivs).toEqual({atk: 2, spa: 30});
    expect((await minimal.sets(gen(7), 'Kyogre-Primal', 'gen7balancedhackmons' as ID))[0].species)
      .toEqual('Kyogre-Primal');

    nidoking = await minimal.sets(gen(5), 'Nidoking', 'gen5ou' as ID);
    expect(nidoking).toHaveLength(2);
    fail[0] = true;
    expect(await minimal.sets(gen(5), 'Nidoking')).toEqual(nidoking);
    fail[0] = false;
    expect(await minimal.sets(gen(5), 'Nidoking')).toHaveLength(5);
  });

  test('stats', async () => {
    const smogon = new Smogon(fetch);
    expect(await smogon.stats(gen(1), 'Fakemon')).toBeUndefined();
    expect(await smogon.stats(gen(2), 'Snorlax', 'gen2faketier' as ID)).toBeUndefined();

    expect((await smogon.stats(gen(6), 'Magmortar'))!.Moves.thunderbolt).toEqual(1);
    expect((await smogon.stats(gen(6), 'Pikachu', 'gen6nu' as ID))!.Teammates.Bidoof).toEqual(0.75);
  });

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

  test('toSet', () => {
    const toSet = (gn: GenerationNum, s: string, ms: Moveset, n?: string, sn?: string) => {
      const g = gen(gn);
      return (new Smogon(fetch) as any).toSet(
        g.species.get(s)!, ms, n, sn
      ) as DeepPartial<PokemonSet>;
    };

    expect(toSet(7, 'Alakazam', {
      moves: [
        'Psychic', 'Focus Blast', 'Shadow Ball', ['Hidden Power Fire', 'Hidden Power Ice'],
      ] as Array<MoveName | MoveName[]>,
      ability: 'Magic Guard' as AbilityName,
      item: 'Life Orb' as ItemName,
      nature: 'Timid',
      evs: {spa: 252, spd: 4, spe: 252},
    }, 'Name')).toEqual({
      name: 'Name',
      species: 'Alakazam',
      item: 'Life Orb',
      ability: 'Magic Guard',
      moves: ['Psychic', 'Focus Blast', 'Shadow Ball', 'Hidden Power Fire'],
      level: undefined,
      nature: 'Timid',
      evs: {spa: 252, spd: 4, spe: 252},
      ivs: undefined,
      gigantamax: false,
    });
    expect(toSet(8, 'Venusaur-Gmax', {
      moves: [
        'Growth', 'Giga Drain', 'Weather Ball', ['Sludge Bomb', 'Solar Beam'],
      ] as Array<MoveName | MoveName[]>,
      level: [50, 55],
      ability: ['Overgrow', 'Chlorophyll'] as AbilityName[],
      item: ['Choice Specs', 'Leftovers'] as ItemName[],
      nature: ['Modest', 'Bold'],
      evs: [{spa: 252, spd: 4, spe: 252}, {hp: 4, def: 252, spd: 252}],
      ivs: [{atk: 0}, {spd: 0}],
    }, undefined, 'Venusaur-Gmax')).toEqual({
      species: 'Venusaur-Gmax',
      item: 'Choice Specs',
      ability: 'Overgrow',
      moves: ['Growth', 'Giga Drain', 'Weather Ball', 'Sludge Bomb'],
      level: 50,
      nature: 'Modest',
      evs: {'spa': 252, 'spd': 4, 'spe': 252},
      ivs: {atk: 0},
      gigantamax: true,
    });
  });

  test('fixIVs', () => {
    const fixIVs = (g: Generation, s: DeepPartial<PokemonSet>) =>
      (new Smogon(fetch) as any).fixIVs(g, s) as DeepPartial<PokemonSet>;

    expect(fixIVs(gen(6), {moves: ['Tackle'], ivs: {atk: 4, def: 3}}).ivs)
      .toEqual({atk: 4, def: 3});
    expect(fixIVs(gen(6), {moves: ['Hidden Power Ice'], ivs: {atk: 4, def: 3}}).ivs)
      .toEqual({atk: 30, def: 30});
    expect(fixIVs(gen(7), {moves: ['Hidden Power Fire'], ivs: {atk: 4, def: 3}}).ivs)
      .toEqual({atk: 4, def: 3});
    expect(fixIVs(gen(7), {moves: ['Hidden Power Fire'], ivs: {atk: 4, def: 3}}).hpType)
      .toEqual('Fire');
    expect(fixIVs(gen(7), {moves: ['Hidden Power Steel'], level: 99, ivs: {atk: 4, def: 3}}).ivs)
      .toEqual({spd: 30});
    expect(fixIVs(gen(2), {moves: ['Hidden Power Rock'], ivs: {atk: 4, def: 3}}).ivs)
      .toEqual({hp: 23, atk: 27, def: 25});
    expect(fixIVs(gen(4), {moves: ['Hidden Power Grass'], ivs: {atk: 2}}).ivs)
      .toEqual({atk: 2, spa: 30});
  });
});
