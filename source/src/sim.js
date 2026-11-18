// ===== sim.js: svět, stavební plán hnízda a kolonie. Bez DOM, jde spustit i v Node. =====
const W = 384, H = 216, N = W * H, INF = 65535, DT = 1 / 60, DAY = 600, AL = 2.3, SPD = 9, MAXPOP = 300;
const QUEEN = 0, FOOD = 1, BROOD = 2, REST = 3, SHAFT = 4;

// --- náhoda a šum (svět je daný semínkem v adrese za #) ---
let seed = (+location.hash.slice(1) || Math.random() * 1e9) >>> 0, rs = seed;
const rnd = () => { rs = rs + 0x6D2B79F5 | 0; let t = Math.imul(rs ^ rs >>> 15, 1 | rs); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rr = (a, b) => a + (b - a) * rnd(), ri = (a, b) => a + (rnd() * (b - a + 1) | 0);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const sstep = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const hash1 = i => { const x = Math.sin(i * 127.1 + seed % 977) * 43758.5453; return x - Math.floor(x); };
const noise1 = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash1(i) * (1 - u) + hash1(i + 1) * u; };

// --- mřížka ---
const solid = new Uint8Array(N);   // 0 vzduch, 1 hlína, 2 kámen, 3 vynesená hlína (val)
const dug = new Uint8Array(N);     // vykopaná chodba
const plan = new Uint16Array(N);   // číslo stavby + 1, dokud buňka čeká na vykopání
const root = new Uint8Array(N), walk = new Uint8Array(N), occ = new Uint8Array(N), mk = new Uint8Array(N);
const base = new Int16Array(W), top = new Int16Array(W);  // původní a současný povrch
const tex = new Uint8Array(N * 4), pher = new Float32Array(W);
const fx = new Uint16Array(N).fill(INF), fd = new Uint16Array(N).fill(INF), Q = new Int32Array(N);
const NB = [-W - 1, -W, -W + 1, -1, 1, W - 1, W, W + 1], NX = [-1, 0, 1, -1, 1, -1, 0, 1], NY = [-1, -1, -1, 0, 0, 1, 1, 1];

const roots = [], ev = [], rooms = [], anchors = [], ants = [], brood = [], foods = [], drops = [], plants = [], dead = [], cnt = [0, 0, 0, 0];
const queen = { x: 0, y: 0, room: null, sl: null, fed: 6, tm: 3, res: 0, id: 0 };
let todo = [], ex = 0, ey = 0, mouth = [], time = 0, ph = .3, L = 1, geo = 0, digGen = 0, dGen = -1, xGen = -1, rp = 0;
let digN = 0, dugN = 0, moundN = 0, stored = 0, belly = 0, hun = 0, starve = 0, slow = 0, foodFree = 0, nid = 1, texDirty = 1, bad = 0, born = 0;

const gy = x => { x -= .5; const i = clamp(Math.floor(x), 0, W - 2), f = clamp(x - i, 0, 1); return top[i] * (1 - f) + top[i + 1] * f; };
const setTex = () => { texDirty = 1; };  // texturu pro shader skládá gfx.js
const updWalk = i => { walk[i] = dug[i] && (solid[i - 1] || solid[i + 1] || solid[i - W] || solid[i + W] || solid[i - W - 1] || solid[i - W + 1] || solid[i + W - 1] || solid[i + W + 1]) ? 1 : 0; };

// --- val z vynesené hlíny: zrnko se skutálí po svahu, kolem vchodu zůstává kráter ---
const capH = x => Math.max(0, Math.abs(x - ex) - 3) * .9;
function dump(x) {
  x = clamp(Math.round(x), 3, W - 4);
  const hg = x => base[x] - top[x];
  for (let i = 0; i < 300 && x > 3 && x < W - 4; i++) {
    if (hg(x) >= capH(x)) { x += x < ex ? -1 : 1; continue; }  // v kráteru se neudrží, jde ven
    let b = x;
    for (const n of [x - 1, x + 1]) {
      if (hg(n) >= capH(n)) continue;
      const d = Math.max(top[n], top[2 * n - x]) - top[x];  // sype se, dokud je o dva sloupce dál níž: svah zhruba 1:2
      if (d > 0 && (b == x || rnd() < .5)) b = n;
    }
    if (b == x) break;
    x = b;
  }
  const y = top[x] - 1;
  if (y < 8) return;
  solid[y * W + x] = 3; top[x] = y; moundN++; setTex(y * W + x);
}

