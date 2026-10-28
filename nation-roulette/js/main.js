/* Nation Roulette — map, game flow and UI. */
(function () {
  'use strict';

  const { WHEELS, Wheel, Sound, Lore, Realism, War } = window.NR;
  const STORE_KEY = 'nation-roulette-v1';
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(res => setTimeout(res, ms));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  const fmtInt = n => Math.round(n).toLocaleString('en-US');
  function fmtBig(n) {
    const a = Math.abs(n);
    if (a >= 1e12) return (n / 1e12).toFixed(2) + ' trillion';
    if (a >= 1e9) return (n / 1e9).toFixed(2) + ' billion';
    if (a >= 1e6) return (n / 1e6).toFixed(2) + ' million';
    return fmtInt(n);
  }
  function fmtShort(n) {
    const a = Math.abs(n);
    if (a >= 1e12) return (n / 1e12).toFixed(1) + 'T';
    if (a >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return (n / 1e3).toFixed(0) + 'k';
    return fmtInt(n);
  }
  const fmtMoney = n => '$' + fmtBig(n);
  const fmtArea = n => fmtInt(n) + ' km²';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // Categorical chart palette (validated for the dark surface); "Other" is neutral grey.
  const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9'];
  const OTHER = '#6b7385';

  const state = {
    step: 0, results: {}, territory: null, busy: false, auto: false,
    nations: [], nextSlot: 1, drawerOpen: false, flagFill: true, tab: 'overview', rankKey: 'gdp',
    fallen: [], events: [],
  };

  /* ================= map ================= */

  const svg = d3.select('#map');
  const projection = d3.geoNaturalEarth1();
  const path = d3.geoPath(projection);
  let width = 800, height = 500, k = 1;
  let world, land, countries, countryLabels = [];

  const defs = svg.append('defs');
  const ocean = defs.append('radialGradient').attr('id', 'ocean-grad').attr('cx', '50%').attr('cy', '45%').attr('r', '65%');
  ocean.append('stop').attr('offset', '0%').attr('stop-color', '#1d4f7a');
  ocean.append('stop').attr('offset', '100%').attr('stop-color', '#0c2741');
  const clipPath = defs.append('clipPath').attr('id', 'land-clip').append('path');
  const zoomLayer = svg.append('g');
  const spherePath = zoomLayer.append('path').attr('class', 'sphere');
  const gratPath = zoomLayer.append('path').attr('class', 'graticule');
  const glowPath = zoomLayer.append('path').attr('class', 'land-glow');
  const countryG = zoomLayer.append('g').attr('class', 'countries');
  const clabelG = zoomLayer.append('g').attr('class', 'country-labels');
  const nationG = zoomLayer.append('g').attr('class', 'nations').attr('clip-path', 'url(#land-clip)');
  const provG = zoomLayer.append('g').attr('class', 'provinces');
  const pendingG = zoomLayer.append('g').attr('class', 'pending').attr('clip-path', 'url(#land-clip)');
  const markerG = zoomLayer.append('g').attr('class', 'markers');
  const labelG = zoomLayer.append('g').attr('class', 'labels');

  const zoom = d3.zoom().scaleExtent([1, 160]).clickDistance(5)
    .on('zoom', ev => { zoomLayer.attr('transform', ev.transform); k = ev.transform.k; updateScaled(); });
  svg.call(zoom);

  // Political-atlas pastels; neighbouring countries never share a tone.
  const ATLAS = ['#eadcb8', '#d7e4bd', '#f0d2b4', '#cfe0d4', '#ead2cc', '#ddd6ea'];

  function layout() {
    const r = $('map-wrap').getBoundingClientRect();
    width = Math.max(300, r.width); height = Math.max(240, r.height);
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    projection.fitExtent([[6, 6], [width - 6, height - 30]], { type: 'Sphere' });
    zoom.extent([[0, 0], [width, height]]).translateExtent([[0, 0], [width, height]]);
    spherePath.attr('d', path({ type: 'Sphere' }));
    gratPath.attr('d', path(d3.geoGraticule10()));
    glowPath.attr('d', path(land));
    countryG.selectAll('path').attr('d', path);
    clipPath.attr('d', path(land));
    computeCountryLabels();
    renderNations();
    renderPending();
  }

  function initMap() {
    world = window.WORLD_TOPO;
    land = topojson.feature(world, world.objects.land);
    countries = WorldGen.features;
    const nb = topojson.neighbors(world.objects.countries.geometries);
    const tone = new Array(countries.length).fill(-1);
    countries.map((_, i) => i).sort((a, b) => nb[b].length - nb[a].length).forEach(i => {
      const used = new Set(nb[i].map(j => tone[j]));
      let t = 0;
      while (used.has(t) && t < ATLAS.length - 1) t++;
      tone[i] = t;
    });
    countryG.selectAll('path').data(countries).join('path')
      .attr('class', 'country')
      .attr('fill', (d, i) => ATLAS[tone[i]])
      .on('click', (ev, d) => showCountry(countries.indexOf(d)))
      .on('mousemove', (ev, d) => tip(ev, `<b>${esc(d.properties.name)}</b>`))
      .on('mouseleave', hideTip);
    layout();
    window.addEventListener('resize', () => { layout(); wheel.resize(); });
  }

  function computeCountryLabels() {
    countryLabels = countries.map((f, i) => {
      const main = largestPolygon(f.geometry.type === 'Polygon' ? { type: 'MultiPolygon', coordinates: [f.geometry.coordinates] } : f.geometry);
      const b = path.bounds(main);
      const c = path.centroid(main);
      return { i, name: f.properties.name, x: c[0], y: c[1], size: Math.min(b[1][0] - b[0][0], (b[1][1] - b[0][1]) * 2.2) };
    }).filter(d => isFinite(d.x) && d.name !== 'Antarctica');
    clabelG.selectAll('text').data(countryLabels, d => d.i).join('text')
      .attr('class', 'clabel').attr('text-anchor', 'middle')
      .attr('x', d => d.x).attr('y', d => d.y).text(d => d.name);
  }

  function tip(ev, html) {
    const t = $('tooltip');
    const r = $('map-wrap').getBoundingClientRect();
    t.innerHTML = html;
    t.classList.remove('hidden');
    t.style.left = Math.max(4, Math.min(ev.clientX - r.left + 14, r.width - 250)) + 'px';
    t.style.top = Math.min(ev.clientY - r.top + 14, r.height - 60) + 'px';
  }
  function hideTip() { $('tooltip').classList.add('hidden'); }

  function nationMarkers() {
    const out = [];
    state.nations.forEach(n => {
      const size = projectedSize(n.geometry);
      n.stats.cities.forEach((c, idx) => {
        const p = projection([c.lon, c.lat]);
        if (p) out.push({ key: n.slot + ':' + idx, x: p[0], y: p[1], capital: c.capital, name: c.name, nation: n, size });
      });
    });
    return out;
  }

  function projectedSize(geom) {
    const b = path.bounds(geom);
    return Math.max(b[1][0] - b[0][0], b[1][1] - b[0][1]);
  }

  // Each nation's flag, stretched to cover its territory like a flag map.
  function flagPatternContent(flagSvg, w, h) {
    return flagSvg.replace(/^<svg[^>]*>/, `<svg viewBox="0 0 300 200" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice">`);
  }

  function renderFlagPatterns() {
    defs.selectAll('pattern.flagpat').data(state.nations, d => d.slot)
      .join(enter => enter.append('pattern').attr('class', 'flagpat').attr('id', d => 'flagpat-' + d.slot).attr('patternUnits', 'userSpaceOnUse'))
      .each(function (d) {
        const [[x0, y0], [x1, y1]] = path.bounds(d.geometry);
        const w = Math.max(0.5, x1 - x0), h = Math.max(0.5, y1 - y0);
        d3.select(this).attr('x', x0).attr('y', y0).attr('width', w).attr('height', h)
          .html(flagPatternContent(d.stats.flag, w, h));
      });
    defs.selectAll('clipPath.nclip').data(state.nations, d => d.slot)
      .join(enter => { const c = enter.append('clipPath').attr('class', 'nclip').attr('id', d => 'nclip-' + d.slot); c.append('path'); return c; })
      .select('path').attr('d', d => path(d.geometry));
  }

  function nationFill(d) { return state.flagFill ? `url(#flagpat-${d.slot})` : d.color; }

  function renderNations() {
    renderFlagPatterns();
    nationG.selectAll('path.nation').data(state.nations, d => d.slot).join('path')
      .attr('class', 'nation')
      .attr('d', d => path(d.geometry))
      .attr('fill', nationFill)
      .classed('flag-filled', state.flagFill)
      .on('click', (ev, d) => { ev.stopPropagation(); showNation(d); })
      .on('mousemove', (ev, d) => tip(ev, `<span class="tip-flag">${d.stats.flag}</span><b>${esc(d.stats.name)}</b><br><small>Pop. ${fmtBig(d.stats.population)} · ${fmtArea(d.stats.area)}</small>`))
      .on('mouseleave', hideTip);

    const withProv = state.nations.filter(n => n.provinceLines);
    provG.selectAll('path.prov-line').data(withProv, d => d.slot).join('path')
      .attr('class', 'prov-line')
      .attr('clip-path', d => `url(#nclip-${d.slot})`)
      .attr('d', d => path(d.provinceLines))
      .each(d => { d._size = projectedSize(d.geometry); });

    const markers = nationMarkers();
    markerG.selectAll('g.mk').data(markers, d => d.key).join(enter => {
      const g = enter.append('g').attr('class', d => 'mk' + (d.capital ? ' capital' : ' city'));
      g.append('path').attr('d', d => d.capital ? d3.symbol(d3.symbolStar, 70)() : d3.symbol(d3.symbolCircle, 22)());
      g.append('text').attr('x', 7).attr('y', 4).text(d => d.name);
      g.on('click', (ev, d) => { ev.stopPropagation(); showNation(d.nation); });
      return g;
    });

    labelG.selectAll('text.nlabel').data(state.nations, d => d.slot).join('text')
      .attr('class', 'nlabel')
      .attr('text-anchor', 'middle')
      .each(function (d) {
        const c = path.centroid(largestPolygon(d.geometry));
        d._lx = c[0]; d._ly = c[1]; d._size = projectedSize(d.geometry);
      })
      .text(d => d.stats.root);
    updateScaled();
    updateTicker();
  }

  function largestPolygon(geom) {
    let best = null, bestA = -1;
    for (const coords of geom.coordinates) {
      const p = { type: 'Polygon', coordinates: coords };
      const a = d3.geoArea(p);
      if (a > bestA) { bestA = a; best = p; }
    }
    return best || geom;
  }

  function updateScaled() {
    markerG.selectAll('g.mk')
      .attr('transform', d => `translate(${d.x},${d.y}) scale(${1 / k})`)
      .attr('display', d => (d.capital ? d.size * k > 6 : d.size * k > 110) ? null : 'none')
      .classed('show-name', d => d.size * k > (d.capital ? 70 : 160));
    labelG.selectAll('text.nlabel')
      .attr('x', d => d._lx).attr('y', d => d._ly - 10 / k)
      .attr('font-size', d => Math.min(22, Math.max(10, d._size * k / 9)) / k)
      .attr('stroke-width', 3 / k)
      .attr('display', d => d._size * k > 34 ? null : 'none');
    clabelG.selectAll('text.clabel')
      .attr('font-size', d => Math.min(13, Math.max(8.5, d.size * k / 12)) / k)
      .attr('display', d => d.size * k > 48 ? null : 'none');
    provG.selectAll('path.prov-line').attr('display', d => d._size * k > 70 ? null : 'none');
    pendingG.selectAll('path').attr('stroke-width', 2.2 / k);
  }

  function renderPending() {
    const t = state.territory;
    pendingG.selectAll('path').data(t ? [t] : []).join('path')
      .attr('class', 'pending-land')
      .attr('d', d => path(d.geometry))
      .attr('stroke-width', 2.2 / k);
  }

  function zoomToGeometry(geom, duration = 1400) {
    const [[x0, y0], [x1, y1]] = path.bounds(geom);
    const drawerW = state.drawerOpen && width > 760 ? Math.min(420, width * 0.45) : 0;
    const viewW = width - drawerW;
    const dx = Math.max(1, x1 - x0), dy = Math.max(1, y1 - y0);
    const s = Math.max(1, Math.min(60, 0.55 / Math.max(dx / viewW, dy / height)));
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const tr = d3.zoomIdentity.translate(viewW / 2 - s * cx, height / 2 - s * cy).scale(s);
    svg.transition().duration(duration).ease(d3.easeCubicInOut).call(zoom.transform, tr);
  }
  function zoomHome() { svg.transition().duration(900).call(zoom.transform, d3.zoomIdentity); }

  /* ================= wheel flow ================= */

  const wheel = new Wheel($('wheel'));

  function renderSteps() {
    $('steps').innerHTML = WHEELS.map((w, idx) => {
      const r = state.results[w.key];
      const cls = idx === state.step ? 'current' : r ? 'done' : '';
      return `<li class="${cls}"><span class="ico">${w.icon}</span><span class="nm">${esc(w.title)}</span><span class="rs">${r ? esc(r.label) : idx === state.step ? '…' : ''}</span></li>`;
    }).join('');
    // Scroll only the step list (scrollIntoView would also scroll the page on phones).
    const list = $('steps'), cur = list.querySelector('.current');
    if (cur) {
      const top = cur.offsetTop - list.offsetTop;
      if (top < list.scrollTop || top + cur.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top - list.clientHeight / 2;
    }
  }

  function wheelContext() {
    const t = state.territory;
    if (!t) return null;
    return {
      profile: Realism.profile(t.samples),
      region: Realism.cultureRegion(t.continent, t.centroid[0], t.centroid[1]),
      terrain: state.results.terrain ? state.results.terrain.label : '',
    };
  }

  function loadWheel() {
    const w = WHEELS[state.step];
    const ctx = wheelContext();
    const weighted = ctx && Realism.weightsFor(w.key, w.segments, ctx);
    wheel.setSegments(weighted || w.segments, w.icon);
    $('step-count').textContent = `Wheel ${state.step + 1} of ${WHEELS.length}`;
    $('wheel-title').textContent = w.title;
    $('wheel-desc').textContent = w.desc;
    const note = $('odds-note');
    note.textContent = weighted ? Realism.describe(w.key, ctx) : '';
    note.classList.toggle('hidden', !weighted);
    $('progress-bar').style.width = (state.step / WHEELS.length * 100) + '%';
    renderSteps();
  }

  function setBusy(b) {
    state.busy = b;
    $('btn-spin').disabled = b;
    $('btn-auto').disabled = b;
  }

  function popResult(text) {
    const p = $('result-pop');
    p.textContent = text;
    p.classList.remove('hidden', 'show');
    void p.offsetWidth;
    p.classList.add('show');
  }

  async function spinCurrent(fast) {
    if (state.busy || state.step >= WHEELS.length) return;
    setBusy(true);
    Sound.ensure();
    const w = WHEELS[state.step];
    const seg = await wheel.spin(fast);
    state.results[w.key] = seg;
    Sound.ding();
    popResult(seg.label);
    renderSteps();
    if (w.key === 'size') await makeTerritory();
    await sleep(fast ? 350 : 1000);
    state.step++;
    if (state.step >= WHEELS.length) {
      $('progress-bar').style.width = '100%';
      await finalize();
    } else loadWheel();
    setBusy(false);
  }

  async function autoSpin() {
    if (state.busy) return;
    state.auto = true;
    $('btn-auto').classList.add('active');
    while (state.auto && state.step < WHEELS.length) await spinCurrent(true);
    state.auto = false;
    $('btn-auto').classList.remove('active');
  }

  function toast(msg, ms = 3500) {
    const t = $('map-toast');
    t.innerHTML = msg;
    t.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.add('hidden'), ms);
  }

  async function makeTerritory() {
    const r = state.results;
    toast('🛰️ Surveying land and drawing borders…', 2000);
    await sleep(40);
    const base = {
      region: r.region.label, landlocked: r.landlocked.value, borderStyle: r.borders.value,
      minArea: r.size.min, maxArea: r.size.max, seed: (Math.random() * 2 ** 31) | 0,
    };
    let terr = WorldGen.generateTerritory(Object.assign({ continent: r.continent.value }, base));
    // No room left: the people rise up inside existing nations instead (a war of independence follows).
    if ((!terr || terr.area < terr.targetArea * 0.35) && state.nations.some(n => n.terr.continent === r.continent.value)) {
      const up = WorldGen.generateTerritory(Object.assign({ continent: r.continent.value, ignoreOwners: true }, base));
      if (up && up.contested) {
        const names = Object.keys(up.contested).map(sl => state.nations.find(n => n.slot === +sl)).filter(Boolean).map(n => n.stats.root);
        up.uprising = true;
        up.notes = [`No free land left in ${WorldGen.CONTINENTS[r.continent.value]} — your people rise up inside ${names.join(' and ')}! A war of independence is coming.`];
        terr = up;
      }
    }
    if (!terr) {
      // Continent is full: find the nearest one with space left.
      for (const c of [2, 1, 4, 5, 3, 6]) {
        terr = WorldGen.generateTerritory(Object.assign({ continent: c }, base));
        if (terr) {
          terr.notes.push(`${WorldGen.CONTINENTS[r.continent.value]} is completely full! Your settlers sailed to ${WorldGen.CONTINENTS[c]} instead.`);
          break;
        }
      }
    }
    if (!terr) { toast('🌐 The whole world is claimed! Reset the world to keep playing.', 6000); return; }
    state.territory = terr;
    renderPending();
    zoomToGeometry(terr.geometry);
    const ll = terr.landlocked ? 'landlocked' : 'coastal';
    toast(`📍 Territory claimed: <b>${fmtArea(terr.area)}</b>, ${ll}.` + terr.notes.map(n => `<br><small>${esc(n)}</small>`).join(''), 5000);
  }

  async function finalize() {
    const terr = state.territory;
    if (!terr) { resetSpins(); return; }
    const seed = (Math.random() * 2 ** 31) | 0;
    const stats = Lore.build(state.results, terr, seed);
    const hue = Math.floor(Math.random() * 360);
    const nation = {
      slot: state.nextSlot++,
      color: `hsl(${hue}, ${62 + Math.floor(Math.random() * 20)}%, ${48 + Math.floor(Math.random() * 10)}%)`,
      geometry: terr.geometry,
      provinceLines: terr.provinceLines,
      style: terr.borderStyle, lines: terr.lines || [],
      rle: WorldGen.encodeCells(terr.cells),
      cells: terr.cells,
      results: Object.fromEntries(Object.entries(state.results).map(([key, v]) => [key, v.label])),
      terr: { area: terr.area, coastlineKm: terr.coastlineKm, landlocked: terr.landlocked, continent: terr.continent },
      stats,
      created: Date.now(),
    };
    // An uprising starts by seizing its land from the current owners.
    const defenders = [];
    if (terr.uprising) {
      for (const sl of Object.keys(terr.contested)) {
        const d = state.nations.find(n => n.slot === +sl);
        if (!d) continue;
        const set = new Set(terr.contested[sl]);
        const before = d.stats.area;
        d.cells = d.cells.filter(i => !set.has(i));
        d.stats.population = Math.round(d.stats.population * Math.max(0, 1 - WorldGen.areaOf(terr.contested[sl]) / before));
        d.stats.cities = d.stats.cities.filter(c => !set.has(WorldGen.cellOf(c.lon, c.lat)));
        if (d.stats.provinces) d.stats.provinces = d.stats.provinces.filter(p => !set.has(WorldGen.cellOf(p.lon, p.lat)));
        if (War.refresh(d)) defenders.push(d); else fallNation(d, nation.stats.root);
      }
    }
    WorldGen.claim(terr.cells, nation.slot);
    state.nations.push(nation);
    state.territory = null;
    renderPending();
    renderNations();
    save();
    updateCount();

    let alive = true;
    const fast = state.auto || $('chk-fast').checked;
    if (terr.uprising) {
      for (const d of defenders) {
        if (!state.nations.includes(d)) continue;
        alive = await fightWar(nation, War.nationSide(d), 'independence', fast);
        if (!alive) break;
      }
    } else if (terr.area < terr.targetArea * 0.6) {
      const rivals = WorldGen.analyzeCells(nation.cells).neighbors.filter(nb => nb.type === 'nation' && nb.shared >= 3)
        .map(nb => state.nations.find(n => n.slot === nb.id)).filter(Boolean);
      for (const d of rivals) {
        if (!state.nations.includes(d)) continue;
        const res = await fightWar(nation, War.nationSide(d), 'offer', fast);
        if (res === null) break;
        alive = res;
        if (!alive) break;
      }
    }
    if (alive) {
      Sound.fanfare();
      confetti();
      showReveal(nation);
    } else showFallenReveal(nation);
  }

  // Runs one war on the war screen and applies it. Returns false if the attacker fell, null if declined.
  async function fightWar(attacker, defenderSide, mode, fast) {
    const A = War.nationSide(attacker);
    const res = await War.run(A, defenderSide, { mode, fast });
    if (!res) return null;
    const out = War.apply(A, defenderSide, res.type);
    state.events.push(out.headline);
    state.events = state.events.slice(-20);
    for (const side of [A, defenderSide]) if (out.destroyed === side && side.kind === 'nation') fallNation(side.nation, side === A ? defenderSide.name : A.name);
    renderNations();
    flashLand(out.moved);
    save();
    updateCount();
    await War.showOutcome(`${out.text}<small>Battles won: ${res.wins} of 5 · pre-war odds ${Math.round(res.p * 100)}%</small>`, fast);
    return out.destroyed !== A;
  }

  function fallNation(n, by) {
    const idx = state.nations.indexOf(n);
    if (idx >= 0) state.nations.splice(idx, 1);
    WorldGen.release(n.cells.filter(i => WorldGen.ownerOf(i) === n.slot));
    state.fallen.push({ name: n.stats.name, root: n.stats.root, flag: n.stats.flag, by });
    state.fallen = state.fallen.slice(-30);
  }

  function flashLand(cells) {
    if (!cells || !cells.length) return;
    const r = WorldGen.rebuild(cells, 'natural', [], []);
    if (!r) return;
    const p = pendingG.append('path').attr('class', 'annexed-flash').attr('d', path(r.geometry));
    setTimeout(() => p.remove(), 3200);
  }

  function showFallenReveal(n) {
    const s = n.stats;
    $('reveal-body').innerHTML = `
      <div class="flag big fallen">${s.flag}</div>
      <p class="eyebrow">A nation has fallen</p>
      <h2>${esc(s.name)}</h2>
      <p class="motto">Born and lost in the same breath. History will remember ${esc(s.root)}.</p>`;
    $('reveal').classList.remove('hidden');
    $('reveal').dataset.slot = '';
  }

  function showWarPicker(n) {
    const nbs = WorldGen.analyzeCells(n.cells).neighbors.filter(nb => nb.shared >= 2);
    const items = nbs.map(nb => {
      let side;
      if (nb.type === 'nation') { const o = state.nations.find(x => x.slot === nb.id); if (!o) return ''; side = War.nationSide(o); }
      else { const free = WorldGen.freeCellsOfCountry(nb.id); if (!free.length) return ''; side = War.countrySide(nb.id); }
      const p = War.odds(War.nationSide(n), side);
      return `<li data-target="${nb.type}:${nb.id}"><span class="flag sm">${side.flag}</span><span class="nl-text"><b>${esc(side.name)}</b><small>${side.kind === 'nation' ? 'Your nation' : 'Real-world country'} · win chance ${Math.round(p * 100)}%</small></span><span class="wp ${p >= 0.5 ? 'good' : 'bad'}">${Math.round(p * 100)}%</span></li>`;
    }).join('');
    openDrawer(`
      <div class="nation-head real"><h2>⚔️ Choose a target</h2><div class="chips"><span>${esc(n.stats.root)}'s neighbours</span></div></div>
      ${items ? `<ul class="nation-list war-targets" data-attacker="${n.slot}">${items}</ul>` : '<p class="muted pad">Nobody to fight — this nation has no land neighbours.</p>'}
      <div class="drawer-actions"><button data-nation="${n.slot}">← Back to ${esc(n.stats.root)}</button></div>`);
  }

  async function manualWar(n, target) {
    const [type, id] = target.split(':');
    let side;
    if (type === 'nation') { const o = state.nations.find(x => x.slot === +id); if (!o) return; side = War.nationSide(o); }
    else side = War.countrySide(+id);
    closeDrawer();
    const alive = await fightWar(n, side, 'manual', $('chk-fast').checked);
    if (alive) showNation(n); else zoomHome();
  }

  function resetSpins() {
    state.auto = false;
    state.step = 0;
    state.results = {};
    state.territory = null;
    renderPending();
    loadWheel();
  }

  /* ================= charts ================= */

  // 100% stacked bar with a 2px gap between segments, legend underneath.
  function stackBar(items, unit) {
    let x = 0;
    const segs = items.map((it, i) => {
      const color = it.name === 'Other' ? OTHER : SERIES[i % SERIES.length];
      const w = it.pct;
      const out = `<span class="seg" style="left:${x}%;width:calc(${w}% - 2px);background:${color}" data-tip="<b>${esc(it.name)}</b><br>${it.pct}%${unit ? ' ' + unit : ''}"></span>`;
      x += w;
      return out;
    }).join('');
    const legend = items.map((it, i) => `<li><i style="background:${it.name === 'Other' ? OTHER : SERIES[i % SERIES.length]}"></i>${esc(it.name)} <b>${it.pct}%</b></li>`).join('');
    return `<div class="stackbar">${segs}</div><ul class="legend">${legend}</ul>`;
  }

  function radar(profile) {
    const W = 340, H = 236, cx = W / 2, cy = H / 2 + 2, R = 80, n = profile.length;
    const pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v]; };
    let g = '';
    [0.25, 0.5, 0.75, 1].forEach(lv => {
      g += `<polygon class="r-grid" points="${profile.map((_, i) => pt(i, lv).join(',')).join(' ')}"/>`;
    });
    profile.forEach((p, i) => {
      const [x, y] = pt(i, 1), [lx, ly] = pt(i, 1.2);
      g += `<line class="r-axis" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`;
      const anchor = Math.abs(lx - cx) < 8 ? 'middle' : lx > cx ? 'start' : 'end';
      g += `<text class="r-label" x="${lx}" y="${ly + 4}" text-anchor="${anchor}">${p.name}</text>`;
    });
    const poly = profile.map((p, i) => pt(i, Math.max(0.03, p.v)).join(',')).join(' ');
    g += `<polygon class="r-shape" points="${poly}"/>`;
    profile.forEach((p, i) => {
      const [x, y] = pt(i, Math.max(0.03, p.v));
      g += `<circle class="r-dot" cx="${x}" cy="${y}" r="4"/><circle class="hit" cx="${x}" cy="${y}" r="12" data-tip="<b>${p.name}</b><br>${Math.round(p.v * 100)} / 100"/>`;
    });
    return `<svg class="chart radar" viewBox="0 0 ${W} ${H}" role="img" aria-label="National profile">${g}</svg>`;
  }

  function hemicycle(parl) {
    if (!parl || parl.assembly) return '<p class="muted">No parliament — every citizen votes directly in the national assembly.</p>';
    const total = parl.parties.reduce((a, p) => a + p.seats, 0);
    const W = 300, H = 160, cx = W / 2, cy = H - 8;
    const shown = Math.min(total, 360);
    const rows = Math.max(3, Math.round(Math.sqrt(shown / 3.2)));
    const r0 = 52, r1 = 140;
    const dots = [];
    const per = [];
    let sumLen = 0;
    for (let rI = 0; rI < rows; rI++) { const rad = r0 + (r1 - r0) * rI / Math.max(1, rows - 1); per.push(rad); sumLen += rad; }
    per.forEach(rad => {
      const n = Math.max(1, Math.round(shown * rad / sumLen));
      for (let j = 0; j < n; j++) {
        const a = Math.PI - Math.PI * (j + 0.5) / n;
        dots.push({ a, x: cx + Math.cos(a) * rad, y: cy - Math.sin(a) * rad });
      }
    });
    dots.sort((p, q) => q.a - p.a);
    const dotR = Math.max(1.6, Math.min(5, 360 / Math.sqrt(dots.length) / 7.5));
    let idx = 0;
    const pieces = [];
    parl.parties.forEach((p, i) => {
      const n = Math.round(dots.length * p.seats / total);
      const color = SERIES[i % SERIES.length];
      for (let j = 0; j < n && idx < dots.length; j++, idx++) {
        const d = dots[idx];
        pieces.push(`<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="${dotR}" fill="${color}" data-tip="<b>${esc(p.name)}</b><br>${p.seats} of ${total} seats"/>`);
      }
    });
    // Rounding leftovers go to the largest party.
    while (idx < dots.length) { const d = dots[idx++]; pieces.push(`<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="${dotR}" fill="${SERIES[0]}"/>`); }
    const legend = parl.parties.map((p, i) => `<li><i style="background:${SERIES[i % SERIES.length]}"></i>${esc(p.name)} <b>${p.seats}</b></li>`).join('');
    const maj = Math.floor(total / 2) + 1;
    return `<svg class="chart hemi" viewBox="0 0 ${W} ${H}" role="img" aria-label="Parliament seats">${pieces.join('')}
      <text class="hemi-total" x="${cx}" y="${cy - 14}" text-anchor="middle">${total}</text>
      <text class="hemi-sub" x="${cx}" y="${cy}" text-anchor="middle">seats · majority ${maj}</text></svg>
      <ul class="legend">${legend}</ul>`;
  }

  function lineChart(hist) {
    if (hist.length < 2) return '<p class="muted">Founded this year — history starts now!</p>';
    const W = 300, H = 140, L = 40, Rr = 10, T = 12, B = 22;
    const x = d3.scaleLinear().domain(d3.extent(hist, d => d.year)).range([L, W - Rr]);
    const y = d3.scaleLinear().domain([0, d3.max(hist, d => d.pop) * 1.08]).range([H - B, T]);
    const line = d3.line().x(d => x(d.year)).y(d => y(d.pop)).curve(d3.curveMonotoneX)(hist);
    const ticks = y.ticks(3).map(t => `<line class="grid" x1="${L}" x2="${W - Rr}" y1="${y(t)}" y2="${y(t)}"/><text class="axis" x="${L - 6}" y="${y(t) + 3}" text-anchor="end">${fmtShort(t)}</text>`).join('');
    const first = hist[0], last = hist[hist.length - 1];
    const pts = hist.map(d => `<circle class="hit" cx="${x(d.year)}" cy="${y(d.pop)}" r="10" data-tip="<b>${d.year}</b><br>${fmtBig(d.pop)} people"/>`).join('');
    return `<svg class="chart line" viewBox="0 0 ${W} ${H}" role="img" aria-label="Population over time">${ticks}
      <path class="ln" d="${line}"/>
      <circle class="end" cx="${x(last.year)}" cy="${y(last.pop)}" r="4"/>
      <text class="axis" x="${L}" y="${H - 6}">${first.year}</text><text class="axis" x="${W - Rr}" y="${H - 6}" text-anchor="end">${last.year}</text>
      ${pts}</svg>`;
  }

  /* ================= panels ================= */

  function openDrawer(html) {
    $('drawer-body').innerHTML = html;
    $('drawer').classList.remove('hidden');
    $('drawer-body').scrollTop = 0;
    state.drawerOpen = true;
  }
  function closeDrawer() { $('drawer').classList.add('hidden'); state.drawerOpen = false; hideTip(); }

  function bar(v, max, cls) {
    return `<span class="bar ${cls || ''}"><i style="width:${Math.max(2, Math.min(100, v / max * 100))}%"></i></span>`;
  }
  function row(label, value) { return `<div class="kv"><span>${label}</span><b>${value}</b></div>`; }
  function tile(label, value, sub) { return `<div class="tile"><small>${label}</small><b>${value}</b>${sub ? `<em>${sub}</em>` : ''}</div>`; }
  function nationLink(n) { return `<a href="#" data-nation="${n.slot}">${esc(n.stats.root)}</a>`; }
  function countryLink(id, name) { return `<a href="#" data-country="${id}">${esc(name)}</a>`; }

  // The size class a nation actually ended up with (it can be squeezed below what was rolled).
  function sizeClass(area) {
    const segs = WHEELS.find(w => w.key === 'size').segments;
    return (segs.find(sg => area < sg.max) || segs[segs.length - 1]).label;
  }
  function sizeChip(n) {
    const actual = sizeClass(n.stats.area);
    return actual === n.results.size ? esc(actual) : `${esc(actual)} <small>(rolled ${esc(n.results.size)})</small>`;
  }

  const TABS = [['overview', 'Overview'], ['land', 'Land'], ['people', 'People'], ['politics', 'Politics'], ['economy', 'Economy'], ['military', 'Military']];

  function showNation(n) {
    const s = n.stats, r = n.results, t = n.terr;
    const live = WorldGen.analyzeCells(n.cells);
    const borders = live.neighbors.map(nb => {
      if (nb.type === 'nation') { const o = state.nations.find(x => x.slot === nb.id); return o ? nationLink(o) : null; }
      return countryLink(nb.id, WorldGen.countryInfo(nb.id).name);
    }).filter(Boolean);
    const carved = live.carved.slice(0, 6).map(c =>
      `<li>${countryLink(c.id, c.name)} <small>${fmtArea(c.area)} · ${c.pct < 0.1 ? '<0.1' : c.pct.toFixed(1)}% of it</small></li>`).join('');
    const cities = s.cities.map(c => `<li>${c.capital ? '★ ' : ''}${esc(c.name)} <small>${fmtBig(c.pop)}</small></li>`).join('');
    const hdiCls = s.hdi >= 0.8 ? 'good' : s.hdi >= 0.7 ? 'ok' : s.hdi >= 0.55 ? 'meh' : 'bad';
    const cmp = Realism.compare(s);
    const maxProvPop = s.provinces ? Math.max(...s.provinces.map(p => p.pop)) : 1;
    const provinces = s.provinces ? `<table class="ptable"><thead><tr><th>Province</th><th>Seat</th><th>Area</th><th>Population</th></tr></thead><tbody>${
      s.provinces.slice().sort((a, b) => b.pop - a.pop).map(p => `<tr><td>${esc(p.name)}</td><td>${p.capital ? '★ ' : ''}${esc(p.seat)}</td><td>${fmtShort(p.area)} km²</td>
        <td><span class="pbar"><i style="width:${p.pop / maxProvPop * 100}%"></i></span>${fmtShort(p.pop)}</td></tr>`).join('')}</tbody></table>` : '';
    const tabs = TABS.map(([id, label]) => `<button class="tab${state.tab === id ? ' on' : ''}" data-tab="${id}">${label}</button>`).join('');
    const pane = (id, html) => `<div class="pane${state.tab === id ? ' on' : ''}" data-pane="${id}">${html}</div>`;

    openDrawer(`
      <div class="nation-head">
        <div class="flag hero">${s.flag}<span class="sheen"></span></div>
        <h2>${esc(s.name)}</h2>
        <p class="motto">“${esc(s.motto)}”</p>
        <div class="chips">
          <span>${esc(WorldGen.CONTINENTS[t.continent])}</span><span>${esc(r.region)}</span>
          <span>${t.landlocked ? 'Landlocked' : 'Coastal'}</span><span>${sizeChip(n)}</span>
          ${s.puppetOf ? `<span class="puppet">⛓ Puppet of ${esc(s.puppetOf)}</span>` : ''}
        </div>
      </div>
      <nav class="tabs">${tabs}</nav>
      ${pane('overview', `
        <div class="tiles">
          ${tile('Population', fmtShort(s.population), cmp.population ? `≈ ${esc(cmp.population)}` : '')}
          ${tile('Area', fmtShort(s.area) + ' km²', cmp.area ? `≈ ${esc(cmp.area)}` : '')}
          ${tile('GDP', '$' + fmtShort(s.gdp), cmp.gdp ? `≈ ${esc(cmp.gdp)}` : '')}
          ${tile('HDI', s.hdi.toFixed(3), cmp.hdi ? `≈ ${esc(cmp.hdi)}` : '')}
          <div class="tile wide"><small>Capital</small><b>★ ${esc(s.capital)}</b></div>
          <div class="tile full"><small>Head of state</small><b>${esc(s.leader)}</b><em>${esc(r.government)} · ${esc(r.ideology)}</em></div>
        </div>
        ${s.profile ? `<section><h3>National profile</h3>${radar(s.profile)}</section>` : ''}
        <section><h3>Flag symbolism</h3><ul class="flag-meaning">${(s.flagMeaning || []).map(m => `<li>${m}</li>`).join('')}</ul></section>`)}
      ${pane('land', `
        <section><h3>Geography</h3>
          ${row('Area', fmtArea(s.area))}
          ${row('Coastline', t.landlocked ? 'None (landlocked)' : fmtInt(t.coastlineKm) + ' km')}
          ${row('Border style', esc(r.borders || 'Natural & Winding'))}
          ${row('Terrain', esc(r.terrain))}
          ${row('Climate', esc(s.climate))}
          ${row('Highest point', `${esc(s.highestName)} (${fmtInt(s.highest)} m)`)}
          ${s.river ? row('Longest river', `${esc(s.river)} (${fmtInt(s.riverKm)} km)`) : ''}
          ${row('Time zone', esc(s.timezone))}
          <div class="kv block"><span>Borders</span><b>${borders.length ? borders.join(', ') : 'None — an island unto itself'}</b></div>
          <div class="kv block"><span>Land carved from</span><ul class="mini">${carved}</ul></div>
        </section>
        ${provinces ? `<section><h3>${s.provinces.length} ${/State/.test(s.provinces[0].name) ? 'states' : 'provinces'}</h3>${provinces}</section>` : ''}`)}
      ${pane('people', `
        <div class="tiles">
          ${tile('Population', fmtShort(s.population))}
          ${tile('Density', (s.density < 10 ? s.density.toFixed(1) : fmtInt(s.density)) + '/km²', esc(r.population))}
          ${tile('Life expectancy', s.lifeExp + ' yrs')}
        </div>
        <section><h3>Population over time</h3>${lineChart(s.popHistory || [])}</section>
        ${s.religions ? `<section><h3>Religion</h3>${stackBar(s.religions)}</section>` : ''}
        ${s.languages ? `<section><h3>Languages</h3>${stackBar(s.languages)}</section>` : ''}
        <section><h3>Society</h3>
          ${row('Demonym', esc(s.demonym))}
          ${row('Urbanization', s.urban + '%')}
          ${row('Literacy', s.literacy + '%')}
          ${row('Internet users', s.internet + '%')}
          ${row('Happiness', `${s.happiness} / 10 ${bar(s.happiness, 10)}`)}
          ${row('National animal', esc(s.animal))}
          <div class="kv block"><span>Major cities</span><ul class="mini">${cities}</ul></div>
        </section>`)}
      ${pane('politics', `
        <section><h3>Government</h3>
          ${row('Ideology', esc(r.ideology))}
          ${row('System', esc(r.government))}
          ${row('Political doctrine', esc(r.doctrine))}
          ${row('Head of state', esc(s.leader))}
          ${row('Ruling party', esc(s.party))}
          ${row('Stability', esc(r.stability))}
          ${row('Freedom index', `${s.freedom} / 100 ${bar(s.freedom, 100)}`)}
          ${row('Clean govt. index', `${s.corruption} / 100 ${bar(s.corruption, 100)}`)}
          ${row('Founded', `${esc(s.founded)} <small>(${esc(r.founded)})</small>`)}
          ${row('National day', esc(s.holiday))}
        </section>
        ${s.parliament ? `<section><h3>Legislature</h3>${hemicycle(s.parliament)}</section>` : ''}
        ${s.wars && s.wars.length ? `<section><h3>War record</h3><ul class="war-log">${s.wars.slice().reverse().map(w => `<li class="${w.result === 'decisive' || w.result === 'win' ? 'won' : 'lost'}">${w.attacker ? 'Attacked' : 'Defended against'} ${esc(w.enemy)} — <b>${({ decisive: 'decisive victory', win: 'victory', loss: 'defeat', crushing: 'crushing defeat' })[w.result]}</b></li>`).join('')}</ul></section>` : ''}`)}
      ${pane('economy', `
        <div class="tiles">
          ${tile('GDP', '$' + fmtShort(s.gdp))}
          ${tile('Per capita', '$' + fmtInt(s.gdppc))}
          ${tile('Growth', (s.growth > 0 ? '+' : '') + s.growth + '%')}
        </div>
        ${s.sectors ? `<section><h3>Economy by sector</h3>${stackBar(s.sectors, 'of GDP')}</section>` : ''}
        <section><h3>Indicators</h3>
          ${row('HDI', `${s.hdi.toFixed(3)} <small>(${esc(r.development)})</small> ${bar(s.hdi, 1, hdiCls)}`)}
          ${row('System', esc(r.economy))}
          ${row('Inflation', s.inflation + '%')}
          ${row('Unemployment', s.unemployment + '%')}
          ${row('Gini (inequality)', s.gini)}
          ${row('Public debt', s.debt + '% of GDP')}
          ${row('Main resource', esc(r.resource))}
          ${row('Other resources', s.secondary.map(esc).join(', '))}
          ${row('Currency', `${esc(s.currency)} (${esc(s.currencyCode)})`)}
          ${row('Calling code', esc(s.callingCode))}
          ${row('Internet TLD', esc(s.tld))}
          ${row('Drives on the', esc(s.drives))}
        </section>`)}
      ${pane('military', `
        <div class="tiles">
          ${tile('Power', esc(r.military))}
          ${tile('Personnel', fmtShort(s.personnel))}
          ${tile('Warheads', s.warheads ? fmtInt(s.warheads) : 'None')}
        </div>
        ${s.forces ? `<section><h3>Armed forces</h3>${stackBar(s.forces, 'of personnel')}</section>` : ''}
        <section><h3>Defence</h3>
          ${row('Defence budget', s.milBudget + '% of GDP')}
          ${row('Annual spending', fmtMoney(s.gdp * s.milBudget / 100))}
          ${row('Doctrine', esc(r.doctrine))}
        </section>`)}
      <div class="drawer-actions">
        <button data-act="zoom" data-slot="${n.slot}">🔍 Zoom</button>
        <button data-act="war" data-slot="${n.slot}" class="btn-war">⚔️ Declare war</button>
        <button data-act="delete" data-slot="${n.slot}" class="danger">🗑️</button>
      </div>`);
    zoomToGeometry(n.geometry, 900);
  }

  function showCountry(id) {
    const info = WorldGen.countryInfo(id);
    const lost = state.nations.map(n => {
      const c = WorldGen.analyzeCells(n.cells).carved.find(x => x.id === id);
      return c ? `<li>${nationLink(n)} <small>${fmtArea(c.area)} · ${c.pct < 0.1 ? '<0.1' : c.pct.toFixed(1)}%</small></li>` : '';
    }).join('');
    openDrawer(`
      <div class="nation-head real">
        <h2>${esc(info.name)}</h2>
        <div class="chips"><span>Real-world country</span><span>${esc(info.continent)}</span></div>
      </div>
      <section><h3>Overview</h3>
        ${row('Continent', esc(info.continent))}
        ${row('Approx. land area', info.area > 0 ? fmtArea(info.area) : 'Too small to measure')}
      </section>
      <section><h3>Territory lost to your nations</h3>
        ${lost ? `<ul class="mini">${lost}</ul>` : '<p class="muted">None yet. Spin the wheels — maybe your next nation lands here!</p>'}
      </section>`);
  }

  function showNationList() {
    const list = state.nations.slice().reverse().map(n => `
      <li data-nation="${n.slot}">
        <span class="flag sm">${n.stats.flag}</span>
        <span class="nl-text"><b>${esc(n.stats.name)}</b><small>${esc(WorldGen.CONTINENTS[n.terr.continent])} · Pop. ${fmtBig(n.stats.population)} · HDI ${n.stats.hdi.toFixed(3)}</small></span>
      </li>`).join('');
    openDrawer(`
      <div class="nation-head real"><h2>My Nations</h2><div class="chips"><span>${state.nations.length} founded</span></div></div>
      ${list ? `<ul class="nation-list">${list}</ul>` : '<p class="muted pad">No nations yet. Spin the wheels to found your first!</p>'}
      ${state.fallen.length ? `<section><h3>🪦 Fallen nations</h3><ul class="nation-list fallen-list">${state.fallen.slice().reverse().map(f => `
        <li><span class="flag sm fallen">${f.flag}</span><span class="nl-text"><b>${esc(f.name)}</b><small>Conquered by ${esc(f.by)}</small></span></li>`).join('')}</ul></section>` : ''}`);
  }

  const RANK_COLS = [
    ['population', 'Pop.', s => s.population, fmtShort], ['gdp', 'GDP', s => s.gdp, v => '$' + fmtShort(v)],
    ['gdppc', 'Per cap.', s => s.gdppc, v => '$' + fmtShort(v)], ['area', 'Area', s => s.area, v => fmtShort(v)],
    ['hdi', 'HDI', s => s.hdi, v => v.toFixed(2)], ['personnel', 'Army', s => s.personnel, fmtShort],
  ];

  function showRankings() {
    const col = RANK_COLS.find(c => c[0] === state.rankKey) || RANK_COLS[1];
    const sorted = state.nations.slice().sort((a, b) => col[2](b.stats) - col[2](a.stats));
    const head = RANK_COLS.map(c => `<th class="${c[0] === col[0] ? 'on' : ''}" data-rank="${c[0]}">${c[1]}${c[0] === col[0] ? ' ▾' : ''}</th>`).join('');
    const rows = sorted.map((n, i) => `<tr data-nation="${n.slot}"><td class="rk">${i + 1}</td><td class="nm"><span class="flag xs">${n.stats.flag}</span>${esc(n.stats.root)}</td>${
      RANK_COLS.map(c => `<td class="${c[0] === col[0] ? 'on' : ''}">${c[3](c[2](n.stats))}</td>`).join('')}</tr>`).join('');
    openDrawer(`
      <div class="nation-head real"><h2>World Rankings</h2><div class="chips"><span>Your ${state.nations.length} nations</span><span>Tap a column to sort</span></div></div>
      ${rows ? `<div class="rank-wrap"><table class="rank"><thead><tr><th>#</th><th>Nation</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>`
        : '<p class="muted pad">Found some nations to see how they stack up.</p>'}`);
  }

  function showReveal(n) {
    const s = n.stats;
    const cmp = Realism.compare(s);
    $('reveal-body').innerHTML = `
      <div class="flag big hero">${s.flag}<span class="sheen"></span></div>
      <p class="eyebrow">A new nation is born</p>
      <h2>${esc(s.name)}</h2>
      <p class="motto">“${esc(s.motto)}”</p>
      <div class="reveal-grid">
        <div><small>Capital</small><b>${esc(s.capital)}</b></div>
        <div><small>Population</small><b>${fmtBig(s.population)}</b></div>
        <div><small>Area</small><b>${fmtArea(s.area)}</b></div>
        <div><small>HDI</small><b>${s.hdi.toFixed(3)}</b></div>
        <div><small>GDP</small><b>${fmtMoney(s.gdp)}</b></div>
        <div><small>Leader</small><b>${esc(s.leader)}</b></div>
      </div>
      <p class="compare">About as populous as <b>${esc(cmp.population)}</b>, as big as <b>${esc(cmp.area)}</b>, and as rich as <b>${esc(cmp.gdp)}</b>.</p>`;
    $('reveal').classList.remove('hidden');
    $('reveal').dataset.slot = n.slot;
  }

  function updateCount() { $('nation-count').textContent = state.nations.length; }

  function deleteNation(slot) {
    const idx = state.nations.findIndex(n => n.slot === slot);
    if (idx < 0) return;
    const n = state.nations[idx];
    if (!confirm(`Dissolve ${n.stats.name}? Its land returns to the old world.`)) return;
    WorldGen.release(n.cells);
    state.nations.splice(idx, 1);
    renderNations();
    save();
    updateCount();
    closeDrawer();
  }

  /* ================= news ticker ================= */

  function headlinesFor(n) {
    const s = n.stats, r = n.results;
    if (!n._nb) n._nb = WorldGen.analyzeCells(n.cells).neighbors.filter(x => x.type === 'country').map(x => WorldGen.countryInfo(x.id).name);
    const nb = n._nb.length ? pick(n._nb) : null;
    const prov = s.provinces ? pick(s.provinces).name : s.capital;
    const city = pick(s.cities).name;
    const h = [
      `${s.leader} of ${s.root} vows to ${pick(['modernise the armed forces', 'root out corruption', 'build a high-speed railway', `double ${s.secondary[0].toLowerCase()} exports`, 'host the next World Cup'])}`,
      `${s.root}'s economy ${s.growth >= 0 ? 'grows' : 'shrinks'} ${Math.abs(s.growth)}% as ${r.resource.toLowerCase()} ${pick(['prices climb', 'output surges', 'exports slow', 'markets wobble'])}`,
      `Crowds fill the streets of ${s.capital} for National Day on ${s.holiday}`,
      `${s.currency} ${pick(['hits a record high', 'slides against the dollar', 'holds steady'])} as inflation sits at ${s.inflation}%`,
      `${city} unveils plans for a ${pick(['new airport', 'giant stadium', 'tech district', 'harbour expansion', 'national museum'])}`,
      `Scientists spot a rare ${s.animal.toLowerCase()} in the wilds of ${prov}`,
    ];
    if (nb) h.push(pick([`${s.root} and ${nb} sign a historic trade pact`, `Border talks between ${s.root} and ${nb} enter their ${pick(['third', 'fifth', 'ninth'])} week`, `${nb} protests ${s.root}'s new border fence`, `Joint ${s.root}–${nb} railway opens to passengers`]));
    if (r.stability === 'Unstable' || r.stability === 'On the Brink') h.push(`Protests spread across ${prov} as tensions rise in ${s.root}`);
    if (s.warheads) h.push(`${s.root} parades ${s.warheads > 200 ? 'its vast' : 'its'} nuclear arsenal through ${s.capital}`);
    if (r.government === 'Military Junta') h.push(`${s.leader} postpones elections in ${s.root} "until further notice"`);
    if (r.religion === 'Machine Worship') h.push(`${s.root}'s high priests bless the nation's newest supercomputer`);
    if (s.hdi > 0.9) h.push(`${s.root} tops global quality-of-life rankings again`);
    return h;
  }

  function updateTicker() {
    const wars = state.events.slice(-4).reverse().map(h => '⚔️ ' + h);
    const items = state.nations.length
      ? wars.concat(state.nations.flatMap(n => headlinesFor(n).sort(() => Math.random() - 0.5).slice(0, 3)).sort(() => Math.random() - 0.5).slice(0, 10))
      : ['Cartographers on standby as the world awaits a new nation', 'Spin the wheels to make history', 'Diplomats warn: new borders could appear anywhere, anytime'];
    const el = $('ticker-text');
    el.innerHTML = items.map(t => `<span>${esc(t)}</span>`).join('<i>◆</i>');
    const track = el.parentElement.clientWidth || 600;
    const dur = Math.max(25, (el.scrollWidth + track) / 70);
    el.style.setProperty('--ticker-from', track + 'px');
    el.style.animationDuration = dur + 's';
    el.classList.remove('run'); void el.offsetWidth; el.classList.add('run');
  }

  /* ================= persistence ================= */

  function save() {
    try {
      const data = state.nations.map(n => ({
        slot: n.slot, color: n.color, geometry: n.geometry, provinceLines: n.provinceLines, rle: n.rle, results: n.results,
        style: n.style, lines: n.lines,
        terr: n.terr, stats: n.stats, created: n.created,
      }));
      localStorage.setItem(STORE_KEY, JSON.stringify({ nextSlot: state.nextSlot, nations: data, fallen: state.fallen, events: state.events }));
    } catch (e) { /* storage unavailable or full: the game still works for this session */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      state.nextSlot = data.nextSlot || 1;
      state.fallen = data.fallen || [];
      state.events = data.events || [];
      state.nations = (data.nations || []).map(n => {
        n.cells = WorldGen.decodeCells(n.rle);
        WorldGen.claim(n.cells, n.slot);
        return n;
      });
    } catch (e) { state.nations = []; }
  }

  function resetWorld() {
    if (!confirm('Reset the world? All your nations will be dissolved.')) return;
    state.nations = [];
    state.nextSlot = 1;
    state.fallen = [];
    state.events = [];
    WorldGen.clearOwners();
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
    renderNations();
    updateCount();
    closeDrawer();
    resetSpins();
    zoomHome();
  }

  /* ================= confetti ================= */

  function confetti() {
    const cv = $('confetti');
    const ctx = cv.getContext('2d');
    cv.width = window.innerWidth; cv.height = window.innerHeight;
    const colors = ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#f78c6b', '#c65bcf'];
    const parts = Array.from({ length: 180 }, () => ({
      x: cv.width / 2 + (Math.random() - 0.5) * 200, y: cv.height * 0.35,
      vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 14 - 4,
      r: Math.random() * 6 + 3, c: colors[Math.floor(Math.random() * colors.length)], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4,
    }));
    const t0 = performance.now();
    (function frame(now) {
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const p of parts) {
        p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
        ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
        ctx.restore();
      }
      if (now - t0 < 3500) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, cv.width, cv.height);
    })(t0);
  }

  /* ================= wiring ================= */

  function wire() {
    $('btn-spin').addEventListener('click', () => { state.auto = false; spinCurrent($('chk-fast').checked); });
    $('btn-auto').addEventListener('click', autoSpin);
    $('btn-restart').addEventListener('click', () => { if (!state.busy) resetSpins(); });
    $('btn-nations').addEventListener('click', showNationList);
    $('btn-rankings').addEventListener('click', showRankings);
    $('btn-reset').addEventListener('click', resetWorld);
    $('btn-sound').addEventListener('click', () => {
      Sound.enabled = !Sound.enabled;
      $('btn-sound').textContent = Sound.enabled ? '🔊' : '🔇';
    });
    $('zoom-in').addEventListener('click', () => svg.transition().duration(300).call(zoom.scaleBy, 1.8));
    $('zoom-out').addEventListener('click', () => svg.transition().duration(300).call(zoom.scaleBy, 1 / 1.8));
    $('zoom-home').addEventListener('click', zoomHome);
    $('flag-toggle').addEventListener('click', () => {
      state.flagFill = !state.flagFill;
      try { localStorage.setItem(STORE_KEY + '-flagfill', state.flagFill ? '1' : '0'); } catch (e) { /* ignore */ }
      updateFlagToggle();
      nationG.selectAll('path.nation').attr('fill', nationFill).classed('flag-filled', state.flagFill);
    });
    $('drawer-close').addEventListener('click', closeDrawer);

    const body = $('drawer-body');
    body.addEventListener('click', ev => {
      const tabBtn = ev.target.closest('[data-tab]');
      if (tabBtn) {
        state.tab = tabBtn.dataset.tab;
        body.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b === tabBtn));
        body.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.dataset.pane === state.tab));
        return;
      }
      const rk = ev.target.closest('[data-rank]');
      if (rk) { state.rankKey = rk.dataset.rank; showRankings(); return; }
      const tgt = ev.target.closest('[data-target]');
      if (tgt) {
        const n = state.nations.find(x => x.slot === +tgt.closest('[data-attacker]').dataset.attacker);
        if (n) manualWar(n, tgt.dataset.target);
        return;
      }
      const a = ev.target.closest('[data-nation],[data-country],[data-act]');
      if (!a) return;
      ev.preventDefault();
      if (a.dataset.act === 'zoom') { const n = state.nations.find(x => x.slot === +a.dataset.slot); if (n) zoomToGeometry(n.geometry); }
      else if (a.dataset.act === 'delete') deleteNation(+a.dataset.slot);
      else if (a.dataset.act === 'war') { const n = state.nations.find(x => x.slot === +a.dataset.slot); if (n) showWarPicker(n); }
      else if (a.dataset.nation) { const n = state.nations.find(x => x.slot === +a.dataset.nation); if (n) showNation(n); }
      else if (a.dataset.country) showCountry(+a.dataset.country);
    });
    // Chart tooltips
    body.addEventListener('mousemove', ev => {
      const t = ev.target.closest('[data-tip]');
      if (t) tip(ev, t.dataset.tip); else hideTip();
    });
    body.addEventListener('mouseleave', hideTip);

    $('reveal-stats').addEventListener('click', () => {
      $('reveal').classList.add('hidden');
      const n = $('reveal').dataset.slot ? state.nations.find(x => x.slot === +$('reveal').dataset.slot) : null;
      state.tab = 'overview';
      if (n) showNation(n);
      resetSpins();
    });
    $('reveal-again').addEventListener('click', () => { $('reveal').classList.add('hidden'); closeDrawer(); resetSpins(); });
    $('ticker-text').addEventListener('animationiteration', updateTicker);

    document.addEventListener('keydown', ev => {
      if (ev.code === 'Space' && !ev.target.closest('input,button,textarea') && $('reveal').classList.contains('hidden')) {
        ev.preventDefault();
        spinCurrent($('chk-fast').checked);
      }
      if (ev.key === 'Escape') { closeDrawer(); }
    });
  }

  function updateFlagToggle() {
    $('flag-toggle').classList.toggle('active', state.flagFill);
    $('flag-toggle').title = state.flagFill ? 'Showing flags on nations — click for plain colours' : 'Showing plain colours — click to paint flags on nations';
  }

  function start() {
    try { state.flagFill = localStorage.getItem(STORE_KEY + '-flagfill') !== '0'; } catch (e) { /* ignore */ }
    WorldGen.init(window.WORLD_TOPO);
    load();
    initMap();
    wire();
    updateFlagToggle();
    updateCount();
    loadWheel();
    $('loading').classList.add('done');
    setTimeout(() => $('loading').remove(), 600);
  }

  requestAnimationFrame(() => setTimeout(() => {
    try { start(); }
    catch (e) {
      console.error(e);
      $('loading').querySelector('p').textContent = 'Something went wrong loading the world: ' + e.message;
    }
  }, 30));
})();
