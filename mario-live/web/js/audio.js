// Voice playback with live lip-sync levels, a browser-voice fallback,
// and little synthesized retro sound effects (no copyrighted sound files).
export class AudioSystem {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.18;
    this.sfxGain.connect(this.master);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.connect(this.master);
    this.buf = new Uint8Array(this.analyser.fftSize);
    this.level = 0;
    this.fakeLevel = 0;
    this.current = null;
  }

  get locked() { return this.ctx.state !== 'running'; }
  unlock() { return this.ctx.resume(); }
  // Browsers keep sound off until the page is clicked once (OBS and the START.bat window don't).
  async ready() {
    while (this.locked) {
      await this.ctx.resume().catch(() => {});
      if (!this.locked) break;
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  // 0..1 loudness of the voice right now, used to open the mouth.
  readLevel() {
    let raw = 0;
    if (this.current && !this.current.paused) {
      this.analyser.getByteTimeDomainData(this.buf);
      let sum = 0;
      for (let i = 0; i < this.buf.length; i++) { const v = (this.buf[i] - 128) / 128; sum += v * v; }
      raw = Math.min(1, Math.sqrt(sum / this.buf.length) * 5.5);
    }
    raw = Math.max(raw, this.fakeLevel);
    this.level += (raw - this.level) * (raw > this.level ? 0.6 : 0.25);
    return this.level;
  }

  playSpeech(url, rate = 1) {
    return new Promise((resolve) => {
      const el = new Audio();
      el.crossOrigin = 'anonymous';
      el.src = url;
      el.preservesPitch = false; // speeding up also raises the pitch: more cartoony
      el.mozPreservesPitch = false;
      el.webkitPreservesPitch = false;
      el.playbackRate = rate;
      const src = this.ctx.createMediaElementSource(el);
      src.connect(this.analyser);
      this.current = el;
      const done = () => {
        if (this.current === el) this.current = null;
        try { src.disconnect(); } catch (e) { /* already gone */ }
        resolve();
      };
      el.onended = done;
      el.onerror = done;
      el.play().catch((err) => { console.warn('audio play blocked', err); done(); });
    });
  }

  // Used only if the server couldn't make a voice clip (e.g. no internet).
  speakFallback(text, character) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) { setTimeout(resolve, text.split(' ').length * 350); return; }
      const u = new SpeechSynthesisUtterance(text);
      const voices = speechSynthesis.getVoices();
      u.voice = voices.find((v) => /it-IT/i.test(v.lang)) || voices.find((v) => /en/i.test(v.lang)) || null;
      u.pitch = character === 'luigi' ? 1.9 : 1.6;
      u.rate = 1.08;
      const t0 = performance.now();
      const pulse = setInterval(() => {
        const t = (performance.now() - t0) / 1000;
        this.fakeLevel = 0.35 + 0.35 * Math.abs(Math.sin(t * 11)) * Math.random();
      }, 60);
      let finished = false;
      const end = () => { if (finished) return; finished = true; clearInterval(pulse); this.fakeLevel = 0; resolve(); };
      u.onend = end; u.onerror = end;
      setTimeout(end, 3000 + text.split(' ').length * 450); // some browsers never fire onend
      speechSynthesis.speak(u);
    });
  }

  stopSpeech() {
    if (this.current) { this.current.pause(); this.current.dispatchEvent(new Event('ended')); }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  // ---------- retro sound effects ----------
  tone(freq, start, dur, type = 'square', vol = 1, slideTo = null) {
    const t = this.ctx.currentTime + start;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  coin() { this.tone(988, 0, 0.08); this.tone(1319, 0.08, 0.35); }
  jump() { this.tone(330, 0, 0.22, 'square', 0.7, 880); }
  bump() { this.tone(140, 0, 0.12, 'triangle', 1.2, 90); }
  pipe(up = true) {
    const notes = up ? [196, 247, 294, 392, 494, 587] : [587, 494, 392, 294, 247, 196];
    notes.forEach((f, i) => this.tone(f, i * 0.07, 0.09, 'square', 0.6));
  }
  sparkle() { [1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, i * 0.06, 0.25, 'triangle', 0.7)); }
  pop() { this.tone(600, 0, 0.08, 'sine', 0.8, 1200); }

  playMusic(url, volume = 0.12) {
    const el = new Audio(url);
    el.loop = true;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    this.ctx.createMediaElementSource(el).connect(g);
    g.connect(this.master);
    el.play().catch(() => {});
    this.music = el;
    this.musicGain = g;
  }

  duckMusic(on) {
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(on ? 0.04 : 0.12, this.ctx.currentTime, 0.2);
  }
}
