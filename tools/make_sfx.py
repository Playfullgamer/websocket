#!/usr/bin/env python3
"""Synthesises every sound effect for the Bionic Prosthetics mod (no samples needed).

Run from the repository root:  python3 tools/make_sfx.py
"""
import os
import wave

import numpy as np

RATE = 22050
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "BionicProsthetics", "sfx")
rng = np.random.default_rng(7)


def t_axis(sec):
    return np.arange(int(RATE * sec)) / RATE


def env(sec, attack=0.005, decay=8.0):
    t = t_axis(sec)
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    return a * np.exp(-t * decay)


def noise(sec):
    return rng.uniform(-1, 1, int(RATE * sec))


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / RATE)
    y = np.zeros_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def sweep(f0, f1, sec, shape=np.sin, curve=1.0):
    t = t_axis(sec)
    f = f0 + (f1 - f0) * (t / sec) ** curve
    phase = 2 * np.pi * np.cumsum(f) / RATE
    return shape(phase)


def saw(phase):
    return 2 * ((phase / (2 * np.pi)) % 1) - 1


def square(phase):
    return np.sign(np.sin(phase))


def mix(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[: len(p)] += p
    return out


def pad(x, sec_before):
    return np.concatenate([np.zeros(int(RATE * sec_before)), x])


def save(name, x, peak=0.7, loop=False):
    if loop:  # crossfade the tail into the head so it loops seamlessly
        n = int(RATE * 0.08)
        fade = np.linspace(0, 1, n)
        x = x.copy()
        x[:n] = x[:n] * fade + x[-n:] * (1 - fade)
        x = x[:-n]
    else:
        fade = min(len(x), int(RATE * 0.01))
        x = x.copy()
        x[-fade:] *= np.linspace(1, 0, fade)
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    data = (x * 32767).astype("<i2").tobytes()
    with wave.open(os.path.join(OUT, name), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(data)


def clunk(sec=0.18, freq=90):
    """Heavy mechanical impact."""
    body = np.sin(2 * np.pi * freq * t_axis(sec)) * env(sec, 0.001, 30)
    click = highpass(noise(0.02), 2000) * env(0.02, 0.0005, 200)
    return mix(body, click * 0.8, lowpass(noise(sec), 900) * env(sec, 0.001, 45) * 0.7)


def servo(f0, f1, sec):
    whine = sweep(f0, f1, sec, saw) * 0.35 + sweep(f0 * 2, f1 * 2, sec) * 0.2
    gear = square(2 * np.pi * np.cumsum(np.full(int(RATE * sec), 55.0)) / RATE) * 0.12
    e = np.minimum(1, np.minimum(t_axis(sec) / 0.03, (sec - t_axis(sec)) / 0.05))
    return lowpass(whine + gear, 3500) * e


def main():
    os.makedirs(OUT, exist_ok=True)

    # attach: servo spins up, then the socket locks with a clunk
    save("attach.wav", mix(servo(300, 900, 0.22), pad(clunk(0.25, 80), 0.2), pad(clunk(0.12, 160) * 0.5, 0.29)))
    # detach: release hiss + descending servo
    hiss = highpass(noise(0.3), 3000) * env(0.3, 0.005, 9) * 0.5
    save("detach.wav", mix(clunk(0.12, 120) * 0.6, pad(servo(800, 250, 0.25), 0.05), hiss))

    # plasma shot: falling FM zap with a charged hum
    t = t_axis(0.35)
    zap = np.sin(2 * np.pi * np.cumsum(1400 * np.exp(-t * 9) + 180 + 120 * np.sin(2 * np.pi * 40 * t)) / RATE)
    save("plasma_fire.wav", mix(zap * env(0.35, 0.002, 7), highpass(noise(0.08), 4000) * env(0.08, 0.001, 50) * 0.4))
    # plasma impact: crackling burst with a deep thump
    crackle = highpass(noise(0.45), 1500) * env(0.45, 0.001, 9) * (rng.uniform(0, 1, int(RATE * 0.45)) > 0.6)
    save("plasma_hit.wav", mix(sweep(140, 40, 0.4) * env(0.4, 0.001, 9), crackle * 0.6,
                               lowpass(noise(0.4), 1200) * env(0.4, 0.001, 10) * 0.6))

    # power punch: whoosh into a huge bassy impact
    whoosh = lowpass(highpass(noise(0.15), 600), 3000) * np.sin(np.linspace(0, np.pi, int(RATE * 0.15))) * 0.6
    save("punch.wav", mix(whoosh, pad(clunk(0.4, 55), 0.12), pad(sweep(400, 60, 0.3) * env(0.3, 0.001, 14) * 0.6, 0.12)))

    # boing: wobbling rising tone
    t = t_axis(0.6)
    f = 160 + 260 * (1 - np.exp(-t * 10)) + 40 * np.sin(2 * np.pi * 11 * t) * np.exp(-t * 3)
    save("boing.wav", mix(np.sin(2 * np.pi * np.cumsum(f) / RATE) * env(0.6, 0.004, 4.5), clunk(0.1, 100) * 0.3))
    # blade spring: quick springy twang + whoosh
    t = t_axis(0.3)
    twang = np.sin(2 * np.pi * np.cumsum(520 + 380 * np.exp(-t * 18)) / RATE) * env(0.3, 0.001, 12)
    save("spring.wav", mix(twang, lowpass(highpass(noise(0.25), 800), 4000) * env(0.25, 0.05, 10) * 0.5))
    # cyber leap: charge-up whine into a shockwave stomp
    save("leap.wav", mix(sweep(200, 1600, 0.18, saw) * 0.25 * np.linspace(0.2, 1, int(RATE * 0.18)),
                         pad(clunk(0.45, 50), 0.17), pad(sweep(900, 80, 0.35) * env(0.35, 0.001, 10) * 0.5, 0.17)))

    # grab: hydraulic clamp, ringing metal
    t = t_axis(0.5)
    ring = sum(np.sin(2 * np.pi * f * t) * a for f, a in ((1230, 0.3), (1870, 0.2), (2950, 0.12))) * env(0.5, 0.001, 9)
    save("grab.wav", mix(servo(600, 1100, 0.08), pad(clunk(0.15, 140), 0.07), pad(ring, 0.07)))
    save("release.wav", mix(highpass(noise(0.2), 2500) * env(0.2, 0.002, 18) * 0.5, servo(1000, 500, 0.12)))

    # loops: drill and rocket (1 second, seamless)
    t = t_axis(1.08)
    motor = saw(2 * np.pi * 120 * t) * 0.5 + saw(2 * np.pi * 241 * t) * 0.3 + np.sin(2 * np.pi * 60 * t) * 0.4
    grind = highpass(noise(1.08), 1800) * (0.6 + 0.4 * np.sin(2 * np.pi * 30 * t)) * 0.35
    save("drill_loop.wav", lowpass(motor, 4000) + grind, peak=0.55, loop=True)
    roar = lowpass(noise(1.08), 500) * 1.6 + lowpass(highpass(noise(1.08), 900), 5000) * 0.6
    save("rocket_loop.wav", roar * (0.85 + 0.15 * np.sin(2 * np.pi * 7 * t)), peak=0.6, loop=True)
    save("rocket_ignite.wav", mix(lowpass(noise(0.4), 1500) * env(0.4, 0.002, 6), clunk(0.2, 70)))

    # flashlight click and golden "cha-ching" sparkle
    save("click.wav", mix(highpass(noise(0.015), 3000) * env(0.015, 0.0005, 300),
                          pad(highpass(noise(0.012), 2500) * env(0.012, 0.0005, 300) * 0.7, 0.06)), peak=0.5)
    t = t_axis(0.8)
    bells = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, d in ((2093, 5), (2637, 6), (3136, 7), (4186, 8)))
    save("bling.wav", mix(clunk(0.08, 300) * 0.4, pad(bells * 0.5, 0.05), pad(bells * 0.35, 0.16)), peak=0.5)


if __name__ == "__main__":
    main()
