# `smogon`

![Test Status](https://github.com/pkmn/smogon/workflows/Tests/badge.svg)
![License](https://img.shields.io/badge/License-MIT-blue.svg)
[![npm version](https://img.shields.io/npm/v/smogon.svg)](https://www.npmjs.com/package/smogon)

A typed, low-level wrapper around [Smogon](https://smogon.com)'s analysis and statistics endpoints
used to ergonomically fetch raw data via point queries from the source. `smogon` has
zero-dependencies and is agnostic to your project's choice of network layer - this package helps you
build a request and process the response. There is support for scraping analyses from Smogon's HTML
(discouraged), directly performing Dex RPCs, dealing with naming and cutoff discontinuities in the
usage statistics available from [https://smogon.com/stats/](https://smogon.com/stats/), and
determining the optimal dates to fetch statistics for a given format.

```ts
import {Analyses, Statistics} from 'smogon';

// Performing a Dex RPC
const analysis = Analyses.process(await request(Analyses.request('Mr. Mime', 3)));

// Determining the 'best' date to fetch weighted statistics for
const format = 'gen6vgc2016';
const latest = await Statistics.latestDate(format, true);
const stats = Stats.process(await request(Statistics.url(latest.date, format)));
```

This package is distributed under the terms of the [MIT License](LICENSE).
