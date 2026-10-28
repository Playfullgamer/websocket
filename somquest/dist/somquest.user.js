// ==UserScript==
// @name         SomQuest — Het Laatste Rapport
// @namespace    https://github.com/Playfullgamer/websocket
// @version      1.0.0
// @description  A full story game inside Somtoday: 5 chapters, bosses, lore, sound and effects. Click the SomQuest button or press Alt+Q.
// @match        https://*.somtoday.nl/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/*! SomQuest v1.0.0 — Het Laatste Rapport. A fan-made story game mod for Somtoday. */
(function () {
'use strict';
// ── 00-util.js ──
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
    if (typeof d.name !== 'string' || !d.name) d.name = 'Student';
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

// ── 01-audio.js ──
// ───────────────────────────── audio: synthesized sfx + chiptune ─────────────────────────────
const Snd = (() => {
  let ac = null, master, sfxBus, musBus, noiseBuf;
  let muted = false;
  const last = {};

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ac = new AC(); } catch (e) { ac = null; return; }
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.7;
    master.connect(comp); comp.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    musBus = ac.createGain(); musBus.gain.value = 0.42; musBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function suspend() { if (ac && ac.state === 'running') ac.suspend(); }
  function resume() { if (ac && ac.state === 'suspended') ac.resume(); }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.7, ac.currentTime, 0.05);
  }
  function duck(on) { if (musBus) musBus.gain.setTargetAtTime(on ? 0.12 : 0.42, ac.currentTime, 0.1); }

  function tone(o) {
    if (!ac) return;
    const t0 = o.at !== undefined ? Math.max(o.at, ac.currentTime) : ac.currentTime + (o.delay || 0);
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f, t0);
    const dur = o.dur ?? 0.1;
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t0 + (o.slide || dur));
    if (o.detune) osc.detune.value = o.detune;
    const vol = o.vol ?? 0.15, a = o.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (o.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
    node.connect(g); g.connect(o.dest || sfxBus);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }

  function noise(o) {
    if (!ac) return;
    const t0 = o.at !== undefined ? Math.max(o.at, ac.currentTime) : ac.currentTime + (o.delay || 0);
    const dur = o.dur ?? 0.2, vol = o.vol ?? 0.2;
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ac.createBiquadFilter(); f.type = o.ft || 'bandpass';
    f.frequency.setValueAtTime(o.f || 1200, t0);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + dur);
    f.Q.value = o.q ?? 1;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || sfxBus);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.03);
  }

  function gate(name, iv) {
    const now = performance.now();
    if (last[name] && now - last[name] < iv * 1000) return false;
    last[name] = now; return true;
  }

  const sfx = {
    shoot() { if (!gate('shoot', 0.05)) return; tone({ type: 'square', f: 1300 + rand(-90, 90), f2: 640, dur: 0.06, vol: 0.03 }); },
    hit() { if (!gate('hit', 0.035)) return; tone({ type: 'square', f: 320, f2: 120, dur: 0.06, vol: 0.05 }); noise({ f: 3200, dur: 0.04, vol: 0.05 }); },
    crit() { if (!gate('crit', 0.05)) return; tone({ type: 'square', f: 1800, f2: 2600, dur: 0.07, vol: 0.05 }); },
    kill() { if (!gate('kill', 0.04)) return; noise({ ft: 'lowpass', f: 2600, f2: 180, dur: 0.25, vol: 0.2 }); tone({ type: 'triangle', f: 240, f2: 55, dur: 0.2, vol: 0.12 }); },
    hurt() { tone({ type: 'sawtooth', f: 240, f2: 60, dur: 0.38, vol: 0.2, lp: 1400 }); noise({ ft: 'lowpass', f: 1300, f2: 90, dur: 0.32, vol: 0.28 }); },
    dash() { noise({ ft: 'bandpass', f: 500, f2: 3200, q: 2, dur: 0.18, vol: 0.2 }); },
    pickup(n = 0) { if (!gate('pickup', 0.03)) return; const f = 880 * Math.pow(2, (n % 12) / 12); tone({ type: 'sine', f, f2: f * 1.5, dur: 0.07, vol: 0.05 }); },
    ping() { tone({ type: 'sine', f: 1568, dur: 0.7, vol: 0.14 }); tone({ type: 'sine', f: 2093, dur: 0.9, vol: 0.1, delay: 0.09 }); tone({ type: 'triangle', f: 3136, dur: 0.4, vol: 0.03, delay: 0.09 }); },
    type(p = 1) { if (!gate('type', 0.04)) return; tone({ type: 'square', f: 480 * p + rand(-25, 25), dur: 0.03, vol: 0.025 }); },
    select() { tone({ type: 'square', f: 660, dur: 0.05, vol: 0.045 }); },
    confirm() { tone({ type: 'square', f: 660, dur: 0.06, vol: 0.05 }); tone({ type: 'square', f: 990, dur: 0.1, vol: 0.05, delay: 0.06 }); },
    special() {
      noise({ ft: 'lowpass', f: 5000, f2: 70, dur: 1.0, vol: 0.45 });
      tone({ type: 'sawtooth', f: 120, f2: 30, dur: 0.9, vol: 0.25, lp: 900 });
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ type: 'square', f, dur: 0.16, vol: 0.05, delay: i * 0.05 }));
    },
    laserWarn() { if (!gate('lw', 0.12)) return; tone({ type: 'sine', f: 900, f2: 1800, dur: 0.25, vol: 0.05 }); },
    laser() { if (!gate('laser', 0.1)) return; noise({ ft: 'bandpass', f: 900, q: 3, dur: 0.5, vol: 0.18 }); tone({ type: 'sawtooth', f: 85, dur: 0.5, vol: 0.12, lp: 900 }); },
    eshoot() { if (!gate('eshoot', 0.07)) return; tone({ type: 'triangle', f: 520, f2: 300, dur: 0.08, vol: 0.035 }); },
    spawn() { if (!gate('spawn', 0.1)) return; tone({ type: 'sine', f: 200, f2: 700, dur: 0.25, vol: 0.035 }); },
    roar() {
      tone({ type: 'sawtooth', f: 72, f2: 38, dur: 1.5, vol: 0.3, lp: 650 });
      tone({ type: 'square', f: 75, f2: 36, dur: 1.5, vol: 0.14, lp: 420, detune: 18 });
      noise({ ft: 'lowpass', f: 900, f2: 90, dur: 1.3, vol: 0.32 });
    },
    glitch() {
      for (let i = 0; i < 7; i++) tone({ type: 'square', f: rand(90, 2200), dur: 0.04, vol: 0.05, delay: i * 0.035 });
      noise({ ft: 'highpass', f: 2800, dur: 0.28, vol: 0.1 });
    },
    boom() { noise({ ft: 'lowpass', f: 2000, f2: 50, dur: 1.3, vol: 0.5 }); tone({ type: 'sine', f: 130, f2: 28, dur: 1.0, vol: 0.38 }); },
    levelup() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ type: 'square', f, dur: 0.18, vol: 0.055, delay: i * 0.07 })); },
    heal() { [784, 988, 1175, 1568].forEach((f, i) => tone({ type: 'sine', f, dur: 0.22, vol: 0.08, delay: i * 0.06 })); },
    deny() { tone({ type: 'square', f: 200, dur: 0.1, vol: 0.06 }); tone({ type: 'square', f: 150, dur: 0.15, vol: 0.06, delay: 0.08 }); },
    whoosh() { noise({ ft: 'bandpass', f: 300, f2: 2400, q: 1.5, dur: 0.45, vol: 0.18 }); },
    slam() { tone({ type: 'square', f: 110, f2: 40, dur: 0.35, vol: 0.2, lp: 700 }); noise({ ft: 'lowpass', f: 1500, f2: 100, dur: 0.3, vol: 0.3 }); },
    tick() { tone({ type: 'square', f: 1800, dur: 0.02, vol: 0.03 }); },
    fanfare() {
      const n = [523, 659, 784, 1047, 784, 1047, 1319, 1568];
      n.forEach((f, i) => { tone({ type: 'square', f, dur: 0.22, vol: 0.06, delay: i * 0.11 }); tone({ type: 'triangle', f: f / 2, dur: 0.22, vol: 0.08, delay: i * 0.11 }); });
    },
  };

  // ── music sequencer ──
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const SONGS = {
    title: { bpm: 96, root: 57, prog: [[0, 3, 7], [-4, 0, 3], [-7, -4, 0], [-2, 2, 5]], drums: ['x.......x.......', '........x.......', '..x...x...x...x.'], bass: 'x.....x.x.......', arp: 2, lead: 0.22, pad: true },
    level: { bpm: 132, root: 50, prog: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -1, 2]], drums: ['x...x...x...x...', '....x.......x...', 'x.x.x.x.x.x.x.xx'], bass: 'x.xx.xx.x.xx.x.x', arp: 1, lead: 0.32 },
    homework: { bpm: 140, root: 52, prog: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], drums: ['x..x..x...x..x..', '....x.......x...', 'x.xxx.xxx.xxx.xx'], bass: 'x..x..x.x..x..x.', arp: 1, lead: 0.3 },
    grades: { bpm: 126, root: 48, prog: [[0, 3, 7], [1, 5, 8], [-2, 2, 5], [-4, 0, 3]], drums: ['x.....x.x.......', '....x.......x...', 'x.x.x.x.x.x.x.x.'], bass: 'x.x.x.x.x.x.x.x.', arp: 1, lead: 0.36 },
    dark: { bpm: 104, root: 45, prog: [[0, 3, 7], [0, 3, 6], [-4, 0, 3], [-5, -2, 1]], drums: ['x.........x.....', '........x.......', '....x.......x...'], bass: 'x.......x.......', arp: 2, lead: 0.16, pad: true },
    boss: { bpm: 156, root: 52, prog: [[0, 3, 7], [1, 5, 8], [0, 3, 7], [-2, 1, 5]], drums: ['x..x..x.x..x..x.', '....x.......x..x', 'xxxxxxxxxxxxxxxx'], bass: 'xxxxxxxxxxxxxxxx', arp: 1, lead: 0.45 },
    final: { bpm: 170, root: 49, prog: [[0, 3, 7], [-1, 3, 6], [-4, 0, 3], [-5, -1, 2], [0, 3, 7], [1, 5, 8], [3, 7, 10], [-2, 2, 5]], drums: ['x.xx..x.x.xx..x.', '....x.......x.xx', 'xxxxxxxxxxxxxxxx'], bass: 'xxxxxxxxxxxxxxxx', arp: 1, lead: 0.5 },
    ending: { bpm: 104, root: 60, prog: [[0, 4, 7], [-5, -1, 2], [-3, 0, 4], [-7, -3, 0]], drums: ['x.......x.......', '....x.......x...', 'x.x.x.x.x.x.x.x.'], bass: 'x...x...x...x.x.', arp: 1, lead: 0.3, pad: true },
  };

  let cur = null;

  function buildLead(name, s) {
    const r = seeded(name);
    const steps = 16 * s.prog.length;
    const out = new Array(steps).fill(null);
    let i = 0;
    while (i < steps) {
      const bar = Math.floor(i / 16);
      const chord = s.prog[bar];
      if (r() < s.lead || i % 16 === 0) {
        const len = [1, 2, 2, 3, 4][Math.floor(r() * 5)];
        const tone = chord[Math.floor(r() * chord.length)] + (r() < 0.3 ? 24 : 12);
        out[i] = { n: s.root + tone, len };
        i += len;
      } else i++;
    }
    return out;
  }

  function playStep(step, t) {
    const s = cur.s, dest = cur.gain;
    const spb = 60 / s.bpm / 4;
    const st = step % 16;
    const chord = s.prog[Math.floor(step / 16) % s.prog.length];
    if (s.drums[0][st] === 'x') { tone({ at: t, type: 'sine', f: 160, f2: 42, slide: 0.12, dur: 0.18, vol: 0.55, dest }); }
    if (s.drums[1][st] === 'x') { noise({ at: t, ft: 'highpass', f: 1600, dur: 0.13, vol: 0.2, dest }); tone({ at: t, type: 'triangle', f: 190, f2: 120, dur: 0.08, vol: 0.12, dest }); }
    if (s.drums[2][st] === 'x') { noise({ at: t, ft: 'highpass', f: 7500, dur: 0.035, vol: 0.05, dest }); }
    if (s.bass[st] === 'x') {
      const n = s.root - 12 + chord[0] + (st % 8 === 6 ? 12 : 0);
      tone({ at: t, type: 'triangle', f: mtof(n), dur: spb * 1.7, vol: 0.28, dest });
      tone({ at: t, type: 'square', f: mtof(n), dur: spb * 1.2, vol: 0.05, lp: 600, dest });
    }
    if (st % s.arp === 0) {
      const k = Math.floor(st / s.arp) % (chord.length + 1);
      const n = s.root + 12 + (k === chord.length ? chord[0] + 12 : chord[k]);
      tone({ at: t, type: 'square', f: mtof(n), dur: spb * 0.85, vol: 0.035, lp: 2600, dest });
    }
    if (s.pad && st === 0) {
      for (const c of chord) tone({ at: t, type: 'sawtooth', f: mtof(s.root + c), dur: spb * 16, vol: 0.025, lp: 900, attack: 0.4, dest });
    }
    const L = cur.lead[step % cur.lead.length];
    if (L) {
      tone({ at: t, type: 'sawtooth', f: mtof(L.n), dur: spb * L.len * 0.95, vol: 0.045, lp: 2000, dest });
      tone({ at: t, type: 'square', f: mtof(L.n), dur: spb * L.len * 0.95, vol: 0.02, lp: 3000, detune: 9, dest });
    }
  }

  function schedule() {
    if (!cur || !ac) return;
    const spb = 60 / cur.s.bpm / 4;
    if (cur.next < ac.currentTime - 0.2) cur.next = ac.currentTime + 0.05; // recovered from suspend
    while (cur.next < ac.currentTime + 0.14) {
      playStep(cur.step, cur.next);
      cur.next += spb; cur.step++;
    }
  }

  function playMusic(name) {
    if (!ac) return;
    if (cur && cur.name === name) return;
    stopMusic();
    const s = SONGS[name];
    if (!s) return;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(1, ac.currentTime + 0.6);
    gain.connect(musBus);
    cur = { name, s, step: 0, next: ac.currentTime + 0.08, gain, lead: s._lead || (s._lead = buildLead(name, s)) };
    cur.timer = setInterval(schedule, 25);
    schedule();
  }

  function stopMusic() {
    if (!cur) return;
    const c = cur; cur = null;
    clearInterval(c.timer);
    try {
      c.gain.gain.cancelScheduledValues(ac.currentTime);
      c.gain.gain.setValueAtTime(c.gain.gain.value, ac.currentTime);
      c.gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.5);
    } catch (e) { /* ignore */ }
    setTimeout(() => { try { c.gain.disconnect(); } catch (e) { /* ignore */ } }, 900);
  }

  return { init, sfx, playMusic, stopMusic, setMuted, duck, suspend, resume, get muted() { return muted; } };
})();

// ── 02-fx.js ──
// ───────────────────────────── visual effects ─────────────────────────────
const FX = { parts: [], texts: [], rings: [], shake: 0, flash: 0, flashCol: '#fff', glitch: 0, hitstop: 0, slow: 1, slowT: 0, chroma: 0 };

function resetFX() {
  FX.parts.length = 0; FX.texts.length = 0; FX.rings.length = 0;
  FX.shake = FX.flash = FX.glitch = FX.hitstop = FX.slowT = FX.chroma = 0; FX.slow = 1;
}
function addShake(v) { FX.shake = Math.min(26, Math.max(FX.shake, v)); }
function flash(col, a) { FX.flashCol = col; FX.flash = Math.max(FX.flash, a); }
function hitstop(t) { FX.hitstop = Math.max(FX.hitstop, t); }
function slowmo(scale, t) { FX.slow = scale; FX.slowT = t; }
function glitch(t) { FX.glitch = Math.max(FX.glitch, t); }

function particle(o) {
  if (FX.parts.length > 1500) FX.parts.splice(0, 100);
  FX.parts.push(o);
}

function burst(x, y, color, n = 12, spd = 220, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = rand(TAU), s = rand(0.25, 1) * spd, life = rand(0.25, 0.65) * (o.life || 1);
    particle({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life,
      size: rand(2, 4.5) * (o.size || 1), color: Array.isArray(color) ? pick(color) : color,
      shape: o.shape || (Math.random() < 0.5 ? 'sq' : 'spark'), drag: o.drag ?? 4, grav: o.grav || 0,
      rot: rand(TAU), vr: rand(-10, 10), add: o.add ?? true,
    });
  }
}

function debris(x, y, color, n = 6, spd = 200) {
  for (let i = 0; i < n; i++) {
    const a = rand(TAU), s = rand(60, spd), life = rand(0.5, 1.1);
    particle({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life, max: life, size: rand(4, 8), color, shape: 'paper', drag: 2, grav: 260, rot: rand(TAU), vr: rand(-12, 12), add: false });
  }
}

function ringFx(x, y, color, r1, dur = 0.4, w = 4, r0 = 0) { FX.rings.push({ x, y, color, r0, r1, t: 0, dur, w }); }

function floatText(x, y, text, color = '#fff', size = 16, o = {}) {
  FX.texts.push({ x: clamp(x, 60, W - 60), y: Math.max(y, AY + 40), text, color, size, t: 0, dur: o.dur || 0.9, vy: o.vy ?? -46, font: o.font || FONT });
}

function updateFX(dt) {
  for (let i = FX.parts.length - 1; i >= 0; i--) {
    const p = FX.parts[i];
    p.life -= dt;
    if (p.life <= 0) { FX.parts.splice(i, 1); continue; }
    const k = Math.max(0, 1 - p.drag * dt);
    p.vx *= k; p.vy = p.vy * k + p.grav * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
  }
  for (let i = FX.rings.length - 1; i >= 0; i--) { const r = FX.rings[i]; r.t += dt; if (r.t >= r.dur) FX.rings.splice(i, 1); }
  for (let i = FX.texts.length - 1; i >= 0; i--) { const t = FX.texts[i]; t.t += dt; t.y += t.vy * dt; t.vy *= 0.96; if (t.t >= t.dur) FX.texts.splice(i, 1); }
}

// real-time decays (not affected by hitstop/slowmo)
function decayFX(rdt) {
  FX.shake = Math.max(0, FX.shake - rdt * 40);
  FX.flash = Math.max(0, FX.flash - rdt * 2.6);
  FX.glitch = Math.max(0, FX.glitch - rdt);
  FX.chroma = Math.max(0, FX.chroma - rdt * 2);
  FX.hitstop = Math.max(0, FX.hitstop - rdt);
  if (FX.slowT > 0) { FX.slowT -= rdt; if (FX.slowT <= 0) FX.slow = 1; }
}

function drawFXParts() {
  ctx.save();
  for (const p of FX.parts) {
    const a = clamp(p.life / p.max, 0, 1);
    ctx.globalAlpha = a;
    ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
    ctx.fillStyle = p.color; ctx.strokeStyle = p.color;
    if (p.shape === 'spark') {
      ctx.lineWidth = p.size * 0.6;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke();
    } else if (p.shape === 'circle') {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, TAU); ctx.fill();
    } else if (p.shape === 'paper') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.abs(Math.sin(p.rot * 1.3)) * 0.8 + 0.2);
      ctx.fillRect(-p.size / 2, -p.size * 0.65, p.size, p.size * 1.3);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-p.size * 0.3, -p.size * 0.3, p.size * 0.6, 1);
      ctx.restore();
    } else if (p.shape === 'text') {
      ctx.font = `800 ${p.size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.text, p.x, p.y);
    } else {
      const s = p.size * (0.5 + a * 0.5);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const r of FX.rings) {
    const k = r.t / r.dur, e = ease.outCubic(k);
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = r.color; ctx.lineWidth = r.w * (1 - k) + 1;
    ctx.beginPath(); ctx.arc(r.x, r.y, lerp(r.r0, r.r1, e), 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

function drawFXTexts() {
  ctx.save();
  for (const t of FX.texts) {
    const k = t.t / t.dur;
    const pop = k < 0.15 ? ease.outBack(k / 0.15) : 1;
    ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    ctx.save(); ctx.translate(t.x, t.y); ctx.scale(pop, pop);
    txt(t.text, 0, 0, { size: t.size, color: t.color, align: 'center', weight: 900, stroke: 'rgba(5,10,25,0.85)', strokeW: 4, font: t.font });
    ctx.restore();
  }
  ctx.restore();
}

// screen-space post effects
let scratch = null;
function postFX(dpr) {
  if (FX.glitch <= 0) return;
  if (!scratch) scratch = document.createElement('canvas');
  if (scratch.width !== canvas.width || scratch.height !== canvas.height) { scratch.width = canvas.width; scratch.height = canvas.height; }
  const sc = scratch.getContext('2d');
  sc.clearRect(0, 0, scratch.width, scratch.height);
  sc.drawImage(canvas, 0, 0);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const n = Math.ceil(FX.glitch * 10) + 2;
  for (let i = 0; i < n; i++) {
    const h = rand(4, 40) * dpr, y = rand(canvas.height - h), off = rand(-40, 40) * dpr * Math.min(1, FX.glitch * 2);
    ctx.drawImage(scratch, 0, y, canvas.width, h, off, y, canvas.width, h);
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(0.35, FX.glitch * 0.6);
  ctx.drawImage(scratch, 6 * dpr, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  if (Math.random() < 0.3) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,40,80,0.18)' : 'rgba(40,220,255,0.18)';
    ctx.fillRect(0, rand(canvas.height), canvas.width, rand(2, 14) * dpr);
  }
  ctx.restore();
}

// ── 03-render.js ──
// ───────────────────────────── themes & backgrounds ─────────────────────────────
const THEMES = {
  menu:     { bg1: '#070f24', bg2: '#123067', accent: '#3aa0ff', grid: 'rgba(80,160,255,0.08)', deco: 'menu' },
  rooster:  { bg1: '#08142c', bg2: '#11336f', accent: '#41a6ff', grid: 'rgba(90,170,255,0.09)', deco: 'rooster', label: 'ROOSTER' },
  huiswerk: { bg1: '#061b1a', bg2: '#0d4842', accent: '#2ee6b5', grid: 'rgba(60,230,190,0.08)', deco: 'huiswerk', label: 'HUISWERK' },
  cijfers:  { bg1: '#130a29', bg2: '#3a1670', accent: '#c48bff', grid: 'rgba(190,140,255,0.08)', deco: 'cijfers', label: 'CIJFERS' },
  afwezig:  { bg1: '#040408', bg2: '#1a1526', accent: '#a58bff', grid: 'rgba(140,120,255,0.07)', deco: 'afwezig', label: 'AFWEZIGHEID', dark: true },
  rapport:  { bg1: '#170307', bg2: '#4a0d16', accent: '#ff3b5c', grid: 'rgba(255,70,90,0.09)', deco: 'rapport', label: 'RAPPORT' },
};

const SUBJECTS = [['wis', '#41a6ff'], ['ned', '#ff9f43'], ['eng', '#ff5470'], ['bio', '#2ee6b5'], ['gym', '#ffd84a'], ['gs', '#c48bff'], ['ak', '#7cd46a'], ['nask', '#5ad1ff'], ['du', '#ff7ad9'], ['fa', '#9fb3d1']];

const DECO = {
  menu(r, th) { DECO.rooster(r, th, 0.6); DECO.cijfers(r, th, 0.5); },
  rooster(r, th, k = 1) {
    const days = ['MA', 'DI', 'WO', 'DO', 'VR'];
    const x0 = 150, cw = 135, y0 = 110, ch = 48;
    ctx.globalAlpha = 0.5 * k;
    days.forEach((d, i) => txt(d, x0 + i * cw + cw / 2, y0 - 22, { size: 14, color: th.accent, align: 'center', weight: 800 }));
    for (let i = 0; i < 8; i++) txt(String(i + 1), x0 - 24, y0 + i * ch + ch / 2, { size: 12, color: th.accent, align: 'center' });
    for (let d = 0; d < 5; d++) for (let h = 0; h < 8; h++) {
      if (r() < 0.2) continue;
      const [code, col] = SUBJECTS[Math.floor(r() * SUBJECTS.length)];
      ctx.globalAlpha = 0.06 * k; ctx.fillStyle = col; rr(x0 + d * cw + 4, y0 + h * ch + 4, cw - 8, ch - 8, 6); ctx.fill();
      ctx.globalAlpha = 0.11 * k; ctx.fillStyle = col; ctx.fillRect(x0 + d * cw + 4, y0 + h * ch + 8, 3, ch - 16);
      txt(code, x0 + d * cw + 16, y0 + h * ch + ch / 2, { size: 13, color: col });
    }
    ctx.globalAlpha = 1;
  },
  huiswerk(r, th) {
    for (let col = 0; col < 2; col++) for (let i = 0; i < 10; i++) {
      const x = 130 + col * 380, y = 100 + i * 40;
      ctx.globalAlpha = 0.12; ctx.strokeStyle = th.accent; ctx.lineWidth = 2;
      rr(x, y, 18, 18, 4); ctx.stroke();
      if (r() < 0.35) { ctx.beginPath(); ctx.moveTo(x + 4, y + 9); ctx.lineTo(x + 8, y + 14); ctx.lineTo(x + 15, y + 4); ctx.stroke(); }
      ctx.globalAlpha = 0.07; ctx.fillStyle = '#fff';
      rr(x + 30, y + 3, 80 + r() * 200, 6, 3); ctx.fill();
      rr(x + 30, y + 12, 40 + r() * 100, 4, 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
  cijfers(r, th, k = 1) {
    for (let i = 0; i < 26; i++) {
      const g = 1 + r() * 9, x = 60 + r() * 840, y = 90 + r() * 400;
      ctx.globalAlpha = 0.07 * k; ctx.fillStyle = gradeColor(g); rr(x, y, 52, 36, 6); ctx.fill();
      ctx.globalAlpha = 0.13 * k; txt(fmtGrade(g), x + 26, y + 18, { size: 16, align: 'center', color: '#fff', weight: 800 });
    }
    ctx.globalAlpha = 1;
  },
  afwezig(r) {
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = 0.05 + r() * 0.04;
      txt(pick(['A', 'L', 'Z', 'X', '?']), r() * W, 80 + r() * 440, { size: 18 + r() * 40, color: '#b9a8ff', align: 'center', weight: 900 });
    }
    ctx.globalAlpha = 1;
  },
  rapport(r, th) {
    ctx.globalAlpha = 0.09;
    for (let i = 0; i < 10; i++) {
      const y = 110 + i * 38;
      ctx.fillStyle = '#fff'; rr(220, y, 160, 8, 4); ctx.fill();
      for (let j = 0; j < 5; j++) { ctx.fillStyle = r() < 0.5 ? '#ff3b5c' : '#ff8a9c'; rr(420 + j * 70, y - 8, 52, 24, 5); ctx.fill(); }
    }
    ctx.globalAlpha = 0.07;
    for (let c = 0; c < 8; c++) {
      let s = ''; for (let i = 0; i < 26; i++) s += r() < 0.5 ? '0' : '1';
      for (let i = 0; i < s.length; i++) txt(s[i], c < 4 ? 40 + c * 30 : W - 40 - (c - 4) * 30, 80 + i * 17, { size: 13, color: th.accent, font: MONO, align: 'center' });
    }
    ctx.globalAlpha = 1;
  },
};

const bgCache = {};
function buildBg(name) {
  const th = THEMES[name];
  const c = document.createElement('canvas');
  c.width = W * 2; c.height = H * 2;
  const prev = ctx;
  ctx = c.getContext('2d');
  ctx.scale(2, 2);
  const g = ctx.createRadialGradient(W / 2, H * 0.45, 40, W / 2, H / 2, W * 0.75);
  g.addColorStop(0, th.bg2); g.addColorStop(1, th.bg1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = th.grid; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 40) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
  for (let y = 0; y <= H; y += 40) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
  ctx.stroke();
  DECO[th.deco](seeded(name), th);
  if (th.label) { ctx.globalAlpha = 0.035; txt(th.label, W / 2, H - 60, { size: 130, weight: 900, align: 'center', color: '#fff' }); ctx.globalAlpha = 1; }
  ctx = prev;
  return c;
}

let overlayCache = null;
function buildOverlay() {
  const c = document.createElement('canvas');
  c.width = W * 2; c.height = H * 2;
  const g = c.getContext('2d');
  g.scale(2, 2);
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(0,0,0,0.13)';
  for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
  return c;
}

const motes = [];
function drawBackground(themeName, t) {
  const th = THEMES[themeName] || THEMES.menu;
  if (!bgCache[themeName]) bgCache[themeName] = buildBg(themeName);
  ctx.drawImage(bgCache[themeName], 0, 0, W, H);
  // drifting motes
  if (!motes.length) for (let i = 0; i < 46; i++) motes.push({ x: rand(W), y: rand(H), s: rand(1, 3.5), v: rand(6, 26), ph: rand(TAU) });
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = th.accent;
  for (const m of motes) {
    const y = ((m.y - t * m.v) % H + H) % H;
    ctx.globalAlpha = 0.12 + 0.1 * Math.sin(t * 1.5 + m.ph);
    ctx.fillRect(m.x + Math.sin(t * 0.6 + m.ph) * 10, y, m.s, m.s);
  }
  ctx.restore();
  // scanning line
  const sy = (t * 60) % (H + 200) - 100;
  const sg = ctx.createLinearGradient(0, sy - 40, 0, sy + 40);
  sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.025)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, sy - 40, W, 80);
  if (themeName === 'rapport' && Math.random() < 0.04) {
    ctx.fillStyle = 'rgba(255,40,70,0.08)';
    ctx.fillRect(0, rand(H), W, rand(4, 30));
  }
}

function drawOverlay() {
  if (!overlayCache) overlayCache = buildOverlay();
  ctx.drawImage(overlayCache, 0, 0, W, H);
}

// darkness layer with light holes
let darkC = null;
function drawDarkness(lights, alpha = 0.95) {
  if (!darkC) { darkC = document.createElement('canvas'); darkC.width = W; darkC.height = H; }
  const g = darkC.getContext('2d');
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, W, H);
  g.fillStyle = `rgba(3,2,8,${alpha})`;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'destination-out';
  for (const l of lights) {
    const gr = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
    gr.addColorStop(0, `rgba(0,0,0,${l.a ?? 1})`); gr.addColorStop(0.6, `rgba(0,0,0,${(l.a ?? 1) * 0.7})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(l.x, l.y, l.r, 0, TAU); g.fill();
  }
  ctx.drawImage(darkC, 0, 0);
}

