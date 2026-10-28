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
  r.steps = [{ type: 'card', title: 'TOETSWEEK', sub: 'Elke baas. Eindeloze golven. Geen genade.', label: 'EINDELOZE MODUS', clock: `RECORD: GOLF ${Save.data.endlessBest}` }];
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
      G.card = { t: 0, title: st.title || ch.title, sub: st.sub || ch.sub, label: st.label || `HOOFDSTUK ${ch.num}`, clock: st.clock || ch.clock };
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
      Snd.sfx.heal(); floatText(G.player.x, G.player.y - 30, 'VOLLEDIG GENEZEN + INLEVEREN KLAAR', '#2fbf71', 16, { dur: 1.6 });
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
  G.banner = { text: st.endless ? `GOLF ${st.endless}` : `GOLF ${r.waveNum}/${r.waveTotal}`, t: 0 };
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
    if (!w.cleared) { w.cleared = true; floatText(W / 2, H / 2 - 30, 'GEHAALD!', '#2fbf71', 36, { dur: 1.2, vy: -12 }); Snd.sfx.confirm(); }
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
    floatText(W / 2, H / 2 - 20, 'VERSLAGEN', '#ffd84a', 46, { dur: 1.8, vy: -8 });
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
    txt('SYSTEEMLOG — /var/somtoday/mentor.log', x + 12, y + 13, { size: 12, font: MONO, color: '#02140a' });
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
    txt('TAB overslaan', x + w - 50, y + h - 20, { size: 10, color: 'rgba(255,255,255,0.3)', align: 'right' });
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
  txt('KIES JE SCHOOLSPULLEN', W / 2, 78 - (1 - k0) * 20, { size: 30, weight: 900, align: 'center', color: '#ffffff' });
  txt('Kluisje #404 — Gevonden voorwerpen', W / 2, 108, { size: 14, align: 'center', color: th.accent, weight: 700 });
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
    const tag = lv ? `NIV ${lv} → ${lv + 1}` : 'NIEUW';
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
  if (g >= 9.5) return 'Uitstekend! Automatisch gegenereerde opmerking: ...wauw.';
  if (g >= 8) return 'Goed bezig! Ga zo door.';
  if (g >= 6.5) return 'Ruim voldoende. Netjes gewerkt.';
  if (g >= 5.5) return 'Voldoende. Let op je inzet.';
  return 'Onvoldoende... maar hé, je hebt het overleefd.';
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
  txt(`HOOFDSTUK ${c.ch.num} VOLTOOID`, x + 24, y + 27, { size: 22, weight: 900, color: '#071022' });
  txt(c.ch.title, x + w - 24, y + 27, { size: 14, weight: 800, color: '#071022', align: 'right' });
  const shownG = 1 + (c.grade - 1) * ease.outCubic(clamp((t - 0.5) / 1.2, 0, 1));
  if (t > 0.5 && t < 1.7 && Math.floor(t * 30) % 2) Snd.sfx.tick();
  if (t > 1.7 && !c.landed) { c.landed = true; Snd.sfx.slam(); if (c.grade >= 5.5) { Snd.sfx.levelup(); burst(x + 120, y + 170, ['#2fbf71', '#ffd84a', '#fff'], 40, 300); } else Snd.sfx.deny(); }
  const col = c.landed ? gradeColor(c.grade) : '#4a5876';
  ctx.fillStyle = col; rr(x + 40, y + 90, 160, 130, 16); ctx.fill();
  txt(fmtGrade(shownG), x + 120, y + 150, { size: 56, weight: 900, align: 'center' });
  txt('CIJFER', x + 120, y + 200, { size: 12, weight: 900, align: 'center', color: 'rgba(255,255,255,0.8)' });
  const rows = [['Keer geraakt', c.hits], ['Tijd', fmtTime(c.time)], ['Beste combo', c.combo], ['Herkansingen', c.retakes], ['Score', G.score.toLocaleString('nl-NL')]];
  rows.forEach((r, i) => {
    if (t < 0.6 + i * 0.12) return;
    txt(r[0], x + 240, y + 100 + i * 28, { size: 15, weight: 600, color: '#9fb3d1' });
    txt(String(r[1]), x + w - 40, y + 100 + i * 28, { size: 15, weight: 800, align: 'right' });
  });
  if (c.landed) {
    ctx.fillStyle = 'rgba(77,255,166,0.08)'; rr(x + 40, y + 248, w - 80, 46, 10); ctx.fill();
    txt('MENTOR.EXE:', x + 56, y + 271, { size: 12, weight: 900, color: '#4dffa6', font: MONO });
    const comment = teacherComment(c.grade);
    let cs = 14;
    for (; cs > 10; cs--) { ctx.font = `600 ${cs}px ${FONT}`; if (ctx.measureText(comment).width <= w - 220) break; }
    txt(comment, x + 160, y + 271, { size: cs, weight: 600, color: '#d9fff0' });
    if (Math.floor(G.t * 2) % 2) txt('klik / enter om verder te gaan', x + w / 2, y + h - 22, { size: 13, align: 'center', color: 'rgba(255,255,255,0.5)' });
  }
  ctx.restore();
}

