// Mario & Luigi: fully 3D cartoon characters with a joint rig and procedural animation
// (idle, walk, run, jump, talk with lip sync, wave, think, celebrate).
// If you drop mario.glb / luigi.glb in the assets folder, GltfCharacter uses those instead.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toon, part, emblemTexture } from './toon.js';

export const SPECS = {
  mario: {
    name: 'mario', shirt: 0xe3221c, overalls: 0x2747d8, shoe: 0x6a3418, hair: 0x3a1f10,
    mustache: 0x24120a, skin: 0xffc79a, letter: 'M', letterColor: '#e3221c',
    leg: 0.62, torso: 1.0, slim: 1.0, mustacheW: 1.0,
  },
  luigi: {
    name: 'luigi', shirt: 0x22b03f, overalls: 0x22308c, shoe: 0x5a2c14, hair: 0x3a1f10,
    mustache: 0x24120a, skin: 0xffc79a, letter: 'L', letterColor: '#22b03f',
    leg: 0.8, torso: 1.12, slim: 0.86, mustacheW: 0.85,
  },
};

const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt));
const angleDamp = (cur, target, k, dt) => {
  let d = target - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return cur + d * (1 - Math.exp(-k * dt));
};
// Cheap smooth noise for natural-looking gestures.
const noise = (t, seed = 0) =>
  Math.sin(t * 1.3 + seed) * 0.5 + Math.sin(t * 2.7 + seed * 2.1) * 0.3 + Math.sin(t * 4.1 + seed * 3.3) * 0.2;

const JOINTS = ['hips', 'torso', 'head', 'armL', 'armR', 'elbowL', 'elbowR', 'handL', 'handR',
  'legL', 'legR', 'kneeL', 'kneeR', 'footL', 'footR'];

class BaseCharacter {
  constructor(name) {
    this.name = name;
    this.root = new THREE.Group();
    this.root.name = name;
    this.heading = 0;
    this.targetHeading = 0;
    this.state = 'idle';
    this.speed = 0;
    this.moveTarget = null;
    this.moveResolve = null;
    this.running = false;
    this.talkLevel = 0;
    this.lookTarget = null;
    this.baseY = 0;
    this.jumpY = 0;
    this.jumpV = 0;
    this.airborne = false;
    this.jumpResolve = null;
    this.landSquash = 0;
    this.time = Math.random() * 100;
  }

  setPosition(x, y, z) { this.root.position.set(x, y, z); this.baseY = y; }
  get position() { return this.root.position; }

  walkTo(x, z, run = false) {
    if (this.moveResolve) this.moveResolve(false);
    this.moveTarget = new THREE.Vector3(x, 0, z);
    this.running = run;
    return new Promise((res) => { this.moveResolve = res; });
  }

  stop() {
    this.moveTarget = null;
    if (this.moveResolve) { this.moveResolve(false); this.moveResolve = null; }
  }

  faceAngle(a) { this.targetHeading = a; }
  facePoint(p) {
    const dx = p.x - this.root.position.x, dz = p.z - this.root.position.z;
    this.targetHeading = Math.atan2(dx, dz);
  }

  jump(power = 7.5) {
    if (this.airborne) return Promise.resolve();
    this.airborne = true;
    this.jumpV = power;
    return new Promise((res) => { this.jumpResolve = res; });
  }

  // Head-top position in world space (for speech bubbles).
  headWorld(out = new THREE.Vector3()) {
    return out.copy(this.root.position).add(new THREE.Vector3(0, this.height + 0.2 + this.jumpY, 0));
  }

