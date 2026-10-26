// Extra scenery that fills the view behind Mario: grassy terraces, a cliff with a
// waterfall and pond, a giant mushroom, a Piranha Plant pipe, a walking Koopa,
// a Power Star, butterflies, grass tufts and floating sparkles.
// Positions are chosen to sit inside the portrait (TikTok) camera view.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, part, canvasTexture, grassTexture, pipeTexture } from './toon.js';

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
  const mesh = new THREE.InstancedMesh(geo, toon(0x3aa82c), count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let n = 0;
  while (n < count) {
    p.set(rand(area.minX, area.maxX), 0, rand(area.minZ, area.maxZ));
    if (avoid(p.x, p.z)) continue;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, Math.PI * 2));
    s.setScalar(rand(0.6, 1.1));
    m.compose(p, q, s);
    mesh.setMatrixAt(n++, m);
  }
  mesh.receiveShadow = true;
  return mesh;
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

// Layout, back to front, kept in clear layers so Mario stays the focus:
//   far:    rolling hills, the castle in the middle with open sky around it
//   back:   cliff + waterfall + pond on the left, giant orange mushroom on the right
//   middle: one terrace each side, Piranha Plant pipe on the left, a Koopa strolling across
//   front:  open grass around Mario, small flower clusters framing the bottom corners
export function addScenery(scene, updaters, h, { PIPE, STAGE }) {
  const add = (obj, x, y, z, ry = 0) => { obj.position.set(x, y, z); obj.rotation.y = ry; scene.add(obj); return obj; };
  const nearPipe = (x, z) => Math.hypot(x - PIPE.x, z - PIPE.z) < 1.6;
  const onStage = (x, z) => x > STAGE.minX - 0.8 && x < STAGE.maxX + 0.8 && z > STAGE.minZ - 1 && z < STAGE.maxZ + 1.5;

  // --- Middle: a terrace on each side ---
  const tL = add(terrace(3.6, 3, 1.3), -4.9, 0, -9.5);
  add(h.bush(0.7), -4.6, tL.userData.top, -9.3);
  const tR = add(terrace(4.2, 3.4, 2.4), 5.0, 0, -9.4);
  add(h.tree(0.95), 5.5, tR.userData.top, -9.8, 1);

  // --- Back left: cliff with a waterfall into a pond ---
  const cliff = add(terrace(5, 4, 6.5), -6.6, 0, -18);
  add(h.tree(1.1), -7.4, cliff.userData.top, -18.6);
  const fall = waterfall(1.4, 6.5);
  add(fall, -5.1, 3.25, -15.96);
  const pd = add(pond(1.8), -5.0, 0, -14.1);
  const foam = [];
  for (let i = 0; i < 4; i++) {
    foam.push(add(part(new THREE.SphereGeometry(rand(0.2, 0.32), 10, 8), toon(0xffffff), { outline: 0, shadow: false }), -5.1 + rand(-0.5, 0.5), 0.15, -15.6 + rand(-0.2, 0.2)));
  }
  updaters.push((dt, t) => {
    fall.userData.tex.offset.y += dt * 1.6;
    pd.userData.tex.offset.x += dt * 0.03;
    foam.forEach((f, i) => { f.scale.setScalar(0.8 + Math.abs(Math.sin(t * 3 + i * 1.7)) * 0.5); });
  });

  // --- Back right: one giant mushroom ---
  add(giantMushroom(0xff9f1c, 4.6, 2.0), 5.2, 0, -16.5);

  // --- Sky: a Power Star floating above the cliff ---
  const star = add(powerStar(), -3.9, 7.4, -16);
  updaters.push((dt, t) => {
    star.rotation.y = t * 1.6;
    star.position.y = 7.4 + Math.sin(t * 1.5) * 0.3;
  });

  // --- Middle left: Piranha Plant in its own pipe ---
  const pp = add(smallPipe(1.5, 0.6), -3.9, 0, -4.6);
  const plant = piranhaPlant();
  pp.add(plant);
  const plantDown = -2.0, plantUp = 1.15;
  plant.position.y = plantDown;
  updaters.push((dt, t) => {
    const cycle = t % 9;
    const k = cycle < 1 ? cycle : cycle < 4 ? 1 : cycle < 5 ? 5 - cycle : 0;
    const e = k * k * (3 - 2 * k);
    plant.position.y = plantDown + (plantUp - plantDown) * e;
    const chomp = e > 0.9 ? Math.abs(Math.sin(t * 7)) : 0.2;
    plant.userData.upper.rotation.x = -chomp * 0.5;
    plant.userData.lower.rotation.x = chomp * 0.35;
    plant.userData.head.rotation.z = Math.sin(t * 2) * 0.15;
  });

  // --- A Koopa strolling back and forth along the far path ---
  const kp = koopa();
  kp.scale.setScalar(0.85);
  scene.add(kp);
  updaters.push((dt, t) => {
    const ph = t * 0.22;
    const x = 0.7 + Math.sin(ph) * 2.6;
    const dir = Math.cos(ph) >= 0 ? 1 : -1;
    kp.position.set(x, 0, -12);
    kp.rotation.y += ((dir > 0 ? Math.PI / 2 : -Math.PI / 2) - kp.rotation.y) * Math.min(1, dt * 5);
    const step = Math.sin(t * 8);
    kp.userData.feet[0].position.y = 0.1 + Math.max(0, step) * 0.12;
    kp.userData.feet[1].position.y = 0.1 + Math.max(0, -step) * 0.12;
    kp.position.y = Math.abs(step) * 0.04;
    kp.userData.head.rotation.z = step * 0.08;
  });

  // --- Stepping-stone path leading back to the castle ---
  const stone = toon(0xe8d6ae);
  for (let i = 0; i < 12; i++) {
    const z = -2.4 - i * 1.6;
    const x = 0.3 + Math.sin(i * 0.45) * 0.9 + i * 0.12;
    add(part(new THREE.CylinderGeometry(0.42, 0.46, 0.08, 14), stone, { outline: 0.015, shadow: false }), x, 0.04, z, rand(0, 6));
  }

  // --- A few trees and rocks at the sides only (the middle stays open) ---
  for (const [x, z, s] of [[7.2, -20, 1.3], [-9, -13, 1.2], [8.6, -13.5, 1.1]]) add(h.tree(s), x, 0, z, rand(0, 6));
  for (const [x, z, s] of [[-6, -6.5, 0.9], [6.2, -6, 0.8]]) add(h.bush(s), x, 0, z);
  const rock = toon(0x9a958d);
  for (const [x, z, s] of [[-3.0, -13.2, 0.5], [3.4, -13.5, 0.55]]) {
    add(part(new THREE.DodecahedronGeometry(s), rock, { outline: 0.02 }), x, s * 0.35, z, rand(0, 6)).scale.y = 0.7;
  }

  // --- Flowers in tidy little clusters ---
  const clusters = [
    [-3.0, 2.9, [0xff4f6d, 0xffffff, 0xff4f6d]],
    [3.4, 2.5, [0xffe14a, 0xff9f1c, 0xffe14a]],
    [-5.2, -2.2, [0xa66bff, 0xffffff, 0xa66bff]],
    [5.4, -4.4, [0xff4f6d, 0xffe14a, 0xffffff]],
    [-1.6, -7.8, [0xffffff, 0xff9f1c, 0xffffff]],
  ];
  for (const [cx, cz, cols] of clusters) {
    cols.forEach((c, i) => {
      const a = (i / cols.length) * Math.PI * 2;
      const f = add(h.flower(c), cx + Math.cos(a) * 0.32, 0, cz + Math.sin(a) * 0.32, rand(0, 6));
      f.scale.setScalar(1 + (i % 2) * 0.15);
      const ph = rand(0, 6);
      updaters.push((dt, t) => { f.rotation.z = Math.sin(t * 2 + ph) * 0.07; });
    });
  }

  // Sparse grass tufts to break up the ground, kept away from the camera.
  scene.add(grassTufts(260, { minX: -9, maxX: 9, minZ: -20, maxZ: 1 }, (x, z) => onStage(x, z) || nearPipe(x, z)));

  // --- Hills: one tidy row behind the castle, plus faint distant ones ---
  const far = [[-14, -45, 0x5fb56a, 14, 6], [12, -46, 0x58ad66, 12, 6], [24, -55, 0x6cc27a, 16, 7], [-26, -54, 0x5fb56a, 15, 7]];
  for (const [x, z, c, hh, r] of far) add(h.hill(c, hh, r), x, 0, z);
  for (const [x, z, c, hh, r] of [[-8.5, -26, 0x3cbf55, 5, 2.4], [10, -27, 0x2ea84a, 6, 2.6]]) add(h.hill(c, hh, r), x, 0, z);

  // --- Three butterflies and a light dusting of sparkles ---
  ['#ff8fd1', '#ffe14a', '#7fd8ff'].forEach((c, i) => {
    const b = butterfly(c);
    scene.add(b);
    const seed = i * 2.3, cx = [-3.2, 3.6, -1][i], cz = [0.5, 0, -4][i];
    updaters.push((dt, t) => {
      const px = (tt) => cx + Math.sin(tt * 0.5 + seed) * 1.4;
      const pz = (tt) => cz + Math.sin(tt * 0.37 + seed * 2) * 1.2;
      const x = px(t), z = pz(t);
      b.position.set(x, 1.4 + Math.sin(t * 1.3 + seed) * 0.5, z);
      b.rotation.y = Math.atan2(px(t + 0.05) - x, pz(t + 0.05) - z);
      const flap = Math.sin(t * 22 + seed) * 1.1;
      for (const w of b.userData.wings) w.pivot.rotation.z = w.sx * flap;
    });
  });
  const sp = sparkles(30);
  sp.material.size = 0.16;
  scene.add(sp);
  updaters.push((dt, t) => {
    const a = sp.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) {
      let y = a.getY(i) + dt * 0.2;
      if (y > 7) y = 0.3;
      a.setY(i, y);
    }
    a.needsUpdate = true;
    sp.material.opacity = 0.4 + Math.sin(t * 2) * 0.2;
  });

  fillGround(scene, h, { PIPE, STAGE });
}

