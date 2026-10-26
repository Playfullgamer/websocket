"""Mario Live: TikTok chat -> AI Mario/Luigi -> voice -> 3D scene in your browser.

Started by START.bat, or by hand with:  python -m server
"""
import asyncio
import json
import os
import random
import re
import shutil
import subprocess
import sys
import threading
import time
import uuid
import webbrowser
from collections import deque

from aiohttp import WSMsgType, web

from .brain import Brain
from .config import ROOT, load_config, save_value
from .safety import Safety
from .tiktok_chat import TikTokChat
from .voice import Voice

WEB_DIR = ROOT / "web"
ASSETS_DIR = ROOT / "assets"

LUIGI_RE = re.compile(r"luig|weegee|l u i g i|green (guy|brother|bro)", re.I)
QUESTION_RE = re.compile(
    r"\?|^(who|what|when|where|why|how|which|can|could|do|does|did|is|are|will|would|should|have|has|tell|say)\b"
    r"|mario|luigi", re.I)

WELCOME_LINES = [
    "It's-a me, Mario! Welcome to the stream, everybody! Type a question in the chat and I'll answer it! "
    "And if you say Luigi, my brother will pop out of the pipe!",
]
IDLE_LINES = [
    "Hey everybody! Ask me anything in the chat! Wahoo!",
    "Mamma mia, it's quiet! Type a question and let's-a go!",
    "Psst! If you type Luigi in the chat, he comes out of that green pipe!",
    "Don't forget to follow and tap the screen for likes! Here we go!",
    "I wonder what Bowser is doing right now. Ask me anything, my friends!",
    "Okey-dokey! Who wants to ask Mario a question?",
]
VIP_IDLE_LINES = [
    "Psst! Send a Rose and your question jumps right to the front of the line! Wahoo!",
    "Want Mario to answer you first? Send a little gift, and you skip the line!",
]
GIFT_LINES = [
    "Wahoo! Thank-a you so much {user} for the {gift}! You're a superstar!",
    "Mamma mia! {user}, thank you for the {gift}! That's-a better than a Super Mushroom!",
    "Yahoo! Grazie {user} for the {gift}! Let's-a go!",
]
LIKE_GOAL_LINES = [
    "Wahoo! We hit the like goal! You're all superstars! Let's-a go to the next one!",
    "Mamma mia, look at all those likes! Thank-a you everybody! Here we go, next goal!",
]
VIP_HINT = "Send a Rose to skip the line!"
FOLLOW_LINES = [
    "Thank-a you for the follow, {user}! Welcome to the team!",
    "Wahoo! {user} just followed! Welcome, my friend!",
]


class Hub:
    """All open browser pages (usually one) connected over WebSocket."""

    def __init__(self):
        self.clients = set()
        self.has_clients = asyncio.Event()
        self._done = {}

    async def broadcast(self, msg):
        data = json.dumps(msg)
        for ws in list(self.clients):
            try:
                await ws.send_str(data)
            except Exception:
                self.clients.discard(ws)
        if not self.clients:
            self.has_clients.clear()

    def mark_done(self, item_id):
        ev = self._done.get(item_id)
        if ev:
            ev.set()

    async def wait_done(self, item_id, timeout):
        ev = self._done.setdefault(item_id, asyncio.Event())
        try:
            await asyncio.wait_for(ev.wait(), timeout)
        except asyncio.TimeoutError:
            pass
        finally:
            self._done.pop(item_id, None)