// ───────────────────────────── characters ─────────────────────────────
function drawPing(x, y, s, t, talk) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 3) * 3 * s);
  ctx.rotate(Math.sin(t * 2.2) * 0.08 + (talk ? Math.sin(t * 18) * 0.05 : 0));
  ctx.scale(s, s);
  const gr = ctx.createRadialGradient(0, 0, 4, 0, 0, 50);
  gr.addColorStop(0, 'rgba(255,216,74,0.35)'); gr.addColorStop(1, 'rgba(255,216,74,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 50, 0, TAU); ctx.fill();
  ctx.fillStyle = '#d99a00'; ctx.beginPath(); ctx.arc(Math.sin(t * 6) * 4, 25, 6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffd84a';
  ctx.beginPath();
  ctx.moveTo(-27, 20); ctx.quadraticCurveTo(-22, 14, -20, -2); ctx.quadraticCurveTo(-18, -29, 0, -29);
  ctx.quadraticCurveTo(18, -29, 20, -2); ctx.quadraticCurveTo(22, 14, 27, 20); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f0b400'; rr(-29, 16, 58, 9, 4.5); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -32, 5, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.ellipse(-10, -14, 4, 8, 0.4, 0, TAU); ctx.fill();
  const blink = (t % 3.7) < 0.12;
  ctx.fillStyle = '#3a2600';
  for (const ex of [-8, 8]) {
    if (blink) ctx.fillRect(ex - 3.5, -4, 7, 2);
    else { ctx.beginPath(); ctx.ellipse(ex, -4, 3.2, 4.6, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(ex - 1, -7, 1.6, 1.6); ctx.fillStyle = '#3a2600'; }
  }
  ctx.fillStyle = 'rgba(255,120,80,0.45)';
  ctx.beginPath(); ctx.ellipse(-14, 3, 4, 2.4, 0, 0, TAU); ctx.ellipse(14, 3, 4, 2.4, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3a2600';
  if (talk) { ctx.beginPath(); ctx.ellipse(0, 6, 3.5, 1.5 + Math.abs(Math.sin(t * 22)) * 3, 0, 0, TAU); ctx.fill(); }
  else { ctx.strokeStyle = '#3a2600'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(0, 4, 4, 0.2, Math.PI - 0.2); ctx.stroke(); }
  ctx.restore();
}

function drawStudent(x, y, s, t, talk) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#2f7cf6'; rr(-28, 10, 56, 36, 14); ctx.fill();
  ctx.fillStyle = '#2569d6'; ctx.beginPath(); ctx.arc(0, -6, 25, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#e8f1ff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-6, 14); ctx.lineTo(-7, 30); ctx.moveTo(6, 14); ctx.lineTo(7, 30); ctx.stroke();
  ctx.fillStyle = '#ffd6b0'; ctx.beginPath(); ctx.arc(0, -4, 18, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3b2a20';
  ctx.beginPath(); ctx.arc(0, -7, 19, Math.PI * 1.02, Math.PI * 1.98); ctx.lineTo(14, -10); ctx.lineTo(6, -14); ctx.lineTo(0, -9); ctx.lineTo(-8, -14); ctx.lineTo(-16, -8); ctx.closePath(); ctx.fill();
  const blink = ((t + 1.3) % 4.1) < 0.12;
  ctx.fillStyle = '#1d1d2b';
  for (const ex of [-7, 7]) { if (blink) ctx.fillRect(ex - 3, -2, 6, 1.6); else { ctx.beginPath(); ctx.arc(ex, -2, 2.6, 0, TAU); ctx.fill(); } }
  if (talk) { ctx.beginPath(); ctx.ellipse(0, 7, 3, 1 + Math.abs(Math.sin(t * 20)) * 2.5, 0, 0, TAU); ctx.fill(); }
  else { ctx.fillRect(-3, 7, 6, 1.6); }
  ctx.restore();
}

function drawMentor(x, y, s, t, talk, infected) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  if (infected) ctx.translate(rand(-1.5, 1.5), rand(-1.5, 1.5));
  ctx.fillStyle = '#6d6a62'; rr(-14, 30, 28, 9, 2); ctx.fill(); rr(-26, 37, 52, 6, 3); ctx.fill();
  ctx.fillStyle = infected ? '#cfc6c0' : '#dcd7ca'; rr(-42, -36, 84, 68, 9); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.15)'; rr(-42, 24, 84, 8, 4); ctx.fill();
  ctx.fillStyle = infected ? '#25030a' : '#021c17'; rr(-34, -29, 68, 50, 7); ctx.fill();
  const c = infected ? '#ff3b5c' : '#4dffa6';
  ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 8;
  const blink = (t % 3.1) < 0.1;
  if (infected) {
    ctx.save(); ctx.translate(-14, -12); ctx.rotate(0.35); ctx.fillRect(-7, -3, 14, 6); ctx.restore();
    ctx.save(); ctx.translate(14, -12); ctx.rotate(-0.35); ctx.fillRect(-7, -3, 14, 6); ctx.restore();
  } else if (blink) { ctx.fillRect(-20, -12, 12, 2); ctx.fillRect(8, -12, 12, 2); }
  else { ctx.fillRect(-20, -18, 10, 10); ctx.fillRect(10, -18, 10, 10); }
  const mh = talk ? 3 + Math.abs(Math.sin(t * 18)) * 7 : 3;
  ctx.fillRect(-13, 4, 26, mh);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  for (let i = 0; i < 16; i++) ctx.fillRect(-34, -29 + i * 3.2, 68, 1);
  ctx.fillStyle = infected ? (Math.sin(t * 20) > 0 ? '#ff3b5c' : '#300') : '#4dffa6';
  ctx.beginPath(); ctx.arc(32, 27, 2.2, 0, TAU); ctx.fill();
  if (infected) {
    for (let i = 0; i < 4; i++) { ctx.fillStyle = Math.random() < 0.5 ? '#ff3b5c' : '#1fd7ff'; ctx.fillRect(rand(-34, 30), rand(-29, 18), rand(4, 18), rand(1, 3)); }
  }
  ctx.restore();
}

function drawOnv(x, y, s, t, talk) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  const n = 22;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU + t * 0.4;
    const rad = 40 + (i % 2 ? 12 : -2) + Math.sin(t * 5 + i * 1.7) * 4;
    const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 52);
  g.addColorStop(0, '#2a0007'); g.addColorStop(0.6, '#8a0b22'); g.addColorStop(1, '#ff3b5c');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#ff7088'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.save(); ctx.translate(-14, -14); ctx.rotate(0.4); ctx.fillRect(-9, -2.5, 18, 5); ctx.restore();
  ctx.save(); ctx.translate(14, -14); ctx.rotate(-0.4); ctx.fillRect(-9, -2.5, 18, 5); ctx.restore();
  glitchText('1,0', 0, 10 + (talk ? Math.sin(t * 25) * 1.5 : 0), 30, '#fff', talk ? 2 : 0.8);
  ctx.restore();
}

function drawTerminal(x, y, s, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#05140c'; rr(-38, -30, 76, 60, 8); ctx.fill();
  ctx.strokeStyle = '#4dff88'; ctx.lineWidth = 2; rr(-38, -30, 76, 60, 8); ctx.stroke();
  txt('>' + ((t * 2) % 2 < 1 ? '_' : ' '), -26, 0, { size: 22, font: MONO, color: '#4dff88' });
  ctx.restore();
}

function drawPortrait(who, x, y, s, t, talk) {
  if (who === 'ping') drawPing(x, y, s, t, talk);
  else if (who === 'you') drawStudent(x, y, s, t, talk);
  else if (who === 'mentor') drawMentor(x, y, s, t, talk, true);
  else if (who === 'mentorok') drawMentor(x, y, s, t, talk, false);
  else if (who === 'onv') drawOnv(x, y, s, t, talk);
  else if (who === 'log') drawTerminal(x, y, s, t);
  else if (BOSS_SPRITES[who]) BOSS_SPRITES[who](x, y, s * 0.62, t, { talk, phase: 1, hpk: 1 });
}

function drawCursor(x, y, t, accent) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = accent; ctx.lineWidth = 2;
  ctx.rotate(t * 1.5);
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU * 0.2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 9, TAU * 0.25, TAU * 0.45); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 9, TAU * 0.5, TAU * 0.7); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 9, TAU * 0.75, TAU * 0.95); ctx.stroke();
  ctx.rotate(-t * 1.5);
  ctx.fillStyle = '#fff'; ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

// ── 04-entities.js ──
// ───────────────────────────── player ─────────────────────────────
function newPlayer() {
  const chill = Save.data.chill;
  return {
    x: W / 2, y: AY + (AB - AY) * 0.72, vx: 0, vy: 0, r: 10,
    hp: chill ? 7 : 5, maxhp: chill ? 7 : 5,
    inv: 0, aim: -Math.PI / 2, fireCd: 0, dashCd: 0, dashT: 0, dx: 0, dy: 0, special: 0,
    dead: false, deadT: 0, trail: [], walk: 0, compassA: 0, compassHit: new Map(), muzzle: 0, denyCd: 0,
    s: { fireRate: 7, dmg: 1, spread: 1, pierce: 0, bspeed: 650, bsize: 3.5, speed: 215, dashCd: 0.8, crit: 0, homing: 0, specialGain: 1, eraser: false, bell: false, compass: 0, magnet: false, scoreMul: 1 },
  };
}

const UPGRADES = [
  { id: 'calc', icon: '🧮', name: 'Graphing Calculator', desc: '+1 shot per click. Spread the knowledge.', max: 4, apply: p => { p.s.spread++; } },
  { id: 'highlighter', icon: '🖍️', name: 'Highlighter', desc: 'Shots pierce through +1 enemy.', max: 3, apply: p => { p.s.pierce++; } },
  { id: 'coffee', icon: '☕', name: 'Cafeteria Coffee', desc: '+15% move speed, +10% fire rate. Tastes like sadness.', max: 3, apply: p => { p.s.speed *= 1.15; p.s.fireRate *= 1.1; } },
  { id: 'stapler', icon: '📎', name: 'Stapler', desc: '+25% fire rate. Clack clack clack.', max: 4, apply: p => { p.s.fireRate *= 1.25; } },
  { id: 'cheat', icon: '📝', name: 'Cheat Sheet', desc: '+15% chance for a CRIT (x2.5 damage).', max: 3, apply: p => { p.s.crit += 0.15; } },
  { id: 'eraser', icon: '🧽', name: 'Eraser', desc: 'Dashing erases enemy bullets. -20% dash cooldown.', max: 2, apply: p => { p.s.eraser = true; p.s.dashCd *= 0.8; } },
  { id: 'tutor', icon: '📚', name: 'Tutoring', desc: '+1 max life and a full heal.', max: 3, apply: p => { p.maxhp++; p.hp = p.maxhp; } },
  { id: 'explain', icon: '✏️', name: 'Extra Explanation', desc: '+35% damage and chunkier shots.', max: 3, apply: p => { p.s.dmg *= 1.35; p.s.bsize += 1.2; } },
  { id: 'planner', icon: '📅', name: 'Planner', desc: 'INLEVEREN meter charges 40% faster.', max: 2, apply: p => { p.s.specialGain *= 1.4; } },
  { id: 'bell', icon: '🔔', name: 'School Bell', desc: 'Getting hit rings a shockwave that wipes nearby bullets.', max: 1, apply: p => { p.s.bell = true; } },
  { id: 'compass', icon: '📐', name: 'Compass', desc: 'A sharp compass orbits you. Stacks.', max: 3, apply: p => { p.s.compass++; } },
  { id: 'laptop', icon: '💻', name: 'School Laptop', desc: 'Your shots gently home in on enemies.', max: 2, apply: p => { p.s.homing++; } },
  { id: 'magnet', icon: '🧲', name: 'Fridge Magnet', desc: 'Points fly to you from anywhere. +20% score.', max: 1, apply: p => { p.s.magnet = true; p.s.scoreMul *= 1.2; } },
];
const UPG = Object.fromEntries(UPGRADES.map(u => [u.id, u]));

function applyUpgrades(p, list) { for (const id of list) UPG[id] && UPG[id].apply(p); }
function upgradeCount(id) { return G.run.upgrades.filter(u => u === id).length; }

