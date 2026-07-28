# Norsk navnestatistikk

Statisk verktøy for å oppdage, søke, sammenligne og vurdere fornavn som er
dokumentert relevante i Norge.

## Katalogmodell

Appen bruker én kildeuavhengig navnekatalog. Hvert navn har alltid identitet
(`name` + `gender`) og kan gradvis få flere dokumenterte egenskaper:

- norsk bruk
- årlige fødselstall
- betydning, opphav og uttale

`coverage` avgjør hvilke funksjoner appen viser. Et navn uten tidsserie kan
fortsatt søkes opp, åpnes, legges til og vurderes, men får ikke trend, rang,
toppår eller skoleestimat. `sourceRefs` beskriver kildene for navnet, mens
`factSources` beholder kildeproveniens per opplysning. Nye importadaptere skal
bygge samme modell og må dokumentere norsk relevans; en åpen internasjonal
navneliste er ikke alene nok til å tas inn i standardkatalogen.

Datakilder:

- SSB tabell 10467: Fødte etter jente- og guttenavn.
- SSB tabell 05803: Levendefødte i alt.
- SSB tabell 09745: Levendefødte etter kjønn fra 1986.

Bygg data lokalt:

```bash
python3 scripts/build_data.py
```

Byggingen validerer unike ID-er, obligatorisk navn/kjønn, capabilities og alle
kildehenvisninger før JSON-filen skrives.

Kjør mobil- og funksjonssmoke-test mot en lokal server:

```bash
python3 -m http.server 4173 --directory docs
node tests/browser-smoke.mjs http://127.0.0.1:4173/
```

Publisering skjer som statisk GitHub Pages-side fra `docs/`.
