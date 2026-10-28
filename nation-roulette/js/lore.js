/* Nation Roulette — names, flags and statistics for generated nations. */
(function (global) {
  'use strict';

  let rng = Math.random;
  const R = () => rng();
  const pick = arr => arr[Math.floor(R() * arr.length)];
  const between = (a, b) => a + R() * (b - a);
  const logBetween = (a, b) => Math.exp(between(Math.log(a), Math.log(b)));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const cap = w => w.charAt(0).toUpperCase() + w.slice(1);

  /* ---------- names ---------- */

  const FLAVORS = {
    Europe: {
      starts: ['Al', 'Bel', 'Cor', 'Dra', 'El', 'Fen', 'Gal', 'Hel', 'Is', 'Kar', 'Lor', 'Mar', 'Nor', 'Ost', 'Pol', 'Ros',
        'Sal', 'Tor', 'Val', 'Vel', 'Wes', 'Zar', 'Brun', 'Sten', 'Mor', 'Lund', 'Ard', 'Grav', 'Kest', 'Vor', 'Aust', 'Bor'],
      mids: ['a', 'e', 'i', 'o', 'an', 'en', 'ar', 'or', 'el', 'ov', 'is', 'ur', 'ber', 'gar', 'mon', 'ven', 'dal', 'ster'],
      ends: ['ia', 'land', 'mark', 'burg', 'ovia', 'enia', 'avia', 'heim', 'onia', 'aria', 'ria', 'onia', 'eny', 'ania', 'ica'],
      city: ['burg', 'grad', 'stad', 'ford', 'port', 'haven', 'mouth', 'heim', 'berg', 'ovo', 'ice', 'ville', 'wick', 'dorf'],
    },
    Asia: {
      starts: ['Ka', 'Shan', 'Tai', 'Ar', 'Zha', 'Hin', 'Ma', 'Su', 'Ba', 'Tur', 'Kho', 'Nyu', 'Pa', 'Ram', 'Sar', 'Tash',
        'Ye', 'Lu', 'Qin', 'Do', 'Bha', 'Ku', 'Mek', 'Har', 'Jin', 'Sor', 'Uz', 'Kyo', 'Ang', 'Ral'],
      mids: ['a', 'i', 'o', 'u', 'an', 'ar', 'en', 'ik', 'ur', 'ji', 'ra', 'ko', 'lan', 'mir'],
      ends: ['stan', 'an', 'ia', 'pur', 'abad', 'ong', 'ar', 'esh', 'ya', 'ol', 'ira', 'nam', 'khand', 'istan', 'ara', 'u'],
      city: ['pur', 'abad', 'shan', 'kent', 'ganj', 'jing', 'zhou', 'nagar', 'ora', 'bek', 'saka', 'gyi', 'dong', 'kot'],
    },
    Africa: {
      starts: ['Ba', 'Ka', 'Ma', 'Za', 'Ngo', 'Lu', 'Ta', 'Mo', 'Wa', 'Sa', 'Ke', 'Ru', 'Bu', 'Da', 'Ga', 'Ki', 'Nya', 'Ou',
        'Ash', 'Ifr', 'Tsa', 'Mba', 'Zu', 'Ko', 'Am', 'Tim', 'Asan', 'Dja'],
      mids: ['a', 'i', 'o', 'u', 'ba', 'ka', 'la', 'ma', 'na', 'ro', 'si', 'we', 'nd', 'mb'],
      ends: ['ia', 'ola', 'ana', 'ani', 'ombe', 'ura', 'egal', 'iland', 'awi', 'undi', 'eria', 'ania', 'ar', 'ogo', 'ati', 'enya'],
      city: ['ville', 'ka', 'ba', 'sa', 'asa', 'ombe', 'gou', 'ndi', 'mako', 'bura', 'tou', 'shi', 'ala', 'oni'],
    },
    'North America': {
      starts: ['Al', 'Cal', 'Mon', 'Sier', 'Que', 'Tex', 'Mis', 'Wa', 'Nu', 'Yu', 'Chi', 'Oa', 'Tla', 'Aca', 'Bel', 'Cor', 'Hu',
        'Ken', 'Sas', 'Mani', 'Ari', 'Ne', 'Coa', 'Yuca', 'Ta', 'Dako'],
      mids: ['a', 'e', 'i', 'o', 'ta', 'ka', 'ra', 'na', 'co', 'mi', 'ho', 'lo'],
      ends: ['ia', 'ota', 'ico', 'ana', 'ada', 'ara', 'ega', 'esco', 'ona', 'ka', 'tlan', 'ington', 'oria', 'awa', 'ida'],
      city: [' City', 'ton', 'ville', 'field', 'ford', 'port', 'burg', 'dale', 'tlan', 'ito', 'ingo', ' Springs', 'wood'],
    },
    'South America': {
      starts: ['Pa', 'Ca', 'Ura', 'Gua', 'Ama', 'Bra', 'Ve', 'Co', 'Ar', 'Tu', 'Ma', 'Que', 'Pe', 'Sa', 'Chi', 'Bo', 'Tie',
        'Ita', 'Mara', 'Cuz', 'Ori', 'Pata', 'Ya'],
      mids: ['a', 'e', 'i', 'o', 'ra', 'ta', 'na', 'ca', 'pa', 'gu', 'lo', 'ri'],
      ends: ['guay', 'ia', 'ana', 'ador', 'ina', 'ezia', 'ano', 'ivia', 'ara', 'ru', 'zil', 'ombia', 'enia', 'aima', 'onia'],
      city: ['ópolis', 'ia', 'ina', 'ago', 'ucho', 'aba', 'era', 'ito', 'ana', 'osa', 'eiro', 'ena'],
    },
    Oceania: {
      starts: ['Ka', 'Ma', 'Po', 'Ta', 'Vanu', 'Wai', 'Ha', 'Mo', 'Nu', 'To', 'Fi', 'Sa', 'Ra', 'Aote', 'Ko', 'Le', 'Pa', 'Ula',
        'Tau', 'Ki', 'Mele'],
      mids: ['a', 'e', 'i', 'o', 'u', 'ka', 'la', 'ma', 'na', 'ki', 'ri', 'tu', 'wa'],
      ends: ['a', 'u', 'ua', 'iti', 'nesia', 'ana', 'ati', 'oa', 'lau', 'ga', 'ki', 'tu', 'alia', 'onga', 'ua'],
      city: ['ua', 'ati', 'ville', 'port', 'ana', 'iki', 'oa', 'town', 'ula', 'apa', 'enga'],
    },
  };

  function smooth(name) {
    return name
      .replace(/([aeiou])\1{1,}/gi, '$1')
      .replace(/([aeiou])([aeiou])([aeiou])/gi, '$1$3')
      .replace(/([^aeiou\s])\1\1/gi, '$1$1');
  }

  function makeRoot(flavor) {
    const f = FLAVORS[flavor] || FLAVORS.Europe;
    let name;
    for (let tries = 0; tries < 20; tries++) {
      name = pick(f.starts) + (R() < 0.45 ? pick(f.mids) : '') + pick(f.ends);
      name = smooth(cap(name.toLowerCase()));
      if (name.length >= 4 && name.length <= 12) break;
    }
    return name;
  }

  function cityName(flavor, root) {
    const f = FLAVORS[flavor] || FLAVORS.Europe;
    const roll = R();
    let base = smooth(cap((pick(f.starts) + (R() < 0.5 ? pick(f.mids) : '')).toLowerCase()));
    if (roll < 0.08 && root) return `${root} City`;
    if (roll < 0.14) return `New ${base}${pick(f.city)}`.replace(/\s+City$/, '');
    if (roll < 0.2) return `Port ${base}${pick(f.city).trim()}`.replace(/ City$/, '');
    if (roll < 0.25 && (flavor === 'South America' || flavor === 'North America')) return `San ${base}${pick(['o', 'a', 'ez', 'ito'])}`;
    return smooth(base + pick(f.city));
  }

  function placeRoot(flavor) {
    const f = FLAVORS[flavor] || FLAVORS.Europe;
    return smooth(cap((pick(f.starts) + pick(f.mids) + (R() < 0.4 ? pick(f.mids) : '')).toLowerCase()));
  }

  function personName(flavor) {
    const f = FLAVORS[flavor] || FLAVORS.Europe;
    const first = smooth(cap((pick(f.starts) + pick(f.mids)).toLowerCase()));
    const last = smooth(cap((pick(f.starts) + pick(f.mids) + pick(['n', 'r', 'v', 's', 'ko', 'ez', 'ov', 'son', 'ar', 'i', '']))
      .toLowerCase()));
    return `${first} ${last}`;
  }

  function demonymOf(name) {
    const n = name;
    if (/land$/.test(n)) return n.replace(/land$/, 'lander');
    if (/stan$/.test(n)) return n + 'i';
    if (/ia$/.test(n)) return n + 'n';
    if (/(a|e)$/.test(n)) return n.slice(0, -1) + 'an';
    if (/[iuoy]$/.test(n)) return n + 'an';
    if (/burg$|heim$|mark$/.test(n)) return n + 'er';
    if (/ese$/.test(n)) return n;
    return n + (R() < 0.5 ? 'ian' : 'ese');
  }

  function languageOf(root, demonym) {
    if (/stani$/.test(demonym)) return root.replace(/stan$/, '') + 'i';
    return demonym;
  }

  function formalName(root, r) {
    const gov = r.government.label, ideo = r.ideology.label, size = r.size.label;
    const big = ['Huge', 'Colossal', 'Large'].includes(size);
    switch (gov) {
      case 'Absolute Monarchy':
        if (big && ['Expansionism', 'Hegemonism', 'Revanchism'].includes(r.doctrine.label)) return `Empire of ${root}`;
        if (size === 'Microstate' || size === 'Tiny') return pick([`Principality of ${root}`, `Grand Duchy of ${root}`]);
        return pick([`Kingdom of ${root}`, `Sultanate of ${root}`, `Realm of ${root}`]);
      case 'Constitutional Monarchy':
        return size === 'Microstate' ? `Principality of ${root}` : pick([`Kingdom of ${root}`, `United Kingdom of ${root}`, `Commonwealth of ${root}`]);
      case 'Presidential Republic': return ideo === 'Socialism' ? `Socialist Republic of ${root}` : `Republic of ${root}`;
      case 'Parliamentary Republic': return pick([`Republic of ${root}`, `Democratic Republic of ${root}`, `Commonwealth of ${root}`]);
      case 'Federal Republic': return pick([`Federal Republic of ${root}`, `United States of ${root}`, `Federation of ${root}`]);
      case 'One-Party State':
        if (ideo === 'Communism' || ideo === 'Socialism') return `People's Republic of ${root}`;
        if (ideo === 'Fascism' || ideo === 'Nationalism') return `${root} National State`;
        return pick([`${root} Unified Republic`, `${root} People's State`, `Revolutionary Republic of ${root}`]);
      case 'Military Junta': return pick([`${root} Provisional Authority`, `Military State of ${root}`, `${root} Defence Council`]);
      case 'Theocratic State': return pick([`Holy State of ${root}`, `Sacred Republic of ${root}`, `Divine Dominion of ${root}`]);
      case 'Direct Democracy': return pick([`Free Assembly of ${root}`, `Confederated Communes of ${root}`, `Democratic Union of ${root}`]);
      case 'Oligarchy': return pick([`Serene Republic of ${root}`, `${root} Directorate`, `Mercantile Republic of ${root}`]);
      case 'Corporate State': return pick([`${root} Corporate Dominion`, `${root} Incorporated`, `Charter State of ${root}`]);
      case 'Tribal Confederation': return pick([`Confederation of ${root}`, `United Tribes of ${root}`, `${root} Council of Clans`]);
      default: return `Republic of ${root}`;
    }
  }

  const LEADER_TITLES = {
    'Absolute Monarchy': ['King', 'Queen', 'Sultan', 'Emperor', 'Empress'],
    'Constitutional Monarchy': ['King', 'Queen', 'Prince', 'Grand Duke'],
    'Presidential Republic': ['President'], 'Parliamentary Republic': ['Prime Minister', 'Chancellor'],
    'Federal Republic': ['President', 'Chancellor'], 'One-Party State': ['Chairman', 'General Secretary', 'Supreme Leader'],
    'Military Junta': ['General', 'Field Marshal', 'Colonel'], 'Theocratic State': ['High Priest', 'Supreme Cleric', 'Oracle'],
    'Direct Democracy': ['Speaker of the Assembly', 'First Delegate'], 'Oligarchy': ['Doge', 'First Magnate', 'Archon'],
    'Corporate State': ['Chief Executive Officer', 'Chairman of the Board'],
    'Tribal Confederation': ['High Chief', 'Khan', 'Elder of Elders'],
  };

  const PARTY = {
    Liberalism: ['Liberal Alliance', 'Freedom Party'], Conservatism: ['Conservative Union', 'Heritage Party'],
    Socialism: ['Social Democratic Party', "Workers' Front"], Communism: ['Communist Party', "People's Vanguard"],
    Fascism: ['Iron Front', 'National Order Party'], Nationalism: ['National Front', 'Patriotic Union'],
    Anarchism: ['Free Federation (no party, technically)', 'Black Banner Collective'],
    Theocracy: ['Council of the Faithful', 'Sacred Path'], Monarchism: ['Royalist League', 'Crown Party'],
    Technocracy: ['Technocratic Council', 'Engineers Guild'], Environmentalism: ['Green Union', 'Earth First Party'],
    Libertarianism: ['Liberty Party', 'Free Market Coalition'], Populism: ["People's Voice", 'Common Folk Movement'],
    Transhumanism: ['Ascension Party', 'Singularity Front'],
  };

  const MOTTO_WORDS = {
    Liberalism: ['Liberty', 'Reason', 'Progress'], Conservatism: ['Tradition', 'Family', 'Order'],
    Socialism: ['Equality', 'Solidarity', 'Labour'], Communism: ['Revolution', 'the Workers', 'Unity'],
    Fascism: ['Strength', 'Discipline', 'Order'], Nationalism: ['the Homeland', 'Glory', 'Blood and Soil'],
    Anarchism: ['No Masters', 'Mutual Aid', 'Freedom'], Theocracy: ['the Divine', 'Faith', 'Devotion'],
    Monarchism: ['the Crown', 'Honour', 'Loyalty'], Technocracy: ['Efficiency', 'Science', 'Data'],
    Environmentalism: ['the Earth', 'Harmony', 'the Forest'], Libertarianism: ['Liberty', 'Property', 'Choice'],
    Populism: ['the People', 'Justice', 'Bread'], Transhumanism: ['Ascension', 'the Future', 'Evolution'],
  };
  const MOTTO_FORMS = ['{A}, {B}, {C}', '{A} above all', 'Through {A}, {B}', 'For {A} and {B}', 'In {A} we trust',
    'Strength through {A}', 'One people, one {A}', 'From {A}, {B}'];

  const CURRENCIES = ['Crown', 'Mark', 'Dinar', 'Franc', 'Peso', 'Rupee', 'Lira', 'Florin', 'Shilling', 'Rand', 'Dollar',
    'Sol', 'Ducat', 'Thaler', 'Kip', 'Real', 'Lev', 'Złoty', 'Talent', 'Sovereign', 'Riyal', 'Won', 'Kwacha', 'Guilder'];
  const ANIMALS = ['Golden Eagle', 'Snow Leopard', 'Lion', 'Red Fox', 'Brown Bear', 'Jaguar', 'Peacock', 'Tiger', 'Wolf',
    'Bison', 'Falcon', 'Condor', 'Elephant', 'Kangaroo', 'Crane', 'Stag', 'Panda', 'Komodo Dragon', 'Owl', 'Rhino',
    'Hippo', 'Llama', 'Capybara', 'Otter', 'Sea Turtle', 'Pangolin', 'Moose', 'Lynx', 'Ibex', 'Axolotl', 'Raccoon', 'Goose'];

  /* ---------- flags ----------
   * Every part of the flag comes from the wheels:
   *   colours  <- ideology (main), terrain (second), main resource (accent), coast (sea blue)
   *   layout   <- government system
   *   emblem   <- state religion, falling back to ideology / government
   *   extras   <- crown for monarchies, gold trim for ancient nations, atom for nuclear powers
   */

  const IDEO_COLORS = {
    Communism: [['#c8102e', 'revolutionary red'], ['#ffd100', 'gold']], Socialism: [['#d0312d', 'socialist red'], ['#ffffff', 'white']],
    Fascism: [['#1a1a1a', 'iron black'], ['#8b0000', 'blood red']], Nationalism: [['#1d3557', 'national navy'], ['#c1121f', 'patriotic red']],
    Anarchism: [['#111111', 'anarchist black'], ['#d00000', 'red']], Theocracy: [['#ffffff', 'holy white'], ['#d4a017', 'gold']],
    Monarchism: [['#4b2a7b', 'royal purple'], ['#d4a017', 'gold']], Technocracy: [['#00b4d8', 'circuit cyan'], ['#1b1b1b', 'black']],
    Environmentalism: [['#2d6a4f', 'ecological green'], ['#95d5b2', 'mint']], Liberalism: [['#0052b4', 'liberal blue'], ['#ffffff', 'white']],
    Libertarianism: [['#f2c500', 'liberty yellow'], ['#111111', 'black']], Conservatism: [['#0b2e6b', 'conservative blue'], ['#ffffff', 'white']],
    Populism: [['#e85d04', "people's orange"], ['#ffffff', 'white']], Transhumanism: [['#7b2cbf', 'future violet'], ['#00f5d4', 'neon teal']],
  };
  const TERRAIN_COLORS = {
    'Plains': ['#e9c46a', 'golden plains'], 'Mountains': ['#f1f1f1', 'mountain snow'], 'Rolling Hills': ['#6a994e', 'green hills'],
    'Dense Forest': ['#1b5e20', 'deep forests'], 'Desert': ['#d4a373', 'desert sands'], 'Jungle': ['#2a9d8f', 'jungle canopy'],
    'Highlands': ['#7f5539', 'highland earth'], 'Wetlands': ['#4d908e', 'marshes'], 'Steppe': ['#c9a227', 'steppe grass'],
    'Canyons': ['#b5541c', 'red canyons'],
  };
  const RESOURCE_COLORS = {
    'Oil': ['#111111', 'oil wealth'], 'Natural Gas': ['#5bc0eb', 'natural gas'], 'Gold': ['#d4a017', 'gold mines'],
    'Diamonds': ['#d8f3ff', 'diamonds'], 'Rare Earths': ['#9b5de5', 'rare earths'], 'Lithium': ['#b8c0c8', 'lithium'],
    'Uranium': ['#9ef01a', 'uranium'], 'Copper': ['#b87333', 'copper'], 'Iron Ore': ['#7a1c1c', 'iron ore'],
    'Coal': ['#2b2b2b', 'coal'], 'Timber': ['#386641', 'timber'], 'Fisheries': ['#0096c7', 'fisheries'],
    'Grain': ['#f4d35e', 'grain harvests'], 'Coffee & Spices': ['#6f4518', 'coffee & spices'], 'Tourism': ['#ff8fab', 'tourism'],
    'Absolutely Nothing': ['#9e9e9e', 'a whole lot of nothing'],
  };
  const SEA = ['#0077b6', 'access to the sea'];
  const LAYOUTS = {
    'Absolute Monarchy': ['border', 'centerDisc'], 'Constitutional Monarchy': ['nordic', 'canton'],
    'Presidential Republic': ['vTri', 'hTri'], 'Parliamentary Republic': ['hTri', 'vTri'], 'Federal Republic': ['stripes', 'canton'],
    'One-Party State': ['plainCanton', 'hBi'], 'Military Junta': ['hBi', 'plainCanton'], 'Theocratic State': ['centerDisc', 'border'],
    'Direct Democracy': ['stripes', 'quarter'], 'Oligarchy': ['saltire', 'diag'], 'Corporate State': ['quarter', 'diag'],
    'Tribal Confederation': ['hoistTri', 'diag'],
  };
  const LAYOUT_MEANING = {
    border: 'a framed field for a ruler above all', centerDisc: 'a central disc for a single seat of power',
    nordic: 'a cross of crown and parliament', canton: 'a canton honouring the founding union',
    vTri: 'a vertical tricolour of the republic', hTri: 'a horizontal tricolour of the republic',
    stripes: 'stripes for the federated provinces', plainCanton: 'a single field: one party, one will',
    hBi: 'two bands: the army and the nation', saltire: 'a saltire of the ruling families', diag: 'a diagonal band of commerce',
    quarter: 'quarters for shared power', hoistTri: 'a hoist triangle for the united tribes',
  };
  const RELIGION_EMBLEM = {
    'Christianity': 'cross', 'Islam': 'crescent', 'Hinduism': 'wheel', 'Buddhism': 'wheel', 'Judaism': 'hexagram',
    'Folk Religion': 'tree', 'Sun Cult': 'sun', 'Machine Worship': 'cog', 'Pluralism': 'starRing',
  };
  const IDEO_EMBLEM = {
    Communism: 'star', Socialism: 'star', Fascism: 'shield', Nationalism: 'star', Anarchism: 'circleA', Theocracy: 'sun',
    Monarchism: 'crown', Technocracy: 'cog', Environmentalism: 'tree', Liberalism: 'starRing', Libertarianism: 'starRing',
    Conservatism: 'shield', Populism: 'star', Transhumanism: 'atom',
  };
  const EMBLEM_MEANING = {
    cross: 'the cross of Christianity', crescent: 'the crescent of Islam', wheel: 'the wheel of dharma', hexagram: 'the hexagram of Judaism',
    tree: 'the sacred tree', sun: 'the radiant sun', cog: 'the great machine', starRing: 'a ring of stars for unity in diversity',
    star: 'the guiding star', shield: 'the shield of the nation', circleA: 'the circled A of anarchy', crown: 'the crown',
    atom: 'the atom of progress',
  };

  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function colorDist(a, b) { const x = hexRgb(a), y = hexRgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); }
  function luminance(h) { const [r, g, b] = hexRgb(h); return 0.299 * r + 0.587 * g + 0.114 * b; }
  function contrastOn(bg, prefs) {
    for (const c of prefs) if (colorDist(c, bg) > 140) return c;
    return luminance(bg) > 150 ? '#111111' : '#ffffff';
  }

  function starPoints(cx, cy, r, points, inner) {
    const pts = [];
    for (let k = 0; k < points * 2; k++) {
      const rad = k % 2 ? r * (inner || 0.42) : r;
      const a = -Math.PI / 2 + k * Math.PI / points;
      pts.push((cx + Math.cos(a) * rad).toFixed(1) + ',' + (cy + Math.sin(a) * rad).toFixed(1));
    }
    return pts.join(' ');
  }

  function drawEmblem(kind, x, y, s, col, bg) {
    const f = n => n.toFixed(1);
    switch (kind) {
      case 'star': return `<polygon points="${starPoints(x, y, s, 5)}" fill="${col}"/>`;
      case 'cross': return `<rect x="${f(x - s * 0.16)}" y="${f(y - s)}" width="${f(s * 0.32)}" height="${f(s * 2)}" fill="${col}"/>` +
        `<rect x="${f(x - s * 0.65)}" y="${f(y - s * 0.45)}" width="${f(s * 1.3)}" height="${f(s * 0.32)}" fill="${col}"/>`;
      case 'crescent': return `<circle cx="${x}" cy="${y}" r="${f(s * 0.8)}" fill="${col}"/>` +
        `<circle cx="${f(x + s * 0.3)}" cy="${f(y - s * 0.08)}" r="${f(s * 0.66)}" fill="${bg}"/>` +
        `<polygon points="${starPoints(x + s * 0.5, y - s * 0.05, s * 0.24, 5)}" fill="${col}"/>`;
      case 'wheel': {
        let o = `<circle cx="${x}" cy="${y}" r="${f(s * 0.75)}" fill="none" stroke="${col}" stroke-width="${f(s * 0.14)}"/>` +
          `<circle cx="${x}" cy="${y}" r="${f(s * 0.16)}" fill="${col}"/>`;
        for (let k = 0; k < 8; k++) {
          const a = k * Math.PI / 4;
          o += `<line x1="${x}" y1="${y}" x2="${f(x + Math.cos(a) * s * 0.75)}" y2="${f(y + Math.sin(a) * s * 0.75)}" stroke="${col}" stroke-width="${f(s * 0.08)}"/>`;
        }
        return o;
      }
      case 'hexagram': return `<polygon points="${f(x)},${f(y - s * 0.85)} ${f(x + s * 0.74)},${f(y + s * 0.43)} ${f(x - s * 0.74)},${f(y + s * 0.43)}" fill="none" stroke="${col}" stroke-width="${f(s * 0.12)}"/>` +
        `<polygon points="${f(x)},${f(y + s * 0.85)} ${f(x + s * 0.74)},${f(y - s * 0.43)} ${f(x - s * 0.74)},${f(y - s * 0.43)}" fill="none" stroke="${col}" stroke-width="${f(s * 0.12)}"/>`;
      case 'tree': return `<rect x="${f(x - s * 0.1)}" y="${f(y + s * 0.3)}" width="${f(s * 0.2)}" height="${f(s * 0.6)}" fill="${col}"/>` +
        `<polygon points="${f(x)},${f(y - s)} ${f(x + s * 0.6)},${f(y + s * 0.35)} ${f(x - s * 0.6)},${f(y + s * 0.35)}" fill="${col}"/>`;
      case 'sun': return `<polygon points="${starPoints(x, y, s, 12, 0.62)}" fill="${col}"/><circle cx="${x}" cy="${y}" r="${f(s * 0.45)}" fill="${col}" stroke="${bg}" stroke-width="${f(s * 0.07)}"/>`;
      case 'cog': return `<polygon points="${starPoints(x, y, s * 0.9, 8, 0.72)}" fill="${col}" stroke="${col}" stroke-width="${f(s * 0.15)}" stroke-linejoin="round"/>` +
        `<circle cx="${x}" cy="${y}" r="${f(s * 0.3)}" fill="${bg}"/>`;
      case 'starRing': {
        let o = '';
        for (let k = 0; k < 8; k++) {
          const a = -Math.PI / 2 + k * Math.PI / 4;
          o += `<polygon points="${starPoints(x + Math.cos(a) * s * 0.75, y + Math.sin(a) * s * 0.75, s * 0.2, 5)}" fill="${col}"/>`;
        }
        return o;
      }
      case 'shield': return `<path d="M${f(x - s * 0.65)},${f(y - s * 0.8)} H${f(x + s * 0.65)} V${f(y)} Q${f(x + s * 0.65)},${f(y + s * 0.7)} ${f(x)},${f(y + s)} Q${f(x - s * 0.65)},${f(y + s * 0.7)} ${f(x - s * 0.65)},${f(y)} Z" fill="${col}"/>` +
        `<polygon points="${starPoints(x, y - s * 0.05, s * 0.32, 5)}" fill="${bg}"/>`;
      case 'circleA': return `<circle cx="${x}" cy="${y}" r="${f(s * 0.8)}" fill="none" stroke="${col}" stroke-width="${f(s * 0.12)}"/>` +
        `<path d="M${f(x - s * 0.55)},${f(y + s * 0.75)} L${f(x)},${f(y - s * 0.95)} L${f(x + s * 0.55)},${f(y + s * 0.75)} M${f(x - s * 0.62)},${f(y + s * 0.1)} H${f(x + s * 0.62)}" fill="none" stroke="${col}" stroke-width="${f(s * 0.14)}"/>`;
      case 'crown': return crown(x, y, s, col);
      case 'atom': {
        let o = `<circle cx="${x}" cy="${y}" r="${f(s * 0.16)}" fill="${col}"/>`;
        for (let k = 0; k < 3; k++) o += `<ellipse cx="${x}" cy="${y}" rx="${f(s * 0.9)}" ry="${f(s * 0.32)}" fill="none" stroke="${col}" stroke-width="${f(s * 0.09)}" transform="rotate(${k * 60} ${x} ${y})"/>`;
        return o;
      }
      default: return '';
    }
  }

  function crown(x, y, s, col) {
    const f = n => n.toFixed(1);
    return `<path d="M${f(x - s * 0.7)},${f(y + s * 0.4)} L${f(x - s * 0.8)},${f(y - s * 0.45)} L${f(x - s * 0.35)},${f(y - s * 0.05)} L${f(x)},${f(y - s * 0.6)} L${f(x + s * 0.35)},${f(y - s * 0.05)} L${f(x + s * 0.8)},${f(y - s * 0.45)} L${f(x + s * 0.7)},${f(y + s * 0.4)} Z" fill="${col}"/>`;
  }

  function makeFlag(r, coastal) {
    const meaning = [];
    const ideo = IDEO_COLORS[r.ideology.label] || [['#0052b4', 'blue'], ['#ffffff', 'white']];
    const terr = TERRAIN_COLORS[r.terrain.label] || ['#6a994e', 'the land'];
    const res = RESOURCE_COLORS[r.resource.label] || ['#9e9e9e', 'its resources'];
    // pick three field colours that are distinct enough from each other
    const pool = [ideo[0], terr, res, ideo[1], ['#ffffff', 'white'], ['#111111', 'black']];
    const field = [];
    for (const c of pool) {
      if (field.length >= 3) break;
      if (field.every(x => colorDist(x[0], c[0]) > 70)) field.push(c);
    }
    const [c1, c2, c3] = field.map(x => x[0]);
    field.forEach(([, why], k) => { if (k < 3) meaning.push(`<i style="background:${field[k][0]}"></i>${cap(why)}`); });

    const layouts = LAYOUTS[r.government.label] || ['hTri'];
    const pattern = layouts[R() < 0.7 ? 0 : layouts.length - 1];
    meaning.push(`Layout: ${LAYOUT_MEANING[pattern]} (${r.government.label})`);

    const parts = [];
    const rect = (x, y, w, h, c) => parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`);
    let at = [150, 100], size = 32, bg = c1;
    switch (pattern) {
      case 'hTri': rect(0, 0, 300, 67, c1); rect(0, 67, 300, 66, c2); rect(0, 133, 300, 67, c3); bg = c2; break;
      case 'vTri': rect(0, 0, 100, 200, c1); rect(100, 0, 100, 200, c2); rect(200, 0, 100, 200, c3); bg = c2; break;
      case 'hBi': rect(0, 0, 300, 100, c1); rect(0, 100, 300, 100, c2); at = [70, 50]; size = 28; break;
      case 'plainCanton': rect(0, 0, 300, 200, c1); rect(0, 168, 300, 32, c2); at = [62, 58]; size = 36; break;
      case 'nordic': rect(0, 0, 300, 200, c1); rect(85, 0, 44, 200, c2); rect(0, 78, 300, 44, c2);
        rect(98, 0, 18, 200, c3); rect(0, 91, 300, 18, c3); at = [45, 40]; size = 22; break;
      case 'canton': rect(0, 0, 300, 200, c1); for (let k = 1; k < 7; k += 2) rect(0, k * 200 / 7, 300, 200 / 7, c2);
        rect(0, 0, 132, 115, c3); at = [66, 57]; size = 32; bg = c3; break;
      case 'stripes': for (let k = 0; k < 9; k++) rect(0, k * 200 / 9, 300, 200 / 9 + 0.5, k % 2 ? c2 : c1);
        rect(0, 0, 112, 112, c3); at = [56, 56]; size = 34; bg = c3; break;
      case 'diag': rect(0, 0, 300, 200, c1); parts.push(`<polygon points="0,200 300,0 300,200" fill="${c2}"/>`);
        parts.push(`<polygon points="0,200 0,168 252,0 300,0 300,32 48,200" fill="${c3}"/>`); at = [58, 46]; size = 26; break;
      case 'hoistTri': rect(0, 0, 300, 100, c1); rect(0, 100, 300, 100, c2); parts.push(`<polygon points="0,0 135,100 0,200" fill="${c3}"/>`);
        at = [44, 100]; size = 26; bg = c3; break;
      case 'centerDisc': rect(0, 0, 300, 200, c1); parts.push(`<circle cx="150" cy="100" r="60" fill="${c2}"/>`); size = 38; bg = c2; break;
      case 'border': rect(0, 0, 300, 200, c2); rect(20, 20, 260, 160, c1); break;
      case 'saltire': rect(0, 0, 300, 200, c1); parts.push(`<path d="M0,0 L300,200 M300,0 L0,200" stroke="${c2}" stroke-width="38"/>`);
        parts.push(`<circle cx="150" cy="100" r="40" fill="${c3}"/>`); size = 27; bg = c3; break;
      case 'quarter': rect(0, 0, 150, 100, c1); rect(150, 0, 150, 100, c2); rect(0, 100, 150, 100, c2); rect(150, 100, 150, 100, c1);
        parts.push(`<circle cx="150" cy="100" r="46" fill="${c3}"/>`); size = 30; bg = c3; break;
    }

    if (coastal) {
      parts.push(`<path d="M0,182 Q25,170 50,182 T100,182 T150,182 T200,182 T250,182 T300,182 V200 H0 Z" fill="${SEA[0]}"/>`);
      meaning.push(`<i style="background:${SEA[0]}"></i>Wave: ${SEA[1]}`);
    }

    const ancient = ['Ancient', 'Medieval'].includes(r.founded.label);
    if (ancient) {
      parts.push(`<rect x="4" y="4" width="292" height="192" fill="none" stroke="#d4a017" stroke-width="5"/>`);
      meaning.push(`Gold trim: ${r.founded.label === 'Ancient' ? 'an ancient' : 'a medieval'} lineage`);
    }

    let emblem = RELIGION_EMBLEM[r.religion.label];
    if (emblem) meaning.push(`Emblem: ${EMBLEM_MEANING[emblem]} (${r.religion.label})`);
    else {
      emblem = IDEO_EMBLEM[r.ideology.label] || 'star';
      meaning.push(`Emblem: ${EMBLEM_MEANING[emblem]} (${r.ideology.label})`);
    }
    if (pattern === 'nordic' && emblem === 'cross') emblem = 'crown';
    const col = contrastOn(bg, [ideo[1][0], '#ffd100', '#ffffff', '#111111']);
    const [ex, ey] = at;
    const monarchy = /Monarchy/.test(r.government.label) || r.ideology.label === 'Monarchism';
    if (monarchy && emblem !== 'crown') {
      parts.push(drawEmblem(emblem, ex, ey + size * 0.18, size * 0.78, col, bg));
      parts.push(crown(ex, ey - size * 0.95, size * 0.45, '#d4a017'));
      meaning.push('Crown: rule by a monarch');
    } else parts.push(drawEmblem(emblem, ex, ey, size, col, bg));

    if (r.military.label === 'Nuclear Power') {
      parts.push(drawEmblem('atom', 268, 30, 16, contrastOn(c1, ['#ffd100', '#ffffff', '#111111']), c1));
      meaning.push('Atom: a declared nuclear power');
    }

    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" preserveAspectRatio="none">${parts.join('')}</svg>`,
      meaning,
    };
  }

  /* ---------- climate + stats ---------- */

  function climateOf(lat, landlocked, terrain) {
    const a = Math.abs(lat);
    if (terrain === 'Desert') return a < 35 ? 'Hot desert' : 'Cold desert';
    if (terrain === 'Jungle' && a < 25) return 'Tropical rainforest';
    if (a < 8) return landlocked ? 'Tropical monsoon' : 'Tropical rainforest';
    if (a < 18) return pick(['Tropical savanna', 'Tropical monsoon', 'Tropical savanna']);
    if (a < 30) return landlocked ? pick(['Hot semi-arid', 'Hot desert']) : pick(['Humid subtropical', 'Hot semi-arid', 'Mediterranean']);
    if (a < 42) return landlocked ? pick(['Cold semi-arid', 'Continental']) : pick(['Mediterranean', 'Humid subtropical', 'Temperate oceanic']);
    if (a < 55) return landlocked ? pick(['Humid continental', 'Cold semi-arid']) : pick(['Temperate oceanic', 'Humid continental']);
    if (a < 66) return pick(['Subarctic', 'Boreal', 'Humid continental']);
    return pick(['Tundra', 'Polar']);
  }

  const RESOURCE_MULT = {
    'Oil': 1.5, 'Natural Gas': 1.35, 'Gold': 1.15, 'Diamonds': 1.2, 'Rare Earths': 1.2, 'Lithium': 1.15, 'Uranium': 1.1,
    'Copper': 1.05, 'Iron Ore': 1.05, 'Coal': 0.95, 'Timber': 0.95, 'Fisheries': 1, 'Grain': 0.9, 'Coffee & Spices': 0.9,
    'Tourism': 1.1, 'Absolutely Nothing': 0.75,
  };
  const ECON_MULT = {
    'Free Market': 1.15, 'Mixed Economy': 1.05, 'Planned Economy': 0.7, 'State Capitalism': 0.95, 'Mercantilism': 0.95,
    'Agrarian': 0.6, 'Industrial Powerhouse': 1.1, 'Service Economy': 1.2, 'Tax Haven': 1.8, 'Resource Economy': 1.0,
  };
  const GOV_FREEDOM = {
    'Direct Democracy': 90, 'Parliamentary Republic': 82, 'Constitutional Monarchy': 80, 'Federal Republic': 76,
    'Presidential Republic': 66, 'Tribal Confederation': 50, 'Oligarchy': 34, 'Corporate State': 30, 'Theocratic State': 18,
    'One-Party State': 14, 'Absolute Monarchy': 14, 'Military Junta': 8,
  };
  const IDEO_FREEDOM = {
    Liberalism: 8, Libertarianism: 8, Anarchism: 10, Environmentalism: 3, Socialism: 0, Conservatism: 0, Populism: -4,
    Monarchism: -3, Technocracy: -6, Transhumanism: -2, Nationalism: -8, Communism: -14, Theocracy: -12, Fascism: -25,
  };
  const SECONDARY = ['Oil', 'Natural Gas', 'Gold', 'Silver', 'Diamonds', 'Rare Earths', 'Lithium', 'Uranium', 'Copper',
    'Iron Ore', 'Coal', 'Timber', 'Fisheries', 'Grain', 'Cotton', 'Rubber', 'Coffee', 'Cocoa', 'Tea', 'Wine', 'Cattle',
    'Wool', 'Bauxite', 'Cobalt', 'Nickel', 'Marble', 'Salt', 'Phosphates', 'Hydropower', 'Solar'];

  function terrainHeights(terrain) {
    return ({
      'Mountains': [3500, 8200], 'Highlands': [2200, 4800], 'Rolling Hills': [700, 1900], 'Plains': [150, 900],
      'Wetlands': [40, 400], 'Desert': [600, 3200], 'Jungle': [400, 2500], 'Dense Forest': [500, 2200], 'Steppe': [400, 1800],
      'Canyons': [1500, 3600],
    })[terrain] || [300, 2000];
  }

  function fmtYear(y) { return y < 0 ? `${-y} BC` : y < 1000 ? `${y} AD` : String(y); }

  function build(results, terr, seed) {
    rng = WorldGen.mulberry32(seed);
    const r = results;
    const flavor = WorldGen.CONTINENTS[terr.continent];
    const root = makeRoot(flavor);
    const demonym = demonymOf(root);
    const area = terr.area;
    const density = logBetween(r.population.min, r.population.max);
    const population = Math.max(800, Math.round(area * density));
    const hdi = +between(r.development.min, r.development.max).toFixed(3);
    const gdppc = Math.round(650 * Math.pow(90000 / 650, (hdi - 0.32) / 0.65) * (RESOURCE_MULT[r.resource.label] || 1) *
      (ECON_MULT[r.economy.label] || 1) * between(0.8, 1.25));
    const gdp = gdppc * population;
    const stab = r.stability.score;
    const lifeExp = +clamp(44 + (hdi - 0.3) * 58 + (stab - 2.5) * 0.8 + between(-1.5, 1.5), 38, 88).toFixed(1);
    const literacy = +clamp(28 + (hdi - 0.3) * 115 + between(-4, 4), 12, 99.9).toFixed(1);
    const urban = Math.round(clamp(12 + hdi * 62 + Math.log10(density) * 6 + between(-6, 6), 6, 99));
    const internet = Math.round(clamp((hdi - 0.32) * 155 + between(-6, 6), 1, 99));
    const freedom = Math.round(clamp((GOV_FREEDOM[r.government.label] || 50) + (IDEO_FREEDOM[r.ideology.label] || 0) + between(-6, 6), 1, 99));
    const corruption = Math.round(clamp(hdi * 75 + freedom * 0.25 - 20 + stab * 3 + between(-8, 8), 3, 96));
    const happiness = +clamp(1.5 + hdi * 6 + stab * 0.45 + freedom * 0.01 + between(-0.8, 0.8), 1, 9.9).toFixed(1);
    const unemployment = +clamp(between(2, 9) + (5 - stab) * 1.8 + (r.economy.label === 'Planned Economy' ? -2 : 0), 0.5, 45).toFixed(1);
    const inflation = +clamp(between(0.5, 5) + (5 - stab) * between(0, 4) + (r.economy.label === 'Planned Economy' ? 3 : 0), 0.1, 400).toFixed(1);
    const growth = +clamp(between(-1.5, 6) + (hdi < 0.6 ? 1.5 : 0) - (stab < 2 ? 3 : 0), -12, 14).toFixed(1);
    const debt = Math.round(clamp(between(10, 120) + (r.economy.label === 'Tax Haven' ? -10 : 0), 2, 260));
    const gini = Math.round(clamp(between(24, 48) + (['Oligarchy', 'Corporate State'].includes(r.government.label) ? 12 : 0) -
      (['Socialism', 'Communism'].includes(r.ideology.label) ? 8 : 0), 18, 70));

    const power = r.military.power;
    const milRate = [0.0002, 0.0018, 0.004, 0.007, 0.011, 0.016, 0.014][power];
    const milBudget = [0.1, 0.8, 1.4, 2.3, 3.6, 5.2, 4.4][power] * between(0.8, 1.25);
    const personnel = power === 0 ? Math.round(population * 0.0002) : Math.round(population * milRate * between(0.7, 1.3));
    const warheads = power === 6 ? Math.round(logBetween(15, 900)) : power === 5 && R() < 0.4 ? Math.round(logBetween(5, 120)) : 0;

    const capitalName = cityName(flavor, root);
    const placed = terr.cities.map((pt, k) => {
      const name = k === 0 ? capitalName : cityName(flavor, root);
      const share = k === 0 ? between(0.08, 0.3) : between(0.02, 0.12) / k;
      return { name, lon: pt[0], lat: pt[1], pop: Math.max(500, Math.round(population * share)), capital: k === 0 };
    });
    const cities = [placed[0], ...placed.slice(1).sort((a, b) => b.pop - a.pop)];

    const founded = Math.round(between(r.founded.min, r.founded.max));
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const holiday = `${Math.ceil(R() * 28)} ${pick(months)}`;
    const capLat = cities[0].lat, capLon = cities[0].lon;
    const climate = climateOf(capLat, terr.landlocked, r.terrain.label);
    const [h0, h1] = terrainHeights(r.terrain.label);
    const highest = Math.round(between(h0, h1) * (area < 20000 ? 0.5 : 1));
    const secondary = [];
    while (secondary.length < 3) {
      const sres = pick(SECONDARY);
      if (sres !== r.resource.label && !secondary.includes(sres)) secondary.push(sres);
    }
    const mw = MOTTO_WORDS[r.ideology.label] || ['Unity', 'Work', 'Progress'];
    const shuffled = [...mw].sort(() => R() - 0.5);
    const motto = pick(MOTTO_FORMS).replace('{A}', shuffled[0]).replace('{B}', shuffled[1]).replace('{C}', shuffled[2]);
    const leaderTitle = pick(LEADER_TITLES[r.government.label] || ['Leader']);
    const currency = `${demonym} ${pick(CURRENCIES)}`;
    const code = (root.slice(0, 2) + currency.split(' ').pop().charAt(0)).toUpperCase();
    const utc = Math.round(capLon / 15);
    const tld = '.' + (root.charAt(0) + root.slice(1).replace(/[aeiou]/g, '').charAt(0) || root.slice(0, 2)).toLowerCase();

    const flag = makeFlag(r, !terr.landlocked);
    return {
      root, name: formalName(root, r), demonym, language: languageOf(root, demonym), flag: flag.svg, flagMeaning: flag.meaning, motto,
      capital: capitalName, cities, leader: `${leaderTitle} ${personName(flavor)}`,
      party: (r.government.label === 'Direct Democracy' || r.ideology.label === 'Anarchism') ? 'None (popular assemblies)' :
        `${pick(PARTY[r.ideology.label] || ['Unity Party'])}`,
      animal: pick(ANIMALS),
      currency, currencyCode: code, tld, callingCode: '+' + Math.floor(between(200, 999)),
      timezone: `UTC${utc >= 0 ? '+' : '−'}${Math.abs(utc)}`, drives: R() < 0.7 ? 'Right' : 'Left',
      founded: fmtYear(founded), holiday,
      area, population, density: population / area, hdi, gdp, gdppc, lifeExp, literacy, urban, internet,
      freedom, corruption, happiness, unemployment, inflation, growth, debt, gini,
      personnel, milBudget: +milBudget.toFixed(1), warheads,
      climate, highest, highestName: `Mount ${placeRoot(flavor)}`,
      river: terr.area > 5000 ? `${placeRoot(flavor)} River` : null,
      riverKm: Math.round(Math.sqrt(area) * between(0.9, 2.6)),
      secondary,
    };
  }

  global.NR = Object.assign(global.NR || {}, { Lore: { build } });
})(window);
