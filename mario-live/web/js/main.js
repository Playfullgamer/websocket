// Director: builds the scene, connects to the server, and makes Mario & Luigi act.
import * as THREE from 'three';
import { buildWorld, PIPE, STAGE } from './world.js';
import { createCharacter } from './character.js';
import { AudioSystem } from './audio.js';
import { Overlay } from './overlay.js';
import { setupVoiceLab } from './voicelab.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const easeOutBack = (x) => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2);
const easeInBack = (x) => 2.4 * x * x * x - 1.4 * x * x;

// ---------- renderer / camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('stage').append(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
const camBase = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
const camFocus = new THREE.Vector3(0.1, 0, 0);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  // Fit the stage (Mario's area + the pipe) in portrait; show more world in landscape.
  const fitW = 6.1 / 2 / (tanHalf * camera.aspect);
  const fitH = 9.5 / 2 / tanHalf;
  const dist = Math.max(fitW, fitH);
  camBase.pos.set(0.1, 3.0 + dist * 0.1, 1 + dist);
  camBase.look.set(0.1, camera.aspect < 1 ? 2.8 : 2.9, 0);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- world & cast ----------
const cfg = await fetch('/api/config').then((r) => r.json()).catch(() => ({ assets: {} }));
const world = buildWorld(scene);
const audio = new AudioSystem();
const overlay = new Overlay();
overlay.setupHints(cfg);

const mario = await createCharacter('mario', cfg.assets?.mario);
mario.setPosition(STAGE.talkSpot.x, 0, STAGE.talkSpot.z);
scene.add(mario.root);

const luigi = await createCharacter('luigi', cfg.assets?.luigi);
const LUIGI_HIDDEN_Y = -(luigi.height + 0.6);
luigi.setPosition(PIPE.x, LUIGI_HIDDEN_Y, PIPE.z);
luigi.faceAngle(-0.35);
luigi.heading = -0.35;
luigi.root.visible = false;
scene.add(luigi.root);

if (cfg.assets?.scene) {
  import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) =>
    new GLTFLoader().loadAsync(cfg.assets.scene).then((g) => {
      g.scene.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = true; } });
      scene.add(g.scene);
    })).catch((e) => console.warn('scene.glb failed to load', e));
}
if (cfg.assets?.music) audio.playMusic(cfg.assets.music);

// Small tween helper driven by the render loop.
const tweens = [];
function tween(duration, fn) {
  return new Promise((resolve) => tweens.push({ t: 0, duration, fn, resolve }));
}

// ---------- Luigi & the pipe ----------
const luigiState = { up: false, moving: null, hideTimer: null };

async function luigiUp() {
  clearTimeout(luigiState.hideTimer);
  if (luigiState.moving) await luigiState.moving;
  if (luigiState.up) return;
  luigiState.moving = (async () => {
    luigi.root.visible = true;
    luigi.state = 'idle';
    audio.pipe(true);
    mario.lookTarget = luigi.headWorld();
    const from = LUIGI_HIDDEN_Y, to = PIPE.height;
    await tween(0.85, (k) => { luigi.baseY = from + (to - from) * easeOutBack(k); });
    luigi.baseY = to;
    await luigi.jump(5);
    luigiState.up = true;
  })();
  await luigiState.moving;
  luigiState.moving = null;
}

async function luigiDown() {
  if (!luigiState.up || luigiState.moving) return;
  luigiState.moving = (async () => {
    luigi.state = 'wave';
    await sleep(900);
    luigi.state = 'idle';
    audio.pipe(false);
    const from = luigi.baseY, to = LUIGI_HIDDEN_Y;
    await tween(0.7, (k) => { luigi.baseY = from + (to - from) * easeInBack(k); });
    luigi.root.visible = false;
    luigiState.up = false;
    if (mario.lookTarget && !busy) mario.lookTarget = null;
  })();
  await luigiState.moving;
  luigiState.moving = null;
}

function scheduleLuigiDown(ms = 3500) {
  clearTimeout(luigiState.hideTimer);
  luigiState.hideTimer = setTimeout(luigiDown, ms);
}

// ---------- Mario's idle life ----------
let busy = false;

async function bonkBlock() {
  const qs = world.blocks.filter((b) => b.userData.kind === 'q');
  const b = qs[Math.floor(Math.random() * qs.length)];
  const ok = await mario.walkTo(b.position.x, b.position.z, false);
  if (!ok || busy) return;
  mario.faceAngle(0);
  await sleep(250);
  if (busy) return;
  audio.jump();
  mario.jump(7.6);
  await sleep(330); // near the top of the jump
  b.userData.bump = 1;
  audio.bump();
  setTimeout(() => audio.coin(), 60);
  world.effects.coin(b.position.clone().add(new THREE.Vector3(0, 0.8, 0)));
}

