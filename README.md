# Norsk navnestatistikk

Statisk analyseverktøy for SSBs navnestatistikk.

Datakilder:

- SSB tabell 10467: Fødte etter jente- og guttenavn.
- SSB tabell 05803: Levendefødte i alt.
- SSB tabell 09745: Levendefødte etter kjønn fra 1986.
- UCI Machine Learning Repository, [Gender by Name](https://doi.org/10.24432/C55G7X),
  CC BY 4.0: internasjonale navn uten norsk historikk. Datasettet bygger på
  offentlig navnestatistikk fra USA, England og Wales, British Columbia og
  Australia. Bare navn med minst 2 500 registreringer og minst 90 prosent
  overvekt for ett kjønn tas med. Kildetallene vises aldri som norsk
  popularitet.

Bygg data lokalt:

```bash
python3 scripts/build_data.py
python3 scripts/build_open_names.py
```

Publisering skjer som statisk GitHub Pages-side fra `docs/`.
