## `/sets`

The sets API provides just the moveset data **without** any analysis from Smogon University's
[www.smogon.com/dex](https://www.smogon.com/dex).

This data is provided either by format, _e.g._,
[`/sets/gen9ou.json`](https://data.pkmn.cc/sets/gen9ou.json), or for an entire generation
[`/sets/gen9.json`](https://data.pkmn.cc/sets/gen9.json). In the first case the resource will be
keyed by species name followed by a mapping from moveset name to moveset. In the latter case there
is an initial layer for each tier ID which when combined with the generation ID indicates which
format the data is intended for.

Smogon's movesets are **not** guaranteed to be valid on Pokémon Showdown - most of the fields can
either be atomic or composite values, with the latter being used to reflect the "slash options"
present in Smogon's data. In all cases the fields of the set data all contain the `"Display Name"`
instead of an `"id"`, and information that can be programmatically deduced (_e.g._, the default
level) has been elided.

The moveset data can be combined with the analysis data accessible via the
[`/analyses`](https://data.pkmn.cc/analyses) endpoint.

A [`/sets/index.json`](https://data.pkmn.cc/sets/index.json) resource exists which is a mapping from
each valid format and generation ID to a 2-tuple containing the number of uncompressed and
gzip-compressed bytes each resource contains.
