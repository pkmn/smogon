import {Analyses, Statistics} from './index';

import * as fixtures from './fixtures.json';

const fixture = (s: keyof typeof fixtures) =>
  new Promise<string>(resolve => resolve(fixtures[s]));

const FIXTURES = {
  dragapult: fixture('dragapult.ss.json'),
  snorlax: fixture('snorlax.gs.html'),
  landorus: fixture('landorus.sm.html'),
  index: fixture('stats.index.html'),
  formats: fixture('stats.formats.html'),
  gen6nu: fixture('gen6nu.json'),
  gen21v1: fixture('gen21v1.json'),
};

describe('Analyses', () => {
  test('URL', () => {
    expect(Analyses.URL).toBe('https://www.smogon.com/dex/');
  });

  test('url', () => {
    expect(Analyses.url('Gengar')).toBe('https://www.smogon.com/dex/sv/pokemon/gengar/');
    expect(Analyses.url('Tapu Koko', 7)).toBe('https://www.smogon.com/dex/sm/pokemon/tapu-koko/');
  });

  test('request', () => {
    expect(Analyses.request('Mr. Mime', 3)).toEqual({
      url: 'https://www.smogon.com/dex/_rpc/dump-pokemon',
      init: {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: '{"gen":"rs","alias":"mr-mime"}',
      },
    });
  });

  test('parse', async () => {
    expect(Analyses.parse('foo')).toBeUndefined();
    expect(Analyses.parse(await FIXTURES.snorlax)).toBeDefined();
    expect(Analyses.parse(await FIXTURES.dragapult)).toBeUndefined();
  });

  test('process', async () => {
    expect(Analyses.process('foo')).toBeUndefined();

    let processed = Analyses.process(Analyses.parse(await FIXTURES.snorlax)!)!;
    expect(processed).toBeDefined();
    expect(processed.get('OU')![0].movesets[0].items).toEqual(['Leftovers']);

    processed = Analyses.process(Analyses.parse(await FIXTURES.landorus)!)!;
    expect(processed).toBeDefined();
    const set = processed.get('Doubles')![0].movesets[0];
    expect(set.moveslots[1]).toEqual([
      {move: 'Sludge Bomb', type: null},
      {move: 'Stone Edge', type: null},
    ]);
    expect(set.moveslots[2]).toEqual([{move: 'Hidden Power', type: 'Ice'}]);

    processed = Analyses.process(JSON.parse(await FIXTURES.dragapult))!;
    expect(processed).toBeDefined();
    expect(processed.get('OU')![0].movesets[0].name).toBe('Choice Specs');
  });

  test('gen', () => {
    expect(Analyses.gen(3)).toBe('rs');
  });
});

