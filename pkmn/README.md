# `@pkmn/smogon`

![Test Status](https://github.com/pkmn/smogon/workflows/Tests/badge.svg)
![License](https://img.shields.io/badge/License-MIT-blue.svg)
[![npm version](https://img.shields.io/npm/v/@pkmn/smogon.svg)](https://www.npmjs.com/package/@pkmn/smogon)

[Rich client](https://en.wikipedia.org/wiki/Rich_client) for the processed and aggregated
[Smogon](https://smogon.com) analysis and moveset information available at
[https://data.pkmn.cc](https://data.pkmn.cc).

```
TODO compare to `@smogon/sets`, thick client vs. thin client

`smogon` = grab from the source, raw smogon data
`@pkmn/smogon` = freshness, analyses, datasize (need to switch back to per format + per gen...)
`@smogon/sets` = usage sets, thin client, no `fetch` required
```

## Installation

```sh
$ npm install @pkmn/smogon
```

Alternatively, as [detailed below](#browser), if you are using `@pkmn/smogon` in the browser and
want a convenient way to get started, simply depend on a transpiled and minified version via
[unpkg](https://unpkg.com/):

```html
<script src="https://unpkg.com/@pkmn/smogon"></script>
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

smogon.analysis(gens.get(4), 'Jirachi');
```

### Browser

The recommended way of using `@pkmn/data` in a web browser is to **configure your bundler**
([Webpack](https://webpack.js.org/), [Rollup](https://rollupjs.org/),
[Parcel](https://parceljs.org/), etc) to minimize it and package it with the rest of your
application. If you do not use a bundler, a convenience `production.min.js` is included in the
package. You simply need to depend on `./node_modules/@pkmn/smogon/build/production.min.js` in a
`script` tag (which is what the unpkg shortcut above is doing), after which **`smogon` will be
accessible as a global.**

## License

This package is distributed under the terms of the [MIT
License](https://github.com/pkmn/smogon/tree/main/LICENSE).


```

This data is expected to be fresher than the data in the
[`@smogon/sets`](https://www.npmjs.com/package/@smogon/sets) package as it is refreshed every [4
hours](https://github.com/pkmn/data/tree/main/.github/workflows/update.yml) instead of being
released monthly, though there are several differences:

- the data in this repository includes [analysis](https://pkmn.github.io/data/analyses) data in
  additon to [sets](https://pkmn.github.io/data/sets)
- the data in this repository does not contain any sets or information from
  [https://smogon.com/stats/](https://smogon.com/stats/)
- the data in this repository is sliced differently ('core' and `more`) than `@smogon/sets` where
  the sets are provided by generation and by format
- `@smogon/sets` provides only legal sets, the set information here contains all recommended
  *options* which can then be massaged into sets

These data can be accessed directly via `https://data.pkmn.cc`, e.g.
[https://data.pkmn.cc/sets/gen8.json](https://data.pkmn.cc/sets/gen8.json), or by using the
[`@pkmn/smogon`](https://github.com/pkmn/data/tree/main/smogon) package from this repository.


See also https://pkmn.github.io/randbats for a similar project which contains the latest options for
Pokémon Showdown’s standard Random Battle formats.
```
