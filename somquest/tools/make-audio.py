"""Builds SomQuest's audio from open-licensed sources.

Usage: python3 -I tools/make-audio.py <sonic-pi checkout> <supertux checkout>

Sources (see ../extension/music/CREDITS.txt for the full credits):
  - Sonic Pi sample library (etc/samples): CC0, from freesound.org
  - SuperTux data/sounds: tada, crystallo-*: CC0
  - SuperTux data/music: CC-BY-SA (per-track authors in CREDITS.txt)

Sound effects are trimmed, faded, peak-normalised and written to assets/sfx/
(build.js embeds them in the bundle). Music is loudness-normalised and
re-encoded to Ogg Opus in extension/music/; loop points stay intact because
nothing is trimmed.
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SONICPI, SUPERTUX = sys.argv[1], sys.argv[2]
SP = os.path.join(SONICPI, 'etc', 'samples')
ST_SND = os.path.join(SUPERTUX, 'data', 'sounds')
ST_MUS = os.path.join(SUPERTUX, 'data', 'music')

# name: (source file, start offset s, max duration s or None, fade-out s, playback-speed factor)
SFX = {
    'shoot':    (f'{SP}/elec_plip.flac', 0, 0.12, 0.04, 1),
    'hit':      (f'{SP}/elec_flip.flac', 0, None, 0.02, 1),
    'crit':     (f'{SP}/elec_ping.flac', 0, None, 0.05, 1),
    'kill':     (f'{ST_SND}/crystallo-shardhit.ogg', 0, None, 0.08, 1),
    'pop':      (f'{SP}/elec_pop.flac', 0, None, 0.02, 1),
    'hurt':     (f'{SP}/bass_voxy_hit_c.flac', 0, None, 0.1, 1),
    'dash':     (f'{SP}/perc_swoosh.flac', 0, 0.45, 0.15, 1),
    'pickup':   (f'{SP}/elec_blip.flac', 0, None, 0.03, 1),
    'bell':     (f'{SP}/perc_bell.flac', 0, 1.8, 0.8, 1),
    'bell2':    (f'{SP}/perc_bell2.flac', 0, 1.2, 0.6, 1),
    'tick':     (f'{SP}/elec_tick.flac', 0, None, 0.005, 1),
    'blip':     (f'{SP}/elec_blip2.flac', 0, 0.09, 0.03, 1),
    'robot':    (f'{SP}/mehackit_robot2.flac', 0, None, 0.05, 1),
    'glitchv':  (f'{SP}/glitch_robot2.flac', 0, None, 0.05, 1),
    'select':   (f'{SP}/elec_twip.flac', 0, None, 0.02, 1),
    'confirm':  (f'{SP}/elec_beep.flac', 0, None, 0.02, 1),
    'cineboom': (f'{SP}/misc_cineboom.flac', 0, 2.6, 1.2, 1),
    'twang':    (f'{SP}/elec_twang.flac', 0, None, 0.1, 1),
    'buzz':     (f'{SP}/ambi_soft_buzz.flac', 0, 0.7, 0.2, 1),
    'zap':      (f'{SP}/hat_zap.flac', 0, None, 0.03, 1),
    'spawn':    (f'{SP}/tbd_perc_blip.flac', 0, None, 0.02, 1),
    'drop':     (f'{SP}/bass_drop_c.flac', 0, None, 0.4, 1),
    'darkwoosh': (f'{SP}/ambi_dark_woosh.flac', 0, 2.4, 0.8, 1),
    'glitch1':  (f'{SP}/glitch_perc1.flac', 0, 0.6, 0.15, 1),
    'glitch3':  (f'{SP}/glitch_perc3.flac', 0, 0.6, 0.15, 1),
    'glitch5':  (f'{SP}/glitch_perc5.flac', 0, 0.6, 0.15, 1),
    'boom':     (f'{SP}/bd_boom.flac', 0, None, 0.4, 1),
    'chime':    (f'{SP}/elec_chime.flac', 0, 1.3, 0.6, 1),
    'bong':     (f'{SP}/elec_bong.flac', 0, None, 0.08, 1),
    'swoosh':   (f'{SP}/ambi_swoosh.flac', 0, 1.1, 0.3, 1),
    'kick':     (f'{SP}/drum_heavy_kick.flac', 0, None, 0.05, 1),
    'impact':   (f'{SP}/perc_impact1.flac', 0, 0.8, 0.3, 1),
    'tada':     (f'{ST_SND}/tada.ogg', 0, None, 0.2, 1),
    'shatter':  (f'{ST_SND}/crystallo-shatter.ogg', 0, None, 0.1, 1),
}

MUSIC = {
    'night.ogg': 'antarctic/night.ogg',
    'chipdisko.ogg': 'antarctic/chipdisko.ogg',
    'forest-sprint.ogg': 'forest/forest-sprint.ogg',
    'crystalmine_main.ogg': 'antarctic/crystalmine_main.ogg',
    'halloween_1.ogg': 'misc/halloween_1.ogg',
    'yetiboss.ogg': 'antarctic/yetiboss.ogg',
    'bright_thunders.ogg': 'forest/bright_thunders.ogg',
    'sunset.ogg': 'antarctic/sunset.ogg',
}


def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True)


def peak_db(path, filters):
    out = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', filters + ',volumedetect', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    m = re.search(r'max_volume: (-?[0-9.]+) dB', out)
    return float(m.group(1)) if m else 0.0


def make_sfx():
    out_dir = os.path.join(ROOT, 'assets', 'sfx')
    os.makedirs(out_dir, exist_ok=True)
    for name, (src, start, dur, fade, _speed) in SFX.items():
        chain = ['silenceremove=start_periods=1:start_threshold=-55dB']
        if start:
            chain.insert(0, f'atrim=start={start}')
        if dur:
            chain.append(f'atrim=end={dur}')
        filters = ','.join(chain)
        full = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src],
                              capture_output=True, text=True).stdout.strip()
        length = min(float(full) - start, dur) if dur else float(full) - start
        filters += f',afade=t=out:st={max(0, length - fade):.3f}:d={fade}'
        gain = -1.0 - peak_db(src, filters)
        dst = os.path.join(out_dir, name + '.ogg')
        run(['ffmpeg', '-y', '-hide_banner', '-i', src, '-af', f'{filters},volume={gain:.2f}dB',
             '-ac', '1', '-ar', '44100', '-c:a', 'libvorbis', '-q:a', '4', dst])
        print(f'sfx  {name:10s} {os.path.getsize(dst) // 1024:4d} KB  ← {os.path.basename(src)}')


def make_music():
    out_dir = os.path.join(ROOT, 'extension', 'music')
    os.makedirs(out_dir, exist_ok=True)
    for dst_name, rel in MUSIC.items():
        src = os.path.join(ST_MUS, rel)
        dst = os.path.join(out_dir, dst_name)
        run(['ffmpeg', '-y', '-hide_banner', '-i', src, '-af', 'loudnorm=I=-18:TP=-1.5:LRA=11',
             '-ar', '48000', '-c:a', 'libopus', '-b:a', '64k', dst])
        print(f'music {dst_name:22s} {os.path.getsize(dst) // 1024:5d} KB  ← {rel}')


if __name__ == '__main__':
    make_sfx()
    make_music()
