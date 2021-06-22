<p align="center">
  <a href="https://www.smogon.com/">
    <img alt="Smogon" height="300" src="https://www.smogon.com/media/zracknel-beta.svg.m.1" />
  </a>
</p>

[`@pkmn`](https://pkmn.cc/@pkmn/)'s unofficial APIs for [Smogon](https://smogon.com)'s analysis,
moveset, and usage statistics data.

**Smogon does not officially provide any API for third party developers**, and is at liberty to make
breaking changes to its internal data representations at any point - this project attempts to
provide a stable way of accessing the data Smogon exposes on its site. Two packages are provided:

- [`smogon`](https://github.com/pkmn/smogon/tree/master/smogon): A low-level wrapper around Smogon's
  analysis and statistics endpoints used to ergonomically fetch raw data via point queries from the
  source.
- [`@pkmn/smogon`](https://github.com/pkmn/smogon/tree/master/pkmn): A [rich
  client](https://en.wikipedia.org/wiki/Rich_client) for the processed and aggregated
  [Smogon](https://smogon.com) analysis and moveset information available at
  [https://data.pkmn.cc](https://data.pkmn.cc).

[https://data.pkmn.cc](https://data.pkmn.cc/) is [refreshed
automatically](https://simonwillison.net/2020/Oct/9/git-scraping/) every [24
hours](https://github.com/pkmn/smogon/tree/master/.github/workflows/update.yml) and allows for
efficient batch access of Smogon analysis and statistics data by format or generation. This data can
be accessed directly, though the `@pkmn/smogon` package is recommended for simplifying the data
handling. Aggregate usage statistics data can be found at
[https://smogon.com/stats](https://smogon.com/stats), and information about Pokémon Showdown’s
standard Random Battle formats can be found at
[https://pkmn.github.io/randbats](https://pkmn.github.io/randbats).

While this project's code is distributed under the terms of the [MIT
License](https://github.com/pkmn/smogon/tree/master/LICENSE) and the aggregated stats information is
freely available in the public domain, the set and analysis data is copyrighted by Smogon and its
contributors.