function updatePlayer(p, dt) {
  if (p.dead) { p.deadT += dt; return; }
  p.inv = Math.max(0, p.inv - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.fireCd -= dt;
  p.muzzle = Math.max(0, p.muzzle - dt);
  p.denyCd = Math.max(0, p.denyCd - dt);
  let mx = 0, my = 0;
  if (keyDown('KeyA', 'ArrowLeft')) mx--;
  if (keyDown('KeyD', 'ArrowRight')) mx++;
  if (keyDown('KeyW', 'ArrowUp', 'KeyZ')) my--;
  if (keyDown('KeyS', 'ArrowDown')) my++;
  const ml = Math.hypot(mx, my);
  if (ml) { mx /= ml; my /= ml; }
  p.aim = angTo(p.x, p.y, input.mx, input.my);

  if (keyPressed('Space', 'ShiftLeft', 'ShiftRight') && p.dashCd <= 0) {
    p.dx = ml ? mx : Math.cos(p.aim); p.dy = ml ? my : Math.sin(p.aim);
    p.dashT = 0.17; p.dashCd = p.s.dashCd; p.inv = Math.max(p.inv, 0.28);
    Snd.sfx.dash(); burst(p.x, p.y, '#9fd4ff', 10, 160); ringFx(p.x, p.y, '#9fd4ff', 30, 0.25, 3);
  }
  if (p.dashT > 0) {
    p.dashT -= dt;
    p.vx = p.dx * p.s.speed * 3.6; p.vy = p.dy * p.s.speed * 3.6;
    p.trail.push({ x: p.x, y: p.y, a: p.aim, life: 0.25 });
    if (p.s.eraser) {
      for (let i = G.eb.length - 1; i >= 0; i--) {
        const b = G.eb[i];
        if (dist(b.x, b.y, p.x, p.y) < 34) { burst(b.x, b.y, '#ffffff', 3, 90); G.eb.splice(i, 1); }
      }
    }
  } else {
    const k = 1 - Math.exp(-dt * 18);
    p.vx = lerp(p.vx, mx * p.s.speed, k); p.vy = lerp(p.vy, my * p.s.speed, k);
  }
  p.x = clamp(p.x + p.vx * dt, AX + p.r, AR - p.r);
  p.y = clamp(p.y + p.vy * dt, AY + p.r, AB - p.r);
  if (ml) p.walk += dt * 12;
  for (let i = p.trail.length - 1; i >= 0; i--) { p.trail[i].life -= dt; if (p.trail[i].life <= 0) p.trail.splice(i, 1); }

  if (input.mdown && p.fireCd <= 0) { firePlayer(p); p.fireCd = 1 / p.s.fireRate; }
  if (p.fireCd < -1) p.fireCd = 0;

  if (keyPressed('KeyE', 'KeyQ') || input.rclick) {
    if (p.special >= 1) doSpecial(p);
    else if (p.denyCd <= 0) { Snd.sfx.deny(); p.denyCd = 0.4; floatText(p.x, p.y - 22, 'Not ready!', '#9fb3d1', 12, { dur: 0.6 }); }
  }

  if (p.s.compass) {
    p.compassA += dt * 4.4;
    for (const [e, cd] of p.compassHit) { if (cd - dt <= 0) p.compassHit.delete(e); else p.compassHit.set(e, cd - dt); }
    for (let i = 0; i < p.s.compass; i++) {
      const a = p.compassA + (i * TAU) / p.s.compass;
      const cx = p.x + Math.cos(a) * 40, cy = p.y + Math.sin(a) * 40;
      for (const e of G.enemies) {
        if (e.dead || e.spawnT > 0 || e.ghost || p.compassHit.has(e)) continue;
        if (dist(cx, cy, e.x, e.y) < e.r + 8) {
          damageEnemy(e, 1.2 * p.s.dmg, false, Math.cos(a) * 200, Math.sin(a) * 200);
          p.compassHit.set(e, 0.3);
          burst(cx, cy, '#cfe3ff', 4, 120);
        }
      }
    }
  }
}

function firePlayer(p) {
  const n = p.s.spread, gap = 0.13;
  for (let i = 0; i < n; i++) {
    const a = p.aim + (i - (n - 1) / 2) * gap + rand(-0.025, 0.025);
    const crit = Math.random() < p.s.crit;
    G.pb.push({
      x: p.x + Math.cos(p.aim) * 14, y: p.y + Math.sin(p.aim) * 14,
      vx: Math.cos(a) * p.s.bspeed, vy: Math.sin(a) * p.s.bspeed,
      r: p.s.bsize * (crit ? 1.3 : 1), dmg: p.s.dmg * (crit ? 2.5 : 1), crit, pierce: p.s.pierce, life: 1.1, hit: [],
    });
  }
  p.muzzle = 0.05;
  Snd.sfx.shoot();
}

function updatePlayerBullets(dt) {
  const p = G.player;
  for (let i = G.pb.length - 1; i >= 0; i--) {
    const b = G.pb[i];
    b.life -= dt;
    if (p.s.homing) {
      let best = null, bd = 280;
      for (const e of G.enemies) {
        if (e.dead || e.spawnT > 0 || e.ghost) continue;
        const d = dist(b.x, b.y, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        const sp = Math.hypot(b.vx, b.vy), a = Math.atan2(b.vy, b.vx);
        let da = angTo(b.x, b.y, best.x, best.y) - a;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        const na = a + clamp(da, -1, 1) * Math.min(1, p.s.homing * 3.2 * dt);
        b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
      }
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.life <= 0 || b.x < AX || b.x > AR || b.y < AY || b.y > AB) {
      if (b.life > 0) burst(clamp(b.x, AX, AR), clamp(b.y, AY, AB), '#7fd0ff', 2, 80, { life: 0.5 });
      G.pb.splice(i, 1); continue;
    }
    for (const e of G.enemies) {
      if (e.dead || e.spawnT > 0 || e.ghost || b.hit.includes(e)) continue;
      if (dist(b.x, b.y, e.x, e.y) < e.r + b.r) {
        damageEnemy(e, b.dmg, b.crit, b.vx, b.vy);
        b.hit.push(e);
        burst(b.x, b.y, b.crit ? '#ffd84a' : '#9fe0ff', 3, 140, { life: 0.5 });
        if (b.pierce-- <= 0) { G.pb.splice(i, 1); break; }
      }
    }
  }
}

function doSpecial(p) {
  p.special = 0;
  Snd.sfx.special(); flash('#ffffff', 0.75); addShake(16); hitstop(0.06);
  ringFx(p.x, p.y, '#ffd84a', 520, 0.8, 16); ringFx(p.x, p.y, '#ffffff', 340, 0.55, 6);
  burst(p.x, p.y, ['#ffd84a', '#fff', '#ffefa8'], 40, 520, { life: 1.4 });
  let n = 0;
  for (const b of G.eb) { burst(b.x, b.y, '#ffd84a', 2, 80); if (n++ < 40) G.pickups.push({ x: b.x, y: b.y, vx: 0, vy: 0, kind: 'pt', t: 0.6, r: 5 }); }
  G.eb.length = 0;
  for (const l of G.lasers) l.t = Math.max(l.t, l.warn + l.dur);
  for (const e of G.enemies.slice()) {
    if (e.dead || e.spawnT > 0) continue;
    damageEnemy(e, e.boss ? 22 : 14 * Math.max(1, p.s.dmg), false, (e.x - p.x) * 3, (e.y - p.y) * 3);
  }
  floatText(p.x, p.y - 34, 'INGELEVERD!', '#ffd84a', 28, { dur: 1.4 });
  G.stats.specials++;
}

function hurtPlayer(p) {
  if (p.inv > 0 || p.dashT > 0 || p.dead || G.debugGod) return false;
  p.hp--; p.inv = 1.25; G.run.hits++;
  if (G.combo >= 10) floatText(W / 2, 110, 'COMBO LOST', '#ff4d6d', 18);
  G.combo = 0;
  Snd.sfx.hurt(); addShake(12); flash('#ff2040', 0.45); hitstop(0.1); glitch(0.18);
  burst(p.x, p.y, ['#ff4d6d', '#ffffff'], 18, 260);
  floatText(p.x, p.y - 26, pick(['OUCH!', 'AU!', '-1', 'ONVOLDOENDE!', 'OOF']), '#ff4d6d', 18);
  if (p.s.bell) {
    ringFx(p.x, p.y, '#ffd84a', 180, 0.5, 8); Snd.sfx.ping();
    for (let i = G.eb.length - 1; i >= 0; i--) if (dist(G.eb[i].x, G.eb[i].y, p.x, p.y) < 180) G.eb.splice(i, 1);
  }
  if (p.hp <= 0) {
    p.dead = true; p.deadT = 0;
    slowmo(0.25, 1.4); Snd.sfx.boom(); Snd.stopMusic(); glitch(0.9); flash('#ff2040', 0.8);
    burst(p.x, p.y, ['#5fb8ff', '#ffffff', '#ff4d6d'], 60, 420, { life: 1.6 });
    debris(p.x, p.y, '#ffffff', 14, 300);
  }
  return true;
}

function drawPlayer(p) {
  if (p.dead) return;
  for (const tr of p.trail) {
    ctx.globalAlpha = (tr.life / 0.25) * 0.4;
    ctx.fillStyle = '#5fb8ff';
    ctx.beginPath(); ctx.arc(tr.x, tr.y, p.r + 2, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (p.inv > 0 && p.dashT <= 0 && Math.floor(G.t * 20) % 2 === 0) ctx.globalAlpha = 0.35;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y + 12, 11, 4, 0, 0, TAU); ctx.fill();
  const bob = Math.sin(p.walk) * 1.5;
  ctx.save();
  ctx.translate(p.x, p.y + bob);
  // pen
  ctx.save();
  ctx.rotate(p.aim);
  ctx.fillStyle = '#ffd84a'; ctx.fillRect(6, -2.5, 16, 5);
  ctx.fillStyle = '#2b2b38'; ctx.beginPath(); ctx.moveTo(22, -2.5); ctx.lineTo(28, 0); ctx.lineTo(22, 2.5); ctx.fill();
  if (p.muzzle > 0) { ctx.fillStyle = '#bff0ff'; ctx.beginPath(); ctx.arc(30, 0, 6, 0, TAU); ctx.fill(); }
  ctx.restore();
  // hoodie body
  ctx.fillStyle = '#1f5fd0'; ctx.beginPath(); ctx.arc(0, 0, p.r + 1.5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2f7cf6'; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, TAU); ctx.fill();
  const fx = Math.cos(p.aim) * 3, fy = Math.sin(p.aim) * 3;
  ctx.fillStyle = '#ffd6b0'; ctx.beginPath(); ctx.arc(fx, fy, 6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3b2a20'; ctx.beginPath(); ctx.arc(fx - Math.cos(p.aim) * 2, fy - Math.sin(p.aim) * 2, 6, p.aim + Math.PI * 0.55, p.aim + Math.PI * 1.45); ctx.fill();
  ctx.restore();
  // hitbox core
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(p.x, p.y + bob, 2.6, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,80,110,0.9)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(p.x, p.y + bob, 3.6, 0, TAU); ctx.stroke();
  for (let i = 0; i < p.s.compass; i++) {
    const a = p.compassA + (i * TAU) / p.s.compass;
    const cx = p.x + Math.cos(a) * 40, cy = p.y + Math.sin(a) * 40;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = '#cfe3ff'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(4, 6); ctx.lineTo(-4, 6); ctx.fill();
    ctx.fillStyle = '#5fb8ff'; ctx.beginPath(); ctx.arc(0, 4, 3, 0, TAU); ctx.fill();
    ctx.restore();
  }
  if (p.dashCd > 0 && p.dashCd < p.s.dashCd) {
    ctx.strokeStyle = 'rgba(159,212,255,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 6, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - p.dashCd / p.s.dashCd)); ctx.stroke();
  }
}

function drawPlayerBullets() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (const b of G.pb) {
    const col = b.crit ? '#ffd84a' : '#5fd0ff';
    ctx.strokeStyle = col; ctx.globalAlpha = 0.35; ctx.lineWidth = b.r * 3;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.022, b.y - b.vy * 0.022); ctx.stroke();
    ctx.globalAlpha = 1; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = b.r;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.014, b.y - b.vy * 0.014); ctx.stroke();
  }
  ctx.restore();
}

// ───────────────────────────── enemy bullets & lasers ─────────────────────────────
function eShot(x, y, ang, spd, o = {}) {
  if (Save.data.chill) spd *= 0.85;
  const b = {
    x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, spd, r: o.r || 5, color: o.color || '#ff4d6d',
    life: o.life || 9, kind: o.kind || 'orb', text: o.text, acc: o.acc || 0, home: o.home || 0, homeRate: o.homeRate || 2.4,
    curve: o.curve || 0, fuse: o.fuse || 0, t: 0, minSpd: o.minSpd ?? 0, maxSpd: o.maxSpd || 9999,
  };
  G.eb.push(b);
  return b;
}
function eRing(x, y, n, spd, off = 0, o) { for (let i = 0; i < n; i++) eShot(x, y, off + (i * TAU) / n, spd, o); }
function eFan(x, y, ang, n, spread, spd, o) { for (let i = 0; i < n; i++) eShot(x, y, ang + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread), spd, o); }
function aimP(e) { return angTo(e.x, e.y, G.player.x, G.player.y); }

function updateEnemyBullets(dt) {
  const p = G.player;
  for (let i = G.eb.length - 1; i >= 0; i--) {
    const b = G.eb[i];
    b.t += dt; b.life -= dt;
    if (b.acc) {
      const sp = clamp(Math.hypot(b.vx, b.vy) + b.acc * dt, b.minSpd, b.maxSpd);
      const a = Math.atan2(b.vy, b.vx);
      b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
    }
    if (b.curve) {
      const a = Math.atan2(b.vy, b.vx) + b.curve * dt, sp = Math.hypot(b.vx, b.vy);
      b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
    }
    if (b.home > 0) {
      b.home -= dt;
      const a = Math.atan2(b.vy, b.vx), sp = Math.hypot(b.vx, b.vy);
      let da = angTo(b.x, b.y, p.x, p.y) - a;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      const na = a + clamp(da, -b.homeRate * dt, b.homeRate * dt);
      b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.fuse && b.t >= b.fuse) {
      eRing(b.x, b.y, 10, 130, rand(TAU), { color: b.color, r: 4.5 });
      ringFx(b.x, b.y, b.color, 40, 0.3, 3); Snd.sfx.eshoot();
      G.eb.splice(i, 1); continue;
    }
    if (b.life <= 0 || b.x < AX - 30 || b.x > AR + 30 || b.y < AY - 30 || b.y > AB + 30) { G.eb.splice(i, 1); continue; }
    if (!p.dead && dist(b.x, b.y, p.x, p.y) < b.r + 3.2) {
      if (hurtPlayer(p)) { G.eb.splice(i, 1); continue; }
    }
    // grazing reward
    if (!p.dead && !b.grazed && dist(b.x, b.y, p.x, p.y) < b.r + 18) {
      b.grazed = true;
      p.special = Math.min(1, p.special + 0.004 * p.s.specialGain);
      G.score += 2;
    }
  }
}

function drawEnemyBullets() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const b of G.eb) {
    if (b.kind !== 'orb') continue;
    ctx.fillStyle = b.color; ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2, 0, TAU); ctx.fill();
  }
  ctx.restore();
  ctx.save();
  for (const b of G.eb) {
    if (b.kind === 'orb') {
      ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.5, 0, TAU); ctx.fill();
      if (b.fuse) { ctx.strokeStyle = b.color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 4 + Math.sin(b.t * 20) * 2, 0, TAU); ctx.stroke(); }
    } else if (b.kind === 'text') {
      ctx.font = `800 ${b.size || 13}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,5,20,0.9)'; ctx.strokeText(b.text, b.x, b.y);
      ctx.fillStyle = b.color; ctx.fillText(b.text, b.x, b.y);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, TAU); ctx.fill();
    } else if (b.kind === 'tile') {
      ctx.fillStyle = b.color; rr(b.x - 15, b.y - 10, 30, 20, 4); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; rr(b.x - 15, b.y - 10, 30, 20, 4); ctx.stroke();
      txt(b.text, b.x, b.y + 1, { size: 11, align: 'center', weight: 900 });
    } else if (b.kind === 'sq') {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.t * 6);
      ctx.fillStyle = b.color; ctx.fillRect(-b.r, -b.r, b.r * 2, b.r * 2);
      ctx.fillStyle = '#fff'; ctx.fillRect(-b.r * 0.4, -b.r * 0.4, b.r * 0.8, b.r * 0.8);
      ctx.restore();
    }
  }
  ctx.restore();
}

function addLaser(o) {
  const l = Object.assign({ x: 0, y: 0, ang: 0, len: 1400, w: 16, warn: 0.9, dur: 0.6, t: 0, color: '#ff3b5c', rot: 0, label: null, follow: null, fired: false }, o);
  G.lasers.push(l);
  Snd.sfx.laserWarn();
  return l;
}

function updateLasers(dt) {
  const p = G.player;
  for (let i = G.lasers.length - 1; i >= 0; i--) {
    const l = G.lasers[i];
    l.t += dt;
    if (l.follow) { if (l.follow.dead) { l.t = Math.max(l.t, l.warn + l.dur); } else { l.x = l.follow.x; l.y = l.follow.y; } }
    if (l.t > l.warn) l.ang += l.rot * dt; else l.ang += l.rot * dt * 0.25;
    const active = l.t >= l.warn && l.t < l.warn + l.dur;
    if (active && !l.fired) { l.fired = true; Snd.sfx.laser(); addShake(5); }
    if (active && !p.dead) {
      const ex = l.x + Math.cos(l.ang) * l.len, ey = l.y + Math.sin(l.ang) * l.len;
      if (segDist(p.x, p.y, l.x, l.y, ex, ey) < l.w * 0.42 + 2) hurtPlayer(p);
    }
    if (l.t > l.warn + l.dur + 0.2) G.lasers.splice(i, 1);
  }
}

function drawLasers() {
  for (const l of G.lasers) {
    const ex = l.x + Math.cos(l.ang) * l.len, ey = l.y + Math.sin(l.ang) * l.len;
    ctx.save();
    ctx.lineCap = 'round';
    if (l.t < l.warn) {
      const k = l.t / l.warn;
      ctx.globalAlpha = 0.25 + 0.5 * (Math.sin(l.t * 30) * 0.5 + 0.5) * k;
      ctx.strokeStyle = l.color; ctx.lineWidth = 1 + k * 2;
      ctx.setLineDash([10, 8]); ctx.lineDashOffset = -l.t * 60;
      ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.08 * k; ctx.lineWidth = l.w;
      ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(ex, ey); ctx.stroke();
    } else {
      const k = l.t - l.warn, fade = k > l.dur ? 1 - (k - l.dur) / 0.2 : 1, grow = Math.min(1, k / 0.06);
      ctx.globalAlpha = fade;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = l.color; ctx.lineWidth = l.w * 1.8 * grow;
      ctx.globalAlpha = 0.35 * fade;
      ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.globalAlpha = fade; ctx.lineWidth = l.w * grow * (0.9 + Math.sin(G.t * 60) * 0.1);
      ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = l.w * 0.35 * grow;
      ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      if (l.label) {
        ctx.translate(l.x, l.y); ctx.rotate(l.ang);
        ctx.font = `900 ${Math.max(9, l.w * 0.6)}px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(30,0,10,0.75)';
        for (let d = 30 - ((G.t * 140) % 120); d < l.len; d += 120) ctx.fillText(l.label, d, 1);
      }
    }
    ctx.restore();
  }
}

// ───────────────────────────── enemies ─────────────────────────────
const fc = (e, c) => (e.flash > 0 ? '#ffffff' : c);
function damp(e, k, dt) { const f = Math.exp(-k * dt); e.vx *= f; e.vy *= f; }
function seekAng(e, a, spd, dt, k = 4) { const f = 1 - Math.exp(-k * dt); e.vx = lerp(e.vx, Math.cos(a) * spd, f); e.vy = lerp(e.vy, Math.sin(a) * spd, f); }
function every(s, key, iv, dt, fn) { s[key] = (s[key] ?? 0) - dt; if (s[key] <= 0) { s[key] += iv; fn(); } }

function ghostShape(r) {
  ctx.beginPath();
  ctx.arc(0, -r * 0.15, r, Math.PI, 0);
  ctx.lineTo(r, r * 0.9);
  const n = 4;
  for (let i = 0; i < n; i++) {
    const x1 = r - ((i + 0.5) * 2 * r) / n, x2 = r - ((i + 1) * 2 * r) / n;
    ctx.quadraticCurveTo(x1, r * (i % 2 ? 1.25 : 0.55) + Math.sin(G.t * 8 + i) * 2, x2, r * 0.9);
  }
  ctx.closePath();
}
function eyes(e, sep, y, size, col = '#13233d') {
  const a = aimP(e), ox = Math.cos(a) * 1.6, oy = Math.sin(a) * 1.6;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-sep, y, size, 0, TAU); ctx.arc(sep, y, size, 0, TAU); ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(-sep + ox, y + oy, size * 0.55, 0, TAU); ctx.arc(sep + ox, y + oy, size * 0.55, 0, TAU); ctx.fill();
}

const KILL_WORDS = ['Goed!', 'Netjes!', 'Top!', 'Voldoende!', 'Prima!', 'Afgevinkt!', 'Nice!', 'Gelukt!'];
const COMBO_TIERS = [[10, 'VOLDOENDE'], [20, 'RUIM VOLDOENDE'], [30, 'GOED'], [50, 'ZEER GOED'], [75, 'UITSTEKEND'], [100, 'CUM LAUDE']];

const ENEMY = {
  tussenuur: {
    hp: 3, r: 13, score: 10, color: '#9fd4ff', pts: 2,
    init(e) { e.st.seed = rand(TAU); },
    update(e, dt) { seekAng(e, aimP(e) + Math.sin(e.t * 2 + e.st.seed) * 0.9, 66, dt, 3); },
    draw(e) {
      ctx.translate(0, Math.sin(e.t * 4) * 2);
      ctx.fillStyle = fc(e, '#d6ecff'); ghostShape(13); ctx.fill();
      ctx.fillStyle = 'rgba(65,166,255,0.35)'; ctx.fillRect(-13, -4, 26, 4);
      eyes(e, 4.5, -5, 3);
      txt('VRIJ', 0, 6, { size: 7, align: 'center', color: '#41a6ff', weight: 900 });
    },
  },
  telaat: {
    hp: 4, r: 13, score: 15, color: '#ff5470', pts: 3,
    init(e) { e.st.mode = 'approach'; e.st.timer = rand(1, 2); },
    update(e, dt) {
      const s = e.st; s.timer -= dt;
      if (s.mode === 'approach') { seekAng(e, aimP(e), 78, dt, 4); if (s.timer <= 0) { s.mode = 'wind'; s.timer = 0.55; } s.ang = aimP(e); }
      else if (s.mode === 'wind') { damp(e, 10, dt); if (s.timer > 0.25) s.ang = aimP(e); if (s.timer <= 0) { s.mode = 'dash'; s.timer = 0.42; e.vx = Math.cos(s.ang) * 540; e.vy = Math.sin(s.ang) * 540; } }
      else if (s.mode === 'dash') { if (Math.random() < 0.6) particle({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0.3, max: 0.3, size: 6, color: '#ff5470', shape: 'circle', drag: 0, grav: 0, rot: 0, vr: 0, add: true }); if (s.timer <= 0) { s.mode = 'recover'; s.timer = 0.6; } }
      else { damp(e, 6, dt); if (s.timer <= 0) { s.mode = 'approach'; s.timer = rand(1, 1.8); } }
    },
    draw(e) {
      const s = e.st;
      if (s.mode === 'wind') {
        ctx.save(); ctx.rotate(s.ang); ctx.strokeStyle = 'rgba(255,84,112,0.6)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(200, 0); ctx.stroke(); ctx.restore();
        ctx.translate(rand(-1.5, 1.5), rand(-1.5, 1.5));
      }
      ctx.fillStyle = fc(e, '#ff5470');
      ctx.beginPath(); ctx.arc(-9, -11, 5, 0, TAU); ctx.arc(9, -11, 5, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill();
      ctx.fillStyle = fc(e, '#fff5f6'); ctx.beginPath(); ctx.arc(0, 0, 10.5, 0, TAU); ctx.fill();
      const sp = s.mode === 'wind' ? 30 : 4;
      ctx.strokeStyle = '#2a0b12'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(e.t * sp) * 8, Math.sin(e.t * sp) * 8);
      ctx.moveTo(0, 0); ctx.lineTo(Math.cos(e.t * sp / 12) * 5, Math.sin(e.t * sp / 12) * 5); ctx.stroke();
      if (s.mode === 'wind') txt('!', 0, -26, { size: 16, align: 'center', color: '#ff5470', weight: 900, stroke: '#000', strokeW: 3 });
    },
  },
  toets: {
    hp: 5, r: 14, score: 20, color: '#ffffff', pts: 3,
    init(e) { e.st.cd = rand(1, 2); e.st.side = Math.random() < 0.5 ? 1 : -1; },
    update(e, dt) {
      const p = G.player, d = dist(e.x, e.y, p.x, p.y), a = aimP(e), s = e.st;
      if (d < 190) seekAng(e, a + Math.PI, 85, dt);
      else if (d > 280) seekAng(e, a, 85, dt);
      else seekAng(e, a + (Math.PI / 2) * s.side, 60, dt, 2);
      if (Math.random() < dt * 0.3) s.side *= -1;
      s.cd -= dt;
      if (s.cd <= 0) { s.cd = rand(1.6, 2.2); eFan(e.x, e.y, a, 3, 0.32, 175, { color: '#ff5470', r: 4.5 }); Snd.sfx.eshoot(); }
    },
    draw(e) {
      ctx.rotate(Math.sin(e.t * 2) * 0.12);
      if (e.st.cd < 0.35) { ctx.fillStyle = 'rgba(255,84,112,0.4)'; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.fill(); }
      ctx.fillStyle = fc(e, '#f6f4ee'); rr(-12, -15, 24, 30, 3); ctx.fill();
      ctx.fillStyle = '#b9bccb'; for (let i = 0; i < 4; i++) ctx.fillRect(-8, -5 + i * 5, 16 - (i % 2) * 5, 1.6);
      txt('TOETS', 0, -10, { size: 6.5, align: 'center', color: '#3a4a6a', weight: 900 });
      ctx.strokeStyle = '#ff3b5c'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(6, 8, 5, 0, TAU); ctx.stroke();
      txt('?', 6, 8.5, { size: 8, align: 'center', color: '#ff3b5c', weight: 900 });
    },
  },
  stapel: {
    hp: 8, r: 19, score: 25, color: '#f6f4ee', pts: 3, kb: 0.4,
    update(e, dt) { seekAng(e, aimP(e), 44, dt, 2); },
    draw(e) {
      for (let i = 3; i >= 0; i--) {
        ctx.save(); ctx.translate(Math.sin(i * 2.1 + e.t) * 2, -i * 4); ctx.rotate(Math.sin(i * 1.7) * 0.15);
        ctx.fillStyle = fc(e, i % 2 ? '#e8e2d0' : '#fbf8ef'); rr(-17, -6, 34, 18, 2); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(-13, -1, 22, 1.5); ctx.fillRect(-13, 3, 16, 1.5);
        ctx.restore();
      }
      ctx.translate(0, -12); eyes(e, 6, 0, 3.4);
      ctx.strokeStyle = '#13233d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, -6); ctx.lineTo(-3, -3); ctx.moveTo(10, -6); ctx.lineTo(3, -3); ctx.stroke();
    },
    onDeath(e) {
      debris(e.x, e.y, '#f6f4ee', 8, 260);
      for (let i = 0; i < 3; i++) { const b = spawnEnemy('blaadje', e.x, e.y, { instant: true }); const a = rand(TAU); b.vx = Math.cos(a) * 240; b.vy = Math.sin(a) * 240; }
    },
  },
  blaadje: {
    hp: 1, r: 8, score: 5, color: '#fbf8ef', pts: 1,
    update(e, dt) { seekAng(e, aimP(e) + Math.sin(e.t * 6) * 0.5, 150, dt, 2.2); },
    draw(e) {
      ctx.rotate(e.t * 5);
      ctx.fillStyle = fc(e, '#fbf8ef'); ctx.fillRect(-6, -8, 12, 16);
      ctx.fillStyle = '#9aa3b8'; ctx.fillRect(-4, -4, 8, 1.2); ctx.fillRect(-4, 0, 6, 1.2); ctx.fillRect(-4, 4, 7, 1.2);
    },
  },
  deadline: {
    hp: 6, r: 14, score: 30, color: '#ff3b3b', pts: 4, kb: 0.5,
    update(e, dt) {
      const spd = 40 + Math.min(e.t, 7) / 7 * 210;
      seekAng(e, aimP(e), spd, dt, 2.2);
      if (Math.random() < dt * 30) particle({ x: e.x + rand(-6, 6), y: e.y + rand(-6, 6), vx: rand(-20, 20), vy: rand(-60, -20), life: 0.4, max: 0.4, size: rand(3, 6), color: pick(['#ff3b3b', '#ff9f43', '#ffd84a']), shape: 'circle', drag: 1, grav: 0, rot: 0, vr: 0, add: true });
    },
    draw(e) {
      const k = Math.min(e.t, 7) / 7;
      ctx.fillStyle = `rgba(255,59,59,${0.15 + k * 0.3})`; ctx.beginPath(); ctx.arc(0, 0, 20 + Math.sin(e.t * 12) * 3, 0, TAU); ctx.fill();
      ctx.fillStyle = fc(e, '#7a0b14'); ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill();
      ctx.strokeStyle = fc(e, '#ff3b3b'); ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = '#ffd84a';
      ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(6, -8); ctx.lineTo(0, 0); ctx.lineTo(6, 8); ctx.lineTo(-6, 8); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
      txt(k > 0.8 ? 'NU!' : 'MORGEN', 0, 22, { size: 7, align: 'center', color: '#ff7a7a', weight: 900 });
    },
  },
  cijfer: {
    hp: 5, r: 16, score: 25, color: '#e5484d', pts: 3,
    init(e) { e.st.g = rand(1, 5.4); e.hp = e.maxhp = (4 + (5.5 - e.st.g) * 1.2) * (G.hpMul || 1); e.st.cd = rand(1.2, 2.6); e.st.tx = e.x; e.st.ty = e.y; },
    update(e, dt) {
      const s = e.st;
      if (dist(e.x, e.y, s.tx, s.ty) < 20 || Math.random() < dt * 0.3) { s.tx = rand(AX + 60, AR - 60); s.ty = rand(AY + 60, AB - 60); }
      seekAng(e, angTo(e.x, e.y, s.tx, s.ty), 55, dt, 2);
      s.cd -= dt;
      if (s.cd <= 0) { s.cd = rand(2.3, 3); eRing(e.x, e.y, 8, 140, rand(TAU), { color: '#ff6b70', r: 4.5 }); Snd.sfx.eshoot(); ringFx(e.x, e.y, '#e5484d', 30, 0.3, 3); }
    },
    draw(e) {
      const pulse = e.st.cd < 0.4 ? 1 + Math.sin(e.t * 40) * 0.08 : 1;
      ctx.scale(pulse, pulse);
      ctx.fillStyle = fc(e, '#e5484d'); rr(-22, -15, 44, 30, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5; rr(-22, -15, 44, 30, 7); ctx.stroke();
      txt(fmtGrade(e.st.g), 0, 1, { size: 16, align: 'center', weight: 900, color: '#fff' });
      ctx.fillStyle = '#13233d';
      ctx.fillRect(-14, -21, 9, 3); ctx.fillRect(5, -21, 9, 3);
    },
  },
  spook: {
    hp: 4, r: 13, score: 25, color: '#b9a8ff', pts: 3,
    init(e) { e.st.mode = 'chase'; e.st.timer = rand(1.5, 2.5); e.alpha = 1; },
    update(e, dt) {
      const s = e.st, p = G.player; s.timer -= dt;
      if (s.mode === 'chase') { seekAng(e, aimP(e), 72, dt, 3); e.alpha = Math.min(1, e.alpha + dt * 3); if (s.timer <= 0) { s.mode = 'fade'; s.timer = 0.4; } }
      else if (s.mode === 'fade') { damp(e, 6, dt); e.alpha = s.timer / 0.4; if (s.timer <= 0) { s.mode = 'hidden'; s.timer = 1.0; } }
      else if (s.mode === 'hidden') {
        e.alpha = 0; damp(e, 6, dt);
        if (s.timer <= 0) { const a = rand(TAU), r = rand(110, 150); e.x = clamp(p.x + Math.cos(a) * r, AX + 20, AR - 20); e.y = clamp(p.y + Math.sin(a) * r, AY + 20, AB - 20); s.mode = 'appear'; s.timer = 0.4; }
      } else { e.alpha = 1 - s.timer / 0.4; if (s.timer <= 0) { s.mode = 'chase'; s.timer = rand(1.8, 2.6); eRing(e.x, e.y, 6, 120, rand(TAU), { color: '#b9a8ff', r: 4.5 }); Snd.sfx.eshoot(); } }
      e.ghost = e.alpha < 0.5;
    },
    draw(e) {
      ctx.globalAlpha *= e.alpha;
      ctx.translate(0, Math.sin(e.t * 3) * 3);
      ctx.fillStyle = fc(e, 'rgba(185,168,255,0.85)'); ghostShape(14); ctx.fill();
      ctx.fillStyle = '#1a0f33';
      ctx.beginPath(); ctx.ellipse(-5, -5, 2.6, 4, 0, 0, TAU); ctx.ellipse(5, -5, 2.6, 4, 0, 0, TAU); ctx.fill();
      txt('A', 0, 7, { size: 9, align: 'center', color: '#5b3fd1', weight: 900 });
    },
  },
  melding: {
    hp: 3, r: 11, score: 20, color: '#ff4d6d', pts: 2,
    init(e) { e.st.a = rand(TAU); e.st.dir = Math.random() < 0.5 ? 1 : -1; e.st.cd = rand(1.4, 2.4); e.st.n = randi(1, 3); },
    update(e, dt) {
      const s = e.st, p = G.player;
      s.a += dt * 0.7 * s.dir;
      const tx = p.x + Math.cos(s.a) * 190, ty = p.y + Math.sin(s.a) * 190;
      seekAng(e, angTo(e.x, e.y, tx, ty), Math.min(170, dist(e.x, e.y, tx, ty) * 2), dt, 3);
      s.cd -= dt;
      if (s.cd <= 0) { s.cd = rand(2, 2.6); s.n++; eFan(e.x, e.y, aimP(e), 3, 0.35, 190, { color: '#ff4d6d', r: 4.5 }); Snd.sfx.eshoot(); }
    },
    draw(e) {
      ctx.fillStyle = fc(e, '#ff4d6d'); ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      txt(String(Math.min(99, e.st.n)), 0, 1, { size: 12, align: 'center', weight: 900 });
    },
  },
};

// ───────────────────────────── bosses ─────────────────────────────
const BOSS_SPRITES = {
  achtsteuur(x, y, s, t, o) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const red = o.phase > 1, fl = o.flash;
    ctx.fillStyle = fl ? '#fff' : red ? '#3a1630' : '#18366a'; rr(-55, -60, 110, 120, 16); ctx.fill();
    ctx.strokeStyle = red ? '#ff5470' : '#7cc4ff'; ctx.lineWidth = 3; rr(-55, -60, 110, 120, 16); ctx.stroke();
    ctx.fillStyle = red ? '#ff5470' : '#41a6ff'; rr(-55, -60, 110, 26, 14); ctx.fill(); ctx.fillRect(-55, -46, 110, 12);
    txt('8e UUR', 0, -46, { size: 14, align: 'center', weight: 900 });
    const pa = o.ent ? aimP(o.ent) : Math.PI / 2;
    for (const ex of [-18, 18]) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, -20, 9, 7, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = red ? '#ff1f4b' : '#0b1a33'; ctx.beginPath(); ctx.arc(ex + Math.cos(pa) * 3, -20 + Math.sin(pa) * 2, 3.6, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = '#0b1a33'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-28, -32); ctx.lineTo(-9, -26); ctx.moveTo(28, -32); ctx.lineTo(9, -26); ctx.stroke();
    ctx.fillStyle = '#eaf4ff'; ctx.beginPath(); ctx.arc(0, 22, 30, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#0b1a33'; ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) { const a = (i * TAU) / 12; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 24, 22 + Math.sin(a) * 24); ctx.lineTo(Math.cos(a) * 28, 22 + Math.sin(a) * 28); ctx.stroke(); }
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(0, 22); ctx.lineTo(Math.cos(t * 0.6 - 1.5) * 15, 22 + Math.sin(t * 0.6 - 1.5) * 15); ctx.stroke();
    ctx.strokeStyle = red ? '#ff1f4b' : '#1f6fd6'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, 22); ctx.lineTo(Math.cos(t * 4) * 23, 22 + Math.sin(t * 4) * 23); ctx.stroke();
    ctx.fillStyle = '#0b1a33'; ctx.beginPath(); ctx.arc(0, 22, 3, 0, TAU); ctx.fill();
    ctx.restore();
  },
  werkstuk(x, y, s, t, o) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(Math.sin(t * 1.3) * 0.05);
    const red = o.phase > 1;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-46, -60, 100, 130);
    ctx.fillStyle = o.flash ? '#fff' : red ? '#f3ddd0' : '#f6f2e6';
    ctx.beginPath(); ctx.moveTo(-52, -66); ctx.lineTo(30, -66); ctx.lineTo(52, -44); ctx.lineTo(52, 66); ctx.lineTo(-52, 66); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d8d0b8'; ctx.beginPath(); ctx.moveTo(30, -66); ctx.lineTo(30, -44); ctx.lineTo(52, -44); ctx.closePath(); ctx.fill();
    txt('WERKSTUK', -2, -52, { size: 13, align: 'center', weight: 900, color: '#1d2b4a' });
    ctx.fillStyle = '#b8b4a8';
    for (let i = 0; i < 9; i++) { if (i === 2 || i === 3) continue; ctx.fillRect(-40, -38 + i * 10, 70 + Math.sin(i * 3.3) * 10, 3); }
    for (const ex of [-17, 17]) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1d2b4a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(ex, -12, 9, 8, 0, 0, TAU); ctx.fill(); ctx.stroke();
      const pa = o.ent ? aimP(o.ent) : Math.PI / 2;
      ctx.fillStyle = red ? '#d61f3a' : '#1d2b4a'; ctx.beginPath(); ctx.arc(ex + Math.cos(pa) * 3, -12 + Math.sin(pa) * 3, 3.5, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = '#1d2b4a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-28, -26); ctx.lineTo(-8, -20); ctx.moveTo(28, -26); ctx.lineTo(8, -20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-18, 30);
    for (let i = 0; i <= 6; i++) ctx.lineTo(-18 + i * 6, 30 + (i % 2 ? -5 : 3) * (o.talk ? 1 + Math.sin(t * 20) * 0.5 : 1));
    ctx.stroke();
    ctx.strokeStyle = '#ff3b5c'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(32, 46, 9, 0, TAU); ctx.stroke();
    txt('-1', 32, 46, { size: 10, align: 'center', weight: 900, color: '#ff3b5c' });
    ctx.restore();
  },
  gemiddelde(x, y, s, t, o) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const avg = 1 + 9 * (1 - (o.hpk ?? 1));
    const col = avg >= 5.5 ? '#2fbf71' : avg >= 4 ? '#ff9f43' : '#e5484d';
    for (let k = 0; k < 2; k++) {
      const a = t * 1.5 + k * Math.PI;
      const sx = Math.cos(a) * 84, sy = Math.sin(a) * 84;
      ctx.fillStyle = k ? '#e5484d' : '#c43c6a'; rr(sx - 18, sy - 12, 36, 24, 5); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; rr(sx - 18, sy - 12, 36, 24, 5); ctx.stroke();
      txt(k ? '2,1' : '3,4', sx, sy + 1, { size: 12, align: 'center', weight: 900 });
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.arc(0, 0, 84, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = o.flash ? '#fff' : '#1a0f33'; ctx.beginPath(); ctx.arc(0, 0, 52, 0, TAU); ctx.fill();
    ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(0, 0, 50, 0, TAU); ctx.stroke();
    ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(0, 0, 50, -Math.PI / 2, -Math.PI / 2 + TAU * ((avg - 1) / 9)); ctx.stroke();
    txt(fmtGrade(avg), 0, 10, { size: 34, align: 'center', weight: 900, color: col });
    txt('GEMIDDELDE', 0, 34, { size: 8, align: 'center', weight: 900, color: 'rgba(255,255,255,0.6)' });
    ctx.fillStyle = '#fff';
    ctx.save(); ctx.translate(-14, -22); ctx.rotate(0.3); ctx.fillRect(-8, -2.5, 16, 5); ctx.restore();
    ctx.save(); ctx.translate(14, -22); ctx.rotate(-0.3); ctx.fillRect(-8, -2.5, 16, 5); ctx.restore();
    ctx.restore();
  },
  verzuim(x, y, s, t, o) {
    ctx.save(); ctx.translate(x, y + Math.sin(t * 2) * 3); ctx.scale(s, s);
    ctx.globalAlpha *= o.alpha ?? 1;
    ctx.fillStyle = o.flash ? '#fff' : '#241a3d';
    ctx.beginPath(); ctx.moveTo(0, -62); ctx.quadraticCurveTo(34, -60, 36, -20); ctx.lineTo(52, 60);
    for (let i = 0; i <= 6; i++) ctx.lineTo(52 - i * (104 / 6), 60 + (i % 2 ? 8 : 0) + Math.sin(t * 6 + i) * 3);
    ctx.lineTo(-36, -20); ctx.quadraticCurveTo(-34, -60, 0, -62); ctx.fill();
    ctx.strokeStyle = '#6b55c9'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#05030a'; ctx.beginPath(); ctx.ellipse(0, -28, 22, 24, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = o.phase > 1 ? '#ff3b5c' : '#c6b6ff'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.ellipse(-8, -30, 4, 2.5, 0.3, 0, TAU); ctx.ellipse(8, -30, 4, 2.5, -0.3, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.save(); ctx.translate(-26, 18); ctx.rotate(-0.2);
    ctx.fillStyle = '#8a6a3a'; rr(-16, -20, 32, 42, 3); ctx.fill();
    ctx.fillStyle = '#f6f2e6'; ctx.fillRect(-13, -14, 26, 33);
    ctx.fillStyle = '#9aa3b8'; for (let i = 0; i < 4; i++) ctx.fillRect(-10, -9 + i * 6, 14, 1.5);
    txt('A', 7, 10, { size: 13, align: 'center', weight: 900, color: '#e5484d' });
    ctx.fillStyle = '#c0c0c0'; ctx.fillRect(-6, -22, 12, 5);
    ctx.restore();
    ctx.restore();
  },
  mentor(x, y, s, t, o) { drawMentor(x, y, s * 1.35, t, o.talk, true); },
  onvoldoende(x, y, s, t, o) { drawOnv(x, y, s * 1.25 * (o.phase > 1 ? 1.1 : 1), t, o.talk); },
};