// ---------- filling the open ground, in an orderly way ----------

function plazaTexture() {
  return canvasTexture(512, 512, (g, w) => {
    const c = w / 2;
    g.save();
    g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.clip();
    const n = 10, s = w / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      g.fillStyle = (x + y) % 2 ? '#f4e4bc' : '#e7cf96';
      g.fillRect(x * s, y * s, s, s);
    }
    g.strokeStyle = 'rgba(120,80,30,0.25)'; g.lineWidth = 2;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, w); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
    // Brick border ring
    g.lineWidth = 34; g.strokeStyle = '#c4622d';
    g.beginPath(); g.arc(c, c, c - 17, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = '#3d1c0c'; g.lineWidth = 3;
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      g.beginPath(); g.moveTo(c + Math.cos(a) * (c - 34), c + Math.sin(a) * (c - 34)); g.lineTo(c + Math.cos(a) * c, c + Math.sin(a) * c); g.stroke();
    }
    g.beginPath(); g.arc(c, c, c - 34, 0, Math.PI * 2); g.stroke();
    // Faint star in the middle
    g.translate(c, c); g.fillStyle = 'rgba(255,200,40,0.55)';
    g.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 26 : 62; const a = (i / 10) * Math.PI * 2 - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fill();
    g.restore();
  });
}