  updateMotion(dt) {
    this.time += dt;
    // Walking / running toward a target.
    let moving = false;
    if (this.moveTarget) {
      const p = this.root.position;
      const dx = this.moveTarget.x - p.x, dz = this.moveTarget.z - p.z;
      const dist = Math.hypot(dx, dz);
      const maxSpeed = this.running ? 4.2 : 1.9;
      if (dist < 0.08) {
        this.moveTarget = null;
        this.speed = 0;
        if (this.moveResolve) { const r = this.moveResolve; this.moveResolve = null; r(true); }
      } else {
        moving = true;
        this.targetHeading = Math.atan2(dx, dz);
        this.speed = damp(this.speed, Math.min(maxSpeed, dist * 3 + 0.4), 6, dt);
        const step = Math.min(dist, this.speed * dt);
        p.x += (dx / dist) * step;
        p.z += (dz / dist) * step;
      }
    }
    if (!moving) this.speed = damp(this.speed, 0, 10, dt);
    this.heading = angleDamp(this.heading, this.targetHeading, moving ? 10 : 6, dt);
    this.root.rotation.y = this.heading;

    // Jump physics.
    if (this.airborne) {
      this.jumpV -= 22 * dt;
      this.jumpY += this.jumpV * dt;
      if (this.jumpY <= 0) {
        this.jumpY = 0;
        this.airborne = false;
        this.landSquash = 1;
        if (this.jumpResolve) { const r = this.jumpResolve; this.jumpResolve = null; r(); }
      }
    }
    this.landSquash = damp(this.landSquash, 0, 9, dt);
    this.root.position.y = this.baseY + this.jumpY;
  }
}

export class ToonCharacter extends BaseCharacter {
  constructor(spec) {
    super(spec.name);
    this.spec = spec;
    this.j = {};
    this.blinkTimer = 2 + Math.random() * 3;
    this.blink = 0;
    this.gestureSeed = Math.random() * 10;
    this.build();
  }