async function wander() {
  for (;;) {
    await sleep(rand(1600, 3800));
    if (busy) continue;
    const r = Math.random();
    try {
      if (r < 0.5) {
        await mario.walkTo(rand(STAGE.minX, STAGE.maxX), rand(STAGE.minZ, STAGE.maxZ), Math.random() < 0.2);
        if (!busy) mario.faceAngle(rand(-0.6, 0.6));
      } else if (r < 0.68) {
        await bonkBlock();
      } else if (r < 0.8) {
        mario.faceAngle(0);
        mario.state = 'wave';
        await sleep(1600);
        if (!busy) mario.state = 'idle';
      } else if (r < 0.9) {
        audio.jump();
        await mario.jump(rand(6, 7.5));
      } else {
        mario.lookTarget = luigiState.up ? null : new THREE.Vector3(PIPE.x, PIPE.height, PIPE.z);
        await sleep(1400);
        if (!busy) mario.lookTarget = null;
      }
    } catch (e) { console.warn(e); }
  }
}

async function marioToSpot() {
  const p = mario.position;
  const far = Math.hypot(p.x - STAGE.talkSpot.x, p.z - STAGE.talkSpot.z);
  if (far > 0.4) {
    const arrive = mario.walkTo(STAGE.talkSpot.x, STAGE.talkSpot.z, far > 1.2);
    await Promise.race([arrive, sleep(1600)]);
  }
  mario.faceAngle(0);
}

// ---------- reacting to the server ----------
let socket = null;
const performQueue = [];
let performing = false;

async function onThinking(msg) {
  if (performing) return; // still talking; the next answer comes straight after
  overlay.showQuestion(msg);
  busy = true;
  if (msg.character === 'luigi') {
    await luigiUp();
    luigi.state = 'think';
    overlay.showThinking(luigi);
    mario.lookTarget = luigi.headWorld();
  } else {
    mario.stop();
    await marioToSpot();
    mario.state = 'think';
    overlay.showThinking(mario);
  }
}

async function perform(msg) {
  busy = true;
  const speaker = msg.character === 'luigi' ? luigi : mario;
  if (msg.kind === 'question') overlay.showQuestion(msg);
  else overlay.hideQuestion();

  if (speaker === luigi) {
    await luigiUp();
    clearTimeout(luigiState.hideTimer);
    mario.state = 'idle';
    mario.lookTarget = luigi.headWorld();
  } else {
    mario.stop();
    if (msg.kind === 'gift' || msg.kind === 'like_goal') {
      mario.faceAngle(0);
      mario.state = 'celebrate';
      audio.sparkle();
      world.effects.stars(mario.headWorld());
      audio.jump();
      await mario.jump(8);
    } else {
      await marioToSpot();
    }
    if (luigiState.up) luigi.lookTarget = mario.headWorld();
    mario.lookTarget = camera.position;
  }

  speaker.lookTarget = camera.position;
  speaker.state = 'talk';
  overlay.startBubble(speaker, msg.text, msg.words);
  audio.duckMusic(true);

  const start = performance.now();
  const total = (msg.duration || 3) / (msg.playback_rate || 1);
  let captionTimer = setInterval(() => {
    const el = audio.current;
    if (el && msg.words?.length) overlay.updateCaption(el.currentTime, null);
    else if (el && el.duration) overlay.updateCaption(null, el.currentTime / el.duration);
    else overlay.updateCaption(null, (performance.now() - start) / 1000 / total);
  }, 50);

  if (audio.locked) { refreshUnlock(); await audio.ready(); refreshUnlock(); }
  if (msg.audio) await audio.playSpeech(msg.audio, msg.playback_rate || 1, msg.fx || {});
  else await audio.speakFallback(msg.text, msg.character);

  clearInterval(captionTimer);
  overlay.finishCaption();
  speaker.state = 'idle';
  audio.duckMusic(false);
  if (socket?.readyState === 1) socket.send(JSON.stringify({ type: 'done', id: msg.id }));

  await sleep(1300);
  if (!performQueue.length) {
    overlay.hideBubble();
    overlay.hideQuestion();
  }
  if (speaker === luigi) scheduleLuigiDown();
  speaker.lookTarget = null;
  mario.lookTarget = null;
  if (luigiState.up) luigi.lookTarget = null;
  if (mario.state === 'celebrate') mario.state = 'idle';
  busy = false;
}

async function runPerformQueue() {
  if (performing) return;
  performing = true;
  while (performQueue.length) {
    try { await perform(performQueue.shift()); } catch (e) { console.error(e); }
  }
  performing = false;
}

