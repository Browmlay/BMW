/* BMW Generation Tree - vanilla JS, SVG rendering, no dependencies.
 * Data: data/bmw-models.json (fetched) with data/bmw-models.js (window.BMW_DATA) as file:// fallback. */
(function () {
'use strict';

/* ------------------------------------------------------------------ helpers */
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }
};

/* ------------------------------------------------------------------ config */
const LANES = [
  { id: 'Historic BMW', fam: 'Historic', hue: 32 },
  { id: '1 Series', fam: 'Numbered', hue: 205 }, { id: '2 Series', fam: 'Numbered', hue: 215 },
  { id: '3 Series', fam: 'Numbered', hue: 225 }, { id: '4 Series', fam: 'Numbered', hue: 238 },
  { id: '5 Series', fam: 'Numbered', hue: 250 }, { id: '6 Series', fam: 'Numbered', hue: 265 },
  { id: '7 Series', fam: 'Numbered', hue: 280 }, { id: '8 Series', fam: 'Numbered', hue: 295 },
  { id: 'X1', fam: 'X', hue: 150 }, { id: 'X2', fam: 'X', hue: 158 }, { id: 'X3', fam: 'X', hue: 166 },
  { id: 'X4', fam: 'X', hue: 174 }, { id: 'X5', fam: 'X', hue: 182 }, { id: 'X6', fam: 'X', hue: 190 },
  { id: 'X7', fam: 'X', hue: 198 },
  { id: 'Z Series', fam: 'Z', hue: 58 },
  { id: 'M Models', fam: 'M', hue: 352 },
  { id: 'i Models', fam: 'I', hue: 140 }
];
const FAMS = { Historic: 'Historic', Numbered: 'Numbered series', X: 'X models (SAV / SAC)', Z: 'Z', M: 'M', I: 'BMW i' };
const laneColor = l => `hsl(${l.hue} 62% 56%)`;
const CHASSIS = {
  E: { c: '#c8963e', t: 'E-series chassis codes, 1968–2013 (E3, E30, E46, E90…)' },
  F: { c: '#3fb6a8', t: 'F-series, roughly 2008–2021 (F10, F30, F90…)' },
  G: { c: '#4f9bff', t: 'G-series, 2015 onward (G20, G80, G05…)' },
  U: { c: '#a67cf0', t: 'U-series, front-wheel-drive UKL cars (U06, U10, U11)' },
  I: { c: '#4ad37b', t: 'I-series, BMW i models (I01, I12, I15, I20)' },
  NA: { c: '#8b94a1', t: 'No chassis code: pre-1968 designations, Z1 and platform codes such as NA0' }
};
const BODY_FILTERS = ['Sedan', 'Touring / Estate', 'Coupé', 'Convertible', 'Hatchback', 'Compact', 'Gran Turismo', 'Roadster', 'SUV / SAV', 'SAC', 'Electric', 'Special editions', 'Other'];
const TYPE_FILTERS = [['std', 'Standard BMW'], ['m', 'BMW M'], ['mp', 'M Performance'], ['i', 'BMW i / electric'], ['classic', 'Classic BMW']];
const STATUS_FILTERS = [['historical', 'Historical'], ['discontinued', 'Discontinued'], ['current', 'Current production']];
const DECADES = [1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];

const PX = 22, CARD_W = 152, CARD_H = 56, COL_W = 168, LANE_PAD = 14, COLLAPSED_W = 46, LANE_GAP = 8;
const AXIS_W = 58, FAM_H = 24, LANE_HDR_H = 50, HDR_H = FAM_H + LANE_HDR_H, TOP = 30, ROW_H = 78;

/* ------------------------------------------------------------------ state */
let ALL = [], BY_ID = new Map(), YEAR_MIN = 1927, YEAR_MAX = 2026;
const state = {
  f: { body: new Set(), series: new Set(), type: new Set(), status: new Set(), from: 0, to: 0, code: '' },
  q: '', view: 'time', mv: 'list',
  collapsedLanes: new Set(), collapsedFams: new Set(),
  selected: null, compare: [], hl: new Set(), t: { k: 0.5, x: AXIS_W + 16, y: HDR_H + 8 }
};
let VIS = [], L = null, nodeEls = new Map(), raf = 0, anim = 0, mOpen = new Set(['3 Series']);
const svg = $('#svg'), gContent = $('#gContent'), gGrid = $('#gGrid'), gEdges = $('#gEdges'), gHi = $('#gHi'), gNodes = $('#gNodes'), gAxis = $('#gAxis'), gHeaders = $('#gHeaders');
const isMobile = () => window.matchMedia('(max-width:720px)').matches;
const isNarrow = () => window.matchMedia('(max-width:1100px)').matches;

