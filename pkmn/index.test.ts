import {promises as fs} from 'fs';

const URL = 'https://data.pkmn.cc/';
const fetch = async (url: string) => {
  if (!url.startsWith(URL)) throw new Error(`Invalid url: '${url}'`);
  return JSON.parse(await fs.readFile(url.slice(URL.length), 'utf8'));
};

describe('Smogon', () => {
  test.todo('analysis');
  test.todo('sets');
});