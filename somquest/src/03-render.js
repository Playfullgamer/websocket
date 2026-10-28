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
