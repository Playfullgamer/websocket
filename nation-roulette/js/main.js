/* Nation Roulette — map, game flow and UI. */
(function () {
  'use strict';

  const { WHEELS, Wheel, Sound, Lore } = window.NR;
  const STORE_KEY = 'nation-roulette-v1';
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(res => setTimeout(res, ms));

  const fmtInt = n => Math.round(n).toLocaleString('en-US');
  function fmtBig(n) {
    const a = Math.abs(n);
    if (a >= 1e12) return (n / 1e12).toFixed(2) + ' trillion';
    if (a >= 1e9) return (n / 1e9).toFixed(2) + ' billion';
    if (a >= 1e6) return (n / 1e6).toFixed(2) + ' million';
    return fmtInt(n);
  }
  const fmtMoney = n => '$' + fmtBig(n);
  const fmtArea = n => fmtInt(n) + ' km²';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const state = {
    step: 0, results: {}, territory: null, busy: false, auto: false,
    nations: [], nextSlot: 1, drawerOpen: false, flagFill: true,
  };

  /* ================= map ================= */

  const svg = d3.select('#map');
  const projection = d3.geoNaturalEarth1();
  const path = d3.geoPath(projection);
  let width = 800, height = 500, k = 1;
  let world, land, countries;

  const defs = svg.append('defs');
  const clipPath = defs.append('clipPath').attr('id', 'land-clip').append('path');
  const zoomLayer = svg.append('g');
  const spherePath = zoomLayer.append('path').attr('class', 'sphere');
  const gratPath = zoomLayer.append('path').attr('class', 'graticule');
  const countryG = zoomLayer.append('g').attr('class', 'countries');
  const nationG = zoomLayer.append('g').attr('class', 'nations').attr('clip-path', 'url(#land-clip)');
  const pendingG = zoomLayer.append('g').attr('class', 'pending').attr('clip-path', 'url(#land-clip)');
  const markerG = zoomLayer.append('g').attr('class', 'markers');
  const labelG = zoomLayer.append('g').attr('class', 'labels');

  const zoom = d3.zoom().scaleExtent([1, 160]).clickDistance(5)
    .on('zoom', ev => { zoomLayer.attr('transform', ev.transform); k = ev.transform.k; updateScaled(); });
  svg.call(zoom);

  const COUNTRY_TONES = ['#d9cfb4', '#cfd6b8', '#d6c6ae', '#e0d4c0', '#c8cfb0', '#dccbb6', '#cbc4a6', '#d3d9bf'];

  function layout() {
    const r = $('map-wrap').getBoundingClientRect();
    width = Math.max(300, r.width); height = Math.max(240, r.height);
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    projection.fitExtent([[6, 6], [width - 6, height - 6]], { type: 'Sphere' });
    zoom.extent([[0, 0], [width, height]]).translateExtent([[0, 0], [width, height]]);
    spherePath.attr('d', path({ type: 'Sphere' }));
    gratPath.attr('d', path(d3.geoGraticule10()));
    countryG.selectAll('path').attr('d', path);
    clipPath.attr('d', path(land));
    renderNations();
    renderPending();
  }

  function initMap() {
    world = window.WORLD_TOPO;
    land = topojson.feature(world, world.objects.land);
    countries = WorldGen.features;
    countryG.selectAll('path').data(countries).join('path')
      .attr('class', 'country')
      .attr('fill', (d, i) => COUNTRY_TONES[(i * 7 + (d.properties.name.length)) % COUNTRY_TONES.length])
      .on('click', (ev, d) => showCountry(countries.indexOf(d)))
      .on('mousemove', (ev, d) => tip(ev, `<b>${esc(d.properties.name)}</b>`))
      .on('mouseleave', hideTip);
    layout();
    window.addEventListener('resize', () => { layout(); wheel.resize(); });
  }

  function tip(ev, html) {
    const t = $('tooltip');
    const r = $('map-wrap').getBoundingClientRect();
    t.innerHTML = html;
    t.classList.remove('hidden');
    t.style.left = Math.min(ev.clientX - r.left + 14, r.width - 220) + 'px';
    t.style.top = (ev.clientY - r.top + 14) + 'px';
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
    const drawerW = state.drawerOpen && width > 760 ? Math.min(400, width * 0.45) : 0;
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

  function loadWheel() {
    const w = WHEELS[state.step];
    wheel.setSegments(w.segments, w.icon);
    $('step-count').textContent = `Wheel ${state.step + 1} of ${WHEELS.length}`;
    $('wheel-title').textContent = w.title;
    $('wheel-desc').textContent = w.desc;
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
      finalize();
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

  function finalize() {
    const terr = state.territory;
    if (!terr) { resetSpins(); return; }
    const seed = (Math.random() * 2 ** 31) | 0;
    const stats = Lore.build(state.results, terr, seed);
    const hue = Math.floor(Math.random() * 360);
    const nation = {
      slot: state.nextSlot++,
      color: `hsl(${hue}, ${62 + Math.floor(Math.random() * 20)}%, ${48 + Math.floor(Math.random() * 10)}%)`,
      geometry: terr.geometry,
      rle: WorldGen.encodeCells(terr.cells),
      cells: terr.cells,
      results: Object.fromEntries(Object.entries(state.results).map(([key, v]) => [key, v.label])),
      terr: { area: terr.area, coastlineKm: terr.coastlineKm, landlocked: terr.landlocked, continent: terr.continent },
      stats,
      created: Date.now(),
    };
    WorldGen.claim(terr.cells, nation.slot);
    state.nations.push(nation);
    state.territory = null;
    renderPending();
    renderNations();
    save();
    updateCount();
    Sound.fanfare();
    confetti();
    showReveal(nation);
  }

  function resetSpins() {
    state.auto = false;
    state.step = 0;
    state.results = {};
    state.territory = null;
    renderPending();
    loadWheel();
  }

  /* ================= panels ================= */

  function openDrawer(html) {
    $('drawer-body').innerHTML = html;
    $('drawer').classList.remove('hidden');
    $('drawer-body').scrollTop = 0;
    state.drawerOpen = true;
  }
  function closeDrawer() { $('drawer').classList.add('hidden'); state.drawerOpen = false; }

  function bar(v, max, cls) {
    return `<span class="bar ${cls || ''}"><i style="width:${Math.max(2, Math.min(100, v / max * 100))}%"></i></span>`;
  }

  function row(label, value) { return `<div class="kv"><span>${label}</span><b>${value}</b></div>`; }

  function nationLink(n) { return `<a href="#" data-nation="${n.slot}">${esc(n.stats.root)}</a>`; }
  function countryLink(id, name) { return `<a href="#" data-country="${id}">${esc(name)}</a>`; }

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
    openDrawer(`
      <div class="nation-head">
        <div class="flag">${s.flag}</div>
        <h2>${esc(s.name)}</h2>
        <p class="motto">“${esc(s.motto)}”</p>
        <div class="chips">
          <span>${esc(WorldGen.CONTINENTS[t.continent])}</span><span>${esc(r.region)}</span>
          <span>${t.landlocked ? 'Landlocked' : 'Coastal'}</span><span>${esc(r.size)}</span>
        </div>
      </div>
      <section><h3>🗺️ Geography</h3>
        ${row('Area', fmtArea(s.area))}
        ${row('Coastline', t.landlocked ? 'None (landlocked)' : fmtInt(t.coastlineKm) + ' km')}
        ${row('Border style', esc(r.borders || 'Natural & Winding'))}
        ${row('Terrain', esc(r.terrain))}
        ${row('Climate', esc(s.climate))}
        ${row('Highest point', `${esc(s.highestName)} (${fmtInt(s.highest)} m)`)}
        ${s.river ? row('Longest river', `${esc(s.river)} (${fmtInt(s.riverKm)} km)`) : ''}
        ${row('Capital', '★ ' + esc(s.capital))}
        <div class="kv block"><span>Borders</span><b>${borders.length ? borders.join(', ') : 'None — an island unto itself'}</b></div>
        <div class="kv block"><span>Land carved from</span><ul class="mini">${carved}</ul></div>
      </section>
      <section><h3>👥 People</h3>
        ${row('Population', fmtBig(s.population))}
        ${row('Density', `${s.density < 10 ? s.density.toFixed(1) : fmtInt(s.density)} /km² <small>(${esc(r.population)})</small>`)}
        ${row('Demonym', esc(s.demonym))}
        ${row('Language', esc(s.language))}
        ${row('Religion', esc(r.religion))}
        ${row('Urbanization', s.urban + '%')}
        ${row('Life expectancy', s.lifeExp + ' years')}
        ${row('Literacy', s.literacy + '%')}
        ${row('Internet users', s.internet + '%')}
        ${row('Happiness', `${s.happiness} / 10 ${bar(s.happiness, 10)}`)}
        <div class="kv block"><span>Major cities</span><ul class="mini">${cities}</ul></div>
      </section>
      <section><h3>🏛️ Politics</h3>
        ${row('Ideology', esc(r.ideology))}
        ${row('Government', esc(r.government))}
        ${row('Political doctrine', esc(r.doctrine))}
        ${row('Head of state', esc(s.leader))}
        ${row('Ruling party', esc(s.party))}
        ${row('Freedom index', `${s.freedom} / 100 ${bar(s.freedom, 100)}`)}
        ${row('Clean govt. index', `${s.corruption} / 100 ${bar(s.corruption, 100)}`)}
        ${row('Stability', esc(r.stability))}
        ${row('Founded', `${esc(s.founded)} <small>(${esc(r.founded)})</small>`)}
        ${row('National day', esc(s.holiday))}
      </section>
      <section><h3>💰 Economy</h3>
        ${row('HDI', `${s.hdi.toFixed(3)} <small>(${esc(r.development)})</small> ${bar(s.hdi, 1, hdiCls)}`)}
        ${row('System', esc(r.economy))}
        ${row('GDP (nominal)', fmtMoney(s.gdp))}
        ${row('GDP per capita', '$' + fmtInt(s.gdppc))}
        ${row('GDP growth', (s.growth > 0 ? '+' : '') + s.growth + '%')}
        ${row('Inflation', s.inflation + '%')}
        ${row('Unemployment', s.unemployment + '%')}
        ${row('Gini (inequality)', s.gini)}
        ${row('Public debt', s.debt + '% of GDP')}
        ${row('Main resource', esc(r.resource))}
        ${row('Other resources', s.secondary.map(esc).join(', '))}
        ${row('Currency', `${esc(s.currency)} (${esc(s.currencyCode)})`)}
      </section>
      <section><h3>🛡️ Military</h3>
        ${row('Power', esc(r.military))}
        ${row('Active personnel', fmtInt(s.personnel))}
        ${row('Defence budget', s.milBudget + '% of GDP (' + fmtMoney(s.gdp * s.milBudget / 100) + ')')}
        ${row('Nuclear warheads', s.warheads ? fmtInt(s.warheads) : 'None')}
      </section>
      ${s.flagMeaning ? `<section><h3>🏳️ Flag symbolism</h3><ul class="flag-meaning">${s.flagMeaning.map(m => `<li>${m}</li>`).join('')}</ul></section>` : ''}
      <section><h3>🎌 Odds &amp; ends</h3>
        ${row('National animal', esc(s.animal))}
        ${row('Time zone', esc(s.timezone))}
        ${row('Calling code', esc(s.callingCode))}
        ${row('Internet TLD', esc(s.tld))}
        ${row('Drives on the', esc(s.drives))}
      </section>
      <div class="drawer-actions">
        <button data-act="zoom" data-slot="${n.slot}">🔍 Zoom to nation</button>
        <button data-act="delete" data-slot="${n.slot}" class="danger">🗑️ Dissolve nation</button>
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
      <section><h3>🗺️ Overview</h3>
        ${row('Continent', esc(info.continent))}
        ${row('Approx. land area', info.area > 0 ? fmtArea(info.area) : 'Too small to measure')}
      </section>
      <section><h3>🏴 Territory lost to your nations</h3>
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
      ${list ? `<ul class="nation-list">${list}</ul>` : '<p class="muted pad">No nations yet. Spin the wheels to found your first!</p>'}`);
  }

  function showReveal(n) {
    const s = n.stats;
    $('reveal-body').innerHTML = `
      <div class="flag big">${s.flag}</div>
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
      </div>`;
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

  /* ================= persistence ================= */

  function save() {
    try {
      const data = state.nations.map(n => ({
        slot: n.slot, color: n.color, geometry: n.geometry, rle: n.rle, results: n.results, terr: n.terr, stats: n.stats, created: n.created,
      }));
      localStorage.setItem(STORE_KEY, JSON.stringify({ nextSlot: state.nextSlot, nations: data }));
    } catch (e) { /* storage unavailable or full: the game still works for this session */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      state.nextSlot = data.nextSlot || 1;
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

    $('drawer-body').addEventListener('click', ev => {
      const a = ev.target.closest('[data-nation],[data-country],[data-act]');
      if (!a) return;
      ev.preventDefault();
      if (a.dataset.act === 'zoom') { const n = state.nations.find(x => x.slot === +a.dataset.slot); if (n) zoomToGeometry(n.geometry); }
      else if (a.dataset.act === 'delete') deleteNation(+a.dataset.slot);
      else if (a.dataset.nation) { const n = state.nations.find(x => x.slot === +a.dataset.nation); if (n) showNation(n); }
      else if (a.dataset.country) showCountry(+a.dataset.country);
    });

    $('reveal-stats').addEventListener('click', () => {
      $('reveal').classList.add('hidden');
      const n = state.nations.find(x => x.slot === +$('reveal').dataset.slot);
      if (n) showNation(n);
      resetSpins();
    });
    $('reveal-again').addEventListener('click', () => { $('reveal').classList.add('hidden'); closeDrawer(); resetSpins(); });

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