function signpost(text) {
  const g = new THREE.Group();
  const wood = toon(0xc98a4b);
  g.add(part(new THREE.BoxGeometry(0.16, 1.4, 0.16), wood, { pos: [0, 0.7, 0], outline: 0.015 }));
  const tex = canvasTexture(256, 128, (c, w, hh) => {
    c.fillStyle = '#d99a58'; c.fillRect(0, 0, w, hh);
    c.strokeStyle = '#8a5526'; c.lineWidth = 3;
    for (let y = 32; y < hh; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.font = '900 52px "Arial Black", Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 8; c.strokeStyle = '#3d1c0c'; c.strokeText(text, w / 2, hh / 2 + 4);
    c.fillStyle = '#ffffff'; c.fillText(text, w / 2, hh / 2 + 4);
  });
  const board = part(new THREE.BoxGeometry(1.3, 0.65, 0.1), [wood, wood, wood, wood, new THREE.MeshToonMaterial({ map: tex }), wood], { pos: [0, 1.3, 0.05], outline: 0.02 });
  g.add(board);
  return g;
}

function hedge(length) {
  const g = new THREE.Group();
  const m = toon(0x2e9e3c);
  const n = Math.max(2, Math.round(length / 0.55));
  for (let i = 0; i < n; i++) {
    g.add(part(new THREE.SphereGeometry(0.42, 14, 10), m, { pos: [(i / (n - 1) - 0.5) * length, 0.32, 0], scale: [1, 0.85, 0.9], outline: 0.03 }));
  }
  return g;
}

// Hundreds of tiny flowers for a few draw calls (instanced).
function meadow(points) {
  const petals = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p = new THREE.SphereGeometry(0.075, 6, 4);
    p.scale(1, 0.45, 1);
    p.translate(Math.cos(a) * 0.08, 0.3, Math.sin(a) * 0.08);
    petals.push(p);
  }
  const petalGeo = mergeGeometries(petals);
  const centerGeo = new THREE.SphereGeometry(0.055, 6, 4).translate(0, 0.32, 0);
  const stemGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.3, 4).translate(0, 0.15, 0);
  const count = points.length;
  const petalsMesh = new THREE.InstancedMesh(petalGeo, toon(0xffffff), count);
  const centers = new THREE.InstancedMesh(centerGeo, toon(0xffd21f), count);
  const stems = new THREE.InstancedMesh(stemGeo, toon(0x2b8f2b), count);
  const colors = [0xff4f6d, 0xffffff, 0xffe14a, 0xa66bff, 0xff9f1c, 0x7fd8ff].map((c) => new THREE.Color(c));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
  points.forEach(([x, z, colorIdx], i) => {
    pos.set(x, 0, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, Math.PI * 2));
    sc.setScalar(rand(0.8, 1.3));
    m.compose(pos, q, sc);
    petalsMesh.setMatrixAt(i, m); centers.setMatrixAt(i, m); stems.setMatrixAt(i, m);
    petalsMesh.setColorAt(i, colors[colorIdx % colors.length]);
  });
  const g = new THREE.Group();
  g.add(petalsMesh, centers, stems);
  return g;
}

