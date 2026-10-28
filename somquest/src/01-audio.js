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
