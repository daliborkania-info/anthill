// ===== bake.js: atlas spritů, spočítaný při startu =====
// Těla (mravenci, plod, semínka, houby, brouk) se rastrují jako 3D elipsoidy a kapsle: vzniká barva i mapa normál,
// takže je shader může svítit odkudkoli. Rostliny kreslí Canvas 2D.
const AS = 2048, alb = new Uint8ClampedArray(AS * AS * 4), nrm = new Uint8ClampedArray(AS * AS * 4), SP = [];
new Uint32Array(nrm.buffer).fill(0x00ff8080);  // rovná normála (0,0,1), lesk 0
let shx = 0, shy = 0, shh = 0, bs = 4321;
const br = () => (bs = bs * 16807 % 2147483647) / 2147483647, bq = (a, b) => a + (b - a) * br();
function alloc(w, h) { if (shx + w > AS) { shx = 0; shy += shh; shh = 0; } const r = { x: shx, y: shy, w, h }; shx += w; shh = Math.max(shh, h); return r; }
// sprite = [u0,v0,u1,v1, x0,y0,x1,y1]: výřez atlasu a jeho obdélník ve vlastních jednotkách kolem počátku
const sprite = (r, sc, ox, oy) => SP.push([r.x / AS, r.y / AS, (r.x + r.w) / AS, (r.y + r.h) / AS, -ox / sc, -oy / sc, (r.w - ox) / sc, (r.h - oy) / sc]) - 1;

// prim: [0, cx,cy,cz, rx,ry,rz, rot, barva, lesk, fn(u,v)]  elipsoid
//       [1, ax,ay,az, bx,by,bz, ra,rb, barva, lesk]          kapsle (zužující se)
function bake(x0, y0, x1, y1, sc, prims) {
  const pad = 12, w = Math.ceil((x1 - x0) * sc) + pad * 2, h = Math.ceil((y1 - y0) * sc) + pad * 2, r = alloc(w, h), ox = pad - x0 * sc, oy = pad - y0 * sc, zb = new Float32Array(w * h).fill(-9);
  for (const P of prims) {
    const cap = P[0], ax = P[1], ay = P[2], az = P[3];
    let m, bx0, bx1, by0, by1, cs = 1, sn = 0, dx = 0, dy = 0, l2 = 1;
    if (cap) { m = Math.max(P[7], P[8]); bx0 = Math.min(ax, P[4]) - m; bx1 = Math.max(ax, P[4]) + m; by0 = Math.min(ay, P[5]) - m; by1 = Math.max(ay, P[5]) + m; dx = P[4] - ax; dy = P[5] - ay; l2 = dx * dx + dy * dy || 1e-9; }
    else { m = Math.max(P[4], P[5]); bx0 = ax - m; bx1 = ax + m; by0 = ay - m; by1 = ay + m; cs = Math.cos(P[7]); sn = Math.sin(P[7]); }
    const X0 = Math.max(0, bx0 * sc + ox | 0), X1 = Math.min(w - 1, bx1 * sc + ox + 1 | 0), Y0 = Math.max(0, by0 * sc + oy | 0), Y1 = Math.min(h - 1, by1 * sc + oy + 1 | 0);
    const col0 = cap ? P[9] : P[8], gl = (cap ? P[10] : P[9]) * 255, fn = cap ? 0 : P[10];
    for (let py = Y0; py <= Y1; py++) for (let px = X0; px <= X1; px++) {
      const lx = (px + .5 - ox) / sc - ax, ly = (py + .5 - oy) / sc - ay;
      let z, cov, nx, ny, nz, c = col0;
      if (cap) {
        const t = clamp((lx * dx + ly * dy) / l2, 0, 1), rr = P[7] + (P[8] - P[7]) * t, qx = lx - dx * t, qy = ly - dy * t, d2 = qx * qx + qy * qy;
        if (d2 >= rr * rr) continue;
        const hz = Math.sqrt(rr * rr - d2);
        z = az + (P[6] - az) * t + hz; cov = (rr - Math.sqrt(d2)) * sc; nx = qx / rr; ny = qy / rr; nz = hz / rr;
      } else {
        const rx = P[4], ry = P[5], rz = P[6], uu = (lx * cs + ly * sn) / rx, vv = (ly * cs - lx * sn) / ry, q = 1 - uu * uu - vv * vv;
        if (q <= 0) continue;
        const hz = Math.sqrt(q);
        z = az + rz * hz; cov = q * Math.min(rx, ry) * sc * .5;
        let a = uu / rx, b = vv / ry, cz = hz / rz; const il = 1 / Math.hypot(a, b, cz);
        a *= il; b *= il; nz = cz * il; nx = a * cs - b * sn; ny = a * sn + b * cs;
        if (fn) { const mm = fn(uu, vv, hz); c = mm.length ? mm : [c[0] * mm, c[1] * mm, c[2] * mm]; }
      }
      if (cov > 1) cov = 1;
      const i = py * w + px, j = ((r.y + py) * AS + r.x + px) * 4, oa = alb[j + 3] / 255;
      let k;
      if (z > zb[i]) { k = oa ? cov : 1; if (cov > .5) zb[i] = z; } else { if (oa >= 1) continue; k = 1 - oa; }
      const k1 = 1 - k;
      alb[j] = alb[j] * k1 + c[0] * 255 * k; alb[j + 1] = alb[j + 1] * k1 + c[1] * 255 * k; alb[j + 2] = alb[j + 2] * k1 + c[2] * 255 * k; alb[j + 3] = Math.max(oa, cov) * 255;
      nrm[j] = nrm[j] * k1 + (nx * .5 + .5) * 255 * k; nrm[j + 1] = nrm[j + 1] * k1 + (ny * .5 + .5) * 255 * k; nrm[j + 2] = nrm[j + 2] * k1 + (nz * .5 + .5) * 255 * k; nrm[j + 3] = nrm[j + 3] * k1 + gl * k;
    }
  }
  return sprite(r, sc, ox, oy);
}

