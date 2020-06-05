# `smogon`

[![Build Status](https://api.travis-ci.com/smogon/api.svg)](https://travis-ci.com/smogon/api)
[![Dependency Status](https://david-dm.org/smogon/api.svg)](https://david-dm.org/smogon/api)
[![devDependency Status](https://david-dm.org/smogon/api/dev-status.svg)](https://david-dm.org/smogon/api?type=dev)

This package provides a wrapper around Smogon's analyses and usage statistics.

**Smogon does not officially provide any API for third party developers**, and
is at liberty to make breaking changes to its internal data representations at
any point - this package attempts to provide a stable way of accessing the data
Smogon exposes on its site.

Please note that all sets and analyses on the site are copyrighted by Smogon.com
and its contributors and you must first receive permission from Smogon.com
before using this data. If you are just interested in retrieving the sets,
the [@pokemon-showdown/sets][1] package used by the [client teambuilder][2] and
[damage calculator][3] will likely simplify matters, though will potentially lag
behind what is visible on Smogon by 2-4 weeks.

The aggregate usage statistics data present on
https://smogon.com/stats and exposed by this API may be used for any purpose
without prior permission.

This package is distributed under the terms of the [MIT License][4].

  [1]: https://www.npmjs.com/package/@pokemon-showdown/sets
  [2]: https://github.com/smogon/pokemon-showdown-client
  [3]: https://github.com/smogon/damage-calc
  [4]: https://github.com/smogon/api/blob/master/LICENSE
