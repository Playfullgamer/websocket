// Voice Lab: tune how Mario and Luigi sound, hear it instantly, and save it.
// Open the test panel with D, then click "Voice Lab".
const SLIDERS = [
  // key, label, min, max, step, format
  ['pitch', 'Pitch (Hz)', -20, 80, 1, (v) => `${v >= 0 ? '+' : ''}${v}Hz`],
  ['rate', 'Talk speed (%)', -20, 40, 1, (v) => `${v >= 0 ? '+' : ''}${v}%`],
  ['playback_rate', 'Cartoon speed-up', 0.8, 1.4, 0.01, (v) => `${v.toFixed(2)}x`],
  ['bounce', 'Sing-song bounce', 0, 0.15, 0.005, (v) => v.toFixed(3)],
  ['bounce_speed', 'Bounce speed', 0.5, 5, 0.1, (v) => `${v.toFixed(1)}/s`],
  ['nasal', 'Nasal honk (dB)', -6, 15, 0.5, (v) => `${v}dB`],
  ['bright', 'Brightness (dB)', -6, 12, 0.5, (v) => `${v}dB`],
  ['wobble', 'Nervous wobble', 0, 0.08, 0.002, (v) => v.toFixed(3)],
];

const LINES = {
  mario: "It's-a me, Mario! Wahoo! Thanks for coming to the stream, let's-a go!",
  luigi: "H-hello everybody! It's-a me, Luigi! Mamma mia, I hope there's no ghosts in here!",
};

// Mono 16-bit WAV from decoded audio (what the voice clone engine reads).
function encodeWav(buffer) {
  const data = buffer.getChannelData(0), sr = buffer.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + data.length * 2));
  const str = (o, t) => { for (let i = 0; i < t.length; i++) out.setUint8(o + i, t.charCodeAt(i)); };
  str(0, 'RIFF'); out.setUint32(4, 36 + data.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
  out.setUint32(24, sr, true); out.setUint32(28, sr * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true);
  str(36, 'data'); out.setUint32(40, data.length * 2, true);
  for (let i = 0; i < data.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i])) * 32767, true);
  return new Blob([out], { type: 'audio/wav' });
}

const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  Object.assign(n, props);
  n.append(...kids);
  return n;
};

