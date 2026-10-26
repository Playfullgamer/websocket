"""Optional voice cloning: makes Mario/Luigi speak in the voice from a short impression clip.

Put a 10-20 second recording of someone doing the impression (you, or a friend who's OK
with it - not clips of the real voice actors) in assets/voices/mario.wav and/or luigi.wav,
or record one in the Voice Lab. START.bat then installs Chatterbox (free, MIT licensed,
weights from Hugging Face) and every line is spoken in that voice.

Runs best on an NVIDIA graphics card. Without one it uses the faster "Turbo" model on the CPU.
"""
import asyncio
import io
import wave
from pathlib import Path

from .config import ROOT

VOICES_DIR = ROOT / "assets" / "voices"
EXTS = (".wav", ".flac", ".mp3", ".ogg")


def find_refs():
    refs = {}
    for character in ("mario", "luigi"):
        for ext in EXTS:
            p = VOICES_DIR / f"{character}{ext}"
            if p.exists():
                refs[character] = p
                break
    return refs


def _to_wav_bytes(samples, sr):
    import numpy as np

    pcm = (np.clip(samples, -1.0, 1.0) * 32767).astype("<i2")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())
    return buf.getvalue()


class CloneVoice:
    def __init__(self, config):
        self.cfg = config["clone"]
        self.model = None
        self.kind = None
        self.conds = {}
        self.status = "off"
        self._lock = asyncio.Lock()

    def has(self, character):
        return character in self.conds

    async def load(self):
        refs = find_refs()
        if not refs or not self.cfg.get("enabled", True):
            return False
        try:
            import torch  # noqa: F401
            import chatterbox  # noqa: F401
        except ImportError:
            print("[clone] Impression clips found, but the voice clone engine isn't installed yet. "
                  "Close this window and run START.bat again to install it.")
            self.status = "not installed"
            return False
        self.status = "loading"
        print("[clone] Loading the voice clone engine (first time downloads ~1-3 GB from Hugging Face)...")
        try:
            await asyncio.to_thread(self._load_model)
            async with self._lock:
                for character, path in refs.items():
                    await asyncio.to_thread(self._prepare, character, path)
        except Exception as exc:
            self.status = "error"
            print(f"[clone] Couldn't start voice cloning ({type(exc).__name__}: {exc}). Using the normal voices.")
            return False
        self.status = "ready"
        print(f"[clone] Voice cloning ready ({self.kind}) for: {', '.join(c.title() for c in self.conds)}")
        return True

    def _load_model(self):
        import torch

        device = "cuda" if torch.cuda.is_available() else "cpu"
        want = self.cfg.get("model", "auto")
        if want == "turbo" or (want == "auto" and device == "cpu"):
            from chatterbox.tts_turbo import ChatterboxTurboTTS as Model
            self.kind = f"turbo on {device}"
        else:
            from chatterbox.tts import ChatterboxTTS as Model
            self.kind = f"standard on {device}"
        self.model = Model.from_pretrained(device=device)

    def _prepare(self, character, path):
        """Analyse an impression clip once, so every line after that is fast."""
        kwargs = {}
        if "standard" in (self.kind or ""):
            kwargs["exaggeration"] = float(self.cfg.get("exaggeration", 0.6))
        self.model.prepare_conditionals(str(path), **kwargs)
        self.conds[character] = self.model.conds

    async def reload(self, character):
        refs = find_refs()
        if self.model is None or character not in refs:
            return False
        async with self._lock:
            await asyncio.to_thread(self._prepare, character, refs[character])
        print(f"[clone] Updated {character.title()}'s impression clip.")
        return True

    def _generate(self, character, text):
        self.model.conds = self.conds[character]
        kwargs = {"temperature": float(self.cfg.get("temperature", 0.8))}
        if "standard" in self.kind:
            kwargs["cfg_weight"] = float(self.cfg.get("cfg_weight", 0.4))
            kwargs["exaggeration"] = float(self.cfg.get("exaggeration", 0.6))
        wav = self.model.generate(text, **kwargs)
        samples = wav.squeeze(0).cpu().numpy()
        sr = self.model.sr
        return _to_wav_bytes(samples, sr), len(samples) / sr

    async def speak(self, character, text):
        """Returns (wav_bytes, duration) or None."""
        if character not in self.conds:
            return None
        async with self._lock:
            try:
                return await asyncio.to_thread(self._generate, character, text)
            except Exception as exc:
                print(f"[clone] Couldn't make {character}'s line ({exc}); using the normal voice.")
                return None
