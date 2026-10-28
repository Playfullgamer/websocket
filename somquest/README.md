# ⚔️ SomQuest — Het Laatste Rapport

A full story game that lives **inside Somtoday**. Install it and a **⚔️ SomQuest** button appears in the corner of every Somtoday page. Click it, the page glitches out, and you get pulled into the database.

> It's 23:58, the night before report cards. You open Somtoday for one last look at your grades... and something is **eating the database**. With PING the notification bell at your side, you fight through the Rooster, the Huiswerk pile, the Cijfers tab and the pitch-black Afwezigheid records to stop **De Onvoldoende** before every grade in the country turns into a 1,0.

## What's in it

- **5 story chapters** with a cutscene intro, typewriter dialogue, character portraits, system-log lore drops and an ending, plus a report card and credits.
- **6 bosses**, each with its own attack patterns and a phase 2: Het 8ste Uur, Het Werkstuk, Het Gemiddelde, De Verzuimcoördinator, MENTOR.EXE and De Onvoldoende.
- **9 enemy types** built from school stuff: free-period ghosts, late-mark clocks that charge, tests that snipe, homework stacks that split, deadlines that speed up, failing grades, skipping ghosts and notification spam.
- **13 upgrades** ("school supplies"), with 3 to pick from between fights: calculator spread shot, highlighter piercing, stapler fire rate, eraser dash, orbiting compass and more.
- **Bullet-hell arena gameplay** with dashing through bullets, grazing, combos (VOLDOENDE → CUM LAUDE) and the **INLEVEREN** screen-clear.
- **Effects:** particles, screen shake, hit-stop, slow-mo boss deaths, glitch and chromatic effects, lasers, a darkness/flashlight level and CRT scanlines.
- **Sound:** all synthesized live with WebAudio (no audio files). There are SFX for everything and a separate chiptune track for each chapter, the bosses and the ending.
- **Grades:** every chapter gives you a grade (1,0–10,0) based on hits taken, time and retakes, and they all end up on your final rapport.
- **Herkansing:** if you die you can retake the chapter.
- **Toetsweek:** an endless mode you unlock by finishing the story.
- **Chill difficulty** (7 lives, slower bullets), name entry, and progress is saved.

## Controls

| Action | Key |
|---|---|
| Move | `WASD` / arrow keys |
| Aim | mouse |
| Write (shoot) | hold left click |
| Dash (invincible) | `Space` / `Shift` |
| INLEVEREN (screen clear) | `E` / `Q` / right click |
| Pause | `Esc` / `P` |
| Mute | `M` |
| Skip dialogue | `Tab` |
| Open the game from Somtoday | click the button, `Alt+Q`, or the Konami code |

## Install

### Option A: Tampermonkey / Violentmonkey (easiest)
1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension.
2. Open [`dist/somquest.user.js`](dist/somquest.user.js) on GitHub, press **Raw**, and Tampermonkey will offer to install it.
3. Go to Somtoday and click **⚔️ SomQuest** in the bottom-right corner.

### Option B: Chrome / Edge extension
1. Download this repo (Code → Download ZIP) and unzip it.
2. Go to `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
3. Click **Load unpacked** and select the `somquest/extension` folder.
4. Open Somtoday and click the button.

### Option C: play without Somtoday
Open [`demo.html`](demo.html) in your browser. It's a stand-in page with the same launch button.

## Development

The game is plain JavaScript with no dependencies. The source lives in `src/` and gets bundled into one file:

```bash
node build.js
```

That writes `dist/somquest.js` (used by `demo.html`), `dist/somquest.user.js` (the userscript) and `extension/somquest.js`.

| File | What's in it |
|---|---|
| `src/00-util.js` | math helpers, save data, canvas text helpers |
| `src/01-audio.js` | synthesized SFX and the chiptune sequencer |
| `src/02-fx.js` | particles, shake, flash, hit-stop, glitch post-processing |
| `src/03-render.js` | themed backgrounds and the character portraits |
| `src/04-entities.js` | player, upgrades, bullets, lasers, enemies and bosses |
| `src/05-story.js` | all chapters, dialogue and credits |
| `src/06-game.js` | scenes, menus, HUD, cutscenes and the chapter flow |
| `src/07-launcher.js` | the overlay, input, game loop and Somtoday button |

The game runs in its own full-screen overlay. It never reads or changes anything on your Somtoday page, and progress is saved under one `localStorage` key (`somquest.save.v1`).

---

*Fan-made for fun. Not affiliated with Somtoday or Topicus.*
