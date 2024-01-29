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
} from '@pkmn/data';
import {Dex} from '@pkmn/dex';

import {Analysis, DeepPartial, Moveset, Smogon} from './index';

const gens = new Generations(Dex, d => !!d.exists);
const gen = (num: GenerationNum) => gens.get(num);

const URL = 'https://data.pkmn.cc/';
const fetch = async (url: string) => {
  if (!url.startsWith(URL)) throw new Error(`Invalid url: '${url}'`);
  const name = path.resolve(__dirname, '../data', url.slice(URL.length + 1));
  const json = JSON.parse(await fs.readFile(name, 'utf8'));
  return {json: () => Promise.resolve(json)};
};

describe('Smogon', () => {
  for (const minimal of [false, true]) {
    test(`analyses (minimal=${minimal.toString()})`, async () => {
      const sets = (as: Analysis[]) => as.map(a => Object.keys(a.sets));
      const smogon = new Smogon(fetch, minimal);

      expect(await smogon.analyses(gen(1), 'Fakemon')).toEqual([]);
      if (minimal) {
        await expect(smogon.analyses(gen(2), 'Snorlax', 'gen2faketier' as ID)).rejects.toThrow();
      } else {
        expect(await smogon.analyses(gen(2), 'Snorlax', 'gen2faketier' as ID)).toEqual([]);
      }

      expect(sets(await smogon.analyses(gen(2), 'Blastoise')))
        .toEqual(minimal
          ? [] : [['Spinstoise (Rapid Spin)'], ['Bulky Water', 'RestTalk'], ['Special Attacker']]);
      expect(sets(await smogon.analyses(gen(2), 'Blastoise', 'gen2uu' as ID)))
        .toEqual([['Spinstoise (Rapid Spin)']]);
      expect(sets(await smogon.analyses(gen(2), 'Blastoise')))
        .toEqual(minimal
          ? [['Spinstoise (Rapid Spin)']]
          : [['Spinstoise (Rapid Spin)'], ['Bulky Water', 'RestTalk'], ['Special Attacker']]);
      expect(sets(await smogon.analyses(gen(2), 'Blastoise', 'gen2ou' as ID)))
        .toEqual([['Bulky Water', 'RestTalk']]);
      expect(sets(await smogon.analyses(gen(2), 'Blastoise')))
        .toEqual(minimal
          ? [['Spinstoise (Rapid Spin)'], ['Bulky Water', 'RestTalk']]
          : [['Spinstoise (Rapid Spin)'], ['Bulky Water', 'RestTalk'], ['Special Attacker']]);

      expect(sets(await smogon.analyses(gen(8), 'Darmanitan-Galar-Zen', 'gen81v1' as ID)))
        .toEqual([['Zen Mode']]);
      const gengar = await smogon.analyses(gen(3), 'Gengar', 'gen3ou' as ID);
      expect(gengar[0].overview)
        .toMatch('Gengar is a centralizing threat in ADV OU');
      expect(gengar[0].sets['Defensive'].description)
        .toMatch('Defensive Gengar is most commonly used on teams that');
      const clefable = await smogon.analyses(gen(4), 'Clefable', 'gen4uu' as ID);
      expect(clefable[0].format).toBe('gen4uu');
      expect(clefable[0].sets['Support'].moves[0]).toEqual(['Ice Beam', 'Encore']);
      expect((await smogon.analyses(gen(8), 'Incineroar', 'gen8vgc2021series10' as ID))[0].format)
        .toBe('gen8vgc2021series10');
    });

    test(`sets (minimal=${minimal.toString()})`, async () => {
      const names = (ps: DeepPartial<PokemonSet>[]) => ps.map(p => p.name);
      const smogon = new Smogon(fetch, minimal);

      expect(await smogon.sets(gen(1), 'Fakemon')).toEqual([]);
      if (minimal) {
        await expect(smogon.sets(gen(2), 'Snorlax', 'gen2faketier' as ID)).rejects.toThrow();
      } else {
        expect(await smogon.sets(gen(2), 'Snorlax', 'gen2faketier' as ID)).toEqual([]);
      }

      expect(names(await smogon.sets(gen(2), 'Blastoise')))
        .toEqual(minimal
          ? [] : ['Spinstoise (Rapid Spin)', 'Bulky Water', 'RestTalk', 'Special Attacker']);
      expect(names(await smogon.sets(gen(2), 'Blastoise', 'gen2uu' as ID)))
        .toEqual(['Spinstoise (Rapid Spin)']);
      expect(names(await smogon.sets(gen(2), 'Blastoise')))
        .toEqual(minimal
          ? ['Spinstoise (Rapid Spin)']
          : ['Spinstoise (Rapid Spin)', 'Bulky Water', 'RestTalk', 'Special Attacker']);
      expect(names(await smogon.sets(gen(2), 'Blastoise', 'gen2ou' as ID)))
        .toEqual(['Bulky Water', 'RestTalk']);
      expect(names(await smogon.sets(gen(2), 'Blastoise')))
        .toEqual(minimal
          ? ['Spinstoise (Rapid Spin)', 'Bulky Water', 'RestTalk']
          : ['Spinstoise (Rapid Spin)', 'Bulky Water', 'RestTalk', 'Special Attacker']);

      expect(names(await smogon.sets(gen(8), 'Darmanitan-Galar-Zen', 'gen81v1' as ID)))
        .toEqual(['Zen Mode']);
      expect((await smogon.sets(gen(4), 'Gastrodon-East', 'gen4ou' as ID))[0].species)
        .toBe('Gastrodon-East');
      expect((await smogon.sets(gen(4), 'Moltres', 'gen4uu' as ID))[0].ivs)
        .toEqual({atk: 2, spa: 30});
      expect((await smogon.sets(gen(7), 'Kyogre-Primal', 'gen7balancedhackmons' as ID))[0].species)
        .toBe('Kyogre-Primal');

      expect((await smogon.sets(gen(8), 'Incineroar', 'gen8vgc2021fooseries' as ID))[0].name)
        .toBe('Utility');
    });
  }

  test('stats', async () => {
    const smogon = new Smogon(fetch);
    expect(await smogon.stats(gen(1), 'Fakemon')).toBeUndefined();
    await expect(smogon.stats(gen(2), 'Snorlax', 'gen2faketier' as ID)).rejects.toThrow();
    expect((await smogon.stats(gen(6), 'Hitmonchan', 'gen6nu' as ID))!.moves['Drain Punch'])
      .toBe(0.9421);
    expect((await smogon.stats(gen(7), 'Steelix', 'gen7nu' as ID))!.teammates['Passimian'])
      .toBe(0.1307);
    expect((await smogon.stats(gen(7), 'Incineroar', 'gen7vgc2019moonseries' as ID))!
      .items['Assault Vest']).toBe(0.3012);
    expect((await smogon.stats(gen(8), 'zaciancrowned', 'gen8vgc2022' as ID))).toBeDefined();
  });

  test('teams', async () => {
    const smogon = new Smogon(fetch);
    await expect(smogon.teams('gen8faketier' as ID)).rejects.toThrow();
    expect((await smogon.teams('gen2ou' as ID))
      .some(team => team.data.some(set => set.species === 'Snorlax'))).toBe(true);
  });

  test('format', () => {
    expect(Smogon.format(gen(2), 'Snorlax')).toBe('gen2ou');
    expect(Smogon.format(gen(3), 'Dragonair')).toBe('gen3pu');
    expect(Smogon.format(gen(6), 'Vanilluxe')).toBe('gen6zu');
  });

  test('name', () => {
    const name = (n: Generation | GenerationNum, s: string, specific = false, stats = false) => {
      const g = typeof n === 'number' ? gen(n) : n;
      return (new Smogon(fetch) as any).name(g, g.species.get(s)!, specific, stats) as string;
    };
    const names = (n: GenerationNum, s: string) => [name(n, s), name(n, s, false, true)];

    expect(names(6, 'Venusaur-Mega')).toEqual(['Venusaur-Mega', 'Venusaur-Mega']);
    expect(names(6, 'Kyogre-Primal')).toEqual(['Kyogre-Primal', 'Kyogre-Primal']);
    expect(names(7, 'Greninja-Ash')).toEqual(['Greninja', 'Greninja-Ash']);
    expect(names(7, 'Mimikyu-Busted')).toEqual(['Mimikyu', 'Mimikyu']);
    expect(names(8, 'Butterfree-Gmax')).toEqual(['Butterfree', 'Butterfree-Gmax']);
    expect(names(8, 'Sinistea-Antique')).toEqual(['Sinistea', 'Sinistea']);
    expect(names(7, 'Gumshoos-Totem')).toEqual(['Gumshoos', 'Gumshoos-Totem']);
    expect(names(7, 'Pikachu-Libre')).toEqual(['Pikachu', 'Pikachu']);
    expect(names(7, 'Pikachu-Starter')).toEqual(['Pikachu-Starter', 'Pikachu-Starter']);

    expect(name(4, 'Gastrodon-East')).toBe('Gastrodon');
    expect(name(4, 'Gastrodon-East', true)).toBe('Gastrodon-East');
    expect(name(5, 'Keldeo-Resolute')).toBe('Keldeo');
    expect(name(5, 'Keldeo-Resolute', true)).toBe('Keldeo-Resolute');

    const strict = new Generations(Dex);
    expect(name(strict.get(9), 'Vivillon-Fancy')).toBe('Vivillon');
    expect(name(strict.get(9), 'Tauros-Paldea')).toBe('Tauros-Paldea-Combat');
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
      .toBe('Fire');
    expect(fixIVs(gen(7), {moves: ['Hidden Power Steel'], level: 99, ivs: {atk: 4, def: 3}}).ivs)
      .toEqual({spd: 30});
    expect(fixIVs(gen(2), {moves: ['Hidden Power Rock'], ivs: {atk: 4, def: 3}}).ivs)
      .toEqual({hp: 23, atk: 27, def: 25});
    expect(fixIVs(gen(4), {moves: ['Hidden Power Grass'], ivs: {atk: 2}}).ivs)
      .toEqual({atk: 2, spa: 30});
  });

  test('baseFormat', () => {
    const baseFormat = (f: string) => (new Smogon(fetch) as any).baseFormat(f) as ID;

    expect(baseFormat('gen2ou')).toBe('gen2ou');
    expect(baseFormat('gen7vgc2019moonseries')).toBe('gen7vgc2019');
    expect(baseFormat('gen7vgc2019ultraseries')).toBe('gen7vgc2019');
    expect(baseFormat('gen8battlestadiumsinglesseries10')).toBe('gen8battlestadiumsingles');
    expect(baseFormat('gen8vgc2020')).toBe('gen8vgc2020');
    expect(baseFormat('gen8vgc2021')).toBe('gen8vgc2021');
    expect(baseFormat('gen8vgc2021battleseries10')).toBe('gen8vgc2021');
    expect(baseFormat('gen8vgc2022')).toBe('gen8vgc2022');
    expect(baseFormat('gen8bssseries10')).toBe('gen8battlestadiumsingles');
    expect(baseFormat('gen8battlestadiumdoublesseries13')).toBe('gen8battlestadiumdoubles');
    expect(baseFormat('gen9vgc2023regulatione')).toBe('gen9vgc2023');
    expect(baseFormat('gen9vgc2024regf')).toBe('gen9vgc2024');
  });
});