  build() {
    const s = this.spec;
    const M = {
      shirt: toon(s.shirt), overalls: toon(s.overalls), skin: toon(s.skin), shoe: toon(s.shoe),
      hair: toon(s.hair), stache: toon(s.mustache), white: toon(0xffffff), button: toon(0xffd21f),
      mouth: toon(0x5a0a14), iris: toon(0x2a64d8), pupil: toon(0x0d0d14), brow: toon(0x24120a),
    };
    const g = (name, parent, pos = [0, 0, 0]) => {
      const grp = new THREE.Group(); grp.name = name; grp.position.set(...pos); parent.add(grp);
      this.j[name] = grp; return grp;
    };
    const L = s.leg, T = s.torso, W = s.slim;

    this.body = g('body', this.root);
    const hipY = L + 0.19;
    const hips = g('hips', this.body, [0, hipY, 0]);
    hips.add(part(new THREE.SphereGeometry(0.42, 28, 20), M.overalls, { scale: [W * 1.02, 0.78, 0.92] }));

    // Legs
    for (const [side, sx] of [['L', 1], ['R', -1]]) {
      const leg = g('leg' + side, hips, [sx * 0.2 * W, -0.06, 0]);
      leg.add(part(new THREE.CapsuleGeometry(0.15, L * 0.3, 6, 14), M.overalls, { pos: [0, -L * 0.24, 0] }));
      const knee = g('knee' + side, leg, [0, -L * 0.5, 0]);
      knee.add(part(new THREE.CapsuleGeometry(0.135, L * 0.28, 6, 14), M.overalls, { pos: [0, -L * 0.22, 0] }));
      const foot = g('foot' + side, knee, [0, -L * 0.5, 0]);
      foot.add(part(new THREE.SphereGeometry(0.2, 22, 16), M.shoe, { pos: [0, -0.02, 0.09], scale: [0.88, 0.62, 1.35] }));
    }

    // Torso
    const torso = g('torso', hips, [0, 0.14, 0]);
    torso.add(part(new THREE.SphereGeometry(0.46, 30, 22), M.overalls, { pos: [0, 0.12 * T, 0], scale: [W, 0.86 * T, 0.9] }));
    torso.add(part(new THREE.SphereGeometry(0.4, 30, 22), M.shirt, { pos: [0, 0.5 * T, -0.02], scale: [W * 1.06, 0.78 * T, 0.86] }));
    // Overall bib, straps and the famous yellow buttons
    const bib = part(new THREE.BoxGeometry(0.46 * W, 0.3 * T, 0.12), M.overalls, { pos: [0, 0.38 * T, 0.31], rot: [-0.12, 0, 0], outline: 0.02 });
    torso.add(bib);
    for (const sx of [1, -1]) {
      torso.add(part(new THREE.BoxGeometry(0.1, 0.42 * T, 0.08), M.overalls,
        { pos: [sx * 0.17 * W, 0.6 * T, 0.27], rot: [-0.45, 0, sx * -0.12], outline: 0.015 }));
      torso.add(part(new THREE.SphereGeometry(0.06, 14, 10), M.button,
        { pos: [sx * 0.15 * W, 0.47 * T, 0.38], scale: [1, 1, 0.6], outline: 0.012 }));
    }

    // Arms
    for (const [side, sx] of [['L', 1], ['R', -1]]) {
      const arm = g('arm' + side, torso, [sx * 0.4 * W, 0.58 * T, 0]);
      arm.add(part(new THREE.SphereGeometry(0.15, 16, 12), M.shirt, {}));
      arm.add(part(new THREE.CapsuleGeometry(0.11, 0.2 * T, 6, 12), M.shirt, { pos: [0, -0.18 * T, 0] }));
      const elbow = g('elbow' + side, arm, [0, -0.36 * T, 0]);
      elbow.add(part(new THREE.CapsuleGeometry(0.1, 0.16 * T, 6, 12), M.shirt, { pos: [0, -0.14 * T, 0] }));
      const hand = g('hand' + side, elbow, [0, -0.32 * T, 0]);
      hand.add(part(new THREE.CylinderGeometry(0.13, 0.11, 0.1, 16), M.white, { pos: [0, 0.1, 0], outline: 0.015 }));
      hand.add(part(new THREE.SphereGeometry(0.15, 18, 14), M.white, { pos: [0, -0.04, 0], scale: [1, 1.05, 0.9] }));
      hand.add(part(new THREE.SphereGeometry(0.065, 12, 10), M.white, { pos: [-sx * 0.1, 0.0, 0.08], outline: 0.012 }));
    }

    // Head
    const head = g('head', torso, [0, 0.82 * T, 0]);
    const H = new THREE.Group(); H.position.y = 0.3; head.add(H); this.headCenter = H;
    H.add(part(new THREE.SphereGeometry(0.45, 36, 28), M.skin, {}));
    H.add(part(new THREE.SphereGeometry(0.155, 20, 16), M.skin, { pos: [0, -0.05, 0.47], scale: [1.05, 0.92, 1] }));
    for (const sx of [1, -1]) {
      H.add(part(new THREE.SphereGeometry(0.1, 14, 10), M.skin, { pos: [sx * 0.44, -0.02, -0.02], scale: [0.5, 1, 0.8], outline: 0.012 }));
      // sideburns
      H.add(part(new THREE.BoxGeometry(0.07, 0.2, 0.12), M.hair, { pos: [sx * 0.41, 0.0, 0.12], rot: [0, sx * 0.4, 0], outline: 0.01 }));
    }
    // Hair round the back, under the cap
    H.add(part(new THREE.SphereGeometry(0.465, 32, 16, Math.PI, Math.PI, Math.PI * 0.33, Math.PI * 0.42), M.hair, { outline: 0 }));

    // Eyes (each in a group so they can blink)
    this.eyes = [];
    for (const sx of [1, -1]) {
      const eye = new THREE.Group(); eye.position.set(sx * 0.135, 0.06, 0.4); eye.rotation.y = sx * 0.3; H.add(eye);
      eye.add(part(new THREE.SphereGeometry(0.1, 18, 14), M.white, { scale: [0.72, 1.2, 0.45], outline: 0.012 }));
      eye.add(part(new THREE.SphereGeometry(0.055, 14, 10), M.iris, { pos: [-sx * 0.008, -0.01, 0.035], scale: [0.85, 1.25, 0.4], outline: 0, shadow: false }));
      eye.add(part(new THREE.SphereGeometry(0.03, 12, 8), M.pupil, { pos: [-sx * 0.008, -0.01, 0.052], scale: [0.85, 1.3, 0.4], outline: 0, shadow: false }));
      eye.add(part(new THREE.SphereGeometry(0.014, 8, 6), M.white, { pos: [-sx * 0.0, 0.025, 0.06], outline: 0, shadow: false }));
      this.eyes.push(eye);
      const brow = part(new THREE.CapsuleGeometry(0.022, 0.1, 4, 8), M.brow, { pos: [sx * 0.14, 0.205, 0.39], rot: [0, 0, Math.PI / 2 + sx * 0.18], outline: 0 });
      H.add(brow);
      (this.brows ||= []).push({ mesh: brow, sx, y: 0.205 });
    }

    // Mouth (opens with the voice) and the famous mustache on top
    this.mouth = part(new THREE.SphereGeometry(0.1, 18, 12), M.mouth, { pos: [0, -0.21, 0.37], scale: [1.25, 0.15, 0.6], outline: 0.012 });
    H.add(this.mouth);
    this.stache = new THREE.Group(); this.stache.position.set(0, -0.16, 0.44); H.add(this.stache);
    const mw = s.mustacheW;
    for (const sx of [1, -1]) {
      this.stache.add(part(new THREE.SphereGeometry(0.1, 18, 12), M.stache,
        { pos: [sx * 0.11 * mw, 0, 0], rot: [0.2, sx * 0.35, sx * 0.3], scale: [1.55 * mw, 0.62, 0.6], outline: 0.012 }));
      this.stache.add(part(new THREE.SphereGeometry(0.07, 14, 10), M.stache,
        { pos: [sx * 0.24 * mw, -0.04, -0.06], rot: [0, sx * 0.6, sx * 0.5], scale: [1.2, 0.6, 0.6], outline: 0.01 }));
    }

    // Cap: dome, brim and the letter emblem
    const cap = part(new THREE.SphereGeometry(0.485, 36, 18, 0, Math.PI * 2, 0, Math.PI * 0.5), M.shirt,
      { pos: [0, 0.2, -0.03], rot: [-0.18, 0, 0], scale: [1.02, 0.86, 1.06] });
    H.add(cap);
    const brim = part(new THREE.CylinderGeometry(0.47, 0.47, 0.055, 32, 1, false, -Math.PI / 2, Math.PI), M.shirt,
      { pos: [0, 0.25, 0.1], rot: [0.12, 0, 0], scale: [0.98, 1, 0.98] });
    H.add(brim);
    const emblem = new THREE.Mesh(new THREE.CircleGeometry(0.15, 32),
      new THREE.MeshToonMaterial({ map: emblemTexture(s.letter, s.letterColor), transparent: true }));
    emblem.position.set(0, 0.27, 0.43);
    emblem.rotation.x = -0.62;
    cap.add(emblem);

    // Total height used for bubbles/camera framing.
    this.height = hipY + 0.14 + 0.82 * T + 0.3 + 0.62;
    this.root.traverse((o) => { if (o.isMesh && !o.userData.isOutline) o.castShadow = true; });
  }