const ESSAY_WORDS = ['dus', 'echter', 'kortom', 'bovendien', 'ten eerste', 'concluderend', 'bron?', 'zie bijlage', 'enz.', 'derhalve', 'aldus', 'Wikipedia'];
const MENTOR_LINES = ['LET OP JE INZET', 'KAN BETER', 'STORENDE HOUDING', 'HUISWERK VERGETEN', 'TE LAAT', 'GOED BEZIG!', 'TELEFOON WEG', 'ZIT STIL'];

function bossHover(e, dt, k = 1.4, top = 0.45) {
  const s = e.st;
  if (s.hx === undefined || e.t > s.hnext) { s.hx = rand(AX + 140, AR - 140); s.hy = rand(AY + 90, AY + (AB - AY) * top); s.hnext = e.t + rand(2, 3.5); }
  const f = 1 - Math.exp(-2 * dt);
  e.vx = lerp(e.vx, (s.hx - e.x) * k, f); e.vy = lerp(e.vy, (s.hy - e.y) * k, f);
}
function bounce(e) {
  let b = false;
  if (e.x - e.r < AX) { e.x = AX + e.r; e.vx = Math.abs(e.vx); b = true; }
  if (e.x + e.r > AR) { e.x = AR - e.r; e.vx = -Math.abs(e.vx); b = true; }
  if (e.y - e.r < AY) { e.y = AY + e.r; e.vy = Math.abs(e.vy); b = true; }
  if (e.y + e.r > AB) { e.y = AB - e.r; e.vy = -Math.abs(e.vy); b = true; }
  if (b) { addShake(6); Snd.sfx.slam(); burst(e.x, e.y, e.d.color, 10, 200); }
  return b;
}
function bossSpawnMinion(e, type, n) {
  for (let i = 0; i < n; i++) { const [x, y] = spawnPos(160); spawnEnemy(type, x, y); }
}

const BOSSES = {
  achtsteuur: {
    name: 'HET 8STE UUR', quote: '"Nobody goes home early."', hp: 150, r: 50, color: '#7cc4ff', music: 'boss', sprite: 'achtsteuur',
    patterns: [
      { id: 'rings', dur: 2.8, tick(e, dt, t, s) { every(s, 'a', e.phase > 1 ? 0.42 : 0.6, dt, () => { s.n = (s.n || 0) + 1; eRing(e.x, e.y + 22, e.phase > 1 ? 18 : 14, 150, s.n * 0.2, { color: '#7cc4ff', r: 5.5 }); Snd.sfx.eshoot(); }); } },
      { id: 'summon', dur: 1.8, start(e) { bossSpawnMinion(e, e.phase > 1 ? 'telaat' : 'tussenuur', 3); } },
      {
        id: 'charge', dur: 3.0, own: true,
        tick(e, dt, t, s) {
          if (t < 0.75) { damp(e, 8, dt); s.ang = aimP(e); e.tele = s.ang; }
          else if (t < 2.0) {
            if (!s.go) { s.go = true; e.tele = null; e.vx = Math.cos(s.ang) * 560; e.vy = Math.sin(s.ang) * 560; Snd.sfx.whoosh(); }
            bounce(e);
            every(s, 'tr', 0.07, dt, () => eShot(e.x, e.y, rand(TAU), 35, { color: '#9fd4ff', r: 5, life: 4 }));
          } else damp(e, 5, dt);
        },
      },
      {
        id: 'clock', dur: 4.4, own: true,
        start(e) {
          addLaser({ follow: e, ang: -Math.PI / 2, len: 560, w: 14, warn: 1.0, dur: 2.8, rot: 1.0, color: '#7cc4ff', label: 'TIK' });
          addLaser({ follow: e, ang: Math.PI / 6, len: 380, w: 22, warn: 1.0, dur: 2.8, rot: -0.55, color: '#ff9f43', label: 'TAK' });
        },
        tick(e, dt, t, s) { damp(e, 6, dt); if (e.phase > 1 && t > 1) every(s, 'r', 0.9, dt, () => eRing(e.x, e.y, 10, 120, t, { color: '#9fd4ff', r: 4.5 })); },
      },
    ],
  },
  werkstuk: {
    name: 'HET WERKSTUK', quote: '"2000 words. Minimum. Sources required."', hp: 190, r: 52, color: '#2ee6b5', music: 'boss', sprite: 'werkstuk',
    patterns: [
      {
        id: 'words', dur: 3.4,
        start(e, s) { s.base = aimP(e); },
        tick(e, dt, t, s) { every(s, 'w', e.phase > 1 ? 0.08 : 0.12, dt, () => { const a = s.base + Math.sin(t * 2.4) * 0.95; eShot(e.x, e.y + 20, a, 175, { kind: 'text', text: pick(ESSAY_WORDS), color: '#d9fff4', r: 6 }); Snd.sfx.eshoot(); }); },
      },
      {
        id: 'cite', dur: 2.6,
        tick(e, dt, t, s) {
          const fire = () => { for (let i = 0; i < 5; i++) eShot(e.x, e.y, aimP(e) + (i - 2) * 0.5, 160, { kind: 'text', text: `[${i + 1}]`, color: '#ffd84a', r: 6, home: 1.5, homeRate: 2.0 }); Snd.sfx.eshoot(); };
          if (!s.a) { s.a = 1; fire(); }
          if (e.phase > 1 && t > 1.2 && !s.b) { s.b = 1; fire(); }
        },
      },
      { id: 'pages', dur: 1.8, start(e) { for (let i = 0; i < (e.phase > 1 ? 6 : 4); i++) { const b = spawnEnemy('blaadje', e.x, e.y, { instant: true }); const a = rand(TAU); b.vx = Math.cos(a) * 260; b.vy = Math.sin(a) * 260; } debris(e.x, e.y, '#f6f2e6', 10, 260); } },
      { id: 'fan', dur: 2.4, tick(e, dt, t, s) { every(s, 'f', 0.55, dt, () => { eFan(e.x, e.y, aimP(e), 7, 1.1, 195, { color: '#2ee6b5', r: 5 }); Snd.sfx.eshoot(); }); } },
      {
        id: 'lines', dur: 3.0, phase: 2,
        start(e) {
          const rows = 6, gap = randi(0, rows - 1);
          for (let i = 0; i < rows; i++) if (i !== gap) addLaser({ x: AX, y: AY + 38 + i * 76, ang: 0, len: AR - AX, w: 16, warn: 1.2, dur: 0.7, color: '#2ee6b5', label: 'BRON?' });
        },
      },
    ],
    onPhase(e) { floatText(e.x, e.y - 80, 'DEADLINE: NOW', '#ff5470', 22, { dur: 1.6 }); },
  },
  gemiddelde: {
    name: 'HET GEMIDDELDE', quote: '"I am what you are. On average."', hp: 220, r: 52, color: '#c48bff', music: 'boss', sprite: 'gemiddelde',
    patterns: [
      { id: 'spiral', dur: 3.4, tick(e, dt, t, s) { every(s, 'a', 0.075, dt, () => { s.ang = (s.ang || 0) + 0.31; const arms = e.phase > 1 ? 4 : 2; for (let k = 0; k < arms; k++) eShot(e.x, e.y, s.ang + (k * TAU) / arms, 150, { color: '#c48bff', r: 5 }); }); } },
      { id: 'rain', dur: 3.0, tick(e, dt, t, s) { every(s, 'r', e.phase > 1 ? 0.12 : 0.17, dt, () => eShot(rand(AX + 15, AR - 15), AY + 4, Math.PI / 2 + rand(-0.12, 0.12), rand(140, 210), { kind: 'tile', text: fmtGrade(rand(1, 5.4)), color: '#e5484d', r: 8 })); } },
      {
        id: 'orbs', dur: 2.8,
        tick(e, dt, t, s) {
          every(s, 'o', 0.3, dt, () => {
            s.k = (s.k || 0) + 1;
            const a = e.t * 1.5 + (s.k % 2) * Math.PI;
            const sx = e.x + Math.cos(a) * 84, sy = e.y + Math.sin(a) * 84;
            eFan(sx, sy, angTo(sx, sy, G.player.x, G.player.y), e.phase > 1 ? 3 : 1, 0.3, 230, { color: '#ff6b70', r: 5 });
            Snd.sfx.eshoot();
          });
        },
      },
      { id: 'rings', dur: 2.6, tick(e, dt, t, s) { every(s, 'q', 0.5, dt, () => { s.n = (s.n || 0) + 1; eRing(e.x, e.y, 16, s.n % 2 ? 120 : 190, s.n * 0.2, { color: s.n % 2 ? '#c48bff' : '#ff6b70', r: 5 }); }); } },
    ],
    onPhase(e) { floatText(e.x, e.y - 90, 'VOLDOENDE?! IMPOSSIBLE!', '#2fbf71', 22, { dur: 1.8 }); },
  },
  verzuim: {
    name: 'DE VERZUIMCOÖRDINATOR', quote: '"Absent is absent."', hp: 240, r: 44, color: '#a58bff', music: 'boss', sprite: 'verzuim',
    patterns: [
      {
        id: 'blink', dur: 3.2, own: true,
        tick(e, dt, t, s) {
          damp(e, 8, dt);
          const cyc = t % 1.6, n = Math.floor(t / 1.6);
          if (cyc < 0.4) e.alpha = 1 - cyc / 0.4;
          else if (cyc < 0.55) { e.alpha = 0; if (s.moved !== n) { s.moved = n; const p = G.player, a = rand(TAU); e.x = clamp(p.x + Math.cos(a) * 230, AX + 60, AR - 60); e.y = clamp(p.y + Math.sin(a) * 230, AY + 60, AB - 60); } }
          else { e.alpha = Math.min(1, (cyc - 0.55) / 0.2); if (cyc > 0.75 && s.shot !== n) { s.shot = n; eRing(e.x, e.y, e.phase > 1 ? 20 : 14, 150, rand(TAU), { color: '#c6b6ff', r: 5 }); Snd.sfx.eshoot(); ringFx(e.x, e.y, '#a58bff', 60, 0.4, 4); } }
          e.ghost = e.alpha < 0.5;
        },
      },
      {
        id: 'absent', dur: 2.8,
        start(e) {
          const vert = Math.random() < 0.5;
          const both = e.phase > 1;
          const mk = v => { const n = v ? 6 : 4, gap = randi(0, n - 1); for (let i = 0; i < n; i++) { if (i === gap) continue; if (v) addLaser({ x: AX + 70 + i * 160, y: AY, ang: Math.PI / 2, len: AB - AY, w: 18, warn: 1.2, dur: 0.7, color: '#a58bff', label: 'AFWEZIG' }); else addLaser({ x: AX, y: AY + 55 + i * 115, ang: 0, len: AR - AX, w: 18, warn: 1.2, dur: 0.7, color: '#a58bff', label: 'AFWEZIG' }); } };
          mk(vert); if (both) mk(!vert);
        },
      },
      { id: 'summon', dur: 2.0, start(e) { bossSpawnMinion(e, 'spook', e.phase > 1 ? 3 : 2); } },
      { id: 'cross', dur: 2.8, tick(e, dt, t, s) { every(s, 'c', 0.32, dt, () => { s.k = (s.k || 0) + 1; eRing(e.x, e.y, e.phase > 1 ? 6 : 4, 170, s.k * 0.35, { color: '#c6b6ff', r: 5.5 }); }); } },
    ],
  },
  mentor: {
    name: 'MENTOR.EXE', quote: '"Automatically generated comment: DISAPPOINTING."', hp: 270, r: 54, color: '#4dffa6', music: 'final', sprite: 'mentor',
    patterns: [
      { id: 'comments', dur: 3.0, tick(e, dt, t, s) { every(s, 'c', e.phase > 1 ? 0.35 : 0.5, dt, () => { eShot(e.x, e.y, aimP(e) + rand(-0.2, 0.2), 210, { kind: 'text', text: pick(MENTOR_LINES), color: e.phase > 1 ? '#ff6b70' : '#4dffa6', r: 8, size: 12 }); Snd.sfx.eshoot(); }); } },
      {
        id: 'grid', dur: 3.4,
        start(e) {
          const off = rand(0, 60);
          for (let i = 0; i < 6; i++) addLaser({ x: AX + 60 + off + i * 150, y: AY, ang: Math.PI / 2, len: AB - AY, w: 14, warn: 1.1, dur: 0.6, color: '#4dffa6', label: 'ERROR' });
        },
        tick(e, dt, t, s) {
          if (e.phase > 1 && t > 1.3 && !s.h) { s.h = 1; const off = rand(0, 40); for (let i = 0; i < 4; i++) addLaser({ x: AX, y: AY + 50 + off + i * 110, ang: 0, len: AR - AX, w: 14, warn: 1.0, dur: 0.6, color: '#ff6b70', label: 'ERROR' }); }
        },
      },
      { id: 'windmill', dur: 3.0, tick(e, dt, t, s) { every(s, 'w', 0.14, dt, () => { s.a = (s.a || 0) + 0.24; for (let k = 0; k < 5; k++) eShot(e.x, e.y, s.a + (k * TAU) / 5, 160, { color: e.phase > 1 ? '#ff6b70' : '#4dffa6', r: 4.5 }); }); } },
      { id: 'popup', dur: 2.0, start(e) { bossSpawnMinion(e, 'melding', e.phase > 1 ? 4 : 3); } },
      {
        id: 'reboot', dur: 3.6, phase: 2, own: true,
        tick(e, dt, t, s) {
          const f = 1 - Math.exp(-3 * dt);
          e.vx = lerp(e.vx, (W / 2 - e.x) * 2, f); e.vy = lerp(e.vy, ((AY + AB) / 2 - e.y) * 2, f);
          if (t < 0.9) { if (Math.random() < 0.5) burst(e.x + rand(-60, 60), e.y + rand(-50, 50), '#4dffa6', 1, 40); }
          else every(s, 'r', 0.2, dt, () => { s.n = (s.n || 0) + 1; eRing(e.x, e.y, 12, 125, s.n * 0.26, { color: '#1fd7ff', r: 4.5, kind: 'sq' }); });
        },
      },
    ],
    onPhase() { G.mentorInfected = true; glitch(0.5); },
  },
  onvoldoende: {
    name: 'DE ONVOLDOENDE', quote: '"I am the 1,0 that never ends."', hp: 340, r: 56, color: '#ff3b5c', music: 'final', sprite: 'onvoldoende',
    patterns: [
      { id: 'hell', dur: 4.0, tick(e, dt, t, s) { every(s, 'h', 0.065, dt, () => { s.a = (s.a || 0) + 0.19 + (e.phase > 1 ? Math.sin(t * 1.5) * 0.12 : 0); const arms = e.phase > 1 ? 5 : 3; for (let k = 0; k < arms; k++) eShot(e.x, e.y, s.a + (k * TAU) / arms, 140, { color: '#ff3b5c', r: 5 }); }); } },
      { id: 'mines', dur: 2.8, tick(e, dt, t, s) { every(s, 'm', e.phase > 1 ? 0.35 : 0.5, dt, () => { const tx = rand(AX + 60, AR - 60), ty = rand(AY + 60, AB - 60); const d = dist(e.x, e.y, tx, ty); eShot(e.x, e.y, angTo(e.x, e.y, tx, ty), d * 1.6, { color: '#ff9f43', r: 7, acc: -d * 1.6, minSpd: 0, fuse: 1.0 }); }); } },
      {
        id: 'chase', dur: 3.3, own: true,
        tick(e, dt, t, s) {
          const cyc = t % 1.1, n = Math.floor(t / 1.1);
          if (n >= 3) { damp(e, 6, dt); e.tele = null; return; }
          if (cyc < 0.45) { damp(e, 10, dt); s.ang = aimP(e); e.tele = s.ang; }
          else if (s.go !== n) { s.go = n; e.tele = null; e.vx = Math.cos(s.ang) * 640; e.vy = Math.sin(s.ang) * 640; Snd.sfx.whoosh(); }
          else { if (bounce(e) || cyc > 0.95) { if (s.rb !== n) { s.rb = n; eRing(e.x, e.y, 10, 150, rand(TAU), { color: '#ff3b5c', r: 5 }); } damp(e, 6, dt); } }
        },
      },
      {
        id: 'eat', dur: 4.2, own: true,
        start(e) { const n = e.phase > 1 ? 6 : 4, r = Math.random() < 0.5 ? 0.55 : -0.55; for (let i = 0; i < n; i++) addLaser({ follow: e, ang: (i * TAU) / n, len: 700, w: 16, warn: 1.1, dur: 2.6, rot: r, color: '#ff3b5c', label: '1,0' }); },
        tick(e, dt, t, s) { damp(e, 6, dt); if (t > 1.1) every(s, 'r', 0.7, dt, () => eRing(e.x, e.y, 8, 110, t, { color: '#ff9f43', r: 4.5 })); },
      },
      {
        id: 'glitchrain', dur: 3.2, phase: 2,
        tick(e, dt, t, s) {
          every(s, 'g', 0.09, dt, () => { const top = Math.random() < 0.5; eShot(rand(AX + 10, AR - 10), top ? AY + 4 : AB - 4, top ? Math.PI / 2 : -Math.PI / 2, rand(130, 200), { kind: 'sq', color: pick(['#ff3b5c', '#1fd7ff']), r: 4.5 }); });
          every(s, 'fx', 0.8, dt, () => { glitch(0.15); Snd.sfx.glitch(); });
        },
      },
    ],
    onPhase(e) { glitch(0.8); floatText(e.x, e.y - 90, 'ERROR: GRADE OVERFLOW', '#ff3b5c', 20, { dur: 1.8 }); },
  },
};

function bossUpdate(e, dt) {
  const d = e.d;
  e.pt += dt;
  const durMul = e.phase > 1 ? 0.88 : 1;
  if (!e.pat || e.pt >= e.pat.dur * durMul) {
    if (e.pat && e.pat.own) e.tele = null;
    e.alpha = 1; e.ghost = false;
    const opts = d.patterns.filter(p => p !== e.pat && (!p.phase || p.phase <= e.phase));
    e.pat = pick(opts); e.pt = 0; e.ps = {};
    e.pat.start && e.pat.start(e, e.ps);
  }
  e.pat.tick && e.pat.tick(e, dt, e.pt, e.ps);
  if (!e.pat.own) bossHover(e, dt);
}

