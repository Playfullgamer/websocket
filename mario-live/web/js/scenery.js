// Extra scenery that fills the view behind Mario: grassy terraces, a cliff with a
// waterfall and pond, giant mushrooms, a floating island, a Piranha Plant pipe,
// a walking Koopa, a Power Star, butterflies, grass tufts and floating sparkles.
// Positions are chosen to sit inside the portrait (TikTok) camera view.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, part, canvasTexture, grassTexture, questionBlockTexture, brickTexture, pipeTexture } from './toon.js';

const rand = (a, b) => a + Math.random() * (b - a);

function sideTexture() {
  const tex = canvasTexture(128, 128, (g, w, h) => {
    const bands = ['#c9783a', '#b5652c', '#d88a48', '#a85a26'];
    const bh = h / 8;
    for (let i = 0; i < 8; i++) { g.fillStyle = bands[i % bands.length]; g.fillRect(0, i * bh, w, bh); }
    for (let i = 0; i < 18; i++) {
      g.fillStyle = 'rgba(80,35,10,0.35)';
      g.beginPath(); g.ellipse(rand(0, w), rand(16, h), rand(3, 7), rand(2, 4), 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#4fbf31'; g.fillRect(0, 0, w, 12);
    g.fillStyle = '#3c9a24';
    for (let x = 0; x < w; x += 16) { g.beginPath(); g.arc(x + 8, 12, 8, 0, Math.PI); g.fill(); }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
const SIDE = sideTexture();
const GRASS = grassTexture();

// A raised grassy block with striped dirt sides (Mario 3D World style).
function terrace(w, d, h) {
  const side = SIDE.clone(); side.needsUpdate = true; side.repeat.set(w / 2, h / 2);
  const sideZ = SIDE.clone(); sideZ.needsUpdate = true; sideZ.repeat.set(d / 2, h / 2);
  const top = GRASS.clone(); top.needsUpdate = true; top.repeat.set(w / 2, d / 2);
  const mSide = new THREE.MeshToonMaterial({ map: side });
  const mSideZ = new THREE.MeshToonMaterial({ map: sideZ });
  const mTop = new THREE.MeshToonMaterial({ map: top });
  const m = part(new THREE.BoxGeometry(w, h, d), [mSideZ, mSideZ, mTop, mSide, mSide, mSide], { pos: [0, h / 2, 0], outline: 0.06 });
  const g = new THREE.Group();
  g.add(m);
  g.userData.top = h;
  return g;
}

function waterTexture(vertical) {
  const tex = canvasTexture(64, 128, (g, w, h) => {
    g.fillStyle = vertical ? '#5fc8ff' : '#3fa9f0'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < (vertical ? 22 : 30); i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.55)' : 'rgba(30,110,200,0.35)';
      if (vertical) g.fillRect(rand(0, w), rand(0, h), rand(2, 5), rand(20, 60));
      else { g.beginPath(); g.ellipse(rand(0, w), rand(0, h), rand(4, 10), rand(1, 2), 0, 0, Math.PI * 2); g.fill(); }
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function waterfall(width, height) {
  const tex = waterTexture(true); tex.repeat.set(width / 1.5, height / 3);
  const mat = new THREE.MeshToonMaterial({ map: tex, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  m.userData.tex = tex;
  return m;
}

function pond(r) {
  const g = new THREE.Group();
  const tex = waterTexture(false); tex.repeat.set(3, 3);
  const water = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshToonMaterial({ map: tex }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.03; water.receiveShadow = true;
  g.add(water);
  const rim = part(new THREE.TorusGeometry(r, 0.18, 8, 40), toon(0x9aa0a8), { rot: [Math.PI / 2, 0, 0], pos: [0, 0.05, 0], outline: 0.02, shadow: false });
  g.add(rim);
  for (let i = 0; i < 4; i++) {
    const a = rand(0, Math.PI * 2), rr = rand(0.3, r * 0.75);
    const pad = part(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 16, 1, false, 0.4, Math.PI * 1.8), toon(0x2f9e3a), { pos: [Math.cos(a) * rr, 0.06, Math.sin(a) * rr], outline: 0, shadow: false });
    g.add(pad);
  }
  g.userData.tex = tex;
  return g;
}

function giantMushroom(capColor, h, r) {
  const g = new THREE.Group();
  g.add(part(new THREE.CylinderGeometry(r * 0.3, r * 0.38, h, 18), toon(0xfff1d6), { pos: [0, h / 2, 0], outline: 0.05 }));
  const cap = part(new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), toon(capColor), { pos: [0, h - 0.1, 0], scale: [1, 0.62, 1], outline: 0.06 });
  g.add(cap);
  g.add(part(new THREE.CircleGeometry(r, 32), toon(0xf3dcb8, { side: THREE.DoubleSide }), { pos: [0, h - 0.1, 0], rot: [Math.PI / 2, 0, 0], outline: 0, shadow: false }));
  const white = toon(0xffffff);
  for (let i = 0; i < 7; i++) {
    const theta = i === 0 ? 0 : rand(0.45, 1.15);
    const phi = (i / 6) * Math.PI * 2 + rand(-0.3, 0.3);
    const n = new THREE.Vector3(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi));
    const spot = part(new THREE.SphereGeometry(r * 0.24, 14, 10), white, { outline: 0, shadow: false });
    spot.position.copy(n).multiplyScalar(r * 0.98);
    spot.lookAt(n.clone().multiplyScalar(2 * r));
    spot.scale.set(1, 1, 0.25);
    cap.add(spot);
  }
  return g;
}

function floatingIsland() {
  const g = new THREE.Group();
  const top = GRASS.clone(); top.needsUpdate = true; top.repeat.set(2, 2);
  g.add(part(new THREE.CylinderGeometry(2.6, 2.4, 0.6, 28), [new THREE.MeshToonMaterial({ map: sideTexture() }), new THREE.MeshToonMaterial({ map: top }), toon(0xb5652c)], { outline: 0.05 }));
  g.add(part(new THREE.ConeGeometry(2.4, 3.2, 28), toon(0xa85a26), { pos: [0, -1.9, 0], rot: [Math.PI, 0, 0], outline: 0.05 }));
  for (const [x, y, z, r] of [[-1.2, -1.2, 1.1, 0.5], [1.0, -1.6, 0.9, 0.4], [0.2, -2.6, 1.0, 0.35]]) {
    g.add(part(new THREE.DodecahedronGeometry(r), toon(0x8f8a84), { pos: [x, y, z], outline: 0.02, shadow: false }));
  }
  const fall = waterfall(1.1, 9);
  fall.position.set(0.9, -4.4, 2.2);
  g.add(fall);
  g.userData.fall = fall;
  return g;
}

function smallPipe(height, radius) {
  const g = new THREE.Group();
  const mat = new THREE.MeshToonMaterial({ map: pipeTexture() });
  g.add(part(new THREE.CylinderGeometry(radius, radius, height - 0.35, 28, 1, true), mat, { pos: [0, (height - 0.35) / 2, 0], outline: 0.04 }));
  g.add(part(new THREE.CylinderGeometry(radius + 0.12, radius + 0.12, 0.38, 28, 1, true), mat, { pos: [0, height - 0.19, 0], outline: 0.04 }));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(radius + 0.01, radius + 0.01, height + 0.1, 28, 1, true), toon(0x05250b, { side: THREE.BackSide })).translateY(height / 2));
  const dark = new THREE.Mesh(new THREE.CircleGeometry(radius + 0.01, 28), toon(0x020c04));
  dark.rotation.x = -Math.PI / 2; dark.position.y = height - 0.3;
  g.add(dark);
  return g;
}

function piranhaPlant() {
  const g = new THREE.Group();
  g.add(part(new THREE.CylinderGeometry(0.1, 0.12, 1.4, 10), toon(0x2fa33a), { pos: [0, 0.7, 0], outline: 0.02 }));
  const leafMat = toon(0x38b845);
  for (const sx of [1, -1]) {
    g.add(part(new THREE.SphereGeometry(0.3, 12, 8), leafMat, { pos: [sx * 0.32, 0.55, 0], scale: [1.3, 0.25, 0.7], rot: [0, 0, sx * 0.4], outline: 0.02 }));
  }
  const head = new THREE.Group(); head.position.y = 1.55; g.add(head);
  const red = toon(0xe0262b), white = toon(0xffffff), lips = toon(0xfff1d6);
  const upper = new THREE.Group(), lower = new THREE.Group();
  head.add(upper, lower);
  upper.add(part(new THREE.SphereGeometry(0.5, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2), red, { outline: 0.03 }));
  lower.add(part(new THREE.SphereGeometry(0.5, 22, 14, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), red, { outline: 0.03 }));
  upper.add(part(new THREE.TorusGeometry(0.47, 0.06, 6, 24), lips, { rot: [Math.PI / 2, 0, 0], outline: 0, shadow: false }));
  lower.add(part(new THREE.TorusGeometry(0.47, 0.06, 6, 24), lips, { rot: [Math.PI / 2, 0, 0], outline: 0, shadow: false }));
  upper.add(part(new THREE.CircleGeometry(0.46, 22), toon(0x7a0f1c, { side: THREE.DoubleSide }), { rot: [Math.PI / 2, 0, 0], pos: [0, -0.01, 0], outline: 0, shadow: false }));
  for (let i = 0; i < 9; i++) {
    const theta = rand(0.3, 1.2), phi = rand(0, Math.PI * 2);
    const n = new THREE.Vector3(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi));
    const dot = part(new THREE.SphereGeometry(0.08, 8, 6), white, { outline: 0, shadow: false });
    dot.position.copy(n).multiplyScalar(0.49); dot.scale.set(1, 1, 0.4); dot.lookAt(n.clone().multiplyScalar(2));
    upper.add(dot);
  }
  for (const sx of [1, -1]) {
    const tooth = part(new THREE.ConeGeometry(0.06, 0.14, 6), white, { pos: [sx * 0.2, -0.06, 0.38], rot: [Math.PI, 0, 0], outline: 0, shadow: false });
    upper.add(tooth);
  }
  head.rotation.x = Math.PI / 2 - 0.5; // mouth faces forward
  g.userData = { head, upper, lower };
  return g;
}

function koopa() {
  const g = new THREE.Group();
  const yellow = toon(0xffd23f), green = toon(0x2fb345), white = toon(0xfff6e0), black = toon(0x111111);
  const shellTex = canvasTexture(128, 64, (c, w, h) => {
    c.fillStyle = '#2fb345'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#1b6e2a'; c.lineWidth = 3;
    for (let y = 0; y < h; y += 22) for (let x = (y / 22) % 2 ? 12 : 0; x < w; x += 24) {
      c.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; c.lineTo(x + Math.cos(a) * 10, y + Math.sin(a) * 10); }
      c.closePath(); c.stroke();
    }
  });
  const shell = part(new THREE.SphereGeometry(0.55, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshToonMaterial({ map: shellTex }), { pos: [0, 0.55, -0.05], scale: [1, 1.15, 1.1], outline: 0.03 });
  g.add(shell);
  g.add(part(new THREE.TorusGeometry(0.55, 0.08, 8, 24), white, { pos: [0, 0.55, -0.05], rot: [Math.PI / 2, 0, 0], scale: [1, 1.1, 1], outline: 0.02 }));
  g.add(part(new THREE.SphereGeometry(0.45, 18, 12), toon(0xfff1c2), { pos: [0, 0.5, 0.02], scale: [1, 0.9, 0.95], outline: 0.02 }));
  const head = new THREE.Group(); head.position.set(0, 1.15, 0.45); g.add(head);
  head.add(part(new THREE.SphereGeometry(0.3, 18, 14), yellow, { scale: [1, 1.1, 1.15], outline: 0.025 }));
  head.add(part(new THREE.SphereGeometry(0.16, 12, 10), yellow, { pos: [0, -0.08, 0.28], outline: 0.015 }));
  for (const sx of [1, -1]) {
    head.add(part(new THREE.SphereGeometry(0.09, 10, 8), white, { pos: [sx * 0.11, 0.1, 0.25], scale: [0.8, 1.4, 0.5], outline: 0.01 }));
    head.add(part(new THREE.SphereGeometry(0.045, 8, 6), black, { pos: [sx * 0.1, 0.1, 0.3], scale: [0.8, 1.4, 0.5], outline: 0, shadow: false }));
  }
  g.add(part(new THREE.CylinderGeometry(0.11, 0.13, 0.5, 10), yellow, { pos: [0, 0.95, 0.35], rot: [0.5, 0, 0], outline: 0.02 }));
  const feet = [];
  for (const sx of [1, -1]) {
    const f = part(new THREE.SphereGeometry(0.16, 12, 8), yellow, { pos: [sx * 0.25, 0.1, 0.1], scale: [1, 0.7, 1.5], outline: 0.015 });
    g.add(f); feet.push(f);
    g.add(part(new THREE.SphereGeometry(0.1, 10, 8), yellow, { pos: [sx * 0.5, 0.65, 0.15], outline: 0.012 }));
  }
  g.userData = { feet, head };
  return g;
}

function powerStar() {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.42 : 1, a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.12, bevelSegments: 3 });
  geo.center();
  const g = new THREE.Group();
  g.add(part(geo, toon(0xffd21f, { emissive: 0x8a6a00, emissiveIntensity: 0.6 }), { outline: 0.05, shadow: false }));
  for (const sx of [1, -1]) {
    g.add(part(new THREE.CapsuleGeometry(0.06, 0.16, 4, 8), toon(0x111111), { pos: [sx * 0.17, 0.08, 0.36], outline: 0, shadow: false }));
  }
  const glowTex = canvasTexture(128, 128, (c, w) => {
    const grd = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,240,150,0.9)'); grd.addColorStop(1, 'rgba(255,240,150,0)');
    c.fillStyle = grd; c.fillRect(0, 0, w, w);
  });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(4);
  g.add(glow);
  return g;
}

function butterfly(color) {
  const g = new THREE.Group();
  const tex = canvasTexture(64, 64, (c, w) => {
    c.fillStyle = color; c.strokeStyle = '#1b1020'; c.lineWidth = 4;
    c.beginPath(); c.ellipse(w * 0.5, w * 0.35, w * 0.42, w * 0.3, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(w * 0.45, w * 0.75, w * 0.3, w * 0.2, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(w * 0.55, w * 0.33, 6, 0, Math.PI * 2); c.fill();
  });
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, alphaTest: 0.3 });
  const wings = [];
  for (const sx of [1, -1]) {
    const pivot = new THREE.Group();
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), mat);
    wing.position.x = sx * 0.15; wing.rotation.x = -Math.PI / 2;
    if (sx < 0) wing.scale.x = -1;
    pivot.add(wing); g.add(pivot); wings.push({ pivot, sx });
  }
  g.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.18, 4, 6), toon(0x1b1020)).rotateX(Math.PI / 2));
  g.userData.wings = wings;
  return g;
}

