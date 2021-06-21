# `@pkmn/smogon`

![Test Status](https://github.com/pkmn/smogon/workflows/Tests/badge.svg)
![License](https://img.shields.io/badge/License-MIT-blue.svg)
[![npm version](https://img.shields.io/npm/v/@pkmn/smogon.svg)](https://www.npmjs.com/package/@pkmn/smogon)

[Rich client](https://en.wikipedia.org/wiki/Rich_client) for the processed and aggregated
[Smogon](https://smogon.com) analysis and moveset information available at
[https://data.pkmn.cc](https://data.pkmn.cc).

On its face, `@pkmn/smogon` is similar to
[`@smogon/sets`](https://www.npmjs.com/package/@smogon/sets) with respect to the data that it
provides, with several notable differences:

- `@smogon/sets` contains preprocessed and validated `PokemonSet` data gleaned from Smogon, usage
  statistics and third-party sources, grouped by format and generation. `@pkmn/smogon` contains no
  data, instead taking in a [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
  API-compatible client and using it to retrieve sets data from
  [https://data.pkmn.cc](https://data.pkmn.cc), where the data is also grouped by generation and
  format but is in the form of a `Moveset` as opposed to a `PokemonSet` and `@pkmn/smogon` does the
  work of converting between the two.
- `@pkmn/smogon` does not contain any of the usage statistics or third-party sets that
  `@smogon/sets` provides, nor does it validate the sets it returns (though even `@smogon/sets`'s
  data is not guaranteed to be valid given that validation rules change over time).
- `@pkmn/smogon` fetches the latest data as opposed to `@smogon/sets` where the data only updates
   approximately monthly when a new package is released.
- `@pkmn/smogon` supports returning analysis and moveset information as opposed to just sets.

Both packages rely on [`smogon`](https://www.npmjs.com/package/smogon) to handle fetching the raw
data from Smogon but make different tradeoffs that may appeal to different types of applications.
`@pkmn/smogon` is strictly fresher and more powerful, but `@smogon/sets` may still be appealing for
the simplicity it provides.

## Installation

```sh
$ npm install @pkmn/smogon
```

## Usage

TODO

```ts
import {Dex} from '@pkmn/dex';
import {Generations} from '@pkmn/data';
import {Smogon} from '@pkmn/smogon';
// import fetch from 'node-fetch';

const gens = new Generations(dex);
const smogon = new Smogon(fetch);

smogon.sets(gens.get(8), 'Dragapult');
smogon.sets(gens.get(6), 'Clefable', 'gen6ubers');

smogon.analyses(gens.get(4), 'Jirachi');
smogon.analyses(gens.get(2), 'Blastoise', 'gen2uu');

smogon.stats(gens.get(1), 'Snorlax');
smogon.stats(gens.get(7), 'Greninja-Ash', 'gen7monotype');
```

## License

This package is distributed under the terms of the [MIT License](LICENSE).
