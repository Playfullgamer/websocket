// The 3D Mushroom-Kingdom-style stage: sky, hills, castle, trees, blocks, coins,
// a wandering Goomba, drifting clouds and the green warp pipe Luigi lives in.
import * as THREE from 'three';
import {
  toon, part, canvasTexture, questionBlockTexture, brickTexture, grassTexture, dirtTexture, pipeTexture,
} from './toon.js';
import { addScenery } from './scenery.js';

export const PIPE = { x: 2.1, z: -0.1, radius: 0.92, height: 2.05 };
export const STAGE = { minX: -2.3, maxX: 0.7, minZ: -0.6, maxZ: 1.6, talkSpot: new THREE.Vector3(-0.5, 0, 1.1) };

const rand = (a, b) => a + Math.random() * (b - a);

function skyDome() {
  const geo = new THREE.SphereGeometry(200, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x2f8ff0) }, bottom: { value: new THREE.Color(0xc9f0ff) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6+0.15,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, pow(h,0.8)),1.0); }',
  });
  return new THREE.Mesh(geo, mat);
}

function eyesOn(parent, y, z, spread, size) {
  const eye = toon(0x111111);
  for (const sx of [1, -1]) {
    parent.add(part(new THREE.CapsuleGeometry(size * 0.45, size * 1.2, 4, 8), eye, { pos: [sx * spread, y, z], outline: 0, shadow: false }));
  }
}

function cloud(scale) {
  const g = new THREE.Group();
  const white = toon(0xffffff, { emissive: 0x9ab8d0, emissiveIntensity: 0.25 });
  const puffs = [[0, 0, 0, 1.3], [-1.3, -0.3, 0, 1.0], [1.3, -0.3, 0, 1.0], [-0.6, 0.6, 0, 0.9], [0.7, 0.5, 0, 0.95]];
  for (const [x, y, z, r] of puffs) g.add(part(new THREE.SphereGeometry(r, 20, 14), white, { pos: [x, y, z], outline: 0.06, shadow: false }));
  eyesOn(g, 0.15, 1.2, 0.35, 0.22);
  g.scale.setScalar(scale);
  return g;
}

function hill(color, h, r) {
  const g = new THREE.Group();
  const m = part(new THREE.CapsuleGeometry(r, h, 8, 24), toon(color), { pos: [0, h / 2, 0], outline: 0.08 });
  g.add(m);
  eyesOn(g, h * 0.75 + r * 0.3, r * 0.95, r * 0.25, r * 0.22);
  return g;
}

function tree(scale = 1) {
  const g = new THREE.Group();
  g.add(part(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 10), toon(0x8a5a2b), { pos: [0, 0.8, 0] }));
  const leaf = toon(0x2fa33a);
  g.add(part(new THREE.SphereGeometry(1.1, 18, 14), leaf, { pos: [0, 2.2, 0], scale: [1, 1.15, 1], outline: 0.05 }));
  g.add(part(new THREE.SphereGeometry(0.7, 16, 12), toon(0x3dbb46), { pos: [0.35, 2.75, 0.35], outline: 0.04 }));
  g.scale.setScalar(scale);
  return g;
}

function bush(scale = 1) {
  const g = new THREE.Group();
  const m = toon(0x35b844);
  for (const [x, r] of [[-0.6, 0.55], [0, 0.75], [0.6, 0.55]]) g.add(part(new THREE.SphereGeometry(r, 16, 12), m, { pos: [x, r * 0.6, 0], outline: 0.04 }));
  eyesOn(g, 0.75, 0.68, 0.18, 0.12);
  g.scale.setScalar(scale);
  return g;
}

function flower(color) {
  const g = new THREE.Group();
  g.add(part(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), toon(0x2b8f2b), { pos: [0, 0.25, 0], outline: 0 }));
  const petal = toon(color);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.add(part(new THREE.SphereGeometry(0.1, 10, 8), petal, { pos: [Math.cos(a) * 0.12, 0.55, Math.sin(a) * 0.12], outline: 0 }));
  }
  g.add(part(new THREE.SphereGeometry(0.08, 10, 8), toon(0xffe14a), { pos: [0, 0.57, 0], outline: 0 }));
  return g;
}

