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

## iOS-spor

iOS-arbeidet ligger ved siden av GitHub Pages-oppsettet:

- Web/PWA-kilde: `docs/`
- Capacitor-konfigurasjon: `capacitor.config.json`
- iOS-prosjekt: `apps/ios`

Nyttige kommandoer:

```bash
npm run check:js
npm run cap:sync:ios
```

Ekte iOS-build, signering, TestFlight og App Store-innsending krever macOS med
Xcode og Apple Developer-konto.