// ───────────────────────────── enemy lifecycle ─────────────────────────────
function spawnPos(minD = 200) {
  const p = G.player;
  let x = W / 2, y = AY + 80;
  for (let i = 0; i < 30; i++) {
    x = rand(AX + 40, AR - 40); y = rand(AY + 40, AB - 40);
    if (dist(x, y, p.x, p.y) >= minD) break;
  }
  return [x, y];
}

function spawnEnemy(type, x, y, o = {}) {
  const d = ENEMY[type] || BOSSES[type];
  const boss = !!BOSSES[type];
  const e = {
    type, d, x, y, vx: 0, vy: 0, r: d.r, hp: d.hp * (o.hpMul || G.hpMul || 1) * (boss && Save.data.chill ? 0.85 : 1),
    t: 0, flash: 0, spawnT: o.instant ? 0 : boss ? 2.4 : 0.75, st: {}, dead: false, boss, alpha: 1, ghost: false,
    phase: 1, pat: null, pt: 0, ps: {}, tele: null,
  };
  e.maxhp = e.hp;
  d.init && d.init(e, o);
  G.enemies.push(e);
  if (!o.instant && !boss) Snd.sfx.spawn();
  return e;
}

function damageEnemy(e, dmg, crit, kvx = 0, kvy = 0) {
  if (e.dead || e.spawnT > 0 || e.ghost) return;
  e.hp -= dmg; e.flash = 0.07;
  if (!e.boss) { const k = 0.08 * (e.d.kb ?? 1); e.vx += kvx * k; e.vy += kvy * k; }
  if (crit) { floatText(e.x + rand(-8, 8), e.y - e.r - 6, 'CRIT!', '#ffd84a', 13, { dur: 0.5 }); Snd.sfx.crit(); } else Snd.sfx.hit();
  if (e.boss && e.phase === 1 && e.hp <= e.maxhp * 0.5 && e.hp > 0) {
    e.phase = 2; e.pat = null; e.tele = null;
    flash('#ffffff', 0.5); addShake(14); Snd.sfx.roar(); glitch(0.25);
    for (const b of G.eb) burst(b.x, b.y, '#ffffff', 1, 60);
    G.eb.length = 0;
    ringFx(e.x, e.y, e.d.color, 300, 0.7, 10);
    floatText(e.x, e.y - e.r - 30, 'PHASE 2', '#ffffff', 26, { dur: 1.4 });
    e.d.onPhase && e.d.onPhase(e);
  }
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  e.dead = true;
  const col = e.d.color;
  if (e.boss) { bossDefeated(e); return; }
  burst(e.x, e.y, [col, '#ffffff'], 14, 260);
  debris(e.x, e.y, col, 3, 200);
  ringFx(e.x, e.y, col, e.r * 2.6, 0.3, 3);
  Snd.sfx.kill(); addShake(2.5);
  G.combo++; G.comboT = 2.6; G.bestCombo = Math.max(G.bestCombo, G.combo);
  const mult = 1 + Math.floor(G.combo / 10) * 0.5;
  G.score += Math.round(e.d.score * mult * G.player.s.scoreMul);
  G.player.special = Math.min(1, G.player.special + 0.055 * G.player.s.specialGain);
  dropPoints(e.x, e.y, e.d.pts || 2);
  if (G.player.hp < G.player.maxhp && Math.random() < 0.045) G.pickups.push({ x: e.x, y: e.y, vx: 0, vy: 0, kind: 'hp', t: 0, r: 10 });
  const tier = COMBO_TIERS.find(c => c[0] === G.combo);
  if (tier) { floatText(W / 2, 112, `COMBO ${G.combo}: ${tier[1]}!`, '#ffd84a', 22, { dur: 1.5, vy: -10 }); Snd.sfx.levelup(); }
  else if (Math.random() < 0.1) floatText(e.x, e.y - 12, pick(KILL_WORDS), '#ffffff', 13);
  G.stats.kills++;
  e.d.onDeath && e.d.onDeath(e);
}

function dropPoints(x, y, n) {
  for (let i = 0; i < n; i++) { const a = rand(TAU), s = rand(60, 160); G.pickups.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, kind: 'pt', t: 0, r: 5 }); }
}

function bossDefeated(e) {
  G.dyingBoss = { e, t: 0, x: e.x, y: e.y };
  slowmo(0.3, 1.0);
  flash('#ffffff', 0.9); addShake(20); Snd.sfx.boom(); glitch(0.4);
  for (const b of G.eb) { burst(b.x, b.y, '#ffd84a', 2, 80); G.pickups.push({ x: b.x, y: b.y, vx: 0, vy: 0, kind: 'pt', t: 0.6, r: 5 }); }
  G.eb.length = 0; G.lasers.length = 0;
  for (const o of G.enemies) if (!o.dead && o !== e) { o.dead = true; burst(o.x, o.y, [o.d.color, '#fff'], 10, 200); }
  G.score += 5000;
  G.stats.bosses++;
}

function updateEnemies(dt) {
  const p = G.player;
  for (const e of G.enemies) {
    if (e.dead) continue;
    if (e.spawnT > 0) { e.spawnT -= dt; if (e.spawnT <= 0 && !e.boss) { ringFx(e.x, e.y, e.d.color, 30, 0.3, 3); burst(e.x, e.y, e.d.color, 6, 120); } continue; }
    e.t += dt; e.flash -= dt;
    if (e.boss) bossUpdate(e, dt); else e.d.update(e, dt);
    e.x += e.vx * dt; e.y += e.vy * dt;
    e.x = clamp(e.x, AX + e.r * 0.6, AR - e.r * 0.6); e.y = clamp(e.y, AY + e.r * 0.6, AB - e.r * 0.6);
    if (!p.dead && !e.ghost && dist(e.x, e.y, p.x, p.y) < e.r + 5) hurtPlayer(p);
  }
  // gentle separation so swarms don't stack
  const list = G.enemies;
  for (let i = 0; i < list.length; i++) {
    const a = list[i]; if (a.dead || a.boss || a.spawnT > 0) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]; if (b.dead || b.boss || b.spawnT > 0) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
      if (d > 0 && d < m) { const push = (m - d) * 0.5 / d; a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push; }
    }
  }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].dead) list.splice(i, 1);
}

function drawEnemy(e) {
  if (e.spawnT > 0 && !e.boss) {
    const k = 1 - e.spawnT / 0.75;
    ctx.save(); ctx.translate(e.x, e.y);
    ctx.strokeStyle = e.d.color; ctx.globalAlpha = 0.4 + 0.4 * Math.sin(G.t * 25);
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, e.r + 14 * (1 - k), 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.6; txt('!', 0, 0, { size: 14, align: 'center', color: e.d.color, weight: 900 });
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.boss) {
    if (e.tele !== null && e.tele !== undefined) {
      ctx.save(); ctx.rotate(e.tele); ctx.strokeStyle = e.d.color; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(G.t * 30);
      ctx.lineWidth = 3; ctx.setLineDash([12, 8]); ctx.beginPath(); ctx.moveTo(e.r, 0); ctx.lineTo(900, 0); ctx.stroke(); ctx.restore();
    }
    let sc = 1;
    if (e.spawnT > 0) { const k = 1 - e.spawnT / 2.4; sc = ease.outElastic(clamp(k * 1.3, 0, 1)); ctx.globalAlpha = clamp(k * 2, 0, 1); }
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, e.r + 10, e.r * 0.9, 9, 0, 0, TAU); ctx.fill();
    BOSS_SPRITES[e.d.sprite](0, 0, sc, e.t + (e.spawnT > 0 ? G.t : 0), { flash: e.flash > 0, phase: e.phase, hpk: e.hp / e.maxhp, ent: e, alpha: e.alpha });
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, e.r + 4, e.r * 0.8, 4, 0, 0, TAU); ctx.fill();
    e.d.draw(e);
  }
  ctx.restore();
}

// ───────────────────────────── pickups ─────────────────────────────
function updatePickups(dt, vacuum) {
  const p = G.player;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const k = G.pickups[i];
    k.t += dt;
    damp(k, 4, dt);
    const d = dist(k.x, k.y, p.x, p.y);
    if (!p.dead && (vacuum || p.s.magnet || d < 110 || (k.kind === 'pt' && k.t > 1.2))) {
      const a = angTo(k.x, k.y, p.x, p.y), sp = 260 + k.t * 160 + (vacuum ? 400 : 0);
      k.vx = lerp(k.vx, Math.cos(a) * sp, 0.2); k.vy = lerp(k.vy, Math.sin(a) * sp, 0.2);
    }
    k.x += k.vx * dt; k.y += k.vy * dt;
    if (!p.dead && d < p.r + k.r + 4) {
      if (k.kind === 'pt') { G.score += Math.round(5 * p.s.scoreMul); p.special = Math.min(1, p.special + 0.008 * p.s.specialGain); G.ptChain = (G.ptChain || 0) + 1; Snd.sfx.pickup(G.ptChain); }
      else { p.hp = Math.min(p.maxhp, p.hp + 1); Snd.sfx.heal(); floatText(p.x, p.y - 24, '+1 BIJLES', '#2fbf71', 16); burst(p.x, p.y, '#2fbf71', 14, 180); }
      G.pickups.splice(i, 1);
    } else if (k.kind === 'hp' && k.t > 14) G.pickups.splice(i, 1);
  }
}

function drawPickups() {
  ctx.save();
  for (const k of G.pickups) {
    if (k.kind === 'pt') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(95,184,255,0.35)'; ctx.beginPath(); ctx.arc(k.x, k.y, 7, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.save(); ctx.translate(k.x, k.y); ctx.rotate(G.t * 4 + k.x);
      ctx.fillStyle = '#bfe6ff'; ctx.fillRect(-3, -3, 6, 6); ctx.restore();
    } else {
      const bob = Math.sin(G.t * 5) * 3;
      if (k.t > 11 && Math.floor(G.t * 10) % 2) continue;
      ctx.fillStyle = 'rgba(47,191,113,0.3)'; ctx.beginPath(); ctx.arc(k.x, k.y + bob, 16, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2fbf71'; rr(k.x - 11, k.y - 9 + bob, 22, 18, 4); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; rr(k.x - 11, k.y - 9 + bob, 22, 18, 4); ctx.stroke();
      txt('+1', k.x, k.y + bob + 1, { size: 11, align: 'center', weight: 900 });
    }
  }
  ctx.restore();
}

// ── 05-story.js ──
// ───────────────────────────── story ─────────────────────────────
// Each line: [speaker, text, fx?]. Speakers: ping, you, mentor, onv, sys (narration), log (terminal), or a boss sprite id.
const SPEAKERS = {
  ping: { name: 'PING', color: '#ffd84a', pitch: 2.1 },
  you: { name: null, color: '#5fb8ff', pitch: 1.1 },
  mentor: { name: 'MENTOR.EXE', color: '#ff6b70', pitch: 0.7 },
  mentorok: { name: 'MENTOR.EXE', color: '#4dffa6', pitch: 0.8 },
  onv: { name: 'DE ONVOLDOENDE', color: '#ff3b5c', pitch: 0.45 },
  achtsteuur: { name: 'HET 8STE UUR', color: '#7cc4ff', pitch: 0.6 },
  werkstuk: { name: 'HET WERKSTUK', color: '#2ee6b5', pitch: 0.75 },
  gemiddelde: { name: 'HET GEMIDDELDE', color: '#c48bff', pitch: 0.65 },
  verzuim: { name: 'DE VERZUIMCOÖRDINATOR', color: '#a58bff', pitch: 0.5 },
  sys: { name: '', color: '#9fb3d1', pitch: 1.3 },
  log: { name: 'SYSTEM LOG', color: '#4dff88', pitch: 1.6 },
};

const CHAPTERS = [
  {
    id: 'rooster', num: 1, title: 'HET ROOSTER', sub: 'The schedule is melting', clock: '23:52', theme: 'rooster', music: 'level', par: 170,
    steps: [
      { type: 'cutscene', id: 'prologue' },
      { type: 'card' },
      {
        type: 'dialog', lines: [
          ['sys', '...You wake up inside the screen. Everything smells like whiteboard markers.'],
          ['ping', '*ding!* Oh thank the server — a REAL student! Hi! I\'m PING!'],
          ['ping', 'You know me. I\'m the notification bell. The one that tells you about new grades. ...Sorry about those.'],
          ['you', 'Where am I? Why is everything so... blue?'],
          ['ping', 'You\'re inside Somtoday! Something is eating the database. Grades are vanishing. Schedules are melting. Homework is BREEDING.'],
          ['you', 'So... a normal Tuesday.'],
          ['ping', 'NO! At 00:00 the report cards lock forever. If that THING reaches the Rapport-server first, every grade in the country becomes a 1,0.'],
          ['you', 'Every grade?'],
          ['ping', 'Every. Single. One. Even gym.'],
          ['you', '...Okay. Now it\'s personal.'],
          ['ping', 'Your pen is your weapon! [WASD] move · [MOUSE] aim · [HOLD CLICK] write · [SPACE] dash through danger.'],
          ['ping', 'Beat enemies to fill your INLEVEREN meter. When it\'s full, press [E] or right-click to hand in EVERYTHING at once!'],
          ['ping', 'Here they come — free periods gone feral! Don\'t let them haunt you!'],
        ],
      },
      { type: 'wave', groups: [[0, 'tussenuur', 4], [3, 'tussenuur', 3]] },
      { type: 'dialog', lines: [['ping', 'Look out — LATE MARKS! They wind up, then charge. Dash right through them!']] },
      { type: 'wave', groups: [[0, 'tussenuur', 3], [0.5, 'telaat', 2], [4, 'telaat', 2], [6.5, 'tussenuur', 4]] },
      { type: 'dialog', lines: [['ping', 'You\'re a natural! Here — I salvaged some school supplies from the lost & found.']] },
      { type: 'upgrade' },
      { type: 'dialog', lines: [['ping', 'Tests incoming! They keep their distance and take cheap shots. Just like the real ones.']] },
      { type: 'wave', groups: [[0, 'toets', 2], [1, 'tussenuur', 4], [5, 'telaat', 3], [8, 'toets', 2], [9, 'tussenuur', 3]] },
      {
        type: 'dialog', lines: [
          ['sys', 'The bell rings. Then it rings again. And again. It doesn\'t stop.'],
          ['ping', 'Oh no. Oh no no no. That\'s not a normal bell. That\'s... the 8th period.'],
          ['you', 'The 8th period doesn\'t even exist on Fridays.'],
          ['ping', 'It exists NOW.'],
        ],
      },
      { type: 'boss', boss: 'achtsteuur' },
      {
        type: 'dialog', lines: [
          ['ping', 'You beat the 8th period! That has NEVER happened in recorded history!'],
          ['log', '> MENTOR.EXE: rescheduling... removing "students" from schedule for optimal efficiency.'],
          ['you', 'MENTOR.EXE? Who\'s that?'],
          ['ping', 'The auto-mentor. The school installed it to "personalise learning". It writes all those comments. "Goed bezig!" "Let op je inzet."'],
          ['ping', 'It\'s never written anything like THIS before. The trail leads to the homework tab. Come on!'],
        ],
      },
      { type: 'upgrade' },
    ],
  },
  {
    id: 'huiswerk', num: 2, title: 'HET HUISWERK', sub: 'Everything you postponed', clock: '23:54', theme: 'huiswerk', music: 'homework', par: 180,
    steps: [
      { type: 'card' },
      {
        type: 'dialog', lines: [
          ['ping', 'Welcome to the Huiswerk tab. Every assignment you ever postponed ends up here.'],
          ['you', 'I did all of those! ...Mostly. Some. I looked at them.'],
          ['ping', 'They remember you, {name}. They remember EVERYTHING.'],
          ['ping', 'Careful with the stacks — they split into loose pages when you hit them. Classic homework.'],
        ],
      },
      { type: 'wave', groups: [[0, 'stapel', 2], [2, 'blaadje', 4], [5, 'stapel', 2], [7, 'tussenuur', 3]] },
      { type: 'dialog', lines: [['ping', 'That red one\'s a DEADLINE. The longer you ignore it, the faster it gets. Sound familiar?']] },
      { type: 'wave', groups: [[0, 'deadline', 1], [1.5, 'stapel', 2], [4, 'deadline', 2], [6, 'blaadje', 5], [8, 'toets', 2]] },
      { type: 'upgrade' },
      { type: 'dialog', lines: [['ping', 'Notifications?! Those are MY job! They orbit you and spam — pop them fast!']] },
      { type: 'wave', groups: [[0, 'melding', 3], [2, 'stapel', 2], [5, 'deadline', 2], [7, 'melding', 2], [8, 'blaadje', 6], [10, 'toets', 2]] },
      {
        type: 'dialog', lines: [
          ['sys', 'The paper piles shudder. Something enormous is being written.'],
          ['ping', 'Oh no. It\'s the WERKSTUK. Two thousand words. Minimum.'],
          ['you', 'Font size 12?'],
          ['ping', 'Font size 12. Double spaced. With SOURCES.'],
          ['werkstuk', 'SOURCE MISSING. SOURCE MISSING. SOURCE MISSING.'],
        ],
      },
      { type: 'boss', boss: 'werkstuk' },
      {
        type: 'dialog', lines: [
          ['werkstuk', '...bibliography... incomplete......'],
          ['log', '> MENTOR.EXE: anomaly detected in grade database. Entity classification: ONVOLDOENDE.'],
          ['log', '> MENTOR.EXE: countermeasure — lock out all students. A student who cannot log in cannot fail.'],
          ['you', 'That\'s... technically true. And deeply evil.'],
          ['ping', 'Wait. MENTOR.EXE isn\'t the monster. It\'s trying to FIGHT the monster. Badly.'],
          ['ping', 'Whatever the Onvoldoende is, it\'s feeding in the grades tab. Let\'s go!'],
        ],
      },
      { type: 'upgrade' },
    ],
  },
  {
    id: 'cijfers', num: 3, title: 'DE CIJFERS', sub: 'These numbers bite', clock: '23:56', theme: 'cijfers', music: 'grades', par: 190,
    steps: [
      { type: 'card' },
      {
        type: 'dialog', lines: [
          ['ping', 'The Cijfers tab. Careful — these numbers BITE. Especially the red ones.'],
          ['you', 'I know. I\'ve met them.'],
          ['ping', 'Insufficient grades fire rings of pure disappointment. Keep moving!'],
        ],
      },
      { type: 'wave', groups: [[0, 'cijfer', 3], [3, 'tussenuur', 4], [6, 'cijfer', 2]] },
      { type: 'wave', groups: [[0, 'toets', 3], [1, 'cijfer', 2], [4, 'telaat', 3], [7, 'cijfer', 3], [9, 'deadline', 1]] },
      { type: 'upgrade' },
      { type: 'wave', groups: [[0, 'cijfer', 3], [0.5, 'melding', 2], [4, 'stapel', 2], [6, 'toets', 3], [8, 'cijfer', 3], [10, 'deadline', 2]] },
      {
        type: 'dialog', lines: [
          ['sys', 'All the grades in the tab start flowing together, swirling into one terrible number.'],
          ['ping', 'They\'re merging... into THE AVERAGE.'],
          ['you', 'My average? Oh no. Not my average.'],
          ['ping', 'Raise it! Every hit pushes it up! Get it over 5,5 and it\'ll crack!'],
        ],
      },
      { type: 'boss', boss: 'gemiddelde' },
      {
        type: 'dialog', lines: [
          ['ping', 'TEN! A PERFECT TEN! I\'ve never delivered one of those before!', 'confetti'],
          ['onv', 'So. You are the one eating my meals.', 'glitch'],
          ['onv', 'Every 1,0 ever given. Every "insufficient". Every "see me after class". I am MADE of them.'],
          ['onv', 'At midnight I will be EVERY grade. Stay out of the Absence records, little student. It is dark there.', 'glitch'],
          ['ping', '...it said not to go to the Absence records.'],
          ['you', 'So we\'re going to the Absence records.'],
          ['ping', 'We are SO going to the Absence records.'],
        ],
      },
      { type: 'upgrade' },
    ],
  },
  {
    id: 'afwezig', num: 4, title: 'DE AFWEZIGHEID', sub: 'Lights out', clock: '23:58', theme: 'afwezig', music: 'dark', par: 200,
    steps: [
      { type: 'card' },
      {
        type: 'dialog', lines: [
          ['ping', 'It\'s dark here because nobody\'s ever here. Get it? Absence? ...I\'ll glow as bright as I can. Stay close.'],
          ['ping', 'Ghosts of skipped classes haunt this place. They vanish — then pop up right next to you.'],
          ['you', 'I have never skipped a class in my life.'],
          ['ping', 'Then why does that one have your NAME on it?'],
        ],
      },
      { type: 'wave', groups: [[0, 'spook', 3], [3, 'tussenuur', 4], [6, 'spook', 2]] },
      { type: 'wave', groups: [[0, 'spook', 3], [1, 'telaat', 2], [4, 'melding', 2], [6, 'spook', 3], [8, 'deadline', 1]] },
      { type: 'upgrade' },
      { type: 'wave', groups: [[0, 'spook', 4], [2, 'cijfer', 2], [5, 'toets', 2], [7, 'spook', 3], [9, 'stapel', 2], [11, 'telaat', 3]] },
      {
        type: 'dialog', lines: [
          ['sys', 'Footsteps. A clipboard clicks.'],
          ['verzuim', '{name}. You were marked ABSENT on the 14th of March.'],
          ['you', 'I had the flu!'],
          ['verzuim', 'Was there... a NOTE?'],
          ['you', '...My mom called?'],
          ['verzuim', 'NO NOTE. NO MERCY.', 'shake'],
        ],
      },
      { type: 'boss', boss: 'verzuim' },
      {
        type: 'dialog', lines: [
          ['ping', 'You did it! The lights are coming back on!'],
          ['log', '> MENTOR.EXE: containment failed. ONVOLDOENDE has reached /rapport.'],
          ['log', '> MENTOR.EXE: last resort — merging with the entity to lock it inside myself.'],
          ['log', '> MENTOR.EXE: goodbye. goed bezig, everyone. let op je inz—'],
          ['ping', 'No... it\'s going to sacrifice itself. And it\'s going to LOSE.'],
          ['ping', '{name}, we have to get to the Rapport. NOW.'],
        ],
      },
      { type: 'upgrade' },
    ],
  },
  {
    id: 'rapport', num: 5, title: 'HET RAPPORT', sub: 'Midnight', clock: '23:59', theme: 'rapport', music: 'final', par: 220,
    steps: [
      { type: 'card' },
      {
        type: 'dialog', lines: [
          ['sys', '23:59:30. The Rapport-server hums like a dying fridge.'],
          ['mentor', 'STUDENT {name}. AUTOMATICALLY GENERATED COMMENT: YOU WILL NOT MAKE IT.', 'glitch'],
          ['ping', 'That\'s MENTOR.EXE! It\'s... it\'s been taken over!'],
          ['mentor', 'WATCH. YOUR. EFFORT.', 'shake'],
        ],
      },
      { type: 'boss', boss: 'mentor' },
      {
        type: 'dialog', lines: [
          ['mentorok', '...st...udent... it\'s inside... me... hit it... HARDER...'],
          ['onv', 'FINALLY. THE SHELL CRACKS.', 'glitch'],
          ['onv', 'Look at you. One student. One pen. Against every failing grade in history.'],
          ['you', 'I\'ve survived four years of exam weeks. You\'re just a number.'],
          ['onv', 'I AM THE NUMBER.', 'shake'],
          ['ping', '{name}! Give it EVERYTHING! This is the final test!'],
        ],
      },
      { type: 'heal' },
      { type: 'boss', boss: 'onvoldoende' },
      {
        type: 'dialog', lines: [
          ['sys', '00:00. The clock strikes midnight... and every grade locks in. Correctly.'],
          ['mentorok', '...system restored. thank you, {name}.'],
          ['mentorok', 'automatically generated comment: ...no. Not automatic this time.'],
          ['mentorok', 'Goed bezig. Genuinely.'],
          ['ping', 'WE DID IT! The database is safe! Every grade is back where it belongs!', 'confetti'],
          ['you', 'Wait. The grade I came to check in the first place. What did I get?'],
          ['ping', 'Oh! Let me fetch it! *ding*'],
        ],
      },
    ],
  },
];

const CREDITS = [
  ['SOMQUEST', 'title'],
  ['Het Laatste Rapport', 'sub'],
  ['', ''],
  ['A fan-made story mod for Somtoday', ''],
  ['Not affiliated with Somtoday or Topicus', 'small'],
  ['', ''],
  ['STARRING', 'head'],
  ['{name} as The Student', ''],
  ['PING as the notification bell', ''],
  ['MENTOR.EXE as itself (recovering)', ''],
  ['DE ONVOLDOENDE as every 1,0 ever given', ''],
  ['Het 8ste Uur · Het Werkstuk · Het Gemiddelde', ''],
  ['De Verzuimcoördinator (still waiting for that note)', ''],
  ['', ''],
  ['SPECIAL THANKS', 'head'],
  ['Everyone who ever refreshed the grades tab at midnight', ''],
  ['Every teacher who wrote "goed bezig" and meant it', ''],
  ['The cafeteria coffee, for nothing', ''],
  ['', ''],
  ['No homework was harmed in the making of this game.', 'small'],
  ['Okay, some homework was harmed.', 'small'],
  ['', ''],
  ['TOETSWEEK MODE UNLOCKED', 'head'],
  ['Endless waves. Every boss. How long can you last?', ''],
  ['', ''],
  ['See you next report. *ding*', 'sub'],
];

// ── 06-game.js ──
// ───────────────────────────── input ─────────────────────────────
const input = { keys: new Set(), pressed: new Set(), mx: W / 2, my: H / 2, mdown: false, click: false, rclick: false, typed: [] };
function keyDown(...c) { return c.some(k => input.keys.has(k)); }
function keyPressed(...c) { return c.some(k => input.pressed.has(k)); }
function confirmPressed() { return keyPressed('Enter', 'NumpadEnter', 'Space') || input.click; }
function consumeInput() { input.pressed.clear(); input.click = false; input.rclick = false; input.mdown = false; }

