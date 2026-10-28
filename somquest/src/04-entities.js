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
