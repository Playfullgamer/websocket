// ───────────────────────────── overlay, loop & Somtoday integration ─────────────────────────────
const view = { s: 1, ox: 0, oy: 0, dpr: 1 };
let overlay = null, isOpen = false, running = false, rafId = 0, lastTs = 0;

const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Escape', 'Backspace', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyQ', 'KeyM', 'KeyP', 'KeyZ', 'ShiftLeft', 'ShiftRight']);

function resize() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = window.innerWidth, ch = window.innerHeight;
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  view.dpr = dpr;
  view.s = Math.min(cw / W, ch / H);
  view.ox = (cw - W * view.s) / 2; view.oy = (ch - H * view.s) / 2;
}

function toGame(e) {
  input.mx = clamp((e.clientX - view.ox) / view.s, 0, W);
  input.my = clamp((e.clientY - view.oy) / view.s, 0, H);
}

const handlers = {
  keydown(e) {
    if (!isOpen) return;
    if (GAME_KEYS.has(e.code) || e.code.startsWith('Digit') || G.editName) { e.preventDefault(); }
    e.stopPropagation();
    if (!e.repeat) { input.keys.add(e.code); input.pressed.add(e.code); }
    if (G.editName && e.key.length === 1) input.typed.push(e.key);
  },
  keyup(e) { if (!isOpen) return; input.keys.delete(e.code); e.stopPropagation(); },
  mousemove(e) { toGame(e); input.moved = true; },
  mousedown(e) {
    toGame(e); Snd.init();
    if (e.button === 0) { input.mdown = true; input.click = true; }
    if (e.button === 2) input.rclick = true;
    e.preventDefault();
  },
  mouseup(e) { if (e.button === 0) input.mdown = false; },
  contextmenu(e) { e.preventDefault(); },
  blur() {
    input.keys.clear(); input.mdown = false;
    if (G.scene === 'play' && !G.paused && !G.cutscene && G.player && !G.player.dead) { G.paused = true; G.pauseSel = 0; Snd.duck(true); }
  },
  touchstart(e) { const t = e.touches[0]; if (t) { toGame(t); input.mdown = true; input.click = true; } Snd.init(); e.preventDefault(); },
  touchmove(e) { const t = e.touches[0]; if (t) toGame(t); e.preventDefault(); },
  touchend() { input.mdown = false; },
};

function frame(ts) {
  if (!running) return;
  rafId = requestAnimationFrame(frame);
  const rdt = Math.min(0.05, Math.max(0, (ts - lastTs) / 1000));
  lastTs = ts;
  try {
    update(rdt);
    render();
  } catch (err) {
    console.error('[SomQuest]', err);
  }
  input.pressed.clear(); input.click = false; input.rclick = false; input.typed.length = 0; input.moved = false;
}

function pageGlitch(done) {
  const el = document.documentElement;
  const prevFilter = el.style.filter, prevTransform = el.style.transform;
  const steps = [
    'hue-rotate(90deg) saturate(3)', 'invert(1)', 'hue-rotate(200deg) contrast(2)', 'saturate(0) brightness(1.6)', 'hue-rotate(320deg) saturate(4)', 'invert(1) hue-rotate(180deg)',
  ];
  let i = 0;
  const tick = () => {
    if (i >= steps.length) { el.style.filter = prevFilter; el.style.transform = prevTransform; done(); return; }
    el.style.filter = steps[i];
    el.style.transform = `translate(${rand(-12, 12)}px, ${rand(-6, 6)}px) skewX(${rand(-3, 3)}deg)`;
    i++;
    setTimeout(tick, 70);
  };
  tick();
}

function mount() {
  overlay = document.createElement('div');
  overlay.id = 'somquest-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#000;opacity:0;transition:opacity .35s ease;cursor:none;touch-action:none;';
  canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;';
  overlay.appendChild(canvas);
  document.body.appendChild(overlay);
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', handlers.keydown, true);
  window.addEventListener('keyup', handlers.keyup, true);
  window.addEventListener('blur', handlers.blur);
  overlay.addEventListener('mousemove', handlers.mousemove);
  overlay.addEventListener('mousedown', handlers.mousedown);
  window.addEventListener('mouseup', handlers.mouseup);
  overlay.addEventListener('contextmenu', handlers.contextmenu);
  overlay.addEventListener('touchstart', handlers.touchstart, { passive: false });
  overlay.addEventListener('touchmove', handlers.touchmove, { passive: false });
  overlay.addEventListener('touchend', handlers.touchend);
}

function unmount() {
  window.removeEventListener('resize', resize);
  window.removeEventListener('keydown', handlers.keydown, true);
  window.removeEventListener('keyup', handlers.keyup, true);
  window.removeEventListener('blur', handlers.blur);
  window.removeEventListener('mouseup', handlers.mouseup);
  const o = overlay;
  overlay = null;
  if (o) { o.style.opacity = '0'; setTimeout(() => o.remove(), 380); }
}

