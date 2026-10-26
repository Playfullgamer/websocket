"""Loads config.json (next to START.bat) and fills in defaults."""
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / "config.json"

DEFAULTS = {
    "tiktok_username": "",
    "tiktok_sign_api_key": "",
    "port": 8765,
    "open_browser": True,
    "window_width": 540,
    "window_height": 960,
    "ai_model": "hf.co/bartowski/Llama-3.2-3B-Instruct-GGUF:Q4_K_M",
    "ai_max_words": 45,
    "ai_temperature": 0.8,
    "answer_mode": "all",
    "per_user_cooldown_seconds": 15,
    "max_queue": 8,
    "idle_chatter_seconds": 45,
    "gift_shoutouts": True,
    "follow_shoutouts": True,
    "gift_priority": True,
    "priority_minutes": 10,
    "like_goal": 1000,
    "blocked_words": [],
    "clone": {
        "enabled": True,
        "model": "auto",
        "exaggeration": 0.6,
        "cfg_weight": 0.4,
        "temperature": 0.8,
        "playback_rate": 1.0,
    },
    "voices": {
        "mario": {
            "voice": "it-IT-GiuseppeMultilingualNeural",
            "fallback_voice": "it-IT-DiegoNeural",
            "pitch": "+25Hz",
            "rate": "+10%",
            "playback_rate": 1.1,
            "accent": True,
            "bounce": 0.05,
            "bounce_speed": 2.4,
            "nasal": 7,
            "bright": 5,
            "wobble": 0.0,
        },
        "luigi": {
            "voice": "it-IT-GiuseppeMultilingualNeural",
            "fallback_voice": "it-IT-DiegoNeural",
            "pitch": "+40Hz",
            "rate": "+2%",
            "playback_rate": 1.13,
            "accent": True,
            "bounce": 0.04,
            "bounce_speed": 2.0,
            "nasal": 9,
            "bright": 4,
            "wobble": 0.035,
        },
    },
}


def _merge(base, override):
    out = copy.deepcopy(base)
    for key, value in (override or {}).items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _merge(out[key], value)
        else:
            out[key] = value
    return out


def load_config():
    data = {}
    if CONFIG_PATH.exists():
        try:
            data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            print(f"[config] config.json is not valid JSON ({exc}); using defaults.")
    return _merge(DEFAULTS, data)


def save_value(key, value):
    """Update a single top-level key in config.json, keeping everything else."""
    data = {}
    if CONFIG_PATH.exists():
        try:
            data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            data = {}
    data[key] = value
    CONFIG_PATH.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