// --- kopání ---
function digCell(i) {
  solid[i] = 0; dug[i] = 1; dugN++;
  const p = plan[i];
  if (p) { plan[i] = 0; const r = rooms[p - 1]; if (!--r.left) finish(r); }
  for (let k = 0; k < 8; k++) updWalk(i + NB[k]);
  updWalk(i); setTex(i); geo++; digGen++;
  if (ev.length < 60) ev.push(i % W + .5, (i / W | 0) + .5);
}

function finish(r) {
  r.done = 1; geo++;
  if (r.type == SHAFT) return;
  r.f = new Uint16Array(N).fill(INF); r.fg = -1;
  const fl = {}, X = Math.round(r.x);
  for (const i of r.cells) { const x = i % W, y = i / W | 0; if (dug[i] && (fl[x] === undefined || y > fl[x])) fl[x] = y; }
  r.fy = fl[X] === undefined ? Math.round(r.y) : fl[X];
  for (const k in fl) {
    const x = +k, y = fl[k], i = y * W + x;
    if (!solid[i + W] || r.type == QUEEN && Math.abs(x - X) < 4) continue;
    r.slots.push({ x, y, l: 0, it: null, res: 0, r, jx: rr(-.2, .2) });
    if (dug[i - W] && r.type != REST) r.slots.push({ x, y: y - 1, l: 1, it: null, res: 0, r, jx: rr(-.3, .3) });
  }
  r.slots.sort((a, b) => a.l - b.l || Math.abs(a.x - X) - Math.abs(b.x - X));
  if (r.type == QUEEN) { queen.room = r; queen.x = X + .5; queen.y = r.fy + 1 - .21 * AL * 2.2; queen.sl = { x: X, y: r.fy, l: 0 }; }
}

// --- stavební plán: chodba s meandrem zakončená komorou, nebo strmá šachta ---
function path(x, y, a, len, lo, hi, st) {
  const p = [];
  for (let i = 0; i < len; i++) { p.push([x, y]); if (i >= st) a = clamp(a + rr(-.24, .24), lo, hi); x += Math.cos(a); y += Math.sin(a); }
  return p;
}
function add(out, x, y, rc) {
  if (x < 1 || x > W - 2 || y < 1 || y > H - 2) { bad = 1; return; }
  const i = y * W + x;
  if (rc) rc.push(i);
  if (!mk[i]) { mk[i] = 1; out.push(i); }
}
function cellsOf(pts, out) {
  for (const [px, py] of pts) { const x = Math.round(px), y = Math.round(py); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) add(out, x + dx, y + dy); }
}
function addProj(type, cells, rc, x, y, rx, ry) {
  const r = { id: rooms.length, type, cells: rc, x, y, rx, ry, left: 0, tot: 0, done: 0, slots: [], f: null, fg: -1, fy: 0 };
  rooms.push(r);
  for (const i of cells) if (solid[i] && !plan[i]) { plan[i] = r.id + 1; r.left++; todo.push(i); setTex(i); }
  r.tot = r.left;
  if (!r.left) finish(r);
  digGen++;
  return r;
}
function propose(type, an) {
  const sh = type == SHAFT;
  for (let t = 0; t < 90; t++) {
    let A = an;
    if (!A) for (let i = 0; i < 3; i++) { const a = anchors[rnd() * anchors.length | 0]; if (!A || a[2] < A[2]) A = a; }
    const side = rnd() < .5 ? -1 : 1, P = Math.PI;
    const a = sh ? P / 2 + rr(-.6, .6) : side > 0 ? rr(-.12, .75) : P - rr(-.12, .75);
    const pts = path(A[0], A[1], a, sh ? ri(16, 32) : ri(10, 30), sh ? P / 2 - .8 : side > 0 ? -.3 : P - 1.1, sh ? P / 2 + .8 : side > 0 ? 1.1 : P + .3, 2);
    const E = pts[pts.length - 1], cells = [], rc = [];
    let ok = 1, rx = 0, ry = 0, cx = E[0], cy = E[1];
    bad = 0;
    cellsOf(pts, cells);
    if (!sh) {
      rx = rr(7, 12.5); ry = rr(3.3, 4.8); cx = E[0] + side * rx * .75;
      const X = Math.round(cx), Y = Math.round(cy);
      for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry * .5); dy++) for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++)
        if ((dx / rx) ** 2 + (dy / ry) ** 2 < 1) add(cells, X + dx, Y + dy, rc);
    }
    for (const i of cells) mk[i] = 0;
    if (bad) continue;
    for (const i of cells) {
      const x = i % W, y = i / W | 0;
      if (x < 6 || x > W - 7 || y > H - 7 || y < base[x] + 8 || solid[i] == 2) { ok = 0; break; }
      if ((x - A[0]) ** 2 + (y - A[1]) ** 2 > 30)
        for (let dy = -3; dy <= 3 && ok; dy++) for (let dx = -3; dx <= 3; dx++) { const j = i + dy * W + dx; if (solid[j] == 2 || dug[j] || plan[j]) { ok = 0; break; } }
      if (!ok) break;
    }
    if (!ok) continue;
    A[2]++;
    for (let i = 8; i < pts.length; i += 6) anchors.push([pts[i][0], pts[i][1], 0]);
    if (sh) anchors.push([E[0], E[1], 0]); else anchors.push([cx + side * rx * .8, cy, 0], [cx, cy + ry * .3, 1]);
    return addProj(type, cells, rc, cx, cy, rx, ry);
  }
  return null;
}
function rush(r) { // okamžité vykopání (jen při zakládání světa)
  const cs = todo.filter(i => plan[i] == r.id + 1);
  for (const i of cs) digCell(i);
  for (let k = cs.length / 3 | 0; k > 0; k--) dump(ex + (rnd() < .5 ? -1 : 1) * (4 + rnd() * rnd() * 14));
}