class Show:
    """Decides what Mario/Luigi say next and keeps everything in order."""

    def __init__(self, config, hub, brain, voice, safety):
        self.config = config
        self.hub = hub
        self.brain = brain
        self.voice = voice
        self.safety = safety
        self.questions = deque()
        self.shouts = deque()
        self.wakeup = asyncio.Event()
        self.last_user_time = {}
        self.last_activity = time.monotonic()
        self.tiktok_status = "disabled"
        self.priority_credits = {}  # user key -> [credits, expires_at]
        self.supporters = {}  # display name -> diamonds this stream
        self.likes = 0
        self.like_goal = int(config["like_goal"] or 0)

    # ---------- incoming ----------
    async def on_event(self, ev):
        kind = ev["type"]
        if kind == "tiktok_status":
            self.tiktok_status = ev["status"]
            await self.send_status()
        elif kind == "comment":
            await self.add_question(ev["user"], ev["text"], ev.get("user_id"))
        elif kind == "gift":
            user = self.safety.clean_name(ev["user"])
            gift = self.safety.tidy(ev.get("gift", "gift"), 30)
            vip = self.config["gift_priority"]
            if vip:
                self._give_priority(ev.get("user_id") or ev["user"], ev.get("count", 1))
            self.supporters[user] = self.supporters.get(user, 0) + int(ev.get("diamonds", 1) or 1)
            await self.hub.broadcast({"type": "gift", "user": user, "gift": gift, "count": ev.get("count", 1),
                                      "vip": vip})
            await self.send_supporters()
            if self.config["gift_shoutouts"] and sum(1 for s in self.shouts if s["kind"] == "gift") < 2:
                text = random.choice(GIFT_LINES).format(user=user, gift=gift)
                if vip:
                    text += " Your next question goes to the front of the line!"
                self.shouts.append({"kind": "gift", "character": "mario", "text": text})
                self.wakeup.set()
        elif kind == "follow":
            user = self.safety.clean_name(ev["user"])
            await self.hub.broadcast({"type": "follow", "user": user})
            if self.config["follow_shoutouts"] and not any(s["kind"] == "follow" for s in self.shouts):
                self.shouts.append({"kind": "follow", "character": "mario",
                                    "text": random.choice(FOLLOW_LINES).format(user=user)})
                self.wakeup.set()
        elif kind == "like":
            count = int(ev.get("count", 1) or 1)
            self.likes += count
            msg = {"type": "like", "count": min(count, 30), "likes": self.likes, "goal": self.like_goal}
            if self.like_goal and self.likes >= self.like_goal:
                msg["goal_reached"] = True
                self.like_goal += int(self.config["like_goal"])
                msg["goal"] = self.like_goal
                if not any(s["kind"] == "like_goal" for s in self.shouts):
                    self.shouts.append({"kind": "like_goal", "character": "mario",
                                        "text": random.choice(LIKE_GOAL_LINES)})
                    self.wakeup.set()
            await self.hub.broadcast(msg)
        elif kind == "join":
            await self.hub.broadcast({"type": "join", "user": self.safety.clean_name(ev["user"])})

    def _give_priority(self, key, count):
        """A gift lets the gifter's question skip the line (their queued one, or their next one)."""
        for q in self.questions:
            if q.get("key") == key and not q.get("vip"):
                self.questions.remove(q)
                q["vip"] = True
                self._insert_vip(q)
                print(f"[vip] {q['user']}'s question moved to the front!")
                return
        credits, _ = self.priority_credits.get(key, [0, 0])
        expires = time.monotonic() + 60 * float(self.config["priority_minutes"])
        self.priority_credits[key] = [min(credits + max(1, int(count)), 5), expires]

    def _take_priority(self, key):
        entry = self.priority_credits.get(key)
        if not entry:
            return False
        if entry[1] < time.monotonic():
            self.priority_credits.pop(key, None)
            return False
        entry[0] -= 1
        if entry[0] <= 0:
            self.priority_credits.pop(key, None)
        return True

    def _insert_vip(self, q):
        # After any VIP questions already waiting, ahead of everyone else.
        idx = 0
        while idx < len(self.questions) and self.questions[idx].get("vip"):
            idx += 1
        self.questions.insert(idx, q)

    async def send_supporters(self):
        top = sorted(self.supporters.items(), key=lambda kv: kv[1], reverse=True)[:3]
        await self.hub.broadcast({"type": "supporters", "top": [{"user": u, "diamonds": d} for u, d in top]})

    async def add_question(self, user, text, user_id=None, bypass_cooldown=False):
        text = self.safety.clean_question(text)
        if not text:
            return
        mode = self.config["answer_mode"]
        if mode == "questions" and not QUESTION_RE.search(text):
            return
        if mode == "command":
            m = re.match(r"^!(ask|mario|luigi)\s*(.*)", text, re.I)
            if not m:
                return
            text = (m.group(2) or "").strip() or "hello"
            if m.group(1).lower() == "luigi" and not LUIGI_RE.search(text):
                text = "Luigi, " + text
        key = user_id or user
        now = time.monotonic()
        vip = self.config["gift_priority"] and self._take_priority(key)
        if not (vip or bypass_cooldown) and now - self.last_user_time.get(key, -1e9) < self.config["per_user_cooldown_seconds"]:
            return
        self.last_user_time[key] = now
        name = self.safety.clean_name(user)
        character = "luigi" if LUIGI_RE.search(text) else "mario"
        q = {"kind": "question", "character": character, "user": name, "question": text, "key": key, "vip": vip}
        if vip:
            self._insert_vip(q)
        else:
            self.questions.append(q)
        while len(self.questions) > self.config["max_queue"]:
            # Chat moves fast: drop the oldest regular question, never a gifter's.
            regular = [x for x in self.questions if not x.get("vip")]
            self.questions.remove(regular[0] if regular else self.questions[-1])
        print(f"[chat] {'[VIP] ' if vip else ''}{name}: {text}  -> {character.title()}")
        self.wakeup.set()
        await self.send_status()

    async def send_status(self):
        await self.hub.broadcast({
            "type": "status",
            "ai": self.brain.status,
            "tiktok": self.tiktok_status,
            "queue": len(self.questions),
            "vip_queue": sum(1 for q in self.questions if q.get("vip")),
            "vip_enabled": bool(self.config["gift_priority"]),
            "likes": self.likes,
            "goal": self.like_goal,
        })

    # ---------- outgoing ----------
    def _pop_raw(self):
        if self.shouts:
            return self.shouts.popleft()
        if self.questions:
            return self.questions.popleft()
        return None

    async def _next_raw(self):
        while True:
            raw = self._pop_raw()
            if raw:
                return raw
            self.wakeup.clear()
            idle = self.config["idle_chatter_seconds"]
            wait = max(1.0, idle - (time.monotonic() - self.last_activity)) if idle else None
            try:
                await asyncio.wait_for(self.wakeup.wait(), wait)
            except asyncio.TimeoutError:
                lines = IDLE_LINES + (VIP_IDLE_LINES if self.config["gift_priority"] else [])
                return {"kind": "idle", "character": "mario", "text": random.choice(lines)}

    async def _prepare(self, raw):
        item = dict(raw)
        item.pop("key", None)
        item["id"] = uuid.uuid4().hex
        item["type"] = "say"
        character = item["character"]
        started = time.monotonic()
        if raw["kind"] == "question":
            item["text"] = await self.brain.answer(character, raw["user"], raw["question"])
        audio_id, words, duration = await self.voice.speak(character, item["text"])
        item["audio"] = f"/audio/{audio_id}.mp3" if audio_id else None
        item["words"] = words
        item["duration"] = duration or max(2.5, len(item["text"].split()) * 0.4)
        item["playback_rate"] = self.voice.playback_rate(character)
        if raw["kind"] == "question":
            print(f"[{character}] ({time.monotonic() - started:.1f}s) {item['text']}")
        return item

    async def run(self):
        self.shouts.append({"kind": "welcome", "character": "mario", "text": WELCOME_LINES[0]})
        pending = None
        while True:
            if pending is None:
                raw = await self._next_raw()
                if raw["kind"] == "question":
                    await self.hub.broadcast({"type": "thinking", "character": raw["character"],
                                              "user": raw["user"], "question": raw["question"],
                                              "vip": raw.get("vip", False)})
                pending = asyncio.create_task(self._prepare(raw))
            try:
                item = await pending
            except Exception as exc:
                print(f"[show] Something went wrong preparing an answer: {exc}")
                pending = None
                continue
            pending = None

            if not self.hub.clients:
                print("[show] Waiting for the Mario page to be open...")
                await self.hub.has_clients.wait()
                await asyncio.sleep(1.5)

            await self.hub.broadcast(item)
            await self.send_status()
            # Get the next answer ready while this one is being spoken, so there's no dead air.
            nxt = self._pop_raw()
            if nxt:
                pending = asyncio.create_task(self._prepare(nxt))
            spoken = item["duration"] / max(item["playback_rate"], 0.5)
            await self.hub.wait_done(item["id"], timeout=spoken + 8)
            self.last_activity = time.monotonic()
            await asyncio.sleep(0.8)


