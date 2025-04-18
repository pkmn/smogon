<p align="center">
  <a href="https://www.smogon.com/">
    <img alt="Smogon" height="300" src="https://pkmn.cc/smogon.svg" />
  </a>
</p>

[`@pkmn`](https://pkmn.cc/@pkmn/)'s unofficial APIs for [Smogon](https://smogon.com)'s analysis,
moveset, sample teams, and usage statistics data.

**Smogon does not officially provide any API for third party developers**, and is at liberty to make
breaking changes to its internal data representations at any point - this project attempts to
provide a stable way of accessing the data Smogon exposes on its site. Two packages are provided:

- [`smogon`](https://github.com/pkmn/smogon/tree/main/smogon): A low-level wrapper around Smogon's
  analysis and statistics endpoints used to ergonomically fetch raw data via point queries from the
  source.
- [`@pkmn/smogon`](https://github.com/pkmn/smogon/tree/main/pkmn): A [rich
  client](https://en.wikipedia.org/wiki/Rich_client) for the processed and
  aggregated [Smogon](https://smogon.com) analysis and moveset information
  available at [data.pkmn.cc](https://data.pkmn.cc).

[data.pkmn.cc](https://data.pkmn.cc) contains several curated datasets pulled
from Smogon and Pokémon Showdown which have been processed to allow for
efficient batch access of analysis, sets, teams, and statistics data by format
or generation. Analysis and set data is [refreshed
automatically](https://simonwillison.net/2020/Oct/9/git-scraping/) every [24
hours](https://github.com/pkmn/smogon/tree/main/.github/workflows/update-sets.yml)
as are sample teams, the best stats data for each generation is converted each
month into [`@pkmn/stats`](https://github.com/pkmn/stats)'s optimized [output
format](https://github.com/pkmn/stats/blob/main/stats/OUTPUT.md), and
information about Pokémon Showdown’s standard Random Battle formats from
[pkmn/randbats](https://github.com/pkmn/randbats) is updated hourly.

The [API](https://github.com/pkmn/smogon/blob/main/API.md) for these endpoints is documented though
subject to change - developers relying on these endpoints should join the
[Discord](https://pkmn.cc/dev) to keep abreast of updates and/or rely on the latest version of the
`@pkmn/smogon` package to simplify the data handling.

While this project's code is distributed under the terms of the [MIT
License](https://github.com/pkmn/smogon/tree/main/LICENSE) and the aggregated
stats information is freely available in the public domain, the set and analysis
data is copyrighted by Smogon and its contributors.