function grassTufts(count, area, avoid) {
  const blades = [];
  for (let i = 0; i < 3; i++) {
    const c = new THREE.ConeGeometry(0.05, rand(0.28, 0.42), 4);
    c.translate(0, 0.17, 0);
    c.rotateZ((i - 1) * 0.35);
    c.translate((i - 1) * 0.06, 0, 0);
    blades.push(c);
  }
  const geo = mergeGeometries(blades);
  const mesh = new THREE.InstancedMesh(geo, toon(0x2f9e2a), count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let n = 0;
  while (n < count) {
    p.set(rand(area.minX, area.maxX), 0, rand(area.minZ, area.maxZ));
    if (avoid(p.x, p.z)) continue;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, Math.PI * 2));
    s.setScalar(rand(0.7, 1.5));
    m.compose(p, q, s);
    mesh.setMatrixAt(n++, m);
  }
  mesh.receiveShadow = true;
  return mesh;
}

function fence(length) {
  const g = new THREE.Group();
  const wood = toon(0xc98a4b);
  const posts = Math.max(2, Math.round(length / 0.9) + 1);
  for (let i = 0; i < posts; i++) {
    const x = (i / (posts - 1)) * length;
    g.add(part(new THREE.BoxGeometry(0.14, 0.75, 0.14), wood, { pos: [x, 0.375, 0], outline: 0.015 }));
    g.add(part(new THREE.ConeGeometry(0.1, 0.14, 4), wood, { pos: [x, 0.82, 0], rot: [0, Math.PI / 4, 0], outline: 0, shadow: false }));
  }
  for (const y of [0.3, 0.58]) g.add(part(new THREE.BoxGeometry(length, 0.09, 0.07), wood, { pos: [length / 2, y, 0.08], outline: 0.012 }));
  return g;
}