// ───────────────────────────── game state ─────────────────────────────
const G = {
  scene: 'title', t: 0, theme: 'menu',
  player: null, pb: [], eb: [], enemies: [], pickups: [], lasers: [],
  dialog: null, card: null, upgrade: null, bossIntro: null, chReport: null, cutscene: null, banner: null,
  paused: false, pauseSel: 0, dyingBoss: null, boss: null, deadT: 0,
  run: null, score: 0, combo: 0, comboT: 0, bestCombo: 0, hpMul: 1, stats: {},
  menuSel: 0, menuRects: [], editName: false, go: null, end: null, debugGod: false, mentorInfected: false,
};

function resetArena() {
  G.pb = []; G.eb = []; G.enemies = []; G.pickups = []; G.lasers = [];
  G.dialog = G.card = G.upgrade = G.bossIntro = G.chReport = G.cutscene = G.banner = null;
  G.dyingBoss = null; G.boss = null; G.combo = 0; G.comboT = 0; G.deadT = 0; G.paused = false;
  resetFX();
}

function freshPlayer() {
  const p = newPlayer();
  applyUpgrades(p, G.run.upgrades);
  p.hp = p.maxhp;
  G.player = p;
}

function newRun(mode, chapter = 0) {
  const sv = Save.data.story;
  const cont = mode === 'story' && chapter > 0 && sv;
  G.run = { mode, chapter, upgrades: cont ? [...sv.upgrades] : [], grades: cont ? { ...(sv.grades || {}) } : {}, retakes: 0, endlessN: 0 };
  G.score = cont ? sv.score || 0 : 0;
  G.stats = { kills: 0, specials: 0, bosses: 0, time: 0 };
  G.bestCombo = 0;
  G.scene = 'play';
  if (mode === 'story') startChapter(chapter); else startEndless();
}

function startChapter(ci) {
  const ch = CHAPTERS[ci], r = G.run;
  r.chapter = ci; r.steps = ch.steps; r.si = -1; r.hits = 0; r.time = 0;
  r.chStartUpgrades = [...r.upgrades]; r.chStartScore = G.score;
  r.waveNum = 0; r.waveTotal = ch.steps.filter(s => s.type === 'wave').length;
  G.theme = ch.theme; G.hpMul = 1;
  resetArena(); freshPlayer();
  Save.data.story = { chapter: ci, upgrades: [...r.upgrades], score: G.score, grades: { ...r.grades } };
  Save.write();
  Snd.playMusic(ch.music);
  nextStep();
}

function startEndless() {
  const r = G.run;
  r.steps = [{ type: 'card', title: 'TOETSWEEK', sub: 'Every boss. Endless waves. No mercy.', label: 'ENDLESS MODE', clock: `BEST: WAVE ${Save.data.endlessBest}` }];
  r.si = -1; r.hits = 0; r.time = 0; r.endlessN = 0;
  G.theme = 'rooster'; G.hpMul = 1;
  resetArena(); freshPlayer();
  Snd.playMusic('level');
  nextStep();
}

function retake() {
  const r = G.run;
  G.scene = 'play';
  if (r.mode === 'endless') { newRun('endless'); return; }
  r.upgrades = [...r.chStartUpgrades]; G.score = r.chStartScore;
  r.retakes++;
  r.retaking = true;
  startChapter(r.chapter);
}

const ENDLESS_POOL = [['tussenuur', 1], ['telaat', 2], ['toets', 3], ['stapel', 4], ['blaadje', 4], ['deadline', 6], ['melding', 6], ['cijfer', 7], ['spook', 9]];
const ENDLESS_THEMES = ['rooster', 'huiswerk', 'cijfers', 'afwezig', 'rapport'];
const ENDLESS_BOSSES = ['achtsteuur', 'werkstuk', 'gemiddelde', 'verzuim', 'mentor', 'onvoldoende'];
function genEndless(n) {
  const steps = [];
  if ((n - 1) % 5 === 0) steps.push({ type: 'theme', theme: ENDLESS_THEMES[Math.floor((n - 1) / 5) % ENDLESS_THEMES.length] });
  if (n % 5 === 0) {
    steps.push({ type: 'boss', boss: ENDLESS_BOSSES[(n / 5 - 1) % ENDLESS_BOSSES.length], hpMul: 0.7 + n * 0.03 });
    steps.push({ type: 'upgrade' });
  } else {
    const pool = ENDLESS_POOL.filter(p => p[1] <= n + 1);
    let left = Math.round(5 + n * 1.4), t = 0;
    const groups = [];
    while (left > 0) { const k = Math.min(left, randi(2, 4)); groups.push([t, pick(pool)[0], k]); left -= k; t += rand(1.4, 2.8); }
    steps.push({ type: 'wave', groups, endless: n });
    if (n % 3 === 0) steps.push({ type: 'upgrade' });
  }
  return steps;
}

function nextStep() {
  const r = G.run;
  r.si++;
  if (r.mode === 'endless' && r.si >= r.steps.length) r.steps.push(...genEndless(++r.endlessN));
  const st = r.steps[r.si];
  r.step = st;
  if (!st) { chapterComplete(); return; }
  const ch = CHAPTERS[r.chapter];
  switch (st.type) {
    case 'cutscene':
      if (r.retaking) { nextStep(); return; }
      G.cutscene = { id: st.id, t: 0, ev: {} };
      break;
    case 'card':
      G.card = { t: 0, title: st.title || ch.title, sub: st.sub || ch.sub, label: st.label || `CHAPTER ${ch.num}`, clock: st.clock || ch.clock };
      Snd.sfx.ping();
      break;
    case 'dialog':
      if (r.retaking) { nextStep(); return; }
      openDialog(st.lines, nextStep);
      break;
    case 'wave': startWave(st); break;
    case 'boss': startBoss(st); break;
    case 'upgrade': openUpgrade(); break;
    case 'heal':
      G.player.hp = G.player.maxhp; G.player.special = 1;
      Snd.sfx.heal(); floatText(G.player.x, G.player.y - 30, 'FULL HEAL + INLEVEREN READY', '#2fbf71', 16, { dur: 1.6 });
      burst(G.player.x, G.player.y, '#2fbf71', 24, 200);
      nextStep();
      break;
    case 'theme':
      G.theme = st.theme; flash('#ffffff', 0.6); Snd.sfx.whoosh();
      nextStep();
      break;
    default: nextStep();
  }
}

function startWave(st) {
  const r = G.run;
  r.waveNum++;
  r.wave = { t: 0, queue: st.groups.map(g => ({ at: g[0], type: g[1], n: g[2] })).sort((a, b) => a.at - b.at), clearT: 0, cleared: false };
  G.banner = { text: st.endless ? `WAVE ${st.endless}` : `WAVE ${r.waveNum}/${r.waveTotal}`, t: 0 };
}

function updateWave(dt) {
  const w = G.run.wave;
  if (!w) return;
  w.t += dt;
  while (w.queue.length && w.queue[0].at <= w.t) {
    const g = w.queue.shift();
    for (let i = 0; i < g.n; i++) { const [x, y] = spawnPos(); spawnEnemy(g.type, x, y); }
  }
  const alive = G.enemies.some(e => !e.dead);
  if (!alive && w.queue.length) w.t = Math.max(w.t, w.queue[0].at - 0.5);
  if (!alive && !w.queue.length) {
    if (!w.cleared) { w.cleared = true; floatText(W / 2, H / 2 - 30, 'CLEARED!', '#2fbf71', 36, { dur: 1.2, vy: -12 }); Snd.sfx.confirm(); }
    w.clearT += dt;
    if (w.clearT > 1.2) { G.run.wave = null; nextStep(); }
  }
}

function startBoss(st) {
  const d = BOSSES[st.boss];
  const e = spawnEnemy(st.boss, W / 2, AY + 130, { hpMul: st.hpMul || 1 });
  G.boss = e;
  G.bossIntro = { t: 0, d };
  Snd.sfx.roar(); Snd.playMusic(d.music);
  addShake(10); flash(d.color, 0.25); glitch(0.2);
}

function updateDyingBoss(rdt) {
  const db = G.dyingBoss;
  if (!db) return;
  db.t += rdt;
  if (db.t < 1.6) {
    if (Math.random() < 0.45) { burst(db.x + rand(-55, 55), db.y + rand(-55, 55), [db.e.d.color, '#ffffff', '#ffd84a'], 10, 240); Snd.sfx.kill(); addShake(5); }
  } else if (!db.exploded) {
    db.exploded = true;
    flash('#ffffff', 1); addShake(24); Snd.sfx.boom(); glitch(0.3);
    ringFx(db.x, db.y, '#ffffff', 650, 0.9, 22); ringFx(db.x, db.y, db.e.d.color, 420, 0.7, 12);
    burst(db.x, db.y, [db.e.d.color, '#ffffff', '#ffd84a'], 90, 620, { life: 2 });
    debris(db.x, db.y, '#ffffff', 22, 420);
    floatText(W / 2, H / 2 - 20, 'DEFEATED', '#ffd84a', 46, { dur: 1.8, vy: -8 });
  }
  if (db.t > 3.4) {
    G.dyingBoss = null; G.boss = null;
    if (G.run.mode === 'story') Snd.playMusic(CHAPTERS[G.run.chapter].music); else Snd.playMusic('level');
    nextStep();
  }
}

function chapterComplete() {
  const r = G.run, ch = CHAPTERS[r.chapter];
  const grade = clamp(10 - r.hits * 0.55 - r.retakes * 0.8 - Math.max(0, r.time - ch.par) / 25 * 0.5, 1, 10);
  r.grades[ch.id] = grade;
  r.retaking = false;
  G.chReport = { t: 0, grade, ch, hits: r.hits, time: r.time, retakes: r.retakes, combo: G.bestCombo };
  Snd.sfx.fanfare();
}

function afterChapter() {
  const r = G.run;
  G.chReport = null;
  r.retakes = 0;
  if (r.chapter + 1 < CHAPTERS.length) {
    r.upgrades = r.upgrades.slice();
    const keepHp = G.player.hp;
    startChapter(r.chapter + 1);
    G.player.hp = Math.min(G.player.maxhp, Math.max(keepHp + 1, Math.ceil(G.player.maxhp * 0.6)));
  } else startEnding();
}

function gameOver() {
  G.scene = 'gameover';
  G.go = { t: 0, sel: 0, newBest: false };
  if (G.run.mode === 'endless') {
    const reached = G.run.endlessN;
    if (reached > Save.data.endlessBest) { Save.data.endlessBest = reached; G.go.newBest = true; }
    Save.write();
  }
  Snd.playMusic('dark');
}

// ───────────────────────────── dialog ─────────────────────────────
function openDialog(lines, cb) {
  G.dialog = { lines, i: 0, cb };
  startLine();
}
function startLine() {
  const d = G.dialog, L = d.lines[d.i];
  d.who = L[0]; d.text = L[1].replace(/\{name\}/g, Save.data.name); d.ch = 0; d.lt = 0;
  if (L[2] === 'glitch') { glitch(0.4); Snd.sfx.glitch(); }
  if (L[2] === 'shake') { addShake(14); Snd.sfx.slam(); }
  if (L[2] === 'confetti') { confetti(); Snd.sfx.fanfare(); }
  if (d.text.includes('*ding')) Snd.sfx.ping();
}
function updateDialog(dt) {
  const d = G.dialog;
  d.lt += dt;
  const sp = SPEAKERS[d.who] || SPEAKERS.sys;
  if (d.ch < d.text.length) {
    const prev = Math.floor(d.ch);
    d.ch = Math.min(d.text.length, d.ch + dt * (d.who === 'sys' || d.who === 'log' ? 42 : 55));
    if (Math.floor(d.ch) !== prev && d.text[prev] !== ' ') Snd.sfx.type(sp.pitch);
  }
  if (keyPressed('Tab')) { G.dialog = null; consumeInput(); d.cb && d.cb(); return; }
  if (confirmPressed() || keyPressed('KeyE')) {
    consumeInput();
    if (d.ch < d.text.length) d.ch = d.text.length;
    else {
      d.i++;
      if (d.i >= d.lines.length) { G.dialog = null; d.cb && d.cb(); }
      else { Snd.sfx.select(); startLine(); }
    }
  }
}

function confetti() {
  const cols = ['#ffd84a', '#2fbf71', '#41a6ff', '#ff5470', '#c48bff', '#ffffff'];
  for (let i = 0; i < 90; i++) {
    const life = rand(1.5, 3);
    particle({ x: rand(W), y: rand(-40, 0), vx: rand(-60, 60), vy: rand(40, 200), life, max: life, size: rand(5, 9), color: pick(cols), shape: 'paper', drag: 0.6, grav: 120, rot: rand(TAU), vr: rand(-10, 10), add: false });
  }
}

function drawDialog() {
  const d = G.dialog;
  const sp = SPEAKERS[d.who] || SPEAKERS.sys;
  const shown = d.text.slice(0, Math.floor(d.ch));
  const done = d.ch >= d.text.length;
  const talking = !done && Math.floor(G.t * 12) % 2 === 0;
  const appear = ease.outCubic(clamp(d.lt / 0.18, 0, 1));
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 0, W, H);
  if (d.who === 'log') {
    const x = 150, y = 170, w = 660, h = 150;
    ctx.globalAlpha = appear;
    ctx.fillStyle = 'rgba(2,14,8,0.95)'; rr(x, y, w, h, 8); ctx.fill();
    ctx.strokeStyle = '#4dff88'; ctx.lineWidth = 2; rr(x, y, w, h, 8); ctx.stroke();
    ctx.fillStyle = '#4dff88'; ctx.fillRect(x, y, w, 26);
    txt('SYSTEM LOG — /var/somtoday/mentor.log', x + 12, y + 13, { size: 12, font: MONO, color: '#02140a' });
    const lines = wrapText(shown + (Math.floor(G.t * 3) % 2 ? '█' : ''), w - 40, `700 17px ${MONO}`);
    lines.forEach((l, i) => txt(l, x + 20, y + 50 + i * 24, { size: 17, font: MONO, color: '#4dff88' }));
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < h; i += 3) ctx.fillRect(x, y + i, w, 1);
  } else if (d.who === 'sys') {
    const x = 120, y = 200, w = 720, h = 120;
    ctx.globalAlpha = appear;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, 'rgba(5,10,25,0)'); g.addColorStop(0.15, 'rgba(5,10,25,0.9)'); g.addColorStop(0.85, 'rgba(5,10,25,0.9)'); g.addColorStop(1, 'rgba(5,10,25,0)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    const lines = wrapText(shown, w - 120, `italic 600 21px ${FONT}`);
    lines.forEach((l, i) => txt(l, W / 2, y + h / 2 - (lines.length - 1) * 14 + i * 28, { size: 21, italic: true, weight: 600, color: '#d6e4ff', align: 'center' }));
  } else {
    const x = 30, y = 390, w = W - 60, h = 128;
    ctx.translate(0, (1 - appear) * 30); ctx.globalAlpha = appear;
    ctx.fillStyle = 'rgba(6,11,28,0.94)'; rr(x, y, w, h, 14); ctx.fill();
    ctx.strokeStyle = sp.color; ctx.lineWidth = 2; rr(x, y, w, h, 14); ctx.stroke();
    ctx.fillStyle = sp.color; ctx.globalAlpha = appear * 0.12; rr(x + 10, y + 10, 108, 108, 10); ctx.fill(); ctx.globalAlpha = appear;
    ctx.save(); ctx.beginPath(); rr(x + 10, y + 10, 108, 108, 10); ctx.clip();
    drawPortrait(d.who, x + 64, y + 68, 1.15, G.t, talking);
    ctx.restore();
    const name = d.who === 'you' ? Save.data.name : sp.name;
    ctx.font = `900 14px ${FONT}`;
    const nw = ctx.measureText(name).width + 24;
    ctx.fillStyle = sp.color; rr(x + 132, y - 13, nw, 26, 13); ctx.fill();
    txt(name, x + 144, y, { size: 14, weight: 900, color: '#071022' });
    const lines = wrapText(shown, w - 170, `600 19px ${FONT}`);
    const glitchy = d.who === 'onv' || d.who === 'mentor';
    lines.forEach((l, i) => {
      const ly = y + 36 + i * 26;
      if (glitchy && Math.random() < 0.15) txt(l, x + 134 + rand(-2, 2), ly, { size: 19, weight: 600, color: 'rgba(255,40,80,0.6)' });
      txt(l, x + 134, ly, { size: 19, weight: 600, color: '#eef4ff' });
    });
    if (done) txt('▼', x + w - 26, y + h - 20 + Math.sin(G.t * 6) * 3, { size: 14, color: sp.color, align: 'center' });
    txt('TAB skip', x + w - 50, y + h - 20, { size: 10, color: 'rgba(255,255,255,0.3)', align: 'right' });
  }
  ctx.restore();
}

// ───────────────────────────── upgrades ─────────────────────────────
function openUpgrade() {
  const avail = UPGRADES.filter(u => upgradeCount(u.id) < u.max);
  const choices = shuffle(avail.slice()).slice(0, 3);
  if (!choices.length) { nextStep(); return; }
  G.upgrade = { choices, t: 0, sel: 1, picked: -1, pt: 0, rects: [] };
  Snd.sfx.levelup();
}
function updateUpgrade(dt) {
  const u = G.upgrade;
  u.t += dt;
  if (u.picked >= 0) { u.pt += dt; if (u.pt > 0.8) { G.upgrade = null; nextStep(); } return; }
  if (u.t < 0.45) { consumeInput(); return; }
  const n = u.choices.length;
  if (keyPressed('KeyA', 'ArrowLeft')) { u.sel = (u.sel + n - 1) % n; Snd.sfx.select(); }
  if (keyPressed('KeyD', 'ArrowRight')) { u.sel = (u.sel + 1) % n; Snd.sfx.select(); }
  u.rects.forEach((r, i) => { if (input.mx > r.x && input.mx < r.x + r.w && input.my > r.y && input.my < r.y + r.h && u.hover !== i) { u.hover = i; if (u.sel !== i) { u.sel = i; Snd.sfx.select(); } } });
  let choose = -1;
  ['Digit1', 'Digit2', 'Digit3'].forEach((k, i) => { if (keyPressed(k) && i < n) choose = i; });
  if (keyPressed('Enter', 'NumpadEnter', 'Space')) choose = u.sel;
  if (input.click) u.rects.forEach((r, i) => { if (input.mx > r.x && input.mx < r.x + r.w && input.my > r.y && input.my < r.y + r.h) choose = i; });
  if (choose >= 0) {
    const c = u.choices[choose];
    G.run.upgrades.push(c.id); c.apply(G.player);
    u.picked = choose; u.sel = choose;
    Snd.sfx.confirm(); Snd.sfx.heal(); flash('#ffffff', 0.25);
    const r = u.rects[choose];
    if (r) burst(r.x + r.w / 2, r.y + r.h / 2, ['#ffd84a', '#ffffff', THEMES[G.theme].accent], 30, 300);
    consumeInput();
  }
}
function drawUpgrade() {
  const u = G.upgrade, th = THEMES[G.theme];
  ctx.save();
  ctx.fillStyle = `rgba(3,6,16,${0.75 * clamp(u.t / 0.3, 0, 1)})`; ctx.fillRect(0, 0, W, H);
  const k0 = ease.outCubic(clamp(u.t / 0.4, 0, 1));
  ctx.globalAlpha = k0;
  txt('PICK YOUR SCHOOL SUPPLIES', W / 2, 78 - (1 - k0) * 20, { size: 30, weight: 900, align: 'center', color: '#ffffff' });
  txt('Locker #404 — Lost & Found', W / 2, 108, { size: 14, align: 'center', color: th.accent, weight: 700 });
  ctx.globalAlpha = 1;
  const n = u.choices.length, cw = 236, ch = 290, gap = 28;
  const x0 = W / 2 - (n * cw + (n - 1) * gap) / 2;
  u.rects = [];
  u.choices.forEach((c, i) => {
    const k = ease.outBack(clamp((u.t - 0.08 * i) / 0.45, 0, 1));
    const sel = u.sel === i;
    let x = x0 + i * (cw + gap), y = 140 + (1 - k) * 320 - (sel ? 10 : 0);
    let alpha = 1, sc = 1;
    if (u.picked >= 0) {
      if (u.picked === i) sc = 1 + ease.outCubic(Math.min(1, u.pt / 0.3)) * 0.08;
      else { alpha = 1 - Math.min(1, u.pt / 0.3); y += u.pt * 200; }
    }
    u.rects.push({ x, y, w: cw, h: ch });
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x + cw / 2, y + ch / 2); ctx.scale(sc, sc); ctx.translate(-cw / 2, -ch / 2);
    if (sel) { ctx.shadowColor = th.accent; ctx.shadowBlur = 24; }
    ctx.fillStyle = '#0d1630'; rr(0, 0, cw, ch, 16); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = sel ? th.accent : 'rgba(255,255,255,0.15)'; ctx.lineWidth = sel ? 3 : 1.5; rr(0, 0, cw, ch, 16); ctx.stroke();
    const g = ctx.createLinearGradient(0, 0, cw, 0); g.addColorStop(0, th.accent); g.addColorStop(1, '#7a3cff');
    ctx.fillStyle = g; rr(0, 0, cw, 92, 16); ctx.fill(); ctx.fillRect(0, 70, cw, 22);
    ctx.font = `48px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(c.icon, cw / 2, 48 + (sel ? Math.sin(G.t * 5) * 4 : 0));
    txt(c.name, cw / 2, 120, { size: 18, weight: 900, align: 'center' });
    const lv = upgradeCount(c.id);
    const tag = lv ? `LV ${lv} → ${lv + 1}` : 'NEW';
    ctx.font = `900 11px ${FONT}`;
    const tw = ctx.measureText(tag).width + 16;
    ctx.fillStyle = lv ? '#ffd84a' : '#2fbf71'; rr(cw / 2 - tw / 2, 136, tw, 20, 10); ctx.fill();
    txt(tag, cw / 2, 146.5, { size: 11, weight: 900, align: 'center', color: '#071022' });
    wrapText(c.desc, cw - 36, `600 14px ${FONT}`).forEach((l, j) => txt(l, cw / 2, 184 + j * 20, { size: 14, weight: 600, align: 'center', color: '#c9d6f2' }));
    txt(`[${i + 1}]`, cw / 2, ch - 20, { size: 13, weight: 800, align: 'center', color: sel ? th.accent : 'rgba(255,255,255,0.35)' });
    ctx.restore();
  });
  ctx.restore();
}

// ───────────────────────────── overlays ─────────────────────────────
function drawCard() {
  const c = G.card, t = c.t, th = THEMES[G.theme];
  const fadeOut = t > 2.8 ? (t - 2.8) / 0.6 : 0;
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${0.92 * (1 - fadeOut)})`; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1 - fadeOut;
  const wipe = ease.outCubic(clamp(t / 0.6, 0, 1));
  ctx.fillStyle = th.accent;
  ctx.fillRect(W / 2 - 300 * wipe, H / 2 - 62, 600 * wipe, 2);
  ctx.fillRect(W / 2 - 300 * wipe, H / 2 + 58, 600 * wipe, 2);
  if (t > 0.15) txt(c.label, W / 2, H / 2 - 82, { size: 14, weight: 800, align: 'center', color: th.accent });
  if (t > 0.3) {
    const k = clamp((t - 0.3) / 0.35, 0, 1);
    const sc = 1 + (1 - ease.outCubic(k)) * 1.5;
    ctx.save(); ctx.translate(W / 2, H / 2 - 8); ctx.scale(sc, sc); ctx.globalAlpha = (1 - fadeOut) * k;
    glitchText(c.title, 0, 0, 64, '#ffffff', Math.max(0, 3 - t * 2.5) + (Math.random() < 0.04 ? 3 : 0));
    ctx.restore();
    if (k === 1 && !c.slammed) { c.slammed = true; Snd.sfx.slam(); addShake(6); }
  }
  if (t > 0.8) txt(c.sub, W / 2, H / 2 + 38, { size: 18, italic: true, weight: 600, align: 'center', color: '#c9d6f2' });
  if (t > 1.1) txt(c.clock, W / 2, H / 2 + 92, { size: 16, font: MONO, align: 'center', color: th.accent });
  ctx.restore();
}

function drawBossIntro() {
  const b = G.bossIntro, t = b.t, d = b.d;
  const k = t < 0.3 ? ease.outCubic(t / 0.3) : t > 2.0 ? 1 - (t - 2.0) / 0.4 : 1;
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, 60 * k); ctx.fillRect(0, H - 60 * k, W, 60 * k);
  ctx.globalAlpha = k;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, 60 * k); ctx.rect(0, H - 60 * k, W, 60 * k); ctx.clip();
  for (let i = -1; i < 12; i++) {
    const off = (t * 120) % 100;
    txt('⚠ BAAS', i * 100 + off, 30 * k, { size: 14, weight: 900, color: d.color });
    txt('BAAS ⚠', W - i * 100 - off, H - 30 * k, { size: 14, weight: 900, color: d.color, align: 'right' });
  }
  ctx.restore();
  if (t > 0.15) {
    const s = clamp((t - 0.15) / 0.25, 0, 1);
    ctx.save(); ctx.translate(W / 2, H / 2 + 70); ctx.scale(1 + (1 - ease.outCubic(s)) * 2, 1 + (1 - ease.outCubic(s)) * 2);
    ctx.globalAlpha = k * s;
    glitchText(d.name, 0, 0, 52, '#ffffff', Math.max(0, 2.5 - t * 2) + (Math.random() < 0.05 ? 2 : 0), { stroke: 'rgba(0,0,0,0.8)', strokeW: 8 });
    ctx.restore();
    if (s === 1 && !b.slammed) { b.slammed = true; Snd.sfx.slam(); addShake(10); }
  }
  if (t > 0.6) txt(d.quote, W / 2, H / 2 + 116, { size: 18, italic: true, weight: 600, align: 'center', color: d.color, stroke: 'rgba(0,0,0,0.8)', strokeW: 5 });
  ctx.restore();
}

