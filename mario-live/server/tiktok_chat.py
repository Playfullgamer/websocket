"""Reads your TikTok LIVE chat (comments, gifts, follows, likes, joins).

Uses the free TikTokLive library. It only reads public chat, so no login is needed.
If you aren't live yet it keeps retrying until you go live.
"""
import asyncio

try:
    from TikTokLive import TikTokLiveClient
    from TikTokLive.client.errors import UserOfflineError, UserNotFoundError
    from TikTokLive.client.web.web_settings import WebDefaults
    from TikTokLive.events import (
        CommentEvent, ConnectEvent, DisconnectEvent, FollowEvent, GiftEvent, JoinEvent, LikeEvent,
    )
except ImportError:  # pragma: no cover - START.bat installs it
    TikTokLiveClient = None


def _user_name(user):
    if user is None:
        return "friend"
    return getattr(user, "nickname", None) or getattr(user, "unique_id", None) or "friend"


class TikTokChat:
    def __init__(self, username, sign_api_key, on_event):
        self.username = (username or "").strip().lstrip("@")
        self.sign_api_key = sign_api_key
        self.on_event = on_event  # async callable(dict)
        self.status = "disabled" if not self.username else "connecting"

    async def _set_status(self, status):
        self.status = status
        await self.on_event({"type": "tiktok_status", "status": status})

    def _make_client(self):
        client = TikTokLiveClient(unique_id="@" + self.username)

        @client.on(ConnectEvent)
        async def _on_connect(event):
            print(f"[tiktok] Connected to @{self.username}'s LIVE chat!")
            await self._set_status("connected")

        @client.on(DisconnectEvent)
        async def _on_disconnect(event):
            await self._set_status("connecting")

        @client.on(CommentEvent)
        async def _on_comment(event):
            text = getattr(event, "content", None) or getattr(event, "comment", "")
            await self.on_event({"type": "comment", "user": _user_name(event.user), "text": text,
                                 "user_id": str(getattr(event.user, "id", "") or _user_name(event.user))})

        @client.on(GiftEvent)
        async def _on_gift(event):
            # Streakable gifts (like Roses) fire many times; only react when the streak ends.
            if getattr(event, "streaking", False):
                return
            gift_obj = getattr(event, "gift", None)
            gift = getattr(gift_obj, "name", None) or "gift"
            count = getattr(event, "repeat_count", 1) or 1
            diamonds = (getattr(gift_obj, "diamond_count", 1) or 1) * count
            await self.on_event({"type": "gift", "user": _user_name(event.user), "gift": gift, "count": count,
                                 "diamonds": diamonds,
                                 "user_id": str(getattr(event.user, "id", "") or _user_name(event.user))})

        @client.on(FollowEvent)
        async def _on_follow(event):
            await self.on_event({"type": "follow", "user": _user_name(getattr(event, "user", None))})

        @client.on(LikeEvent)
        async def _on_like(event):
            await self.on_event({"type": "like", "user": _user_name(getattr(event, "user", None)),
                                 "count": getattr(event, "count", 1) or 1})

        @client.on(JoinEvent)
        async def _on_join(event):
            await self.on_event({"type": "join", "user": _user_name(getattr(event, "user", None))})

        return client

    async def run(self):
        if not self.username:
            print("[tiktok] No TikTok username set, so chat is off. Type questions in this window to test.")
            return
        if TikTokLiveClient is None:
            print("[tiktok] TikTokLive isn't installed. Run START.bat again.")
            await self._set_status("error")
            return
        if self.sign_api_key:
            WebDefaults.tiktok_sign_api_key = self.sign_api_key

        delay = 10
        while True:
            await self._set_status("connecting")
            client = self._make_client()
            try:
                task = await client.start(fetch_live_check=True)
                delay = 10
                await task
                print("[tiktok] Chat connection ended, reconnecting...")
            except UserOfflineError:
                print(f"[tiktok] @{self.username} isn't live yet. Checking again in {delay}s... "
                      "(go live on TikTok and it will connect by itself)")
                await self._set_status("offline")
            except UserNotFoundError:
                print(f"[tiktok] TikTok user @{self.username} wasn't found. Fix tiktok_username in config.json.")
                await self._set_status("error")
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                print(f"[tiktok] Connection problem: {type(exc).__name__}: {exc}. Retrying in {delay}s...")
                await self._set_status("connecting")
            finally:
                try:
                    await client.disconnect()
                except Exception:
                    pass
            await asyncio.sleep(delay)
            delay = min(delay * 2, 60)