def find_browser():
    names = ["msedge", "chrome", "google-chrome", "chromium", "chromium-browser"]
    for n in names:
        p = shutil.which(n)
        if p:
            return p
    env = os.environ
    for base in (env.get("PROGRAMFILES(X86)"), env.get("PROGRAMFILES"), env.get("LOCALAPPDATA")):
        if not base:
            continue
        for rel in (r"Microsoft\Edge\Application\msedge.exe", r"Google\Chrome\Application\chrome.exe"):
            p = os.path.join(base, rel)
            if os.path.exists(p):
                return p
    return None


def open_page(config):
    url = f"http://localhost:{config['port']}/"
    browser = find_browser()
    if browser:
        # Its own app window with autoplay allowed, so Mario's voice plays without clicking.
        profile = ROOT / ".browser-profile"
        try:
            subprocess.Popen([
                browser, f"--app={url}", f"--user-data-dir={profile}",
                "--autoplay-policy=no-user-gesture-required",
                f"--window-size={config['window_width']},{config['window_height']}",
                "--no-first-run", "--no-default-browser-check",
            ])
            return
        except OSError:
            pass
    webbrowser.open(url)


def console_input(loop, show):
    """Lets the streamer type test questions straight into the black window."""
    while True:
        try:
            line = input()
        except (EOFError, KeyboardInterrupt):
            return
        line = line.strip()
        if line:
            asyncio.run_coroutine_threadsafe(
                show.add_question("Streamer", line, user_id="__console__", bypass_cooldown=True), loop)


