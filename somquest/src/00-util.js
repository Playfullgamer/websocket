// ───────────────────────────── core helpers ─────────────────────────────
const W = 960, H = 540;
const AX = 20, AY = 62, AR = 940, AB = 522; // arena bounds
const TAU = Math.PI * 2;
const FONT = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const MONO = 'Consolas, "Courier New", monospace';

let canvas = null, ctx = null;

const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const angTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
const fmtGrade = g => (Math.round(g * 10) / 10).toFixed(1).replace('.', ',');
const gradeColor = g => (g >= 5.5 ? '#2fbf71' : '#e5484d');

const ease = {
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: t => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
};

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// distance from point to segment
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

// deterministic rng for generated music/backgrounds
function seeded(seed) {
  let s = 0;
  for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) | 0;
  return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 0) % 100000) / 100000; };
}

// ───────────────────────────── save data ─────────────────────────────
const SAVE_KEY = 'somquest.save.v1';
const Save = {
  data: {},
  load() {
    try { this.data = JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { this.data = {}; }
    const d = this.data;
    if (typeof d.name !== 'string' || !d.name) d.name = 'Leerling';
    if (typeof d.muted !== 'boolean') d.muted = false;
    if (typeof d.chill !== 'boolean') d.chill = false;
    if (!d.grades) d.grades = {};
    if (!d.endlessBest) d.endlessBest = 0;
    return d;
  },
  write() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* storage blocked */ } },
};

// ───────────────────────────── canvas helpers ─────────────────────────────
function rr(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function txt(s, x, y, o = {}) {
  ctx.font = `${o.italic ? 'italic ' : ''}${o.weight || 700} ${o.size || 16}px ${o.font || FONT}`;
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.base || 'middle';
  if (o.stroke) { ctx.lineWidth = o.strokeW || 4; ctx.strokeStyle = o.stroke; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = o.color || '#fff';
  ctx.fillText(s, x, y);
}

function wrapText(s, maxW, font) {
  ctx.font = font;
  const out = [];
  for (const para of String(s).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = word; } else line = test;
    }
    out.push(line);
  }
  return out;
}

function glitchText(s, x, y, size, color, amt = 0, o = {}) {
  ctx.save();
  ctx.font = `${o.weight || 900} ${size}px ${o.font || FONT}`;
  ctx.textAlign = o.align || 'center';
  ctx.textBaseline = 'middle';
  if (amt > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#ff1f4b';
    ctx.fillText(s, x - amt * rand(0.5, 3), y + rand(-1, 1) * amt * 0.5);
    ctx.fillStyle = '#1fd7ff';
    ctx.fillText(s, x + amt * rand(0.5, 3), y + rand(-1, 1) * amt * 0.5);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  if (o.stroke) { ctx.lineWidth = o.strokeW || 6; ctx.strokeStyle = o.stroke; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
  if (amt > 1.5 && Math.random() < 0.5) {
    const m = ctx.measureText(s);
    const bh = rand(3, size * 0.3), by = y + rand(-size / 2, size / 2 - bh);
    ctx.beginPath();
    ctx.rect(x - m.width, by, m.width * 2, bh);
    ctx.clip();
    ctx.fillStyle = Math.random() < 0.5 ? '#fff' : color;
    ctx.fillText(s, x + rand(-amt * 6, amt * 6), y);
  }
  ctx.restore();
}
