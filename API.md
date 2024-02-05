# API

[data.pkmn.cc](https://data.pkmn.cc) is the canonical URL for this API - any other URLs that happen
to point to the same data are implementation details and should not be relied on. No thought will be
given to the stability of any endpoints other than those under the canonical URL.

The endpoints of this API are subject to change - care will be taken to maintain backwards
compatibility and minimize breakage, but developers relying on these endpoints should join the
[Discord](https://pkmn.cc/dev) to keep abreast of updates and/or rely on the latest version of the
[`@pkmn/smogon`]([https://](https://github.com/pkmn/smogon/tree/main/pkmn#readme)) package to
simplify the data handling.

In all cases the data exposed as been carefully crafted to **avoid requiring a data dependency**
(_i.e._, the Pokémon Showdown `"id"` format is eschewed in favor of `"Display Name"` as the former
can be obtained from the latter but not vice-versa) and to **remove any fields which can be
programmatically deduced**. The latter design-choice means the data exposed by this API may require
some trivial processing to format it in the most presentable way, but ultimately saving bytes over
the wire is deemed to be more important than developer convenience.

More details on each of the provided endpoints can be found below:

- [`/analyses`](data/analyses/index.md)
- [`/formats`](data/formats/index.md)
- [`/imgs`](data/imgs/index.md)
- [`/sets`](data/sets/index.md)
- [`/stats`](data/stats/index.md)
- [`/teams`](data/formats/index.md)
