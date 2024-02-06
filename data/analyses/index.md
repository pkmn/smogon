## `/analyses`

The analyses API provides the analysis data **without** movesets from Smogon University's
[www.smogon.com/dex](https://www.smogon.com/dex).

This data is provided either by format, _e.g._,
[`/analyses/gen9ou.json`](https://data.pkmn.cc/analyses/gen9ou.json), or for an entire generation
[`/analyses/gen9.json`](https://data.pkmn.cc/analyses/gen9.json). In the first case the resource
will be a mapping from species name to raw analysis. In the latter case there is an initial layer
for each tier ID which when combined with the generation ID indicates which format the data is
intended for.

The raw analysis contains the following:

  - a `sets` field containing a mapping of names to an object containing an optional sanitized HTML
    `description` of the set and a flag indicating whether the set should be considered `outdated`
  - an optional top-level `outdated` field which indicates whether the analysis as a whole is
    considered to be out of date
  - an optional `overview` field which if present contains the sanitized HTML from any analysis
    overview
  - an optional `comments` field which if present contains the sanitized HTML from any general
    analysis commments
  - an optional `credits` field containing structured information about the Smogon contributors
    involved in publishing the analysis

The HTML returned by Smogon University has been sanitized to remove all anchor (`a`) tags with
relative `href` attributes. Smogon programmatically adds links to other analyses the first time a
recognized name appears in body of an analysis and these both do not work when not hosted on
[www.smogon.com](https://smogon.com) and are redundant as they can be added with post-processing.

The analysis data can be combined with the sets data accessible via the
[`/sets`](https://data.pkmn.cc/sets) endpoint - each set name key in the `sets` field is required to
map to a named moveset.

A [`/analyses/index.json`](https://data.pkmn.cc/analyses/index.json) resource exists which is a
mapping from each valid format and generation ID to a 2-tuple containing the number of uncompressed
and gzip-compressed bytes each resource contains.
