#!/usr/bin/env python3
"""Generates every sprite, thumbnail and FX texture for the Bionic Prosthetics mod.

Run from the repository root:  python3 tools/make_art.py

All prosthetic sprites are drawn "hanging down" exactly like a People Playground
limb: the socket (attach point) is at the top, the extremity at the bottom and the
front of the wearer faces +X (right).  Art is drawn at 2x game-pixel density; the
mod rescales each prosthetic to match the wearer's real limb length when attached.

Besides PNGs this script also writes BionicProsthetics/SpriteData.cs, which holds the
socket and "tip" pixel coordinates the C# code uses to line things up.
"""
import math
import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "BionicProsthetics")

OUTLINE = (18, 18, 24, 255)

# Palettes: shadow, dark, mid, light, specular
STEEL = [(58, 62, 72), (96, 102, 114), (146, 154, 166), (196, 204, 214), (240, 244, 250)]
CHROME = [(36, 40, 50), (80, 88, 104), (150, 162, 180), (214, 224, 238), (255, 255, 255)]
GUNMETAL = [(24, 26, 33), (42, 46, 56), (66, 72, 86), (100, 108, 124), (148, 158, 174)]
WOOD = [(72, 40, 20), (106, 64, 34), (144, 94, 52), (180, 128, 74), (206, 158, 100)]
LEATHER = [(44, 26, 18), (72, 44, 28), (102, 66, 42), (132, 90, 58), (158, 114, 78)]
BRASS = [(92, 62, 18), (146, 106, 34), (198, 154, 56), (234, 198, 98), (255, 240, 180)]
GOLD = [(104, 66, 10), (166, 116, 18), (224, 174, 38), (250, 214, 88), (255, 250, 210)]
CARBON = [(12, 13, 16), (24, 26, 30), (38, 41, 48), (62, 66, 76), (104, 110, 124)]
WHITE = [(128, 132, 142), (172, 176, 186), (212, 216, 224), (234, 236, 242), (255, 255, 255)]
BEIGE = [(118, 86, 60), (158, 122, 90), (194, 158, 122), (220, 188, 154), (240, 214, 186)]
ORANGE = [(116, 42, 10), (172, 70, 18), (228, 110, 30), (250, 154, 62), (255, 206, 140)]
RED = [(80, 14, 18), (128, 24, 30), (182, 38, 44), (222, 78, 74), (255, 150, 140)]
YELLOW = [(116, 78, 10), (178, 126, 20), (234, 182, 36), (252, 216, 88), (255, 244, 180)]
RUBBER = [(14, 14, 16), (24, 24, 28), (38, 38, 44), (58, 58, 66), (86, 86, 96)]
BLUEPAINT = [(14, 30, 70), (24, 50, 110), (40, 80, 160), (80, 130, 210), (170, 210, 255)]

COPPER = [(86, 38, 20), (136, 64, 34), (190, 102, 56), (228, 148, 94), (255, 208, 168)]
VIOLET = [(70, 34, 150), (120, 74, 226), (176, 136, 255), (222, 204, 255), (250, 246, 255)]
CYAN = [(20, 110, 160), (40, 180, 230), (90, 235, 255), (190, 252, 255), (240, 255, 255)]
GREEN = [(16, 110, 60), (40, 190, 100), (100, 255, 160), (190, 255, 215), (240, 255, 245)]
WARM = [(150, 110, 40), (230, 190, 90), (255, 230, 150), (255, 248, 210), (255, 255, 245)]


def rgba(c, a=255):
    return (c[0], c[1], c[2], a) if len(c) == 3 else c


def shade(pal, t, spec=True):
    """Pick a colour for a cylinder lit from the upper-left; t is 0..1 across it."""
    if t < 0.10:
        return pal[1]
    if t < 0.22:
        return pal[2]
    if t < 0.42:
        if spec and 0.26 <= t < 0.34:
            return pal[4]
        return pal[3]
    if t < 0.66:
        return pal[2]
    if t < 0.86:
        return pal[1]
    return pal[0]


class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.px = self.img.load()

    def put(self, x, y, c, a=255):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = rgba(c, a)

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.px[x, y]
        return (0, 0, 0, 0)

    def opaque(self, x, y):
        return self.get(x, y)[3] > 0

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.put(x, y, c)

    def hspan(self, y, x0, x1, pal, spec=True):
        n = x1 - x0 + 1
        for x in range(x0, x1 + 1):
            self.put(x, y, shade(pal, (x - x0 + 0.5) / n, spec))

    def cyl(self, x0, y0, x1, y1, pal, spec=True):
        for y in range(y0, y1 + 1):
            self.hspan(y, x0, x1, pal, spec)

    def taper(self, y0, y1, cx, w0, w1, pal, spec=True):
        for y in range(y0, y1 + 1):
            t = 0 if y1 == y0 else (y - y0) / (y1 - y0)
            w = w0 + (w1 - w0) * t
            x0 = int(round(cx - w / 2))
            x1 = x0 + max(1, int(round(w))) - 1
            self.hspan(y, x0, x1, pal, spec)

    def band(self, y0, y1, x0, x1, pal, spec=True):
        """A ring/collar: shaded like a cylinder with a lit top edge and dark lower edge."""
        self.cyl(x0, y0, x1, y1, pal, spec)
        for x in range(x0 + 1, x1):
            if y1 > y0:
                c = self.get(x, y0)
                self.put(x, y0, tuple(min(255, v + 34) for v in c[:3]))
                self.put(x, y1, pal[0] if x > x0 + 1 else pal[1])

    def disk(self, cx, cy, r, c, a=255):
        for y in range(int(cy - r - 1), int(cy + r + 2)):
            for x in range(int(cx - r - 1), int(cx + r + 2)):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    self.put(x, y, c, a)

    def shaded_disk(self, cx, cy, r, pal):
        self.disk(cx, cy, r, pal[1])
        self.disk(cx - 0.35 * r, cy - 0.35 * r, r * 0.72, pal[2])
        self.disk(cx - 0.45 * r, cy - 0.45 * r, r * 0.38, pal[3])
        if r >= 2:
            self.put(cx - 0.5 * r, cy - 0.5 * r, pal[4])

    def line(self, x0, y0, x1, y1, c, a=255):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(n + 1):
            t = i / max(1, n)
            self.put(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, c, a)

    def tube(self, pts, r, pal, steps=6):
        """Thick shaded stroke through a polyline (Catmull-Rom smoothed)."""
        path = catmull(pts, steps)
        for x, y in path:
            self.disk(x, y, r, pal[1])
        for x, y in path:
            self.disk(x - 0.45, y - 0.45, max(0.6, r - 0.8), pal[2])
        for x, y in path:
            self.disk(x - 0.9, y - 0.9, max(0.4, r - 1.7), pal[3])
        if r >= 2.2:
            for i, (x, y) in enumerate(path):
                if i % 3 == 0:
                    self.put(x - 1.1, y - 1.1, pal[4])

    def bolt(self, x, y, pal=STEEL):
        self.put(x, y, pal[4])
        self.put(x + 1, y, pal[1])
        self.put(x, y + 1, pal[1])
        self.put(x + 1, y + 1, pal[0])

    def outline(self, color=OUTLINE):
        src = [[self.opaque(x, y) for x in range(self.w)] for y in range(self.h)]
        for y in range(self.h):
            for x in range(self.w):
                if src[y][x]:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < self.w and 0 <= ny < self.h and src[ny][nx]:
                        self.px[x, y] = color
                        break

    def glow(self, cols, radius=2, alpha=70):
        """Soft halo around pixels whose colour is in `cols` (drawn under the outline)."""
        targets = [(x, y) for y in range(self.h) for x in range(self.w) if self.get(x, y)[:3] in cols]
        halo = {}
        for tx, ty in targets:
            for dy in range(-radius, radius + 1):
                for dx in range(-radius, radius + 1):
                    d = math.hypot(dx, dy)
                    if d <= radius:
                        a = alpha * (1 - d / (radius + 1))
                        k = (tx + dx, ty + dy)
                        halo[k] = max(halo.get(k, 0), a)
        col = cols[0]
        for (x, y), a in halo.items():
            if not self.opaque(x, y):
                self.put(x, y, col, int(a))

    def save(self, path):
        self.img.save(path)