// --- mravenec z boku: jednotka = délka těla, x dopředu, y dolů k podkladu, z k divákovi ---
function antPrims(ph, Q, still) {
  const P = [], BK = [.085, .05, .04], RD = [.5, .17, .07], LG = [.24, .09, .04], g = Q ? 1 : 0, w = Math.sin(ph * 2) * .014;
  const E = (...a) => P.push([0, ...a]), C = (...a) => P.push([1, ...a]);
  E(-.275 - g * .17, -.04, 0, .2 + g * .15, .118 + g * .06, .11 + g * .055, -.08, BK, .9, (u, v) => { // zadeček s články
    let m = 1; for (const s of [-.5, -.12, .26, .6]) m -= .5 * Math.exp(-(((u - s) / .035) ** 2));
    return m * (.9 + .2 * Math.sin(u * 40 + v * 7) ** 2) * (1 + .9 * Math.max(0, -v - .2));
  });
  E(-.068, -.035, 0, .028, .062, .035, 0, [.33, .11, .05], .5);                                   // stopka
  E(-.005, -.022, 0, .078, .063, .056 + g * .01, .25, RD, .5);                                    // hruď
  E(.1, -.042 - g * .01, 0, .108 + g * .02, .08 + g * .02, .07 + g * .015, -.1, RD, .55);
  E(.2, -.03, 0, .04, .04, .035, 0, RD, .4);
  E(.305, -.035, 0, .1, .092, .085, .3, RD, .7, (u, v) => .3 + .7 * sstep(-.75, .05, v));         // hlava, nahoře tmavší
  E(.325, -.06, .068, .025, .031, .022, .3, [.02, .015, .012], 1);                                // oko
  C(.385, .005, .03, .452, .036, .03, .022, .008, [.28, .09, .03], .7);                           // kusadla
  for (let s = 1; s >= -1; s -= 2) {
    const z = s * .05, c = s > 0 ? LG : [.13, .05, .025], o = s > 0 ? 0 : .018;
    C(.375 + o, -.075, z, .465 + o, -.16 + w * s, z * 1.3, .012, .011, c, .5);                    // tykadlo: násadec a bičík
    C(.465 + o, -.16 + w * s, z * 1.3, .6 + o, -.085 + w * 2 * s, z * 1.3, .0115, .0135, c, .5);
    for (let i = 0; i < 3; i++) { // nohy: stehno vzhůru ke kolenu, holeň dolů, chodidlo na podkladu; střídavý trojnožkový krok
      const p = ph + (i == 1 ? Math.PI : 0) + (s < 0 ? Math.PI : 0), sw = still ? 0 : Math.cos(p) * .085, lf = still ? 0 : Math.max(0, -Math.sin(p)) * .055;
      const hx = i * .07, fx = [-.33, 0, .31][i] + sw + o, fy = .205 - lf, kx = hx + (fx - hx) * .48 + [-.05, 0, .04][i], ky = -.085 - lf * .4 - (i == 1 ? .01 : 0);
      const ax = fx - [-.045, .012, .045][i], ay = fy - .045;
      C(hx, .025, z * .6, kx, ky, z * 1.6, .02, .014, c, .6); C(kx, ky, z * 1.6, ax, ay, z * 1.9, .013, .009, c, .6); C(ax, ay, z * 1.9, fx, fy, z * 1.9, .008, .0055, c, .5);
    }
  }
  return P;
}
const S_ANT = SP.length;
for (let i = 0; i < 12; i++) bake(-.5, -.21, .64, .225, 260, antPrims(i / 12 * 6.2832));
bake(-.5, -.21, .64, .225, 260, antPrims(.4, 0, 1)); bake(-.5, -.21, .64, .225, 260, antPrims(1.2, 0, 1));  // stojící, dvě polohy tykadel
const S_QUEEN = bake(-.82, -.25, .64, .225, 520, antPrims(.4, 1, 1)); bake(-.82, -.25, .64, .225, 520, antPrims(1.2, 1, 1));