/* ------------------------------------------------------------------ data */
async function loadData() {
  // Browsers block fetch() of local files, so use the generated .js copy straight away on file://
  if (location.protocol === 'file:' && window.BMW_DATA) return window.BMW_DATA;
  try {
    const r = await fetch('data/bmw-models.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e) {
    if (window.BMW_DATA) return window.BMW_DATA;
    throw e;
  }
}
function prepare(data) {
  ALL = data.records;
  ALL.forEach(r => {
    BY_ID.set(r.id, r);
    r._words = norm([r.model, r.series, r.generation, r.family, r.body, r.tags.join(' '), r.category, r.status, r.codeType, r.chassisFamily].join(' ')).split(/[^a-z0-9]+/).filter(Boolean);
  });
  YEAR_MIN = Math.min(...ALL.map(r => r.productionStart));
  YEAR_MAX = new Date().getFullYear() > 2026 ? new Date().getFullYear() : 2026;
  state.f.from = YEAR_MIN; state.f.to = YEAR_MAX;
}

/* ------------------------------------------------------------------ filtering + search */
function typeMatch(r, key) {
  switch (key) {
    case 'std': return r.category === 'Standard';
    case 'm': return r.category === 'M' || (r.category === 'Special' && r.series === 'M Models');
    case 'mp': return r.category === 'M Performance';
    case 'i': return r.category === 'Electric' || r.tags.includes('Electric');
    case 'classic': return r.classic;
  }
  return false;
}
function passes(r) {
  const f = state.f;
  if (f.body.size && !r.tags.some(t => f.body.has(t))) return false;
  if (f.series.size && !f.series.has(r.series)) return false;
  if (r.productionStart > f.to || (r.productionEnd == null ? YEAR_MAX : r.productionEnd) < f.from) return false;
  if (f.type.size && ![...f.type].some(k => typeMatch(r, k))) return false;
  if (f.status.size && !f.status.has(r.status)) return false;
  if (f.code.trim()) {
    const toks = norm(f.code).split(/[\s,;]+/).filter(Boolean);
    const g = norm(r.generation), fam = norm(r.family);
    if (!toks.some(t => g.startsWith(t) || fam.startsWith(t) || g.split(/[^a-z0-9]+/).some(w => w.startsWith(t)))) return false;
  }
  return true;
}
function matchQuery(q, pool) {
  const toks = norm(q).split(/\s+/).filter(Boolean);
  if (!toks.length) return [];
  return pool.filter(r => toks.every(t => {
    if (/^\d{4}$/.test(t)) {
      const y = +t;
      return r.productionStart <= y && y <= (r.productionEnd == null ? YEAR_MAX : r.productionEnd);
    }
    return r._words.some(w => w.startsWith(t));
  }));
}
function activeFilterCount() {
  const f = state.f;
  return (f.body.size ? 1 : 0) + (f.series.size ? 1 : 0) + (f.type.size ? 1 : 0) + (f.status.size ? 1 : 0) +
    (f.code.trim() ? 1 : 0) + ((f.from !== YEAR_MIN || f.to !== YEAR_MAX) ? 1 : 0);
}

/* ------------------------------------------------------------------ layout */
function layout() {
  const timeMode = state.view === 'time';
  const vis = VIS;
  const minY = vis.length ? Math.floor(Math.min(...vis.map(r => r.productionStart)) / 5) * 5 : YEAR_MIN;
  const maxY = vis.length ? Math.ceil((Math.max(...vis.map(r => r.productionEnd == null ? YEAR_MAX + 1 : r.productionEnd + 0.01))) / 5) * 5 : YEAR_MAX;
  const Y = yr => TOP + (yr - minY) * PX;
  const out = { nodes: [], lanes: [], bands: [], byId: new Map(), minY, maxY, Y, w: 0, h: 0 };
  let x = 0, maxBottom = 0;
  for (const lane of LANES) {
    const rs = vis.filter(r => r.series === lane.id);
    if (!rs.length) continue;
    const collapsed = state.collapsedLanes.has(lane.id) || state.collapsedFams.has(lane.fam);
    const info = { ...lane, x, collapsed, count: rs.length, color: laneColor(lane), y0: Math.min(...rs.map(r => r.productionStart)), y1: Math.max(...rs.map(r => r.productionEnd == null ? YEAR_MAX : r.productionEnd)) };
    if (collapsed) { info.w = COLLAPSED_W; }
    else {
      rs.sort((a, b) => a.productionStart - b.productionStart || (a.productionEnd == null ? 9999 : a.productionEnd) - (b.productionEnd == null ? 9999 : b.productionEnd));
      const keyOrder = [], sub = {};
      const rowCount = {};
      const placed = [];
      for (const r of rs) {
        const key = r.line;
        if (!sub[key]) { sub[key] = []; keyOrder.push(key); }
        let c;
        if (timeMode) {
          const eff = Math.max(r.productionEnd == null ? YEAR_MAX + 1 : r.productionEnd, r.productionStart + (CARD_H + 6) / PX);
          c = sub[key].findIndex(s => s.end <= r.productionStart + 0.001);
          if (c < 0) { sub[key].push({ end: eff }); c = sub[key].length - 1; } else sub[key][c].end = eff;
        } else {
          if (!sub[key].length) sub[key].push({ end: 0 });
          c = 0;
        }
        const row = rowCount[key] = (rowCount[key] || 0) + 1;
        placed.push({ r, key, c, row: row - 1 });
      }
      const offsets = {}; let n = 0;
      for (const k of keyOrder) { offsets[k] = n; n += sub[k].length; }
      info.w = n * COL_W + LANE_PAD * 2;
      for (const p of placed) {
        const nx = x + LANE_PAD + (offsets[p.key] + p.c) * COL_W;
        const ny = timeMode ? Y(p.r.productionStart) : TOP + p.row * ROW_H;
        const railH = timeMode ? Math.max(CARD_H, Y(p.r.productionEnd == null ? YEAR_MAX + 0.9 : p.r.productionEnd + 0.9) - ny) : CARD_H;
        const node = { r: p.r, x: nx, y: ny, railH, lane: info };
        out.nodes.push(node); out.byId.set(p.r.id, node);
        maxBottom = Math.max(maxBottom, ny + Math.max(railH, CARD_H));
      }
    }
    out.lanes.push(info);
    x += info.w + LANE_GAP;
  }
  // family bands
  for (const info of out.lanes) {
    const last = out.bands[out.bands.length - 1];
    if (last && last.fam === info.fam) last.w = info.x + info.w - last.x;
    else out.bands.push({ fam: info.fam, label: FAMS[info.fam], x: info.x, w: info.w });
  }
  out.w = Math.max(x, 200);
  out.h = Math.max(maxBottom + 60, 300);
  return out;
}

/* ------------------------------------------------------------------ rendering: content */
function chassisColor(r) { return CHASSIS[r.chassisFamily].c; }
function badgeFor(r) {
  if (r.category === 'M') return ['M', '#6fb1ff'];
  if (r.category === 'M Performance') return ['M·P', '#b79cff'];
  if (r.category === 'Special') return ['★', '#ffd36b'];
  if (r.category === 'Electric') return ['i', '#4ad37b'];
  return null;
}
function nodeSvg(n) {
  const r = n.r, col = chassisColor(r);
  const g = r.generation, gs = g.length <= 8 ? 15 : g.length <= 12 ? 12.5 : 10.5;
  const yrs = r.productionStart + '–' + (r.productionEnd == null ? 'now' : r.productionEnd);
  const b = badgeFor(r);
  const cls = ['node', r.productionEnd == null ? 'current' : '', r.uncertain ? 'uncertain' : ''].join(' ');
  return `<g class="${cls}" data-id="${esc(r.id)}" transform="translate(${n.x.toFixed(1)},${n.y.toFixed(1)})">` +
    (state.view === 'time' ? `<rect class="rail" x="0" y="0" width="6" height="${n.railH.toFixed(1)}" rx="3" fill="${col}" style="color:${col}"/>` : '') +
    `<rect class="glow" x="9" y="0" width="${CARD_W}" height="${CARD_H}" rx="6"/>` +
    `<rect class="card" x="9" y="0" width="${CARD_W}" height="${CARD_H}" rx="6"/>` +
    `<rect class="stripe" x="9" y="0" width="4" height="${CARD_H}" rx="2" fill="${col}"/>` +
    `<text class="t1" x="22" y="22" style="font-size:${gs}px">${esc(g)}</text>` +
    `<text class="t2" x="22" y="38">${esc(trunc(r.model.replace(/^BMW /, ''), 24))}</text>` +
    `<text class="t3" x="22" y="51">${esc(trunc(yrs + ' · ' + r.body, 27))}</text>` +
    (b ? `<text class="badge-m" x="${9 + CARD_W - 8}" y="16" text-anchor="end" fill="${b[1]}">${esc(b[0])}</text>` : '') +
    (r.uncertain ? `<circle class="unc" cx="${9 + CARD_W - 10}" cy="${CARD_H - 10}" r="3.5"><title>Uncertain: ${esc(r.uncertain)}</title></circle>` : '') +
    `<title>${esc(r.model + ' ' + r.generation + ' (' + r.body + ') ' + yrs)}</title></g>`;
}
function edgePath(a, b) {
  const x1 = a.x + 9 + CARD_W / 2, y1 = a.y + CARD_H, x2 = b.x + 9 + CARD_W / 2, y2 = b.y;
  if (y2 - y1 >= 10) { const d = Math.min(60, (y2 - y1) / 2); return `M${x1},${y1} C${x1},${y1 + d} ${x2},${y2 - d} ${x2},${y2}`; }
  const right = b.x > a.x;
  const sx = right ? a.x + 9 + CARD_W : a.x + 9, ex = right ? b.x + 9 : b.x + 9 + CARD_W, sy = a.y + CARD_H / 2, ey = b.y + CARD_H / 2;
  const dx = Math.abs(ex - sx) / 2;
  return `M${sx},${sy} C${sx + (right ? dx : -dx)},${sy} ${ex + (right ? -dx : dx)},${ey} ${ex},${ey}`;
}
function renderContent() {
  L = layout();
  // grid
  let g = '';
  if (state.view === 'time') {
    for (let y = L.minY; y <= L.maxY; y += 5) g += `<line class="grid ${y % 10 === 0 ? 'dec' : ''}" x1="0" x2="${L.w}" y1="${L.Y(y)}" y2="${L.Y(y)}"/>`;
    if (YEAR_MAX >= L.minY && YEAR_MAX <= L.maxY) g += `<line x1="0" x2="${L.w}" y1="${L.Y(YEAR_MAX)}" y2="${L.Y(YEAR_MAX)}" stroke="#1c69d4" stroke-dasharray="6 6" stroke-width="1.5"/>`;
  }
  for (const l of L.lanes) if (!l.collapsed) g += `<rect x="${l.x}" y="0" width="${l.w}" height="${L.h}" fill="${laneColor(l)}" opacity=".035"/>`;
  gGrid.innerHTML = g;
  // edges
  let e = '';
  for (const n of L.nodes) {
    const p = n.r.predecessorId && L.byId.get(n.r.predecessorId);
    if (p && p.lane === n.lane) e += `<path class="edge" d="${edgePath(p, n)}"/>`;
  }
  gEdges.innerHTML = e;
  gNodes.innerHTML = L.nodes.map(nodeSvg).join('');
  nodeEls = new Map($$('.node', gNodes).map(el => [el.dataset.id, el]));
  $('#emptyMsg').hidden = VIS.length > 0;
  updateClasses();
}

/* ------------------------------------------------------------------ rendering: sticky overlays */
function viewSize() { const b = svg.getBoundingClientRect(); return { W: b.width, H: b.height }; }
function drawOverlays() {
  if (!L) return;
  const { W, H } = viewSize(), { k, x: tx, y: ty } = state.t;
  svg.setAttribute('class', 'tree' + (state.hl.size ? ' has-hl' : '') + (k < 0.3 ? ' lod3' : k < 0.5 ? ' lod2' : k < 0.8 ? ' lod1' : '') + (svg.classList.contains('panning') ? ' panning' : ''));
  // axis
  let a = `<rect class="axis-bg" x="0" y="${HDR_H}" width="${AXIS_W}" height="${Math.max(0, H - HDR_H)}"/>`;
  if (state.view === 'time') {
    const step = k >= 0.45 ? 1 : 5;
    for (let yr = L.minY; yr <= L.maxY; yr += step) {
      const sy = ty + L.Y(yr) * k;
      if (sy < HDR_H - 4 || sy > H) continue;
      if (yr % 10 === 0) a += `<text class="ax-d" x="${AXIS_W - 8}" y="${sy + 4}" text-anchor="end">${yr}</text><line x1="${AXIS_W - 5}" x2="${AXIS_W}" y1="${sy}" y2="${sy}" stroke="#c9d1dc"/>`;
      else if (yr % 5 === 0 || k >= 1) a += `<text class="ax-t" x="${AXIS_W - 8}" y="${sy + 3}" text-anchor="end">${yr}</text><line x1="${AXIS_W - 3}" x2="${AXIS_W}" y1="${sy}" y2="${sy}" stroke="#4a5461"/>`;
      else a += `<line x1="${AXIS_W - 3}" x2="${AXIS_W}" y1="${sy}" y2="${sy}" stroke="#2f3640"/>`;
    }
    const sy = ty + L.Y(YEAR_MAX) * k;
    if (sy > HDR_H && sy < H) a += `<text x="4" y="${sy - 5}" fill="#4f9bff" font-size="10" font-family="var(--mono)">NOW</text>`;
  } else {
    a += `<text x="${AXIS_W / 2}" y="${HDR_H + 20}" text-anchor="middle" class="ax-t">GEN.</text><text x="${AXIS_W / 2}" y="${HDR_H + 32}" text-anchor="middle" class="ax-t">ORDER</text>`;
  }
  a += `<line x1="${AXIS_W}" x2="${AXIS_W}" y1="${HDR_H}" y2="${H}" stroke="#2a3039"/>`;
  gAxis.innerHTML = a;
  // headers
  let h = `<rect class="hdr-bg" x="0" y="0" width="${W}" height="${HDR_H}"/>`;
  for (const b of L.bands) {
    const sx = tx + b.x * k, sw = b.w * k;
    if (sx > W || sx + sw < AXIS_W) continue;
    const tcol = state.collapsedFams.has(b.fam);
    const textX = clamp(Math.max(sx + 10, AXIS_W + 10), sx + 6, sx + sw - 60);
    h += `<g class="fam-h" data-fam="${b.fam}"><rect x="${sx}" y="0" width="${Math.max(0, sw - 2)}" height="${FAM_H}" fill="#12161c" stroke="#232932"/><text x="${textX}" y="16">${esc(b.label)} ${tcol ? '▸' : '▾'}</text></g>`;
  }
  for (const l of L.lanes) {
    const sx = tx + l.x * k, sw = l.w * k;
    if (sx > W || sx + sw < AXIS_W) continue;
    const range = `${l.y0}–${l.y1 >= YEAR_MAX ? 'now' : l.y1}`;
    if (l.collapsed) {
      h += `<g class="lane-h" data-lane="${esc(l.id)}"><rect class="lh-bg" x="${sx + 1}" y="${FAM_H + 2}" width="${Math.max(10, sw - 3)}" height="${LANE_HDR_H + 110}" rx="5"/><rect x="${sx + 1}" y="${FAM_H + 2}" width="${Math.max(10, sw - 3)}" height="3" fill="${l.color}"/><text class="lh-t" transform="translate(${sx + Math.max(10, sw - 3) / 2 + 5},${FAM_H + 14}) rotate(90)" style="font-size:12px">${esc(l.id)}  ▸</text></g>`;
      continue;
    }
    const tx0 = clamp(Math.max(sx + 10, AXIS_W + 10), sx + 8, sx + sw - 70);
    h += `<g class="lane-h" data-lane="${esc(l.id)}"><rect class="lh-bg" x="${sx + 1}" y="${FAM_H + 2}" width="${Math.max(0, sw - 3)}" height="${LANE_HDR_H - 4}" rx="5"/><rect x="${sx + 1}" y="${FAM_H + 2}" width="${Math.max(0, sw - 3)}" height="3" fill="${l.color}"/>` +
      `<text class="lh-t" x="${tx0}" y="${FAM_H + 24}">${esc(l.id)} ▾</text><text class="lh-s" x="${tx0}" y="${FAM_H + 38}">${l.count} NODES · ${range}</text></g>`;
  }
  gHeaders.innerHTML = h;
  const c = $('#corner'); c.setAttribute('width', AXIS_W); c.setAttribute('height', HDR_H); c.setAttribute('fill', '#0b0d10');
}
function applyTransform() {
  gContent.setAttribute('transform', `translate(${state.t.x.toFixed(2)} ${state.t.y.toFixed(2)}) scale(${state.t.k.toFixed(4)})`);
  if (!raf) raf = requestAnimationFrame(() => { raf = 0; drawOverlays(); });
}
function clampT() {
  if (!L) return;
  const { W, H } = viewSize(), t = state.t;
  const cw = L.w * t.k, ch = L.h * t.k;
  const minX = Math.min(AXIS_W + 40, W - cw - 60), maxX = AXIS_W + 40;
  const minY = Math.min(HDR_H + 30, H - ch - 60), maxY = HDR_H + 30;
  t.x = clamp(t.x, minX, maxX); t.y = clamp(t.y, minY, maxY);
}
function zoomAt(px, py, factor) {
  const t = state.t, nk = clamp(t.k * factor, 0.1, 2.6), f = nk / t.k;
  t.x = px - (px - t.x) * f; t.y = py - (py - t.y) * f; t.k = nk;
  clampT(); applyTransform();
}
function animateTo(x, y, k, ms) {
  cancelAnimationFrame(anim);
  const s = { ...state.t }, t0 = performance.now(); ms = ms || 380;
  const step = now => {
    const p = clamp((now - t0) / ms, 0, 1), e = 1 - Math.pow(1 - p, 3);
    state.t.x = s.x + (x - s.x) * e; state.t.y = s.y + (y - s.y) * e; state.t.k = s.k + (k - s.k) * e;
    applyTransform();
    if (p < 1) anim = requestAnimationFrame(step);
  };
  anim = requestAnimationFrame(step);
}
function visibleWidth() {
  const { W } = viewSize();
  const d = $('#drawer');
  return (d.classList.contains('open') && !isMobile() && !isNarrow()) ? W - d.offsetWidth : W;
}
function centerOn(id, k) {
  const n = L && L.byId.get(id);
  if (!n) return;
  const { H } = viewSize(), nk = k || Math.max(state.t.k, 0.9), W = visibleWidth();
  animateTo(AXIS_W + (W - AXIS_W) / 2 - (n.x + 9 + CARD_W / 2) * nk, HDR_H + (H - HDR_H) / 2 - (n.y + CARD_H / 2) * nk, nk);
}
function fitAll() {
  if (!L) return;
  const { W, H } = viewSize();
  const k = clamp(Math.min((W - AXIS_W - 40) / L.w, (H - HDR_H - 40) / L.h), 0.1, 1);
  animateTo(AXIS_W + 20, HDR_H + 10, k);
}
function resetView() {
  const k = isMobile() ? 0.45 : 0.5;
  animateTo(AXIS_W + 16, HDR_H + 8, k);
}

/* ------------------------------------------------------------------ highlight / selection classes */
function updateClasses() {
  const sel = state.selected && BY_ID.get(state.selected);
  const rel = new Set();
  if (sel) { [sel.predecessorId, sel.successorId, sel.basedOn, ...(sel.relatedMIds || [])].forEach(i => i && rel.add(i)); }
  for (const [id, el] of nodeEls) {
    el.classList.toggle('sel', id === state.selected);
    el.classList.toggle('rel', rel.has(id));
    el.classList.toggle('hl', state.hl.has(id));
    el.classList.toggle('cmp', state.compare.includes(id));
  }
  // overlay edges for selected node
  let h = '';
  if (sel && L) {
    const me = L.byId.get(sel.id);
    const link = (id, cls, from) => {
      const o = id && L.byId.get(id);
      if (!o || !me) return;
      const [a, b] = from ? [o, me] : [me, o];
      if (cls === 'm') {
        const right = b.x > a.x, sx = right ? a.x + 9 + CARD_W : a.x + 9, ex = right ? b.x + 9 : b.x + 9 + CARD_W, sy = a.y + CARD_H / 2, ey = b.y + CARD_H / 2, dx = Math.max(60, Math.abs(ex - sx) / 2);
        h += `<path class="edge m" d="M${sx},${sy} C${sx + (right ? dx : -dx)},${sy} ${ex + (right ? -dx : dx)},${ey} ${ex},${ey}"/>`;
      } else h += `<path class="edge on" d="${edgePath(a, b)}" marker-end="url(#arrow)"/>`;
    };
    const pn = sel.predecessorId && L.byId.get(sel.predecessorId), sn = sel.successorId && L.byId.get(sel.successorId);
    if (me && pn && pn.lane === me.lane) link(sel.predecessorId, 'p', true);
    if (me && sn && sn.lane === me.lane) link(sel.successorId, 's', false);
    if (sel.basedOn) link(sel.basedOn, 'm', true);
    (sel.relatedMIds || []).forEach(id => link(id, 'm', false));
  }
  gHi.innerHTML = h;
  svg.classList.toggle('has-hl', state.hl.size > 0);
  $$('.m-card').forEach(c => c.classList.toggle('hl', state.hl.has(c.dataset.id)));
}

/* ------------------------------------------------------------------ drawer */
const imgCache = new Map();
function wikiTitle(r) { return r.wikipedia ? r.wikipedia.split('/wiki/')[1] : null; }
async function loadImage(r) {
  const el = $('#dImg'); if (!el) return;
  const title = wikiTitle(r);
  if (!title) { el.textContent = 'No image on file'; return; }
  let data = imgCache.get(title);
  if (data === undefined) {
    try {
      const res = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + title);
      data = res.ok ? await res.json() : null;
    } catch (e) { data = null; }
    imgCache.set(title, data);
  }
  if (state.selected !== r.id) return;
  const src = data && data.thumbnail && data.thumbnail.source;
  const box = $('#dImg');
  if (box && src) { box.style.backgroundImage = `url("${src}")`; box.textContent = ''; $('#dCredit').innerHTML = `Image: <a href="${esc(r.wikipedia)}" target="_blank" rel="noopener">Wikipedia / Wikimedia Commons</a>`; }
  else if (box) box.textContent = 'Image unavailable (offline or no image on the article)';
}
function genLabel(id) { const o = BY_ID.get(id); return o ? `${o.generation} · ${o.body}` : ''; }
function openDrawer(r) {
  const col = chassisColor(r);
  const wikiUrl = r.wikipedia || ('https://en.wikipedia.org/w/index.php?search=' + encodeURIComponent('BMW ' + r.model.replace(/^BMW /, '') + ' ' + r.generation));
  const links = ids => ids.length ? ids.map(i => `<button class="linkish" data-goto="${esc(i)}">${esc(genLabel(i))}</button>`).join('<br>') : '—';
  const dur = r.productionEnd == null ? `${r.productionStart}–present (${YEAR_MAX - r.productionStart}+ years)` : `${r.productionStart}–${r.productionEnd} (${r.productionEnd - r.productionStart || '<1'} yr)`;
  const inCompare = state.compare.includes(r.id);
  $('#drawerBody').innerHTML =
    `<div class="d-eyebrow">${esc(r.series)} · ${esc(r.codeType)}</div>` +
    `<div class="d-code" style="color:${col}">${esc(r.generation)}</div>` +
    `<div class="d-model">${esc(r.model)} — ${esc(r.body)}</div>` +
    `<div class="pills"><span class="pill ${r.status === 'current' ? 'cur' : ''}">${esc(r.status)}</span><span class="pill cat">${esc(r.category)}</span><span class="pill">${esc(r.chassisFamily)}-code</span>${r.classic ? '<span class="pill">classic</span>' : ''}</div>` +
    `<div class="d-img" id="dImg">Loading image…</div><div class="d-credit" id="dCredit">&nbsp;</div>` +
    (r.uncertain ? `<div class="warn-box"><b>Uncertain data.</b> ${esc(r.uncertain)}</div>` : '') +
    `<dl class="facts">` +
    `<dt>Model</dt><dd>${esc(r.model)}</dd>` +
    `<dt>Chassis code</dt><dd class="mono">${esc(r.generation)}${r.family !== r.generation ? ` <span style="color:var(--muted)">(family ${esc(r.family)})</span>` : ''}</dd>` +
    `<dt>Body style</dt><dd>${esc(r.body)}</dd>` +
    `<dt>Production</dt><dd>${esc(dur)}</dd>` +
    `<dt>Predecessor</dt><dd>${r.predecessorId ? links([r.predecessorId]) : '—'}</dd>` +
    `<dt>Successor</dt><dd>${r.successorId ? links([r.successorId]) : '—'}</dd>` +
    (r.basedOn ? `<dt>Based on</dt><dd>${links([r.basedOn])}</dd>` : '') +
    `<dt>Related M</dt><dd>${links(r.relatedMIds || [])}</dd>` +
    `<dt>Wikipedia</dt><dd><a href="${esc(wikiUrl)}" target="_blank" rel="noopener">${r.wikipedia ? esc(decodeURIComponent(wikiTitle(r)).replace(/_/g, ' ')) : 'Search Wikipedia'}</a>${r.wikipedia && !r.wikipediaVerified ? ' <span style="color:var(--muted);font-size:12px">(link not yet machine-verified)</span>' : ''}${!r.wikipedia ? ' <span style="color:var(--muted);font-size:12px">(no article link on file)</span>' : ''}</dd>` +
    `<dt>BMW archive</dt><dd>${r.archiveUrl ? `<a href="${esc(r.archiveUrl)}" target="_blank" rel="noopener">BMW Group Classic</a>` : '—'}</dd>` +
    `</dl>` +
    (r.notes ? `<p class="note">${esc(r.notes)}</p>` : '') +
    `<div class="d-actions"><button class="primary" data-act="center">Show in tree</button><button class="ghost" data-act="compare">${inCompare ? 'Remove from compare' : 'Add to compare'}</button></div>`;
  const d = $('#drawer'); d.classList.add('open'); d.setAttribute('aria-hidden', 'false'); d.scrollTop = 0;
  loadImage(r);
}
function closeDrawer() {
  const d = $('#drawer'); d.classList.remove('open'); d.setAttribute('aria-hidden', 'true');
  state.selected = null; updateClasses(); syncUrl();
}
function dismissHelp() { const c = $('#helpCard'); if (c && !c.hidden) { c.hidden = true; store.set('bmwTreeHelp', '1'); } }
function select(id, opts) {
  const r = BY_ID.get(id); if (!r) return;
  dismissHelp();
  state.selected = id;
  if (!VIS.includes(r)) { /* selection of a filtered-out record: show details only */ }
  if (isNarrow()) closeSidebar();
  openDrawer(r); updateClasses(); syncUrl();
  if (opts && opts.center && L && L.byId.has(id) && !(isMobile() && state.mv === 'list')) setTimeout(() => centerOn(id), 30);
}