def catmull(pts, steps):
    if len(pts) < 3:
        out = []
        (x0, y0), (x1, y1) = pts[0], pts[-1]
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for i in range(n + 1):
            t = i / n
            out.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))
        return out
    p = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        seg = max(steps, int(math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 3))
        for s in range(seg):
            t = s / seg
            t2, t3 = t * t, t * t * t
            out.append(tuple(
                0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2
                       + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3) for k in range(2)))
    out.append(pts[-1])
    return out


# ---------------------------------------------------------------- shared parts

def socket(c, y0, y1, cx, w, pal, strap=LEATHER, buckle=BRASS, strap_row=None):
    """Prosthetic socket: a cup that grips the stump, with a strap and buckle."""
    x0 = int(round(cx - w / 2))
    x1 = x0 + w - 1
    # rim: a lit lip at the top, slightly wider
    c.cyl(x0, y0 + 2, x1, y1, pal)
    c.hspan(y0, x0 + 1, x1 - 1, pal)
    c.hspan(y0 + 1, x0, x1, pal)
    for x in range(x0 + 2, x1 - 1):
        c.put(x, y0, pal[4] if x < x0 + w // 2 else pal[3])
    # inner shadow of the cup mouth
    for x in range(x0 + 2, x1 - 1):
        c.put(x, y0 + 1, pal[0])
    if strap is not None:
        sy = strap_row if strap_row is not None else (y0 + y1) // 2
        c.band(sy, sy + 2, x0 - 1, x1 + 1, strap, spec=False)
        if buckle is not None:
            bx = x0 + w // 2 + 1
            c.rect(bx, sy, bx + 2, sy + 2, buckle[2])
            c.put(bx + 1, sy + 1, buckle[0])
            c.put(bx, sy, buckle[4])


def wood_grain(c, y0, y1, x0, x1, seed=3):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if not c.opaque(x, y):
                continue
            n = (x * 7 + seed) % 5
            if (y + n * 3) % 9 == 0:
                col = c.get(x, y)
                c.put(x, y, tuple(max(0, v - 26) for v in col[:3]))


# ---------------------------------------------------------------- prosthetics
# Each builder returns (canvas, attach_px, tip_px). attach = socket joint point,
# tip = business end (fingers, nozzle, drill point, sole...).

def peg_leg():
    c = Canvas(18, 46)
    cx = 8.5
    socket(c, 1, 13, cx, 14, LEATHER, strap=STEEL, buckle=BRASS, strap_row=9)
    # stitching on the leather cup
    for y in range(3, 9, 2):
        c.put(4, y, LEATHER[4])
        c.put(13, y, LEATHER[0])
    c.band(14, 16, 3, 14, BRASS)  # brass collar
    c.taper(17, 39, cx, 10, 6, WOOD)
    wood_grain(c, 17, 39, 3, 14)
    c.band(26, 27, 4, 13, STEEL)  # iron hoop
    c.bolt(6, 26)
    c.band(40, 44, 5, 11, STEEL)  # iron ferrule tip
    c.hspan(44, 6, 10, RUBBER)
    c.outline()
    return c, (8, 7), (8, 44)


def running_blade():
    c = Canvas(26, 48)
    cx = 8.5
    socket(c, 1, 13, cx, 14, CARBON, strap=BLUEPAINT, buckle=STEEL, strap_row=9)
    for y in range(2, 9, 2):  # carbon weave texture
        for x in range(3, 15, 2):
            if c.opaque(x + (y // 2) % 2, y):
                c.put(x + (y // 2) % 2, y, CARBON[3])
    c.band(14, 17, 4, 13, STEEL)  # titanium adapter
    c.bolt(6, 15)
    c.cyl(6, 18, 11, 21, STEEL)  # short pylon
    # the blade: down, swept back, then forward into a toe pad
    c.tube([(9, 21), (9, 27), (6.5, 33), (6, 38), (8, 42), (13, 43.5), (19, 43.5), (23, 42.5)], 2.4, CARBON)
    # blue racing accent on the blade spine
    for x, y in catmull([(10.5, 23), (10, 28), (8, 33)], 6):
        c.put(x, y, BLUEPAINT[3])
    # rubber tread under the toe
    for x in range(12, 24):
        c.put(x, 45, RUBBER[2])
        c.put(x, 46, RUBBER[1])
    c.outline()
    return c, (8, 7), (17, 46)


def pogo_leg(compressed=False):
    c = Canvas(18, 48)
    cx = 8.5
    socket(c, 1, 11, cx, 14, RED, strap=RUBBER, buckle=STEEL, strap_row=7)
    c.band(12, 14, 2, 15, STEEL)  # top plate
    c.bolt(4, 12)
    c.bolt(12, 12)
    coil_top, coil_bot = 15, (27 if compressed else 35)
    c.cyl(7, coil_top, 10, coil_bot, GUNMETAL)  # inner guide rod
    turns = 5
    span = coil_bot - coil_top
    for i in range(turns):
        ya = coil_top + span * i / turns
        yb = coil_top + span * (i + 1) / turns
        # back half of the coil (dark), front half (bright)
        c.line(3, ya + 1, 14, ya + (yb - ya) * 0.5, STEEL[0])
        c.line(14, ya + (yb - ya) * 0.5, 3, yb + 1, STEEL[2])
        c.line(14, ya + (yb - ya) * 0.5 + 1, 3, yb + 2, STEEL[1])
        c.line(13, ya + (yb - ya) * 0.5 - 0.5, 5, yb - 0.5, STEEL[4])
    yb = coil_bot + 1
    c.band(yb, yb + 2, 2, 15, STEEL)  # bottom plate
    # rubber ball foot
    fy = yb + 3
    c.disk(cx, fy + 3, 5, RED[1])
    c.disk(cx - 1, fy + 2, 4, RED[2])
    c.disk(cx - 2, fy + 1, 2, RED[3])
    c.put(cx - 2.5, fy + 0.5, RED[4])
    c.rect(3, fy - 1, 14, fy, RED[1])
    c.outline()
    tip_y = int(fy + 8)
    return c, (8, 6), (8, min(tip_y, 46))


def medical_leg(outline=True):
    c = Canvas(26, 82)
    cx = 8.5
    # laminated thigh socket, tapering
    c.taper(1, 24, cx, 15, 11, BEIGE)
    c.hspan(1, 2, 15, BEIGE)
    for x in range(3, 14):
        c.put(x, 1, BEIGE[4] if x < 9 else BEIGE[3])
        c.put(x, 2, BEIGE[0])
    c.band(7, 9, 1, 16, BLUEPAINT, spec=False)  # velcro strap
    c.rect(10, 7, 12, 9, WHITE[3])
    c.put(10, 7, WHITE[4])
    c.shaded_disk(5, 16, 1.6, STEEL)  # suction valve
    # knee unit
    c.band(25, 27, 4, 13, STEEL)
    c.cyl(3, 28, 14, 34, GUNMETAL)
    c.shaded_disk(8.5, 31, 2.6, CHROME)
    c.put(8, 31, GUNMETAL[0])
    c.cyl(11, 35, 13, 44, CHROME)  # hydraulic damper
    c.cyl(5, 35, 7, 37, STEEL)
    # pylon tube with clamps
    c.cyl(7, 35, 10, 64, STEEL)
    c.band(38, 40, 5, 12, GUNMETAL)
    c.band(62, 64, 5, 12, GUNMETAL)
    c.bolt(6, 39)
    c.bolt(6, 63)
    # sneaker
    c.cyl(4, 65, 13, 71, WHITE)  # ankle collar / upper
    for y in range(68, 75):
        x1 = 13 + int((y - 68) * 1.6)
        c.hspan(y, 3, min(x1, 23), WHITE, spec=False)
    c.rect(3, 75, 23, 76, RED[2])  # sole stripe
    c.rect(3, 77, 24, 78, RUBBER[2])
    c.rect(4, 79, 24, 79, RUBBER[1])
    for i, x in enumerate(range(9, 20, 3)):  # laces
        c.put(x, 69 + i, RUBBER[3])
        c.put(x + 1, 69 + i, RUBBER[3])
    c.line(6, 72, 18, 74, RED[3])  # side swoosh
    c.line(6, 73, 18, 75, RED[1])
    if outline:
        c.outline()
    return c, (8, 6), (14, 79)


def cyber_leg(outline=True):
    c = Canvas(28, 82)
    cx = 9.5
    # thigh armour
    c.taper(1, 30, cx, 16, 12, GUNMETAL)
    for y in range(2, 30):  # chrome front plate
        t = (y - 2) / 28
        x0 = int(cx - 6 + t * 2)
        c.hspan(y, x0, x0 + 4, CHROME)
    c.hspan(1, 3, 16, CHROME)
    for x in range(3, 17):
        c.put(x, 2, GUNMETAL[0])
    for y in range(6, 28):  # cyan seam
        c.put(int(cx + 2 + (y - 6) * 0.06), y, CYAN[2])
    c.put(cx + 2, 5, CYAN[4])
    for y in (9, 18):
        c.hspan(y, 4, 15, GUNMETAL, spec=False)
        c.put(13, y, CYAN[3])
    c.bolt(14, 4, CHROME)
    c.bolt(13, 25, CHROME)
    # knee core
    c.cyl(4, 31, 15, 38, GUNMETAL)
    c.disk(cx, 34.5, 3.4, CHROME[1])
    c.disk(cx, 34.5, 2.4, CYAN[1])
    c.disk(cx - 0.4, 34.1, 1.4, CYAN[3])
    c.put(cx - 1, 33.5, CYAN[4])
    # shin guard
    c.taper(39, 66, cx, 12, 9, GUNMETAL)
    for y in range(39, 66):
        t = (y - 39) / 27
        x0 = int(cx - 5 + t * 1.5)
        c.hspan(y, x0, x0 + 6, CHROME)
    for y in range(42, 63):  # light strip
        c.put(int(cx + 2), y, CYAN[2] if y % 6 else CYAN[4])
    c.hspan(52, int(cx - 5), int(cx + 4), GUNMETAL, spec=False)
    # armoured boot
    c.cyl(5, 66, 15, 71, GUNMETAL)
    for y in range(70, 77):
        x1 = 15 + int((y - 70) * 1.5)
        c.hspan(y, 3, min(x1, 25), CHROME, spec=(y < 73))
    c.rect(18, 70, 21, 71, CHROME[3])
    c.rect(3, 77, 25, 78, GUNMETAL[1])
    for x in range(4, 25):  # glowing sole
        c.put(x, 79, CYAN[2] if x % 4 else CYAN[4])
    c.glow([CYAN[2], CYAN[4], CYAN[3]], radius=1, alpha=80)
    if outline:
        c.outline()
    return c, (9, 6), (15, 79)


def rocket_leg(outline=True):
    c = Canvas(26, 84)
    cx = 10.5
    socket(c, 1, 13, cx, 15, GUNMETAL, strap=RUBBER, buckle=STEEL, strap_row=9)
    c.taper(14, 34, cx, 14, 12, ORANGE)
    for y in range(17, 22):  # hazard stripes
        for x in range(4, 18):
            if c.opaque(x, y) and ((x + y) // 2) % 2 == 0:
                c.put(x, y, (240, 236, 220) if x < 11 else (200, 196, 182))
    c.shaded_disk(7, 28, 1.8, STEEL)
    c.band(35, 39, 4, 16, STEEL)  # knee ring
    c.bolt(6, 36)
    c.bolt(14, 36)
    c.taper(40, 64, cx, 12, 13, ORANGE)
    c.band(48, 49, 5, 16, RED)
    c.band(51, 52, 5, 16, RED)
    for y in range(42, 47):  # vents
        if y % 2 == 0:
            c.hspan(y, 7, 13, GUNMETAL, spec=False)
    # fins
    for i in range(9):
        c.hspan(56 + i, 1, 4 + i // 3, RED, spec=False)
        c.hspan(56 + i, 17 - i // 3, 20, RED, spec=False)
    c.band(65, 67, 6, 15, STEEL)
    # nozzle bell
    for y in range(68, 81):
        w = 6 + (y - 68) * 0.75
        x0 = int(round(cx - w / 2))
        c.hspan(y, x0, x0 + int(round(w)) - 1, STEEL)
    for x in range(int(cx - 6), int(cx + 6)):  # dark throat & hot rim
        c.put(x, 81, RUBBER[1])
        c.put(x, 80, ORANGE[3] if abs(x - cx) < 4 else STEEL[0])
    if outline:
        c.outline()
    return c, (10, 7), (10, 82)


def hook():
    c = Canvas(20, 42)
    cx = 7.5
    socket(c, 1, 15, cx, 12, LEATHER, strap=LEATHER, buckle=BRASS, strap_row=10)
    for y in range(3, 15, 2):  # stitching
        c.put(cx, y, LEATHER[4])
    c.bolt(3, 4, BRASS)
    c.bolt(11, 4, BRASS)
    c.band(16, 19, 2, 13, BRASS)  # wrist plate
    c.put(4, 17, BRASS[4])
    # steel hook
    c.tube([(7.5, 19), (7.5, 27), (8.5, 32), (11.5, 35), (15, 34), (16.5, 30.5), (16, 27)], 1.9, STEEL)
    # sharpened point
    c.put(16, 25, STEEL[4])
    c.put(16, 24, STEEL[3])
    c.put(15, 26, STEEL[2])
    c.outline()
    return c, (7, 7), (15, 30)


def claw(closed=False):
    c = Canvas(22, 44)
    cx = 9.5
    socket(c, 1, 9, cx, 14, RUBBER, strap=None)
    c.taper(10, 23, cx, 13, 11, RED)  # housing
    c.cyl(4, 11, 5, 22, CHROME)  # piston rods
    c.cyl(14, 11, 15, 22, CHROME)
    for y in (13, 18):
        c.hspan(y, 6, 13, RED, spec=False)
        c.put(7, y, RED[4])
    c.shaded_disk(cx, 16, 1.5, STEEL)
    c.band(24, 27, 4, 15, STEEL)  # wrist rotator
    c.bolt(6, 25)
    c.bolt(13, 25)
    c.cyl(6, 28, 13, 30, GUNMETAL)  # palm block
    if closed:
        left = [(7, 30), (6, 34), (7, 38), (9, 40)]
        right = [(12, 30), (13, 34), (12, 38), (10, 40)]
    else:
        left = [(7, 30), (4, 33), (2.5, 37), (4, 41)]
        right = [(12, 30), (15, 33), (16.5, 37), (15, 41)]
    c.tube(left, 1.6, STEEL)
    c.tube(right, 1.6, STEEL)
    c.put(left[-1][0], left[-1][1], RED[3])
    c.put(right[-1][0], right[-1][1], RED[3])
    c.outline()
    return c, (9, 5), (9, 38)


def medical_arm(outline=True):
    c = Canvas(20, 76)
    cx = 8.5
    # shoulder cap and harness
    c.taper(1, 12, cx, 13, 14, BEIGE)
    c.hspan(1, 3, 13, BEIGE)
    for x in range(3, 14):
        c.put(x, 1, BEIGE[4] if x < 8 else BEIGE[3])
    c.band(5, 7, 1, 16, RUBBER, spec=False)
    c.rect(11, 5, 13, 7, STEEL[3])
    # upper arm shell
    c.taper(13, 30, cx, 12, 11, WHITE)
    c.hspan(20, 3, 13, WHITE, spec=False)
    # elbow
    c.cyl(3, 31, 14, 37, GUNMETAL)
    c.shaded_disk(cx, 34, 2.4, STEEL)
    c.put(cx, 34, GUNMETAL[0])
    # forearm shell with myo-sensor band
    c.taper(38, 58, cx, 11, 9, WHITE)
    c.band(44, 46, 3, 13, BLUEPAINT)
    c.put(6, 45, CYAN[3])
    c.put(10, 45, CYAN[3])
    c.band(56, 58, 4, 13, GUNMETAL)  # wrist rotator
    # robotic hand: palm, curled fingers, thumb forward
    c.cyl(4, 59, 13, 66, WHITE)
    for i, fx in enumerate((5, 7, 9, 11)):
        ln = 6 if i in (1, 2) else 5
        c.cyl(fx, 66, fx + 1, 66 + ln, WHITE, spec=False)
        c.put(fx, 66 + ln // 2, GUNMETAL[2])
        c.put(fx + 1, 66 + ln // 2, GUNMETAL[1])
    c.tube([(13, 61), (15, 64), (15.5, 67)], 1.2, WHITE)  # thumb
    if outline:
        c.outline()
    return c, (8, 5), (8, 71)


def cyber_arm(outline=True):
    c = Canvas(22, 78)
    cx = 9.5
    # chrome pauldron with reactor core
    for y in range(1, 15):
        w = 15 - abs(y - 7) * 0.4
        x0 = int(round(cx - w / 2))
        c.hspan(y, x0, x0 + int(round(w)) - 1, CHROME)
    c.disk(cx, 7.5, 3.2, GUNMETAL[0])
    c.disk(cx, 7.5, 2.3, CYAN[1])
    c.disk(cx - 0.5, 7, 1.2, CYAN[3])
    c.put(cx - 1, 6.5, CYAN[4])
    # synthetic muscle upper arm
    c.taper(15, 31, cx, 11, 10, CARBON)
    for y in range(15, 32):
        for x in range(4, 16):
            if c.opaque(x, y) and (x + y // 3) % 3 == 0:
                c.put(x, y, CARBON[3])
    c.cyl(int(cx - 5), 18, int(cx - 2), 28, CHROME)  # bicep plate
    c.bolt(int(cx - 4), 19, CHROME)
    # glowing elbow ring
    c.cyl(4, 32, 15, 37, GUNMETAL)
    c.hspan(34, 4, 15, CYAN, spec=False)
    c.hspan(35, 5, 14, CYAN[0:1] * 5, spec=False)
    # chrome forearm with light strips
    c.taper(38, 60, cx, 11, 10, CHROME)
    for y in range(40, 59):
        c.put(int(cx + 3), y, CYAN[2] if y % 5 else CYAN[4])
    c.hspan(48, int(cx - 5), int(cx + 4), GUNMETAL, spec=False)
    c.hspan(49, int(cx - 5), int(cx + 4), GUNMETAL, spec=False)
    # armoured fist with glowing knuckles
    c.cyl(4, 61, 15, 70, GUNMETAL)
    c.cyl(5, 61, 14, 64, CHROME)
    for x in range(5, 15, 3):
        c.put(x, 70, CYAN[3])
        c.put(x + 1, 70, CYAN[2])
    c.hspan(67, 5, 14, CARBON, spec=False)
    c.cyl(15, 63, 16, 67, CHROME)  # thumb
    c.glow([CYAN[2], CYAN[3], CYAN[4]], radius=1, alpha=80)
    if outline:
        c.outline()
    return c, (9, 7), (9, 70)


def plasma_cannon():
    c = Canvas(20, 46)
    cx = 8.5
    socket(c, 1, 10, cx, 14, GUNMETAL, strap=RUBBER, buckle=STEEL, strap_row=7)
    c.cyl(2, 11, 15, 33, GUNMETAL)  # cannon body
    for y in range(12, 33):
        c.put(3, y, GUNMETAL[3])
    for i, y in enumerate((14, 20, 26)):  # energy coils
        c.hspan(y, 2, 15, GREEN, spec=False)
        c.hspan(y + 1, 2, 15, [GREEN[0]] * 5, spec=False)
        c.put(4, y, GREEN[4])
    for y in range(29, 33):  # hazard stripe
        for x in range(2, 16):
            if ((x + y) // 2) % 2 == 0:
                c.put(x, y, YELLOW[2] if x < 9 else YELLOW[1])
    c.bolt(12, 17)
    c.bolt(12, 23)
    # muzzle
    c.taper(34, 41, cx, 12, 10, STEEL)
    c.band(42, 43, 4, 13, GUNMETAL)
    for x in range(5, 13):
        c.put(x, 44, GREEN[2] if 6 < x < 11 else GREEN[1])
    c.put(8, 44, GREEN[4])
    c.glow([GREEN[2], GREEN[4]], radius=1, alpha=90)
    c.outline()
    return c, (8, 5), (8, 44)


def drill_arm(frame=0):
    c = Canvas(20, 48)
    cx = 8.5
    socket(c, 1, 8, cx, 14, RUBBER, strap=None)
    c.cyl(2, 9, 15, 23, YELLOW)  # motor housing
    for y in range(11, 18, 2):  # cooling vents
        c.hspan(y, 4, 13, RUBBER, spec=False)
    for y in range(19, 23):
        for x in range(2, 16):
            if ((x - y) // 2) % 2 == 0:
                c.put(x, y, RUBBER[2])
    c.bolt(3, 10)
    c.bolt(13, 10)
    c.band(24, 27, 4, 13, CHROME)  # chuck
    c.put(6, 25, CHROME[4])
    # drill bit cone with animated spiral flutes
    top, bot = 28, 46
    for y in range(top, bot + 1):
        w = 11 * (1 - (y - top) / (bot - top + 1)) + 1
        x0 = int(round(cx - w / 2))
        x1 = x0 + max(1, int(round(w))) - 1
        c.hspan(y, x0, x1, STEEL)
        for x in range(x0, x1 + 1):
            if (x * 2 + y + frame * 2) % 6 in (0, 1):
                c.put(x, y, STEEL[0] if x > cx else STEEL[1])
    c.outline()
    return c, (8, 4), (8, 46)


def flashlight_hand():
    c = Canvas(18, 44)
    cx = 7.5
    socket(c, 1, 10, cx, 12, RUBBER, strap=RUBBER, buckle=STEEL, strap_row=7)
    c.cyl(3, 11, 12, 28, RUBBER)  # grip
    for y in range(12, 28, 2):  # knurling
        for x in range(4, 12, 2):
            c.put(x + (y // 2) % 2, y, RUBBER[3])
    c.rect(10, 16, 12, 19, ORANGE[2])  # power button
    c.put(10, 16, ORANGE[4])
    c.band(29, 30, 3, 12, STEEL)
    # aluminium head flaring out
    for y in range(31, 40):
        w = 10 + (y - 31) * 0.55
        x0 = int(round(cx - w / 2))
        c.hspan(y, x0, x0 + int(round(w)) - 1, STEEL)
    for y in range(33, 38, 2):
        c.hspan(y, 4, 11, STEEL[0:1] * 5, spec=False)
    c.hspan(40, 2, 13, CHROME)
    for x in range(3, 13):
        c.put(x, 41, WARM[2] if 4 < x < 11 else WARM[1])
    c.put(6, 41, WARM[4])
    c.outline()
    return c, (7, 5), (7, 41)


def golden_hand():
    c = Canvas(20, 44)
    cx = 8.5
    socket(c, 1, 12, cx, 13, RED, strap=GOLD, buckle=None, strap_row=8)
    c.shaded_disk(cx, 9.5, 1.6, BLUEPAINT)  # sapphire on the strap
    c.taper(13, 27, cx, 11, 9, GOLD)  # forearm
    for y in range(15, 26, 3):  # engraved filigree
        c.put(5 + (y % 2), y, GOLD[0])
        c.put(11 - (y % 2), y + 1, GOLD[1])
    c.band(28, 30, 3, 13, GOLD)  # jewelled bracelet
    c.put(6, 29, RED[3])
    c.put(10, 29, (120, 230, 170))
    # elegant open hand: palm, long fingers, thumb forward
    c.cyl(4, 31, 13, 36, GOLD)
    for i, fx in enumerate((4, 6, 8, 10)):
        ln = (5, 7, 7, 6)[i]
        c.cyl(fx, 37, fx + 1, 37 + ln, GOLD, spec=False)
    c.put(10, 39, (240, 240, 255))  # diamond ring
    c.put(11, 39, (180, 200, 255))
    c.tube([(13, 33), (15, 36), (15.5, 39)], 1.1, GOLD)
    c.outline()
    return c, (8, 6), (8, 42)


# ---------------------------------------------------------------- more full arms
# Drawn whole with the elbow centred at y=34, then cut in two by split_limb.

def arm_dome(c, cx, pal, y0=1, y1=13, w=15):
    for y in range(y0, y1 + 1):
        ww = w - abs(y - (y0 + y1) / 2) * 0.45
        x0 = int(round(cx - ww / 2))
        c.hspan(y, x0, x0 + int(round(ww)) - 1, pal)


def steampunk_arm(outline=True):
    c = Canvas(22, 80)
    cx = 9.5
    arm_dome(c, cx, COPPER)  # riveted copper pauldron
    for x in range(4, 16, 3):
        c.bolt(x, 11, BRASS)
    c.bolt(6, 3, BRASS)
    c.bolt(12, 3, BRASS)
    c.taper(14, 31, cx, 11, 10, BRASS)  # brass upper arm
    c.band(16, 17, 4, 15, COPPER)
    c.band(28, 29, 4, 15, COPPER)
    c.disk(cx - 0.5, 22.5, 3.4, BRASS[0])  # pressure gauge
    c.disk(cx - 0.5, 22.5, 2.5, (236, 228, 205))
    c.line(cx - 0.5, 22.5, cx + 1.3, 21, RED[2])
    c.put(cx - 0.5, 22.5, RUBBER[1])
    c.cyl(4, 31, 15, 37, BRASS)
    c.taper(38, 58, cx, 10, 9, GUNMETAL)  # iron forearm core
    c.cyl(3, 39, 4, 55, CHROME)  # twin pistons
    c.cyl(14, 39, 15, 55, CHROME)
    c.band(39, 41, 3, 15, BRASS)
    c.band(54, 56, 3, 15, BRASS)
    c.tube([(7.5, 43), (10.5, 46), (7.5, 49), (10.5, 52)], 1.0, COPPER)  # steam pipe
    c.band(57, 59, 4, 15, COPPER)
    c.put(15, 58, (235, 235, 235))  # vent
    c.cyl(4, 60, 14, 66, BRASS)  # mechanical hand
    for i, fx in enumerate((4, 6, 8, 10)):
        ln = (6, 7, 7, 6)[i]
        c.cyl(fx, 67, fx + 1, 66 + ln, BRASS, spec=False)
        c.put(fx, 69, BRASS[0])
        c.put(fx + 1, 69, BRASS[0])
    c.tube([(14, 62), (16, 65), (16.5, 68)], 1.1, BRASS)
    if outline:
        c.outline()
    return c, (9, 7), (9, 73)


def tesla_arm(outline=True):
    c = Canvas(24, 80)
    cx = 10.5
    arm_dome(c, cx, GUNMETAL)
    for y in (4, 7, 10):  # ceramic insulator ribs
        c.hspan(y, int(cx - 5), int(cx + 5), WHITE, spec=False)
    c.taper(14, 31, cx, 12, 11, GUNMETAL)  # iron upper arm wound in copper
    for y in range(16, 30):
        if y % 2 == 0:
            c.hspan(y, int(cx - 6), int(cx + 5), COPPER)
        else:
            c.hspan(y, int(cx - 6), int(cx + 5), [COPPER[0]] * 5, spec=False)
    c.cyl(4, 31, 16, 37, GUNMETAL)
    c.cyl(int(cx - 3), 38, int(cx + 2), 61, GUNMETAL)  # forearm rod
    for y in range(41, 57):  # wider copper coil
        pal = COPPER if y % 2 == 0 else [COPPER[0]] * 5
        c.hspan(y, int(cx - 5), int(cx + 4), pal, spec=(y % 2 == 0))
    c.band(38, 40, 3, 17, WHITE)  # insulators
    c.band(57, 59, 3, 17, WHITE)
    c.band(60, 61, 6, 14, GUNMETAL)
    c.disk(cx, 67, 5.2, CHROME[1])  # tesla orb
    c.disk(cx - 0.6, 66.4, 3.8, CHROME[2])
    c.disk(cx - 1.4, 65.4, 1.8, CHROME[3])
    c.put(cx - 2, 64.8, CHROME[4])
    arcs = [(cx - 6, 63), (cx - 7, 64), (cx + 6, 66), (cx + 7, 65), (cx + 7, 64), (cx - 5, 71),
            (cx - 6, 72), (cx + 4, 72), (cx + 5, 73), (cx, 73.5)]
    for i, (x, y) in enumerate(arcs):
        c.put(x, y, VIOLET[3] if i % 2 else VIOLET[4])
    c.glow([VIOLET[3], VIOLET[4]], radius=1, alpha=110)
    if outline:
        c.outline()
    return c, (10, 7), (10, 72)


def loader_arm(closed=False, outline=True):
    c = Canvas(24, 82)
    cx = 10.5
    c.cyl(3, 1, 18, 11, RUBBER)  # mounting block
    c.hspan(1, 3, 18, YELLOW)
    c.hspan(2, 3, 18, YELLOW)
    c.bolt(5, 6)
    c.bolt(15, 6)
    c.cyl(4, 12, 16, 31, YELLOW)  # upper arm
    for y in range(25, 31):
        for x in range(4, 17):
            if ((x + y) // 2) % 2 == 0:
                c.put(x, y, RUBBER[2])
    c.cyl(16, 14, 18, 20, STEEL)  # hydraulic ram
    c.cyl(17, 20, 18, 30, CHROME)
    c.cyl(4, 31, 16, 37, YELLOW)
    c.cyl(5, 38, 15, 57, YELLOW)  # forearm
    for y in range(41, 50, 2):
        c.hspan(y, 7, 13, RUBBER, spec=False)
    c.cyl(2, 39, 4, 45, STEEL)
    c.cyl(3, 45, 4, 56, CHROME)
    c.band(57, 60, 5, 15, STEEL)  # wrist
    c.bolt(7, 58)
    c.bolt(13, 58)
    if closed:
        left = [(8, 61), (6.5, 66), (7.5, 72), (10, 77)]
        right = [(13, 61), (14.5, 66), (13.5, 72), (11, 77)]
    else:
        left = [(8, 61), (4.5, 65), (3, 71), (5, 77)]
        right = [(13, 61), (16.5, 65), (18, 71), (16, 77)]
    c.tube(left, 2.0, STEEL)
    c.tube(right, 2.0, STEEL)
    for pt in (left[-1], right[-1]):
        c.put(pt[0], pt[1], RED[3])
        c.put(pt[0], pt[1] + 1, RED[2])
    if outline:
        c.outline()
    return c, (10, 6), (10, 73)


def heavy_cannon_arm(outline=True):
    c = Canvas(24, 82)
    cx = 10.5
    arm_dome(c, cx, GUNMETAL, w=16)  # armoured pauldron with an energy cell
    c.rect(int(cx - 2), 4, int(cx + 2), 9, GREEN[1])
    c.rect(int(cx - 1), 5, int(cx + 1), 8, GREEN[2])
    c.put(cx - 1, 5, GREEN[4])
    c.taper(14, 31, cx, 12, 11, CARBON)  # upper arm
    c.cyl(int(cx - 5), 16, int(cx - 1), 29, GUNMETAL)
    for y in range(16, 30):
        c.put(int(cx + 3), y, GREEN[2] if y % 4 else GREEN[4])
    c.cyl(4, 31, 16, 37, GUNMETAL)
    c.cyl(3, 38, 18, 61, GUNMETAL)  # cannon barrel
    for x in range(4, 18):
        c.put(x, 38, GUNMETAL[3])
    for y in range(44, 58, 2):  # heat-sink fins
        c.put(2, y, STEEL[2])
        c.put(19, y, STEEL[1])
    for y in (42, 48, 54):  # energy coils
        c.hspan(y, 3, 18, GREEN, spec=False)
        c.hspan(y + 1, 3, 18, [GREEN[0]] * 5, spec=False)
        c.put(5, y, GREEN[4])
    for y in range(58, 62):
        for x in range(3, 19):
            if ((x + y) // 2) % 2 == 0:
                c.put(x, y, YELLOW[2] if x < 11 else YELLOW[1])
    c.taper(62, 72, cx, 14, 11, STEEL)  # muzzle
    c.band(73, 74, 5, 16, GUNMETAL)
    for x in range(6, 16):
        c.put(x, 75, GREEN[2] if 7 < x < 14 else GREEN[1])
    c.put(10, 75, GREEN[4])
    c.glow([GREEN[2], GREEN[4]], radius=1, alpha=90)
    if outline:
        c.outline()
    return c, (10, 7), (10, 75)


def pirate_arm(outline=True):
    c = Canvas(24, 80)
    cx = 9.5
    arm_dome(c, cx, LEATHER, y1=12, w=14)  # leather harness
    c.band(8, 10, 2, 17, LEATHER, spec=False)
    c.rect(11, 8, 13, 10, BRASS[2])
    c.put(11, 8, BRASS[4])
    c.taper(13, 31, cx, 11, 10, WOOD)  # carved oak
    wood_grain(c, 13, 31, 3, 15)
    c.band(16, 17, 4, 15, STEEL)
    c.band(27, 28, 4, 15, STEEL)
    c.bolt(6, 16)
    c.bolt(6, 27)
    c.cyl(4, 31, 15, 37, WOOD)
    c.taper(38, 56, cx, 10, 9, WOOD)
    wood_grain(c, 38, 56, 3, 15, seed=5)
    for y in range(49, 56):  # leather wrap
        c.hspan(y, 5, 14, LEATHER, spec=(y % 2 == 0))
    c.band(57, 59, 4, 15, BRASS)
    c.tube([(9.5, 59), (9.5, 66), (10.5, 71), (13.5, 74), (17, 73), (18.5, 69.5), (18, 66)], 2.0, STEEL)
    c.put(18, 64, STEEL[4])
    c.put(18, 63, STEEL[3])
    c.put(17, 65, STEEL[2])
    if outline:
        c.outline()
    return c, (9, 6), (16, 69)


def hinge_brass(c, cx, cy):
    c.disk(cx, cy, ELBOW_RADIUS, BRASS[0])
    c.disk(cx - 0.4, cy - 0.4, ELBOW_RADIUS - 1, BRASS[2])
    c.disk(cx, cy, 2.8, COPPER[1])
    c.shaded_disk(cx, cy, 1.6, COPPER)


def hinge_tesla(c, cx, cy):
    c.disk(cx, cy, ELBOW_RADIUS, GUNMETAL[0])
    c.disk(cx - 0.4, cy - 0.4, ELBOW_RADIUS - 1, COPPER[2])
    c.shaded_disk(cx, cy, 2.4, WHITE)


def hinge_loader(c, cx, cy):
    c.disk(cx, cy, ELBOW_RADIUS, STEEL[0])
    c.disk(cx - 0.4, cy - 0.4, ELBOW_RADIUS - 1, STEEL[2])
    c.shaded_disk(cx, cy, 2.8, YELLOW)
    c.put(cx, cy, RUBBER[1])


def hinge_heavy(c, cx, cy):
    c.disk(cx, cy, ELBOW_RADIUS, GUNMETAL[0])
    c.disk(cx - 0.4, cy - 0.4, ELBOW_RADIUS - 1, GUNMETAL[2])
    c.disk(cx, cy, 2.6, GREEN[1])
    c.disk(cx - 0.4, cy - 0.4, 1.5, GREEN[3])


def hinge_wood(c, cx, cy):
    c.disk(cx, cy, ELBOW_RADIUS, WOOD[0])
    c.disk(cx - 0.4, cy - 0.4, ELBOW_RADIUS - 1, WOOD[2])
    c.disk(cx - 1.2, cy - 1.2, 1.6, WOOD[3])
    c.shaded_disk(cx, cy, 1.8, STEEL)


# ---------------------------------------------------------------- two-piece limbs

ELBOW_RADIUS = 5.6


def hinge_medical(c, cx, cy):
    c.disk(cx, cy, ELBOW_RADIUS, GUNMETAL[1])
    c.disk(cx - 0.5, cy - 0.5, ELBOW_RADIUS - 1.2, GUNMETAL[2])
    c.shaded_disk(cx, cy, 2.6, STEEL)
    c.put(cx, cy, GUNMETAL[0])


def hinge_cyber(c, cx, cy):
    c.disk(cx, cy, ELBOW_RADIUS, GUNMETAL[0])
    c.disk(cx - 0.4, cy - 0.4, ELBOW_RADIUS - 1, CHROME[1])
    c.disk(cx, cy, 3.4, CYAN[1])
    c.disk(cx - 0.4, cy - 0.4, 2.2, CYAN[3])
    c.put(cx - 1, cy - 1, CYAN[4])


def hinge_rocket(c, cx, cy):
    c.disk(cx, cy, ELBOW_RADIUS, STEEL[0])
    c.disk(cx - 0.4, cy - 0.4, ELBOW_RADIUS - 1, STEEL[2])
    c.disk(cx, cy, 2.6, ORANGE[1])
    c.disk(cx - 0.4, cy - 0.4, 1.6, ORANGE[3])
    for a in range(0, 360, 90):
        c.put(cx + 3.6 * math.cos(math.radians(a + 45)), cy + 3.6 * math.sin(math.radians(a + 45)), STEEL[4])


def split_limb(builder, pivot, hinge):
    """Cuts a full arm/leg at the elbow/knee into an upper and a lower piece that meet in a round hinge.

    Both pieces are rounded around the pivot so the lower piece can swing without a gap, and it
    carries the hinge cap (it is drawn on top of the upper piece in game).
    """
    c, attach, tip = builder(outline=False)
    px, py = pivot
    r2 = ELBOW_RADIUS ** 2
    upper = Canvas(c.w, int(py + ELBOW_RADIUS) + 3)
    top = int(py - ELBOW_RADIUS) - 2
    lower = Canvas(c.w, c.h - top)
    for y in range(c.h):
        for x in range(c.w):
            col = c.get(x, y)
            if col[3] == 0:
                continue
            inside = (x - px) ** 2 + (y - py) ** 2 <= r2
            if y <= py or inside:
                upper.put(x, y, col[:3], col[3])
            if y >= py or inside:
                lower.put(x, y - top, col[:3], col[3])
    hinge(lower, px, py - top)
    # Stand-alone upper piece (modular upper arm / thigh): same art, capped with the hinge as a socket.
    mount = Canvas(upper.w, upper.h)
    mount.img.paste(upper.img)
    mount.px = mount.img.load()
    hinge(mount, px, py)
    upper.outline()
    lower.outline()
    mount.outline()
    return upper, lower, top, attach, (tip[0], tip[1] - top), mount


def bent_preview(upper, lower, top, pivot, angle):
    """Upper + lower piece bent at the joint (positive = counter-clockwise), for thumbnails and the banner."""
    pad = 24
    img = Image.new("RGBA", (upper.w + pad * 2, lower.h + top + pad * 2), (0, 0, 0, 0))
    fore = Image.new("RGBA", img.size, (0, 0, 0, 0))
    fore.alpha_composite(lower.img, (pad, pad + top))
    fore = fore.rotate(angle, resample=Image.NEAREST, center=(pad + pivot[0] + 0.5, pad + pivot[1] + 0.5))
    img.alpha_composite(upper.img, (pad, pad))
    img.alpha_composite(fore)
    return img.crop(img.getbbox())


def category_icon(img, size=64):
    """White silhouette icon for the spawn-menu category, matching the game's monochrome icons."""
    icon = thumbnail(img, size)
    px = icon.load()
    for y in range(icon.height):
        for x in range(icon.width):
            r, g, b, a = px[x, y]
            if a:
                lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255
                v = int(200 + 55 * min(1.0, lum * 1.6))
                px[x, y] = (v, v, v, a)
    return icon


# ---------------------------------------------------------------- fx textures

def fx_textures(out):
    def soft(name, size, inner, outer, hard=False):
        c = Canvas(size, size)
        r = size / 2
        for y in range(size):
            for x in range(size):
                d = math.hypot(x + 0.5 - r, y + 0.5 - r) / r
                if d <= 1:
                    a = 255 if hard else int(255 * (1 - d) ** 0.8)
                    col = tuple(int(inner[k] + (outer[k] - inner[k]) * d) for k in range(3))
                    c.put(x, y, col, a)
        c.save(os.path.join(out, name))

    soft("spark.png", 4, (255, 255, 255), (255, 255, 255), hard=True)
    soft("glow.png", 12, (255, 255, 255), (255, 255, 255))
    soft("puff.png", 8, (255, 255, 255), (220, 220, 220))
    # plasma bolt: white-hot core, green shell
    c = Canvas(12, 12)
    c.disk(5.5, 5.5, 5.2, GREEN[1], 140)
    c.disk(5.5, 5.5, 4, GREEN[2])
    c.disk(5.5, 5.5, 2.5, GREEN[3])
    c.disk(5, 5, 1.4, GREEN[4])
    c.save(os.path.join(out, "plasma.png"))
    # shockwave ring
    c = Canvas(24, 24)
    for y in range(24):
        for x in range(24):
            d = math.hypot(x + 0.5 - 12, y + 0.5 - 12)
            if 8.5 <= d <= 11.5:
                c.put(x, y, (255, 255, 255), int(255 * (1 - abs(d - 10) / 1.6)))
    c.save(os.path.join(out, "ring.png"))
    # flashlight beam cone, pointing down, apex at the top
    w, h = 40, 72
    c = Canvas(w, h)
    for y in range(h):
        half = 2 + (w / 2 - 2) * (y / h)
        for x in range(w):
            dx = abs(x + 0.5 - w / 2)
            if dx <= half:
                edge = 1 - dx / half
                a = int(120 * (1 - y / h) ** 1.3 * min(1, edge * 2.5))
                if a > 0:
                    c.put(x, y, (255, 240, 190), a)
    c.save(os.path.join(out, "beam.png"))


# ---------------------------------------------------------------- previews

def thumbnail(img, size=64):
    """Menu icon: prosthetic tilted 35 degrees, crisp nearest-neighbour upscale."""
    big = img.resize((img.width * 4, img.height * 4), Image.NEAREST)
    rot = big.rotate(-35, resample=Image.NEAREST, expand=True)
    bbox = rot.getbbox()
    rot = rot.crop(bbox)
    s = (size - 4) / max(rot.width, rot.height)
    rot = rot.resize((max(1, int(rot.width * s)), max(1, int(rot.height * s))), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(rot, ((size - rot.width) // 2, (size - rot.height) // 2), rot)
    return out


FONT = {  # 5x7 pixel font for the mod banner
    "B": ["1110", "1001", "1001", "1110", "1001", "1001", "1110"],
    "I": ["111", "010", "010", "010", "010", "010", "111"],
    "O": ["0110", "1001", "1001", "1001", "1001", "1001", "0110"],
    "N": ["1001", "1101", "1101", "1011", "1011", "1001", "1001"],
    "C": ["0111", "1000", "1000", "1000", "1000", "1000", "0111"],
    "P": ["1110", "1001", "1001", "1110", "1000", "1000", "1000"],
    "R": ["1110", "1001", "1001", "1110", "1010", "1001", "1001"],
    "S": ["0111", "1000", "1000", "0110", "0001", "0001", "1110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "H": ["1001", "1001", "1001", "1111", "1001", "1001", "1001"],
    "E": ["1111", "1000", "1000", "1110", "1000", "1000", "1111"],
    " ": ["00", "00", "00", "00", "00", "00", "00"],
}


def draw_text(img, text, x, y, scale, col, shadow=(10, 12, 20, 255)):
    px = img.load()
    for dx_off, dy_off, colour in ((scale // 2 or 1, scale // 2 or 1, shadow), (0, 0, col)):
        cx = x
        for ch in text:
            g = FONT[ch]
            for gy, row in enumerate(g):
                for gx, bit in enumerate(row):
                    if bit == "1":
                        for sy in range(scale):
                            for sx in range(scale):
                                X = cx + gx * scale + sx + dx_off
                                Y = y + gy * scale + sy + dy_off
                                if 0 <= X < img.width and 0 <= Y < img.height:
                                    if colour is col:
                                        t = gy / 6
                                        c2 = tuple(int(col[k] * (1 - 0.35 * t)) for k in range(3)) + (255,)
                                        px[X, Y] = c2
                                    else:
                                        px[X, Y] = colour
            cx += (len(g[0]) + 1) * scale


def text_width(text, scale):
    return sum((len(FONT[ch][0]) + 1) * scale for ch in text) - scale


def banner(sprites, out):
    W, H = 512, 288
    img = Image.new("RGBA", (W, H), (0, 0, 0, 255))
    px = img.load()
    for y in range(H):  # dark lab gradient with blueprint grid
        for x in range(W):
            t = y / H
            base = (int(18 + 14 * t), int(24 + 18 * t), int(40 + 22 * t))
            if x % 16 == 0 or y % 16 == 0:
                base = (base[0] + 10, base[1] + 18, base[2] + 30)
            px[x, y] = base + (255,)
    order = ["cyber_arm", "plasma_cannon", "steampunk_arm", "running_blade", "rocket_leg",
             "drill_arm_0", "tesla_arm", "claw_open", "golden_hand", "cyber_leg"]
    bigs = []
    for name in order:
        s = sprites[name]
        sc = min(3 if s.height <= 50 else 2, 138 / s.height)  # keep clear of the subtitle
        bigs.append(s.resize((int(s.width * sc), int(s.height * sc)), Image.NEAREST))
    gap = (W - 16 - sum(b.width for b in bigs)) / (len(bigs) - 1)
    x = 8.0
    for big in bigs:
        img.alpha_composite(big, (int(x), H - 22 - big.height))
        x += big.width + gap
    title = "BIONIC"
    sub = "PROSTHETICS"
    draw_text(img, title, (W - text_width(title, 9)) // 2, 22, 9, (120, 240, 255))
    draw_text(img, sub, (W - text_width(sub, 4)) // 2, 94, 4, (235, 240, 250))
    img.convert("RGB").save(out)


# Full limbs whose upper half is also sold on its own, with a socket for any forearm / lower leg.
MODULAR_UPPERS = ("medical_arm", "cyber_arm", "steampunk_arm", "pirate_arm", "medical_leg", "cyber_leg", "rocket_leg")


def main():
    sp = os.path.join(ROOT, "sprites")
    th = os.path.join(ROOT, "thumbs")
    fx = os.path.join(ROOT, "fx")
    for d in (sp, th, fx):
        os.makedirs(d, exist_ok=True)

    builders = {
        "peg_leg": peg_leg,
        "running_blade": running_blade,
        "pogo_leg": lambda: pogo_leg(False),
        "pogo_leg_squash": lambda: pogo_leg(True),
        "hook": hook,
        "claw_open": lambda: claw(False),
        "claw_closed": lambda: claw(True),
        "plasma_cannon": plasma_cannon,
        "drill_arm_0": lambda: drill_arm(0),
        "drill_arm_1": lambda: drill_arm(1),
        "drill_arm_2": lambda: drill_arm(2),
        "flashlight_hand": flashlight_hand,
        "golden_hand": golden_hand,
    }
    sprites, meta = {}, {}
    for name, fn in builders.items():
        c, attach, tip = fn()
        c.save(os.path.join(sp, name + ".png"))
        sprites[name] = c.img
        meta[name] = (c.w, c.h, attach, tip)
        if not any(name.endswith(s) for s in ("_squash", "_closed", "_1", "_2")):
            thumbnail(c.img).save(os.path.join(th, name.replace("_0", "").replace("_open", "") + ".png"))
    # Full arms and legs come in two pieces joined at the elbow / knee.
    arm_lines = []
    for name, fn, pivot, hinge, bend in (("medical_arm", medical_arm, (8.5, 34.0), hinge_medical, 32),
                                         ("cyber_arm", cyber_arm, (9.5, 34.5), hinge_cyber, 32),
                                         ("medical_leg", medical_leg, (8.5, 31.0), hinge_medical, -28),
                                         ("cyber_leg", cyber_leg, (9.5, 34.5), hinge_cyber, -28),
                                         ("rocket_leg", rocket_leg, (10.5, 37.0), hinge_rocket, -28),
                                         ("steampunk_arm", steampunk_arm, (9.5, 34.0), hinge_brass, 32),
                                         ("tesla_arm", tesla_arm, (10.5, 34.0), hinge_tesla, 32),
                                         ("loader_arm", lambda outline: loader_arm(False, outline), (10.5, 34.0), hinge_loader, 32),
                                         ("heavy_cannon_arm", heavy_cannon_arm, (10.5, 34.0), hinge_heavy, 32),
                                         ("pirate_arm", pirate_arm, (9.5, 34.0), hinge_wood, 32)):
        upper, lower, top, attach, tip, mount = split_limb(fn, pivot, hinge)
        upper.save(os.path.join(sp, name + "_upper.png"))
        lower.save(os.path.join(sp, name + "_lower.png"))
        preview = bent_preview(upper, lower, top, pivot, bend)
        sprites[name] = preview
        thumbnail(preview).save(os.path.join(th, name + ".png"))
        if name in MODULAR_UPPERS:
            mount.save(os.path.join(sp, name + "_mount.png"))
            thumbnail(mount.img).save(os.path.join(th, name + "_mount.png"))
        ident = "".join(p.capitalize() for p in name.split("_"))
        arm_lines += [
            f"        public static readonly Vector2 {ident}Attach = new Vector2({attach[0]}f, {attach[1]}f);",
            f"        public static readonly Vector2 {ident}Joint = new Vector2({pivot[0]}f, {pivot[1]}f);",
            f"        public static readonly Vector2 {ident}LowerJoint = new Vector2({pivot[0]}f, {pivot[1] - top}f);",
            f"        public static readonly Vector2 {ident}Tip = new Vector2({tip[0]}f, {tip[1]}f);",
        ]
        meta[name + "_upper"] = (upper.w, upper.h, attach, pivot)
        meta[name + "_lower"] = (lower.w, lower.h, (pivot[0], pivot[1] - top), tip)
    # The loader claw also needs a closed forearm for its grab animation.
    _, closed_lower, _, _, _, _ = split_limb(lambda outline: loader_arm(True, outline), (10.5, 34.0), hinge_loader)
    closed_lower.save(os.path.join(sp, "loader_arm_lower_closed.png"))
    category_icon(sprites["cyber_arm"]).save(os.path.join(ROOT, "category.png"))
    fx_textures(fx)
    banner(sprites, os.path.join(ROOT, "thumb.png"))

    # C# side: socket/tip pixel coordinates (from the top-left of each texture)
    lines = [
        "// <auto-generated> by tools/make_art.py - do not edit by hand. </auto-generated>",
        "using UnityEngine;",
        "",
        "namespace BionicProsthetics",
        "{",
        "    public static class SpriteData",
        "    {",
    ]
    for name, (w, h, a, t) in meta.items():
        if any(name.endswith(s) for s in ("_squash", "_closed", "_1", "_2", "_upper", "_lower")):
            continue
        key = name.replace("_0", "").replace("_open", "")
        ident = "".join(p.capitalize() for p in key.split("_"))
        lines.append(f"        public static readonly Vector2 {ident}Attach = new Vector2({a[0]}f, {a[1]}f);")
        lines.append(f"        public static readonly Vector2 {ident}Tip = new Vector2({t[0]}f, {t[1]}f);")
    lines += arm_lines
    lines += ["    }", "}", ""]
    with open(os.path.join(ROOT, "SpriteData.cs"), "w") as f:
        f.write("\n".join(lines))
    print("sprites:", ", ".join(f"{k} {v[0]}x{v[1]}" for k, v in meta.items()))


if __name__ == "__main__":
    main()
