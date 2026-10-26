"""Text to speech for Mario and Luigi.

Uses edge-tts (free, no account or key) with an Italian voice reading English.
On top of that:
  * the text gets a light Mario-style accent ("it's-a", "let's-a", ...) before it is spoken,
  * the page plays it faster with pitch preservation off (higher, bouncier voice),
    and runs it through a cartoon voice filter (nasal boost, brightness, sing-song
    bounce, Luigi's nervous wobble). All of it is tunable in the Voice Lab (press D).
If there's an impression clip in assets/voices (see clone_voice.py), that cloned voice is used
instead. If speech can't be made at all (no internet), the page falls back to the browser voice.
"""
import random
import re
import uuid
from collections import OrderedDict

try:
    import edge_tts
except ImportError:  # pragma: no cover - START.bat installs it
    edge_tts = None

# Settings the page uses for the cartoon voice filter.
FX_KEYS = ("playback_rate", "bounce", "bounce_speed", "nasal", "bright", "wobble")
FX_DEFAULTS = {"playback_rate": 1.0, "bounce": 0.0, "bounce_speed": 2.0, "nasal": 0, "bright": 0, "wobble": 0.0}

# Light accent: Mario and Luigi tack an "-a" onto some words. Only a couple per line so it stays clear.
_ACCENT_WORDS = re.compile(
    r"\b(it's|let's|I'm|that's|here's|what's|gonna|wanna|gotta|time|big|good|great|jump|go|win|fun|friend|pizza|"
    r"spaghetti|mushroom|star|run|race|play|eat|find|thank|love|like|help|check|look|stop|hop)\b(?![-'])",
    re.I,
)


def accentize(text, max_changes=2):
    changes = 0

    def repl(m):
        nonlocal changes
        word = m.group(1)
        if changes >= max_changes or random.random() < 0.45:
            return word
        changes += 1
        return word + "-a"

    return _ACCENT_WORDS.sub(repl, text)


NEUTRAL_FX = {"playback_rate": 1.0, "bounce": 0.0, "bounce_speed": 2.0, "nasal": 0.0, "bright": 0.0, "wobble": 0.0}


class Voice:
    def __init__(self, config, clone=None):
        self.voices = config["voices"]
        self.clone = clone  # CloneVoice: speaks in the voice from an impression clip, when there is one
        self.cache = OrderedDict()  # audio id -> mp3 bytes (only the latest few)
        self._broken_voices = set()
        self._voice_list = None

    def get_audio(self, audio_id):
        """Returns (bytes, mime type) or None."""
        return self.cache.get(audio_id)

    def _store(self, data, mime):
        audio_id = uuid.uuid4().hex
        self.cache[audio_id] = (data, mime)
        while len(self.cache) > 12:
            self.cache.popitem(last=False)
        return audio_id

    def uses_clone(self, character):
        return bool(self.clone and self.clone.has(character))

    def settings(self, character):
        return self.voices.get(character) or self.voices["mario"]

    def playback_rate(self, character):
        return self.fx(character)["playback_rate"]

    def fx(self, character, override=None):
        if self.uses_clone(character) and not override:
            return dict(NEUTRAL_FX, playback_rate=float(self.clone.cfg.get("playback_rate", 1.0)))
        cfg = dict(self.settings(character))
        cfg.update(override or {})
        return {k: float(cfg.get(k, FX_DEFAULTS[k])) for k in FX_KEYS}

    async def list_voices(self):
        """Male voices that can read English (Italian ones first), for the Voice Lab."""
        if self._voice_list is None:
            if edge_tts is None:
                return []
            voices = await edge_tts.list_voices()
            picked = [v["ShortName"] for v in voices if v.get("Gender") == "Male" and (
                v["ShortName"].startswith(("it-", "en-")) or "Multilingual" in v["ShortName"])]
            picked.sort(key=lambda n: (not n.startswith("it-"), "Multilingual" not in n, n))
            self._voice_list = picked
        return self._voice_list

    async def _synth(self, text, voice, pitch, rate):
        comm = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary="WordBoundary")
        audio = bytearray()
        words = []
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                audio.extend(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                words.append({
                    "t": chunk["offset"] / 1e7,
                    "d": chunk["duration"] / 1e7,
                    "w": chunk["text"],
                })
        if not audio:
            raise RuntimeError("no audio returned")
        return bytes(audio), words

    async def speak(self, character, text, override=None):
        """Returns (audio_id or None, words, duration_seconds)."""
        cfg = dict(self.settings(character))
        cfg.update(override or {})
        spoken = accentize(text) if cfg.get("accent", True) else text
        if self.uses_clone(character) and not override:
            made = await self.clone.speak(character, spoken)
            if made:
                data, duration = made
                return self._store(data, "audio/wav"), [], duration
        if edge_tts is None:
            return None, [], 0.0
        choices = [cfg.get("voice"), cfg.get("fallback_voice"), "en-US-GuyNeural"]
        if override and override.get("voice"):
            choices = [override["voice"]]
        for voice in [v for v in choices if v and (override or v not in self._broken_voices)]:
            try:
                audio, words = await self._synth(spoken, voice, cfg.get("pitch", "+0Hz"), cfg.get("rate", "+0%"))
            except Exception as exc:
                msg = str(exc).lower()
                if "cannot connect" in msg or "timeout" in msg or "name or service" in msg:
                    print(f"[voice] Can't reach the free voice service ({type(exc).__name__}). Is the internet on?")
                    break
                if not override and ("voice" in msg or "invalid" in msg or "no audio" in msg):
                    self._broken_voices.add(voice)
                print(f"[voice] {voice} failed ({exc}); trying the next voice")
                continue
            audio_id = self._store(audio, "audio/mpeg")
            duration = (words[-1]["t"] + words[-1]["d"]) if words else len(text.split()) * 0.38
            return audio_id, words, duration
        print("[voice] Couldn't make speech audio; the page will use the browser voice instead.")
        return None, [], 0.0