/* ------------------------------------------------------------------ compare */
function renderTray() {
  const t = $('#tray');
  if (!state.compare.length) { t.hidden = true; return; }
  t.hidden = false;
  t.innerHTML = state.compare.map(id => `<span class="tag">${esc(BY_ID.get(id).generation)}</span>`).join(' vs ') +
    (state.compare.length === 2 ? ' <button class="primary" data-act="open-compare">Compare</button>' : ' <span style="color:var(--muted)">pick one more</span>') +
    ' <button class="ghost" data-act="clear-compare">Clear</button>';
}
function toggleCompare(id) {
  const i = state.compare.indexOf(id);
  if (i >= 0) state.compare.splice(i, 1); else { if (state.compare.length >= 2) state.compare.shift(); state.compare.push(id); }
  renderTray(); updateClasses();
  if (state.selected) openDrawer(BY_ID.get(state.selected));
}
function openCompare() {
  const [a, b] = state.compare.map(i => BY_ID.get(i)); if (!a || !b) return;
  const rows = [
    ['Model', r => r.model], ['Series', r => r.series], ['Body', r => r.body], ['Code type', r => r.codeType],
    ['Production', r => `${r.productionStart}–${r.productionEnd == null ? 'present' : r.productionEnd}`],
    ['Years built', r => (r.productionEnd == null ? YEAR_MAX : r.productionEnd) - r.productionStart],
    ['Status', r => r.status], ['Category', r => r.category], ['Chassis family', r => r.chassisFamily + '-code'],
    ['Predecessor', r => r.predecessorId ? genLabel(r.predecessorId) : '—'], ['Successor', r => r.successorId ? genLabel(r.successorId) : '—'],
    ['Wikipedia', r => r.wikipedia ? `<a href="${esc(r.wikipedia)}" target="_blank" rel="noopener">article</a>` : '—']
  ];
  $('#modalBody').innerHTML = `<div class="d-eyebrow">Compare generations</div><table class="cmp"><thead><tr><th></th><th style="color:${chassisColor(a)}">${esc(a.generation)}</th><th style="color:${chassisColor(b)}">${esc(b.generation)}</th></tr></thead><tbody>` +
    rows.map(([n, f]) => { const x = f(a), y = f(b), diff = String(x) !== String(y); const cell = v => (typeof v === 'string' && v.startsWith('<a ')) ? v : esc(v); return `<tr><th>${n}</th><td class="${diff ? 'diff' : ''}">${cell(x)}</td><td class="${diff ? 'diff' : ''}">${cell(y)}</td></tr>`; }).join('') +
    `</tbody></table>`;
  $('#modal').hidden = false;
}