// --- drobnosti v komorách (jednotka = buňka) ---
const wav = (a, b) => (u, v) => 1 + .14 * Math.sin(u * a + v * 3) * Math.sin(v * b + u * 2);
const S_SEED = bake(-.36, -.24, .36, .24, 90, [[0, 0, 0, 0, .3, .165, .15, .2, [.84, .68, .36], .4, (u, v) => 1 - .42 * Math.exp(-(((v + .1) / .13) ** 2))]]);
bake(-.3, -.28, .3, .28, 90, [[0, 0, 0, 0, .23, .215, .2, 0, [.66, .06, .12], 1]]);                                              // kousek bobule
bake(-.36, -.26, .4, .3, 90, [[0, 0, 0, 0, .29, .16, .1, .4, [.12, .26, .12], .95], [1, .1, .05, 0, .32, .2, 0, .022, .012, [.05, .04, .03], .6]]);  // kousek brouka
bake(-.36, -.3, .36, .3, 90, [[0, -.08, .02, 0, .17, .14, .13, 0, [.95, .89, .7], .05, wav(9, 11)], [0, .1, -.03, .02, .15, .13, .12, 0, [.9, .82, .6], .05, wav(8, 13)], [0, 0, .09, .03, .13, .1, .1, 0, [.97, .92, .76], .05, wav(11, 7)]]);  // drobek
const S_EGG = bake(-.25, -.18, .25, .18, 90, [[0, 0, 0, 0, .2, .125, .125, .25, [.96, .95, .9], .9]]);
const S_LARVA = bake(-.42, -.32, .42, .32, 90, [0, 1, 2, 3, 4, 5].map(k => { const a = 3.5 - k * .42, r = .15 - k * .013; return [0, Math.cos(a) * .2, -Math.sin(a) * .15, k * .01, r, r * .95, r, 0, k == 5 ? [.8, .62, .4] : [.96, .92, .8], .75]; }));
const S_PUPA = bake(-.44, -.27, .44, .27, 90, [[0, 0, 0, 0, .38, .2, .2, .1, [.8, .68, .48], .3, (u, v) => .88 + .14 * Math.sin(u * 26) * Math.sin(v * 9 + u * 3)]]);
const S_PELLET = bake(-.3, -.24, .3, .24, 90, [[0, -.08, .02, 0, .14, .12, .12, 0, [.36, .24, .14], .08, wav(9, 11)], [0, .09, -.03, .02, .12, .11, .1, 0, [.3, .2, .12], .08, wav(7, 9)], [0, 0, .07, .03, .1, .09, .09, 0, [.4, .27, .16], .08, wav(12, 8)]]);
const S_WORM = bake(-.4, -.38, .4, .38, 90, [[0, 0, 0, 0, .36, .34, .3, 0, [.78, .46, .43], .85, u => 1 - .28 * sstep(.6, .95, Math.abs(u))]]);