export function setupVoiceLab(play) {
  let settings = null;
  let voices = [];
  let character = 'mario';
  let clone = { status: 'off', characters: [], clips: [] };

  const panel = el('div', { id: 'voicelab', hidden: true });
  const status = el('div', { className: 'vl-status' });
  const tabs = el('div', { className: 'vl-tabs' });
  const voiceSel = el('select');
  const accent = el('input', { type: 'checkbox' });
  const text = el('input', { type: 'text', autocomplete: 'off' });
  const inputs = {};
  const rows = el('div', { className: 'vl-rows' });

  for (const name of ['mario', 'luigi']) {
    const b = el('button', { type: 'button', textContent: name === 'mario' ? 'Mario' : 'Luigi' });
    b.dataset.c = name;
    b.onclick = () => { character = name; render(); };
    tabs.append(b);
  }
  for (const [key, label, min, max, step, fmt] of SLIDERS) {
    const input = el('input', { type: 'range', min, max, step });
    const out = el('span', { className: 'vl-val' });
    input.oninput = () => { out.textContent = fmt(Number(input.value)); };
    inputs[key] = { input, out, fmt };
    rows.append(el('label', {}, el('span', { textContent: label }), input, out));
  }

  // Impression clip: record or upload ~10-20 seconds of someone doing the voice.
  const cloneInfo = el('div', { className: 'vl-clone-info' });
  const recBtn = el('button', { type: 'button', textContent: '\u23FA Record impression' });
  const fileIn = el('input', { type: 'file', accept: 'audio/*', hidden: true });
  const upBtn = el('button', { type: 'button', textContent: '\u{1F4C2} Upload clip' });
  const cloneBox = el('div', { className: 'vl-clone' },
    el('div', { className: 'vl-sub', textContent: 'Character voice from an impression' }),
    el('div', { className: 'vl-help', textContent: 'Record 10\u201320 seconds of you (or a friend, with their OK) doing the '
      + 'character\u2019s voice: talk in full sentences, with energy, no music. Mario & Luigi will then talk in that voice. '
      + 'Don\u2019t use clips of the real voice actors.' }),
    el('div', { className: 'vl-buttons' }, recBtn, upBtn, fileIn),
    cloneInfo);
  let recorder = null;

  const testBtn = el('button', { type: 'button', textContent: '▶ Test' });
  const saveBtn = el('button', { type: 'button', textContent: '\u{1F4BE} Save' });
  const closeBtn = el('button', { type: 'button', textContent: 'Close', className: 'vl-close' });
  panel.append(
    el('div', { className: 'vl-title', textContent: '\u{1F399}️ Voice Lab' }),
    tabs,
    cloneBox,
    el('div', { className: 'vl-sub', textContent: 'Built-in voice (used when there\u2019s no impression clip)' }),
    el('label', {}, el('span', { textContent: 'Base voice' }), voiceSel),
    rows,
    el('label', { className: 'vl-check' }, accent, el('span', { textContent: " Mario accent (it's-a, let's-a...)" })),
    text,
    el('div', { className: 'vl-buttons' }, testBtn, saveBtn, closeBtn),
    status,
  );
  document.body.append(panel);

  const opener = el('button', { type: 'button', textContent: '\u{1F399}️ Voice Lab' });
  document.getElementById('debug').insertBefore(opener, document.getElementById('debug').querySelector('small'));

  function read() {
    const s = { voice: voiceSel.value, accent: accent.checked };
    for (const [key] of SLIDERS) s[key] = Number(inputs[key].input.value);
    s.pitch = inputs.pitch.fmt(s.pitch);
    s.rate = inputs.rate.fmt(s.rate);
    return s;
  }

  function render() {
    for (const b of tabs.children) b.classList.toggle('on', b.dataset.c === character);
    const s = settings[character];
    voiceSel.replaceChildren(...[...new Set([s.voice, ...voices])].filter(Boolean).map((v) => el('option', { value: v, textContent: v })));
    voiceSel.value = s.voice;
    accent.checked = s.accent !== false;
    for (const [key] of SLIDERS) {
      let v = s[key] ?? 0;
      if (key === 'pitch' || key === 'rate') v = parseInt(String(v), 10) || 0;
      inputs[key].input.value = v;
      inputs[key].out.textContent = inputs[key].fmt(Number(v));
    }
    text.value = LINES[character];
    const name = character === 'mario' ? 'Mario' : 'Luigi';
    const hasClip = clone.clips.includes(character);
    if (clone.characters.includes(character)) cloneInfo.textContent = `\u2705 ${name} talks in the impression voice. Test plays it.`;
    else if (hasClip && clone.status === 'not installed') cloneInfo.textContent = 'Clip saved. Close the app and run START.bat again to install the voice clone engine.';
    else if (hasClip && clone.status === 'loading') cloneInfo.textContent = 'Clip saved. The voice clone engine is still loading...';
    else if (hasClip) cloneInfo.textContent = `Clip saved. Restart START.bat to switch ${name} to it.`;
    else cloneInfo.textContent = `No impression clip for ${name} yet.`;
  }

  async function uploadClip(blob) {
    const ctx = new AudioContext();
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    ctx.close();
    if (buf.duration < 6) { status.textContent = `That clip is only ${buf.duration.toFixed(1)}s. It needs at least 6 seconds (10\u201320 is best).`; return; }
    status.textContent = 'Saving clip...';
    const r = await fetch(`/api/voice-clip?character=${character}`, { method: 'POST', body: encodeWav(buf) }).then((x) => x.json());
    await load();
    status.textContent = r.live ? 'Clip saved and active! Press Test to hear it.' : 'Clip saved!';
  }

  recBtn.onclick = async () => {
    if (recorder) { recorder.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true } });
      const chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        recorder = null;
        recBtn.textContent = '\u23FA Record impression';
        uploadClip(new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' })).catch((e) => { status.textContent = 'Error: ' + e.message; });
      };
      recorder.start();
      recBtn.textContent = '\u23F9 Stop recording';
      status.textContent = 'Recording... do your best impression, then press Stop (10\u201320 seconds).';
      setTimeout(() => { if (recorder) recorder.stop(); }, 30000);
    } catch (e) { status.textContent = 'Microphone not available: ' + e.message; }
  };
  upBtn.onclick = () => fileIn.click();
  fileIn.onchange = () => {
    const f = fileIn.files[0];
    fileIn.value = '';
    if (f) uploadClip(f).catch((e) => { status.textContent = "Couldn't read that file: " + e.message; });
  };

  async function load() {
    status.textContent = 'Loading voices...';
    const r = await fetch('/api/voices').then((x) => x.json());
    settings = r.settings;
    voices = r.voices || [];
    clone = r.clone || clone;
    status.textContent = voices.length ? `${voices.length} voices available. Tweak, Test, then Save.` : 'Voice list unavailable (no internet?)';
    render();
  }

  opener.onclick = () => { panel.hidden = false; load().catch((e) => { status.textContent = 'Error: ' + e.message; }); };
  closeBtn.onclick = () => { panel.hidden = true; };

  testBtn.onclick = async () => {
    status.textContent = 'Making a test clip...';
    try {
      const r = await fetch('/api/voice-test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character, settings: read(), text: text.value, engine: clone.characters.includes(character) ? 'clone' : 'tts' }),
      }).then((x) => x.json());
      if (!r.audio) { status.textContent = "Couldn't make audio. Is the internet on?"; return; }
      status.textContent = 'Playing...';
      play({
        type: 'say', id: 'lab-' + Date.now(), kind: 'lab', character, text: r.text, words: r.words,
        duration: r.duration, audio: r.audio, playback_rate: r.fx.playback_rate, fx: r.fx,
      });
    } catch (e) { status.textContent = 'Error: ' + e.message; }
  };

  saveBtn.onclick = async () => {
    const r = await fetch('/api/voice-save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ character, settings: read() }),
    }).then((x) => x.json());
    settings[character] = r.settings;
    status.textContent = `Saved! ${character === 'mario' ? 'Mario' : 'Luigi'} will sound like this from now on.`;
  };
}
