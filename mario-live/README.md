# Mario Live: an AI Mario & Luigi for your TikTok LIVE

A 3D Mushroom Kingdom scene where an animated Mario answers your TikTok LIVE chat out loud.
Mention **Luigi** and Luigi pops out of the green pipe to answer instead.

- **Fully 3D**: rigged Mario & Luigi with idle, walk, run, jump, wave, think, celebrate and lip-synced talking.
  The world has a castle, grassy terraces, a cliff with a waterfall and pond, giant mushrooms, a floating island,
  a spinning Power Star, a Piranha Plant pipe, a walking Koopa and Goomba, butterflies, ? blocks Mario bonks for coins,
  and the warp pipe.
- **Free AI**: a Llama 3.2 3B model from Hugging Face, run on your own PC by [Ollama](https://ollama.com).
  You don't need an account or API key, and nothing is billed per message.
- **Voices**: free text-to-speech (an Italian voice reading English, pitched up for a cartoon plumber sound).
- **Earn more from the stream**:
  - **Gift = skip the line.** Anyone who sends a gift (a Rose is enough) gets their question moved to the front, marked ⭐ VIP.
  - **Top supporters** board on screen, plus gift and follow shout-outs.
  - **Like goal** bar. When it fills, Mario celebrates and a new goal starts.
- **Family friendly**: a filter drops bad chat messages before they're read out, and the AI is told to dodge bad topics.

## Start it

1. Double-click **`START.bat`**.
   - The first time, it installs Python, the packages and Ollama for you if they're missing, then downloads
     the AI model (about 2 GB, one time only).
   - It asks for your TikTok username once and saves it in `config.json`.
2. A Mario window opens (sized 540×960, which is portrait like TikTok).
3. Go live on TikTok. The app connects to your chat automatically and keeps retrying until you're live.

**Put it on stream**
- **TikTok LIVE Studio:** add a *Window Capture* source and pick the Mario window. Make sure desktop audio is captured.
- **OBS:** add a *Browser Source* with URL `http://localhost:8765/`, width 1080, height 1920.
  Tick "Control audio via OBS" so the voices go to the stream.

**Test without going live:** type a question into the black START.bat window and press Enter. You can also
press **D** in the Mario window to open a test panel. Press D again to hide it before you go live.

## Settings (`config.json`)

| Setting | What it does |
|---|---|
| `tiktok_username` | Your TikTok @name, without the @. |
| `ai_model` | Any Ollama model name. The default is a Hugging Face GGUF (`hf.co/...`). For a smarter but slower model, try `hf.co/bartowski/Qwen2.5-7B-Instruct-GGUF:Q4_K_M`. |
| `ai_max_words` | How long answers can be. |
| `answer_mode` | `all` answers every message, `questions` answers only questions and mentions of Mario or Luigi, and `command` answers only `!ask ...`, `!mario ...` and `!luigi ...`. |
| `per_user_cooldown_seconds` | Stops one person from spamming. Gifters skip the cooldown. |
| `gift_priority` | Turns "gift = skip the line" on or off. |
| `priority_minutes` | How long a gift's skip-the-line pass lasts if they haven't asked yet. |
| `like_goal` | Likes needed per goal. Set it to `0` to hide the bar. |
| `idle_chatter_seconds` | Mario talks to chat when it has been quiet this long. Set it to `0` to turn this off. |
| `blocked_words` | Extra words to filter. |
| `voices` | Voice, `pitch`, `rate` and `playback_rate` for each character. Raise `pitch` or `playback_rate` for a higher, more cartoony voice. |

## Use your own 3D models (optional)

The app works out of the box with its built-in Mario and Luigi. To use other models, put them in the `assets` folder:

- `mario.glb` / `luigi.glb`: rigged characters. Animations named like *idle*, *walk*, *run*, *jump*, *wave*,
  *talk* or *dance* are picked up automatically, and a bone named *jaw* or *mouth* opens when they talk.
- `scene.glb`: extra scenery added to the world.
- `music.mp3`: quiet looping background music. It gets quieter while someone is talking.

Only use models and music you have the rights to stream.

## About the voices

The voices are made to sound *like* cartoon Mario and Luigi, with an Italian accent and a high, bouncy pitch.
They are not a clone of the real voice actor. Copying a real person's voice so that anyone in chat can make it say
anything isn't something this project does. You can tune the sound under `voices` in `config.json`.

## Troubleshooting

- **No voice:** click once inside the Mario window. Browsers keep sound off until you do. The START.bat window and
  OBS don't need this. The voice service also needs internet. Without it, the browser's built-in voice is used.
- **"isn't live yet":** this is normal before you go live. It connects by itself once you are.
- **Answers are slow:** the first answer after starting takes longer. A PC with a graphics card is much faster. You can
  also lower `ai_max_words`.
- **Port already in use:** Mario Live is already open in another window, or you can change `port` in `config.json`.

This is a fan project and isn't affiliated with or endorsed by Nintendo. Mario and Luigi are trademarks of Nintendo.
