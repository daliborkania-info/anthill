// ===== main.js: ovládání, smyčka, pauza, ukládání a panel s čísly =====
const $ = id => document.getElementById(id), body = document.body, speeds = [...document.querySelectorAll('[data-s]')];
let speed = cfg.sp || 1, showLab = cfg.lab ?? 1, showPlan = cfg.plan || 0, follow = null, acc = 0, last = 0, fr = 0;
let paused = snap ? 1 : 0, raf = 0, clk = 0, savedAt = performance.now();  // uložený svět čeká pozastavený, dokud ho uživatel nepustí dál
sndOn = cfg.snd ?? 1;

setupGL(); resize();
cam.s = minS; cam.x = ex; cam.y = H / 2;
const was = snap && { d: (time / DAY + .3 | 0) + 1, n: ants.length };  // čím se uložená kolonie ohlásí na úvodní obrazovce
if (snap && snap.ui) { // pohled a sledovaný mravenec z minula
  const [x, y, z, f] = snap.ui;
  cam.x = x; cam.y = y; cam.s = minS * z; follow = f < 0 ? null : f ? ants.find(a => a.id == f) || null : queen;
}
clampCam();

// Při pauze smyčka neběží vůbec. Jeden snímek se dokreslí jen po zásahu uživatele (posun, přiblížení, změna okna).
const redraw = () => { raf = raf || requestAnimationFrame(frame); };
addEventListener('resize', redraw);

// --- panely se po 15 s bez pohybu myši, dotyku nebo klávesy schovají ---
let act = 0, idleT = 0, eat = 0;
const idle = () => { const d = 15e3 - (performance.now() - act); if (d > 0) idleT = setTimeout(idle, d); else { idleT = 0; body.classList.add('h'); } };
function wake(e) {
  act = performance.now();
  if (e && e.type == 'pointerdown') eat = !idleT && e.pointerType != 'mouse';  // dotyk, který panely jen probudil, do světa neklikne
  if (!idleT) { body.classList.remove('h'); idleT = setTimeout(idle, 15e3); hud(); }
}
for (const n of ['pointermove', 'pointerdown', 'keydown', 'wheel']) addEventListener(n, wake, { capture: true, passive: true });

// --- myš a dotyk: tažením posun, kolečkem nebo dvěma prsty přiblížení, klik vybírá ---
const pts = new Map();
let moved = 0, pinch = 0;
const toW = (cx, cy) => [cam.x + (cx * dpr - cw / 2) / cam.s, cam.y + (cy * dpr - ch / 2) / cam.s];
function zoomAt(cx, cy, k) {
  const [wx, wy] = toW(cx, cy);
  cam.s = clamp(cam.s * k, minS, minS * 14);
  cam.x = wx - (cx * dpr - cw / 2) / cam.s; cam.y = wy - (cy * dpr - ch / 2) / cam.s; clampCam(); redraw();
}
const pd = () => { const [a, b] = [...pts.values()]; return [Math.hypot(a[0] - b[0], a[1] - b[1]), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
ov.onpointerdown = e => { ov.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size == 1) moved = 0; else pinch = pd()[0]; };
ov.onpointermove = e => {
  const p = pts.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p[0], dy = e.clientY - p[1];
  p[0] = e.clientX; p[1] = e.clientY;
  if (pts.size == 2) { const [d, mx, my] = pd(); if (pinch) zoomAt(mx, my, d / pinch); pinch = d; moved = 99; return; }
  moved += Math.abs(dx) + Math.abs(dy);
  if (moved > 6) { follow = null; cam.x -= dx * dpr / cam.s; cam.y -= dy * dpr / cam.s; clampCam(); redraw(); }
};
ov.onpointerup = ov.onpointercancel = e => {
  if (pts.size == 1 && moved <= 6 && !eat && e.type == 'pointerup') {
    const [wx, wy] = toW(e.clientX, e.clientY);
    let b = null, bd = 9;
    for (const a of ants) { const d = (a.x - wx) ** 2 + (a.y - wy) ** 2; if (d < bd) { bd = d; b = a; } }
    if ((queen.x - wx) ** 2 + (queen.y - wy) ** 2 < 14) b = queen;
    if (b) follow = b;
    else if (wy < gy(wx) - 1) drops.push({ x: clamp(wx, 4, W - 4), y: wy, vy: 0 });  // klik do vzduchu: hodit drobek
    else follow = null;
    hud(); redraw();
  }
  pts.delete(e.pointerId);
};
ov.onwheel = e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.deltaMode ? .05 : .0016))); };

// --- zvuk hraje jen tehdy, když je zapnutý, simulace běží a okno je vidět; jinak se zvukový stroj uspí ---
function syncAudio(make) {
  if (sndOn && !paused && !document.hidden) { if (make) audioStart(); if (AC) AC.resume(); }
  else if (AC) AC.suspend();
}

// --- uložení: průběžně každých 20 s, při pauze a při odchodu ze stránky ---
function saveWorld() {
  const now = performance.now();
  if (noSave || now - savedAt < 500) return;
  savedAt = now;
  const s = snapshot(); s.ui = [cam.x, cam.y, cam.s / minS, follow ? follow.id : -1];
  idb('readwrite', st => st.put(s, slot)).catch(() => { });
}
addEventListener('pagehide', saveWorld);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveWorld(); else last = performance.now(); syncAudio(); });
// ztracený grafický kontext (uspání, výměna ovladače): stav uložit a po jeho návratu stránku načíst znovu
cv.addEventListener('webglcontextlost', e => { e.preventDefault(); saveWorld(); });
cv.addEventListener('webglcontextrestored', () => location.reload());