function handle(msg) {
  switch (msg.type) {
    case 'status':
      overlay.setStatus(msg);
      overlay.setQueue(msg.queue || 0, msg.vip_queue || 0);
      if (msg.goal) overlay.setLikes(msg.likes || 0, msg.goal);
      break;
    case 'thinking':
      onThinking(msg);
      break;
    case 'say':
      performQueue.push(msg);
      runPerformQueue();
      break;
    case 'gift':
      overlay.toast(`\u{1F381} ${msg.user} sent ${msg.count > 1 ? msg.count + 'x ' : ''}${msg.gift}!${msg.vip ? '  ⭐ VIP question unlocked' : ''}`, 'gift');
      world.effects.stars(mario.headWorld(), 10);
      audio.coin();
      break;
    case 'supporters':
      overlay.setSupporters(msg.top || []);
      break;
    case 'follow':
      overlay.toast(`➕ ${msg.user} followed!`, 'follow');
      break;
    case 'like':
      world.effects.hearts(Math.min(6, Math.ceil((msg.count || 1) / 3)));
      if (msg.goal) overlay.setLikes(msg.likes || 0, msg.goal);
      if (msg.goal_reached) { overlay.toast('\u{1F389} LIKE GOAL REACHED!', 'gift'); world.effects.stars(mario.headWorld(), 24); }
      break;
    case 'join':
      if (!busy && Math.random() < 0.15) { mario.faceAngle(0); mario.state = 'wave'; setTimeout(() => { if (!busy) mario.state = 'idle'; }, 1500); }
      break;
    default:
      break;
  }
}

function connect() {
  socket = new WebSocket(`ws://${location.host}/ws`);
  socket.onopen = () => { $('offline').hidden = true; };
  socket.onmessage = (e) => { try { handle(JSON.parse(e.data)); } catch (err) { console.error(err); } };
  socket.onclose = () => { $('offline').hidden = false; setTimeout(connect, 1500); };
}
connect();
wander();

// ---------- sound unlock & test panel ----------
function refreshUnlock() { $('unlock').hidden = !audio.locked; }
document.addEventListener('pointerdown', () => audio.unlock().then(refreshUnlock));
setTimeout(refreshUnlock, 800);

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'd' || e.key === 'D') $('debug').hidden = !$('debug').hidden;
});
$('debug-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('debug-input').value.trim();
  if (text && socket?.readyState === 1) socket.send(JSON.stringify({ type: 'ask', user: 'Tester', text }));
  $('debug-input').value = '';
});
setupVoiceLab((msg) => { performQueue.push(msg); runPerformQueue(); });
$('debug-hearts').onclick = () => handle({ type: 'like', count: 12 });
$('debug-gift').onclick = () => handle({ type: 'gift', user: 'Tester', gift: 'Rose', count: 1, vip: true });

// ---------- render loop ----------
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t = Math.min(1, tw.t + dt / tw.duration);
    tw.fn(tw.t);
    if (tw.t >= 1) { tweens.splice(i, 1); tw.resolve(); }
  }

  const level = audio.readLevel();
  mario.talkLevel = mario.state === 'talk' ? level : 0;
  luigi.talkLevel = luigi.state === 'talk' ? level : 0;
  if (mario.lookTarget && luigiState.up && mario.lookTarget !== camera.position) luigi.headWorld(mario.lookTarget);
  mario.update(dt);
  luigi.update(dt);
  world.update(dt, t);

  // Gentle handheld-style camera that leans toward whoever is talking.
  const talker = luigi.state === 'talk' || luigi.state === 'think' ? luigi : (busy ? mario : null);
  const fx = talker ? talker.position.x * 0.35 : Math.sin(t * 0.13) * 0.35;
  camFocus.x += (fx - camFocus.x) * (1 - Math.exp(-2 * dt));
  const zoom = talker ? 0.96 : 1;
  camFocus.z += (zoom - camFocus.z) * (1 - Math.exp(-1.5 * dt));
  camera.position.set(
    camBase.pos.x + camFocus.x + Math.sin(t * 0.21) * 0.15,
    camBase.look.y + (camBase.pos.y - camBase.look.y) * camFocus.z + Math.sin(t * 0.33) * 0.06,
    camBase.look.z + (camBase.pos.z - camBase.look.z) * (camFocus.z || 1),
  );
  camera.lookAt(camBase.look.x + camFocus.x * 0.8, camBase.look.y, camBase.look.z);

  overlay.place(camera, renderer);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
camFocus.z = 1;
frame();
$('loading').classList.add('hide');