function castle() {
  const g = new THREE.Group();
  const wall = toon(0xf1e3c4), roof = toon(0xd23b2f), dark = toon(0x4a2c1a);
  g.add(part(new THREE.BoxGeometry(6, 4, 3), wall, { pos: [0, 2, 0], outline: 0.08 }));
  g.add(part(new THREE.CylinderGeometry(1.2, 1.2, 6.5, 20), wall, { pos: [0, 3.25, 0.2], outline: 0.08 }));
  g.add(part(new THREE.ConeGeometry(1.55, 2.6, 20), roof, { pos: [0, 7.8, 0.2], outline: 0.08 }));
  for (const sx of [-1, 1]) {
    g.add(part(new THREE.CylinderGeometry(0.8, 0.8, 5, 16), wall, { pos: [sx * 3.2, 2.5, 0.4], outline: 0.08 }));
    g.add(part(new THREE.ConeGeometry(1.05, 2, 16), roof, { pos: [sx * 3.2, 6, 0.4], outline: 0.08 }));
  }
  g.add(part(new THREE.CylinderGeometry(0.75, 0.75, 0.2, 20, 1, false, -Math.PI / 2, Math.PI), dark, { pos: [0, 1.0, 1.55], rot: [Math.PI / 2, 0, 0], outline: 0 }));
  g.add(part(new THREE.BoxGeometry(1.5, 1.0, 0.2), dark, { pos: [0, 0.5, 1.55], outline: 0 }));
  const flagTex = canvasTexture(64, 40, (c, w, h) => { c.fillStyle = '#ffd23f'; c.fillRect(0, 0, w, h); c.fillStyle = '#d23b2f'; c.beginPath(); c.arc(w / 2, h / 2, 12, 0, Math.PI * 2); c.fill(); });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.75), new THREE.MeshToonMaterial({ map: flagTex, side: THREE.DoubleSide }));
  flag.position.set(0.6, 9.7, 0.2);
  g.add(part(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 6), dark, { pos: [0, 9.6, 0.2], outline: 0 }));
  g.add(flag);
  g.userData.flag = flag;
  return g;
}

function goomba() {
  const g = new THREE.Group();
  const head = toon(0x9b5a2a), body = toon(0xf3d6a4), feet = toon(0x3b2412);
  const headMesh = part(new THREE.SphereGeometry(0.55, 24, 16), head, { pos: [0, 0.82, 0], scale: [1.15, 0.8, 1.05] });
  g.add(headMesh);
  g.add(part(new THREE.CylinderGeometry(0.3, 0.36, 0.42, 16), body, { pos: [0, 0.32, 0] }));
  const fl = part(new THREE.SphereGeometry(0.2, 14, 10), feet, { pos: [0.2, 0.1, 0.05], scale: [1, 0.6, 1.4] });
  const fr = part(new THREE.SphereGeometry(0.2, 14, 10), feet, { pos: [-0.2, 0.1, 0.05], scale: [1, 0.6, 1.4] });
  g.add(fl, fr);
  const white = toon(0xffffff), black = toon(0x111111);
  for (const sx of [1, -1]) {
    g.add(part(new THREE.SphereGeometry(0.12, 12, 10), white, { pos: [sx * 0.17, 0.86, 0.48], scale: [0.8, 1.3, 0.5], outline: 0.01 }));
    g.add(part(new THREE.SphereGeometry(0.06, 10, 8), black, { pos: [sx * 0.15, 0.84, 0.54], scale: [0.8, 1.3, 0.5], outline: 0 }));
    g.add(part(new THREE.BoxGeometry(0.24, 0.06, 0.06), black, { pos: [sx * 0.18, 1.04, 0.47], rot: [0, 0, sx * 0.45], outline: 0 }));
  }
  g.userData = { fl, fr };
  return g;
}