// --- pole vzdáleností: mravenci jdou vždy po spádu k cíli ---
function bfs(f, src) {
  f.fill(INF);
  let h = 0, t = 0;
  for (const s of src) if (f[s]) { f[s] = 0; Q[t++] = s; }
  while (h < t) { const c = Q[h++], d = f[c] + 1; for (let k = 0; k < 8; k++) { const n = c + NB[k]; if (walk[n] && f[n] > d) { f[n] = d; Q[t++] = n; } } }
  // druhý průchod: volný prostor komor a ostrůvky, kam se po stěnách dojít nedá
  for (h = 0; h < t;) { const c = Q[h++], d = f[c] + 1; for (let k = 0; k < 8; k++) { const n = c + NB[k]; if (dug[n] && f[n] == INF) { f[n] = d; Q[t++] = n; } } }
}
function calcDig() {
  const s = []; let w = 0; digN = 0;
  for (let k = 0; k < todo.length; k++) {
    const i = todo[k];
    if (!plan[i]) continue;
    todo[w++] = i;
    if (dug[i - 1] || dug[i + 1] || dug[i - W] || dug[i + W]) { digN++; for (let q = 0; q < 8; q++) { const j = i + NB[q]; if (walk[j]) s.push(j); } }
  }
  todo.length = w; bfs(fd, s);
}
function refresh() {
  if (dGen != digGen) { dGen = digGen; calcDig(); }
  if (xGen != geo) { xGen = geo; bfs(fx, mouth); return; }
  for (let k = 0; k < rooms.length; k++) {
    const r = rooms[rp = (rp + 1) % rooms.length];
    if (r.f && r.fg != geo) { r.fg = geo; bfs(r.f, r.cells.filter(i => walk[i])); return; }
  }
}

// --- sloty v komorách a práce chův ---
function freeSlot(type) { for (const r of rooms) if (r.done && r.type == type) for (const s of r.slots) if (!s.it && !s.res) return s; }
function takeFood() { for (const r of rooms) if (r.done && r.type == FOOD) for (let i = r.slots.length - 1; i >= 0; i--) { const s = r.slots[i]; if (s.it && !s.res) { s.res = 1; return s; } } }
function findJob() {
  let s;
  if (queen.fed < 2 && !queen.res && (s = takeFood())) { queen.res = 1; return { k: 2, ra: s.r, sa: s, rb: queen.room, sb: queen.sl }; }
  for (const b of brood) if (b.t == 2 && b.fed < 2 && !b.res && !b.car && b.hung > 8) { if (!(s = takeFood())) break; b.res = 1; return { k: 1, ra: s.r, sa: s, rb: b.r, sb: b.s, b }; }
  for (const b of brood) if (b.r == queen.room && !b.res && !b.car) { if (!(s = freeSlot(BROOD))) break; b.res = 1; s.res = 1; return { k: 0, ra: b.r, sa: b.s, rb: s.r, sb: s, b }; }
}
function release(a) {
  const j = a.j;
  if (j) {
    if (j.k == 0) { if (a.ci) { j.sb.it = a.ci; a.ci.s = j.sb; a.ci.r = j.rb; a.ci.car = 0; a.ci.res = 0; } else j.b.res = 0; j.sb.res = 0; }
    else if (j.k == 3) j.sb.res = 0;
    else { if (!a.cr) j.sa.res = 0; if (j.k == 1) j.b.res = 0; else queen.res = 0; }
  }
  a.cr = 0; a.ci = null; a.j = null;
}
function pickup(a) {
  const j = a.j;
  if (j.k == 0) {
    if (j.sa.it !== j.b) { j.sb.res = 0; a.j = null; a.st = 0; return; }
    j.sa.it = null; a.ci = j.b; j.b.car = 1; a.cr = 3;
  } else {
    const it = j.sa.it;
    if (!it || it.t) { release(a); a.st = 0; return; }
    j.sa.it = null; j.sa.res = 0; stored--; a.cr = 2; a.cc = it.k;
  }
  a.st = 10; a.tm = .4;
}
function deliver(a) {
  const j = a.j;
  if (j.k == 0) { j.sb.it = a.ci; a.ci.s = j.sb; a.ci.r = j.rb; a.ci.car = 0; a.ci.res = 0; j.sb.res = 0; }
  else if (j.k == 1) { j.b.fed++; j.b.hung = 0; j.b.res = 0; }
  else if (j.k == 2) { queen.fed += 2; queen.res = 0; }
  else { j.sb.it = { t: 0, k: a.cc }; j.sb.res = 0; stored++; }
  a.cr = 0; a.ci = null; a.j = null; a.st = 0; a.tm = .4;
}