/* ------------------------------------------------------------------ search UI */
let resIdx = -1, resList = [];
function runSearch(opts) {
  const q = $('#search').value.trim();
  state.q = q;
  const box = $('#results');
  if (!q) { state.hl = new Set(); box.hidden = true; resList = []; updateClasses(); renderMobileList(); syncUrl(); return; }
  const inView = matchQuery(q, VIS);
  const total = matchQuery(q, ALL).length;
  const rank = r => { const t = norm(q); return (norm(r.generation) === t ? 0 : norm(r.generation).startsWith(t) ? 1 : 2) * 1e4 + r.productionStart; };
  resList = inView.slice().sort((a, b) => rank(a) - rank(b));
  state.hl = new Set(resList.map(r => r.id));
  let h = '';
  resList.slice(0, 8).forEach((r, i) => { h += `<div class="r" role="option" data-i="${i}"><span class="code" style="color:${chassisColor(r)}">${esc(r.generation)}</span><span>${esc(r.model.replace(/^BMW /, ''))} <span class="meta">${esc(r.body)} · ${r.productionStart}–${r.productionEnd == null ? 'now' : r.productionEnd}</span></span></div>`; });
  if (resList.length > 8) h += `<div class="more">+${resList.length - 8} more highlighted in the tree</div>`;
  if (!resList.length) h = `<div class="none">${total ? `${total} match${total > 1 ? 'es are' : ' is'} hidden by the current filters. <button class="linkish" data-act="clear-filters">Clear filters</button>` : 'No generation matches that search.'}</div>`;
  box.innerHTML = h; box.hidden = false; resIdx = -1;
  updateClasses(); renderMobileList(); syncUrl();
  if (opts && opts.center && resList.length) { box.hidden = true; centerOnResults(); }
}
function centerOnResults() {
  if (!resList.length) return;
  if (isMobile() && state.mv === 'list') { const el = $('.m-card.hl'); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
  if (resList.length === 1) { centerOn(resList[0].id); return; }
  // frame all results when they are close together, otherwise centre on the first
  const ns = resList.map(r => L.byId.get(r.id)).filter(Boolean);
  if (!ns.length) return;
  const x0 = Math.min(...ns.map(n => n.x)), x1 = Math.max(...ns.map(n => n.x + COL_W)), y0 = Math.min(...ns.map(n => n.y)), y1 = Math.max(...ns.map(n => n.y + CARD_H));
  const { H } = viewSize(), W = visibleWidth();
  const k = clamp(Math.min((W - AXIS_W - 60) / (x1 - x0), (H - HDR_H - 60) / (y1 - y0)), 0.35, 1.1);
  if ((x1 - x0) * 0.35 > W - AXIS_W) { centerOn(ns[0].r.id, 0.9); return; }
  animateTo(AXIS_W + (W - AXIS_W) / 2 - ((x0 + x1) / 2) * k, HDR_H + (H - HDR_H) / 2 - ((y0 + y1) / 2) * k, k);
}

/* ------------------------------------------------------------------ filter UI */
function chip(label, on, attrs, n) { return `<button class="chip ${on ? 'on' : ''}" ${attrs} aria-pressed="${on}">${esc(label)}${n != null ? `<span class="n">${n}</span>` : ''}</button>`; }
function buildFilterUI() {
  const cnt = fn => ALL.filter(fn).length;
  $('#fBody').innerHTML = BODY_FILTERS.map(b => chip(b, state.f.body.has(b), `data-body="${esc(b)}"`, cnt(r => r.tags.includes(b)))).join('');
  $('#fSeries').innerHTML = LANES.map(l => chip(l.id, state.f.series.has(l.id), `data-series="${esc(l.id)}"`)).join('');
  $('#fDecades').innerHTML = DECADES.map(d => chip(d + 's', state.f.from === d && state.f.to === d + 9, `data-decade="${d}"`)).join('');
  $('#fType').innerHTML = TYPE_FILTERS.map(([k, n]) => chip(n, state.f.type.has(k), `data-type="${k}"`)).join('');
  $('#fStatus').innerHTML = STATUS_FILTERS.map(([k, n]) => chip(n, state.f.status.has(k), `data-status="${k}"`)).join('');
  const opts = []; for (let y = YEAR_MIN; y <= YEAR_MAX; y++) opts.push(`<option value="${y}">${y}</option>`);
  $('#yFromSel').innerHTML = opts.join(''); $('#yToSel').innerHTML = opts.join('');
  ['yFrom', 'yTo'].forEach(id => { const el = $('#' + id); el.min = YEAR_MIN; el.max = YEAR_MAX; el.step = 1; });
  $('#legend').innerHTML = Object.entries(CHASSIS).map(([k, v]) => `<li><i style="background:${v.c}"></i><b>${k}</b><span>${esc(v.t)} <span style="color:var(--dim)">(${cnt(r => r.chassisFamily === k)})</span></span></li>`).join('');
  syncFilterUI();
}
function syncFilterUI() {
  const f = state.f;
  $$('[data-body]').forEach(e => { const on = f.body.has(e.dataset.body); e.classList.toggle('on', on); e.setAttribute('aria-pressed', on); });
  $$('[data-series]').forEach(e => { const on = f.series.has(e.dataset.series); e.classList.toggle('on', on); e.setAttribute('aria-pressed', on); });
  $$('[data-type]').forEach(e => { const on = f.type.has(e.dataset.type); e.classList.toggle('on', on); e.setAttribute('aria-pressed', on); });
  $$('[data-status]').forEach(e => { const on = f.status.has(e.dataset.status); e.classList.toggle('on', on); e.setAttribute('aria-pressed', on); });
  $$('[data-decade]').forEach(e => { const d = +e.dataset.decade, on = f.from === d && f.to === d + 9; e.classList.toggle('on', on); e.setAttribute('aria-pressed', on); });
  $('#yFromSel').value = f.from; $('#yToSel').value = f.to; $('#yFrom').value = f.from; $('#yTo').value = f.to;
  const span = YEAR_MAX - YEAR_MIN;
  $('#dualFill').style.left = ((f.from - YEAR_MIN) / span * 100) + '%';
  $('#dualFill').style.right = (100 - (f.to - YEAR_MIN) / span * 100) + '%';
  if ($('#fCode').value !== f.code) $('#fCode').value = f.code;
  const n = activeFilterCount(), b = $('#filterBadge'); b.hidden = !n; b.textContent = n;
}
function setYears(from, to) {
  if (from > to) { if (from !== state.f.from) to = from; else from = to; }
  state.f.from = clamp(from, YEAR_MIN, YEAR_MAX); state.f.to = clamp(to, YEAR_MIN, YEAR_MAX);
}
function toggleSet(set, v) { if (set.has(v)) set.delete(v); else set.add(v); }
function clearFilters() {
  const f = state.f;
  f.body.clear(); f.series.clear(); f.type.clear(); f.status.clear(); f.code = ''; f.from = YEAR_MIN; f.to = YEAR_MAX;
  applyFilters();
}
function applyFilters(opts) {
  VIS = ALL.filter(passes);
  if (state.selected && !VIS.some(r => r.id === state.selected) && !(opts && opts.keepSel)) { /* keep drawer; node simply absent */ }
  syncFilterUI(); renderStats(); renderContent(); clampT(); applyTransform(); drawOverlays();
  if (state.q) runSearchSilent();
  renderMobileList(); syncUrl();
}
function runSearchSilent() {
  const inView = matchQuery(state.q, VIS);
  resList = inView; state.hl = new Set(inView.map(r => r.id)); updateClasses();
}
function renderStats() {
  const gens = new Set(VIS.map(r => r.series + '|' + r.family)).size;
  $('#stats').innerHTML = `<div class="stat"><b>${VIS.length}</b><span>of ${ALL.length} nodes</span></div><div class="stat"><b>${gens}</b><span>generations</span></div><div class="stat"><b>${VIS.filter(r => r.status === 'current').length}</b><span>in production</span></div>`;
}

/* ------------------------------------------------------------------ mobile list */
function renderMobileList() {
  const host = $('#mobileList'); if (!host) return;
  const q = state.q;
  let h = '';
  for (const lane of LANES) {
    let rs = VIS.filter(r => r.series === lane.id).sort((a, b) => a.productionStart - b.productionStart);
    if (q) rs = rs.filter(r => state.hl.has(r.id)); // search-first: show only matches while a query is active
    if (!rs.length) continue;
    const hasHl = q && rs.some(r => state.hl.has(r.id));
    const open = mOpen.has(lane.id) || hasHl;
    h += `<section class="m-fam ${open ? 'open' : ''}" data-lane="${esc(lane.id)}"><button data-mlane="${esc(lane.id)}" aria-expanded="${open}"><span class="dot" style="background:${laneColor(lane)}"></span><span class="nm">${esc(lane.id)}</span><span class="ct">${rs.length}</span><span class="chev">▸</span></button>`;
    if (open) {
      h += '<div class="m-body">' + rs.map(r => {
        const span = YEAR_MAX + 1 - YEAR_MIN, l = (r.productionStart - YEAR_MIN) / span * 100, w = Math.max(1.5, ((r.productionEnd == null ? YEAR_MAX + 1 : r.productionEnd + 1) - r.productionStart) / span * 100);
        return `<button class="m-card ${state.hl.has(r.id) ? 'hl' : ''}" data-id="${esc(r.id)}" style="--c:${chassisColor(r)}"><div class="row"><span class="c">${esc(r.generation)}</span><span class="y">${r.productionStart}–${r.productionEnd == null ? 'now' : r.productionEnd}</span></div><div class="s">${esc(r.model.replace(/^BMW /, ''))} · ${esc(r.body)}${r.uncertain ? ' <span class="unc-dot"></span>' : ''}</div><div class="bar"><i style="left:${l}%;width:${w}%"></i></div></button>`;
      }).join('') + '</div>';
    }
    h += '</section>';
  }
  host.innerHTML = h || '<p style="color:var(--muted);text-align:center;margin-top:40px">No generation matches these filters.</p>';
}
function applyMobileMode() {
  const st = $('#stage');
  st.classList.toggle('mv-list', isMobile() && state.mv === 'list');
  st.classList.toggle('mv-tree', isMobile() && state.mv === 'tree');
  $$('#mobileSwitch [data-mv]').forEach(b => b.classList.toggle('on', b.dataset.mv === state.mv));
}

/* ------------------------------------------------------------------ CSV + URL */
function exportCsv() {
  const cols = ['id', 'model', 'series', 'generation', 'family', 'codeType', 'body', 'productionStart', 'productionEnd', 'status', 'category', 'chassisFamily', 'predecessor', 'successor', 'wikipedia', 'uncertain', 'notes'];
  const cell = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csv = '﻿' + [cols.join(',')].concat(VIS.map(r => cols.map(c => cell(r[c])).join(','))).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'bmw-generations.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
let urlTimer = 0;
function syncUrl() {
  clearTimeout(urlTimer);
  urlTimer = setTimeout(() => {
    const f = state.f, p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (f.body.size) p.set('body', [...f.body].join('|'));
    if (f.series.size) p.set('series', [...f.series].join('|'));
    if (f.type.size) p.set('type', [...f.type].join('|'));
    if (f.status.size) p.set('status', [...f.status].join('|'));
    if (f.code.trim()) p.set('code', f.code.trim());
    if (f.from !== YEAR_MIN) p.set('from', f.from);
    if (f.to !== YEAR_MAX) p.set('to', f.to);
    if (state.view !== 'time') p.set('view', state.view);
    if (state.selected) p.set('sel', state.selected);
    const s = p.toString();
    try { history.replaceState(null, '', location.pathname + (s ? '?' + s : '')); } catch (e) { /* file:// restrictions */ }
  }, 150);
}
function readUrl() {
  let p; try { p = new URLSearchParams(location.search); } catch (e) { return; }
  const f = state.f, list = k => (p.get(k) || '').split('|').filter(Boolean);
  list('body').forEach(v => BODY_FILTERS.includes(v) && f.body.add(v));
  list('series').forEach(v => LANES.some(l => l.id === v) && f.series.add(v));
  list('type').forEach(v => TYPE_FILTERS.some(t => t[0] === v) && f.type.add(v));
  list('status').forEach(v => STATUS_FILTERS.some(t => t[0] === v) && f.status.add(v));
  if (p.get('code')) f.code = p.get('code');
  if (+p.get('from')) f.from = clamp(+p.get('from'), YEAR_MIN, YEAR_MAX);
  if (+p.get('to')) f.to = clamp(+p.get('to'), YEAR_MIN, YEAR_MAX);
  if (f.from > f.to) { f.from = YEAR_MIN; f.to = YEAR_MAX; }
  if (p.get('view') === 'family') state.view = 'family';
  if (p.get('q')) { state.q = p.get('q'); $('#search').value = state.q; }
  return p.get('sel');
}

/* ------------------------------------------------------------------ sidebar / sheets */
function openSidebar() { $('#sidebar').classList.add('open'); if (isNarrow()) $('#scrim').hidden = false; }
function closeSidebar() { $('#sidebar').classList.remove('open'); $('#scrim').hidden = true; }

/* ------------------------------------------------------------------ interactions */
function bind() {
  // pointer: pan / pinch / click
  const ptrs = new Map(); let down = null, moved = false, pinch = null;
  svg.addEventListener('pointerdown', e => {
    cancelAnimationFrame(anim);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { svg.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
    if (ptrs.size === 1) { down = { x: e.clientX, y: e.clientY, tx: state.t.x, ty: state.t.y, target: e.target }; moved = false; }
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: state.t.k, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, tx: state.t.x, ty: state.t.y };
      moved = true;
    }
  });
  svg.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2 && pinch) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), r = svg.getBoundingClientRect();
      const nk = clamp(pinch.k * d / pinch.d, 0.1, 2.6), f = nk / pinch.k, cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top, ox = pinch.cx - r.left, oy = pinch.cy - r.top;
      state.t.k = nk; state.t.x = cx - (ox - pinch.tx) * f; state.t.y = cy - (oy - pinch.ty) * f;
      clampT(); applyTransform(); return;
    }
    if (ptrs.size === 1 && down) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (!moved && Math.hypot(dx, dy) > 4) { moved = true; svg.classList.add('panning'); dismissHelp(); }
      if (moved) { state.t.x = down.tx + dx; state.t.y = down.ty + dy; clampT(); applyTransform(); }
    }
  });
  const end = e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (ptrs.size === 0) {
      svg.classList.remove('panning');
      if (down && !moved && e.type === 'pointerup') {
        const t = down.target, nodeEl = t.closest && t.closest('.node'), lane = t.closest && t.closest('[data-lane]'), fam = t.closest && t.closest('[data-fam]');
        if (nodeEl) select(nodeEl.dataset.id);
        else if (lane) { toggleSet(state.collapsedLanes, lane.dataset.lane); renderContent(); clampT(); applyTransform(); }
        else if (fam) { toggleSet(state.collapsedFams, fam.dataset.fam); renderContent(); clampT(); applyTransform(); }
      }
      down = null;
    } else if (ptrs.size === 1) { const [p] = [...ptrs.values()]; down = { x: p.x, y: p.y, tx: state.t.x, ty: state.t.y, target: svg }; }
  };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
  svg.addEventListener('wheel', e => {
    e.preventDefault(); cancelAnimationFrame(anim);
    const r = svg.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)));
  }, { passive: false });
  svg.addEventListener('keydown', e => {
    const s = 60; let h = true;
    if (e.key === 'ArrowLeft') state.t.x += s; else if (e.key === 'ArrowRight') state.t.x -= s;
    else if (e.key === 'ArrowUp') state.t.y += s; else if (e.key === 'ArrowDown') state.t.y -= s;
    else if (e.key === '+' || e.key === '=') { const { W, H } = viewSize(); zoomAt(W / 2, H / 2, 1.2); return; }
    else if (e.key === '-') { const { W, H } = viewSize(); zoomAt(W / 2, H / 2, 1 / 1.2); return; }
    else h = false;
    if (h) { e.preventDefault(); clampT(); applyTransform(); }
  });
  const zc = f => () => { const { W, H } = viewSize(); zoomAt(AXIS_W + (W - AXIS_W) / 2, HDR_H + (H - HDR_H) / 2, f); };
  $('#zIn').onclick = zc(1.3); $('#zOut').onclick = zc(1 / 1.3); $('#zFit').onclick = fitAll; $('#zReset').onclick = resetView;

  // filters
  $('#sidebar').addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    const d = t.dataset;
    if (d.body) toggleSet(state.f.body, d.body);
    else if (d.series) toggleSet(state.f.series, d.series);
    else if (d.type) toggleSet(state.f.type, d.type);
    else if (d.status) toggleSet(state.f.status, d.status);
    else if (d.decade) { const y = +d.decade; if (state.f.from === y && state.f.to === y + 9) { state.f.from = YEAR_MIN; state.f.to = YEAR_MAX; } else { state.f.from = clamp(y, YEAR_MIN, YEAR_MAX); state.f.to = clamp(y + 9, YEAR_MIN, YEAR_MAX); } }
    else return;
    applyFilters();
  });
  $('#btnClear').onclick = clearFilters;
  $('#emptyClear').onclick = clearFilters;
  $('#yFromSel').onchange = e => { setYears(+e.target.value, state.f.to); applyFilters(); };
  $('#yToSel').onchange = e => { setYears(state.f.from, +e.target.value); applyFilters(); };
  $('#yFrom').oninput = e => { setYears(+e.target.value, state.f.to); applyFilters(); };
  $('#yTo').oninput = e => { setYears(state.f.from, +e.target.value); applyFilters(); };
  $('#fCode').oninput = e => { state.f.code = e.target.value; applyFilters(); };
  $('#btnFilters').onclick = () => ($('#sidebar').classList.contains('open') ? closeSidebar() : openSidebar());
  $('#btnCloseFilters').onclick = closeSidebar;
  $('#scrim').onclick = () => { closeSidebar(); };

  // view toggles
  $$('#viewSeg button').forEach(b => b.onclick = () => {
    state.view = b.dataset.view; $$('#viewSeg button').forEach(x => x.classList.toggle('on', x === b));
    renderContent(); clampT(); applyTransform(); drawOverlays(); resetView(); syncUrl();
  });
  $$('#mobileSwitch [data-mv]').forEach(b => b.onclick = () => { state.mv = b.dataset.mv; applyMobileMode(); if (state.mv === 'tree') { drawOverlays(); } });

  // search
  const si = $('#search');
  si.addEventListener('input', () => { dismissHelp(); runSearch(); });
  si.addEventListener('focus', () => { if (si.value.trim() && resList.length) $('#results').hidden = false; });
  si.addEventListener('keydown', e => {
    const rows = $$('#results .r');
    if (e.key === 'ArrowDown' && rows.length) { e.preventDefault(); resIdx = (resIdx + 1) % rows.length; }
    else if (e.key === 'ArrowUp' && rows.length) { e.preventDefault(); resIdx = (resIdx - 1 + rows.length) % rows.length; }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (resList.length) { const r = resList[Math.max(0, resIdx)]; $('#results').hidden = true; select(r.id, { center: true }); if (resIdx < 0) setTimeout(centerOnResults, 60); }
      else runSearch({ center: true });
      return;
    } else if (e.key === 'Escape') { si.value = ''; runSearch(); return; }
    else return;
    rows.forEach((r, i) => r.classList.toggle('act', i === resIdx));
  });
  $('#results').addEventListener('mousedown', e => {
    const a = e.target.closest('[data-act="clear-filters"]'); if (a) { e.preventDefault(); clearFilters(); runSearch(); return; }
    const row = e.target.closest('.r'); if (!row) return;
    e.preventDefault(); $('#results').hidden = true; select(resList[+row.dataset.i].id, { center: true });
  });
  document.addEventListener('click', e => { if (!e.target.closest('.search')) $('#results').hidden = true; });

  // drawer, tray, modal
  $('#drawerClose').onclick = closeDrawer;
  $('#drawer').addEventListener('click', e => {
    const g = e.target.closest('[data-goto]'); if (g) { select(g.dataset.goto, { center: true }); return; }
    const a = e.target.closest('[data-act]'); if (!a || !state.selected) return;
    if (a.dataset.act === 'center') { if (isMobile() && state.mv === 'list') { state.mv = 'tree'; applyMobileMode(); } if (!L.byId.has(state.selected)) { clearFilters(); } setTimeout(() => centerOn(state.selected, 1), 40); if (isMobile()) closeDrawer(); else updateClasses(); }
    if (a.dataset.act === 'compare') toggleCompare(state.selected);
  });
  $('#tray').addEventListener('click', e => {
    const a = e.target.closest('[data-act]'); if (!a) return;
    if (a.dataset.act === 'open-compare') openCompare();
    if (a.dataset.act === 'clear-compare') { state.compare = []; renderTray(); updateClasses(); if (state.selected) openDrawer(BY_ID.get(state.selected)); }
  });
  $('#modalClose').onclick = () => { $('#modal').hidden = true; };
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') $('#modal').hidden = true; });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (!$('#modal').hidden) $('#modal').hidden = true; else if ($('#drawer').classList.contains('open') && document.activeElement !== $('#search')) closeDrawer(); }
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); $('#search').focus(); }
  });

  // mobile list
  $('#mobileList').addEventListener('click', e => {
    const lane = e.target.closest('[data-mlane]');
    if (lane) { toggleSet(mOpen, lane.dataset.mlane); renderMobileList(); return; }
    const card = e.target.closest('.m-card'); if (card) select(card.dataset.id);
  });

  $('#btnCsv').onclick = exportCsv;
  $('#btnHelp').onclick = () => { const c = $('#helpCard'); c.hidden = !c.hidden; };
  $('#helpOk').onclick = () => { $('#helpCard').hidden = true; store.set('bmwTreeHelp', '1'); };

  let rz = 0;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { applyMobileMode(); if (!isNarrow()) { $('#scrim').hidden = true; } clampT(); applyTransform(); }, 80); });
  window.matchMedia('(max-width:720px)').addEventListener && window.matchMedia('(max-width:720px)').addEventListener('change', applyMobileMode);
}

