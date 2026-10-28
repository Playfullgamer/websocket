/* Nation Roulette — world raster + territory generator.
 *
 * The real world map is rasterised onto a 0.2° lon/lat grid. Every land cell
 * knows which real country and continent it sits in and how far it is from
 * the sea. New nations are "grown" across that grid with a noise-weighted
 * flood fill (Dijkstra over a random terrain cost field), which produces
 * irregular, natural-looking borders that never copy a real border. Along the
 * sea the shape is later clipped to the real coastline so coasts look exact.
 */
(function (global) {
  'use strict';

  const RES = 0.2;
  const W = Math.round(360 / RES);
  const H = Math.round(180 / RES);
  const N = W * H;
  const CELL_KM = RES * 111.32;
  const LL_MIN = 3; // landlocked nations keep this many cells of foreign land between them and the sea

  const CONTINENTS = ['None', 'Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania', 'Antarctica'];

  const CONTINENT_LISTS = {
    1: ['Zimbabwe', 'Zambia', 'Uganda', 'Tunisia', 'Togo', 'Tanzania', 'eSwatini', 'S. Sudan', 'Sudan', 'South Africa',
      'Somalia', 'Somaliland', 'Sierra Leone', 'Seychelles', 'Senegal', 'São Tomé and Principe', 'Rwanda', 'Nigeria',
      'Niger', 'Namibia', 'Mozambique', 'Morocco', 'W. Sahara', 'Mauritius', 'Mauritania', 'Mali', 'Malawi',
      'Madagascar', 'Libya', 'Liberia', 'Lesotho', 'Kenya', 'Guinea-Bissau', 'Guinea', 'Ghana', 'Gambia', 'Gabon',
      'Ethiopia', 'Eritrea', 'Eq. Guinea', 'Egypt', 'Djibouti', "Côte d'Ivoire", 'Dem. Rep. Congo', 'Congo', 'Comoros',
      'Chad', 'Central African Rep.', 'Cabo Verde', 'Cameroon', 'Burundi', 'Burkina Faso', 'Botswana', 'Benin',
      'Angola', 'Algeria', 'Saint Helena'],
    2: ['Yemen', 'Vietnam', 'Uzbekistan', 'United Arab Emirates', 'Turkmenistan', 'Turkey', 'Timor-Leste', 'Thailand',
      'Tajikistan', 'Taiwan', 'Syria', 'Sri Lanka', 'South Korea', 'Singapore', 'Saudi Arabia', 'Qatar', 'Philippines',
      'Pakistan', 'Oman', 'North Korea', 'Nepal', 'Mongolia', 'Maldives', 'Malaysia', 'Laos', 'Lebanon', 'Kyrgyzstan',
      'Kuwait', 'Kazakhstan', 'Jordan', 'Japan', 'Israel', 'Palestine', 'Iraq', 'Iran', 'Indonesia', 'India', 'Georgia',
      'China', 'Macao', 'Hong Kong', 'Cambodia', 'Myanmar', 'Brunei', 'Bhutan', 'Bangladesh', 'Bahrain', 'Azerbaijan',
      'Armenia', 'Afghanistan', 'Siachen Glacier', 'Br. Indian Ocean Ter.', 'N. Cyprus', 'Cyprus',
      'Indian Ocean Ter.', 'Russia'],
    3: ['Vatican', 'Ukraine', 'United Kingdom', 'Jersey', 'Guernsey', 'Isle of Man', 'Switzerland', 'Sweden', 'Spain',
      'Slovakia', 'Slovenia', 'Serbia', 'San Marino', 'Romania', 'Portugal', 'Poland', 'Norway', 'Netherlands',
      'Montenegro', 'Moldova', 'Monaco', 'Malta', 'Macedonia', 'Luxembourg', 'Lithuania', 'Liechtenstein', 'Latvia',
      'Kosovo', 'Italy', 'Ireland', 'Iceland', 'Hungary', 'Greece', 'Germany', 'France', 'Åland', 'Finland', 'Estonia',
      'Faeroe Is.', 'Denmark', 'Czechia', 'Croatia', 'Bulgaria', 'Bosnia and Herz.', 'Belgium', 'Belarus', 'Austria',
      'Andorra', 'Albania'],
    4: ['United States of America', 'U.S. Virgin Is.', 'Puerto Rico', 'Anguilla', 'Cayman Is.', 'Bermuda',
      'British Virgin Is.', 'Turks and Caicos Is.', 'Montserrat', 'Trinidad and Tobago', 'St. Vin. and Gren.',
      'Saint Lucia', 'St. Kitts and Nevis', 'Panama', 'Nicaragua', 'Mexico', 'Jamaica', 'Honduras', 'Haiti',
      'Guatemala', 'Grenada', 'St. Pierre and Miquelon', 'St-Martin', 'St-Barthélemy', 'El Salvador', 'Dominican Rep.',
      'Dominica', 'Greenland', 'Cuba', 'Costa Rica', 'Canada', 'Belize', 'Barbados', 'Bahamas', 'Antigua and Barb.',
      'Aruba', 'Curaçao', 'Sint Maarten'],
    5: ['Venezuela', 'Uruguay', 'Suriname', 'Peru', 'Paraguay', 'Guyana', 'Ecuador', 'Colombia', 'Chile', 'Brazil',
      'Bolivia', 'Argentina', 'Falkland Is.'],
    6: ['Vanuatu', 'Micronesia', 'Marshall Is.', 'N. Mariana Is.', 'Guam', 'American Samoa', 'Pitcairn Is.', 'Tonga',
      'Solomon Is.', 'Samoa', 'Papua New Guinea', 'Palau', 'New Zealand', 'Niue', 'Cook Is.', 'Nauru', 'Kiribati',
      'Wallis and Futuna Is.', 'Fr. Polynesia', 'New Caledonia', 'Fiji', 'Australia', 'Norfolk Island',
      'Ashmore and Cartier Is.'],
    7: ['Antarctica', 'Fr. S. Antarctic Lands', 'Heard I. and McDonald Is.', 'S. Geo. and the Is.'],
  };
  const CONTINENT_OF = {};
  Object.keys(CONTINENT_LISTS).forEach(c => CONTINENT_LISTS[c].forEach(n => { CONTINENT_OF[n] = +c; }));

  // Where in the continent's (lon, lat) range each region wheel result points.
  const REGION_TARGET = {
    'North': [0.5, 0.86], 'North-East': [0.84, 0.84], 'East': [0.88, 0.5], 'South-East': [0.84, 0.16],
    'South': [0.5, 0.14], 'South-West': [0.16, 0.16], 'West': [0.12, 0.5], 'North-West': [0.16, 0.84],
    'Central': [0.5, 0.5],
  };

  const NB4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const NB8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  const countryId = new Int16Array(N).fill(-1);
  const continent = new Uint8Array(N);
  const coastDist = new Uint16Array(N);
  const comp = new Int32Array(N).fill(-1);
  const compSize = [];
  const owner = new Uint16Array(N);
  const cosLat = new Float64Array(H);
  const dist = new Float32Array(N).fill(Infinity);
  const mark = new Uint8Array(N);
  const scratch = new Int32Array(N);

  let features = [];
  let countryArea = [];
  let countryCont = [];
  const contInfo = [];

  function lonOf(x) { return -180 + (x + 0.5) * RES; }
  function latOf(y) { return 90 - (y + 0.5) * RES; }
  for (let y = 0; y < H; y++) cosLat[y] = Math.max(0.02, Math.cos(latOf(y) * Math.PI / 180));
  function cellArea(y) { return CELL_KM * CELL_KM * cosLat[y]; }
  function contLon(c, lon) { return (c === 2 || c === 6) && lon < -25 ? lon + 360 : lon; }

  /* ---------- tiny utilities ---------- */

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class Heap {
    constructor() { this.idx = []; this.pri = []; }
    get size() { return this.idx.length; }
    push(i, p) {
      const idx = this.idx, pri = this.pri;
      let n = idx.length;
      idx.push(i); pri.push(p);
      while (n > 0) {
        const parent = (n - 1) >> 1;
        if (pri[parent] <= p) break;
        idx[n] = idx[parent]; pri[n] = pri[parent];
        n = parent;
      }
      idx[n] = i; pri[n] = p;
    }
    pop() {
      const idx = this.idx, pri = this.pri;
      const topI = idx[0], topP = pri[0];
      const lastI = idx.pop(), lastP = pri.pop();
      const len = idx.length;
      if (len > 0) {
        let n = 0;
        for (;;) {
          let l = 2 * n + 1, r = l + 1, m = n, mp = lastP;
          if (l < len && pri[l] < mp) { m = l; mp = pri[l]; }
          if (r < len && pri[r] < mp) { m = r; }
          if (m === n) break;
          idx[n] = idx[m]; pri[n] = pri[m];
          n = m;
        }
        idx[n] = lastI; pri[n] = lastP;
      }
      this.lastP = topP;
      return topI;
    }
  }

  function makeNoise(rng) {
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    const perm = new Uint16Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const val = new Float32Array(256);
    for (let i = 0; i < 256; i++) val[i] = rng();
    const fade = t => t * t * (3 - 2 * t);
    function vn(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const u = fade(x - xi), v = fade(y - yi);
      const X = xi & 255, Y = yi & 255;
      const a = val[perm[perm[X] + Y]], b = val[perm[perm[X + 1] + Y]];
      const c = val[perm[perm[X] + Y + 1]], d = val[perm[perm[X + 1] + Y + 1]];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    function fbm(x, y) {
      let s = 0, amp = 0.5, f = 1, norm = 0;
      for (let o = 0; o < 4; o++) {
        s += amp * vn(x * f + o * 17.31, y * f + o * 9.17);
        norm += amp; amp *= 0.5; f *= 2.03;
      }
      return s / norm;
    }
    return { vn, fbm };
  }

  /* ---------- world setup ---------- */

  function init(topo) {
    features = topojson.feature(topo, topo.objects.countries).features;
    countryArea = new Array(features.length).fill(0);
    rasterize();
    assignContinents();
    computeCoastDist();
    labelComponents();
    computeContinentInfo();
  }

  function rasterize() {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const proj = d3.geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]).precision(0.05);
    const drawPath = d3.geoPath(proj, ctx);
    const boundsPath = d3.geoPath(proj);
    ctx.fillStyle = '#fff';
    features.forEach((f, k) => {
      const b = boundsPath.bounds(f);
      if (!isFinite(b[0][0])) return;
      const x0 = Math.max(0, Math.floor(b[0][0]) - 1), y0 = Math.max(0, Math.floor(b[0][1]) - 1);
      const x1 = Math.min(W, Math.ceil(b[1][0]) + 1), y1 = Math.min(H, Math.ceil(b[1][1]) + 1);
      const w = x1 - x0, h = y1 - y0;
      if (w <= 0 || h <= 0) return;
      ctx.clearRect(x0, y0, w, h);
      ctx.beginPath(); drawPath(f); ctx.fill();
      const img = ctx.getImageData(x0, y0, w, h).data;
      for (let yy = 0; yy < h; yy++) {
        const row = (y0 + yy) * W + x0;
        for (let xx = 0; xx < w; xx++) {
          if (img[(yy * w + xx) * 4 + 3] >= 128) countryId[row + xx] = k;
        }
      }
    });
  }

  function guessContinent(f) {
    const [lon, lat] = d3.geoCentroid(f);
    if (lat < -55) return 7;
    if (lon < -30) return lat > 12 ? 4 : 5;
    if (lon > 110 && lat < -8) return 6;
    if (lon > 150 || lon < -150) return 6;
    if (lat > 36 && lon < 45) return 3;
    if (lon < 52 && lat < 36 && !(lon > 34 && lat > 12)) return 1;
    return 2;
  }

  function assignContinents() {
    countryCont = features.map(f => CONTINENT_OF[f.properties.name] || guessContinent(f));
    for (let y = 0; y < H; y++) {
      const lat = latOf(y);
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const id = countryId[i];
        if (id < 0) continue;
        const lon = lonOf(x);
        const name = features[id].properties.name;
        let c = countryCont[id];
        if (name === 'Russia') c = (lon > 0 && lon < 60) ? 3 : 2;
        else if (c === 3 && lon < -35) c = lat > 10 ? 4 : 5;
        else if (c === 3 && lat < 30) c = 1;
        else if (name === 'United States of America' && lon < -140 && lat < 30) c = 6;
        continent[i] = c;
        countryArea[id] += cellArea(y);
      }
    }
  }

  function computeCoastDist() {
    const q = scratch;
    let head = 0, tail = 0;
    for (let i = 0; i < N; i++) coastDist[i] = countryId[i] < 0 ? 0 : 65535;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (countryId[i] < 0) continue;
        for (const [dx, dy] of NB4) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          if (countryId[ny * W + nx] < 0) { coastDist[i] = 1; q[tail++] = i; break; }
        }
      }
    }
    while (head < tail) {
      const i = q[head++];
      const y = (i / W) | 0, x = i - y * W;
      const d = coastDist[i] + 1;
      for (const [dx, dy] of NB4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        const j = ny * W + nx;
        if (coastDist[j] > d) { coastDist[j] = d; q[tail++] = j; }
      }
    }
  }

  function labelComponents() {
    const q = scratch;
    for (let s = 0; s < N; s++) {
      if (countryId[s] < 0 || comp[s] >= 0) continue;
      const label = compSize.length;
      let head = 0, tail = 0;
      const cs = continent[s];
      q[tail++] = s; comp[s] = label;
      while (head < tail) {
        const i = q[head++];
        const y = (i / W) | 0, x = i - y * W;
        for (const [dx, dy] of NB4) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          const j = ny * W + nx;
          if (continent[j] === cs && comp[j] < 0) { comp[j] = label; q[tail++] = j; }
        }
      }
      compSize.push(tail);
    }
  }

  function computeContinentInfo() {
    for (let c = 1; c <= 6; c++) {
      const cells = [];
      for (let i = 0; i < N; i++) if (continent[i] === c) cells.push(i);
      const lons = [], lats = [];
      let maxCoast = 0, maxComp = 0;
      for (let k = 0; k < cells.length; k++) {
        const i = cells[k];
        const y = (i / W) | 0, x = i - y * W;
        if (k % 3 === 0) { lons.push(contLon(c, lonOf(x))); lats.push(latOf(y)); }
        if (coastDist[i] > maxCoast) maxCoast = coastDist[i];
        if (compSize[comp[i]] > maxComp) maxComp = compSize[comp[i]];
      }
      lons.sort((a, b) => a - b); lats.sort((a, b) => a - b);
      const q = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))];
      contInfo[c] = {
        cells: Int32Array.from(cells),
        lon0: q(lons, 0.04), lon1: q(lons, 0.96), lat0: q(lats, 0.04), lat1: q(lats, 0.96),
        maxCoast, maxComp,
      };
    }
  }

  /* ---------- territory generation ---------- */

  function allowedFn(c, landlocked) {
    return j => countryId[j] >= 0 && continent[j] === c && owner[j] === 0 && (!landlocked || coastDist[j] >= LL_MIN);
  }

  function pickSeed(c, region, landlocked, targetArea, rng, relax) {
    const info = contInfo[c];
    const [tu, tv] = REGION_TARGET[region] || REGION_TARGET.Central;
    const approxCells = targetArea / (CELL_KM * CELL_KM * 0.8);
    const radius = Math.sqrt(approxCells / Math.PI);
    let minD, maxD;
    if (landlocked) {
      minD = relax >= 2 ? LL_MIN : Math.min(LL_MIN + Math.ceil(radius * (relax ? 0.25 : 0.55)), info.maxCoast);
      maxD = 65535;
    } else {
      minD = 1;
      maxD = relax >= 1 ? 1 : Math.max(1, Math.floor(radius * 0.3));
    }
    const minComp = relax >= 2 ? 0 : Math.min(approxCells * 1.3, info.maxComp * 0.5);
    const du = 1 / Math.max(1e-6, info.lon1 - info.lon0), dv = 1 / Math.max(1e-6, info.lat1 - info.lat0);
    const cand = [], score = [];
    const cells = info.cells;
    for (let k = 0; k < cells.length; k++) {
      const i = cells[k];
      if (owner[i]) continue;
      const d = coastDist[i];
      if (d < minD || d > maxD) continue;
      if (compSize[comp[i]] < minComp) continue;
      const y = (i / W) | 0, x = i - y * W;
      const u = (contLon(c, lonOf(x)) - info.lon0) * du - tu;
      const v = (latOf(y) - info.lat0) * dv - tv;
      cand.push(i); score.push(u * u + v * v);
    }
    if (!cand.length) return -1;
    const order = cand.map((_, k) => k).sort((a, b) => score[a] - score[b]);
    const pool = Math.max(1, Math.min(order.length, 40 + Math.floor(order.length * 0.01)));
    return cand[order[Math.floor(rng() * pool)]];
  }

  function growParams(seed, targetArea, rng) {
    const radius = Math.sqrt(targetArea / cellArea((seed / W) | 0) / Math.PI);
    const scale = Math.max(2, radius * (0.55 + rng() * 0.35));
    return {
      noise: makeNoise(rng), scale, fine: Math.max(1.5, scale * 0.22),
      stretch: 0.65 + rng() * 0.75, contrast: 1.5 + rng() * 1.2,
    };
  }

  function grow(seed, c, landlocked, targetArea, params) {
    const ok = allowedFn(c, landlocked);
    const { noise, scale, fine, stretch, contrast } = params;
    const heap = new Heap();
    const touched = [seed];
    const cells = [];
    let area = 0;
    dist[seed] = 0;
    heap.push(seed, 0);
    while (heap.size && area < targetArea) {
      const i = heap.pop();
      const d = heap.lastP;
      if (mark[i] || d > dist[i]) continue;
      mark[i] = 1;
      cells.push(i);
      const y = (i / W) | 0, x = i - y * W;
      area += cellArea(y);
      for (const [dx, dy] of NB8) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        const j = ny * W + nx;
        if (mark[j] || !ok(j)) continue;
        const n = noise.fbm(nx / scale, ny / scale);
        const t = Math.min(1, Math.max(0, (n - 0.5) * contrast + 0.5));
        const cost = 0.45 + 2.2 * t * t + 0.35 * noise.vn(nx / fine + 311, ny / fine + 173);
        const hx = dx * cosLat[ny] * stretch, hy = dy / stretch;
        const nd = d + Math.sqrt(hx * hx + hy * hy) * cost;
        if (nd < dist[j]) {
          if (dist[j] === Infinity) touched.push(j);
          dist[j] = nd;
          heap.push(j, nd);
        }
      }
    }
    for (let k = 0; k < touched.length; k++) dist[touched[k]] = Infinity;
    for (let k = 0; k < cells.length; k++) mark[cells[k]] = 0;
    return cells;
  }

  function bboxOf(cells, pad) {
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (const i of cells) {
      const y = (i / W) | 0, x = i - y * W;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
    x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
    return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  // Remove one-cell spurs, fill notches and enclosed holes so borders look deliberate.
  function tidy(cells, c, landlocked, seed) {
    const ok = allowedFn(c, landlocked);
    const bb = bboxOf(cells, 4);
    const { x0, y0, w, h } = bb;
    const m = new Uint8Array(w * h);
    for (const i of cells) { const y = (i / W) | 0, x = i - y * W; m[(y - y0) * w + (x - x0)] = 1; }
    const g = (lx, ly) => (lx < 0 || ly < 0 || lx >= w || ly >= h) ? 0 : m[ly * w + lx];
    const seedL = (((seed / W) | 0) - y0) * w + (seed % W - x0);
    for (let pass = 0; pass < 2; pass++) {
      const next = m.slice();
      for (let ly = 0; ly < h; ly++) for (let lx = 0; lx < w; lx++) {
        const li = ly * w + lx;
        const c4 = g(lx + 1, ly) + g(lx - 1, ly) + g(lx, ly + 1) + g(lx, ly - 1);
        const c8 = c4 + g(lx + 1, ly + 1) + g(lx - 1, ly - 1) + g(lx - 1, ly + 1) + g(lx + 1, ly - 1);
        if (m[li]) { if (c8 <= 1 && li !== seedL && cells.length > 8) next[li] = 0; }
        else if (c4 >= 3 && ok((y0 + ly) * W + x0 + lx)) next[li] = 1;
      }
      m.set(next);
    }
    // Morphological clean-up: closing fills narrow inlets and pinholes, opening
    // trims thin tentacles. Sea, other nations etc. count as "present" while
    // eroding so coasts and existing borders are left alone.
    const okL = new Uint8Array(w * h);
    for (let li = 0; li < w * h; li++) okL[li] = ok((y0 + ((li / w) | 0)) * W + x0 + li % w) ? 1 : 0;
    const morph = (src, r, dilating) => {
      const out = new Uint8Array(w * h);
      for (let ly = 0; ly < h; ly++) for (let lx = 0; lx < w; lx++) {
        const li = ly * w + lx;
        if (dilating ? !okL[li] && !src[li] : !src[li]) continue;
        let hit = !dilating;
        for (let dy = -r; dy <= r && hit === !dilating; dy++) for (let dx = -r; dx <= r; dx++) {
          const nx = lx + dx, ny = ly + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (dilating && src[ni]) { hit = true; break; }
          if (!dilating && !src[ni] && okL[ni]) { hit = false; break; }
        }
        out[li] = src[li] || hit ? 1 : 0;
        if (!dilating) out[li] = hit ? 1 : 0;
      }
      return out;
    };
    const n0 = cells.length;
    if (n0 > 30) m.set(morph(morph(m, 2, true), 2, false));
    if (n0 > 150) m.set(morph(morph(m, 1, false), 1, true).map((v, li) => v && (m[li] || okL[li]) ? 1 : 0));
    // Keep only the piece containing the seed (or the largest piece if the seed was trimmed).
    {
      const lab = new Int32Array(w * h).fill(-1);
      const sizes = [];
      for (let st = 0; st < w * h; st++) {
        if (!m[st] || lab[st] >= 0) continue;
        const id = sizes.length, q = [st];
        lab[st] = id;
        for (let k = 0; k < q.length; k++) {
          const li = q[k], ly = (li / w) | 0, lx = li - ly * w;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = lx + dx, ny = ly + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const ni = ny * w + nx;
            if (m[ni] && lab[ni] < 0) { lab[ni] = id; q.push(ni); }
          }
        }
        sizes.push(q.length);
      }
      if (sizes.length > 1) {
        let keep = seedL >= 0 && seedL < w * h ? lab[seedL] : -1;
        if (keep < 0) keep = sizes.indexOf(Math.max(...sizes));
        for (let li = 0; li < w * h; li++) if (lab[li] !== keep) m[li] = 0;
      }
    }
    // Fill fully enclosed holes (land only, unclaimed). The flood is 8-connected so
    // diagonal gaps in the border don't count as enclosures.
    const reach = new Uint8Array(w * h);
    const q = [];
    for (let lx = 0; lx < w; lx++) { q.push(lx, (h - 1) * w + lx); }
    for (let ly = 0; ly < h; ly++) { q.push(ly * w, ly * w + w - 1); }
    while (q.length) {
      const li = q.pop();
      if (reach[li] || m[li]) continue;
      reach[li] = 1;
      const ly = (li / w) | 0, lx = li - ly * w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = lx + dx, ny = ly + dy;
        if ((dx || dy) && nx >= 0 && ny >= 0 && nx < w && ny < h) q.push(ny * w + nx);
      }
    }
    const out = [];
    for (let li = 0; li < w * h; li++) {
      const ly = (li / w) | 0, lx = li - ly * w;
      const gi = (y0 + ly) * W + x0 + lx;
      if (m[li]) out.push(gi);
      else if (!reach[li] && ok(gi)) out.push(gi);
    }
    return out;
  }

  function chaikin(ring, iterations) {
    let pts = ring.slice(0, -1);
    for (let it = 0; it < iterations; it++) {
      const next = [];
      for (let k = 0; k < pts.length; k++) {
        const a = pts[k], b = pts[(k + 1) % pts.length];
        next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
        next.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
      }
      pts = next;
    }
    pts.push(pts[0]);
    return pts;
  }

  // One displacement field shared by every nation, so borders between two
  // generated nations wiggle identically from both sides. Works in global grid coords.
  const borderNoise = makeNoise(mulberry32(918273));
  function roughen(ring, ampAt) {
    const pts = ring.slice(0, -1);
    const dense = [];
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k], b = pts[(k + 1) % pts.length];
      const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.3));
      for (let t = 0; t < steps; t++) dense.push([a[0] + (b[0] - a[0]) * t / steps, a[1] + (b[1] - a[1]) * t / steps]);
    }
    const out = dense.map(([x, y]) => {
      const amp = ampAt(x, y);
      if (!amp) return [x, y];
      const X = x * 0.45, Y = y * 0.45;
      return [x + (borderNoise.fbm(X, Y) - 0.5) * 2.4 * amp, y + (borderNoise.fbm(X + 71.3, Y + 37.9) - 0.5) * 2.4 * amp];
    });
    out.push(out[0]);
    return out;
  }

  // Closest point on any straight border segment: [distance, x, y].
  function nearestOnLines(x, y, lines) {
    let best = [Infinity, x, y];
    for (const [[ax, ay], [bx, by]] of lines) {
      const dx = bx - ax, dy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      const qx = ax + dx * t, qy = ay + dy * t;
      const d = Math.hypot(x - qx, y - qy);
      if (d < best[0]) best = [d, qx, qy];
    }
    return best;
  }

  // Pull points that sit on a raster staircase back onto the exact straight line.
  function snapToLines(ring, lines) {
    const out = ring.slice(0, -1).map(([x, y]) => {
      const gx = Math.floor(x), gy = Math.floor(y);
      if (gx < 0 || gy < 0 || gx >= W || gy >= H || countryId[gy * W + gx] < 0) return [x, y]; // coast: clipped anyway
      const [d, qx, qy] = nearestOnLines(x, y, lines);
      return d < 1.4 ? [qx, qy] : [x, y];
    });
    out.push(out[0]);
    return out;
  }

  function dropCollinear(ring) {
    const pts = ring.slice(0, -1);
    if (pts.length < 5) return ring;
    const out = [];
    for (let k = 0; k < pts.length; k++) {
      const a = pts[(k - 1 + pts.length) % pts.length], b = pts[k], c = pts[(k + 1) % pts.length];
      const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (Math.abs(cross) > 1e-6) out.push(b);
    }
    out.push(out[0]);
    return out.length >= 4 ? out : ring;
  }

  // Raster cells -> GeoJSON MultiPolygon in lon/lat. Natural borders get a fractal
  // wiggle; straight borders are snapped exactly onto their survey lines.
  function toGeometry(cells, coastal, style, lines) {
    const set = new Set(cells);
    const pad = 4;
    const bb = bboxOf(cells, pad);
    const { x0, y0, w, h } = bb;
    let vals = new Float64Array(w * h);
    for (let ly = 0; ly < h; ly++) for (let lx = 0; lx < w; lx++) {
      const gi = (y0 + ly) * W + x0 + lx;
      if (set.has(gi)) { vals[ly * w + lx] = 1; continue; }
      // Bleed a little into the sea; the map clips the result to the real coastline.
      if (coastal && countryId[gi] < 0) {
        let near = false;
        for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) {
          const nx = x0 + lx + dx, ny = y0 + ly + dy;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && set.has(ny * W + nx)) { near = true; break; }
        }
        if (near) vals[ly * w + lx] = 1;
      }
    }
    const big = cells.length > 80;
    if (big) d3.blur2({ data: vals, width: w, height: h }, 1);
    const contour = d3.contours().size([w, h]).thresholds([0.5])(vals)[0];
    const baseAmp = Math.min(0.75, 0.3 + cells.length / 300);
    const ampAt = style === 'straight' ? () => 0
      : style === 'mixed' ? (x, y) => baseAmp * Math.max(0, Math.min(1, (nearestOnLines(x, y, lines)[0] - 1.5) / 2.5))
        : () => baseAmp;
    const polys = [];
    for (const poly of contour.coordinates) {
      const rings = poly.map(r => {
        let ring = chaikin(dropCollinear(r), big ? 2 : 3).map(([px, py]) => [x0 + px, y0 + py]);
        if (style !== 'straight') ring = roughen(ring, ampAt);
        if (lines.length) ring = dropCollinear(snapToLines(ring, lines));
        return ring.map(([gx, gy]) => [+(-180 + gx * RES).toFixed(3), +(90 - gy * RES).toFixed(3)]);
      });
      const p = { type: 'Polygon', coordinates: rings };
      if (d3.geoArea(p) > 2 * Math.PI) rings.forEach(r => r.reverse());
      polys.push(rings);
    }
    return { type: 'MultiPolygon', coordinates: polys };
  }

  /* ---------- straight ("ruler-drawn") and mixed border shapes ---------- */

  // Cells reachable from the seed (8-connected) through allowed cells that pass `inside`.
  function floodFrom(seed, ok, inside, limitArea) {
    const out = [seed];
    mark[seed] = 1;
    let area = 0;
    for (let h = 0; h < out.length; h++) {
      const i = out[h];
      const y = (i / W) | 0, x = i - y * W;
      area += cellArea(y);
      if (area > limitArea) break;
      for (const [dx, dy] of NB8) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        const j = ny * W + nx;
        if (mark[j] || !ok(j) || !inside(nx + 0.5, ny + 0.5)) continue;
        mark[j] = 1;
        out.push(j);
      }
    }
    for (const i of out) mark[i] = 0;
    return out;
  }

  function areaOf(cs) { let a = 0; for (const i of cs) a += cellArea((i / W) | 0); return a; }

  // A random polygon around the seed, scaled until the land inside matches the target area.
  function straightShape(seed, c, ll, targetArea, rng) {
    const ok = allowedFn(c, ll);
    const sy = (seed / W) | 0, sx = seed - sy * W;
    const cx = sx + 0.5, cy = sy + 0.5, cl = cosLat[sy];
    const n = 4 + Math.floor(rng() * 4);
    const a0 = rng() * Math.PI * 2;
    let unit = [];
    for (let k = 0; k < n; k++) {
      const a = a0 + (k + (rng() - 0.5) * 0.55) * Math.PI * 2 / n;
      const rr = 0.65 + rng() * 0.7;
      unit.push([Math.cos(a) * rr / cl, Math.sin(a) * rr]);
    }
    // Lay one or two edges along a parallel or meridian, like many colonial-era borders.
    const plain = unit.map(p => p.slice());
    for (let t = 0; t < 2; t++) {
      if (rng() > 0.65) continue;
      const k = Math.floor(rng() * n), a = unit[k], b = unit[(k + 1) % n];
      if (Math.abs(b[1] - a[1]) < Math.abs(b[0] - a[0]) * cl) { const m = (a[1] + b[1]) / 2; a[1] = b[1] = m; }
      else { const m = (a[0] + b[0]) / 2; a[0] = b[0] = m; }
    }
    const pip = (poly, x, y) => {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    };
    if (!pip(unit, 0, 0)) unit = plain;
    const cellsAt = scale => floodFrom(seed, ok, (x, y) => pip(unit, (x - cx) / scale, (y - cy) / scale), targetArea * 4);
    const r0 = Math.sqrt(targetArea / cellArea(sy) / Math.PI);
    let lo = 0.5, hi = r0 * 3 + 6, cells = [seed];
    for (let it = 0; it < 14; it++) {
      const mid = (lo + hi) / 2;
      cells = cellsAt(mid);
      if (areaOf(cells) < targetArea) lo = mid; else hi = mid;
    }
    cells = cellsAt(hi);
    const poly = unit.map(([ux, uy]) => [cx + ux * hi, cy + uy * hi]);
    const lines = poly.map((p, k) => [p, poly[(k + 1) % poly.length]]);
    return { cells, lines };
  }

  // A natural shape trimmed by one or two straight cuts.
  function mixedShape(seed, c, ll, targetArea, rng, natural) {
    const ok = allowedFn(c, ll);
    const sy = (seed / W) | 0, sx = seed - sy * W;
    const cl = cosLat[sy];
    const cuts = rng() < 0.6 ? 1 : 2;
    let cells = natural(targetArea * (cuts === 1 ? 1.6 : 2.2));
    const lines = [];
    for (let k = 0; k < cuts; k++) {
      const goal = k === cuts - 1 ? targetArea : Math.sqrt(areaOf(cells) * targetArea);
      const roll = rng();
      const theta = roll < 0.3 ? 0 : roll < 0.6 ? Math.PI / 2 : rng() * Math.PI * 2;
      const nx = Math.cos(theta), ny = Math.sin(theta);
      const proj = i => { const y = (i / W) | 0, x = i - y * W; return (x + 0.5 - sx - 0.5) * cl * nx + (y + 0.5 - sy - 0.5) * ny; };
      let maxP = 1;
      for (const i of cells) maxP = Math.max(maxP, proj(i));
      if (maxP <= 2) continue;
      const set = new Set(cells);
      const keep = o => floodFrom(seed, j => set.has(j) && ok(j), (x, y) => (x - sx - 0.5) * cl * nx + (y - sy - 0.5) * ny < o, Infinity);
      let lo = 1, hi = maxP, best = cells;
      for (let it = 0; it < 12; it++) {
        const mid = (lo + hi) / 2;
        const kept = keep(mid);
        if (areaOf(kept) < goal) lo = mid; else { hi = mid; best = kept; }
      }
      if (best.length === cells.length) continue;
      cells = best;
      // The cut line in grid coords, long enough to cover the whole nation.
      const L = 4000;
      const px = sx + 0.5 + hi * nx / cl, py = sy + 0.5 + hi * ny;
      const tx = -ny / cl, ty = nx;
      lines.push([[px - tx * L, py - ty * L], [px + tx * L, py + ty * L]]);
    }
    return { cells, lines };
  }

  function analyze(cells) {
    for (const i of cells) mark[i] = 1;
    let area = 0, coastEdges = 0, sumLon = 0, sumLat = 0, latMin = 90, latMax = -90;
    const neighbors = new Map(), carved = new Map();
    const q = scratch;
    let tail = 0;
    for (const i of cells) {
      const y = (i / W) | 0, x = i - y * W;
      const a = cellArea(y);
      area += a; sumLon += lonOf(x) * a; sumLat += latOf(y) * a;
      latMin = Math.min(latMin, latOf(y)); latMax = Math.max(latMax, latOf(y));
      const cid = countryId[i];
      carved.set(cid, (carved.get(cid) || 0) + a);
      let edge = false;
      for (const [dx, dy] of NB4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) { edge = true; continue; }
        const j = ny * W + nx;
        if (mark[j]) continue;
        edge = true;
        if (countryId[j] < 0) { coastEdges++; continue; }
        const key = owner[j] ? 'n' + owner[j] : 'c' + countryId[j];
        neighbors.set(key, (neighbors.get(key) || 0) + 1);
      }
      dist[i] = edge ? 1 : Infinity;
      if (edge) q[tail++] = i;
    }
    // Interior distance (how deep inside the nation each cell is).
    let head = 0, maxDepth = 1;
    while (head < tail) {
      const i = q[head++];
      const y = (i / W) | 0, x = i - y * W;
      for (const [dx, dy] of NB4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        const j = ny * W + nx;
        if (mark[j] && dist[j] > dist[i] + 1) { dist[j] = dist[i] + 1; maxDepth = Math.max(maxDepth, dist[j]); q[tail++] = j; }
      }
    }
    const depth = new Map();
    for (const i of cells) depth.set(i, dist[i]);
    for (const i of cells) { dist[i] = Infinity; mark[i] = 0; }
    return {
      area, coastEdges, depth, maxDepth, latMin, latMax,
      centroid: [sumLon / area, sumLat / area],
      neighbors: [...neighbors.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1])
        .map(([key, n]) => ({ type: key[0] === 'n' ? 'nation' : 'country', id: +key.slice(1), shared: n })),
      carved: [...carved.entries()].sort((a, b) => b[1] - a[1])
        .map(([id, a]) => ({ id, name: features[id].properties.name, area: a, pct: a / countryArea[id] * 100 })),
    };
  }

  function pickCities(cells, info, coastal, count, rng) {
    const pts = [];
    const deep = cells.filter(i => info.depth.get(i) >= Math.max(1, info.maxDepth * 0.55));
    let capital;
    if (coastal && rng() < 0.45) {
      const shore = cells.filter(i => coastDist[i] === 1 && info.depth.get(i) <= 2);
      capital = shore.length ? shore[Math.floor(rng() * shore.length)] : null;
    }
    if (capital == null) capital = (deep.length ? deep : cells)[Math.floor(rng() * (deep.length || cells.length))];
    pts.push(capital);
    for (let k = 1; k < count; k++) {
      let best = -1, bestScore = -1;
      for (let t = 0; t < 60; t++) {
        const i = cells[Math.floor(rng() * cells.length)];
        const y = (i / W) | 0, x = i - y * W;
        let dmin = Infinity;
        for (const p of pts) {
          const py = (p / W) | 0, px = p - py * W;
          dmin = Math.min(dmin, Math.hypot((x - px) * cosLat[y], y - py));
        }
        const s = dmin * (coastDist[i] === 1 ? 1.25 : 1) * (0.7 + rng() * 0.6);
        if (s > bestScore) { bestScore = s; best = i; }
      }
      if (best >= 0 && bestScore > 1.2) pts.push(best);
    }
    return pts.map(i => { const y = (i / W) | 0, x = i - y * W; return [+lonOf(x).toFixed(3), +latOf(y).toFixed(3)]; });
  }

  /**
   * opts: { continent: 1..6, region, landlocked, borderStyle: natural|straight|mixed, minArea, maxArea, seed }
   */
  function generateTerritory(opts) {
    const rng = mulberry32(opts.seed || (Math.random() * 2 ** 31) | 0);
    const c = opts.continent;
    const notes = [];
    const targetArea = Math.exp(Math.log(opts.minArea) + rng() * (Math.log(opts.maxArea) - Math.log(opts.minArea)));
    let landlocked = !!opts.landlocked;
    const style = opts.borderStyle || 'natural';
    const attempt = ll => {
      let best = null;
      for (let tries = 0; tries < 6; tries++) {
        let seed = -1;
        for (let relax = 0; relax <= 2 && seed < 0; relax++) seed = pickSeed(c, opts.region, ll, targetArea, rng, relax);
        if (seed < 0) break;
        // Noisy growth leaves pockets that tidy() fills in, so measure and regrow once with a corrected target.
        const params = growParams(seed, targetArea, rng);
        const natural = target => {
          let cs = tidy(grow(seed, c, ll, target, params), c, ll, seed);
          const a1 = areaOf(cs);
          if (a1 > target * 1.1 || a1 < target * 0.9) {
            const cs2 = tidy(grow(seed, c, ll, target * target / a1, params), c, ll, seed);
            if (Math.abs(areaOf(cs2) - target) < Math.abs(a1 - target)) cs = cs2;
          }
          return cs;
        };
        const build = target => {
          if (style === 'straight') return straightShape(seed, c, ll, target, rng);
          if (style === 'mixed') return mixedShape(seed, c, ll, target, rng, natural);
          return { cells: natural(target), lines: [] };
        };
        let shape = build(targetArea);
        let cells = style === 'natural' ? shape.cells : tidy(shape.cells, c, ll, seed);
        let area = areaOf(cells);
        if (style !== 'natural' && Math.abs(area / targetArea - 1) > 0.15) {
          const shape2 = build(targetArea * targetArea / area);
          const cells2 = tidy(shape2.cells, c, ll, seed);
          const area2 = areaOf(cells2);
          if (Math.abs(area2 - targetArea) < Math.abs(area - targetArea)) { shape = shape2; cells = cells2; area = area2; }
        }
        const coastal = cells.some(i => coastDist[i] === 1);
        const score = area * (!ll && !coastal ? 0.01 : 1);
        if (!best || score > best.score) best = { cells, score, lines: shape.lines };
        if (score >= targetArea * 0.85) break;
      }
      return best;
    };
    let best = attempt(landlocked);
    if (!best && landlocked) {
      notes.push('No room left for a landlocked nation here, so the sea gods granted you a coast.');
      landlocked = false;
      best = attempt(false);
    }
    if (!best) return null;
    const cells = best.cells;
    const lines = best.lines;
    const coastal = cells.some(i => coastDist[i] === 1);
    const info = analyze(cells);
    if (info.area < targetArea * 0.6) {
      notes.push(`Rival borders and coastlines boxed you in — you secured ${Math.round(info.area / targetArea * 100)}% of the land you were promised.`);
    }
    const cityCount = Math.max(1, Math.min(7, Math.round(Math.log10(Math.max(10, info.area)) * 1.6 - 3)));
    const cities = pickCities(cells, info, coastal, cityCount, rng);
    const geometry = toGeometry(cells, coastal, style, lines);
    delete info.depth;
    return {
      cells, geometry, cities, notes, targetArea, landlocked: !coastal,
      area: info.area, coastlineKm: info.coastEdges * CELL_KM * (1.6 + rng() * 1.4),
      centroid: info.centroid, latMin: info.latMin, latMax: info.latMax,
      neighbors: info.neighbors, carved: info.carved, continent: c, borderStyle: style,
    };
  }

  /* ---------- ownership + persistence helpers ---------- */

  function claim(cells, slot) { for (const i of cells) owner[i] = slot; }
  function release(cells) { for (const i of cells) owner[i] = 0; }
  function clearOwners() { owner.fill(0); }

  function encodeCells(cells) {
    const s = Array.from(cells).sort((a, b) => a - b);
    const out = [];
    for (let k = 0; k < s.length;) {
      let j = k;
      while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
      out.push(s[k], j - k + 1);
      k = j + 1;
    }
    return out;
  }
  function decodeCells(rle) {
    const out = [];
    for (let k = 0; k < rle.length; k += 2) for (let n = 0; n < rle[k + 1]; n++) out.push(rle[k] + n);
    return out;
  }

  function countryInfo(id) {
    const f = features[id];
    return { id, name: f.properties.name, continent: CONTINENTS[countryCont[id]], area: countryArea[id] };
  }

  global.WorldGen = {
    init, generateTerritory, claim, release, clearOwners, encodeCells, decodeCells, countryInfo,
    analyzeCells(cells) { const a = analyze(cells); delete a.depth; return a; },
    get features() { return features; },
    CONTINENTS, mulberry32,
  };
})(window);