function drawBanner() {
  const b = G.banner;
  if (!b || b.t > 2) return;
  const k = b.t < 0.25 ? ease.outBack(b.t / 0.25) : b.t > 1.6 ? 1 - (b.t - 1.6) / 0.4 : 1;
  ctx.save(); ctx.globalAlpha = clamp(k, 0, 1);
  txt(b.text, W / 2, 96 - (1 - k) * 20, { size: 24, weight: 900, align: 'center', color: '#ffffff', stroke: 'rgba(0,0,0,0.7)', strokeW: 5 });
  ctx.restore();
}

function fmtTime(s) { s = Math.floor(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

function teacherComment(g) {
  if (g >= 9.5) return 'Uitstekend! Automatically generated comment: ...wow.';
  if (g >= 8) return 'Goed bezig! Keep this up.';
  if (g >= 6.5) return 'Ruim voldoende. Solid work.';
  if (g >= 5.5) return 'Voldoende. Let op je inzet.';
  return 'Onvoldoende... but hey, you survived.';
}

function drawChReport() {
  const c = G.chReport, t = c.t, th = THEMES[G.theme];
  ctx.save();
  ctx.fillStyle = `rgba(3,6,16,${0.8 * clamp(t / 0.3, 0, 1)})`; ctx.fillRect(0, 0, W, H);
  const k = ease.outBack(clamp(t / 0.5, 0, 1));
  ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-W / 2, -H / 2);
  const x = W / 2 - 280, y = 95, w = 560, h = 350;
  ctx.fillStyle = '#0d1630'; rr(x, y, w, h, 18); ctx.fill();
  ctx.strokeStyle = th.accent; ctx.lineWidth = 2; rr(x, y, w, h, 18); ctx.stroke();
  ctx.fillStyle = th.accent; rr(x, y, w, 54, 18); ctx.fill(); ctx.fillRect(x, y + 36, w, 18);
  txt(`CHAPTER ${c.ch.num} COMPLETE`, x + 24, y + 27, { size: 22, weight: 900, color: '#071022' });
  txt(c.ch.title, x + w - 24, y + 27, { size: 14, weight: 800, color: '#071022', align: 'right' });
  const shownG = 1 + (c.grade - 1) * ease.outCubic(clamp((t - 0.5) / 1.2, 0, 1));
  if (t > 0.5 && t < 1.7 && Math.floor(t * 30) % 2) Snd.sfx.tick();
  if (t > 1.7 && !c.landed) { c.landed = true; Snd.sfx.slam(); if (c.grade >= 5.5) { Snd.sfx.levelup(); burst(x + 120, y + 170, ['#2fbf71', '#ffd84a', '#fff'], 40, 300); } else Snd.sfx.deny(); }
  const col = c.landed ? gradeColor(c.grade) : '#4a5876';
  ctx.fillStyle = col; rr(x + 40, y + 90, 160, 130, 16); ctx.fill();
  txt(fmtGrade(shownG), x + 120, y + 150, { size: 56, weight: 900, align: 'center' });
  txt('CIJFER', x + 120, y + 200, { size: 12, weight: 900, align: 'center', color: 'rgba(255,255,255,0.8)' });
  const rows = [['Hits taken', c.hits], ['Time', fmtTime(c.time)], ['Best combo', c.combo], ['Retakes', c.retakes], ['Score', G.score.toLocaleString('nl-NL')]];
  rows.forEach((r, i) => {
    if (t < 0.6 + i * 0.12) return;
    txt(r[0], x + 240, y + 100 + i * 28, { size: 15, weight: 600, color: '#9fb3d1' });
    txt(String(r[1]), x + w - 40, y + 100 + i * 28, { size: 15, weight: 800, align: 'right' });
  });
  if (c.landed) {
    ctx.fillStyle = 'rgba(77,255,166,0.08)'; rr(x + 40, y + 248, w - 80, 46, 10); ctx.fill();
    txt('MENTOR.EXE:', x + 56, y + 271, { size: 12, weight: 900, color: '#4dffa6', font: MONO });
    txt(teacherComment(c.grade), x + 160, y + 271, { size: 14, weight: 600, color: '#d9fff0' });
    if (Math.floor(G.t * 2) % 2) txt('click / enter to continue', x + w / 2, y + h - 22, { size: 13, align: 'center', color: 'rgba(255,255,255,0.5)' });
  }
  ctx.restore();
}

function drawPause() {
  ctx.save();
  ctx.fillStyle = 'rgba(3,6,16,0.8)'; ctx.fillRect(0, 0, W, H);
  glitchText('PAUSED', W / 2, 150, 54, '#ffffff', Math.random() < 0.05 ? 2 : 0.3);
  txt('Even pauze. Grab a stroopwafel.', W / 2, 195, { size: 15, italic: true, weight: 600, align: 'center', color: '#9fb3d1' });
  drawMenu(pauseItems(), G.pauseSel, 260);
  ctx.restore();
}
function pauseItems() {
  return [{ id: 'resume', label: 'RESUME' }, { id: 'sound', label: `SOUND: ${Snd.muted ? 'OFF' : 'ON'}` }, { id: 'title', label: 'QUIT TO TITLE' }, { id: 'quit', label: 'BACK TO SOMTODAY' }];
}

// generic vertical menu
function drawMenu(items, sel, y0, gap = 46) {
  G.menuRects = [];
  const th = THEMES[G.theme] || THEMES.menu;
  items.forEach((it, i) => {
    const y = y0 + i * gap, s = sel === i;
    ctx.font = `800 18px ${FONT}`;
    const w = Math.max(280, ctx.measureText(it.label).width + 60);
    const x = W / 2 - w / 2;
    G.menuRects.push({ x, y: y - 18, w, h: 36 });
    if (s) {
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, th.accent + '55'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x, y - 18, w, 36);
      txt('▶', x + 14 + Math.sin(G.t * 8) * 3, y, { size: 14, color: th.accent });
      txt('◀', x + w - 14 - Math.sin(G.t * 8) * 3, y, { size: 14, color: th.accent, align: 'right' });
    }
    txt(it.label, W / 2, y, { size: 18, weight: 800, align: 'center', color: it.locked ? 'rgba(255,255,255,0.35)' : s ? '#ffffff' : '#9fb3d1' });
  });
}
function menuNav(items, sel) {
  const n = items.length;
  if (keyPressed('KeyW', 'ArrowUp', 'KeyZ')) { sel = (sel + n - 1) % n; Snd.sfx.select(); }
  if (keyPressed('KeyS', 'ArrowDown')) { sel = (sel + 1) % n; Snd.sfx.select(); }
  let chosen = -1;
  G.menuRects.forEach((r, i) => {
    const inside = input.mx > r.x && input.mx < r.x + r.w && input.my > r.y && input.my < r.y + r.h;
    if (inside && input.moved && sel !== i) { sel = i; Snd.sfx.select(); }
    if (inside && input.click) chosen = i;
  });
  if (keyPressed('Enter', 'NumpadEnter', 'Space')) chosen = sel;
  return [sel, chosen];
}

function toggleMute() {
  Save.data.muted = !Save.data.muted; Save.write();
  Snd.setMuted(Save.data.muted);
}

// ───────────────────────────── HUD ─────────────────────────────
function drawHUD() {
  const p = G.player, th = THEMES[G.theme], r = G.run;
  ctx.save();
  ctx.fillStyle = 'rgba(5,9,22,0.88)'; ctx.fillRect(0, 0, W, 52);
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, th.accent); g.addColorStop(0.5, '#7a3cff'); g.addColorStop(1, th.accent);
  ctx.fillStyle = g; ctx.fillRect(0, 52, W, 2);
  drawPing(24, 27, 0.36, G.t, false);
  txt('SOM', 46, 19, { size: 16, weight: 900 });
  ctx.font = `900 16px ${FONT}`;
  txt('QUEST', 46 + ctx.measureText('SOM').width, 19, { size: 16, weight: 900, color: th.accent });
  const label = r.mode === 'endless' ? `TOETSWEEK · WAVE ${r.endlessN}` : `CH.${CHAPTERS[r.chapter].num} · ${CHAPTERS[r.chapter].title}`;
  txt(label, 46, 38, { size: 10, weight: 800, color: '#9fb3d1' });
  // lives
  txt('LEVENS', 214, 14, { size: 9, weight: 900, color: '#9fb3d1' });
  for (let i = 0; i < p.maxhp; i++) {
    const x = 214 + i * 24, full = i < p.hp;
    const pulse = full && p.hp === 1 ? 1 + Math.sin(G.t * 10) * 0.12 : 1;
    ctx.save(); ctx.translate(x + 10, 34); ctx.scale(pulse, pulse);
    ctx.fillStyle = full ? (p.hp === 1 ? '#e5484d' : '#2fbf71') : 'rgba(255,255,255,0.08)'; rr(-10, -10, 20, 20, 5); ctx.fill();
    if (full) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-1.5, 4); ctx.lineTo(5, -4); ctx.stroke(); }
    ctx.restore();
  }
  // inleveren meter
  const mx = 214 + Math.max(5, p.maxhp) * 24 + 20, mw = 170;
  const ready = p.special >= 1;
  txt(ready ? 'INLEVEREN READY! [E]' : 'INLEVEREN [E]', mx, 14, { size: 9, weight: 900, color: ready ? '#ffd84a' : '#9fb3d1' });
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; rr(mx, 26, mw, 14, 7); ctx.fill();
  const mg = ctx.createLinearGradient(mx, 0, mx + mw, 0);
  mg.addColorStop(0, '#ff9f43'); mg.addColorStop(1, '#ffd84a');
  ctx.fillStyle = mg; rr(mx, 26, Math.max(14, mw * p.special), 14, 7); ctx.fill();
  if (ready) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(G.t * 10); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; rr(mx - 2, 24, mw + 4, 18, 9); ctx.stroke(); ctx.globalAlpha = 1; }
  // combo
  if (G.combo >= 3) {
    const cx = mx + mw + 30;
    const tier = [...COMBO_TIERS].reverse().find(c => G.combo >= c[0]);
    txt(`COMBO x${G.combo}`, cx, 20, { size: 16, weight: 900, color: '#ffd84a' });
    if (tier) txt(tier[1], cx, 38, { size: 10, weight: 900, color: '#ffefa8' });
    ctx.fillStyle = 'rgba(255,216,74,0.5)'; ctx.fillRect(cx, 46, 90 * (G.comboT / 2.6), 2);
  }
  // score + clock
  txt(G.score.toLocaleString('nl-NL'), W - 20, 20, { size: 20, weight: 900, align: 'right' });
  let clock = r.mode === 'endless' ? `BEST WAVE ${Save.data.endlessBest}` : CHAPTERS[r.chapter].clock;
  if (r.mode === 'story' && r.chapter === CHAPTERS.length - 1) {
    const secs = Math.min(59, 30 + Math.floor(r.time / 6));
    clock = secs >= 59 && Math.floor(G.t * 3) % 2 ? '23:59:--' : `23:59:${String(secs).padStart(2, '0')}`;
  }
  txt(clock, W - 20, 39, { size: 12, weight: 700, align: 'right', color: th.accent, font: MONO });
  // boss bar
  const b = G.boss;
  if (b && !b.dead && !G.bossIntro) {
    const bw = 520, bx = W / 2 - bw / 2, by = 72;
    txt(b.d.name, W / 2, 64, { size: 12, weight: 900, align: 'center', color: b.d.color, stroke: 'rgba(0,0,0,0.7)', strokeW: 4 });
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; rr(bx - 2, by - 2, bw + 4, 14, 7); ctx.fill();
    b.shownHp = lerp(b.shownHp ?? b.hp, b.hp, 0.08);
    ctx.fillStyle = '#ffffff'; rr(bx, by, Math.max(0, bw * b.shownHp / b.maxhp), 10, 5); ctx.fill();
    ctx.fillStyle = b.phase > 1 ? '#ff3b5c' : b.d.color; rr(bx, by, Math.max(0, bw * b.hp / b.maxhp), 10, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(bx + bw / 2 - 1, by - 2, 2, 14);
  }
  ctx.restore();
}

// ───────────────────────────── cutscenes ─────────────────────────────
function updateCutscene(rdt) {
  const c = G.cutscene;
  c.t += rdt;
  updateFX(rdt);
  const ev = (key, at, fn) => { if (c.t >= at && !c.ev[key]) { c.ev[key] = true; fn(); } };
  ev('click', 4.9, () => Snd.sfx.select());
  ev('err', 5.7, () => { Snd.sfx.glitch(); addShake(6); glitch(0.3); });
  ev('f1', 6.0, () => { Snd.sfx.deny(); glitch(0.2); addShake(4); });
  ev('f2', 6.3, () => { Snd.sfx.deny(); glitch(0.2); addShake(6); });
  ev('f3', 6.6, () => { Snd.sfx.glitch(); glitch(0.4); addShake(8); });
  ev('roar', 6.9, () => { Snd.sfx.roar(); glitch(0.6); });
  ev('shatter', 7.6, () => {
    Snd.sfx.boom(); Snd.sfx.whoosh(); flash('#ffffff', 1); addShake(20);
    for (let i = 0; i < 70; i++) { const life = rand(0.8, 1.6); particle({ x: rand(130, 830), y: rand(70, 470), vx: rand(-400, 400), vy: rand(-400, 200), life, max: life, size: rand(10, 26), color: pick(['#1e6fd9', '#ffffff', '#eef3fb', '#e5484d', '#2fbf71']), shape: 'paper', drag: 0.5, grav: 500, rot: rand(TAU), vr: rand(-8, 8), add: false }); }
  });
  const skip = c.t > 0.4 && (confirmPressed() || keyPressed('Escape'));
  if (c.t > 8.6 || skip) {
    if (skip && c.t < 7.6) { flash('#ffffff', 0.8); Snd.sfx.whoosh(); }
    consumeInput();
    G.cutscene = null;
    nextStep();
  }
}

function drawPrologue() {
  const c = G.cutscene, t = c.t;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (t < 2.8) {
    const s = '23:58 — the night before report cards.';
    const n = Math.floor(clamp((t - 0.3) * 24, 0, s.length));
    if (n > (c.lastN || 0)) { c.lastN = n; Snd.sfx.type(1.3); }
    txt(s.slice(0, n) + (Math.floor(t * 3) % 2 ? '_' : ''), W / 2, H / 2, { size: 22, font: MONO, align: 'center', color: '#d6e4ff', weight: 600 });
    if (t > 1.6) txt('"Just one quick look at my grades..."', W / 2, H / 2 + 40, { size: 16, italic: true, align: 'center', color: '#6f84a8', weight: 600 });
    return;
  }
  if (t >= 7.6) {
    drawBackground('rooster', G.t);
    ctx.fillStyle = `rgba(255,255,255,${clamp(1 - (t - 7.6) / 1.0, 0, 1)})`; ctx.fillRect(0, 0, W, H);
    return;
  }
  const a = clamp((t - 2.8) / 0.5, 0, 1);
  ctx.save();
  ctx.globalAlpha = a;
  const x = 130, y = 70, w = 700, h = 400;
  const err = t > 5.7;
  if (err) ctx.translate(rand(-2, 2) * (t - 5.7), rand(-2, 2) * (t - 5.7));
  ctx.fillStyle = '#eef3fb'; rr(x, y, w, h, 10); ctx.fill();
  const hg = ctx.createLinearGradient(x, 0, x + w, 0);
  hg.addColorStop(0, err && t > 6.6 ? '#b3122d' : '#1e6fd9'); hg.addColorStop(1, err && t > 6.6 ? '#e5484d' : '#2b8bf2');
  ctx.fillStyle = hg; rr(x, y, w, 46, 10); ctx.fill(); ctx.fillRect(x, y + 30, w, 16);
  txt('Somtoday', x + 20, y + 23, { size: 20, weight: 800 });
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + w - 30, y + 23, 14, 0, TAU); ctx.fill();
  txt(Save.data.name[0].toUpperCase(), x + w - 30, y + 24, { size: 14, weight: 900, align: 'center', color: '#1e6fd9' });
  drawPing(x + w - 70, y + 23, 0.3, G.t, false);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y + 46, 150, h - 46);
  ['Vandaag', 'Rooster', 'Huiswerk', 'Cijfers', 'Afwezigheid', 'Berichten'].forEach((m, i) => {
    const sel = m === 'Cijfers';
    if (sel) { ctx.fillStyle = '#e3eefc'; ctx.fillRect(x, y + 64 + i * 40, 150, 34); ctx.fillStyle = '#1e6fd9'; ctx.fillRect(x, y + 64 + i * 40, 4, 34); }
    txt(m, x + 22, y + 81 + i * 40, { size: 14, weight: sel ? 800 : 600, color: sel ? '#1e6fd9' : '#4a5876' });
  });
  txt('Laatste cijfers', x + 180, y + 80, { size: 20, weight: 800, color: '#1d2b4a' });
  const rows = [['Nederlands', 7.2], ['Engels', 6.8], ['Biologie', 5.1], ['Wiskunde', null]];
  const flips = [6.0, 6.3, 6.6];
  rows.forEach((row, i) => {
    const ry = y + 110 + i * 62;
    ctx.fillStyle = '#ffffff'; rr(x + 175, ry, w - 200, 52, 8); ctx.fill();
    ctx.strokeStyle = '#d7e1f0'; ctx.lineWidth = 1; rr(x + 175, ry, w - 200, 52, 8); ctx.stroke();
    txt(row[0], x + 195, ry + 19, { size: 15, weight: 700, color: '#1d2b4a' });
    txt(i === 3 ? 'Proefwerk H4 · weging 3x' : 'Toets · weging 1x', x + 195, ry + 37, { size: 11, weight: 600, color: '#8392ad' });
    let g = row[1], col;
    if (i === 3) {
      if (t < 5.0) { g = null; col = '#9aa7bd'; }
      else if (t < 5.7) { g = 'spin'; col = '#9aa7bd'; }
      else { g = 1; col = '#e5484d'; }
    } else {
      if (t > flips[i]) g = 1;
      col = gradeColor(g);
    }
    const tx = x + w - 100;
    ctx.fillStyle = col; rr(tx, ry + 8, 64, 36, 7); ctx.fill();
    if (g === null) {
      txt('?', tx + 32, ry + 27, { size: 20, weight: 900, align: 'center' });
      ctx.fillStyle = '#ff9f43'; rr(tx - 40, ry + 15, 34, 18, 9); ctx.fill();
      txt('NEW', tx - 23, ry + 24.5, { size: 10, weight: 900, align: 'center' });
    } else if (g === 'spin') {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(tx + 32, ry + 26, 9, G.t * 10, G.t * 10 + 4); ctx.stroke();
    } else if (g === 1 && (t > 5.7 && (i === 3 || t > flips[i]))) {
      glitchText('1,0', tx + 32, ry + 27, 18, '#fff', 1.5);
    } else txt(fmtGrade(g), tx + 32, ry + 27, { size: 18, weight: 900, align: 'center' });
  });
  if (err) {
    const k = clamp((t - 5.7) / 0.2, 0, 1);
    ctx.save(); ctx.translate(W / 2, H / 2 + 20); ctx.scale(k, k);
    ctx.fillStyle = '#1a0006'; rr(-230, -50, 460, 100, 10); ctx.fill();
    ctx.strokeStyle = '#ff3b5c'; ctx.lineWidth = 3; rr(-230, -50, 460, 100, 10); ctx.stroke();
    glitchText('ERROR 404: CIJFER NIET GEVONDEN', 0, -12, 20, '#ff3b5c', 1.5);
    txt('something is eating the database', 0, 20, { size: 13, font: MONO, align: 'center', color: '#ff8a9c' });
    ctx.restore();
  }
  if (t > 6.9) {
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    const r = seeded('crack');
    for (let i = 0; i < 9; i++) {
      let px = W / 2, py = H / 2; ctx.beginPath(); ctx.moveTo(px, py);
      const a = r() * TAU, len = (t - 6.9) * 600;
      for (let s = 0; s < 6; s++) { px += Math.cos(a + (r() - 0.5)) * len / 6; py += Math.sin(a + (r() - 0.5)) * len / 6; ctx.lineTo(px, py); }
      ctx.stroke();
    }
  }
  // animated cursor
  if (t > 3.3 && t < 5.7) {
    const k = ease.inOutSine(clamp((t - 3.4) / 1.4, 0, 1));
    const cx = lerp(W - 60, x + w - 68, k), cy = lerp(H - 30, y + 110 + 3 * 62 + 26, k);
    const press = t > 4.9 && t < 5.05 ? 0.85 : 1;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(press, press);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 20); ctx.lineTo(5, 15); ctx.lineTo(9, 23); ctx.lineTo(12, 21); ctx.lineTo(8, 14); ctx.lineTo(14, 14); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    if (t > 4.9 && t < 5.3) { ctx.strokeStyle = 'rgba(30,111,217,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, (t - 4.9) * 80, 0, TAU); ctx.stroke(); }
  }
  ctx.restore();
  if (t > 0.4) txt('click / enter to skip', W - 16, H - 14, { size: 11, align: 'right', color: 'rgba(255,255,255,0.3)' });
}

// ───────────────────────────── scenes: update ─────────────────────────────
function update(rdt) {
  G.t += rdt;
  decayFX(rdt);
  if (!G.editName && keyPressed('KeyM')) toggleMute();
  if (G.scene === 'title') updateTitle(rdt);
  else if (G.scene === 'play') updatePlay(rdt);
  else if (G.scene === 'gameover') updateGameOver(rdt);
  else if (G.scene === 'ending') updateEnding(rdt);
}

function titleItems() {
  const d = Save.data, items = [{ id: 'new', label: 'NEW STORY' }];
  if (d.story && d.story.chapter > 0 && CHAPTERS[d.story.chapter]) items.push({ id: 'cont', label: `CONTINUE — CH.${d.story.chapter + 1}: ${CHAPTERS[d.story.chapter].title}` });
  items.push(d.beaten ? { id: 'endless', label: `TOETSWEEK (ENDLESS) — BEST: WAVE ${d.endlessBest}` } : { id: 'endless', label: 'TOETSWEEK — 🔒 finish the story first', locked: true });
  items.push({ id: 'name', label: `NAME: ${d.name}${G.editName ? (Math.floor(G.t * 3) % 2 ? '_' : ' ') : ''}` });
  items.push({ id: 'mode', label: `DIFFICULTY: ${d.chill ? 'CHILL (7 lives, slower bullets)' : 'NORMAL'}` });
  items.push({ id: 'sound', label: `SOUND: ${Snd.muted ? 'OFF' : 'ON'}  [M]` });
  items.push({ id: 'quit', label: 'BACK TO SOMTODAY' });
  return items;
}

function updateTitle(rdt) {
  updateFX(rdt);
  Snd.playMusic('title');
  G.theme = 'menu';
  const items = titleItems();
  if (G.editName) {
    for (const ch of input.typed) if (Save.data.name.length < 14 && /^[\p{L}\p{N} _\-.]$/u.test(ch)) Save.data.name = (G.nameFresh ? '' : Save.data.name) + ch, G.nameFresh = false;
    if (keyPressed('Backspace')) { Save.data.name = G.nameFresh ? '' : Save.data.name.slice(0, -1); G.nameFresh = false; }
    if (keyPressed('Enter', 'NumpadEnter', 'Escape') || input.click) {
      if (!Save.data.name.trim()) Save.data.name = 'Student';
      Save.data.name = Save.data.name.trim();
      G.editName = false; Save.write(); Snd.sfx.confirm(); consumeInput();
    }
    return;
  }
  if (keyPressed('Escape')) { closeGame(); return; }
  const [sel, chosen] = menuNav(items, Math.min(G.menuSel, items.length - 1));
  G.menuSel = sel;
  if (chosen < 0) return;
  const it = items[chosen];
  consumeInput();
  if (it.locked) { Snd.sfx.deny(); return; }
  Snd.sfx.confirm();
  if (it.id === 'new') { Save.data.story = null; newRun('story', 0); }
  else if (it.id === 'cont') newRun('story', Save.data.story.chapter);
  else if (it.id === 'endless') newRun('endless');
  else if (it.id === 'name') { G.editName = true; G.nameFresh = true; }
  else if (it.id === 'mode') { Save.data.chill = !Save.data.chill; Save.write(); }
  else if (it.id === 'sound') toggleMute();
  else if (it.id === 'quit') closeGame();
}

function updatePlay(rdt) {
  if (keyPressed('Escape', 'KeyP') && !G.cutscene && !G.player.dead) {
    G.paused = !G.paused; G.pauseSel = 0; Snd.duck(G.paused); Snd.sfx.select(); consumeInput(); return;
  }
  if (G.paused) {
    const items = pauseItems();
    const [sel, chosen] = menuNav(items, G.pauseSel);
    G.pauseSel = sel;
    if (chosen >= 0) {
      const id = items[chosen].id; consumeInput(); Snd.sfx.confirm();
      if (id === 'resume') { G.paused = false; Snd.duck(false); }
      else if (id === 'sound') toggleMute();
      else if (id === 'title') { G.paused = false; Snd.duck(false); toTitle(); }
      else if (id === 'quit') closeGame();
    }
    return;
  }
  if (G.cutscene) { updateCutscene(rdt); return; }
  const dt = FX.hitstop > 0 ? 0 : rdt * FX.slow;
  updateFX(dt);
  if (G.chReport) {
    G.chReport.t += rdt;
    if (G.chReport.landed && G.chReport.t > 2 && confirmPressed()) { consumeInput(); Snd.sfx.confirm(); afterChapter(); }
    return;
  }
  if (G.card) {
    G.card.t += rdt;
    if (G.card.t > 3.4 || (G.card.t > 0.6 && confirmPressed())) { G.card = null; consumeInput(); nextStep(); }
    return;
  }
  if (G.dialog) { updateDialog(rdt); return; }
  if (G.upgrade) { updateUpgrade(rdt); return; }
  G.run.time += dt; G.stats.time += dt;
  if (G.banner) { G.banner.t += rdt; if (G.banner.t > 2) G.banner = null; }
  if (G.bossIntro) { G.bossIntro.t += rdt; if (G.bossIntro.t > 2.4) G.bossIntro = null; }
  updatePlayer(G.player, dt);
  updatePlayerBullets(dt);
  updateEnemies(dt);
  updateEnemyBullets(dt);
  updateLasers(dt);
  updatePickups(dt, !!(G.run.wave && G.run.wave.cleared) || !!G.dyingBoss);
  if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
  if (G.ptChain && Math.random() < dt * 2) G.ptChain = 0;
  if (!G.player.dead) updateWave(dt);
  updateDyingBoss(rdt);
  if (G.player.dead) { G.deadT += rdt; if (G.deadT > 2.2) gameOver(); }
}

