// ===== store.js: uložený svět v IndexedDB; při startu se načte, jinak se založí nový =====
// Spojení s databází zůstává otevřené, aby se zápis při zavírání okna stihl odeslat hned, bez čekání na otevření.
let db = null;
const openDb = () => new Promise((ok, no) => {
  const o = indexedDB.open('mraveniste', 1);
  o.onupgradeneeded = () => o.result.createObjectStore('s');
  o.onerror = () => no(o.error);
  o.onsuccess = () => { db = o.result; db.onclose = db.onversionchange = () => { if (db) db.close(); db = null; }; ok(db); };
});
// Jedna transakce nad jediným úložištěm; vrací výsledek dotazu, až když je transakce opravdu zapsaná.
const tx = (d, mode, fn) => new Promise((ok, no) => {
  const t = d.transaction('s', mode), q = fn(t.objectStore('s'));
  t.oncomplete = () => ok(q.result);
  t.onerror = t.onabort = () => no(t.error);
  if (mode != 'readonly' && t.commit) t.commit();
});
const idb = (mode, fn) => db ? tx(db, mode, fn) : openDb().then(d => tx(d, mode, fn));
// Svět bez semínka v adrese má jednu pozici, svět se semínkem (#5) svou vlastní, takže se navzájem nepřepíšou.
const slot = 'w' + ((+location.hash.slice(1) >>> 0) || '');
let noSave = 0;
const freshWorld = () => { noSave = 1; idb('readwrite', s => s.delete(slot)).catch(() => { }).then(() => location.reload()); };
const askFresh = () => { if (confirm(T.freshQ)) freshWorld(); };

let snap = null;
try { snap = await Promise.race([idb('readonly', s => s.get(slot)), new Promise(r => setTimeout(r, 3000))]); } catch (e) { }
if (snap && snap.v != 1) snap = null;
if (snap) {
  // tlačítko Nový svět na úvodní obrazovce funguje i tehdy, když se uložený svět nepodaří spustit
  const b = document.getElementById('nw'); b.hidden = false; b.onclick = askFresh;
  restore(snap);
} else init();