/* ------------------------------------------------------------------ boot */
loadData().then(data => {
  prepare(data);
  const sel = readUrl();
  $$('#viewSeg button').forEach(x => x.classList.toggle('on', x.dataset.view === state.view));
  buildFilterUI(); bind(); applyMobileMode();
  VIS = ALL.filter(passes);
  renderStats(); renderContent();
  const k = isMobile() ? 0.45 : 0.5;
  state.t = { k, x: AXIS_W + 16, y: HDR_H + 8 };
  clampT(); applyTransform(); drawOverlays();
  if (state.q) { runSearchSilent(); }
  renderMobileList();
  if (!store.get('bmwTreeHelp')) $('#helpCard').hidden = false;
  if (sel && BY_ID.has(sel)) select(sel, { center: true });
  else if (state.hl.size) { resList = VIS.filter(r => state.hl.has(r.id)); setTimeout(centerOnResults, 100); }
  document.title = `BMW Generation Tree · ${ALL.length} generations`;
  window.__bmw = { state, ALL, get VIS() { return VIS; }, get L() { return L; }, matchQuery, passes, applyFilters, clearFilters, select, centerOn };
}).catch(err => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', '<div style="position:fixed;inset:0;display:grid;place-items:center;background:#0b0d10;color:#e9edf2;padding:24px;text-align:center;z-index:99"><div><h2>Could not load the BMW database</h2><p>Open the site through a local server (<code>python3 -m http.server</code>) or run <code>node tools/build-data.js</code> to regenerate <code>data/bmw-models.js</code>.</p></div></div>');
});
})();
