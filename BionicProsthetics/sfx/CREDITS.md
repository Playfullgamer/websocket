# Sound credits

Every sound in this folder is built from open sound libraries released under
**CC0 1.0 (public domain)**: <https://creativecommons.org/publicdomain/zero/1.0/>.
No attribution is required, but here it is anyway - thank you!

* **Kenney** (<https://kenney.nl>) - sound effects from the official Godot starter kits:
  [FPS](https://github.com/KenneyNL/Starter-Kit-FPS),
  [3D Platformer](https://github.com/KenneyNL/Starter-Kit-3D-Platformer),
  [Racing](https://github.com/KenneyNL/Starter-Kit-Racing) (skid sound by Landeplage, also CC0) and
  [City Builder](https://github.com/KenneyNL/Starter-Kit-City-Builder).
* **uisfx** by Romain Simon (<https://github.com/romainsimon/uisfx>, npm `uisfx` 0.4.0) - the "mechanical" sound set.

| File | Built from |
|---|---|
| attach.wav | uisfx mechanical/connect |
| detach.wav | uisfx mechanical/disconnect |
| grab.wav | uisfx mechanical/lock |
| release.wav | uisfx mechanical/release |
| click.wav | uisfx mechanical/toggle-on |
| plasma_fire.wav | Kenney FPS blaster |
| plasma_hit.wav | Kenney FPS enemy_destroy |
| rocket_ignite.wav | Kenney FPS enemy_destroy, pitched down |
| zap.wav | Kenney FPS enemy_attack |
| spring.wav | Kenney FPS jump_a |
| leap.wav | Kenney FPS jump_c + 3D Platformer break |
| impale.wav | Kenney City Builder placement-c + FPS enemy_hurt |
| boing.wav | Kenney 3D Platformer jump |
| bling.wav | Kenney 3D Platformer coin (twice, the second pitched up) |
| punch.wav | Kenney Racing impact |
| steam.wav | Kenney Racing skid, pitched up |
| drill_loop.wav | Kenney Racing engine-motorcycle, pitched up |
| rocket_loop.wav | Kenney Racing engine + skid, pitched down |

Rebuild them with `python3 tools/make_sfx.py` (needs git, curl, ffmpeg and numpy).