// --- velká potrava na povrchu, houby ---
const S_BERRY = bake(-1.05, -2.4, 1.05, .08, 70, [[1, 0, -1.7, 0, .28, -2.3, 0, .06, .04, [.2, .3, .1], .2], [0, 0, -.9, 0, .92, .9, .85, 0, [.7, .05, .12], 1, (u, v) => .9 + .1 * Math.sin(u * 5 + v * 3)], [0, .02, -1.72, .2, .2, .08, .2, .3, [.16, .26, .08], .3]]);
const BL = [.045, .04, .035], bleg = (x, z, d) => [[1, x, -1.05, z, x + d * .25, -1.62, z * 1.3, .07, .05, BL, .7], [1, x + d * .25, -1.62, z * 1.3, x + d * .62, -1.34, z * 1.4, .05, .03, BL, .7]];
const S_BEETLE = bake(-1.6, -1.85, 2.35, .08, 60, [
  [0, 0, -.62, 0, 1.45, .6, .75, 0, [.07, .19, .11], 1, (u, v) => .65 + .35 * Math.cos(v * 9) ** 2], [0, 1.35, -.6, 0, .5, .5, .6, 0, [.05, .08, .06], .9], [0, 1.9, -.55, 0, .3, .3, .35, 0, [.03, .035, .03], .8],
  ...bleg(-.6, .5, -1), ...bleg(.1, .55, 1), ...bleg(.9, .5, 1), ...bleg(-.4, -.5, -1), ...bleg(.4, -.5, 1), ...bleg(1.1, -.5, 1)]);
const S_CRUMB = bake(-1.5, -1.95, 1.5, .08, 60, Array.from({ length: 11 }, (_, i) => { const a = i * 2.4, d = i ? bq(.3, .85) : 0, r = bq(.45, .75); return [0, Math.cos(a) * d, -.85 + Math.sin(a) * d * .7, bq(-.3, .3), r, r * bq(.75, 1), r, bq(0, 3), i % 4 ? [.94, .87, .66] : [.78, .58, .32], .04, wav(bq(6, 12), bq(6, 12))]; }));
const S_MUSH = bake(-.95, -1.8, .95, .08, 70, [[1, 0, 0, 0, .04, -1.15, 0, .2, .15, [.92, .88, .78], .15], [0, .04, -1.25, 0, .8, .4, .6, 0, [.62, .15, .08], .6, (u, v) => v > .5 ? [.84, .78, .64] : Math.sin(u * 7 + 1) * Math.sin(v * 6 + 2) > .7 ? [.94, .92, .86] : [.62, .15, .08]]]);
bake(-.95, -1.8, .95, .08, 70, [[1, 0, 0, 0, -.05, -1.05, 0, .24, .2, [.86, .8, .66], .15], [0, -.03, -1.2, 0, .85, .46, .6, 0, [.42, .26, .13], .45, (u, v) => v > .55 ? [.8, .72, .5] : .9 + .15 * Math.sin(u * 9) * Math.sin(v * 7)]]);

