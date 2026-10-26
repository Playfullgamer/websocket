// On-screen stream graphics: title, question card, speech bubble with live captions,
// queue counter, gift toasts, top supporters, like goal, and a hidden test panel (press D).
// Chat text is always inserted with textContent, never as HTML.
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);

export class Overlay {
  constructor() {
    this.bubble = $('bubble');
    this.bubbleName = $('bubble-name');
    this.bubbleText = $('bubble-text');
    this.card = $('question');
    this.speaker = null;
    this.tokens = [];
    this.words = [];
    this.revealed = 0;
    this.thinking = false;
    this.v = new THREE.Vector3();
  }

  setupHints(cfg) {
    if (cfg.vip_enabled) {
      $('vip-hint').textContent = '\u{1F339} ' + (cfg.vip_hint || 'Send a Rose to skip the line!');
      $('vip-hint').hidden = false;
    }
    if (cfg.like_goal) { $('likegoal').hidden = false; this.setLikes(0, cfg.like_goal); }
  }

  showQuestion(msg) {
    $('q-user').textContent = '@' + (msg.user || 'friend');
    $('q-text').textContent = msg.question || '';
    $('q-to').textContent = msg.character === 'luigi' ? 'asks Luigi' : 'asks Mario';
    this.card.classList.toggle('vip', !!msg.vip);
    $('q-vip').hidden = !msg.vip;
    this.card.classList.add('show');
  }
  hideQuestion() { this.card.classList.remove('show'); }

  showThinking(speaker) {
    this.speaker = speaker;
    this.thinking = true;
    this.bubbleName.textContent = speaker.name === 'luigi' ? 'LUIGI' : 'MARIO';
    this.bubble.classList.toggle('luigi', speaker.name === 'luigi');
    this.bubbleText.textContent = '';
    this.bubble.classList.add('show', 'thinking');
  }

  startBubble(speaker, text, words) {
    this.speaker = speaker;
    this.thinking = false;
    this.bubble.classList.remove('thinking');
    this.bubble.classList.toggle('luigi', speaker.name === 'luigi');
    this.bubbleName.textContent = speaker.name === 'luigi' ? 'LUIGI' : 'MARIO';
    this.tokens = text.split(/\s+/).filter(Boolean);
    this.words = words || [];
    this.revealed = 0;
    this.bubbleText.textContent = '';
    this.bubble.classList.add('show');
  }

  // progress: media time in seconds (with word timings) or a 0..1 fraction (without).
  updateCaption(time, fraction) {
    if (!this.tokens.length) return;
    let n;
    if (this.words.length && time != null) {
      let passed = 0;
      while (passed < this.words.length && this.words[passed].t <= time + 0.05) passed++;
      n = Math.round((passed / this.words.length) * this.tokens.length);
    } else {
      n = Math.ceil(fraction * this.tokens.length);
    }
    n = Math.min(this.tokens.length, Math.max(n, this.revealed));
    if (n !== this.revealed) {
      this.revealed = n;
      this.bubbleText.textContent = this.tokens.slice(0, n).join(' ');
    }
  }

  finishCaption() {
    this.revealed = this.tokens.length;
    this.bubbleText.textContent = this.tokens.join(' ');
  }

  hideBubble() { this.bubble.classList.remove('show', 'thinking'); this.speaker = null; }

  // Keep the bubble floating above the speaker's head.
  place(camera, renderer) {
    if (!this.speaker || !this.bubble.classList.contains('show')) return;
    this.speaker.headWorld(this.v).project(camera);
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    const bw = this.bubble.offsetWidth, bh = this.bubble.offsetHeight;
    let x = (this.v.x * 0.5 + 0.5) * w - bw / 2;
    let y = (-this.v.y * 0.5 + 0.5) * h - bh - 18;
    const m = 12;
    x = Math.max(m, Math.min(w - bw - m, x));
    // Stay below the question card if it would cover the bubble.
    let topLimit = m;
    if (this.card.classList.contains('show')) {
      const r = this.card.getBoundingClientRect();
      if (x < r.right && x + bw > r.left) topLimit = r.bottom + 8;
    }
    y = Math.max(topLimit, Math.min(h - bh - m, y));
    this.bubble.style.transform = `translate(${x}px, ${y}px)`;
    const tail = (this.v.x * 0.5 + 0.5) * w - x;
    this.bubble.style.setProperty('--tail', `${Math.max(24, Math.min(bw - 24, tail))}px`);
  }

  setQueue(n, vip) {
    $('queue').textContent = n > 0 ? `${n} question${n === 1 ? '' : 's'} in line${vip ? ` • ${vip} VIP` : ''}` : 'Ask Mario anything!';
  }

  setLikes(likes, goal) {
    if (!goal) return;
    const pct = Math.max(0, Math.min(100, (likes / goal) * 100));
    $('likegoal-fill').style.width = pct + '%';
    $('likegoal-text').textContent = `❤️ Like goal  ${likes.toLocaleString()} / ${goal.toLocaleString()}`;
  }

  setSupporters(top) {
    const box = $('supporters');
    const list = $('supporters-list');
    list.replaceChildren();
    top.forEach((s, i) => {
      const li = document.createElement('li');
      const medal = document.createElement('span');
      medal.textContent = ['\u{1F947}', '\u{1F948}', '\u{1F949}'][i] || '⭐';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = s.user;
      const val = document.createElement('span');
      val.className = 'val';
      val.textContent = `${s.diamonds}\u{1F48E}`;
      li.append(medal, name, val);
      list.append(li);
    });
    box.hidden = top.length === 0;
  }

  toast(text, kind = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    $('toasts').append(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 500); }, 4200);
    while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
  }

  setStatus(s) {
    const txt = `AI: ${s.ai || '?'}  •  TikTok: ${s.tiktok || '?'}  •  queue: ${s.queue ?? 0}`;
    $('debug-status').textContent = txt;
    const warn = $('ai-warn');
    if (s.ai === 'downloading') { warn.textContent = 'Downloading Mario\'s brain (first run only)...'; warn.hidden = false; }
    else if (s.ai === 'loading' || s.ai === 'starting') { warn.textContent = 'Mario is waking up...'; warn.hidden = false; }
    else warn.hidden = true;
  }
}
