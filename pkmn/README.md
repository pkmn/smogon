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
- `@pkmn/smogon` supports returning analysis and moveset information as opposed to just sets, and
  also can return `@pkmn/stats`-formatted usage statistics output.

Whereas `@smogon/sets` uses [`smogon`](https://www.npmjs.com/package/smogon) to handle fetching the
raw data from Smogon, `@pkmn/smogon` relies on the preprocessed data hosted at
[https://data.pkmn.cc](https://data.pkmn.cc). `@pkmn/smogon` is strictly fresher and more powerful,
but `@smogon/sets` may still be appealing for the simplicity it provides.

## Installation

```sh
$ npm install @pkmn/smogon
```

## Usage

You must provide a `fetch` function to initialize the `Smogon` - this can be the native `fetch`
class in the browser or on Node, or something which implements the rudimentary aspects of the
`fetch` interface required by `Smogon` to make a request. Additionally, the methods on `Smogon`
require something that implements `Generation` from `@pkmn/data` as their first parameter - the
simplest way to accomplish this is by instantiating a `Generation` from `@pkmn/data` with a `Dex`
from `@pkmn/dex` or `@pkmn/sim`:

```ts
import {Dex} from '@pkmn/dex';
import {Generations} from '@pkmn/data';
import {Smogon} from '@pkmn/smogon';

const gens = new Generations(Dex);
const smogon = new Smogon(fetch);

smogon.sets(gens.get(8), 'Dragapult');
smogon.sets(gens.get(6), 'Clefable', 'gen6ubers');

smogon.analyses(gens.get(4), 'Jirachi');
smogon.analyses(gens.get(2), 'Blastoise', 'gen2uu');

smogon.stats(gens.get(1), 'Snorlax');
smogon.stats(gens.get(7), 'Greninja-Ash', 'gen7monotype');
```

By default, `Smogon` will retrieve an entire generation's worth of analysis/moveset data (which can
be as much as ~15MB uncompressed) and cache the result (stats will always only fetch a format's
worth of stats, though that in itself is also sizeable). If bandwidth/memory/space is a concern, a
second parameter can be passed to the `Smogon` constructor to trigger 'minimal' mode where only
analysis/moveset data for specific formats will be requested in scenarios where a format parameter
is passed to the methods (if no format method is passed, only data from formats which have already
been cached will be returned).

### Details

`@pkmn/smogon` will always display the latest stats for a format, but due to how Pokémon Showdown
and in particular usage stats work, what data gets returned can sometimes be uninituitive. Pokémon
Showdown's usage stats are only processed and published monthly on Smogon, and as such, data is
always going to be somewhat stale depending on how close it is to the start of the month. Secondly,
because Pokémon Showdown changes around which formats have a ladder (and thus ranked battles and
thus usage stats), the data for a format may be several months out of date (ie. stats will be
returned from the last time the format had an active ladder).

This problem is especially prominent with Nintendo's formats (VGC/BSS/BSD) - Nintendo announces new
formats that get implemented by Pokémon Showdown on dates that almost never neatly line up with
usage stats' monthly publish schedule, meaning there is often no data for the new format. However,
most of the time these formats only differ slightly from the previous format (ie. Nintendo has moved
to a 'series' model for their metagames where each series makes a few tweaks to the previous
series). Pokémon Showdown treats each of these metagames as completely new formats, but both Smogon
and `@pkmn/smogon` do not (otherwise there would be no analyses/sets/stats) - instead they are
treated more similarly to a format like OU or UU which keeps the same name despite any bans or rule
changes that may occur. The consequence of this is that when fetching data for a new VGC/BSS/BSD
series with `@pkmn/smogon`, you will may receive stats from the most recent prior series until new
usage stats including data from the new series gets publsihed (Smogon analyses/sets data will also
take a while to reflect changes from the new series as analysis writers need time to update the site
after the metagame shifts).

## License

This package is distributed under the terms of the [MIT License](LICENSE).
