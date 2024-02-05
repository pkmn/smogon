## `/teams`

The teams API aggregates all of the sample teams scraped from threads linked in Pokémon Showdown's
[`config/formats.ts`](https://github.com/smogon/pokemon-showdown/blob/master/config/formats.ts) and
from [www.smogon.com/roa/](http://www.smogon.com/roa/) and exposes the valid teams for each format
at `/teams/FORMAT.json` _e.g._, [`/teams/gen9ou.json`](https://data.pkmn.cc/teams/gen9ou.json).

Teams optionally include `name` and `author` fields in addition to the required `data` which is
always present - these are not guaranteed to be accurate as the quality of these depend heavily on
the sample team maintainers. The `data` field contains set data in [Pokémon Showdown's JSON
format](https://github.com/smogon/pokemon-showdown/blob/master/sim/TEAMS.md#json-format).

The fields of the set data all contain the `"Display Name"` instead of an `"id"`, and the data is
**canonicalized** and **condensed**. As a rule, any data that gets filled in automatically by
Pokémon Showdown's team validation process is elided, though the teams contained here are guaranteed
to be equivalent to the teams in the original sample team exports and were valid at least within the
last 24 hours (though Smogon University's formats undergo frequent tiering actions so one should
always validate teams before use - see the
[`@pkmn/sim`](https://github.com/pkmn/ps/tree/main/sim#readme) package). **Attempting to fill in
these elided fields is an anti-pattern**, Pokémon Showdown is perfectly capable of handling the
teams exposed by this API without any preprocessing.

A [`/teams/index.json`](https://data.pkmn.cc/teams/index.json) resource exists which is a mapping
from each valid format ID to a 2-tuple containing the number of uncompressed and gzip-compressed
bytes each resource contains.
