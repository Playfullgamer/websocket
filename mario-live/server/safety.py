"""Keeps the stream family friendly.

Chat messages that hit the blocklist are skipped entirely (never read out),
and AI answers that hit it are swapped for a harmless line. Add your own words
under "blocked_words" in config.json.
"""
import random
import re

# Stems match at the start of a word, so "fuck" also catches "fucking".
# A trailing "=" means whole word only, so "meth=" doesn't block "method".
_BASE_BLOCKLIST = [
    "fuck", "shit", "bitch", "cunt", "dick=", "dicks=", "cock=", "cocks=", "pussy", "asshole",
    "bastard", "slut", "whore", "porn", "sex", "nude", "naked", "boob", "tits=", "penis",
    "vagina", "horny", "cum=", "cumming", "jizz", "dildo", "blowjob", "handjob", "milf",
    "onlyfans", "rape", "raping", "molest", "pedo=", "pedophile", "nazi", "hitler", "kkk",
    "nigg", "fag", "retard", "tranny", "chink", "spic=", "kike", "wetback", "gook=", "coon=",
    "suicide", "kys=", "kill yourself", "self harm", "cocaine", "meth=", "heroin",
]

_LEET = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i"})
_URL_RE = re.compile(r"(https?://\S+|www\.\S+|\S+\.(com|net|org|gg|ly|io|tv)\S*)", re.I)
_SPACE_RE = re.compile(r"\s+")
# Emoji and other pictographs: they look odd in subtitles and TTS reads them out loud.
_EMOJI_RE = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF‍️]+"
)

SAFE_ANSWERS = {
    "mario": [
        "Mamma mia, let's-a talk about something more fun! Ask me about mushrooms, kart racing, or saving the princess!",
        "Whoa, that one's-a too spicy for me! Ask me something else, my friend!",
        "Hmm, I'm-a gonna jump right over that question! Wahoo! Try another one!",
    ],
    "luigi": [
        "M-mamma mia, that question makes-a me nervous! Ask me something nicer, okay?",
        "Uh, Luigi is gonna pretend he didn't hear that! Ask me about ghosts, maybe! Actually, no, not ghosts!",
    ],
}


class Safety:
    def __init__(self, extra_words=None):
        words = list(_BASE_BLOCKLIST) + [w.lower() for w in (extra_words or []) if w]
        parts = []
        for w in words:
            whole = w.endswith("=")
            stem = re.escape(w.rstrip("=")).replace(r"\ ", r"\s*")
            parts.append(r"(?<![a-z])" + stem + (r"(?![a-z])" if whole else ""))
        self._block_re = re.compile("|".join(parts), re.I)

    def _normalize(self, text):
        text = text.lower().translate(_LEET)
        # "f.u.c.k" / "f u c k" style spacing
        squashed = re.sub(r"(?<=\b\w)[\s.\-_*]+(?=\w\b)", "", text)
        return text + " " + squashed

    def is_bad(self, text):
        return bool(self._block_re.search(self._normalize(text or "")))

    @staticmethod
    def tidy(text, limit=200):
        text = _URL_RE.sub("", text or "")
        text = _EMOJI_RE.sub(" ", text)
        text = _SPACE_RE.sub(" ", text).strip()
        return text[:limit]

    def clean_question(self, text):
        """Returns a cleaned question, or None if it should be skipped."""
        text = self.tidy(text)
        if len(re.sub(r"[^\w]", "", text)) < 2:
            return None
        if self.is_bad(text):
            return None
        return text

    def clean_name(self, name):
        name = self.tidy(name, 24)
        name = re.sub(r"[_\-.]+", " ", name).strip()
        if not name or self.is_bad(name):
            return "friend"
        return name

    def clean_answer(self, character, text):
        text = text or ""
        # Strip roleplay stage directions like *jumps* or (laughs), markdown and emoji.
        text = re.sub(r"\*[^*]{0,60}\*", " ", text)
        text = re.sub(r"\([^)]{0,40}\)", " ", text)
        text = re.sub(r"[*_#`~>\[\]]", "", text)
        text = re.sub(r"^\s*(mario|luigi)\s*:\s*", "", text, flags=re.I)
        text = self.tidy(text, 400).strip(" \"'")
        text = re.sub(r"\s+([!?.,])", r"\1", text)
        if not text or self.is_bad(text):
            return random.choice(SAFE_ANSWERS.get(character, SAFE_ANSWERS["mario"]))
        return text