function block(textureFn, kind) {
  const mat = new THREE.MeshToonMaterial({ map: textureFn() });
  const m = part(new THREE.BoxGeometry(1, 1, 1), mat, { outline: 0.03 });
  m.userData = { kind, bump: 0, baseY: 0, used: false };
  return m;
}

export function buildWorld(scene) {
  const updaters = [];
  scene.add(skyDome());
  scene.fog = new THREE.Fog(0xc9f0ff, 40, 140);

  // Lights
  const hemi = new THREE.HemisphereLight(0xdff4ff, 0x4a8a3a, 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d6, 2.4);
  sun.position.set(-6, 14, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -6, near: 1, far: 50 });
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xaee0ff, 0.8);
  rim.position.set(6, 6, -8);
  scene.add(rim);

  // Ground: a big grassy block with a dirt front edge.
  const grass = grassTexture(); grass.repeat.set(16, 18);
  const dirt = dirtTexture(); dirt.repeat.set(10, 1);
  const groundMats = [toon(0xb8692e), toon(0xb8692e), new THREE.MeshToonMaterial({ map: grass }), toon(0xb8692e),
    new THREE.MeshToonMaterial({ map: dirt }), toon(0xb8692e)];
  const ground = new THREE.Mesh(new THREE.BoxGeometry(60, 4, 70), groundMats);
  ground.position.set(0, -2, -29);
  ground.receiveShadow = true;
  scene.add(ground);
  // Far meadow so the horizon isn't an edge.
  const far = new THREE.Mesh(new THREE.CircleGeometry(160, 48), toon(0x58c43c));
  far.rotation.x = -Math.PI / 2; far.position.set(0, -0.05, -40);
  scene.add(far);

  // Hills with eyes, castle, trees, bushes, flowers
  const hills = [[-12, -26, 0x2ea84a, 7, 3.2], [-4, -32, 0x3cbf55, 10, 4], [7, -27, 0x2b9a42, 6, 3], [15, -34, 0x46c95b, 9, 4.2], [-20, -36, 0x36b04f, 8, 4]];
  for (const [x, z, c, h, r] of hills) { const m = hill(c, h, r); m.position.set(x, 0, z); scene.add(m); }
  const cas = castle(); cas.position.set(2.4, 0, -25); cas.rotation.y = -0.15; cas.scale.setScalar(1.2); scene.add(cas);
  updaters.push((dt, t) => { cas.userData.flag.rotation.y = Math.sin(t * 3) * 0.25; });
  for (const [x, z, s] of [[-6.5, -6, 1.1], [6.5, -7, 1.25], [-11, -10, 1.4], [11, -12, 1.5], [4.5, -14, 1.2], [-3.5, -15, 1.1]]) {
    const tr = tree(s); tr.position.set(x, 0, z); tr.rotation.y = rand(0, 6); scene.add(tr);
  }
  for (const [x, z, s] of [[-4.3, -2.6, 1], [4.6, -3.2, 0.9], [-1.5, -5.2, 0.8], [0.6, -8, 1.1]]) {
    const b = bush(s); b.position.set(x, 0, z); scene.add(b);
  }
  const flowerColors = [0xff4f6d, 0xffffff, 0xff9f1c, 0xa66bff];
  for (let i = 0; i < 22; i++) {
    const f = flower(flowerColors[i % flowerColors.length]);
    const x = rand(-6, 6), z = rand(-6, 3.5);
    if (Math.abs(x - PIPE.x) < 1.4 && Math.abs(z - PIPE.z) < 1.4) continue;
    if (x > STAGE.minX - 0.3 && x < STAGE.maxX + 0.3 && z > STAGE.minZ - 0.3 && z < STAGE.maxZ + 0.3) continue;
    f.position.set(x, 0, z); f.rotation.y = rand(0, 6); f.scale.setScalar(rand(0.8, 1.2));
    scene.add(f);
    const ph = rand(0, 6);
    updaters.push((dt, t) => { f.rotation.z = Math.sin(t * 2 + ph) * 0.08; });
  }

  addScenery(scene, updaters, { tree, bush, flower, hill }, { PIPE, STAGE });

  // The green warp pipe. Open on top so Luigi can rise out of it.
  const pipe = new THREE.Group();
  pipe.position.set(PIPE.x, 0, PIPE.z);
  const pTex = pipeTexture();
  const pipeMat = new THREE.MeshToonMaterial({ map: pTex });
  const inner = toon(0x05250b, { side: THREE.BackSide });
  const lipH = 0.5, bodyH = PIPE.height - lipH;
  const bodyMesh = part(new THREE.CylinderGeometry(PIPE.radius, PIPE.radius, bodyH + 0.2, 40, 1, true), pipeMat, { pos: [0, bodyH / 2 - 0.1, 0], outline: 0.05 });
  const lip = part(new THREE.CylinderGeometry(PIPE.radius + 0.16, PIPE.radius + 0.16, lipH, 40, 1, true), pipeMat, { pos: [0, bodyH + lipH / 2, 0], outline: 0.05 });
  const lipInner = new THREE.Mesh(new THREE.CylinderGeometry(PIPE.radius + 0.02, PIPE.radius + 0.02, PIPE.height + 0.3, 40, 1, true), inner);
  lipInner.position.y = PIPE.height / 2 - 0.15;
  const rimRing = part(new THREE.RingGeometry(PIPE.radius + 0.02, PIPE.radius + 0.16, 40), toon(0x2fc24a), { pos: [0, PIPE.height, 0], rot: [-Math.PI / 2, 0, 0], outline: 0 });
  const darkness = new THREE.Mesh(new THREE.CircleGeometry(PIPE.radius + 0.02, 40), toon(0x020c04));
  darkness.rotation.x = -Math.PI / 2; darkness.position.y = PIPE.height - 0.55;
  pipe.add(bodyMesh, lip, lipInner, rimRing, darkness);
  scene.add(pipe);

  // Floating blocks Mario can bonk.
  const blocks = [];
  const row = [[-3.5, 'brick'], [-2.5, 'q'], [-1.5, 'brick'], [-0.5, 'q'], [0.5, 'brick']];
  for (const [x, kind] of row) {
    const b = block(kind === 'q' ? () => questionBlockTexture(false) : brickTexture, kind);
    b.position.set(x, 4.35, 0.2);
    b.userData.baseY = 4.35;
    scene.add(b);
    blocks.push(b);
  }
  updaters.push((dt) => {
    for (const b of blocks) {
      if (b.userData.bump > 0) b.userData.bump = Math.max(0, b.userData.bump - dt * 4);
      const k = b.userData.bump;
      b.position.y = b.userData.baseY + Math.sin(k * Math.PI) * 0.35;
    }
  });

  // Spinning coins
  const coinMat = toon(0xffcc1a, { emissive: 0x6a4a00, emissiveIntensity: 0.4 });
  const coinGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.07, 24);
  const coins = [];
  for (const [x, y, z] of [[-4.6, 2.2, -1.5], [-4.0, 2.7, -1.5], [-3.4, 2.9, -1.5], [3.9, 3.4, -2.5], [4.5, 3.0, -2.5], [5.1, 2.6, -2.5]]) {
    const c = part(coinGeo, coinMat, { pos: [x, y, z], rot: [Math.PI / 2, 0, 0], outline: 0.02 });
    scene.add(c); coins.push(c);
  }
  updaters.push((dt, t) => { coins.forEach((c, i) => { c.rotation.z = t * 2.5 + i; c.position.y += Math.sin(t * 2 + i) * 0.002; }); });

  // Clouds drifting across the sky
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const c = cloud(rand(0.8, 1.5));
    c.position.set(rand(-30, 30), rand(9, 15), rand(-34, -14));
    c.userData.speed = rand(0.25, 0.6);
    scene.add(c); clouds.push(c);
  }
  updaters.push((dt) => { for (const c of clouds) { c.position.x += c.userData.speed * dt; if (c.position.x > 34) c.position.x = -34; } });

  // A Goomba pacing back and forth behind the stage
  const gm = goomba();
  gm.position.set(-3, 0, -3.8);
  scene.add(gm);
  let gDir = 1;
  updaters.push((dt, t) => {
    gm.position.x += gDir * 0.9 * dt;
    if (gm.position.x > 3.4) gDir = -1;
    if (gm.position.x < -4.8) gDir = 1;
    gm.rotation.y = THREE.MathUtils.lerp(gm.rotation.y, gDir > 0 ? Math.PI / 2 : -Math.PI / 2, 1 - Math.exp(-6 * dt));
    gm.userData.fl.position.y = 0.1 + Math.max(0, Math.sin(t * 9)) * 0.12;
    gm.userData.fr.position.y = 0.1 + Math.max(0, -Math.sin(t * 9)) * 0.12;
    gm.position.y = Math.abs(Math.sin(t * 9)) * 0.04;
  });

  // ---------- Effects ----------
  const particles = [];
  const heartTex = canvasTexture(64, 64, (g, w) => {
    g.font = '52px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('❤️', w / 2, w / 2 + 3);
  });
  const starTex = canvasTexture(64, 64, (g, w) => {
    g.translate(w / 2, w / 2); g.fillStyle = '#ffe14a'; g.strokeStyle = '#7a4a00'; g.lineWidth = 4;
    g.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 12 : 28; const a = (i / 10) * Math.PI * 2 - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#111'; g.fillRect(-7, -6, 4, 9); g.fillRect(3, -6, 4, 9);
  });

  function spawnCoin(pos) {
    const c = new THREE.Mesh(coinGeo, coinMat.clone());
    c.material.transparent = true;
    c.position.copy(pos); c.rotation.x = Math.PI / 2;
    scene.add(c);
    particles.push({ obj: c, vel: new THREE.Vector3(0, 7, 0), life: 0.9, max: 0.9, spin: 18, gravity: 16 });
  }
  function spawnSprite(tex, pos, vel, life, size) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    s.position.copy(pos); s.scale.setScalar(size);
    scene.add(s);
    particles.push({ obj: s, vel, life, max: life, gravity: -0.5, sprite: true });
  }
  updaters.push((dt) => {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.vel.y -= p.gravity * dt;
      p.obj.position.addScaledVector(p.vel, dt);
      if (p.spin) p.obj.rotation.z += p.spin * dt;
      const a = Math.max(0, Math.min(1, p.life / (p.max * 0.4)));
      p.obj.material.opacity = a;
      if (p.life <= 0) { scene.remove(p.obj); p.obj.material.dispose(); particles.splice(i, 1); }
    }
  });

  const effects = {
    coin: spawnCoin,
    hearts(n = 3) {
      for (let i = 0; i < n; i++) {
        spawnSprite(heartTex, new THREE.Vector3(rand(-3, 3), rand(0.2, 1.5), rand(1.5, 3)), new THREE.Vector3(rand(-0.3, 0.3), rand(1.2, 2.2), 0), rand(2, 3), rand(0.35, 0.6));
      }
    },
    stars(pos, n = 14) {
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2);
        spawnSprite(starTex, pos.clone(), new THREE.Vector3(Math.cos(a) * rand(1, 3), rand(2, 5), Math.sin(a) * rand(0.5, 1.5)), rand(1.2, 2), rand(0.35, 0.6));
      }
    },
  };

  return {
    blocks,
    pipe,
    effects,
    update(dt, t) { for (const u of updaters) u(dt, t); },
  };
}
