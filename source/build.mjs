// Složí src/*.js do jediného samostatného ../index.html
//   npm run build            minifikovaná verze
//   npm run build:readable   čitelná verze pro ladění
//   npm run build:packed     navíc ../index.packed.html: totéž, ale skript je zabalený (deflate) a rozbalí se sám v prohlížeči
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync, deflateRawSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const FILES = ['sim.js', 'prefs.js', 'store.js', 'bake.js', 'gfx.js', 'audio.js', 'main.js']; // na pořadí záleží
const readable = process.argv.includes('--readable'), packed = process.argv.includes('--packed');

let js = FILES.map((f) => readFileSync(path.join(here, 'src', f), 'utf8')).join('\n');
const tpl = readFileSync(path.join(here, 'template.html'), 'utf8');
// vše běží v jedné asynchronní funkci (na začátku se čeká na uložený svět); chyba při startu se ukáže na úvodní obrazovce
const wrap = (body) => `(async()=>{try{${body}\n}catch(e){console.error(e);document.body.className='l';document.getElementById('go').hidden=1;document.getElementById('s').textContent=(e.cause?'':document.documentElement.lang=='cs'?'Nepodařilo se spustit: ':'Could not start: ')+e.message}})()`;
const report = (name, html) => console.log(`${name}: ${(html.length / 1024).toFixed(1)} kB, ${(gzipSync(Buffer.from(html), { level: 9 }).length / 1024).toFixed(1)} kB po gzipu`);

let html, code;
if (readable) {
  html = tpl.replace('/*SCRIPT*/', () => wrap(js));
} else {
  // zmenšit GLSL v šablonách označených /*glsl*/, potom minifikovat JS a CSS
  const minGlsl = (s) => s.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').replace(/ ?([{}()\[\];,:=+\-*\/<>&|!%]) ?/g, '$1').trim();
  js = js.replace(/\/\*glsl\*\/`([^`]*)`/g, (_, w) => '`' + minGlsl(w) + '`');
  code = transformSync(wrap(js), { minify: true, target: 'es2022', legalComments: 'none' }).code.trim();
  const css = (_, s) => '<style>' + transformSync(s, { loader: 'css', minify: true }).code.trim();
  html = tpl.replace(/<style>([^]*?)(?=<\/style>)/, css).replace(/>\s+</g, '><').replace('/*SCRIPT*/', () => code);
}
writeFileSync(path.join(here, '..', 'index.html'), html);
report('index.html' + (readable ? ' (čitelná)' : ''), html);

if (packed && !readable) {
  const b64 = deflateRawSync(Buffer.from(code), { level: 9 }).toString('base64');
  const boot = `fetch('data:;base64,${b64}').then(r=>new Response(r.body.pipeThrough(new DecompressionStream('deflate-raw'))).text()).then(s=>(0,eval)(s))`;
  const p = html.replace(code, () => boot);
  writeFileSync(path.join(here, '..', 'index.packed.html'), p);
  report('index.packed.html', p);
}