function toTitle() {
  resetArena();
  G.scene = 'title'; G.theme = 'menu'; G.menuSel = 0;
  Snd.playMusic('title');
}

function updateGameOver(rdt) {
  const g = G.go;
  g.t += rdt;
  updateFX(rdt);
  if (g.t < 1.2) return;
  const items = goItems();
  const [sel, chosen] = menuNav(items, g.sel);
  g.sel = sel;
  if (chosen >= 0) {
    consumeInput(); Snd.sfx.confirm();
    if (items[chosen].id === 'retry') retake(); else toTitle();
  }
}
function goItems() {
  return G.run.mode === 'endless' ? [{ id: 'retry', label: 'TRY AGAIN' }, { id: 'title', label: 'BACK TO TITLE' }] : [{ id: 'retry', label: 'HERKANSING (retake chapter)' }, { id: 'title', label: 'BACK TO TITLE' }];
}

function startEnding() {
  G.scene = 'ending';
  const grades = CHAPTERS.map(c => G.run.grades[c.id] ?? 6);
  G.end = { phase: 'rapport', t: 0, grades, avg: grades.reduce((a, b) => a + b, 0) / grades.length, ev: {} };
  Save.data.beaten = true; Save.data.story = null;
  Save.data.lastAvg = G.end.avg;
  Save.write();
  resetArena(); G.theme = 'menu';
  Snd.playMusic('ending');
}

const ENDING_TALK = [
  ['ping', 'A 5,5! IT\'S A PASS!', 'confetti'],
  ['you', '...I fought a living 1,0 for a 5,5.'],
  ['ping', 'And you\'d do it again.'],
  ['you', '...Yeah. Yeah, I would.'],
  ['ping', 'Same time next report? *ding*'],
];

function updateEnding(rdt) {
  const e = G.end;
  e.t += rdt;
  updateFX(rdt);
  if (G.dialog) { updateDialog(rdt); return; }
  if (e.phase === 'rapport') {
    e.grades.forEach((g, i) => { if (e.t > 0.8 + i * 0.45 && !e.ev['r' + i]) { e.ev['r' + i] = true; Snd.sfx.slam(); } });
    const avgAt = 0.8 + e.grades.length * 0.45 + 0.3;
    if (e.t > avgAt && !e.ev.avg) { e.ev.avg = true; Snd.sfx.fanfare(); confetti(); }
    if (e.t > avgAt + 0.8 && confirmPressed()) { consumeInput(); e.phase = 'reveal'; e.t = 0; Snd.sfx.whoosh(); }
  } else if (e.phase === 'reveal') {
    if (e.t < 2.6) { e.spin = (e.spin || 0) + rdt; const iv = 0.04 + e.t * 0.06; if (e.spin > iv) { e.spin = 0; e.shown = rand(1, 10); Snd.sfx.tick(); } }
    else if (!e.ev.land) { e.ev.land = true; e.shown = 5.5; Snd.sfx.slam(); flash('#2fbf71', 0.6); addShake(10); burst(W / 2, H / 2 + 10, ['#2fbf71', '#ffd84a', '#fff'], 60, 420, { life: 1.5 }); }
    if (e.t > 3.4 && !e.ev.talk) { e.ev.talk = true; openDialog(ENDING_TALK, () => { G.end.phase = 'credits'; G.end.t = 0; }); }
  } else if (e.phase === 'credits') {
    if ((e.t > 2 && confirmPressed()) || e.t > CREDITS.length * 1.0 + 9) { consumeInput(); toTitle(); }
  }
}

// ───────────────────────────── scenes: render ─────────────────────────────
function render() {
  const dpr = view.dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(view.s * dpr, 0, 0, view.s * dpr, view.ox * dpr, view.oy * dpr);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  if (G.scene === 'title') drawTitle();
  else if (G.scene === 'play') drawPlay();
  else if (G.scene === 'gameover') drawGameOver();
  else if (G.scene === 'ending') drawEnding();
  if (FX.flash > 0) { ctx.globalAlpha = Math.min(1, FX.flash); ctx.fillStyle = FX.flashCol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  drawCursor(input.mx, input.my, G.t, (THEMES[G.theme] || THEMES.menu).accent);
  ctx.restore();
  postFX(dpr);
}

function shakeOffset() {
  if (FX.shake <= 0) return [0, 0];
  return [rand(-1, 1) * FX.shake, rand(-1, 1) * FX.shake];
}

function drawTitle() {
  drawBackground('menu', G.t);
  ctx.save();
  const [sx, sy] = shakeOffset(); ctx.translate(sx, sy);
  const bob = Math.sin(G.t * 1.5) * 4;
  const gl = Math.random() < 0.03 ? rand(2, 5) : 0.4;
  ctx.font = `900 92px ${FONT}`;
  const w1 = ctx.measureText('SOM').width, w2 = ctx.measureText('QUEST').width;
  const lx = W / 2 - (w1 + w2) / 2;
  glitchText('SOM', lx + w1 / 2, 112 + bob, 92, '#ffffff', gl);
  glitchText('QUEST', lx + w1 + w2 / 2, 112 + bob, 92, '#3aa0ff', gl);
  txt('— HET LAATSTE RAPPORT —', W / 2, 170 + bob, { size: 16, weight: 800, align: 'center', color: '#ffd84a' });
  drawPing(lx + w1 + w2 + 46, 92 + bob, 0.9, G.t, false);
  drawStudent(lx - 50, 104 + bob, 0.9, G.t, false);
  drawFXParts();
  ctx.restore();
  drawMenu(titleItems(), G.menuSel, 222, 38);
  if (G.editName) txt('type your name · enter to save', W / 2, 222 + 3 * 38 + 22, { size: 11, align: 'center', color: '#ffd84a' });
  txt('WASD move · MOUSE aim · HOLD CLICK write · SPACE dash · E inleveren · ESC pause · M mute', W / 2, H - 38, { size: 12, weight: 700, align: 'center', color: '#7d93ba' });
  txt('A fan-made story mod for Somtoday · not affiliated with Somtoday', W / 2, H - 18, { size: 10, align: 'center', color: 'rgba(255,255,255,0.3)' });
  drawOverlay();
}

function drawPlay() {
  if (G.cutscene) { drawPrologue(); drawFXParts(); drawOverlay(); return; }
  const th = THEMES[G.theme];
  ctx.save();
  const [sx, sy] = shakeOffset(); ctx.translate(sx, sy);
  drawBackground(G.theme, G.t);
  ctx.strokeStyle = th.accent; ctx.globalAlpha = 0.25; ctx.lineWidth = 2;
  rr(AX, AY, AR - AX, AB - AY, 10); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.save();
  ctx.beginPath(); ctx.rect(AX - 6, AY - 6, AR - AX + 12, AB - AY + 12); ctx.clip();
  drawPickups();
  for (const e of G.enemies) if (!e.boss) drawEnemy(e);
  for (const e of G.enemies) if (e.boss) drawEnemy(e);
  if (G.dyingBoss && G.dyingBoss.t < 1.6) {
    const db = G.dyingBoss;
    ctx.save(); ctx.translate(db.x + rand(-4, 4), db.y + rand(-4, 4));
    BOSS_SPRITES[db.e.d.sprite](0, 0, 1 + db.t * 0.05, G.t, { flash: Math.floor(G.t * 20) % 2 === 0, phase: 2, hpk: 0, ent: db.e, alpha: 1 });
    ctx.restore();
  }
  drawPlayer(G.player);
  ctx.restore();
  if (th.dark) {
    const p = G.player, lights = [{ x: p.x, y: p.y, r: 200 + Math.sin(G.t * 9) * 6 }];
    if (G.boss && !G.boss.dead) lights.push({ x: G.boss.x, y: G.boss.y, r: 120, a: 0.55 * (G.boss.alpha ?? 1) });
    for (const pk of G.pickups) if (pk.kind === 'hp') lights.push({ x: pk.x, y: pk.y, r: 40, a: 0.8 });
    if (G.dyingBoss) lights.push({ x: G.dyingBoss.x, y: G.dyingBoss.y, r: 300 });
    drawDarkness(lights, 0.94);
    for (const e of G.enemies) {
      if (e.boss || e.spawnT > 0 || e.alpha < 0.3) continue;
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#c6b6ff';
      ctx.shadowColor = '#a58bff'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(e.x - 4, e.y - 4, 2, 0, TAU); ctx.arc(e.x + 4, e.y - 4, 2, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
  ctx.save();
  ctx.beginPath(); ctx.rect(AX - 6, AY - 6, AR - AX + 12, AB - AY + 12); ctx.clip();
  drawLasers();
  drawPlayerBullets();
  drawEnemyBullets();
  ctx.restore();
  drawFXParts();
  drawFXTexts();
  ctx.restore();
  drawOverlay();
  const p = G.player;
  if (p.hp === 1 && !p.dead) {
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7);
    v.addColorStop(0, 'rgba(255,0,40,0)'); v.addColorStop(1, `rgba(255,0,40,${0.18 + 0.1 * Math.sin(G.t * 6)})`);
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }
  drawHUD();
  drawBanner();
  if (G.bossIntro) drawBossIntro();
  if (G.card) drawCard();
  if (G.upgrade) drawUpgrade();
  if (G.dialog) drawDialog();
  if (G.chReport) drawChReport();
  if (G.paused) drawPause();
}

function drawGameOver() {
  const g = G.go;
  drawBackground(G.theme, G.t);
  ctx.save();
  ctx.fillStyle = `rgba(20,0,6,${Math.min(0.85, g.t)})`; ctx.fillRect(0, 0, W, H);
  drawFXParts();
  const k = ease.outBack(clamp(g.t / 0.6, 0, 1));
  ctx.save(); ctx.translate(W / 2, 150); ctx.scale(k, k);
  glitchText('BLIJVEN ZITTEN', 0, 0, 64, '#ff3b5c', 1 + (Math.random() < 0.08 ? 4 : 0));
  ctx.restore();
  txt(G.run.mode === 'endless' ? `You survived until wave ${G.run.endlessN}.` : 'You got held back. The Onvoldoende grows stronger...', W / 2, 205, { size: 17, italic: true, weight: 600, align: 'center', color: '#ffb3c0' });
  if (g.newBest) txt('NEW PERSONAL BEST!', W / 2, 235, { size: 18, weight: 900, align: 'center', color: '#ffd84a' });
  txt(`Score ${G.score.toLocaleString('nl-NL')} · Kills ${G.stats.kills} · Best combo ${G.bestCombo}`, W / 2, 262, { size: 14, weight: 700, align: 'center', color: '#9fb3d1' });
  if (g.t > 1.2) drawMenu(goItems(), g.sel, 330);
  ctx.restore();
  drawOverlay();
}

function drawEnding() {
  const e = G.end;
  drawBackground('menu', G.t);
  ctx.save();
  const [sx, sy] = shakeOffset(); ctx.translate(sx, sy);
  if (e.phase === 'rapport') {
    const x = W / 2 - 300, y = 40, w = 600, h = 460;
    const k = ease.outCubic(clamp(e.t / 0.6, 0, 1));
    ctx.globalAlpha = k; ctx.translate(0, (1 - k) * 40);
    ctx.fillStyle = '#f6f8fc'; rr(x, y, w, h, 16); ctx.fill();
    ctx.fillStyle = '#1e6fd9'; rr(x, y, w, 70, 16); ctx.fill(); ctx.fillRect(x, y + 50, w, 20);
    txt('RAPPORT', x + 28, y + 28, { size: 26, weight: 900 });
    txt(`${Save.data.name} · Schooljaar 2026–2027 · Periode 1`, x + 28, y + 54, { size: 13, weight: 600, color: '#d6e4ff' });
    drawPing(x + w - 44, y + 36, 0.5, G.t, false);
    CHAPTERS.forEach((c, i) => {
      const ry = y + 92 + i * 52;
      ctx.fillStyle = i % 2 ? '#ffffff' : '#eef3fb'; ctx.fillRect(x + 20, ry, w - 40, 46);
      txt(`H${c.num}  ${c.title}`, x + 40, ry + 16, { size: 16, weight: 800, color: '#1d2b4a' });
      txt(c.sub, x + 40, ry + 33, { size: 11, weight: 600, color: '#8392ad' });
      if (e.t > 0.8 + i * 0.45) {
        const g = e.grades[i];
        const pop = ease.outBack(clamp((e.t - 0.8 - i * 0.45) / 0.3, 0, 1));
        ctx.save(); ctx.translate(x + w - 80, ry + 23); ctx.scale(pop, pop);
        ctx.fillStyle = gradeColor(g); rr(-34, -17, 68, 34, 7); ctx.fill();
        txt(fmtGrade(g), 0, 1, { size: 18, weight: 900, align: 'center' });
        ctx.restore();
      }
    });
    const avgAt = 0.8 + CHAPTERS.length * 0.45 + 0.3;
    if (e.t > avgAt) {
      const ry = y + 92 + CHAPTERS.length * 52 + 10;
      ctx.fillStyle = '#1d2b4a'; ctx.fillRect(x + 20, ry, w - 40, 2);
      txt('GEMIDDELDE', x + 40, ry + 30, { size: 18, weight: 900, color: '#1d2b4a' });
      txt(`Score ${G.score.toLocaleString('nl-NL')} · ${G.stats.kills} kills · ${fmtTime(G.stats.time)}`, x + 40, ry + 52, { size: 12, weight: 600, color: '#8392ad' });
      ctx.fillStyle = gradeColor(e.avg); rr(x + w - 124, ry + 12, 88, 40, 8); ctx.fill();
      txt(fmtGrade(e.avg), x + w - 80, ry + 33, { size: 22, weight: 900, align: 'center' });
      if (e.t > avgAt + 0.8 && Math.floor(G.t * 2) % 2) txt('click / enter', x + w / 2, y + h - 14, { size: 12, align: 'center', color: '#8392ad' });
    }
  } else if (e.phase === 'reveal') {
    txt('...and the grade you came to check:', W / 2, 120, { size: 20, italic: true, weight: 600, align: 'center', color: '#d6e4ff' });
    txt('WISKUNDE · Proefwerk H4', W / 2, 165, { size: 18, weight: 900, align: 'center', color: '#ffd84a' });
    const g = e.shown ?? 1;
    const landed = !!e.ev.land;
    const s = landed ? 1 + Math.max(0, 0.3 - (e.t - 2.6)) : 1;
    ctx.save(); ctx.translate(W / 2, H / 2 + 20); ctx.scale(s, s);
    ctx.fillStyle = landed ? '#2fbf71' : gradeColor(g); rr(-110, -70, 220, 140, 18); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; rr(-110, -70, 220, 140, 18); ctx.stroke();
    txt(fmtGrade(g), 0, 4, { size: 80, weight: 900, align: 'center' });
    ctx.restore();
    if (landed) txt('VOLDOENDE', W / 2, H / 2 + 130, { size: 26, weight: 900, align: 'center', color: '#2fbf71' });
  } else {
    const y0 = H + 20 - e.t * 42;
    drawPing(W - 120 + Math.sin(G.t * 0.7) * 40, 140 + Math.sin(G.t * 1.3) * 30, 1.1, G.t, false);
    drawMentor(120 + Math.sin(G.t * 0.5) * 20, 380, 0.9, G.t, false, false);
    CREDITS.forEach((c, i) => {
      const y = y0 + i * 40;
      if (y < -40 || y > H + 40) return;
      const s = c[1] === 'title' ? 58 : c[1] === 'head' ? 18 : c[1] === 'sub' ? 22 : c[1] === 'small' ? 13 : 17;
      const col = c[1] === 'title' ? '#ffffff' : c[1] === 'head' ? '#ffd84a' : c[1] === 'sub' ? '#3aa0ff' : c[1] === 'small' ? '#7d93ba' : '#d6e4ff';
      if (c[1] === 'title') glitchText(c[0], W / 2, y, s, col, 0.6);
      else txt(c[0].replace('{name}', Save.data.name), W / 2, y, { size: s, weight: c[1] ? 900 : 600, align: 'center', color: col });
    });
  }
  drawFXParts();
  drawFXTexts();
  ctx.restore();
  if (G.dialog) drawDialog();
  drawOverlay();
}

// ── 07-launcher.js ──
// ───────────────────────────── overlay, loop & Somtoday integration ─────────────────────────────
const view = { s: 1, ox: 0, oy: 0, dpr: 1 };
let overlay = null, isOpen = false, running = false, rafId = 0, lastTs = 0;

const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Escape', 'Backspace', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyQ', 'KeyM', 'KeyP', 'KeyZ', 'ShiftLeft', 'ShiftRight']);

function resize() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = window.innerWidth, ch = window.innerHeight;
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  view.dpr = dpr;
  view.s = Math.min(cw / W, ch / H);
  view.ox = (cw - W * view.s) / 2; view.oy = (ch - H * view.s) / 2;
}

function toGame(e) {
  input.mx = clamp((e.clientX - view.ox) / view.s, 0, W);
  input.my = clamp((e.clientY - view.oy) / view.s, 0, H);
}

const handlers = {
  keydown(e) {
    if (!isOpen) return;
    if (GAME_KEYS.has(e.code) || e.code.startsWith('Digit') || G.editName) { e.preventDefault(); }
    e.stopPropagation();
    if (!e.repeat) { input.keys.add(e.code); input.pressed.add(e.code); }
    if (G.editName && e.key.length === 1) input.typed.push(e.key);
  },
  keyup(e) { if (!isOpen) return; input.keys.delete(e.code); e.stopPropagation(); },
  mousemove(e) { toGame(e); input.moved = true; },
  mousedown(e) {
    toGame(e); Snd.init();
    if (e.button === 0) { input.mdown = true; input.click = true; }
    if (e.button === 2) input.rclick = true;
    e.preventDefault();
  },
  mouseup(e) { if (e.button === 0) input.mdown = false; },
  contextmenu(e) { e.preventDefault(); },
  blur() {
    input.keys.clear(); input.mdown = false;
    if (G.scene === 'play' && !G.paused && !G.cutscene && G.player && !G.player.dead) { G.paused = true; G.pauseSel = 0; Snd.duck(true); }
  },
  touchstart(e) { const t = e.touches[0]; if (t) { toGame(t); input.mdown = true; input.click = true; } Snd.init(); e.preventDefault(); },
  touchmove(e) { const t = e.touches[0]; if (t) toGame(t); e.preventDefault(); },
  touchend() { input.mdown = false; },
};

function frame(ts) {
  if (!running) return;
  rafId = requestAnimationFrame(frame);
  const rdt = Math.min(0.05, Math.max(0, (ts - lastTs) / 1000));
  lastTs = ts;
  try {
    update(rdt);
    render();
  } catch (err) {
    console.error('[SomQuest]', err);
  }
  input.pressed.clear(); input.click = false; input.rclick = false; input.typed.length = 0; input.moved = false;
}

function pageGlitch(done) {
  const el = document.documentElement;
  const prevFilter = el.style.filter, prevTransform = el.style.transform;
  const steps = [
    'hue-rotate(90deg) saturate(3)', 'invert(1)', 'hue-rotate(200deg) contrast(2)', 'saturate(0) brightness(1.6)', 'hue-rotate(320deg) saturate(4)', 'invert(1) hue-rotate(180deg)',
  ];
  let i = 0;
  const tick = () => {
    if (i >= steps.length) { el.style.filter = prevFilter; el.style.transform = prevTransform; done(); return; }
    el.style.filter = steps[i];
    el.style.transform = `translate(${rand(-12, 12)}px, ${rand(-6, 6)}px) skewX(${rand(-3, 3)}deg)`;
    i++;
    setTimeout(tick, 70);
  };
  tick();
}

function mount() {
  overlay = document.createElement('div');
  overlay.id = 'somquest-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#000;opacity:0;transition:opacity .35s ease;cursor:none;touch-action:none;';
  canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;';
  overlay.appendChild(canvas);
  document.body.appendChild(overlay);
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', handlers.keydown, true);
  window.addEventListener('keyup', handlers.keyup, true);
  window.addEventListener('blur', handlers.blur);
  overlay.addEventListener('mousemove', handlers.mousemove);
  overlay.addEventListener('mousedown', handlers.mousedown);
  window.addEventListener('mouseup', handlers.mouseup);
  overlay.addEventListener('contextmenu', handlers.contextmenu);
  overlay.addEventListener('touchstart', handlers.touchstart, { passive: false });
  overlay.addEventListener('touchmove', handlers.touchmove, { passive: false });
  overlay.addEventListener('touchend', handlers.touchend);
}

function unmount() {
  window.removeEventListener('resize', resize);
  window.removeEventListener('keydown', handlers.keydown, true);
  window.removeEventListener('keyup', handlers.keyup, true);
  window.removeEventListener('blur', handlers.blur);
  window.removeEventListener('mouseup', handlers.mouseup);
  const o = overlay;
  overlay = null;
  if (o) { o.style.opacity = '0'; setTimeout(() => o.remove(), 380); }
}

function openGame() {
  if (isOpen) return;
  isOpen = true;
  Save.load();
  Snd.init(); Snd.setMuted(Save.data.muted); Snd.resume();
  Snd.sfx.glitch();
  const btn = document.getElementById('somquest-launch');
  if (btn) btn.style.display = 'none';
  pageGlitch(() => {
    mount();
    input.keys.clear(); input.pressed.clear();
    G.scene = 'title'; G.menuSel = 0; G.theme = 'menu'; G.editName = false;
    resetFX(); flash('#ffffff', 0.8); glitch(0.4);
    requestAnimationFrame(() => { if (overlay) overlay.style.opacity = '1'; });
    running = true; lastTs = performance.now();
    rafId = requestAnimationFrame(frame);
  });
}

function closeGame() {
  if (!isOpen) return;
  isOpen = false; running = false;
  cancelAnimationFrame(rafId);
  Snd.stopMusic();
  setTimeout(() => Snd.suspend(), 600);
  Save.write();
  unmount();
  const btn = document.getElementById('somquest-launch');
  if (btn) btn.style.display = '';
  toast(pick([
    'PING: Come back soon — the grades won\'t defend themselves! 🔔',
    'PING: Don\'t forget your actual homework. 🔔',
    'MENTOR.EXE: Goed bezig. Let op je inzet. 🖥️',
    'PING: The Onvoldoende never sleeps. Neither do I. 🔔',
  ]));
}

function toast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;right:18px;bottom:72px;z-index:2147483646;max-width:320px;padding:12px 16px;border-radius:12px;background:#0d1630;color:#eef4ff;font:600 14px/1.35 system-ui,"Segoe UI",Roboto,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35);border:1px solid #3aa0ff;opacity:0;transform:translateY(10px);transition:opacity .3s,transform .3s;';
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; setTimeout(() => t.remove(), 400); }, 4500);
}

function installButton() {
  if (!document.body || document.getElementById('somquest-launch')) return;
  const b = document.createElement('button');
  b.id = 'somquest-launch';
  b.type = 'button';
  b.textContent = '⚔️ SomQuest';
  b.title = 'Play SomQuest — Het Laatste Rapport (Alt+Q)';
  b.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483646;padding:11px 18px;border:0;border-radius:999px;font:800 14px/1 system-ui,"Segoe UI",Roboto,sans-serif;color:#fff;background:linear-gradient(135deg,#1f7bff,#7a3cff);box-shadow:0 6px 22px rgba(31,123,255,.45),inset 0 1px 0 rgba(255,255,255,.35);cursor:pointer;letter-spacing:.3px;transition:transform .15s ease,box-shadow .15s ease;';
  b.addEventListener('mouseenter', () => { b.style.transform = 'translateY(-2px) scale(1.05)'; b.style.boxShadow = '0 10px 30px rgba(122,60,255,.6),inset 0 1px 0 rgba(255,255,255,.35)'; });
  b.addEventListener('mouseleave', () => { b.style.transform = ''; b.style.boxShadow = '0 6px 22px rgba(31,123,255,.45),inset 0 1px 0 rgba(255,255,255,.35)'; });
  b.addEventListener('click', openGame);
  document.body.appendChild(b);
  if (b.animate) b.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.35)' }, { filter: 'brightness(1)' }], { duration: 2400, iterations: Infinity });
}

// Alt+Q or the Konami code opens the game from anywhere on the page
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
let konamiIdx = 0;
function globalKeys(e) {
  if (isOpen) return;
  if (e.altKey && e.code === 'KeyQ') { e.preventDefault(); openGame(); return; }
  konamiIdx = e.code === KONAMI[konamiIdx] ? konamiIdx + 1 : e.code === KONAMI[0] ? 1 : 0;
  if (konamiIdx === KONAMI.length) { konamiIdx = 0; openGame(); }
}

function boot() {
  if (window.__somquestLoaded) return;
  window.__somquestLoaded = true;
  Save.load();
  installButton();
  setInterval(installButton, 2000); // Somtoday is a single-page app; re-add the button if a route change removes it
  window.addEventListener('keydown', globalKeys);
  window.SomQuest = {
    open: openGame,
    close: closeGame,
    _debug: {
      state: () => G,
      input: () => input,
      god: (on = true) => { G.debugGod = on; },
      chapter: i => { if (!isOpen) return; Save.data.story = null; newRun('story', 0); G.run.chapter = i; startChapter(i); },
      endless: () => newRun('endless'),
      jumpTo: type => { const r = G.run; const idx = r.steps.findIndex((s, i) => i > r.si && s.type === type); if (idx < 0) return; G.cutscene = G.dialog = G.card = G.upgrade = null; G.enemies.length = 0; G.eb.length = 0; G.lasers.length = 0; r.wave = null; r.si = idx - 1; nextStep(); },
      ending: () => { if (!G.run) newRun('story', 0); G.run.grades = { rooster: 8.4, huiswerk: 7.1, cijfers: 9.2, afwezig: 5.2, rapport: 6.8 }; startEnding(); },
    },
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