  update(dt) {
    this.updateMotion(dt);
    const t = this.time, j = this.j, k = 12;
    const P = {}; // target rotations: [x, y, z]
    for (const n of JOINTS) P[n] = [0, 0, 0];
    let bodyY = 0, bodyRX = 0, bodyRZ = 0, breathe = Math.sin(t * 2.2) * 0.012;

    // Resting arms hang slightly out from the body.
    P.armL = [0.05, 0, 0.32]; P.armR = [0.05, 0, -0.32];
    P.elbowL = [-0.3, 0, 0]; P.elbowR = [-0.3, 0, 0];
    P.kneeL = [0.06, 0, 0]; P.kneeR = [0.06, 0, 0];
    P.head = [noise(t * 0.4, 1) * 0.08, noise(t * 0.3, 2) * 0.25, noise(t * 0.35, 3) * 0.05];
    bodyRZ = Math.sin(t * 0.9) * 0.025;

    const moveAmt = Math.min(1, this.speed / 1.9);
    if (moveAmt > 0.05 && !this.airborne) {
      const run = this.speed > 2.6;
      const freq = run ? 13 : 8.5;
      const ph = t * freq;
      const amp = (run ? 0.95 : 0.65) * moveAmt;
      P.legL = [Math.sin(ph) * amp, 0, 0];
      P.legR = [-Math.sin(ph) * amp, 0, 0];
      P.kneeL = [Math.max(0, -Math.cos(ph)) * amp * 1.4 + 0.1, 0, 0];
      P.kneeR = [Math.max(0, Math.cos(ph)) * amp * 1.4 + 0.1, 0, 0];
      P.armL = [-Math.sin(ph) * amp * 0.9, 0, 0.3];
      P.armR = [Math.sin(ph) * amp * 0.9, 0, -0.3];
      P.elbowL = [-0.5 - (run ? 0.9 : 0.2), 0, 0]; P.elbowR = [-0.5 - (run ? 0.9 : 0.2), 0, 0];
      P.torso = [run ? 0.22 : 0.06, Math.sin(ph) * 0.12 * moveAmt, 0];
      bodyY = Math.abs(Math.cos(ph)) * (run ? 0.12 : 0.07) * moveAmt;
      P.head = [run ? -0.15 : -0.04, -Math.sin(ph) * 0.08, 0];
    } else if (this.state === 'talk') {
      const lv = this.talkLevel, sd = this.gestureSeed;
      const g1 = noise(t * 0.9, sd), g2 = noise(t * 0.8, sd + 4);
      P.armR = [-0.5 - g1 * 0.45 - lv * 0.3, 0, -0.45 - Math.max(0, g2) * 0.4];
      P.elbowR = [-1.0 - g1 * 0.35, 0, 0];
      P.handR = [0, g2 * 0.5, 0];
      P.armL = [-0.2 - Math.max(0, g2) * 0.6, 0, 0.4 + Math.max(0, -g1) * 0.5];
      P.elbowL = [-0.7 - Math.max(0, g2) * 0.7, 0, 0];
      P.head = [-0.06 + lv * 0.18 + Math.sin(t * 7) * lv * 0.05, noise(t * 0.5, sd) * 0.18, noise(t * 0.6, sd + 1) * 0.1];
      P.torso = [lv * 0.05, g1 * 0.08, g2 * 0.04];
      bodyY = lv * 0.03;
    } else if (this.state === 'think') {
      P.armR = [-1.25, 0, -0.15]; P.elbowR = [-2.3, 0, 0]; P.handR = [0.3, 0, 0];
      P.armL = [-0.3, 0, 0.55]; P.elbowL = [-1.6, 0.4, 0];
      P.head = [-0.22, 0.25 + Math.sin(t * 1.2) * 0.05, 0.15];
    } else if (this.state === 'wave') {
      P.armR = [-0.1, 0, -2.5]; P.elbowR = [0, 0, -0.2 + Math.sin(t * 11) * 0.45];
      P.handR = [0, 0, Math.sin(t * 11) * 0.3];
      P.head = [0.05, 0, Math.sin(t * 2) * 0.1];
      bodyRZ = Math.sin(t * 5.5) * 0.04;
    } else if (this.state === 'celebrate') {
      const b = Math.abs(Math.sin(t * 6));
      P.armL = [-0.2, 0, 2.5 + b * 0.3]; P.armR = [-0.2, 0, -2.5 - b * 0.3];
      P.elbowL = [-0.2, 0, 0]; P.elbowR = [-0.2, 0, 0];
      P.head = [-0.2, 0, Math.sin(t * 6) * 0.15];
      bodyY = b * 0.08;
    } else if (this.state === 'scared') {
      P.armL = [-1.3, 0, 0.5]; P.armR = [-1.3, 0, -0.5]; P.elbowL = [-1.6, 0, 0]; P.elbowR = [-1.6, 0, 0];
      P.kneeL = [0.5, 0, 0]; P.kneeR = [0.5, 0, 0]; P.legL = [-0.25, 0, 0]; P.legR = [-0.25, 0, 0];
      bodyRZ = Math.sin(t * 40) * 0.03; bodyY = -0.08;
    }

    if (this.airborne) {
      // Classic jump pose: one fist punched up, one knee forward.
      P.armR = [-0.2, 0, -2.8]; P.elbowR = [-0.2, 0, 0];
      P.armL = [0.5, 0, 0.7]; P.elbowL = [-0.6, 0, 0];
      P.legL = [-0.9, 0, 0]; P.kneeL = [1.5, 0, 0];
      P.legR = [0.35, 0, 0]; P.kneeR = [0.6, 0, 0];
      P.head = [-0.15, 0, 0];
    }

    // Look at a point of interest (camera, Luigi, ...) by turning the head.
    if (this.lookTarget && moveAmt < 0.3) {
      const local = this.root.worldToLocal(this.lookTarget.clone());
      const yaw = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -0.9, 0.9);
      P.head[1] = P.head[1] * 0.3 + yaw;
    }