function openGame() {
  if (isOpen) return;
  isOpen = true;
  Save.load();
  Snd.init(); Snd.setMuted(Save.data.muted); Snd.resume();
  Snd.sfx.glitch();
  const btn = document.getElementById('somquest-launch');
  if (btn) btn.style.display = 'none';
  pageGlitch(() => {
    mount();
    input.keys.clear(); input.pressed.clear();
    G.scene = 'title'; G.menuSel = 0; G.theme = 'menu'; G.editName = false;
    resetFX(); flash('#ffffff', 0.8); glitch(0.4);
    requestAnimationFrame(() => { if (overlay) overlay.style.opacity = '1'; });
    running = true; lastTs = performance.now();
    rafId = requestAnimationFrame(frame);
  });
}

function closeGame() {
  if (!isOpen) return;
  isOpen = false; running = false;
  cancelAnimationFrame(rafId);
  Snd.stopMusic();
  setTimeout(() => Snd.suspend(), 600);
  Save.write();
  unmount();
  const btn = document.getElementById('somquest-launch');
  if (btn) btn.style.display = '';
  toast(pick([
    'PING: Kom snel terug — de cijfers verdedigen zichzelf niet! 🔔',
    'PING: Vergeet je echte huiswerk niet, hè. 🔔',
    'MENTOR.EXE: Goed bezig. Let op je inzet. 🖥️',
    'PING: De Onvoldoende slaapt nooit. Ik ook niet. 🔔',
  ]));
}

function toast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;right:18px;bottom:72px;z-index:2147483646;max-width:320px;padding:12px 16px;border-radius:12px;background:#0d1630;color:#eef4ff;font:600 14px/1.35 system-ui,"Segoe UI",Roboto,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35);border:1px solid #3aa0ff;opacity:0;transform:translateY(10px);transition:opacity .3s,transform .3s;';
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; setTimeout(() => t.remove(), 400); }, 4500);
}

function installButton() {
  if (!document.body || document.getElementById('somquest-launch')) return;
  const b = document.createElement('button');
  b.id = 'somquest-launch';
  b.type = 'button';
  b.textContent = '⚔️ SomQuest';
  b.title = 'Speel SomQuest — Het Laatste Rapport (Alt+Q)';
  b.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483646;padding:11px 18px;border:0;border-radius:999px;font:800 14px/1 system-ui,"Segoe UI",Roboto,sans-serif;color:#fff;background:linear-gradient(135deg,#1f7bff,#7a3cff);box-shadow:0 6px 22px rgba(31,123,255,.45),inset 0 1px 0 rgba(255,255,255,.35);cursor:pointer;letter-spacing:.3px;transition:transform .15s ease,box-shadow .15s ease;';
  b.addEventListener('mouseenter', () => { b.style.transform = 'translateY(-2px) scale(1.05)'; b.style.boxShadow = '0 10px 30px rgba(122,60,255,.6),inset 0 1px 0 rgba(255,255,255,.35)'; });
  b.addEventListener('mouseleave', () => { b.style.transform = ''; b.style.boxShadow = '0 6px 22px rgba(31,123,255,.45),inset 0 1px 0 rgba(255,255,255,.35)'; });
  b.addEventListener('click', openGame);
  document.body.appendChild(b);
  if (b.animate) b.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.35)' }, { filter: 'brightness(1)' }], { duration: 2400, iterations: Infinity });
}

// Alt+Q or the Konami code opens the game from anywhere on the page
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
let konamiIdx = 0;
function globalKeys(e) {
  if (isOpen) return;
  if (e.altKey && e.code === 'KeyQ') { e.preventDefault(); openGame(); return; }
  konamiIdx = e.code === KONAMI[konamiIdx] ? konamiIdx + 1 : e.code === KONAMI[0] ? 1 : 0;
  if (konamiIdx === KONAMI.length) { konamiIdx = 0; openGame(); }
}

function boot() {
  if (window.__somquestLoaded) return;
  window.__somquestLoaded = true;
  Save.load();
  installButton();
  setInterval(installButton, 2000); // Somtoday is a single-page app; re-add the button if a route change removes it
  window.addEventListener('keydown', globalKeys);
  window.SomQuest = {
    open: openGame,
    close: closeGame,
    _debug: {
      state: () => G,
      input: () => input,
      god: (on = true) => { G.debugGod = on; },
      chapter: i => { if (!isOpen) return; Save.data.story = null; newRun('story', 0); G.run.chapter = i; startChapter(i); },
      endless: () => newRun('endless'),
      jumpTo: type => { const r = G.run; const idx = r.steps.findIndex((s, i) => i > r.si && s.type === type); if (idx < 0) return; G.cutscene = G.dialog = G.card = G.upgrade = null; G.enemies.length = 0; G.eb.length = 0; G.lasers.length = 0; r.wave = null; r.si = idx - 1; nextStep(); },
      ending: () => { if (!G.run) newRun('story', 0); G.run.grades = { rooster: 8.4, huiswerk: 7.1, cijfers: 9.2, afwezig: 5.2, rapport: 6.8 }; startEnding(); },
    },
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