function sparkles(count) {
  const tex = canvasTexture(32, 32, (c, w) => {
    const grd = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,220,1)'); grd.addColorStop(1, 'rgba(255,255,220,0)');
    c.fillStyle = grd; c.fillRect(0, 0, w, w);
  });
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { pos[i * 3] = rand(-8, 8); pos[i * 3 + 1] = rand(0.3, 7); pos[i * 3 + 2] = rand(-12, 4); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: tex, size: 0.22, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
  return pts;
}

export function addScenery(scene, updaters, h, { PIPE, STAGE }) {
  const add = (obj, x, y, z, ry = 0) => { obj.position.set(x, y, z); obj.rotation.y = ry; scene.add(obj); return obj; };
  const nearPipe = (x, z) => Math.hypot(x - PIPE.x, z - PIPE.z) < 1.4;
  const onStage = (x, z) => x > STAGE.minX - 0.6 && x < STAGE.maxX + 0.6 && z > STAGE.minZ - 0.6 && z < STAGE.maxZ + 0.8;

  // --- Terraces right behind the play area ---
  const tL = add(terrace(4, 3, 1.3), -4.6, 0, -9.5);
  add(h.tree(0.8), -5.2, tL.userData.top, -9.8);
  add(h.bush(0.7), -3.6, tL.userData.top, -9.0);
  const tR = add(terrace(4.2, 3.4, 2.4), 4.8, 0, -9.2);
  add(h.tree(0.95), 5.4, tR.userData.top, -9.6, 1);
  const tR2 = add(terrace(2.6, 2.4, 1.2), 3.1, 0, -7.6);
  add(h.flower(0xffffff), 3.0, tR2.userData.top, -7.4);
  add(h.flower(0xff4f6d), 3.5, tR2.userData.top, -7.9);

  // Coins arcing over the terraces
  const coinMat = toon(0xffcc1a, { emissive: 0x6a4a00, emissiveIntensity: 0.4 });
  const coinGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.07, 20);
  const coins = [];
  for (let i = 0; i < 5; i++) {
    coins.push(add(part(coinGeo, coinMat, { outline: 0.02, shadow: false }), 3.6 + i * 0.55, tR.userData.top + 0.9 + Math.sin((i / 4) * Math.PI) * 0.8, -8.4));
  }
  for (let i = 0; i < 4; i++) coins.push(add(part(coinGeo, coinMat, { outline: 0.02, shadow: false }), -5.4 + i * 0.6, 2.4, -9));
  coins.forEach((c) => { c.rotation.x = Math.PI / 2; });
  updaters.push((dt, t) => coins.forEach((c, i) => { c.rotation.z = t * 2.5 + i * 0.4; }));

  // --- Tall cliff with a waterfall into a pond ---
  const cliff = add(terrace(5, 4, 6.5), -6.3, 0, -18);
  add(h.tree(1.1), -7.4, cliff.userData.top, -18.6);
  add(h.tree(0.8), -5.0, cliff.userData.top, -19.0, 2);
  const fall = waterfall(1.4, 6.5);
  add(fall, -4.8, 3.25, -15.96);
  const pd = add(pond(2.1), -4.6, 0, -13.6);
  const foam = [];
  for (let i = 0; i < 5; i++) {
    foam.push(add(part(new THREE.SphereGeometry(rand(0.2, 0.35), 10, 8), toon(0xffffff), { outline: 0, shadow: false }), -4.8 + rand(-0.6, 0.6), 0.15, -15.6 + rand(-0.3, 0.3)));
  }
  updaters.push((dt, t) => {
    fall.userData.tex.offset.y += dt * 1.6;
    pd.userData.tex.offset.x += dt * 0.03;
    foam.forEach((f, i) => { const s = 0.8 + Math.abs(Math.sin(t * 3 + i * 1.7)) * 0.5; f.scale.setScalar(s); });
  });

  // --- Giant mushrooms ---
  add(giantMushroom(0xe3221c, 3.3, 1.7), -1.7, 0, -12.8);
  add(giantMushroom(0xff9f1c, 5.2, 2.1), 4.4, 0, -15.5);
  add(giantMushroom(0x2fb345, 1.8, 1.0), 0.9, 0, -9.8);
  add(giantMushroom(0x3f7bff, 2.4, 1.2), -2.9, 0, -6.6);

  // --- Floating stuff in the sky ---
  const island = add(floatingIsland(), -3.2, 10.2, -27);
  add(h.tree(0.9), -3.6, 10.5, -27.4);
  const islandBaseY = island.position.y;
  updaters.push((dt, t) => {
    island.position.y = islandBaseY + Math.sin(t * 0.6) * 0.25;
    island.userData.fall.material.map.offset.y += dt * 1.4;
  });
  const floatBlocks = [[-0.6, 'brick'], [0.4, 'q'], [1.4, 'brick']];
  for (const [x, kind] of floatBlocks) {
    const mat = new THREE.MeshToonMaterial({ map: kind === 'q' ? questionBlockTexture(false) : brickTexture() });
    add(part(new THREE.BoxGeometry(1, 1, 1), mat, { outline: 0.03 }), x - 0.2, 6.6, -12);
  }
  const star = add(powerStar(), 3.4, 8.2, -16);
  updaters.push((dt, t) => {
    star.rotation.y = t * 1.6;
    star.position.y = 8.2 + Math.sin(t * 1.5) * 0.3;
  });

  // --- Piranha Plant in its own pipe ---
  const pp = add(smallPipe(1.5, 0.6), -3.9, 0, -4.4);
  const plant = piranhaPlant();
  pp.add(plant);
  const plantDown = -2.0, plantUp = 1.15;
  plant.position.y = plantDown;
  updaters.push((dt, t) => {
    const cycle = t % 7;
    const k = cycle < 1 ? cycle : cycle < 4 ? 1 : cycle < 5 ? 5 - cycle : 0;
    const e = k * k * (3 - 2 * k);
    plant.position.y = plantDown + (plantUp - plantDown) * e;
    const chomp = e > 0.9 ? Math.abs(Math.sin(t * 7)) : 0.2;
    plant.userData.upper.rotation.x = -chomp * 0.5;
    plant.userData.lower.rotation.x = chomp * 0.35;
    plant.userData.head.rotation.z = Math.sin(t * 2) * 0.15;
  });

  // --- A Koopa strolling behind the stage ---
  const kp = koopa();
  kp.scale.setScalar(0.9);
  scene.add(kp);
  updaters.push((dt, t) => {
    const a = t * 0.28;
    kp.position.set(0.6 + Math.cos(a) * 3.1, 0, -6.9 + Math.sin(a) * 1.0);
    kp.rotation.y = Math.atan2(-Math.sin(a) * 3.1, Math.cos(a) * 1.0);
    const step = Math.sin(t * 8);
    kp.userData.feet[0].position.y = 0.1 + Math.max(0, step) * 0.12;
    kp.userData.feet[1].position.y = 0.1 + Math.max(0, -step) * 0.12;
    kp.position.y = Math.abs(step) * 0.04;
    kp.userData.head.rotation.z = step * 0.08;
  });

  // --- Fences, rocks, a stepping-stone path ---
  add(fence(3.2), -6.6, 0, -2.6, 0.08);
  add(fence(2.8), 3.6, 0, -3.4, -0.1);
  const rock = toon(0x9a958d);
  for (const [x, z, s] of [[-3.3, 3.0, 0.35], [3.2, 2.6, 0.45], [-2.4, -3.2, 0.3], [1.8, -5.2, 0.4], [-5.5, -12, 0.6], [6.5, -13, 0.7]]) {
    const r = add(part(new THREE.DodecahedronGeometry(s), rock, { outline: 0.02 }), x, s * 0.5, z, rand(0, 6));
    r.scale.y = 0.7;
  }
  const stone = toon(0xe8d6ae);
  for (let i = 0; i < 16; i++) {
    const z = -1.6 - i * 1.15;
    const x = 0.2 + Math.sin(i * 0.5) * 1.2 + i * 0.12;
    if (nearPipe(x, z)) continue;
    add(part(new THREE.CylinderGeometry(0.42, 0.46, 0.08, 14), stone, { outline: 0.015, shadow: false }), x, 0.04, z, rand(0, 6));
  }

  // --- More trees, bushes and flowers inside the camera view ---
  for (const [x, z, s] of [[-2.2, -16, 1.0], [1.6, -18, 0.9], [6.8, -20, 1.3], [-0.4, -22, 1.1], [7.2, -11.5, 1.0]]) add(h.tree(s), x, 0, z, rand(0, 6));
  for (const [x, z, s] of [[2.2, -6.2, 0.7], [-0.8, -9.2, 0.6], [6, -6, 0.8], [-6, -6.5, 0.9], [2.8, -12.5, 0.8]]) add(h.bush(s), x, 0, z);
  const colors = [0xff4f6d, 0xffffff, 0xff9f1c, 0xa66bff, 0xffe14a];
  for (let i = 0; i < 40; i++) {
    const x = rand(-6, 6), z = rand(-11, 4.5);
    if (nearPipe(x, z) || onStage(x, z)) continue;
    const f = add(h.flower(colors[i % colors.length]), x, 0, z, rand(0, 6));
    f.scale.setScalar(rand(0.8, 1.25));
    const ph = rand(0, 6);
    updaters.push((dt, t) => { f.rotation.z = Math.sin(t * 2 + ph) * 0.08; });
  }
  scene.add(grassTufts(900, { minX: -10, maxX: 10, minZ: -22, maxZ: 5.5 }, (x, z) => onStage(x, z) || nearPipe(x, z)));

  // --- Distant hills ring so the horizon is never bare ---
  const far = [[-14, -45, 0x5fb56a, 14, 6], [-2, -52, 0x6cc27a, 18, 7], [12, -46, 0x58ad66, 12, 6], [24, -55, 0x6cc27a, 16, 7], [-26, -54, 0x5fb56a, 15, 7]];
  for (const [x, z, c, hh, r] of far) add(h.hill(c, hh, r), x, 0, z);
  const mid = [[-7.5, -24, 0x3cbf55, 5, 2.4], [8.5, -23, 0x2ea84a, 6, 2.6], [0.5, -30, 0x46c95b, 7, 3]];
  for (const [x, z, c, hh, r] of mid) add(h.hill(c, hh, r), x, 0, z);

  // --- Butterflies and floating sparkles for constant gentle motion ---
  const flyers = ['#ff8fd1', '#ffe14a', '#7fd8ff', '#ffffff', '#ffb347', '#b28dff'].map((c) => butterfly(c));
  flyers.forEach((b, i) => {
    scene.add(b);
    const seed = i * 1.7, cx = rand(-4, 3), cz = rand(-5, 2.5);
    updaters.push((dt, t) => {
      const x = cx + Math.sin(t * 0.5 + seed) * 2.2;
      const z = cz + Math.sin(t * 0.37 + seed * 2) * 1.6;
      const y = 1.3 + Math.sin(t * 1.3 + seed) * 0.6;
      const nx = cx + Math.sin((t + 0.05) * 0.5 + seed) * 2.2, nz = cz + Math.sin((t + 0.05) * 0.37 + seed * 2) * 1.6;
      b.position.set(x, y, z);
      b.rotation.y = Math.atan2(nx - x, nz - z);
      const flap = Math.sin(t * 22 + seed) * 1.1;
      for (const w of b.userData.wings) w.pivot.rotation.z = w.sx * flap;
    });
  });
  const sp = sparkles(80);
  scene.add(sp);
  updaters.push((dt, t) => {
    const a = sp.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) {
      let y = a.getY(i) + dt * 0.25;
      if (y > 7) y = 0.3;
      a.setY(i, y);
      a.setX(i, a.getX(i) + Math.sin(t + i) * dt * 0.1);
    }
    a.needsUpdate = true;
    sp.material.opacity = 0.55 + Math.sin(t * 2) * 0.25;
  });
}