// --- mravenec ---
function mkAnt(c, age) {
  return { id: nid++, m: 0, x: c % W + .5, y: (c / W | 0) + .5, c, n: -1, a: rnd() * 6.28, ta: 0, nx: 0, ny: -1, tnx: 0, tny: -1, sd: 1, ph: rnd() * 6,
    task: 0, st: 0, af: 0, cr: 0, cc: 0, ci: null, tm: rnd() * 2, tx: 0, j: null, room: null, sl: null, fo: null, tr: 0, sk: 0, bl: 0, age, life: rr(700, 1500), sp: rr(.82, 1.15) };
}
function norm(a) {
  const c = a.c; let sx = 0, sy = 0;
  for (let k = 0; k < 8; k++) if (solid[c + NB[k]]) { sx -= NX[k]; sy -= NY[k]; }
  const l = Math.hypot(sx, sy);
  if (l > .1) { a.tnx = sx / l; a.tny = sy / l; }
}
function bail(a) {
  release(a); a.st = 0; a.sk = 0;
  if (++a.bl > 2) { a.bl = 0; a.c = mouth[0]; a.x = a.c % W + .5; a.y = (a.c / W | 0) + .5; a.n = -1; }
}
function go(a, f) { // krok po spádu pole; při zastaralém poli hledá nejbližší dosažitelnou buňku
  const c = a.c, v = f[c]; let b = -1, bs = 1e9;
  if (v < INF) for (let k = 0; k < 8; k++) { const n = c + NB[k]; if (f[n] < v) { const s = occ[n] + rnd() + (walk[n] ? 0 : 3); if (s < bs) { bs = s; b = n; } } }
  if (b < 0) {
    let m = INF, tx = 0, ty = 0; const x = c % W, y = c / W | 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const n = c + dy * W + dx; if (n > 0 && n < N && f[n] < m) { m = f[n]; tx = x + dx; ty = y + dy; } }
    if (m < INF) for (let k = 0; k < 8; k++) { const n = c + NB[k]; if (dug[n]) { const d = (n % W - tx) ** 2 + ((n / W | 0) - ty) ** 2 + rnd(); if (d < bs) { bs = d; b = n; } } }
    if (++a.sk > 200) { bail(a); return; }
  } else a.sk = 0;
  if (b >= 0) a.n = b;
}
function seek(a, s) { // dojít po zemi komory ke konkrétnímu místu; 1 = jsem tam
  const tx = s.x + .5, ty = s.y + .5, dx = tx - a.x, dy = ty - a.y;
  if (dx * dx < 1.5 && dy * dy < 3) return 1;
  let b = -1, bd = dx * dx + dy * dy;
  for (let k = 0; k < 8; k++) { const n = a.c + NB[k]; if (walk[n]) { const d = (n % W + .5 - tx) ** 2 + ((n / W | 0) + .5 - ty) ** 2; if (d < bd) { bd = d; b = n; } } }
  if (b < 0) return 1;
  a.n = b; return 0;
}
function digAround(a) {
  let n = 0;
  for (let k = 0; k < 8 && n < 3; k++) { const j = a.c + NB[k]; if (plan[j] && (dug[j - 1] || dug[j + 1] || dug[j - W] || dug[j + W])) { digCell(j); n++; } }
  return n;
}
function pick(a) {
  a.task = 0; a.j = null;
  const pop = ants.length; let j;
  if (rnd() < .8 && (j = findJob())) { a.j = j; a.task = 3; a.st = 8; cnt[3]++; return; }
  if (digN && cnt[1] < Math.min(pop * .4, 3 + digN * 1.5)) { a.task = 1; a.st = 1; cnt[1]++; return; }
  if (a.age > 60 && cnt[2] < (foodFree > 3 ? pop * .5 : pop * .07) * (L > .2 ? 1 : .15)) { a.task = 2; a.st = 3; a.af = 6; a.tr = 3; cnt[2]++; return; }
  const all = rooms.filter(r => r.f), rest = all.filter(r => r.type == REST);
  a.room = rest.length && rnd() < .6 ? rest[rnd() * rest.length | 0] : all[rnd() * all.length | 0];
  a.st = 12;
}
function toSurf(a) {
  a.m = 1; a.st = a.af; a.n = -1;
  let s = rnd() < .5 ? -1 : 1;
  if (a.af == 4) a.tx = ex + s * (4 + rnd() ** 1.15 * (14 + Math.sqrt(moundN) * 1.9));
  else {
    let l = 0, r = 0;
    for (let i = 3; i < 45; i++) { l += pher[ex - i]; r += pher[ex + i]; }
    if (l + r > .6 && rnd() < .85) { // jít po pachové stopě až na její konec
      s = rnd() * (l + r) < l ? -1 : 1;
      let x = ex + s * 3, gap = 0;
      for (; x > 5 && x < W - 6 && gap < 7; x += s) gap = pher[x] > .1 ? 0 : gap + 1;
      a.tx = x - s * 5 + rr(-2, 2);
    } else a.tx = clamp(ex + s * rr(12, 185), 5, W - 5);
  }
  a.x = ex + (a.tx < ex ? -2.2 : 2.2); a.y = gy(a.x) - .48;
}
function toGrid(a) {
  a.m = 0; a.st = a.af; a.c = ey * W + ex + (a.x < ex ? -1 : 1); a.x = a.c % W + .5; a.y = ey + .5; a.n = -1; norm(a);
  if (a.st == 10) { // donesená potrava: do spižírny, nebo rozdat (společný žaludek)
    const s = freeSlot(FOOD);
    if (s) { s.res = 1; a.j = { k: 3, rb: s.r, sb: s }; }
    else { belly = Math.min(belly + 1, ants.length * .5 + 10); a.cr = 0; a.st = 0; }
  }
}
const goHome = (a, af) => { a.st = 5; a.af = af; a.tx = ex + (a.x < ex ? -2.2 : 2.2); };
function walkTo(a) {
  const dx = a.tx - a.x, v = SPD * 1.1 * a.sp * DT, s = dx > 0 ? 1 : -1;
  if (Math.abs(dx) <= v) { a.x = a.tx; a.y = gy(a.x) - .48; return 1; }
  a.x += s * v; a.y = gy(a.x) - .48; a.ta = Math.atan2(gy(a.x + s * .6) - gy(a.x - s * .6), s * 1.2); a.tnx = 0; a.tny = -1; a.ph += v * 2.4;
  return 0;
}
function surf(a) {
  switch (a.st) {
    case 4: if (walkTo(a)) { if (rnd() < .45) dump(a.x); a.cr = 0; goHome(a, 0); } break;
    case 5:
      if (a.cr == 2 && a.fo && a.fo.u > 0) { const i = a.x | 0; pher[i] = Math.min(1, pher[i] + .12); }
      if (walkTo(a)) toGrid(a);
      break;
    case 6: {
      if (L < .15 && rnd() < .002) { goHome(a, 0); break; }
      let b = null, bd = 9;
      for (const f of foods) { const d = Math.abs(f.x - a.x); if (d < bd && f.u > 0) { bd = d; b = f; } }
      if (b) { a.fo = b; a.tx = b.x + rr(-1.2, 1.2); a.st = 7; }
      else if (walkTo(a)) { if (a.tr-- > 0) a.tx = clamp(a.x + rr(-60, 60), 5, W - 5); else goHome(a, 0); }
      break;
    }
    case 7:
      if (a.fo.u <= 0) { a.st = 6; a.tx = clamp(a.x + rr(-15, 15), 5, W - 5); }
      else if (walkTo(a)) { a.fo.u--; a.cr = 2; a.cc = a.fo.k; a.tm = .7; }
      break;
    default: goHome(a, 0);
  }
}
function timer(a) {
  if (a.st == 2) { if (digAround(a)) { a.cr = 1; a.st = 3; a.af = 4; } else a.st = 1; }
  else if (a.st == 7) goHome(a, 10);
  else if (a.st == 14) a.st = 0;
}
function think(a) {
  const c = a.c; let f;
  switch (a.st) {
    case 0: pick(a); break;
    case 1: if (!digN) a.st = 0; else if (!fd[c]) { a.st = 2; a.tm = 1; } else go(a, fd); break;
    case 3: fx[c] ? go(a, fx) : toSurf(a); break;
    case 8: f = a.j.ra.f; f[c] ? go(a, f) : a.st = 9; break;
    case 9: if (seek(a, a.j.sa)) pickup(a); break;
    case 10: f = a.j.rb.f; f[c] ? go(a, f) : a.st = 11; break;
    case 11: if (seek(a, a.j.sb)) deliver(a); break;
    case 12: f = a.room.f; if (f[c]) go(a, f); else { a.st = 13; a.sl = { x: Math.round(a.room.x + rr(-.8, .8) * a.room.rx), y: a.room.fy }; } break;
    case 13: if (seek(a, a.sl)) { a.st = 14; a.tm = rr(3, 12); } break;
    default: a.st = 0;
  }
}
function tickAnt(a) {
  a.age += DT; a.life -= starve ? DT * 5 : DT;
  let d = a.ta - a.a; d -= Math.round(d / 6.2832) * 6.2832; a.a += d * .2;
  a.nx += (a.tnx - a.nx) * .15; a.ny += (a.tny - a.ny) * .15;
  if (a.tm > 0) { a.tm -= DT; if (a.tm <= 0) timer(a); return; }
  if (a.m) { surf(a); return; }
  if (a.n < 0) { think(a); if (a.n < 0 || a.m || a.tm > 0) return; }
  const tx = a.n % W + .5, ty = (a.n / W | 0) + .5, dx = tx - a.x, dy = ty - a.y, l = Math.hypot(dx, dy), v = SPD * a.sp * DT * (a.cr == 1 ? .8 : 1);
  if (l <= v) { a.x = tx; a.y = ty; a.c = a.n; a.n = -1; norm(a); } else { a.x += dx / l * v; a.y += dy / l * v; a.ta = Math.atan2(dy, dx); }
  a.ph += v * 2.4;
}

