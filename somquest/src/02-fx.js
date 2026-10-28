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
