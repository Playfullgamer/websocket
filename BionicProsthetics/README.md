# Bionic Prosthetics — a People Playground mod

![banner](thumb.png)

Lost a limb? Not a problem. This mod adds **26 prosthetics** with custom art that snap onto
stumps, resize themselves to fit the wearer, and move within the range of a real limb.
Most of them do something when you activate them.

## Installing

Copy this whole `BionicProsthetics` folder into your People Playground `Mods` folder
(`<Steam>/steamapps/common/People Playground/Mods/`), start the game and turn the mod on.
The prosthetics get their own **Prosthetics** tab in the spawn menu (if the game ever refuses the custom tab, they fall back to **Misc.**).

## How to fit one

1. Take a limb off someone. Slicing works, and so does anything else that separates it at the joint.
2. Drag the prosthetic onto the **stump**:

| Type | Replaces | Touch it to |
|---|---|---|
| Forearm | lower arm + hand | the **upper arm** |
| Full arm | the whole arm | the **chest** |
| Lower leg | lower leg + foot | the **upper leg** |
| Full leg | the whole leg | the **hips** |
| Modular upper arm | the upper arm | the **chest**, then plug any forearm into its elbow |
| Modular thigh | the upper leg | the **hips**, then plug any lower leg into its knee |

It clicks into place with a servo sound. It is sized by measuring the wearer's healthy limb joint to joint
(hip, knee, ankle down to the sole; shoulder, elbow, fingertips), so feet reach the floor exactly like the real foot.
If there is no healthy limb to copy (say both legs are gone), it uses the person's own body size instead: a normal
human's limb-to-torso proportions, read from the game's Human, scaled to this person's torso. It is
and drawn in the right layer: front arms over the body and legs, back arms behind everything. The wearer's own body won't
collide with it. If you touch the wrong body part of someone it would fit, a hint tells you where it goes.

* **Activate** (F) to use its ability.
* Right-click → **Detach prosthetic** to take it off.
* **Modular builds:** a missing arm doesn't have to get a ready-made full arm. Fit a *Modular Upper Arm*, then
  touch any forearm prosthetic (hook, claw, plasma cannon, drill, flashlight, golden hand) to its elbow socket.
  Thighs work the same with peg legs, running blades and pogo springs. You can also assemble the pieces on the
  floor first and then fit the whole thing. Detaching an upper piece keeps whatever is plugged into it.
* **Full arms and full legs have two joints** (shoulder + elbow, hip + knee), so they bend like real limbs.
  Lying loose on the floor the lower half flops freely, but elbows only bend forward and knees only bend back.
* Worn arms move on their own. They hold a relaxed pose (hanging, elbow slightly bent) with a gentle motor, so
  you can grab and pose them freely, and moving one arm never drags the other along. On full arms you can grab
  the forearm itself, too.
* Worn legs hold the hip and knee straight, with enough torque to bear the wearer's weight. A hard hit
  can buckle the knee, and it springs straight again afterwards.

## The prosthetics

| | Name | Slot | Ability |
|---|---|---|---|
| ![](thumbs/peg_leg.png) | Pirate Peg Leg | lower leg | — (stiff oak peg, arr) |
| ![](thumbs/running_blade.png) | Carbon Running Blade | lower leg | spring jump |
| ![](thumbs/pogo_leg.png) | Pogo Spring Leg | lower leg | squash-and-stretch BOING jump |
| ![](thumbs/medical_leg.png) | Medical Prosthetic Leg | full leg | — (working hydraulic knee, fresh sneakers) |
| ![](thumbs/cyber_leg.png) | Cyber Leg MK-II | full leg | hydraulic leap + shockwave; glowing reactor knee joint |
| ![](thumbs/rocket_leg.png) | Rocket Leg | full leg | toggle thruster (with flame, smoke and a light); jointed knee |
| ![](thumbs/hook.png) | Pirate Hook | forearm | hook onto objects *or walls* to hang from them; activate again to let go |
| ![](thumbs/claw.png) | Hydraulic Claw | forearm | clamp onto things (open/closed animation) |
| ![](thumbs/medical_arm.png) | Medical Prosthetic Arm | full arm | — (jointed elbow, robotic hand) |
| ![](thumbs/cyber_arm.png) | Cyber Arm MK-II | full arm | powered elbow; rocket punch that sends people flying and can break bones |
| ![](thumbs/plasma_cannon.png) | Plasma Arm Cannon | forearm | fires glowing plasma bolts |
| ![](thumbs/drill_arm.png) | Drill Arm | forearm | toggle a spinning drill (animated, sparks, grinds and shoves) |
| ![](thumbs/flashlight_hand.png) | Flashlight Hand | forearm | toggle a light with a visible beam |
| ![](thumbs/golden_hand.png) | 24K Golden Hand | forearm | glints all the time; activate for a shower of sparkles |
| ![](thumbs/steampunk_arm.png) | Steampunk Arm | full arm | vents a scalding blast of steam |
| ![](thumbs/tesla_arm.png) | Tesla Arm | full arm | chain lightning that arcs through up to 4 things |
| ![](thumbs/loader_arm.png) | Loader Claw Arm | full arm | big hydraulic claw: clamp onto objects or walls |
| ![](thumbs/heavy_cannon_arm.png) | Heavy Plasma Arm | full arm | fires huge plasma bolts |
| ![](thumbs/pirate_arm.png) | Pirate Arm | full arm | carved oak arm with a hook: hook on / let go |
| ![](thumbs/medical_arm_mount.png) | Modular Upper Arm (Medical / Cyber / Steampunk / Pirate) | upper arm | takes any forearm prosthetic |
| ![](thumbs/medical_leg_mount.png) | Modular Thigh (Medical / Cyber / Rocket) | upper leg | takes any lower-leg prosthetic |

## Files

```
mod.json                 mod manifest
Main.cs                  registers the 26 items
ProstheticBehaviour.cs   stump detection, fitting, sizing, servo joints, jointed elbows/knees, modular mounting
Abilities.cs             activation abilities (jump, grab, cannon, punch, drill, rocket, light, bling, steam, lightning)
FX.cs                    asset loading + lightweight particle/shockwave/blast helpers
SpriteData.cs            socket/tip pixel coordinates (generated)
sprites/ thumbs/ fx/     pixel art (full limbs are split into _upper / _lower pieces; _mount = stand-alone upper)
category.png             spawn-menu tab icon
sfx/                     sound effects
```

All art and sound is generated by code, so you can tweak and rebuild it. From the repository root:

```
python3 tools/make_art.py   # sprites, thumbnails, fx textures, banner, SpriteData.cs (needs Pillow)
python3 tools/make_sfx.py   # sound effects (needs numpy)
```