// --- tlačítka a klávesy ---
const tog = (id, v) => $(id).classList.toggle('on', !!v);
const setSpeed = v => { cfg.sp = speed = v; saveCfg(); for (const b of speeds) b.classList.toggle('on', +b.dataset.s == v); };
function setPause(v) {
  paused = v; tog('b0', v); syncAudio();
  if (v) saveWorld(); else last = performance.now();
  ui();
}
// texty závislé na stavu; volá se po změně jazyka nebo pauzy
function ui() {
  $('b0').textContent = paused ? T.resume : T.pause;
  $('go').textContent = was ? T.cont : T.go;
  $('sv').textContent = was ? fmt(T.saved, was) : '';
  hud(); redraw();
}
for (const b of speeds) b.onclick = () => { setSpeed(+b.dataset.s); if (paused) setPause(0); };
$('b0').onclick = () => setPause(!paused);
$('bl').onclick = () => { tog('bl', cfg.lab = showLab ^= 1); saveCfg(); redraw(); };
$('bp').onclick = () => { tog('bp', cfg.plan = showPlan ^= 1); saveCfg(); redraw(); };
$('bs').onclick = () => { tog('bs', cfg.snd = sndOn ^= 1); saveCfg(); syncAudio(1); };
$('bg').onclick = () => { const all = Object.keys(TEXTS); setLang(cfg.lang = all[(all.indexOf(lang) + 1) % all.length]); saveCfg(); ui(); };
$('bn').onclick = askFresh;
$('go').onclick = () => { body.className = ''; clearTimeout(idleT); idleT = 0; wake(); if (paused) setPause(0); syncAudio(1); if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { }); };
addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase(), i = '1234'.indexOf(k);
  if (k == ' ') { e.preventDefault(); setPause(!paused); }
  else if (i >= 0) speeds[i].click();
  else if (k == 'l') $('bl').click(); else if (k == 'p') $('bp').click(); else if (k == 'm') $('bs').click();
  else if (k == 'escape') { follow = null; hud(); redraw(); }
  else if (k == '+' || k == '=') zoomAt(innerWidth / 2, innerHeight / 2, 1.25); else if (k == '-') zoomAt(innerWidth / 2, innerHeight / 2, .8);
});

// --- co právě dělá sledovaný mravenec (číslo je pořadí v T.act) ---
function doing(a) {
  if (a == queen) return T.queen;
  const j = a.j, k = j ? j.k : 0, s = a.st;
  const w = s == 1 ? 0 : s == 2 ? 1 : s == 3 ? (a.af == 4 ? 2 : 3) : s == 4 ? 4 : s == 5 ? (a.cr == 2 ? 5 : 6) : s == 6 ? 7 : s == 7 ? 8
    : s == 8 || s == 9 ? 9 + k : s == 10 || s == 11 ? 12 + k : s == 14 ? 16 : 17;
  return fmt(T.worker, { n: a.id, a: T.act[w], t: `${a.age / 60 | 0}:${(a.age % 60 | 0).toString().padStart(2, '0')}` });
}
function hud() {
  let e = 0, l = 0, p = 0; for (const b of brood) b.t == 1 ? e++ : b.t == 2 ? l++ : p++;
  const d = time / DAY + .3, mn = d % 1 * 1440 | 0;
  $('ck').textContent = `${T.day} ${(d | 0) + 1} · ${mn / 60 | 0}:${(mn % 60).toString().padStart(2, '0')}${paused ? ' · ' + T.paused : ''}`;
  $('s0').textContent = ants.length; $('s1').textContent = `${e} · ${l} · ${p}`; $('s2').textContent = stored + Math.round(belly);
  $('s3').textContent = rooms.filter(r => r.done && r.type != SHAFT).length;
  $('s4').textContent = `${cnt[1]} · ${cnt[2]} · ${cnt[3]} · ${cnt[0]}`;
  const i = $('info'); i.hidden = !follow; if (follow) i.textContent = doing(follow);
}

function frame(now) {
  raf = 0;
  const dt = paused ? 0 : Math.min(.1, (now - last) / 1e3); last = now; clk += dt;
  resize();
  if (!paused) {
    acc = Math.min(acc + dt * speed, 4);
    const t0 = performance.now();
    for (let n = 1; acc >= DT; n++) { tick(); acc -= DT; if (!(n & 15) && performance.now() - t0 > 12) { acc = 0; break; } }
  }
  if (follow) {
    if (follow.dead) follow = null;
    else if (!paused) { cam.x += (follow.x - cam.x) * .08; cam.y += (follow.y - cam.y) * .08; if (cam.s < minS * 3.5) cam.s *= 1.02; clampCam(); }
  }
  render(clk, dt);
  if (paused) return;  // žádný další snímek: procesor ani grafika teď nemají co dělat
  audioTick(clk, dt);
  if (!(fr++ % 12) && idleT) hud();
  if (now - savedAt > 2e4) saveWorld();
  raf = requestAnimationFrame(frame);
}

setSpeed(speed); tog('b0', paused); tog('bl', showLab); tog('bp', showPlan); tog('bs', sndOn); ui(); wake();
// PWA: service worker drží stránku v mezipaměti, takže nainstalovaná aplikace naběhne i bez sítě (jen přes http/https, ne ze souboru)
if (navigator.serviceWorker && location.protocol != 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });
