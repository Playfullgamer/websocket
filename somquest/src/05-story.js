// ───────────────────────────── story ─────────────────────────────
// Each line: [speaker, text, fx?]. Speakers: ping, you, mentor, onv, sys (narration), log (terminal), or a boss sprite id.
const SPEAKERS = {
  ping: { name: 'PING', color: '#ffd84a', pitch: 2.1 },
  you: { name: null, color: '#5fb8ff', pitch: 1.1 },
  mentor: { name: 'MENTOR.EXE', color: '#ff6b70', pitch: 0.7 },
  mentorok: { name: 'MENTOR.EXE', color: '#4dffa6', pitch: 0.8 },
  onv: { name: 'DE ONVOLDOENDE', color: '#ff3b5c', pitch: 0.45 },
  achtsteuur: { name: 'HET 8STE UUR', color: '#7cc4ff', pitch: 0.6 },
  werkstuk: { name: 'HET WERKSTUK', color: '#2ee6b5', pitch: 0.75 },
  gemiddelde: { name: 'HET GEMIDDELDE', color: '#c48bff', pitch: 0.65 },
  verzuim: { name: 'DE VERZUIMCOÖRDINATOR', color: '#a58bff', pitch: 0.5 },
  sys: { name: '', color: '#9fb3d1', pitch: 1.3 },
  log: { name: 'SYSTEM LOG', color: '#4dff88', pitch: 1.6 },
};

const CHAPTERS = [
  {
    id: 'rooster', num: 1, title: 'HET ROOSTER', sub: 'The schedule is melting', clock: '23:52', theme: 'rooster', music: 'level', par: 170,
    steps: [
      { type: 'cutscene', id: 'prologue' },
      { type: 'card' },
      {
        type: 'dialog', lines: [
          ['sys', '...You wake up inside the screen. Everything smells like whiteboard markers.'],
          ['ping', '*ding!* Oh thank the server — a REAL student! Hi! I\'m PING!'],
          ['ping', 'You know me. I\'m the notification bell. The one that tells you about new grades. ...Sorry about those.'],
          ['you', 'Where am I? Why is everything so... blue?'],
          ['ping', 'You\'re inside Somtoday! Something is eating the database. Grades are vanishing. Schedules are melting. Homework is BREEDING.'],
          ['you', 'So... a normal Tuesday.'],
          ['ping', 'NO! At 00:00 the report cards lock forever. If that THING reaches the Rapport-server first, every grade in the country becomes a 1,0.'],
          ['you', 'Every grade?'],
          ['ping', 'Every. Single. One. Even gym.'],
          ['you', '...Okay. Now it\'s personal.'],
          ['ping', 'Your pen is your weapon! [WASD] move · [MOUSE] aim · [HOLD CLICK] write · [SPACE] dash through danger.'],
          ['ping', 'Beat enemies to fill your INLEVEREN meter. When it\'s full, press [E] or right-click to hand in EVERYTHING at once!'],
          ['ping', 'Here they come — free periods gone feral! Don\'t let them haunt you!'],
        ],
      },
      { type: 'wave', groups: [[0, 'tussenuur', 4], [3, 'tussenuur', 3]] },
      { type: 'dialog', lines: [['ping', 'Look out — LATE MARKS! They wind up, then charge. Dash right through them!']] },
      { type: 'wave', groups: [[0, 'tussenuur', 3], [0.5, 'telaat', 2], [4, 'telaat', 2], [6.5, 'tussenuur', 4]] },
      { type: 'dialog', lines: [['ping', 'You\'re a natural! Here — I salvaged some school supplies from the lost & found.']] },
      { type: 'upgrade' },
      { type: 'dialog', lines: [['ping', 'Tests incoming! They keep their distance and take cheap shots. Just like the real ones.']] },
      { type: 'wave', groups: [[0, 'toets', 2], [1, 'tussenuur', 4], [5, 'telaat', 3], [8, 'toets', 2], [9, 'tussenuur', 3]] },
      {
        type: 'dialog', lines: [
          ['sys', 'The bell rings. Then it rings again. And again. It doesn\'t stop.'],
          ['ping', 'Oh no. Oh no no no. That\'s not a normal bell. That\'s... the 8th period.'],
          ['you', 'The 8th period doesn\'t even exist on Fridays.'],
          ['ping', 'It exists NOW.'],
        ],
      },
      { type: 'boss', boss: 'achtsteuur' },
      {
        type: 'dialog', lines: [
          ['ping', 'You beat the 8th period! That has NEVER happened in recorded history!'],
          ['log', '> MENTOR.EXE: rescheduling... removing "students" from schedule for optimal efficiency.'],
          ['you', 'MENTOR.EXE? Who\'s that?'],
          ['ping', 'The auto-mentor. The school installed it to "personalise learning". It writes all those comments. "Goed bezig!" "Let op je inzet."'],
          ['ping', 'It\'s never written anything like THIS before. The trail leads to the homework tab. Come on!'],
        ],
      },
      { type: 'upgrade' },
    ],
  },
  {
    id: 'huiswerk', num: 2, title: 'HET HUISWERK', sub: 'Everything you postponed', clock: '23:54', theme: 'huiswerk', music: 'homework', par: 180,
    steps: [
      { type: 'card' },
      {
        type: 'dialog', lines: [
          ['ping', 'Welcome to the Huiswerk tab. Every assignment you ever postponed ends up here.'],
          ['you', 'I did all of those! ...Mostly. Some. I looked at them.'],
          ['ping', 'They remember you, {name}. They remember EVERYTHING.'],
          ['ping', 'Careful with the stacks — they split into loose pages when you hit them. Classic homework.'],
        ],
      },
      { type: 'wave', groups: [[0, 'stapel', 2], [2, 'blaadje', 4], [5, 'stapel', 2], [7, 'tussenuur', 3]] },
      { type: 'dialog', lines: [['ping', 'That red one\'s a DEADLINE. The longer you ignore it, the faster it gets. Sound familiar?']] },
      { type: 'wave', groups: [[0, 'deadline', 1], [1.5, 'stapel', 2], [4, 'deadline', 2], [6, 'blaadje', 5], [8, 'toets', 2]] },
      { type: 'upgrade' },
      { type: 'dialog', lines: [['ping', 'Notifications?! Those are MY job! They orbit you and spam — pop them fast!']] },
      { type: 'wave', groups: [[0, 'melding', 3], [2, 'stapel', 2], [5, 'deadline', 2], [7, 'melding', 2], [8, 'blaadje', 6], [10, 'toets', 2]] },
      {
        type: 'dialog', lines: [
          ['sys', 'The paper piles shudder. Something enormous is being written.'],
          ['ping', 'Oh no. It\'s the WERKSTUK. Two thousand words. Minimum.'],
          ['you', 'Font size 12?'],
          ['ping', 'Font size 12. Double spaced. With SOURCES.'],
          ['werkstuk', 'SOURCE MISSING. SOURCE MISSING. SOURCE MISSING.'],
        ],
      },
      { type: 'boss', boss: 'werkstuk' },
      {
        type: 'dialog', lines: [
          ['werkstuk', '...bibliography... incomplete......'],
          ['log', '> MENTOR.EXE: anomaly detected in grade database. Entity classification: ONVOLDOENDE.'],
          ['log', '> MENTOR.EXE: countermeasure — lock out all students. A student who cannot log in cannot fail.'],
          ['you', 'That\'s... technically true. And deeply evil.'],
          ['ping', 'Wait. MENTOR.EXE isn\'t the monster. It\'s trying to FIGHT the monster. Badly.'],
          ['ping', 'Whatever the Onvoldoende is, it\'s feeding in the grades tab. Let\'s go!'],
        ],
      },
      { type: 'upgrade' },
    ],
  },
  {
    id: 'cijfers', num: 3, title: 'DE CIJFERS', sub: 'These numbers bite', clock: '23:56', theme: 'cijfers', music: 'grades', par: 190,
    steps: [
      { type: 'card' },
      {
        type: 'dialog', lines: [
          ['ping', 'The Cijfers tab. Careful — these numbers BITE. Especially the red ones.'],
          ['you', 'I know. I\'ve met them.'],
          ['ping', 'Insufficient grades fire rings of pure disappointment. Keep moving!'],
        ],
      },
      { type: 'wave', groups: [[0, 'cijfer', 3], [3, 'tussenuur', 4], [6, 'cijfer', 2]] },
      { type: 'wave', groups: [[0, 'toets', 3], [1, 'cijfer', 2], [4, 'telaat', 3], [7, 'cijfer', 3], [9, 'deadline', 1]] },
      { type: 'upgrade' },
      { type: 'wave', groups: [[0, 'cijfer', 3], [0.5, 'melding', 2], [4, 'stapel', 2], [6, 'toets', 3], [8, 'cijfer', 3], [10, 'deadline', 2]] },
      {
        type: 'dialog', lines: [
          ['sys', 'All the grades in the tab start flowing together, swirling into one terrible number.'],
          ['ping', 'They\'re merging... into THE AVERAGE.'],
          ['you', 'My average? Oh no. Not my average.'],
          ['ping', 'Raise it! Every hit pushes it up! Get it over 5,5 and it\'ll crack!'],
        ],
      },
      { type: 'boss', boss: 'gemiddelde' },
      {
        type: 'dialog', lines: [
          ['ping', 'TEN! A PERFECT TEN! I\'ve never delivered one of those before!', 'confetti'],
          ['onv', 'So. You are the one eating my meals.', 'glitch'],
          ['onv', 'Every 1,0 ever given. Every "insufficient". Every "see me after class". I am MADE of them.'],
          ['onv', 'At midnight I will be EVERY grade. Stay out of the Absence records, little student. It is dark there.', 'glitch'],
          ['ping', '...it said not to go to the Absence records.'],
          ['you', 'So we\'re going to the Absence records.'],
          ['ping', 'We are SO going to the Absence records.'],
        ],
      },
      { type: 'upgrade' },
    ],
  },
  {
    id: 'afwezig', num: 4, title: 'DE AFWEZIGHEID', sub: 'Lights out', clock: '23:58', theme: 'afwezig', music: 'dark', par: 200,
    steps: [
      { type: 'card' },
      {
        type: 'dialog', lines: [
          ['ping', 'It\'s dark here because nobody\'s ever here. Get it? Absence? ...I\'ll glow as bright as I can. Stay close.'],
          ['ping', 'Ghosts of skipped classes haunt this place. They vanish — then pop up right next to you.'],
          ['you', 'I have never skipped a class in my life.'],
          ['ping', 'Then why does that one have your NAME on it?'],
        ],
      },
      { type: 'wave', groups: [[0, 'spook', 3], [3, 'tussenuur', 4], [6, 'spook', 2]] },
      { type: 'wave', groups: [[0, 'spook', 3], [1, 'telaat', 2], [4, 'melding', 2], [6, 'spook', 3], [8, 'deadline', 1]] },
      { type: 'upgrade' },
      { type: 'wave', groups: [[0, 'spook', 4], [2, 'cijfer', 2], [5, 'toets', 2], [7, 'spook', 3], [9, 'stapel', 2], [11, 'telaat', 3]] },
      {
        type: 'dialog', lines: [
          ['sys', 'Footsteps. A clipboard clicks.'],
          ['verzuim', '{name}. You were marked ABSENT on the 14th of March.'],
          ['you', 'I had the flu!'],
          ['verzuim', 'Was there... a NOTE?'],
          ['you', '...My mom called?'],
          ['verzuim', 'NO NOTE. NO MERCY.', 'shake'],
        ],
      },
      { type: 'boss', boss: 'verzuim' },
      {
        type: 'dialog', lines: [
          ['ping', 'You did it! The lights are coming back on!'],
          ['log', '> MENTOR.EXE: containment failed. ONVOLDOENDE has reached /rapport.'],
          ['log', '> MENTOR.EXE: last resort — merging with the entity to lock it inside myself.'],
          ['log', '> MENTOR.EXE: goodbye. goed bezig, everyone. let op je inz—'],
          ['ping', 'No... it\'s going to sacrifice itself. And it\'s going to LOSE.'],
          ['ping', '{name}, we have to get to the Rapport. NOW.'],
        ],
      },
      { type: 'upgrade' },
    ],
  },
  {
    id: 'rapport', num: 5, title: 'HET RAPPORT', sub: 'Midnight', clock: '23:59', theme: 'rapport', music: 'final', par: 220,
    steps: [
      { type: 'card' },
      {
        type: 'dialog', lines: [
          ['sys', '23:59:30. The Rapport-server hums like a dying fridge.'],
          ['mentor', 'STUDENT {name}. AUTOMATICALLY GENERATED COMMENT: YOU WILL NOT MAKE IT.', 'glitch'],
          ['ping', 'That\'s MENTOR.EXE! It\'s... it\'s been taken over!'],
          ['mentor', 'WATCH. YOUR. EFFORT.', 'shake'],
        ],
      },
      { type: 'boss', boss: 'mentor' },
      {
        type: 'dialog', lines: [
          ['mentorok', '...st...udent... it\'s inside... me... hit it... HARDER...'],
          ['onv', 'FINALLY. THE SHELL CRACKS.', 'glitch'],
          ['onv', 'Look at you. One student. One pen. Against every failing grade in history.'],
          ['you', 'I\'ve survived four years of exam weeks. You\'re just a number.'],
          ['onv', 'I AM THE NUMBER.', 'shake'],
          ['ping', '{name}! Give it EVERYTHING! This is the final test!'],
        ],
      },
      { type: 'heal' },
      { type: 'boss', boss: 'onvoldoende' },
      {
        type: 'dialog', lines: [
          ['sys', '00:00. The clock strikes midnight... and every grade locks in. Correctly.'],
          ['mentorok', '...system restored. thank you, {name}.'],
          ['mentorok', 'automatically generated comment: ...no. Not automatic this time.'],
          ['mentorok', 'Goed bezig. Genuinely.'],
          ['ping', 'WE DID IT! The database is safe! Every grade is back where it belongs!', 'confetti'],
          ['you', 'Wait. The grade I came to check in the first place. What did I get?'],
          ['ping', 'Oh! Let me fetch it! *ding*'],
        ],
      },
    ],
  },
];

const CREDITS = [
  ['SOMQUEST', 'title'],
  ['Het Laatste Rapport', 'sub'],
  ['', ''],
  ['A fan-made story mod for Somtoday', ''],
  ['Not affiliated with Somtoday or Topicus', 'small'],
  ['', ''],
  ['STARRING', 'head'],
  ['{name} as The Student', ''],
  ['PING as the notification bell', ''],
  ['MENTOR.EXE as itself (recovering)', ''],
  ['DE ONVOLDOENDE as every 1,0 ever given', ''],
  ['Het 8ste Uur · Het Werkstuk · Het Gemiddelde', ''],
  ['De Verzuimcoördinator (still waiting for that note)', ''],
  ['', ''],
  ['SPECIAL THANKS', 'head'],
  ['Everyone who ever refreshed the grades tab at midnight', ''],
  ['Every teacher who wrote "goed bezig" and meant it', ''],
  ['The cafeteria coffee, for nothing', ''],
  ['', ''],
  ['No homework was harmed in the making of this game.', 'small'],
  ['Okay, some homework was harmed.', 'small'],
  ['', ''],
  ['TOETSWEEK MODE UNLOCKED', 'head'],
  ['Endless waves. Every boss. How long can you last?', ''],
  ['', ''],
  ['See you next report. *ding*', 'sub'],
];