// Rows of round trees along the sides (instanced, with ink outlines).
function treeRows(spots) {
  const n = spots.length;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 8).translate(0, 0.8, 0), toon(0x8a5a2b), n);
  const leafGeo = new THREE.SphereGeometry(1.1, 16, 12).scale(1, 1.15, 1).translate(0, 2.2, 0);
  const leaves = new THREE.InstancedMesh(leafGeo, toon(0xffffff), n);
  const ink = new THREE.InstancedMesh(new THREE.SphereGeometry(1.16, 16, 12).scale(1, 1.15, 1).translate(0, 2.2, 0),
    new THREE.MeshBasicMaterial({ color: 0x1b1020, side: THREE.BackSide }), n);
  const greens = [0x2fa33a, 0x3dbb46, 0x289634, 0x47c24f].map((c) => new THREE.Color(c));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
  spots.forEach(([x, z, s], i) => {
    pos.set(x, 0, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, 6));
    sc.setScalar(s);
    m.compose(pos, q, sc);
    trunk.setMatrixAt(i, m); leaves.setMatrixAt(i, m); ink.setMatrixAt(i, m);
    leaves.setColorAt(i, greens[i % greens.length]);
  });
  trunk.castShadow = leaves.castShadow = true;
  const g = new THREE.Group();
  g.add(trunk, leaves, ink);
  return g;
}

