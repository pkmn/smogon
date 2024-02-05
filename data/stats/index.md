## `/stats`

The stats API exposes the _best_ usage statistics in the [**improved output
format**](https://github.com/pkmn/stats/blob/main/stats/OUTPUT.md#pkmnstats) invented by
[`@pkmn/stats`](https://github.com/pkmn/stats/blob/main/stats#readme)  _converted_ from the legacy
statistics information found at [www.smogon.com/stats](https://www.smogon.com/stats). Each available
format gets its own resource under `/stats/FORMAT.json` _e.g_,
[`/teams/gen9ou.json`](https://data.pkmn.cc/stats/gen9ou.json).

The "best" statistics for each format are defined to be the latest statistics from the cutoff used
for tiering that meets a certain minimimum number of battles, _i.e._, effectively capturing the data
from when the format was last seriously contested.

Note that because the output is converted from legacy statistics the [caveats mentioned regarding
legacy conversion](https://github.com/pkmn/stats/blob/main/stats/OUTPUT.md#legacy) apply:

> A legacy version of Statistics is produced which does not have `unique`, `wins` or `stats` fields
> but retains the `happinesses` and `spreads` fields (rounded and respecting cutoffs appropriately)
> instead.

This may change in the future if and when `@pkmn/stats` is adopted by Smogon University.

A [`/stats/index.json`](https://data.pkmn.cc/stats/index.json) resource exists which is a mapping
from each valid format ID to a 2-tuple containing the number of uncompressed and gzip-compressed
bytes each resource contains.
