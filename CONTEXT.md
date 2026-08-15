# Navnestatistikk project context

Canonical durable context for `lobot-de-bespin/navnestatistikk`.

## Identity and publishing

- Static GitHub Pages app for exploring SSB first-name statistics.
- Repository owner is `lobot-de-bespin`, not `perflem`.
- A successful push is not delivery; verify the Pages run and live app.

## Data contract

- One source-independent catalogue: each name has name/gender, explicit data
  capabilities, and fact-level provenance.
- SSB table 10467 admits names to the catalogue. Table 10501 is enrichment-only
  for admitted names and may add current bearer counts, rank, and stock history;
  it must not add catalogue names or drive birth-trend/discovery logic.
- SNL overview titles may be included as taxonomy-only records without birth
  statistics; filters must distinguish source taxonomy from SSB birth data.
- Pre-1945 history may fall back to `PersonerProsent` when counts are absent.
- Norwegian relevance is required before new catalogue names are admitted from
  Wiktionary/Kaikki-style enrichment.

## Product and UX decisions

- Current flows are Utforsk/Graf/Vurder/Aktuelle/Uaktuelle with local decision
  state and an installable PWA.
- Advanced search is a compact conventional control. Keep discovery filters
  separate from search rules and show invalid regex inline.
- Mobile decision actions stay in normal document flow above the tab bar.
- Similarity methods are user-facing as `Form`, `Skalert avstand`, and
  `Uskalert avstand`.
- Validate visual changes with live screenshots at 360/390/430 px and bypass
  the service worker in at least one smoke test.