def build_app(config, hub, show, voice):
    app = web.Application()

    async def index(request):
        return web.FileResponse(WEB_DIR / "index.html", headers={"Cache-Control": "no-cache"})

    async def page_config(request):
        def has(name):
            return (ASSETS_DIR / name).exists()
        return web.json_response({
            "assets": {
                "mario": "/assets/mario.glb" if has("mario.glb") else None,
                "luigi": "/assets/luigi.glb" if has("luigi.glb") else None,
                "scene": "/assets/scene.glb" if has("scene.glb") else None,
                "music": "/assets/music.mp3" if has("music.mp3") else None,
            },
            "tiktok_username": config["tiktok_username"],
            "vip_enabled": bool(config["gift_priority"]),
            "vip_hint": VIP_HINT,
            "like_goal": int(config["like_goal"] or 0),
        })

    async def audio(request):
        data = voice.get_audio(request.match_info["audio_id"])
        if data is None:
            raise web.HTTPNotFound()
        return web.Response(body=data, content_type="audio/mpeg")

    async def ws_handler(request):
        ws = web.WebSocketResponse(heartbeat=20)
        await ws.prepare(request)
        hub.clients.add(ws)
        hub.has_clients.set()
        print("[page] Mario page connected")
        await show.send_status()
        await show.send_supporters()
        try:
            async for msg in ws:
                if msg.type != WSMsgType.TEXT:
                    continue
                try:
                    data = json.loads(msg.data)
                except json.JSONDecodeError:
                    continue
                if data.get("type") == "done":
                    hub.mark_done(data.get("id"))
                elif data.get("type") == "ask":
                    await show.add_question(data.get("user") or "Tester", data.get("text", ""),
                                            user_id="__page__", bypass_cooldown=True)
        finally:
            hub.clients.discard(ws)
            if not hub.clients:
                hub.has_clients.clear()
        return ws

    app.router.add_get("/", index)
    app.router.add_get("/ws", ws_handler)
    app.router.add_get("/api/config", page_config)
    app.router.add_get("/audio/{audio_id}.mp3", audio)
    app.router.add_static("/static/", WEB_DIR)
    ASSETS_DIR.mkdir(exist_ok=True)
    app.router.add_static("/assets/", ASSETS_DIR)
    return app


async def main():
    config = load_config()
    if not config["tiktok_username"] and sys.stdin and sys.stdin.isatty():
        print()
        name = input("Type your TikTok username (or just press Enter to test without TikTok): ").strip().lstrip("@")
        if name:
            config["tiktok_username"] = name
            save_value("tiktok_username", name)
            print(f"Saved! (change it any time in config.json)")

    safety = Safety(config["blocked_words"])
    hub = Hub()
    brain = Brain(config, safety)
    voice = Voice(config)
    show = Show(config, hub, brain, voice, safety)
    chat = TikTokChat(config["tiktok_username"], config["tiktok_sign_api_key"], show.on_event)
    show.tiktok_status = chat.status

    app = build_app(config, hub, show, voice)
    runner = web.AppRunner(app, access_log=None)
    await runner.setup()
    try:
        await web.TCPSite(runner, "127.0.0.1", config["port"]).start()
    except OSError:
        print(f"\nPort {config['port']} is already in use. Is Mario Live already running in another window?")
        print("Close it, or change \"port\" in config.json.")
        return

    url = f"http://localhost:{config['port']}/"
    print()
    print("=" * 60)
    print(f"  Mario Live is running at {url}")
    print("  Add that window to TikTok LIVE Studio (Window Capture)")
    print("  or OBS (Browser Source, 1080x1920).")
    print("  Type a question here and press Enter to test.")
    print("=" * 60)
    print()
    if config["open_browser"]:
        open_page(config)

    loop = asyncio.get_running_loop()
    if sys.stdin and sys.stdin.isatty():
        threading.Thread(target=console_input, args=(loop, show), daemon=True).start()

    async def ai_setup():
        await brain.ensure_ready()
        await show.send_status()

    await asyncio.gather(ai_setup(), chat.run(), show.run())


if __name__ == "__main__":
    if sys.platform == "win32":
        os.system("")  # enables colours/\r handling in old consoles
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