// --- kolonie jako celek ---
function planner() {
  const pop = ants.length;
  if (rooms.filter(r => !r.done).length >= 1 + (pop > 60) + (pop > 120)) return;
  const nr = rooms.filter(r => r.type != SHAFT).length;
  if (nr >= 30) return;
  let ff = 0, bf = 0, rest = 0;
  for (const r of rooms) {
    if (r.type == REST) rest++;
    if (!r.done) { if (r.type == FOOD) ff += 30; if (r.type == BROOD) bf += 30; continue; }
    for (const s of r.slots) if (!s.it && !s.res) { if (r.type == FOOD) ff++; if (r.type == BROOD) bf++; }
  }
  const t = bf < 10 ? BROOD : ff < 10 ? FOOD : nr < 3 + pop / 16 ? (rest < nr / 4 ? REST : rnd() < .5 ? FOOD : BROOD) : -1;
  if (t >= 0 && !propose(rnd() < .18 ? SHAFT : t)) propose(SHAFT);
}
function spawnFood() {
  let u = 0; for (const f of foods) u += f.u;
  if (u > 60 + ants.length * 1.2) return;
  let x; do x = rr(6, W - 6); while (Math.abs(x - ex) < 22);
  const k = rnd() < .5 ? 0 : rnd() < .6 ? 1 : 2, n = k == 0 ? ri(5, 10) : k == 1 ? ri(12, 20) : ri(25, 45);
  foods.push({ x, k, u: n, u0: n, r: rnd() });
}
const sun = () => { ph = (time / DAY + .3) % 1; L = sstep(-.15, .25, Math.sin(6.2832 * (ph - .25))); };  // denní doba a světlo
function tick() {
  time += DT; sun();
  refresh();
  if ((slow -= DT) <= 0) {
    slow = 1; planner(); spawnFood();
    for (let i = foods.length - 1; i >= 0; i--) if (foods[i].u <= 0) foods.splice(i, 1);
    foodFree = 0; for (const r of rooms) if (r.done && r.type == FOOD) for (const s of r.slots) if (!s.it && !s.res) foodFree++;
    occ.fill(0); for (const a of ants) if (!a.m) occ[a.c]++;
  }
  // královna klade, dokud ji chůvy krmí a je kam
  if ((queen.tm -= DT) <= 0) {
    queen.tm = 4;
    if (ants.length < 8) queen.fed = Math.max(queen.fed, 1);
    if (queen.fed >= .5 && ants.length + brood.length < MAXPOP) {
      let s; for (const q of queen.room.slots) if (!q.it && !q.res) { s = q; break; }
      if (s) { queen.fed -= .5; brood.push(s.it = { t: 1, age: 0, fed: 0, hung: 9, res: 0, car: 0, s, r: queen.room }); }
    }
  }
  // plod: vajíčko, larva (musí dostat dvakrát najíst), kukla, dělnice
  for (let i = brood.length - 1; i >= 0; i--) {
    const b = brood[i]; b.age += DT;
    let gone = 0;
    if (b.t == 1) { if (b.age > 40) { b.t = 2; b.age = 0; } }
    else if (b.t == 2) {
      b.hung += DT;
      if (ants.length < 8) b.fed = 2;
      if (b.fed >= 2 && b.age > 50) { b.t = 3; b.age = 0; }
      else if (b.hung > 220 && !b.res && !b.car) { b.s.it = null; gone = 1; }
    } else if (b.age > 55 && !b.car) { const s = b.s; s.it = null; ants.push(mkAnt((s.y + s.l) * W + s.x, 0)); born++; gone = 1; }
    if (gone) { brood[i] = brood[brood.length - 1]; brood.pop(); }
  }
  // spotřeba kolonie
  starve = 0; hun += ants.length * DT / 900;
  while (hun >= 1) { hun--; if (belly >= 1) belly--; else { const s = takeFood(); if (s) { s.it = null; s.res = 0; stored--; } else starve = 1; } }
  const k = 1 - DT / 45; for (let i = 0; i < W; i++) pher[i] *= k;
  cnt.fill(0); for (const a of ants) cnt[a.task]++;
  for (let i = ants.length - 1; i >= 0; i--) {
    const a = ants[i];
    if (a.life <= 0) { release(a); dead.push({ x: a.x, y: a.y, a: a.a, t: 1 }); ants[i] = ants[ants.length - 1]; ants.pop(); a.dead = 1; continue; }
    tickAnt(a);
  }
  for (let i = drops.length - 1; i >= 0; i--) { // jídlo hozené shora
    const d = drops[i]; d.vy += 60 * DT; d.y += d.vy * DT;
    if (d.y >= gy(d.x) - .6) { foods.push({ x: d.x, k: 3, u: 40, u0: 40, r: rnd() }); drops.splice(i, 1); }
  }
}

