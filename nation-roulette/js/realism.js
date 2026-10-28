/* Nation Roulette — real-world geography used to make the wheels more realistic.
 *
 * After the territory is drawn, the terrain, religion and population-density
 * wheels are re-weighted by where the land actually is: a nation in the Sahara
 * is far more likely to land on "Desert", one in South Asia on "Hinduism", and
 * so on. Every option stays on the wheel, so surprises can still happen.
 */
(function (global) {
  'use strict';

  // Rough biome zones as [lon0, lat0, lon1, lat1] boxes.
  const ZONES = {
    desert: [[-17, 15, 33, 31], [33, 15, 58, 32], [68, 24, 75, 30], [75, 36, 112, 46], [12, -28, 26, -18],
      [118, -32, 142, -19], [-71, -27, -68, -17], [-118, 27, -105, 40], [53, 27, 62, 35], [52, 37, 66, 44]],
    mountain: [[72, 27, 100, 38], [-76, -35, -66, -10], [-79, -10, -72, 6], [-125, 35, -104, 60], [5, 44, 16, 48],
      [38, 41, 49, 44], [35, 6, 42, 15], [40, 33, 50, 40], [70, 40, 95, 52], [-8, 30, 4, 36], [18, 45, 27, 49],
      [5, 59, 18, 69], [-108, 17, -97, 28], [-150, 58, -130, 66], [-73, -55, -68, -38], [100, 22, 104, 30]],
    rainforest: [[-75, -12, -48, 4], [10, -5, 30, 5], [95, -8, 125, 12], [130, -9, 150, -2], [-92, 7, -77, 17], [-13, 4, 8, 9]],
    savanna: [[-17, 8, 40, 16], [28, -20, 42, 8], [12, -25, 40, -8], [-60, -24, -42, -5], [-73, 3, -62, 9], [120, -20, 150, -11], [74, 12, 86, 24]],
    steppe: [[45, 44, 85, 54], [88, 42, 120, 50], [-65, -38, -57, -30], [-104, 32, -95, 50], [28, 44, 45, 52]],
    highland: [[35, 6, 42, 15], [-108, 17, -97, 28], [44, 26, 62, 38], [-50, -22, -40, -14], [28, -4, 32, 2]],
  };

  function inZone(zone, lon, lat) {
    for (const [a, b, c, d] of ZONES[zone]) if (lon >= a && lon <= c && lat >= b && lat <= d) return true;
    return false;
  }

  function profile(samples) {
    const p = { desert: 0, mountain: 0, rainforest: 0, savanna: 0, steppe: 0, highland: 0, polar: 0, boreal: 0, temperate: 0, tropical: 0, coastal: 0, lon: 0, lat: 0 };
    if (!samples || !samples.length) return p;
    for (const [lon, lat, cd] of samples) {
      for (const z of Object.keys(ZONES)) if (inZone(z, lon, lat)) p[z]++;
      const a = Math.abs(lat);
      if (a > 62) p.polar++; else if (a > 50) p.boreal++; else if (a > 34) p.temperate++; else if (a < 23) p.tropical++;
      if (cd <= 2) p.coastal++;
      p.lon += lon; p.lat += lat;
    }
    for (const key of Object.keys(p)) p[key] /= samples.length;
    return p;
  }

  function cultureRegion(c, lon, lat) {
    if (c === 3) return 'europe';
    if (c === 1) return lat > 15 ? 'northAfrica' : 'subsaharan';
    if (c === 2) {
      if (lon < 63 && lat < 43) return 'middleEast';
      if (lon >= 46 && lon < 90 && lat >= 36 && lat < 56) return 'centralAsia';
      if (lon >= 60 && lon < 92 && lat < 36) return 'southAsia';
      if (lat > 50) return 'siberia';
      if (lat < 25 && lon >= 92) return 'seAsia';
      return 'eastAsia';
    }
    if (c === 4) return lat < 30 ? 'latinAmerica' : 'northAmerica';
    if (c === 5) return 'latinAmerica';
    return 'oceania';
  }

  const RELIGION = {
    europe: { Christianity: 6, Secular: 5, Islam: 1, Judaism: 0.4, 'Folk Religion': 0.6, 'State Atheism': 1, Pluralism: 2 },
    northAfrica: { Islam: 9, Christianity: 1, Secular: 1, Judaism: 0.4 },
    subsaharan: { Christianity: 6, Islam: 4, 'Folk Religion': 4, Secular: 1, Pluralism: 1.5 },
    middleEast: { Islam: 10, Christianity: 1, Judaism: 1, Secular: 1 },
    centralAsia: { Islam: 7, 'State Atheism': 2, Secular: 2, Buddhism: 0.6 },
    southAsia: { Hinduism: 7, Islam: 4, Buddhism: 2, Pluralism: 1.5, Secular: 1 },
    eastAsia: { Buddhism: 5, 'Folk Religion': 4, 'State Atheism': 3, Secular: 3, Christianity: 1, Pluralism: 1.5 },
    seAsia: { Buddhism: 5, Islam: 4, Christianity: 2, 'Folk Religion': 2, Hinduism: 0.8 },
    siberia: { Christianity: 4, Secular: 3, 'State Atheism': 2, 'Folk Religion': 2, Buddhism: 1 },
    northAmerica: { Christianity: 6, Secular: 5, Pluralism: 2, Judaism: 0.6, 'Folk Religion': 0.6 },
    latinAmerica: { Christianity: 9, Secular: 2, 'Folk Religion': 1.5 },
    oceania: { Christianity: 6, Secular: 4, 'Folk Religion': 2, Pluralism: 1 },
  };

  const DENSE_REGIONS = { southAsia: 2.2, eastAsia: 1.8, seAsia: 1.6, europe: 1.3, siberia: 0.4, oceania: 0.6, northAmerica: 0.8 };

  // Returns new weights for a wheel, or null if the wheel isn't location-driven.
  function weightsFor(key, segments, ctx) {
    const p = ctx.profile, region = ctx.region;
    if (key === 'terrain') {
      const temperate = Math.max(0, p.temperate - p.desert);
      const w = {
        'Plains': 0.6 + 2.5 * temperate + 2 * p.steppe * 0.5,
        'Mountains': 0.25 + 7 * p.mountain,
        'Rolling Hills': 0.5 + 2 * temperate + p.boreal * 0.5,
        'Dense Forest': 0.3 + 3.5 * p.boreal + 1.5 * temperate + 1.5 * p.rainforest,
        'Desert': 0.1 + 9 * p.desert,
        'Jungle': 0.05 + 8 * p.rainforest + 1.2 * p.tropical * (1 - p.desert),
        'Highlands': 0.25 + 3 * p.mountain + 4 * p.highland,
        'Wetlands': 0.25 + 1.5 * p.coastal * (p.tropical + p.boreal + 0.3),
        'Steppe': 0.1 + 7 * p.steppe,
        'Canyons': 0.1 + 2.5 * p.desert * (0.5 + p.mountain),
        'Tundra': 0.03 + 10 * p.polar + 1.5 * p.boreal,
        'Savanna': 0.05 + 8 * p.savanna,
      };
      return segments.map(sg => Object.assign({}, sg, { weight: w[sg.label] != null ? w[sg.label] : 0.3 }));
    }
    if (key === 'religion') {
      const w = RELIGION[region] || {};
      return segments.map(sg => Object.assign({}, sg, { weight: w[sg.label] != null ? w[sg.label] : 0.35 }));
    }
    if (key === 'population') {
      const harsh = ['Desert', 'Tundra', 'Canyons'].includes(ctx.terrain) ? 1 : ['Mountains', 'Highlands', 'Jungle', 'Steppe'].includes(ctx.terrain) ? 0.5 : 0;
      const dense = (DENSE_REGIONS[region] || 1) * (1 - harsh * 0.7);
      // index 0 (Desolate) .. 5 (Megahive)
      return segments.map((sg, k) => {
        const lean = k - 2.2;
        const w = Math.exp(lean * Math.log(Math.max(0.15, dense)) * 0.9) * (harsh ? Math.exp(-lean * harsh * 0.8) : 1);
        return Object.assign({}, sg, { weight: Math.max(0.08, (sg.weight || 1) * w) });
      });
    }
    return null;
  }

  function describe(key, ctx) {
    const p = ctx.profile;
    const top = Object.entries({ desert: p.desert, mountains: p.mountain, rainforest: p.rainforest, savanna: p.savanna, steppe: p.steppe, highlands: p.highland, 'polar lands': p.polar })
      .sort((a, b) => b[1] - a[1])[0];
    if (key === 'terrain') return top[1] > 0.2 ? `Odds shaped by your land — it's ${Math.round(top[1] * 100)}% ${top[0]}.` : 'Odds shaped by your latitude and coastline.';
    if (key === 'religion') return 'Odds shaped by the faiths common in this part of the world.';
    if (key === 'population') return `Odds shaped by your ${ctx.terrain.toLowerCase()} and region.`;
    return '';
  }

  /* ---------- reference figures for real countries (approx. 2023) ----------
   * [name, population (millions), GDP ($ billions), area (thousand km²), HDI] */
  const REAL = [
    ['the United States', 335, 27360, 9834, 0.927], ['China', 1410, 17790, 9597, 0.788], ['India', 1430, 3550, 3287, 0.644],
    ['Indonesia', 278, 1371, 1905, 0.713], ['Pakistan', 240, 338, 882, 0.540], ['Nigeria', 224, 363, 924, 0.548],
    ['Brazil', 216, 2174, 8516, 0.760], ['Bangladesh', 173, 437, 148, 0.670], ['Russia', 144, 2021, 17098, 0.821],
    ['Mexico', 129, 1789, 1964, 0.781], ['Ethiopia', 127, 164, 1104, 0.492], ['Japan', 124, 4213, 378, 0.920],
    ['the Philippines', 117, 437, 300, 0.710], ['Egypt', 113, 396, 1002, 0.728], ['DR Congo', 102, 66, 2345, 0.481],
    ['Vietnam', 99, 430, 331, 0.726], ['Iran', 89, 404, 1648, 0.780], ['Turkey', 85, 1108, 784, 0.855],
    ['Germany', 84, 4456, 357, 0.950], ['Thailand', 72, 515, 513, 0.803], ['the United Kingdom', 68, 3340, 244, 0.940],
    ['France', 68, 3031, 552, 0.910], ['Tanzania', 67, 79, 945, 0.532], ['South Africa', 60, 377, 1221, 0.717],
    ['Italy', 59, 2255, 301, 0.906], ['Kenya', 55, 108, 580, 0.601], ['Colombia', 52, 364, 1142, 0.758],
    ['South Korea', 52, 1713, 100, 0.929], ['Spain', 48, 1581, 506, 0.911], ['Argentina', 46, 641, 2780, 0.849],
    ['Algeria', 46, 240, 2382, 0.745], ['Iraq', 45, 251, 438, 0.673], ['Canada', 40, 2140, 9985, 0.935],
    ['Poland', 37, 811, 313, 0.881], ['Morocco', 37, 141, 447, 0.698], ['Saudi Arabia', 37, 1068, 2150, 0.875],
    ['Peru', 34, 268, 1285, 0.762], ['Malaysia', 34, 400, 331, 0.807], ['Ghana', 34, 76, 239, 0.602],
    ['Nepal', 31, 41, 147, 0.601], ['Madagascar', 30, 16, 587, 0.487], ['Venezuela', 28, 92, 916, 0.699],
    ['Australia', 27, 1724, 7692, 0.946], ['Mali', 23, 21, 1240, 0.410], ['Chile', 20, 335, 756, 0.860],
    ['Kazakhstan', 20, 262, 2725, 0.802], ['the Netherlands', 18, 1118, 42, 0.946], ['Ecuador', 18, 119, 284, 0.765],
    ['Chad', 18, 13, 1284, 0.394], ['Somalia', 18, 11, 638, 0.380], ['Cambodia', 17, 31, 181, 0.600],
    ['Bolivia', 12.4, 46, 1099, 0.698], ['Belgium', 11.8, 632, 31, 0.942], ['Sweden', 10.5, 593, 450, 0.952],
    ['Portugal', 10.4, 287, 92, 0.874], ['Greece', 10.4, 239, 132, 0.893], ['Israel', 9.8, 510, 22, 0.915],
    ['Hungary', 9.6, 212, 93, 0.851], ['Austria', 9.1, 516, 84, 0.926], ['Switzerland', 8.8, 885, 41, 0.967],
    ['Denmark', 5.9, 404, 43, 0.952], ['Singapore', 5.9, 501, 0.73, 0.949], ['Finland', 5.6, 300, 338, 0.942],
    ['Norway', 5.5, 485, 385, 0.966], ['Ireland', 5.3, 545, 70, 0.950], ['New Zealand', 5.2, 253, 268, 0.939],
    ['Uruguay', 3.4, 77, 176, 0.830], ['Mongolia', 3.4, 20, 1564, 0.741], ['Jamaica', 2.8, 19, 11, 0.706],
    ['Qatar', 2.7, 213, 11.6, 0.875], ['Estonia', 1.4, 41, 45, 0.899], ['Fiji', 0.93, 5.5, 18, 0.729],
    ['Luxembourg', 0.66, 86, 2.6, 0.927], ['Malta', 0.54, 21, 0.32, 0.915], ['Iceland', 0.39, 31, 103, 0.959],
    ['Andorra', 0.08, 3.7, 0.47, 0.884], ['Liechtenstein', 0.039, 7, 0.16, 0.942],
  ];

  function closest(col, value) {
    let best = null, bd = Infinity;
    for (const r of REAL) {
      const v = r[col];
      if (v == null || v <= 0) continue;
      const d = col === 4 ? Math.abs(v - value) : Math.abs(Math.log(v / value));
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }

  // "Comparable to" lines against real countries.
  function compare(stats) {
    const a = closest(3, stats.area / 1000), p = closest(1, stats.population / 1e6), g = closest(2, stats.gdp / 1e9), h = closest(4, stats.hdi);
    return {
      area: a && a[0], population: p && p[0], gdp: g && g[0], hdi: h && h[0],
    };
  }

  global.NR = Object.assign(global.NR || {}, { Realism: { profile, cultureRegion, weightsFor, describe, compare } });
})(window);