    for (const n of JOINTS) {
      const node = j[n]; if (!node) continue;
      const kk = (n.startsWith('elbow') || n.startsWith('hand')) ? k * 1.2 : k;
      node.rotation.x = damp(node.rotation.x, P[n][0], kk, dt);
      node.rotation.y = damp(node.rotation.y, P[n][1], kk, dt);
      node.rotation.z = damp(node.rotation.z, P[n][2], kk, dt);
    }
    this.body.position.y = damp(this.body.position.y, bodyY, 14, dt);
    this.body.rotation.x = damp(this.body.rotation.x, bodyRX, 8, dt);
    this.body.rotation.z = damp(this.body.rotation.z, bodyRZ, 8, dt);
    const sq = this.landSquash * 0.18;
    this.body.scale.set(1 + sq, 1 - sq + breathe, 1 + sq);

    // Face: lip sync, mustache wiggle, eyebrows, blinking.
    const lv = this.state === 'talk' ? this.talkLevel : 0;
    this.mouth.scale.y = damp(this.mouth.scale.y, 0.15 + lv * 0.95, 25, dt);
    this.mouth.position.y = -0.21 - lv * 0.03;
    this.stache.position.y = -0.16 + lv * 0.025;
    this.stache.rotation.z = Math.sin(t * 13) * lv * 0.06;
    this.stache.scale.x = 1 + lv * 0.06;
    for (const b of this.brows) b.mesh.position.y = damp(b.mesh.position.y, b.y + lv * 0.035 + (this.state === 'scared' ? 0.04 : 0), 15, dt);

    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) { this.blink = 0.14; this.blinkTimer = 2 + Math.random() * 3.5; }
    this.blink = Math.max(0, this.blink - dt);
    const eyeY = this.blink > 0 ? 0.12 : 1;
    for (const e of this.eyes) e.scale.y = damp(e.scale.y, eyeY, 40, dt);
  }
}

