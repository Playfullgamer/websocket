# SomQuest in de Chrome Web Store zetten

Alles wat de store vraagt staat in deze map. Je hoeft alleen nog een ontwikkelaarsaccount te maken en de bestanden te uploaden.

| Bestand | Waar je het voor gebruikt |
|---|---|
| `SomQuest-webstore.zip` | het pakket dat je uploadt (`manifest.json` staat bovenin, zoals de store wil) |
| `screenshot-1.png` t/m `screenshot-5.png` | screenshots, 1280×800 |
| `promo-klein-440x280.png` | kleine promotietegel (verplicht) |
| `promo-groot-1400x560.png` | grote marquee-afbeelding (optioneel) |
| `../extension/icon128.png` | store-icoon, 128×128 |

## Stap 1: ontwikkelaarsaccount maken (eenmalig)

1. Ga naar de [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) en log in met je Google-account.
2. Ga akkoord met de ontwikkelaarsovereenkomst en betaal de eenmalige registratiekosten (5 dollar).
3. Zet tweestapsverificatie aan op je Google-account. Zonder tweestapsverificatie kun je niets publiceren.

> Google rekent af via Google Payments, en daarvoor moet je meestal 18 jaar of ouder zijn. Ben je jonger? Laat dan een ouder het account aanmaken.

## Stap 2: uploaden

1. Klik in het dashboard op **Nieuw item** (New item) en kies `SomQuest-webstore.zip`.
2. Vul de tabbladen hieronder in en klik op **Ter beoordeling indienen** (Submit for review).
3. Google keurt de extensie meestal binnen een paar dagen goed of af. Je krijgt daar een mail over.

Wil je dat alleen mensen met de link de extensie kunnen vinden? Kies dan bij **Zichtbaarheid** voor **Niet vermeld** (Unlisted).

## Tabblad "Winkelvermelding" (Store listing)

**Naam** (komt uit het manifest): `SomQuest — Het Laatste Rapport`

**Korte beschrijving** (komt uit het manifest): `Een complete verhaalgame-mod voor Somtoday: 5 hoofdstukken, bazen, lore, geluid en effecten.`

**Categorie:** Leuk (Fun) of Games
**Taal:** Nederlands

**Uitgebreide beschrijving:**

```
Het is 23:58, de avond voor de rapporten. Je opent Somtoday nog één keer om naar je cijfers te kijken... en er eet iets aan de database.

SomQuest is een complete verhaalgame die in Somtoday draait. Na het installeren staat er rechtsonder op elke Somtoday-pagina een ⚔️ SomQuest-knop (of druk op Alt+Q). Klik erop, de pagina glitcht, en je wordt de database in gezogen.

Samen met PING, het meldingsbelletje, vecht je je door het Rooster, de Huiswerk-stapel, het Cijfers-tabblad en de pikdonkere Afwezigheid om De Onvoldoende te stoppen, voordat elk cijfer in het land een 1,0 wordt.

WAT ZIT ERIN
• 5 hoofdstukken met een geanimeerde intro, dialogen, personages en een einde
• 6 bazen met eigen aanvallen: Het 8ste Uur, Het Werkstuk, Het Gemiddelde, De Verzuimcoördinator, MENTOR.EXE en De Onvoldoende
• 13 upgrades (schoolspullen) zoals de grafische rekenmachine, het spiekbriefje en de kantinekoffie
• Bullet-hell-gevechten met dashen, combo's (van VOLDOENDE tot CUM LAUDE) en INLEVEREN
• Een cijfer per hoofdstuk en een eindrapport
• Herkansing als je doodgaat, en de eindeloze Toetsweek-modus
• Live gegenereerde chiptune-muziek en geluidseffecten
• Chill-moeilijkheid met meer levens

BESTURING
WASD lopen · muis richten · klik vasthouden om te schieten · spatie dashen · E inleveren · Esc pauze

PRIVACY
SomQuest leest of verandert niets op je Somtoday-pagina en verstuurt geen gegevens. Je voortgang wordt alleen lokaal in je browser opgeslagen.

Fan-made, gewoon voor de lol. Niet officieel verbonden aan Somtoday of Topicus.
```

**Afbeeldingen:** upload `screenshot-1.png` t/m `screenshot-5.png`, `promo-klein-440x280.png` en eventueel `promo-groot-1400x560.png`.

## Tabblad "Privacypraktijken" (Privacy practices)

**Beschrijving van het enige doel** (Single purpose):

```
Voegt een knop toe aan Somtoday-pagina's waarmee je een verhaalgame opent die in een schermvullende laag over de pagina wordt afgespeeld.
```

**Rechtvaardiging voor hostrechten** (Host permission justification, voor `https://*.somtoday.nl/*`):

```
Het contentscript is nodig om op Somtoday-pagina's de startknop en de game-laag te tonen. Het leest geen gegevens van de pagina en verstuurt niets.
```

**Gebruik je externe code (remote code)?** Nee. Alle code zit in het pakket.

**Gegevensgebruik:** vink niets aan bij het verzamelen van gegevens, want de extensie verzamelt niets. Vink wel de drie verklaringen onderaan aan (geen verkoop aan derden, geen gebruik voor andere doelen, geen kredietbeoordeling).

**Privacybeleid-URL:** niet nodig, omdat er geen gebruikersgegevens worden verzameld.

## Een nieuwe versie uploaden

1. Verhoog het versienummer in `build.js` (bijvoorbeeld `1.0.0` naar `1.0.1`). De store weigert een upload met hetzelfde nummer.
2. Draai `node build.js` in de map `somquest`.
3. Maak een nieuwe zip van de inhoud van de map `extension`, niet van de map zelf.
4. Upload de zip in het dashboard via **Pakket** (Package), en dien hem opnieuw in.

## Goed om te weten

- **Naam en logo:** de naam gebruikt het woord "Somtoday" niet en er zit geen logo van Somtoday in, alleen een eigen belletje. Dat helpt bij de beoordeling. Somtoday (Topicus) kan wel bezwaar maken tegen extensies voor hun site. Gebeurt dat, dan kan Google de extensie offline halen.
- **School-Chromebooks:** op een Chromebook of browser die door school wordt beheerd, kan het installeren van extensies geblokkeerd zijn.
