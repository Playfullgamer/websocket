/* Nation Roulette — wars.
 *
 * A side is either one of your nations or a real country (its unclaimed land).
 * Strength comes from army size, military power, GDP and stability; defenders
 * get a home bonus (more in rugged terrain) and nuclear deterrence. A war is
 * five battles; the tally decides whether land is annexed, ceded, or a nation
 * falls or becomes a puppet. Land moves along a straight armistice line.
 */
(function (global) {
  'use strict';

  const { WHEELS, Sound, Realism } = global.NR;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const sleep = ms => new Promise(res => setTimeout(res, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const fmtShort = n => { const a = Math.abs(n); return a >= 1e12 ? (n / 1e12).toFixed(1) + 'T' : a >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : a >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : a >= 1e3 ? Math.round(n / 1e3) + 'k' : String(Math.round(n)); };
  const fmtInt = n => Math.round(n).toLocaleString('en-US');

  const segOf = key => WHEELS.find(w => w.key === key).segments;
  const POWER_LABELS = segOf('military').map(s => s.label);
  const powerOf = label => (segOf('military').find(s => s.label === label) || { power: 2 }).power;
  const stabOf = label => (segOf('stability').find(s => s.label === label) || { score: 3 }).score;

  /* ---------- sides ---------- */

  function nationSide(n) {
    return {
      kind: 'nation', nation: n, name: n.stats.root, fullName: n.stats.name, flag: n.stats.flag,
      get cells() { return n.cells; },
      s: {
        population: n.stats.population, gdp: n.stats.gdp, personnel: n.stats.personnel, power: powerOf(n.results.military),
        warheads: n.stats.warheads || 0, stab: stabOf(n.results.stability), terrain: n.results.terrain,
      },
      places: [...(n.stats.provinces || []).map(p => p.name), ...n.stats.cities.map(c => c.name)],
    };
  }

  function genericFlag(name) {
    const initials = name.split(/[\s.-]+/).filter(Boolean).map(w => w[0]).join('').slice(0, 3).toUpperCase();
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" preserveAspectRatio="none"><rect width="300" height="200" fill="#4a5568"/><rect y="150" width="300" height="50" fill="#2d3748"/><text x="150" y="118" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="72" fill="#e2e8f0">${esc(initials)}</text></svg>`;
  }

  function countrySide(id) {
    const info = WorldGen.countryInfo(id);
    const cells = WorldGen.freeCellsOfCountry(id);
    const s = Realism.realStats(info.name, info.area);
    return {
      kind: 'country', id, name: info.name, fullName: info.name, flag: genericFlag(info.name), cells,
      realArea: Math.max(1, info.area), s, places: [`the ${info.name} frontier`, `${info.name}'s heartland`, 'the border hills', 'the river crossing'],
    };
  }

  /* ---------- odds and battles ---------- */

  function strength(side, defending, other) {
    const s = side.s;
    let v = Math.sqrt(s.personnel + 500) * (1 + 0.45 * s.power) * Math.pow(Math.max(1e6, s.gdp), 0.12) * (0.75 + 0.07 * s.stab);
    if (defending) {
      v *= 1.25;
      if (['Mountains', 'Highlands', 'Jungle', 'Canyons'].includes(s.terrain)) v *= 1.2;
      if (s.warheads && !other.s.warheads) v *= 1.6;
    }
    return v;
  }

  function odds(A, D) {
    const a = strength(A, false, D), d = strength(D, true, A);
    return Math.min(0.95, Math.max(0.05, a / (a + d)));
  }

  function outcomeOf(wins) { return wins >= 4 ? 'decisive' : wins === 3 ? 'win' : wins === 2 ? 'loss' : 'crushing'; }

  /* ---------- moving land ---------- */

  // Recompute a nation's borders, provinces and capital after its land changed. False if nothing is left.
  function refresh(n) {
    const st = n.stats;
    const seats = (st.provinces || []).map(p => [p.lon, p.lat]);
    const r = WorldGen.rebuild(n.cells, n.style || 'natural', n.lines || [], seats);
    if (!r) return false;
    n.geometry = r.geometry;
    n.provinceLines = r.provinceLines;
    n.rle = WorldGen.encodeCells(n.cells);
    if (st.provinces) {
      const kept = r.keptSeats.map((k, j) => Object.assign({}, st.provinces[k], { area: Math.round(r.provinceAreas[j] || 0) }));
      st.provinces = kept.length >= 2 ? kept : null;
    }
    n.terr.area = r.area; n.terr.landlocked = r.landlocked; n.terr.coastlineKm = r.coastlineKm;
    st.area = r.area;
    if (!st.cities.some(c => c.capital)) {
      if (st.cities.length) {
        st.cities.sort((a, b) => b.pop - a.pop);
        st.cities[0].capital = true;
      } else {
        st.cities = [{ name: `New ${st.root}`, lon: r.centroid[0], lat: r.centroid[1], pop: Math.round(st.population * 0.2), capital: true }];
      }
    }
    st.cities.sort((a, b) => (b.capital - a.capital) || (b.pop - a.pop));
    st.capital = st.cities[0].name;
    st.density = st.population / Math.max(1, st.area);
    st.gdp = st.population * st.gdppc;
    if (st.provinces) {
      const w = st.provinces.map(p => Math.pow(Math.max(1, p.area), 0.6) * (p.capital ? 2.2 : 1));
      const tot = w.reduce((a, b) => a + b, 0);
      st.provinces.forEach((p, k) => { p.pop = Math.round(st.population * w[k] / tot); });
    }
    n._nb = null;
    return true;
  }

  function moveLand(from, to, moved) {
    if (!moved.length) return { cities: [], area: 0 };
    const set = new Set(moved);
    const inMoved = (lon, lat) => set.has(WorldGen.cellOf(lon, lat));
    const area = WorldGen.areaOf(moved);
    let popMoved, lostCities = [];
    if (from.kind === 'nation') {
      const fs = from.nation.stats;
      popMoved = fs.population * Math.min(1, area / Math.max(1, fs.area));
      lostCities = fs.cities.filter(c => inMoved(c.lon, c.lat));
      fs.cities = fs.cities.filter(c => !inMoved(c.lon, c.lat));
      const lostProv = (fs.provinces || []).filter(p => inMoved(p.lon, p.lat));
      if (fs.provinces) fs.provinces = fs.provinces.filter(p => !inMoved(p.lon, p.lat));
      from.nation.cells = from.nation.cells.filter(i => !set.has(i));
      fs.population = Math.max(0, Math.round(fs.population - popMoved));
      if (to.kind === 'nation') {
        const ts = to.nation.stats;
        ts.cities.push(...lostCities.map(c => Object.assign({}, c, { capital: false })));
        if (lostProv.length) {
          if (!ts.provinces) {
            const cap = ts.cities.find(c => c.capital) || ts.cities[0];
            ts.provinces = [{ name: `${ts.root} Heartland`, seat: cap.name, capital: true, area: ts.area, pop: ts.population, lon: cap.lon, lat: cap.lat }];
          }
          ts.provinces.push(...lostProv.map(p => Object.assign({}, p, { capital: false })));
        }
      }
    } else {
      popMoved = from.s.population / from.realArea * area;
      from.cells = from.cells.filter(i => !set.has(i));
    }
    if (to.kind === 'nation') {
      to.nation.cells = to.nation.cells.concat(moved);
      WorldGen.claim(moved, to.nation.slot);
      to.nation.stats.population = Math.round(to.nation.stats.population + popMoved);
    } else {
      WorldGen.release(moved);
    }
    return { cities: lostCities, area };
  }

  function addLine(side, line) {
    if (!line || side.kind !== 'nation') return;
    const n = side.nation;
    n.lines = (n.lines || []).concat([line]).slice(-10);
  }

  function casualties(side, rate) {
    if (side.kind !== 'nation') return;
    const st = side.nation.stats;
    st.personnel = Math.max(0, Math.round(st.personnel * (1 - rate)));
  }

  // Applies the result of a war. Returns what happened, for the result screen and the map.
  function apply(A, D, type) {
    const out = { type, moved: [], destroyed: null, puppet: null, area: 0, cities: [] };
    const nameA = A.name, nameD = D.name;
    if (type === 'decisive' || type === 'win') {
      let frac = type === 'decisive' ? rand(0.45, 0.8) : rand(0.12, 0.32);
      if (D.kind === 'country') {
        const dArea = WorldGen.areaOf(D.cells);
        frac = Math.min(frac, A.nation.stats.area * (type === 'decisive' ? 0.9 : 0.3) / Math.max(1, dArea));
      }
      let f = WorldGen.frontline(D.cells, A.cells, frac);
      let full = false;
      if (D.kind === 'nation' && D.nation.stats.area - f.area < Math.max(1500, D.nation.stats.area * 0.12)) {
        full = true;
        f = { cells: D.cells.slice(), area: D.nation.stats.area, line: null };
      }
      const m = moveLand(D, A, f.cells);
      addLine(A, f.line); addLine(D, f.line);
      out.moved = f.cells; out.area = m.area; out.cities = m.cities;
      if (full) out.destroyed = D;
      casualties(A, rand(0.03, 0.09)); casualties(D, rand(0.12, 0.3));
      const pct = D.kind === 'nation' && !full ? Math.round(m.area / (D.nation.stats.area + m.area) * 100) : null;
      const cityTxt = m.cities.length ? `, capturing ${m.cities.map(c => esc(c.name)).slice(0, 3).join(', ')}` : '';
      out.headline = full ? `${nameA} conquers ${nameD} — ${nameD} ceases to exist`
        : `${nameA} annexes ${fmtInt(m.area)} km² from ${nameD}`;
      out.text = full ? `🏆 <b>Total victory!</b> ${esc(nameA)} annexes all of ${esc(nameD)}${cityTxt}. ${esc(nameD)} has fallen.`
        : `${type === 'decisive' ? '🏆 <b>Decisive victory!</b>' : '✅ <b>Victory.</b>'} ${esc(nameA)} annexes ${fmtInt(m.area)} km²${pct ? ` (${pct}% of ${esc(nameD)})` : ` of ${esc(nameD)}`}${cityTxt}.`;
    } else if (type === 'loss') {
      const f = WorldGen.frontline(A.cells, D.cells, rand(0.1, 0.28));
      const m = moveLand(A, D, f.cells);
      addLine(A, f.line); addLine(D, f.line);
      out.moved = f.cells; out.area = m.area; out.cities = m.cities;
      casualties(A, rand(0.12, 0.25)); casualties(D, rand(0.05, 0.12));
      out.headline = `${nameA} loses ${fmtInt(m.area)} km² to ${nameD} after failed war`;
      out.text = `❌ <b>Defeat.</b> ${esc(nameA)} cedes ${fmtInt(m.area)} km² to ${esc(nameD)}${m.cities.length ? `, including ${m.cities.map(c => esc(c.name)).slice(0, 3).join(', ')}` : ''}.`;
    } else {
      const small = A.nation.stats.area < 60000;
      if (small || Math.random() < 0.4) {
        const cells = A.cells.slice();
        const m = moveLand(A, D, cells);
        out.moved = cells; out.area = m.area; out.destroyed = A;
        out.headline = `${nameA} crushed — absorbed by ${nameD}`;
        out.text = `💀 <b>Crushing defeat.</b> ${esc(nameA)} is wiped off the map${D.kind === 'nation' ? ` and absorbed by ${esc(nameD)}` : ` — its land returns to ${esc(nameD)}`}.`;
      } else {
        const f = WorldGen.frontline(A.cells, D.cells, rand(0.6, 0.8));
        const m = moveLand(A, D, f.cells);
        addLine(A, f.line); addLine(D, f.line);
        out.moved = f.cells; out.area = m.area; out.puppet = A;
        A.nation.stats.puppetOf = D.fullName;
        casualties(A, rand(0.3, 0.5));
        out.headline = `${nameA} becomes a puppet of ${nameD}`;
        out.text = `⛓️ <b>Crushing defeat.</b> ${esc(nameA)} loses ${fmtInt(m.area)} km² and becomes a <b>puppet state</b> of ${esc(nameD)}.`;
      }
    }
    for (const side of [A, D]) {
      if (side.kind !== 'nation' || side === out.destroyed) continue;
      side.nation.stats.wars = (side.nation.stats.wars || []).concat([{
        enemy: side === A ? nameD : nameA, attacker: side === A,
        result: side === A ? type : ({ decisive: 'crushing', win: 'loss', loss: 'win', crushing: 'decisive' })[type],
      }]).slice(-12);
      if (!refresh(side.nation)) out.destroyed = side;
    }
    return out;
  }

  /* ---------- war screen ---------- */

  function cmpRow(label, a, b, fmt) {
    const tot = (a + b) || 1;
    return `<div class="cmp-row"><span class="cv">${fmt(a)}</span><span class="cbar"><i class="ca" style="width:${a / tot * 100}%"></i><i class="cd" style="width:${b / tot * 100}%"></i></span><span class="cv r">${fmt(b)}</span><small>${label}</small></div>`;
  }

  function sideCard(side, cls) {
    const extra = side.kind === 'nation' && side.nation.stats.puppetOf ? `<em>Puppet of ${esc(side.nation.stats.puppetOf)}</em>` : side.kind === 'country' ? '<em>Real-world country</em>' : '';
    return `<div class="side ${cls}"><div class="flag md">${side.flag}</div><b>${esc(side.name)}</b>${extra}</div>`;
  }

  let resolver = null;
  function choose(value) { if (resolver) { const r = resolver; resolver = null; r(value); } }

  function buttons(list) {
    $('war-actions').innerHTML = list.map(([v, label, cls]) => `<button data-war="${v}" class="${cls || ''}">${label}</button>`).join('');
    return new Promise(res => { resolver = res; });
  }

  const MODES = {
    offer: { kicker: '⚔️ Boxed in!', sub: (A, D) => `${esc(A.name)} is hemmed in by ${esc(D.name)}. Fight for the land you were promised?`, btns: [['fight', '⚔️ Declare war', 'btn-war'], ['no', '🕊️ Accept borders', 'ghost']] },
    independence: { kicker: '🔥 War of independence', sub: (A, D) => `No free land was left, so ${esc(A.name)} rose up inside ${esc(D.name)}'s borders. Win to keep it!`, btns: [['fight', '⚔️ Fight for independence', 'btn-war']] },
    manual: { kicker: '⚔️ Declaration of war', sub: (A, D) => `${esc(A.name)} prepares to invade ${esc(D.name)}.`, btns: [['fight', '⚔️ Attack!', 'btn-war'], ['no', 'Cancel', 'ghost']] },
  };

  async function run(A, D, opts) {
    const mode = MODES[opts.mode] || MODES.manual;
    const p = odds(A, D);
    $('war-kicker').textContent = mode.kicker;
    $('war-title').innerHTML = `${esc(A.name)} <span>vs</span> ${esc(D.name)}`;
    $('war-sub').innerHTML = mode.sub(A, D);
    $('war-sides').innerHTML = sideCard(A, 'a') + '<div class="vs">VS</div>' + sideCard(D, 'd') + `<div class="cmp">
      ${cmpRow('Active troops', A.s.personnel, D.s.personnel, fmtShort)}
      ${cmpRow('Military power', A.s.power + 1, D.s.power + 1, v => POWER_LABELS[v - 1] || '')}
      ${cmpRow('GDP', A.s.gdp, D.s.gdp, v => '$' + fmtShort(v))}
      ${cmpRow('Population', A.s.population, D.s.population, fmtShort)}
      ${A.s.warheads || D.s.warheads ? cmpRow('Nuclear warheads', A.s.warheads, D.s.warheads, v => v ? fmtInt(v) : '—') : ''}
    </div>`;
    $('war-odds').innerHTML = `<div class="odds-head"><span>${esc(A.name)} win chance</span><b>${Math.round(p * 100)}%</b></div><div class="odds-bar"><i style="width:${p * 100}%"></i></div>`;
    $('war-battles').innerHTML = '';
    $('war-result').classList.add('hidden');
    $('war').classList.remove('hidden');
    const choice = await buttons(mode.btns);
    if (choice !== 'fight') { close(); return null; }

    // Five battles
    $('war-actions').innerHTML = '';
    const places = [...new Set([...D.places, ...A.places])].sort(() => Math.random() - 0.5);
    const battles = [];
    let front = 50;
    $('war-battles').innerHTML = `<div class="front"><i style="left:${front}%"></i></div><div class="blist"></div>`;
    const list = $('war-battles').querySelector('.blist');
    for (let b = 0; b < 5; b++) {
      const won = Math.random() < p;
      battles.push(won);
      const place = places[b % places.length] || `the front`;
      const el = document.createElement('div');
      el.className = 'battle pending';
      el.innerHTML = `<span>Battle of ${esc(place)}</span><b>⚔️</b>`;
      list.appendChild(el);
      Sound.tone(70 + Math.random() * 40, 0.35, 'sawtooth', 0.06);
      await sleep(opts.fast ? 260 : 750);
      el.className = 'battle ' + (won ? 'won' : 'lost');
      el.querySelector('b').textContent = won ? `${A.name} wins` : `${D.name} wins`;
      front = Math.max(5, Math.min(95, front + (won ? 9 : -9)));
      $('war-battles').querySelector('.front i').style.left = front + '%';
    }
    const wins = battles.filter(Boolean).length;
    if (wins >= 3) Sound.fanfare(); else Sound.tone(110, 0.8, 'triangle', 0.08);
    return { type: outcomeOf(wins), wins, p };
  }

  async function showOutcome(html, fast) {
    const r = $('war-result');
    r.innerHTML = html;
    r.classList.remove('hidden');
    await buttons([['ok', 'Continue', 'btn-primary']]);
    close();
  }

  function close() { $('war').classList.add('hidden'); }

  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-war]');
    if (b) choose(b.dataset.war);
  });

  global.NR = Object.assign(global.NR || {}, { War: { nationSide, countrySide, odds, run, apply, showOutcome, close, refresh } });
})(window);
