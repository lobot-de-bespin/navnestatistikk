# iOS-releaseplan

Dette sporet skal modnes ved siden av GitHub Pages. Produksjonssiden på Pages
skal ikke være avhengig av iOS-prosjektet.

## Status

- Capacitor er satt opp med `docs/` som web-kilde.
- iOS-prosjektet ligger i `apps/ios`.
- Bundle ID-forslag: `no.flemmen.navnestatistikk`.
- Appen er konfigurert for portrettmodus.
- Apple Developer-konto er ikke nødvendig før TestFlight/App Store.

## Før TestFlight

- Avklare endelig appnavn.
- Lage App Store-ikon og eventuelle splash-varianter.
- Kjøre Xcode-build på macOS.
- Opprette Bundle ID i Apple Developer.
- Signere med Per/utgiverens Apple Developer-konto.
- Opprette TestFlight-app i App Store Connect.

## App Store-metadata

- Kategori: Lifestyle eller Reference.
- Marked: Norge.
- Språk: Norsk bokmål.
- Prisstrategi: betalt app først, in-app purchases senere bare hvis produktet
  trenger pro-funksjoner.
- Support-URL: GitHub Pages eller egen enkel supportside.
- Privacy Policy URL: `personvern.html` på publisert webflate.

## SSB og lisens

- Appen skal kreditere SSB tydelig i innstillinger, datagrunnlagsside og
  App Store-tekst der det passer.
- Foreløpig formulering: "Kilde: Statistisk sentralbyrå, åpne data fra SSBs
  statistikkbank, bearbeidet av Navnestatistikk."
- SSB skal ikke fremstilles som samarbeidspartner, sponsor eller godkjenner.

## Teknisk arbeidsflyt

1. Endre webappen i `docs/`.
2. Kjør `npm run check:js`.
3. Kjør `npm run cap:sync:ios` for å kopiere webfiler til iOS-prosjektet.
4. Bygg/signér i Xcode på macOS når Apple-konto er klar.
