#!/usr/bin/env python3
"""Builds every sound effect for the Bionic Prosthetics mod from open, CC0 sound libraries.

Run from the repository root:  python3 tools/make_sfx.py
Needs git, curl, ffmpeg and numpy. Sources are downloaded into a cache folder on first run.

Sources (all CC0 1.0 / public domain - see BionicProsthetics/sfx/CREDITS.md):
  * Kenney starter kits (https://github.com/KenneyNL) - FPS, 3D Platformer, Racing, City Builder
  * uisfx (https://github.com/romainsimon/uisfx, npm package "uisfx") - "mechanical" sound set

Each mod sound is one recording, or a short mix of two, trimmed, pitched, normalised and saved as
22.05 kHz mono 16-bit WAV (the format People Playground's ModAPI.LoadSound loads most reliably).
"""
import os
import subprocess
import tarfile
import tempfile
import wave

import numpy as np

RATE = 22050
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "BionicProsthetics", "sfx")
CACHE = os.path.join(tempfile.gettempdir(), "bionic-prosthetics-sfx-sources")

KENNEY_KITS = {
    "fps": "starter-kit-fps",
    "platformer": "starter-kit-3d-platformer",
    "racing": "starter-kit-racing",
    "city": "starter-kit-city-builder",
}
UISFX_VERSION = "0.4.0"

# name -> (layers, options). A layer is (source, path, settings); source is a Kenney kit key or "uisfx".
# Layer settings: pitch (1 = original, >1 higher/faster), gain, trim (seconds kept), delay (seconds).
SOUNDS = {
    "attach.wav": ([("uisfx", "mechanical/connect.ogg", {})], {}),
    "detach.wav": ([("uisfx", "mechanical/disconnect.ogg", {})], {}),
    "plasma_fire.wav": ([("fps", "sounds/blaster.ogg", {"trim": 0.6})], {"fade": 0.25}),
    "plasma_hit.wav": ([("fps", "sounds/enemy_destroy.ogg", {})], {}),
    "punch.wav": ([("racing", "audio/impact.ogg", {})], {}),
    "boing.wav": ([("platformer", "sounds/jump.ogg", {"pitch": 0.85})], {}),
    "spring.wav": ([("fps", "sounds/jump_a.ogg", {})], {}),
    "leap.wav": ([("fps", "sounds/jump_c.ogg", {}),
                  ("platformer", "sounds/break.ogg", {"delay": 0.12, "pitch": 0.8})], {}),
    "grab.wav": ([("uisfx", "mechanical/lock.ogg", {})], {}),
    "release.wav": ([("uisfx", "mechanical/release.ogg", {})], {}),
    "click.wav": ([("uisfx", "mechanical/toggle-on.ogg", {})], {"peak": 0.5}),
    "bling.wav": ([("platformer", "sounds/coin.ogg", {}),
                   ("platformer", "sounds/coin.ogg", {"delay": 0.11, "pitch": 1.26, "gain": 0.7})], {"peak": 0.5}),
    "drill_loop.wav": ([("racing", "audio/engine-motorcycle.ogg", {"pitch": 1.8, "trim": 3.0})], {"loop": True, "peak": 0.55}),
    "rocket_loop.wav": ([("racing", "audio/engine.ogg", {"pitch": 0.6, "trim": 3.0}),
                         ("racing", "audio/skid.ogg", {"pitch": 0.55, "trim": 3.0, "gain": 0.8})], {"loop": True, "peak": 0.6}),
    "rocket_ignite.wav": ([("fps", "sounds/enemy_destroy.ogg", {"pitch": 0.75, "trim": 0.9})], {"fade": 0.3}),
    "steam.wav": ([("racing", "audio/skid.ogg", {"pitch": 1.2, "trim": 0.9})], {"fade": 0.45, "peak": 0.6}),
    "zap.wav": ([("fps", "sounds/enemy_attack.ogg", {})], {"peak": 0.6}),
    "impale.wav": ([("city", "sounds/placement-c.ogg", {"pitch": 0.8}),
                    ("fps", "sounds/enemy_hurt.ogg", {"delay": 0.02})], {"peak": 0.65}),
}


def fetch_sources():
    os.makedirs(CACHE, exist_ok=True)
    roots = {}
    for key, repo in KENNEY_KITS.items():
        path = os.path.join(CACHE, repo)
        if not os.path.isdir(os.path.join(path, ".git")):
            subprocess.run(["git", "clone", "-q", "--depth", "1", "https://github.com/KenneyNL/" + repo, path],
                           check=True, env=dict(os.environ, GIT_LFS_SKIP_SMUDGE="1"))
        roots[key] = path
    uisfx = os.path.join(CACHE, "uisfx")
    if not os.path.isdir(os.path.join(uisfx, "package", "sounds")):
        os.makedirs(uisfx, exist_ok=True)
        tgz = os.path.join(uisfx, "uisfx.tgz")
        subprocess.run(["curl", "-sSfL", "-o", tgz,
                        "https://registry.npmjs.org/uisfx/-/uisfx-%s.tgz" % UISFX_VERSION], check=True)
        with tarfile.open(tgz) as t:
            members = [m for m in t.getmembers() if m.name.startswith("package/") and ".." not in m.name]
            try:
                t.extractall(uisfx, members=members, filter="data")
            except TypeError:  # Python older than 3.12: no extraction filters
                t.extractall(uisfx, members=members)
    roots["uisfx"] = os.path.join(uisfx, "package", "sounds")
    return roots


def decode(path):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", path, "-f", "s16le", "-ac", "1", "-ar", str(RATE), "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype="<i2").astype(float) / 32768.0


def repitch(x, factor):
    """Resample so it plays `factor` times faster (and higher)."""
    if factor == 1:
        return x
    n = max(1, int(len(x) / factor))
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x)


def layer(roots, source, path, settings):
    x = repitch(decode(os.path.join(roots[source], path)), settings.get("pitch", 1.0))
    if "trim" in settings:
        x = x[: int(RATE * settings["trim"])]
    x = x * settings.get("gain", 1.0)
    return np.concatenate([np.zeros(int(RATE * settings.get("delay", 0.0))), x])


def save(name, x, peak=0.7, loop=False, fade=0.0):
    x = x.copy()
    if loop:  # crossfade the tail into the head so it loops seamlessly
        n = int(RATE * 0.12)
        ramp = np.linspace(0, 1, n)
        x[:n] = x[:n] * ramp + x[-n:] * (1 - ramp)
        x = x[:-n]
    else:
        tail = max(int(RATE * fade), int(RATE * 0.01))
        tail = min(tail, len(x))
        x[-tail:] *= np.linspace(1, 0, tail)
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    with wave.open(os.path.join(OUT, name), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes((x * 32767).astype("<i2").tobytes())


def main():
    os.makedirs(OUT, exist_ok=True)
    roots = fetch_sources()
    for name, (layers, options) in SOUNDS.items():
        parts = [layer(roots, *spec) for spec in layers]
        mix = np.zeros(max(len(p) for p in parts))
        for p in parts:
            mix[: len(p)] += p
        save(name, mix, peak=options.get("peak", 0.7), loop=options.get("loop", False), fade=options.get("fade", 0.0))
        print("%-18s %.2fs  from %s" % (name, len(mix) / RATE, " + ".join(s[0] + ":" + s[1] for s in layers)))


if __name__ == "__main__":
    main()