function init() {
  ex = ri(W * .38 | 0, W * .62 | 0);
  for (let x = 0; x < W; x++) base[x] = Math.round(50 + 8 * (noise1(x * .013) - .5) + 3 * (noise1(x * .07 + 40) - .5));
  ey = base[ex];
  for (let x = 0; x < W; x++) { const d = Math.abs(x - ex); if (d <= 5) base[x] = ey; else if (d < 13) { const t = (d - 5) / 8; base[x] = Math.round(ey * (1 - t) + base[x] * t); } }
  for (let x = 0; x < W; x++) { top[x] = base[x]; for (let y = base[x]; y < H; y++) solid[y * W + x] = 1; }
  // zakládající hnízdo: šachta, komora královny a spižírna jsou hotové, jesle se teprve kopou
  const pts = path(ex, ey, Math.PI / 2, ri(34, 44), Math.PI / 2 - .5, Math.PI / 2 + .5, 7), cells = [];
  cellsOf(pts, cells); for (const i of cells) mk[i] = 0;
  rush(addProj(SHAFT, cells, [], ex, ey, 0, 0));
  for (let i = 12; i < pts.length - 6; i += 6) anchors.push([pts[i][0], pts[i][1], 0]);
  const bot = pts[pts.length - 1]; let r;
  while (!(r = propose(QUEEN, [bot[0], bot[1], 0])));
  rush(r);
  while (!(r = propose(FOOD)));
  rush(r);
  propose(BROOD);
  // kameny mimo hnízdo
  for (let s = 0; s < 46; s++) {
    const cx = rr(8, W - 8), cy = rr(62, H - 6), rx = rr(2, 8), ry = rr(1.5, 5), cs = []; let ok = 1;
    for (let y = cy - ry - 1 | 0; y <= cy + ry + 1 && ok; y++) for (let x = cx - rx - 1 | 0; x <= cx + rx + 1 && ok; x++) {
      if (x < 2 || x > W - 3 || y > H - 2 || y < base[x] + 3) continue;
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + (noise1(x * .9 + y * 1.7 + s * 31) - .5) * .6 < 1) {
        const i = y * W + x;
        for (let dy = -4; dy <= 4 && ok; dy++) for (let dx = -4; dx <= 4; dx++) { const j = i + dy * W + dx; if (j >= 0 && j < N && (dug[j] || plan[j])) { ok = 0; break; } }
        cs.push(i);
      }
    }
    if (ok) for (const i of cs) solid[i] = 2;
  }
  // rostliny a jejich kořeny
  for (let i = 0; i < 190; i++) {
    const x = rr(2, W - 2); if (Math.abs(x - ex) < 7) continue;
    const k = rnd() < .72 ? 0 : rnd() < .5 ? 1 : rnd() < .7 ? 2 : 3;
    plants.push({ x, k, h: k == 0 ? rr(1.4, 3.4) : k == 1 ? rr(3, 6) : k == 2 ? rr(5, 9) : rr(1.2, 2.2), p: rnd() * 6.28, c: rnd() });
    if (k == 1 || k == 2) {
      const st = [[x, base[x | 0], Math.PI / 2, ri(8, 30)]];
      while (st.length) {
        let [x, y, a, n] = st.pop();
        while (n-- > 0) {
          a = clamp(a + rr(-.5, .5), .4, 2.7); x += Math.cos(a) * .7; y += Math.sin(a) * .7;
          if (x < 1 || x > W - 2 || y > H - 2) break;
          root[(y | 0) * W + (x | 0)] = 1; roots.push(x, y, n);
          if (rnd() < .08 && n > 4) st.push([x, y, a + rr(-1, 1), n >> 1]);
        }
      }
    }
  }
  mouth = [ey * W + ex - 1, ey * W + ex + 1, ey * W + ex];
  for (let i = 0; i < N; i++) setTex(i);
  const fr = rooms.find(r => r.type == FOOD);
  for (let i = 0; i < 24 && i < fr.slots.length; i++) { fr.slots[i].it = { t: 0, k: ri(0, 2) }; stored++; }
  const wc = []; for (let i = 0; i < N; i++) if (walk[i]) wc.push(i);
  for (let i = 0; i < 45; i++) { const a = mkAnt(wc[rnd() * wc.length | 0], rr(90, 700)); a.life = rr(250, 1500); ants.push(a); }
  for (let i = 0; i < 7; i++) spawnFood();
  for (let i = 0; i < 600; i++) tick();
}

