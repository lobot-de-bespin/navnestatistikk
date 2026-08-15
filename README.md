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
- SSB tabell 10501: Årlige bestandstall for navn som allerede finnes i
  fødselskatalogen. Tabellen beriker navnene, men kan ikke legge til nye navn
  eller påvirke fødselstrend, forslag eller skoleestimat.
- SSB tabell 05803: Levendefødte i alt.
- SSB tabell 09745: Levendefødte etter kjønn fra 1986.
- Store norske leksikons samleoversikter for guttenavn og jentenavn: tilfører
  bare navn og kjønnstilknytning. Artikkeltekst, etymologi og andre
  opplysninger hentes ikke.

Bygg data lokalt:

```bash
python3 scripts/build_data.py
```

Byggingen validerer unike ID-er, obligatorisk navn/kjønn, capabilities og alle
kildehenvisninger før JSON-filen skrives. Rang beregnes lokalt fra publiserte
tall, separat for kjønn og år, med delt konkurranserang (1, 2, 2, 4) både for
fødselsserier og befolkningsserier. Skjulte SSB-tall rangeres ikke; appen viser
da siste år navnet faktisk har et publisert tall.

Kjør mobil- og funksjonssmoke-test mot en lokal server:

```bash
python3 -m http.server 4173 --directory docs
node tests/browser-smoke.mjs http://127.0.0.1:4173/
```

Publisering skjer som statisk GitHub Pages-side fra `docs/`.