describe('Statistics', () => {
  test('URL', () => {
    expect(Statistics.URL).toBe('https://www.smogon.com/stats/');
  });

  test('latest', async () => {
    expect(() => Statistics.latest('foo')).toThrow('Unexpected format for index');
    expect(Statistics.latest(await FIXTURES.index)).toBe('2022-11');
  });

  test('formats', async () => {
    expect(Statistics.formats('foo')).toEqual([]);
    expect(Statistics.formats(await FIXTURES.formats)).toEqual([
      'gen1ou', 'gen1uu', 'gen2ou', 'gen3doublesou', 'gen3ou', 'gen4ou', 'gen5ou', 'gen6doublesou',
      'gen6ou', 'gen6purehackmons', 'gen6ubers', 'gen7balancedhackmons', 'gen7doublesou',
      'gen7mixandmega', 'gen7ou', 'gen7ubers', 'gen8anythinggoes', 'gen8battlestadiumsingles',
      'gen8bdspdoublesou', 'gen8bdspou', 'gen8cap', 'gen8doublesou', 'gen8doublesubers',
      'gen8doublesuu', 'gen8lc', 'gen8monotype', 'gen8nationaldex', 'gen8nationaldexbh',
      'gen8nationaldexuu', 'gen8nu', 'gen8ou', 'gen8pu', 'gen8purehackmons', 'gen8ru',
      'gen8spikemuthcup', 'gen8ubers', 'gen8uu', 'gen8vgc2022', 'gen8zu', 'gen91v1',
      'gen92v2doubles', 'gen9almostanyability', 'gen9anythinggoes', 'gen9balancedhackmons',
      'gen9battlestadiumdoubles', 'gen9battlestadiumsingles', 'gen9battlestadiumsinglesseries1',
      'gen9cap', 'gen9doublesou', 'gen9doublesubers', 'gen9doublesuu', 'gen9fullpotential',
      'gen9godlygift', 'gen9lc', 'gen9metronomebattle', 'gen9mixandmega', 'gen9monotype',
      'gen9nationaldex', 'gen9nationaldexag', 'gen9nationaldexbh', 'gen9nationaldexmonotype',
      'gen9nationaldexuu', 'gen9nfe', 'gen9ou', 'gen9sharedpower', 'gen9stabmons', 'gen9ubers',
      'gen9uu', 'gen9vgc2023series1',
    ]);
  });

  test('url', () => {
    // standard
    expect(Statistics.url('2020-02', 'gen8ou')).toBe(
      'https://www.smogon.com/stats/2020-02/chaos/gen8ou-1695.json'
    );
    expect(Statistics.url('2020-02', 'gen6uu')).toBe(
      'https://www.smogon.com/stats/2020-02/chaos/gen6uu-1630.json'
    );
    expect(Statistics.url('2020-02', 'gen8ou', false)).toBe(
      'https://www.smogon.com/stats/2020-02/chaos/gen8ou-0.json'
    );
    expect(Statistics.url('2020-02', 'gen8ou', 1500)).toBe(
      'https://www.smogon.com/stats/2020-02/chaos/gen8ou-1500.json'
    );

    // gen7ou
    expect(Statistics.url('2020-01', 'gen7ou')).toBe(
      'https://www.smogon.com/stats/2020-01/chaos/gen7ou-1695.json'
    );
    expect(Statistics.url('2020-02', 'gen7ou')).toBe(
      'https://www.smogon.com/stats/2020-02/chaos/gen7ou-1630.json'
    );

    // gen7doublesou
    expect(Statistics.url('2017-02', 'gen7doublesou')).toBe(
      'https://www.smogon.com/stats/2017-02/chaos/gen7doublesou-1695.json'
    );
    expect(Statistics.url('2016-11', 'gen7doublesou')).toBe(
      'https://www.smogon.com/stats/2016-11/chaos/gen7doublesou-1630.json'
    );
    expect(Statistics.url('2020-01', 'gen7doublesou')).toBe(
      'https://www.smogon.com/stats/2020-01/chaos/gen7doublesou-1695.json'
    );
    expect(Statistics.url('2020-02', 'gen7doublesou')).toBe(
      'https://www.smogon.com/stats/2020-02/chaos/gen7doublesou-1630.json'
    );

    // smogondoublessuspecttest
    expect(Statistics.url('2015-05', 'smogondoublessuspecttest')).toBe(
      'https://www.smogon.com/stats/2015-05/chaos/smogondoublessuspecttest-1630.json'
    );
    expect(Statistics.url('2015-04', 'smogondoublessuspecttest')).toBe(
      'https://www.smogon.com/stats/2015-04/chaos/smogondoublessuspecttest-1695.json'
    );

    // randombattle
    expect(Statistics.url('2017-01', 'randombattle')).toBe(
      'https://www.smogon.com/stats/2017-01/chaos/gen6randombattle-1630.json'
    );
    expect(Statistics.url('2016-12', 'gen6randombattle')).toBe(
      'https://www.smogon.com/stats/2016-12/chaos/gen6randombattle-1630.json'
    );
    expect(Statistics.url('2016-12', 'randombattle')).toBe(
      'https://www.smogon.com/stats/2016-12/chaos/randombattle-1695.json'
    );
    expect(Statistics.url('2016-11', 'gen6randombattle')).toBe(
      'https://www.smogon.com/stats/2016-11/chaos/randombattle-1695.json'
    );

    // almostanyability
    expect(Statistics.url('2021-02', 'gen8almostanyability')).toBe(
      'https://www.smogon.com/stats/2021-02/chaos/gen8almostanyability-1630.json'
    );
    expect(Statistics.url('2021-02', 'gen6almostanyability')).toBe(
      'https://www.smogon.com/stats/2021-02/chaos/gen6almostanyability-1630.json'
    );

    // general gen6
    expect(Statistics.url('2017-06', 'gen6uu')).toBe(
      'https://www.smogon.com/stats/2017-06/chaos/uu-1630.json'
    );
    expect(Statistics.url('2017-07', 'uu')).toBe(
      'https://www.smogon.com/stats/2017-07/chaos/gen6uu-1630.json'
    );

    // late gen6
    expect(Statistics.url('2017-06', 'gen6monotype')).toBe(
      'https://www.smogon.com/stats/2017-06/chaos/monotype-1630.json'
    );
    expect(Statistics.url('2017-07', 'monotype')).toBe(
      'https://www.smogon.com/stats/2017-07/chaos/monotype-1630.json'
    );
    expect(Statistics.url('2018-01', 'monotype')).toBe(
      'https://www.smogon.com/stats/2018-01/chaos/gen6monotype-1630.json'
    );

    // legacy
    expect(Statistics.url('2014-12', 'battleofhoeen')).toBe(
      'https://www.smogon.com/stats/2014-12/chaos/battleofhoeen-1630.json'
    );
    expect(Statistics.url('2020-02', 'gen6battleofhoeen')).toBe(
      'https://www.smogon.com/stats/2020-02/chaos/battleofhoeen-1630.json'
    );
    expect(Statistics.url('2020-02', 'battleofhoeen')).toBe(
      'https://www.smogon.com/stats/2020-02/chaos/gen6battleofhoeen-1630.json'
    );

    // alternative reports
    expect(Statistics.url('2022-12', 'gen9ou', true, 'usage')).toBe(
      'https://www.smogon.com/stats/2022-12/gen9ou-1695.txt'
    );
    expect(Statistics.url('2022-12', 'gen9ou', 1500, 'leads')).toBe(
      'https://www.smogon.com/stats/2022-12/leads/gen9ou-1500.txt'
    );
    expect(Statistics.url('2022-12', 'gen9ou', true, 'moveset')).toBe(
      'https://www.smogon.com/stats/2022-12/moveset/gen9ou-1695.txt'
    );
    expect(Statistics.url('2022-12', 'gen9ou', 0, 'metagame')).toBe(
      'https://www.smogon.com/stats/2022-12/metagame/gen9ou-0.txt'
    );
  });

  test('latestDate', async () => {
    expect(await Statistics.latestDate('foo')).toBeUndefined();
    expect(await Statistics.latestDate('gen6vgc2016')).toEqual({date: '2021-05', count: 1});
    expect(await Statistics.latestDate('gen6vgc2016', true)).toEqual({
      date: '2016-11',
      count: 160180,
    });
  });

  test('canonicalize', () => {
    expect(Statistics.canonicalize('ou')).toBe('gen6ou');
    expect(Statistics.canonicalize('foo')).toBe('foo');
    expect(Statistics.canonicalize('gen6uu')).toBe('gen6uu');
    expect(Statistics.canonicalize('gen8ou')).toBe('gen8ou');
    expect(Statistics.canonicalize('purehackmons')).toBe('gen6purehackmons');
  });

  test('process', async () => {
    let processed = Statistics.process(await FIXTURES.gen6nu);
    expect(processed.data['Bulbasaur'].usage).toBe(0.25);
    processed = Statistics.process(await FIXTURES.gen21v1);
    expect(processed.info['number of battles']).toBe(1);
  });
});