// --- uložení a obnova ---
// Stav je jeden objekt se vším, co simulace vlastní. Odkazy mezi mravenci, plodem, sloty a komorami zůstávají odkazy:
// structuredClone (a stejně tak IndexedDB) je zachová včetně kruhů. Pole vzdáleností se neukládají, po načtení se dopočítají.
const LISTS = () => ({ roots, rooms, anchors, ants, brood, foods, drops, plants, dead });
const GRIDS = () => ({ solid, dug, plan, root, walk, base, top, pher });
function snapshot() {
  const fs = rooms.map(r => r.f);
  for (const r of rooms) r.f = r.f && 1;
  const s = structuredClone({ v: 1, seed, rs, ...GRIDS(), ...LISTS(), queen, todo, mouth,
    n: [ex, ey, time, geo, digGen, rp, dugN, moundN, stored, belly, hun, slow, nid, born, foodFree] });
  rooms.forEach((r, i) => r.f = fs[i]);
  return s;
}
function restore(s) {
  const G = GRIDS(), Ls = LISTS();
  for (const k in G) G[k].set(s[k]);
  for (const k in Ls) { Ls[k].length = 0; for (const v of s[k]) Ls[k].push(v); }
  Object.assign(queen, s.queen);
  seed = s.seed; rs = s.rs; todo = s.todo; mouth = s.mouth;
  [ex, ey, time, geo, digGen, rp, dugN, moundN, stored, belly, hun, slow, nid, born, foodFree] = s.n;
  sun(); cnt.fill(0); for (const a of ants) cnt[a.task]++;
  dGen = digGen; calcDig(); xGen = geo; bfs(fx, mouth);
  for (const r of rooms) if (r.f) { r.f = new Uint16Array(N); r.fg = geo; bfs(r.f, r.cells.filter(i => walk[i])); }
  texDirty = 1;
}
