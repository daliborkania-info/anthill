// ===== audio.js: zvuk skládaný za běhu (Web Audio), žádné nahrávky =====
let AC, mg, gw, gr, wf, nb, sndOn = 1;
function audioStart() {
  if (AC) return;
  AC = new AudioContext(); mg = AC.createGain(); mg.gain.value = .55; mg.connect(AC.destination);
  nb = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
  const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = () => { const s = AC.createBufferSource(); s.buffer = nb; s.loop = true; s.start(); return s; };
  wf = AC.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 420; wf.Q.value = .7;  // vítr nad zemí
  gw = AC.createGain(); gw.gain.value = 0; src().connect(wf).connect(gw).connect(mg);
  const rf = AC.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 95;                // tlumený hukot pod zemí
  gr = AC.createGain(); gr.gain.value = 0; src().connect(rf).connect(gr).connect(mg);
}
function blip(f0, f1, dur, vol, at) {
  const o = AC.createOscillator(), e = AC.createGain(), t = AC.currentTime + (at || 0);
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(vol, t + dur * .25); e.gain.exponentialRampToValueAtTime(1e-4, t + dur);
  o.connect(e).connect(mg); o.start(t); o.stop(t + dur + .02);
}
function scratch(vol) { // škrábnutí kusadel o hlínu
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), e = AC.createGain(), t = AC.currentTime;
  s.buffer = nb; f.type = 'bandpass'; f.frequency.value = 1400 + Math.random() * 2600; f.Q.value = 3;
  e.gain.setValueAtTime(vol, t); e.gain.exponentialRampToValueAtTime(1e-4, t + .05);
  s.connect(f).connect(e).connect(mg); s.start(t, Math.random() * 1.9, .06);
}
function audioTick(t, dt) {
  if (!AC) return;
  const now = AC.currentTime, vh = ch / cam.s, sf = clamp((ey - (cam.y - vh / 2)) / vh * 1.6, 0, 1), R = Math.random; // sf: kolik je v záběru povrchu
  mg.gain.setTargetAtTime(sndOn ? .55 : 0, now, .1);
  gw.gain.setTargetAtTime((.05 + .035 * Math.sin(t * .31) + .02 * Math.sin(t * .83)) * sf * (.5 + .5 * L), now, .4);
  wf.frequency.setTargetAtTime(380 + 160 * Math.sin(t * .17), now, .5);
  gr.gain.setTargetAtTime(.6 * (1 - sf * .8), now, .4);
  if (L < .3 && R() < dt * 1.5) { const f = 4100 + R() * 500; for (let i = 0; i < 3; i++) blip(f, f * 1.02, .035, .035 * sf + .004, i * .055); }  // cvrčci
  if (L > .6 && R() < dt * .3) { let at = 0; for (let i = 2 + R() * 4 | 0; i--;) { const f = 2300 + R() * 2200; blip(f, f * (.7 + R() * .7), .09, .03 * sf + .002, at); at += .1 + R() * .08; } }  // ptáci
  if (R() < dt * Math.min(cnt[1], 14) * .5) scratch(.05 * (1 - sf * .85) * clamp(cam.s / minS / 3, .35, 1));
}
