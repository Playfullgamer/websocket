/* Nation Roulette — wheel definitions and the canvas spinning wheel. */
(function (global) {
  'use strict';

  const s = (label, extra) => Object.assign({ label, weight: 1 }, extra);

  const WHEELS = [
    {
      key: 'continent', title: 'Continent', icon: '🌍', desc: 'Where in the world will your nation rise?',
      segments: [s('Africa', { value: 1 }), s('Asia', { value: 2 }), s('Europe', { value: 3 }),
        s('North America', { value: 4 }), s('South America', { value: 5 }), s('Oceania', { value: 6 })],
    },
    {
      key: 'region', title: 'Region', icon: '🧭', desc: 'Which corner of the continent do you claim?',
      segments: ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West', 'Central'].map(r => s(r)),
    },
    {
      key: 'landlocked', title: 'Landlocked?', icon: '🌊', desc: 'Will your nation touch the sea?',
      segments: [s('Coastal', { value: false }), s('Landlocked', { value: true }), s('Coastal', { value: false }),
        s('Landlocked', { value: true }), s('Coastal', { value: false })],
    },
    {
      key: 'borders', title: 'Border Style', icon: '✏️', desc: 'Winding rivers and ridges, or lines drawn on a map by distant diplomats?',
      segments: [s('Natural & Winding', { value: 'natural' }), s('Ruler-Straight', { value: 'straight' }), s('Mixed', { value: 'mixed' }),
        s('Natural & Winding', { value: 'natural' }), s('Ruler-Straight', { value: 'straight' }), s('Mixed', { value: 'mixed' })],
    },
    {
      key: 'size', title: 'Nation Size', icon: '📐', desc: 'How much land will you rule?',
      segments: [
        s('Microstate', { min: 1500, max: 8000, weight: 0.8 }),
        s('Tiny', { min: 8000, max: 40000, weight: 1.4 }),
        s('Small', { min: 40000, max: 150000, weight: 1.8 }),
        s('Medium', { min: 150000, max: 450000, weight: 1.8 }),
        s('Large', { min: 450000, max: 1200000, weight: 1.5 }),
        s('Huge', { min: 1200000, max: 3000000, weight: 1.0 }),
        s('Colossal', { min: 3000000, max: 7000000, weight: 0.6 }),
      ],
    },
    {
      key: 'terrain', title: 'Terrain', icon: '⛰️', desc: 'What does the land look like?',
      segments: ['Plains', 'Mountains', 'Rolling Hills', 'Dense Forest', 'Desert', 'Jungle', 'Highlands', 'Wetlands', 'Steppe', 'Canyons']
        .map(t => s(t)),
    },
    {
      key: 'population', title: 'Population Density', icon: '👥', desc: 'How many people call it home?',
      segments: [
        s('Desolate', { min: 0.5, max: 5 }), s('Sparse', { min: 5, max: 25 }), s('Moderate', { min: 25, max: 80 }),
        s('Dense', { min: 80, max: 250 }), s('Packed', { min: 250, max: 600 }), s('Megahive', { min: 600, max: 2200, weight: 0.6 }),
      ],
    },
    {
      key: 'ideology', title: 'Ideology', icon: '💡', desc: 'What do your people believe in?',
      segments: ['Liberalism', 'Conservatism', 'Socialism', 'Communism', 'Fascism', 'Nationalism', 'Anarchism',
        'Theocracy', 'Monarchism', 'Technocracy', 'Environmentalism', 'Libertarianism', 'Populism', 'Transhumanism'].map(t => s(t)),
    },
    {
      key: 'government', title: 'Government System', icon: '🏛️', desc: 'How is power organised?',
      segments: ['Absolute Monarchy', 'Constitutional Monarchy', 'Presidential Republic', 'Parliamentary Republic',
        'Federal Republic', 'One-Party State', 'Military Junta', 'Theocratic State', 'Direct Democracy', 'Oligarchy',
        'Corporate State', 'Tribal Confederation'].map(t => s(t)),
    },
    {
      key: 'doctrine', title: 'Political Doctrine', icon: '📜', desc: 'How does your nation deal with the world?',
      segments: ['Isolationism', 'Neutrality', 'Pacifism', 'Expansionism', 'Interventionism', 'Non-Alignment',
        'Hegemonism', 'Collective Security', 'Revanchism', 'Globalism', 'Protectionism', 'Pan-Nationalism'].map(t => s(t)),
    },
    {
      key: 'economy', title: 'Economic System', icon: '💰', desc: 'How does the money move?',
      segments: ['Free Market', 'Mixed Economy', 'Planned Economy', 'State Capitalism', 'Mercantilism', 'Agrarian',
        'Industrial Powerhouse', 'Service Economy', 'Tax Haven', 'Resource Economy'].map(t => s(t)),
    },
    {
      key: 'development', title: 'Development (HDI)', icon: '📈', desc: 'How developed is your nation?',
      segments: [
        s('Very Low', { min: 0.32, max: 0.45 }), s('Low', { min: 0.45, max: 0.55 }), s('Medium', { min: 0.55, max: 0.70 }),
        s('High', { min: 0.70, max: 0.80 }), s('Very High', { min: 0.80, max: 0.97 }),
      ],
    },
    {
      key: 'resource', title: 'Main Resource', icon: '⛏️', desc: 'What lies beneath your soil?',
      segments: ['Oil', 'Natural Gas', 'Gold', 'Diamonds', 'Rare Earths', 'Lithium', 'Uranium', 'Copper', 'Iron Ore',
        'Coal', 'Timber', 'Fisheries', 'Grain', 'Coffee & Spices', 'Tourism', 'Absolutely Nothing'].map(t => s(t)),
    },
    {
      key: 'religion', title: 'State Religion', icon: '🛐', desc: 'What faith guides the nation?',
      segments: ['Secular', 'Christianity', 'Islam', 'Hinduism', 'Buddhism', 'Judaism', 'Folk Religion', 'State Atheism',
        'Sun Cult', 'Machine Worship', 'Pluralism'].map(t => s(t)),
    },
    {
      key: 'military', title: 'Military Power', icon: '🛡️', desc: 'How strong is your army?',
      segments: [
        s('Demilitarized', { power: 0 }), s('Weak', { power: 1 }), s('Modest', { power: 2 }), s('Capable', { power: 3 }),
        s('Strong', { power: 4 }), s('Superpower', { power: 5, weight: 0.6 }), s('Nuclear Power', { power: 6, weight: 0.6 }),
      ],
    },
    {
      key: 'founded', title: 'Founding Era', icon: '⏳', desc: 'When was your nation born?',
      segments: [
        s('Ancient', { min: -2500, max: 500 }), s('Medieval', { min: 500, max: 1500 }), s('Early Modern', { min: 1500, max: 1800 }),
        s('Age of Revolutions', { min: 1776, max: 1900 }), s('Post-Colonial', { min: 1945, max: 1975 }),
        s('Post-Cold War', { min: 1989, max: 2010 }), s('Brand New', { min: 2026, max: 2026 }),
      ],
    },
    {
      key: 'stability', title: 'Stability', icon: '⚖️', desc: 'How calm is life at home?',
      segments: [
        s('Utopian', { score: 5, weight: 0.6 }), s('Stable', { score: 4 }), s('Calm-ish', { score: 3 }), s('Tense', { score: 2 }),
        s('Unstable', { score: 1 }), s('On the Brink', { score: 0, weight: 0.7 }),
      ],
    },
  ];

  const PALETTE = ['#ef476f', '#f78c6b', '#ffd166', '#06d6a0', '#1b9aaa', '#118ab2', '#7b5cff', '#c65bcf',
    '#ff7aa2', '#43aa8b', '#f9844a', '#4d908e', '#577590', '#90be6d', '#f3722c', '#9b5de5'];

  /* ---------- sound ---------- */
  const Sound = {
    enabled: true,
    ctx: null,
    ensure() {
      if (!this.ctx) {
        const AC = global.AudioContext || global.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    tone(freq, dur, type, vol) {
      if (!this.enabled) return;
      const ctx = this.ensure();
      if (!ctx) return;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'square';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.05, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.connect(g).connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + dur);
    },
    tick() { this.tone(1400 + Math.random() * 200, 0.03, 'square', 0.025); },
    ding() { this.tone(880, 0.25, 'triangle', 0.08); setTimeout(() => this.tone(1320, 0.35, 'triangle', 0.07), 90); },
    fanfare() {
      [523, 659, 784, 1047].forEach((f, k) => setTimeout(() => this.tone(f, 0.4, 'triangle', 0.08), k * 130));
    },
  };

  /* ---------- wheel ---------- */
  class Wheel {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.rot = Math.random() * Math.PI * 2;
      this.segments = [];
      this.highlight = -1;
      this.spinning = false;
      this.icon = '';
      this.resize();
      global.addEventListener('resize', () => this.resize());
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const size = Math.max(200, Math.floor(Math.min(rect.width, rect.height || rect.width)));
      const dpr = global.devicePixelRatio || 1;
      this.size = size;
      this.canvas.width = size * dpr;
      this.canvas.height = size * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.draw();
    }

    setSegments(segments, icon) {
      const total = segments.reduce((a, sg) => a + (sg.weight || 1), 0);
      let a = 0;
      const offset = Math.floor(Math.random() * PALETTE.length);
      this.segments = segments.map((sg, k) => {
        const span = (sg.weight || 1) / total * Math.PI * 2;
        let color = PALETTE[(k + offset) % PALETTE.length];
        if (k === segments.length - 1 && segments.length % PALETTE.length === 1) color = PALETTE[(k + offset + 3) % PALETTE.length];
        const out = { seg: sg, a0: a, a1: a + span, color };
        a += span;
        return out;
      });
      this.icon = icon || '';
      this.highlight = -1;
      this.draw();
    }

    indexAtPointer() {
      const local = ((-Math.PI / 2 - this.rot) % (Math.PI * 2) + Math.PI * 4) % (Math.PI * 2);
      return this.segments.findIndex(sg => local >= sg.a0 && local < sg.a1);
    }

    draw() {
      const ctx = this.ctx, size = this.size;
      if (!size) return;
      const cx = size / 2, cy = size / 2, r = size / 2 - 14;
      ctx.clearRect(0, 0, size, size);

      // outer rim
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r + 9, 0, Math.PI * 2);
      const rim = ctx.createLinearGradient(0, 0, size, size);
      rim.addColorStop(0, '#f6d77a'); rim.addColorStop(0.5, '#b8860b'); rim.addColorStop(1, '#f6d77a');
      ctx.fillStyle = rim; ctx.fill();
      ctx.restore();

      const n = this.segments.length;
      this.segments.forEach((sg, k) => {
        const a0 = sg.a0 + this.rot, a1 = sg.a1 + this.rot;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a0, a1); ctx.closePath();
        ctx.fillStyle = sg.color; ctx.fill();
        if (this.highlight >= 0 && this.highlight !== k) { ctx.fillStyle = 'rgba(10,15,30,0.55)'; ctx.fill(); }
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2; ctx.stroke();

        // label
        const mid = (a0 + a1) / 2, span = sg.a1 - sg.a0;
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(mid);
        const maxW = r * 0.66;
        let fs = Math.min(18, Math.max(9, r * span * 0.42), r * 0.085 + 4);
        if (n > 12) fs = Math.min(fs, r * 0.068 + 3);
        ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`;
        let label = sg.seg.label;
        while (ctx.measureText(label).width > maxW && fs > 8) { fs -= 0.5; ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`; }
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 3;
        ctx.fillText(label, r - 12, 0);
        ctx.restore();
      });

      // pegs
      for (let k = 0; k < n; k++) {
        const a = this.segments[k].a0 + this.rot;
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2), 3.2, 0, Math.PI * 2);
        ctx.fillStyle = '#fff8e1'; ctx.fill();
      }

      // hub
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.17, 0, Math.PI * 2);
      const hub = ctx.createRadialGradient(cx - 6, cy - 6, 2, cx, cy, r * 0.17);
      hub.addColorStop(0, '#fff6d5'); hub.addColorStop(1, '#c9971c');
      ctx.fillStyle = hub; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#7a5a0d'; ctx.stroke();
      if (this.icon) {
        ctx.font = `${Math.round(r * 0.15)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(this.icon, cx, cy + 1);
      }

      // pointer (top)
      ctx.save();
      ctx.translate(cx, 6);
      ctx.beginPath(); ctx.moveTo(-15, -2); ctx.lineTo(15, -2); ctx.lineTo(0, 30); ctx.closePath();
      ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 6; ctx.fill();
      ctx.shadowBlur = 0; ctx.lineWidth = 2.5; ctx.strokeStyle = '#d62839'; ctx.stroke();
      ctx.restore();
    }

    spin(fast) {
      if (this.spinning || !this.segments.length) return Promise.resolve(null);
      this.spinning = true;
      this.highlight = -1;
      const total = this.segments.reduce((a, sg) => a + (sg.seg.weight || 1), 0);
      let pick = Math.random() * total, idx = 0;
      for (; idx < this.segments.length - 1; idx++) { pick -= this.segments[idx].seg.weight || 1; if (pick < 0) break; }
      const sg = this.segments[idx];
      const target = sg.a0 + (sg.a1 - sg.a0) * (0.15 + Math.random() * 0.7);
      const TAU = Math.PI * 2;
      const start = this.rot;
      const want = ((-Math.PI / 2 - target - start) % TAU + TAU) % TAU;
      const turns = fast ? 2 : 5 + Math.floor(Math.random() * 3);
      const delta = turns * TAU + want;
      const duration = fast ? 700 : 3800 + Math.random() * 1200;
      const t0 = performance.now();
      let lastIdx = this.indexAtPointer();
      return new Promise(resolve => {
        const frame = now => {
          const t = Math.min(1, (now - t0) / duration);
          const e = 1 - Math.pow(1 - t, 4);
          this.rot = start + delta * e;
          const cur = this.indexAtPointer();
          if (cur !== lastIdx) { lastIdx = cur; if (!fast) Sound.tick(); }
          this.draw();
          if (t < 1) requestAnimationFrame(frame);
          else {
            this.rot = start + delta;
            this.highlight = idx;
            this.spinning = false;
            this.draw();
            resolve(sg.seg);
          }
        };
        requestAnimationFrame(frame);
      });
    }
  }

  global.NR = Object.assign(global.NR || {}, { WHEELS, Wheel, Sound });
})(window);