// --- rostliny (Canvas 2D; počátek dole uprostřed, jednotka = buňka, y nahoru je záporné) ---
function draw(w, h, sc, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.translate(w / 2, h - 10); x.scale(sc, sc); x.lineCap = x.lineJoin = 'round'; fn(x);
  const r = alloc(w, h), d = x.getImageData(0, 0, w, h).data;
  for (let y = 0; y < h; y++) alb.set(d.subarray(y * w * 4, (y + 1) * w * 4), ((r.y + y) * AS + r.x) * 4);
  return sprite(r, sc, w / 2, h - 10);
}
const GR = ['#6ca038', '#88b046', '#568c32', '#a4ac52', '#4c8436'];
function blade(x, bx, h, lean, w, c2) { // list trávy: zúžený, ohnutý, dole tmavší
  const g = x.createLinearGradient(0, 0, 0, -h); g.addColorStop(0, '#1e3e14'); g.addColorStop(.55, c2); g.addColorStop(1, '#b4c46c'); x.fillStyle = g;
  const tx = bx + lean, mx = bx + lean * .22, my = -h * .58;
  x.beginPath(); x.moveTo(bx - w / 2, 0); x.quadraticCurveTo(mx - w * .45, my, tx, -h); x.quadraticCurveTo(mx + w * .55, my, bx + w / 2, 0); x.fill();
  x.strokeStyle = 'rgba(20,40,10,.25)'; x.lineWidth = .02; x.beginPath(); x.moveTo(bx, 0); x.quadraticCurveTo(mx, my, tx, -h); x.stroke();
}
const S_TUFT = SP.length;
for (let v = 0; v < 6; v++) draw(250, 300, 62, x => {
  const b = []; for (let i = 0; i < 11 + v * 2; i++) b.push([bq(-.9, .9), bq(1.6, 4.4), bq(-1.3, 1.3), bq(.14, .26), GR[br() * GR.length | 0]]);
  b.sort((p, q) => q[1] - p[1]);
  for (const q of b) blade(x, q[0], q[1], q[2] * q[1] / 4.4, q[3], q[4]);
  const g = x.createLinearGradient(0, 0, 0, -.6); g.addColorStop(0, '#000'); g.addColorStop(1, 'transparent'); // pata trsu mizí v zemi
  x.globalCompositeOperation = 'destination-out'; x.fillStyle = g; x.fillRect(-3, -.6, 6, .8);
});
const S_CLOVER = SP.length;
for (let v = 0; v < 2; v++) draw(230, 110, 62, x => {
  for (let i = 0; i < 9; i++) {
    const bx = bq(-1.3, 1.3), h = bq(.5, 1.25), tx = bx + bq(-.4, .4);
    x.strokeStyle = '#3c6c26'; x.lineWidth = .05; x.beginPath(); x.moveTo(bx, 0); x.quadraticCurveTo(bx, -h * .6, tx, -h); x.stroke();
    for (let k = 0; k < 3; k++) { const a = k * 2.094 + bq(0, 1), px = tx + Math.cos(a) * .17, py = -h + Math.sin(a) * .13; const g = x.createRadialGradient(px, py, 0, px, py, .2); g.addColorStop(0, '#7cb048'); g.addColorStop(1, '#3e7828'); x.fillStyle = g; x.beginPath(); x.ellipse(px, py, .2, .16, a, 0, 6.3); x.fill(); }
  }
});
function stem(x, hx, hy, w) { // stonek s dvěma listy
  const g = x.createLinearGradient(0, 0, 0, hy); g.addColorStop(0, '#2e5a1e'); g.addColorStop(1, '#6a9c40');
  x.strokeStyle = g; x.lineWidth = w; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(-hx * .6, hy * .55, hx, hy); x.stroke();
  for (const [t, d] of [[.25, 1], [.45, -1]]) {
    const px = -hx * .6 * 2 * t * (1 - t) + hx * t * t, py = hy * .55 * 2 * t * (1 - t) + hy * t * t, l = bq(.8, 1.4);
    x.fillStyle = d > 0 ? '#4a8430' : '#3c7428'; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + d * l * .5, py - l * .7, px + d * l, py - l * .5); x.quadraticCurveTo(px + d * l * .5, py - l * .1, px, py); x.fill();
  }
}
const S_FLOWER = SP.length;
for (let v = 0; v < 5; v++) draw(200, 470, 62, x => {
  const hx = bq(-.5, .5), hy = -bq(5.6, 6.6);
  stem(x, hx, hy, .11); x.translate(hx, hy); x.scale(1, .86);
  if (v == 0) { // kopretina
    for (let i = 0; i < 17; i++) { const a = i * .37; x.fillStyle = i & 1 ? '#f6f4ec' : '#e4e2d8'; x.beginPath(); x.ellipse(Math.cos(a) * .55, Math.sin(a) * .55, .46, .13, a, 0, 6.3); x.fill(); }
    const g = x.createRadialGradient(-.06, -.08, 0, 0, 0, .3); g.addColorStop(0, '#ffe14a'); g.addColorStop(1, '#d28a12'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, .29, 0, 6.3); x.fill();
  } else if (v == 1) { // pampeliška
    for (let k = 0; k < 3; k++) for (let i = 0; i < 20; i++) { const a = i * .314 + k * .11, d = .58 - k * .19; x.fillStyle = ['#e0a00c', '#f0be18', '#f8d83a'][k]; x.beginPath(); x.ellipse(Math.cos(a) * d * .55, Math.sin(a) * d * .55, d * .55, .075, a, 0, 6.3); x.fill(); }
  } else if (v == 2) { // vlčí mák
    for (let i = 0; i < 5; i++) { const a = i * 1.257 + .3, px = Math.cos(a) * .42, py = Math.sin(a) * .42; const g = x.createRadialGradient(0, 0, .1, px, py, .62); g.addColorStop(0, '#8c0e08'); g.addColorStop(1, '#ee4022'); x.fillStyle = g; x.beginPath(); x.ellipse(px, py, .56, .48, a, 0, 6.3); x.fill(); }
    x.fillStyle = '#1c1016'; x.beginPath(); x.arc(0, 0, .2, 0, 6.3); x.fill();
    x.fillStyle = '#d8c040'; for (let i = 0; i < 9; i++) { x.beginPath(); x.arc(Math.cos(i * .7) * .25, Math.sin(i * .7) * .25, .035, 0, 6.3); x.fill(); }
  } else if (v == 3) { // zvonek
    for (const [bx, by, a] of [[-.5, .5, .5], [.25, .25, -.25], [.55, .85, -.6]]) {
      x.save(); x.translate(bx, by); x.rotate(a);
      const g = x.createLinearGradient(-.4, 0, .4, 0); g.addColorStop(0, '#5a3aa8'); g.addColorStop(.5, '#9a7ee4'); g.addColorStop(1, '#6444b4'); x.fillStyle = g;
      x.beginPath(); x.moveTo(-.12, 0); x.bezierCurveTo(-.4, .2, -.3, .7, -.48, .95); x.lineTo(-.2, .82); x.lineTo(0, 1); x.lineTo(.2, .82); x.lineTo(.48, .95); x.bezierCurveTo(.3, .7, .4, .2, .12, 0); x.fill(); x.restore();
    }
  } else { // pryskyřník
    for (let i = 0; i < 5; i++) { const a = i * 1.257, px = Math.cos(a) * .32, py = Math.sin(a) * .32; const g = x.createRadialGradient(px - .08, py - .1, 0, px, py, .36); g.addColorStop(0, '#fff06a'); g.addColorStop(1, '#e8b810'); x.fillStyle = g; x.beginPath(); x.arc(px, py, .33, 0, 6.3); x.fill(); }
    x.fillStyle = '#b8a020'; x.beginPath(); x.arc(0, 0, .14, 0, 6.3); x.fill();
  }
});
const S_TALL = SP.length;
for (let v = 0; v < 2; v++) draw(200, 620, 62, x => {
  const hx = bq(-.6, .6), hy = -8.6;
  blade(x, -.1, bq(4, 5.5), -1.2, .2, GR[2]); blade(x, .1, bq(3.2, 4.6), 1.1, .2, GR[0]);
  x.strokeStyle = '#8a9a4a'; x.lineWidth = .08; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(-hx * .4, hy * .5, hx, hy); x.stroke();
  for (let i = 0; i < 16; i++) { // klas nebo lata
    const t = i / 16, px = hx + (v ? Math.sin(i * 2.4) * (1 - t) * .9 : (i & 1 ? .11 : -.11)) - hx * .12 * t, py = hy + 2.4 - t * 2.6;
    if (v) { x.strokeStyle = '#9a8a4a'; x.lineWidth = .025; x.beginPath(); x.moveTo(hx - hx * .12 * t, py + .3); x.lineTo(px, py); x.stroke(); }
    const g = x.createLinearGradient(px - .1, 0, px + .1, 0); g.addColorStop(0, '#a88a3a'); g.addColorStop(1, '#dcc474'); x.fillStyle = g;
    x.beginPath(); x.ellipse(px, py, v ? .07 : .1, v ? .13 : .21, (i & 1 ? .35 : -.35), 0, 6.3); x.fill();
    if (!v) { x.strokeStyle = 'rgba(200,180,110,.7)'; x.lineWidth = .018; x.beginPath(); x.moveTo(px, py - .15); x.lineTo(px + (i & 1 ? .25 : -.25), py - .75); x.stroke(); }
  }
});
const S_WING = draw(90, 90, 40, x => { // křídlo motýla (bílé, barví se odstínem)
  const g = x.createRadialGradient(0, -.2, 0, 0, -.5, 1); g.addColorStop(0, '#fff'); g.addColorStop(.75, '#f2f2f2'); g.addColorStop(1, '#333'); x.fillStyle = g;
  x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(.2, -.9, .9, -1.2, .62, -.5); x.bezierCurveTo(.75, -.2, .5, .1, 0, 0); x.fill();
  x.fillStyle = '#222'; x.beginPath(); x.arc(.45, -.72, .09, 0, 6.3); x.fill();
});
const S_GLOW = draw(64, 64, 22, x => { const g = x.createRadialGradient(0, -1, 0, 0, -1, 1.2); g.addColorStop(0, '#fff'); g.addColorStop(.3, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(-2, -3, 4, 4); });

// barvu přednásobit průhledností (kvůli správnému filtrování a míchání)
for (let i = 0; i < alb.length; i += 4) { const a = alb[i + 3] / 255; alb[i] *= a; alb[i + 1] *= a; alb[i + 2] *= a; }