// Wraps a rigged .glb model (from the assets folder) with the same controls.
export class GltfCharacter extends BaseCharacter {
  static async load(name, url, targetHeight) {
    const gltf = await new GLTFLoader().loadAsync(url);
    return new GltfCharacter(name, gltf, targetHeight);
  }

  constructor(name, gltf, targetHeight) {
    super(name);
    const model = gltf.scene;
    model.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      if (o.isBone && /head/i.test(o.name) && !this.headBone) this.headBone = o;
      if (o.isBone && /jaw|mouth/i.test(o.name) && !this.jawBone) this.jawBone = o;
    });
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const scale = targetHeight / (size.y || 1);
    model.scale.setScalar(scale);
    model.position.y = -box.min.y * scale;
    this.root.add(model);
    this.height = targetHeight;
    this.mixer = new THREE.AnimationMixer(model);
    this.clips = {};
    const find = (re) => gltf.animations.find((a) => re.test(a.name));
    const map = {
      idle: find(/idle|stand|breath/i) || gltf.animations[0],
      walk: find(/walk/i), run: find(/run|sprint/i) || find(/walk/i),
      talk: find(/talk|speak/i), wave: find(/wave|hello/i), jump: find(/jump/i),
      celebrate: find(/dance|celebrat|victory|cheer/i),
    };
    for (const [k, clip] of Object.entries(map)) if (clip) this.clips[k] = this.mixer.clipAction(clip);
    this.current = null;
    this.play('idle');
    this.jawRest = this.jawBone ? this.jawBone.rotation.x : 0;
  }

  play(name) {
    const action = this.clips[name] || this.clips.idle;
    if (!action || action === this.current) return;
    action.reset().fadeIn(0.25).play();
    if (this.current) this.current.fadeOut(0.25);
    this.current = action;
  }

  update(dt) {
    this.updateMotion(dt);
    let anim = this.state;
    if (this.airborne) anim = 'jump';
    else if (this.speed > 2.6) anim = 'run';
    else if (this.speed > 0.2) anim = 'walk';
    if (!this.clips[anim]) anim = anim === 'talk' || anim === 'think' ? 'idle' : anim;
    this.play(anim);
    this.mixer.update(dt);
    const lv = this.state === 'talk' ? this.talkLevel : 0;
    if (this.jawBone) this.jawBone.rotation.x = this.jawRest + lv * 0.35;
    else if (this.headBone) this.headBone.rotation.x += lv * 0.12;
  }
}

export async function createCharacter(name, glbUrl) {
  const spec = SPECS[name];
  if (glbUrl) {
    try {
      return await GltfCharacter.load(name, glbUrl, name === 'luigi' ? 2.75 : 2.45);
    } catch (e) {
      console.warn(`Couldn't load ${glbUrl}, using the built-in ${name}.`, e);
    }
  }
  return new ToonCharacter(spec);
}
