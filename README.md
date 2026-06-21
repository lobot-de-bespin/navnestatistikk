# Norsk navnestatistikk

Statisk analyseverktøy for SSBs navnestatistikk.

Datakilder:

- SSB tabell 10467: Fødte etter jente- og guttenavn.
- SSB tabell 05803: Levendefødte i alt.
- SSB tabell 09745: Levendefødte etter kjønn fra 1986.

Bygg data lokalt:

```bash
python3 scripts/build_data.py
```

Publisering skjer som statisk GitHub Pages-side fra `docs/`.
