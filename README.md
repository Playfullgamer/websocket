# Core Defender VR

A neon synthwave **base-defense shooter for Meta Quest 2** (and any WebXR headset), built with Three.js + WebXR.
It is one `index.html` file. It needs no install, no build step, and no sideloading: it runs in the Quest Browser.

You stand on a tower under a shielded energy core. Waves of drones dive at it from all directions.
Dual-wield blasters, chain kills for combo multipliers, and unleash a NOVA shockwave when things get hairy.

## Gameplay

| Control (Quest) | Action |
|---|---|
| **Trigger** | Fire blaster in that hand (hold for auto-fire). Starts / restarts the game. |
| **Grip** | NOVA shockwave: wipes out everything near the base when the meter is full |

Enemies:
- **Drone** (red): basic diver
- **Tank** (orange): slow, armored, hits hard (wave 2+)
- **Zipper** (purple): fast and zig-zags (wave 3+)
- **Sentinel** (green): hovers at range and fires **red orbs at your head**. Shoot the orbs or physically dodge them (wave 4+)
- **Mothership** (every 5th wave): boss that circles in, spawning drones

Other features: the attack arc widens each wave until enemies come from all 360°. A radar on the HUD shows where they are.
You also get combo multipliers up to x8, core repair between waves, a saved high score, controller haptics, synthesized SFX and music, and a stationary, comfortable play space.

**Desktop (for testing):** click to start and lock the mouse, move to aim, hold left click to fire, right click / Space for NOVA.

## Playing on Quest 2

WebXR needs the page served over **HTTPS** (or `localhost`). The easiest way:

1. Push this repo to GitHub and enable **Settings → Pages → Deploy from branch** (pick the branch, `/ (root)`).
2. On the Quest, open the **Browser**, go to `https://<your-user>.github.io/<repo>/`.
3. Press **ENTER VR**.

Other options:
- Any static HTTPS host works (Netlify, Vercel, Cloudflare Pages…). Just upload `index.html`.
- Local dev with a USB cable: run `python3 -m http.server 8080` here, then `adb reverse tcp:8080 tcp:8080`,
  and open `http://localhost:8080` in the Quest Browser.

Three.js is loaded from the unpkg CDN, so the headset needs internet access.