function fillGround(scene, h, { PIPE }) {
  const add = (obj, x, y, z, ry = 0) => { obj.position.set(x, y, z); obj.rotation.y = ry; scene.add(obj); return obj; };

  // A tiled stage circle under Mario's spot.
  const PLAZA = { x: -0.8, z: 0.55, r: 2.5 };
  const plazaMat = new THREE.MeshToonMaterial({ map: plazaTexture() });
  const plaza = part(new THREE.CylinderGeometry(PLAZA.r, PLAZA.r + 0.05, 0.06, 48), [toon(0xc4622d), plazaMat, toon(0xc4622d)], { outline: 0.03, shadow: false });
  add(plaza, PLAZA.x, 0.0, PLAZA.z);

  // Front border: hedges framing the bottom of the shot, with a signpost.
  add(hedge(3.2), -2.6, 0, 5.4);
  add(hedge(3.2), 2.6, 0, 5.4);
  add(signpost('ASK ME!'), 2.0, 0, 3.5, -0.25);

  // Things to keep flowers off of.
  const blocked = [
    [PLAZA.x, PLAZA.z, PLAZA.r + 0.3], [PIPE.x, PIPE.z, 1.4], [-3.9, -4.6, 1.0], [-5.0, -14.1, 2.3],
    [5.2, -16.5, 1.0], [2.0, 3.5, 0.6], [-3.0, 2.9, 0.7], [3.4, 2.5, 0.7],
  ];
  const rects = [[-4.9, -9.5, 2.0, 1.7], [5.0, -9.4, 2.3, 1.9], [-6.6, -18, 2.7, 2.2]];
  const free = (x, z) => {
    for (const [bx, bz, r] of blocked) if (Math.hypot(x - bx, z - bz) < r) return false;
    for (const [rx, rz, hw, hd] of rects) if (Math.abs(x - rx) < hw && Math.abs(z - rz) < hd) return false;
    if (z < -1.8 && z > -21 && Math.abs(x - (0.3 + Math.sin(((-2.4 - z) / 1.6) * 0.45) * 0.9 + ((-2.4 - z) / 1.6) * 0.12)) < 0.75) return false; // path
    return true;
  };

  // Flower meadows in round patches that cover the open grass.
  const patches = [
    [-2.6, 4.0, 1.3, 45], [0.2, 4.3, 1.4, 50], [3.4, 4.6, 1.0, 25], [-4.6, 3.2, 1.2, 30], [4.9, 2.4, 1.2, 30],
    [-3.4, -1.4, 1.0, 25], [3.9, -1.6, 1.0, 25], [-1.8, -5.6, 1.0, 22], [2.8, -6.4, 1.1, 25], [-2.2, -10.6, 1.2, 25],
    [2.2, -14.6, 1.4, 30], [-1.6, -18, 1.4, 30], [-7.6, 1.2, 1.8, 45], [7.6, 0.8, 1.8, 45], [-8.2, -4.2, 1.6, 35],
    [8.6, -4.6, 1.6, 35], [-10.2, 3.6, 2.0, 45], [10.2, 3.6, 2.0, 45], [-11, -9, 2.0, 40], [11.5, -8, 2.0, 40],
  ];
  const pts = [];
  patches.forEach(([cx, cz, r, n], pi) => {
    const main = pi % 6, accent = (pi + 3) % 6;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), d = Math.sqrt(Math.random()) * r;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (free(x, z)) pts.push([x, z, Math.random() < 0.75 ? main : accent]);
    }
  });
  scene.add(meadow(pts));

  // Tree lines down both sides (seen in the wide/landscape view) and bushes in front of them.
  const spots = [];
  for (const side of [-1, 1]) {
    for (let row = 0; row < 3; row++) {
      for (let z = 3 - row * 1.3; z > -34; z -= 2.6) {
        const x = side * (9.5 + row * 3 + rand(-0.4, 0.4));
        if (Math.hypot(x - side * 11, z + 11) < 2) continue;
        spots.push([x, z + rand(-0.5, 0.5), rand(0.9, 1.35)]);
      }
    }
  }
  scene.add(treeRows(spots));
  for (const side of [-1, 1]) {
    for (let z = 4; z > -8; z -= 3) add(h.bush(rand(0.7, 0.9)), side * 7.6, 0, z + rand(-0.4, 0.4));
  }

  // Far hills all along the horizon.
  for (let x = -70; x <= 70; x += 14) {
    if (Math.abs(x) < 10) continue;
    add(h.hill([0x5fb56a, 0x6cc27a, 0x58ad66][Math.abs(x / 14) % 3 | 0], rand(10, 18), rand(5, 7)), x + rand(-3, 3), 0, rand(-62, -72));
  }
}
