# ⚔️ SomQuest — Het Laatste Rapport

Een complete verhaalgame die **in Somtoday** draait. Na het installeren staat er op elke Somtoday-pagina rechtsonder een **⚔️ SomQuest**-knop. Klik erop, de pagina glitcht, en je wordt de database in gezogen.

> Het is 23:58, de avond voor de rapporten. Je opent Somtoday nog één keer om naar je cijfers te kijken... en er **eet iets aan de database**. Samen met PING, het meldingsbelletje, vecht je je door het Rooster, de Huiswerk-stapel, het Cijfers-tabblad en de pikdonkere Afwezigheid om **De Onvoldoende** te stoppen, voordat elk cijfer in het land een 1,0 wordt.

## Installeren in Chrome / Edge (uitgepakte extensie)

1. Download deze repo: **Code → Download ZIP**, en pak het zip-bestand uit.
2. Ga naar `chrome://extensions` (of `edge://extensions` in Edge).
3. Zet rechtsboven **Ontwikkelaarsmodus** (Developer mode) aan.
4. Klik op **Uitgepakte extensie laden** (Load unpacked) en kies de map **`somquest/extension`**. Dat is de map waar `manifest.json` in staat.
5. Open of ververs Somtoday. Rechtsonder staat nu de knop **⚔️ SomQuest**. Je kunt de game ook openen met `Alt+Q`.

Na een update van de code: klik bij de extensie in `chrome://extensions` op het ↻-icoontje en ververs Somtoday.

**Zonder Somtoday spelen?** Open [`demo.html`](demo.html) in je browser. Dat is een nagemaakte pagina met dezelfde knop.

<details>
<summary>Liever Tampermonkey?</summary>

Installeer [`dist/somquest.user.js`](dist/somquest.user.js): open het bestand op GitHub en druk op **Raw**.
</details>

## Wat zit erin

- **5 hoofdstukken** met een geanimeerde intro, typemachine-dialogen, portretten van de personages, geheime systeemlogs, een einde, een rapport en aftiteling.
- **6 bazen**, elk met eigen aanvalspatronen en een fase 2: Het 8ste Uur, Het Werkstuk, Het Gemiddelde, De Verzuimcoördinator, MENTOR.EXE en De Onvoldoende.
- **9 soorten vijanden:** tussenuren, te-laatmeldingen die op je af stormen, toetsen die schieten, huiswerkstapels die uit elkaar vallen, deadlines die steeds sneller gaan, onvoldoendes, spijbelspoken en meldingen.
- **13 upgrades** (schoolspullen) om tussen de gevechten uit te kiezen, zoals de grafische rekenmachine, markeerstift, nietmachine, gum en passer.
- **Bullet-hell-gameplay** met dashen door kogels, combo's (van VOLDOENDE tot CUM LAUDE) en **INLEVEREN**, dat het hele scherm leegveegt.
- **Effecten en geluid:** deeltjes, screenshake, slow-motion, glitch-effecten, lasers en een donker level. Alle geluiden en chiptune-muziek worden live gegenereerd, er zitten dus geen audiobestanden in.
- **Cijfers:** elk hoofdstuk levert een cijfer op (1,0 tot 10,0), en die komen samen op je eindrapport.
- **Herkansing:** ga je dood, dan doe je het hoofdstuk opnieuw.
- **Toetsweek:** een eindeloze modus die je vrijspeelt door het verhaal uit te spelen.
- **Opties:** een Chill-moeilijkheid (7 levens, tragere kogels), je eigen naam, en je voortgang wordt opgeslagen.

## Besturing

| Actie | Toets |
|---|---|
| Lopen | `WASD` / pijltjestoetsen |
| Richten | muis |
| Schrijven (schieten) | linkermuisknop ingedrukt houden |
| Dashen (onkwetsbaar) | `Spatie` / `Shift` |
| INLEVEREN (scherm leegvegen) | `E` / `Q` / rechtermuisknop |
| Pauze | `Esc` / `P` |
| Geluid aan/uit | `M` |
| Dialoog overslaan | `Tab` |
| Game openen in Somtoday | de knop, `Alt+Q` of de Konami-code |

## Ontwikkelen

De game is gewoon JavaScript, zonder dependencies. De broncode staat in `src/` en wordt gebundeld met:

```bash
node build.js
```

Dat schrijft `extension/somquest.js` en `extension/manifest.json`, plus `dist/somquest.js` (voor `demo.html`) en `dist/somquest.user.js`.

| Bestand | Inhoud |
|---|---|
| `src/00-util.js` | rekenhulpjes, opslaan, teksthulpjes |
| `src/01-audio.js` | gegenereerde geluidseffecten en de chiptune-sequencer |
| `src/02-fx.js` | deeltjes, shake, flitsen, hit-stop, glitch |
| `src/03-render.js` | achtergronden per thema en de portretten |
| `src/04-entities.js` | speler, upgrades, kogels, lasers, vijanden en bazen |
| `src/05-story.js` | alle hoofdstukken, dialogen en de aftiteling |
| `src/06-game.js` | scènes, menu's, HUD, cutscenes en het verloop van de hoofdstukken |
| `src/07-launcher.js` | overlay, invoer, game-loop en de Somtoday-knop |

De game draait in een eigen schermvullende laag. Hij leest of verandert niets op je Somtoday-pagina, en je voortgang staat in één `localStorage`-sleutel (`somquest.save.v1`).

---

*Fan-made, gewoon voor de lol. Niet officieel verbonden aan Somtoday of Topicus.*