function drawPause() {
  ctx.save();
  ctx.fillStyle = 'rgba(3,6,16,0.8)'; ctx.fillRect(0, 0, W, H);
  glitchText('GEPAUZEERD', W / 2, 150, 54, '#ffffff', Math.random() < 0.05 ? 2 : 0.3);
  txt('Even pauze. Pak een stroopwafel.', W / 2, 195, { size: 15, italic: true, weight: 600, align: 'center', color: '#9fb3d1' });
  drawMenu(pauseItems(), G.pauseSel, 260);
  ctx.restore();
}
function pauseItems() {
  return [{ id: 'resume', label: 'VERDER SPELEN' }, { id: 'sound', label: `GELUID: ${Snd.muted ? 'UIT' : 'AAN'}` }, { id: 'title', label: 'NAAR HET TITELSCHERM' }, { id: 'quit', label: 'TERUG NAAR SOMTODAY' }];
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
  const label = r.mode === 'endless' ? `TOETSWEEK · GOLF ${r.endlessN}` : `H${CHAPTERS[r.chapter].num} · ${CHAPTERS[r.chapter].title}`;
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
  txt(ready ? 'INLEVEREN KLAAR! [E]' : 'INLEVEREN [E]', mx, 14, { size: 9, weight: 900, color: ready ? '#ffd84a' : '#9fb3d1' });
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
  let clock = r.mode === 'endless' ? `RECORD: GOLF ${Save.data.endlessBest}` : CHAPTERS[r.chapter].clock;
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
    const s = '23:58 — de avond voor de rapporten.';
    const n = Math.floor(clamp((t - 0.3) * 24, 0, s.length));
    if (n > (c.lastN || 0)) { c.lastN = n; Snd.sfx.type(1.3); }
    txt(s.slice(0, n) + (Math.floor(t * 3) % 2 ? '_' : ''), W / 2, H / 2, { size: 22, font: MONO, align: 'center', color: '#d6e4ff', weight: 600 });
    if (t > 1.6) txt('"Nog één keer snel naar mijn cijfers kijken..."', W / 2, H / 2 + 40, { size: 16, italic: true, align: 'center', color: '#6f84a8', weight: 600 });
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
    txt('er eet iets aan de database', 0, 20, { size: 13, font: MONO, align: 'center', color: '#ff8a9c' });
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
  if (t > 0.4) txt('klik / enter om over te slaan', W - 16, H - 14, { size: 11, align: 'right', color: 'rgba(255,255,255,0.3)' });
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
  const d = Save.data, items = [{ id: 'new', label: 'NIEUW VERHAAL' }];
  if (d.story && d.story.chapter > 0 && CHAPTERS[d.story.chapter]) items.push({ id: 'cont', label: `VERDERGAAN — H${d.story.chapter + 1}: ${CHAPTERS[d.story.chapter].title}` });
  items.push(d.beaten ? { id: 'endless', label: `TOETSWEEK (EINDELOOS) — RECORD: GOLF ${d.endlessBest}` } : { id: 'endless', label: 'TOETSWEEK — 🔒 speel eerst het verhaal uit', locked: true });
  items.push({ id: 'name', label: `NAAM: ${d.name}${G.editName ? (Math.floor(G.t * 3) % 2 ? '_' : ' ') : ''}` });
  items.push({ id: 'mode', label: `MOEILIJKHEID: ${d.chill ? 'CHILL (7 levens, tragere kogels)' : 'NORMAAL'}` });
  items.push({ id: 'sound', label: `GELUID: ${Snd.muted ? 'UIT' : 'AAN'}  [M]` });
  items.push({ id: 'quit', label: 'TERUG NAAR SOMTODAY' });
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
      if (!Save.data.name.trim()) Save.data.name = 'Leerling';
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
  return G.run.mode === 'endless' ? [{ id: 'retry', label: 'OPNIEUW PROBEREN' }, { id: 'title', label: 'NAAR HET TITELSCHERM' }] : [{ id: 'retry', label: 'HERKANSING (hoofdstuk opnieuw)' }, { id: 'title', label: 'NAAR HET TITELSCHERM' }];
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
  ['ping', 'EEN 5,5! VOLDOENDE!', 'confetti'],
  ['you', '...Ik heb tegen een levende 1,0 gevochten voor een 5,5.'],
  ['ping', 'En je zou het zo weer doen.'],
  ['you', '...Ja. Ja, eigenlijk wel.'],
  ['ping', 'Zelfde tijd bij het volgende rapport? *ding*'],
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
  if (G.editName) txt('typ je naam · enter om op te slaan', W / 2, 222 + 3 * 38 + 22, { size: 11, align: 'center', color: '#ffd84a' });
  txt('WASD lopen · MUIS richten · KLIK VASTHOUDEN schrijven · SPATIE dashen · E inleveren · ESC pauze · M geluid', W / 2, H - 38, { size: 12, weight: 700, align: 'center', color: '#7d93ba' });
  txt('Een fan-made verhaalmod voor Somtoday · niet officieel verbonden aan Somtoday', W / 2, H - 18, { size: 10, align: 'center', color: 'rgba(255,255,255,0.3)' });
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
  txt(G.run.mode === 'endless' ? `Je hebt het volgehouden tot golf ${G.run.endlessN}.` : 'Je bent blijven zitten. De Onvoldoende wordt sterker...', W / 2, 205, { size: 17, italic: true, weight: 600, align: 'center', color: '#ffb3c0' });
  if (g.newBest) txt('NIEUW PERSOONLIJK RECORD!', W / 2, 235, { size: 18, weight: 900, align: 'center', color: '#ffd84a' });
  txt(`Score ${G.score.toLocaleString('nl-NL')} · Verslagen ${G.stats.kills} · Beste combo ${G.bestCombo}`, W / 2, 262, { size: 14, weight: 700, align: 'center', color: '#9fb3d1' });
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
      txt(`Score ${G.score.toLocaleString('nl-NL')} · ${G.stats.kills} verslagen · ${fmtTime(G.stats.time)}`, x + 40, ry + 52, { size: 12, weight: 600, color: '#8392ad' });
      ctx.fillStyle = gradeColor(e.avg); rr(x + w - 124, ry + 12, 88, 40, 8); ctx.fill();
      txt(fmtGrade(e.avg), x + w - 80, ry + 33, { size: 22, weight: 900, align: 'center' });
      if (e.t > avgAt + 0.8 && Math.floor(G.t * 2) % 2) txt('klik / enter', x + w / 2, y + h - 14, { size: 12, align: 'center', color: '#8392ad' });
    }
  } else if (e.phase === 'reveal') {
    txt('...en het cijfer waar het allemaal om begon:', W / 2, 120, { size: 20, italic: true, weight: 600, align: 'center', color: '#d6e4ff' });
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
