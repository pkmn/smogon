## `/formats`

The formats API provides a mapping from Pokémon Showdown `"id"` to `"Display Name"` for cases when
the display name cannot programmatically deduced. There is a single valid resource which can be fetched:
[`/formats/index.json`](https://data.pkmn.cc/formats/index.json).

The correct way to determine the name of current formats is to **rely on the information from
Pokémon Showdown's
[`config/formats.ts`](https://github.com/smogon/pokemon-showdown/blob/master/config/formats.ts)**, a
version of which is included with the [`@pkmn/sim`](https://github.com/pkmn/ps/tree/main/sim#readme)
package.

**The data provided here is only required to support legacy formats** - _i.e._, formats that existed
at one point in time and have data present on [www.smogon.com/stats](https://www.smogon.com/stats).
Unless you are building an historical usage stats viewer you probably do not need this information.

The following transformations are required to properly display the data:

- `"battlespotspecial<NUMBERS>"` should be converted to `"Battle Spot Special #<NUMBERS>"`
- `"vgc<YEAR>"` should be converted to `"VGC <YEAR>"`
- tiers starting with `bsdp` should add a `"BDSP "` prefix to the display name
- tiers ending with the following suffixes should be converted into the corresponding suffix tags:
  | Tier            | Suffix              |
  | --------------- | ------------------- |
  | `"alpha"`       | `" (Alpha)"`        |
  | `"beta"`        | `" (Beta)"`         |
  | `"suspect"`     | `" (Suspect)"`      |
  | `"suspecttest"` | `" (Suspect Test)"` |
- tiers starting with `"pokebank"` should either get turned into a `" (Pokebank)"` suffix tag for
  all formats that don't already have a suffix tag otherwise should turn into a `"Pokebank "` prefix
