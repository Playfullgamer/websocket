"""Text to speech for Mario and Luigi.

Uses edge-tts (free, no account or key) with an Italian voice reading English,
pitched up and sped up for a cartoon plumber sound. The page also plays the audio
slightly faster with pitch preservation off, which raises the pitch further.
If speech can't be made (no internet), the page falls back to the browser voice.
"""
import uuid
from collections import OrderedDict

try:
    import edge_tts
except ImportError:  # pragma: no cover - START.bat installs it
    edge_tts = None


class Voice:
    def __init__(self, config):
        self.voices = config["voices"]
        self.cache = OrderedDict()  # audio id -> mp3 bytes (only the latest few)
        self._broken_voices = set()

    def get_audio(self, audio_id):
        return self.cache.get(audio_id)

    def playback_rate(self, character):
        return float(self.voices.get(character, {}).get("playback_rate", 1.0))

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

    async def speak(self, character, text):
        """Returns (audio_id or None, words, duration_seconds)."""
        if edge_tts is None:
            return None, [], 0.0
        cfg = self.voices.get(character) or self.voices["mario"]
        choices = [cfg.get("voice"), cfg.get("fallback_voice"), "en-US-GuyNeural"]
        for voice in [v for v in choices if v and v not in self._broken_voices]:
            try:
                audio, words = await self._synth(text, voice, cfg.get("pitch", "+0Hz"), cfg.get("rate", "+0%"))
            except Exception as exc:
                msg = str(exc).lower()
                if "cannot connect" in msg or "timeout" in msg or "name or service" in msg:
                    print(f"[voice] Can't reach the free voice service ({type(exc).__name__}). Is the internet on?")
                    break
                if "voice" in msg or "invalid" in msg or "no audio" in msg:
                    self._broken_voices.add(voice)
                print(f"[voice] {voice} failed ({exc}); trying the next voice")
                continue
            audio_id = uuid.uuid4().hex
            self.cache[audio_id] = audio
            while len(self.cache) > 12:
                self.cache.popitem(last=False)
            duration = (words[-1]["t"] + words[-1]["d"]) if words else len(text.split()) * 0.38
            return audio_id, words, duration
        print("[voice] Couldn't make speech audio; the page will use the browser voice instead.")
        return None, [], 0.0
