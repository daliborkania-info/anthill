# Mraveniště

[English](README.md) · Česky · [Deutsch](README.de.md)

Živý řez mravenčí kolonií v prohlížeči. Půdu, chodby, mravence, rostliny, oblohu i zvuk počítá kód, není tu jediný obrázek ani nahrávka. Celé se to vejde do jednoho HTML souboru o velikosti 62 kB (27 kB po gzipu).

Inspirace: [Abyssal Garden](https://github.com/Noniv/abyssal-garden), podmořský svět v jednom souboru o 97 kB.

## Spuštění

Otevři `index.html` v prohlížeči (Chrome, Edge, Firefox, Safari; stačí WebGL 2). Nic se neinstaluje a funguje to offline.

`index.packed.html` je tentýž program, jen je skript zabalený a v prohlížeči se sám rozbalí. Má 38 kB.

Svět je daný semínkem. `index.html#5` vygeneruje pokaždé stejnou krajinu, bez čísla vznikne náhodná.

## Ovládání

| Akce | Jak |
|---|---|
| Posun | tažení myší nebo prstem |
| Přiblížení | kolečko, dva prsty, klávesy `+` a `-` |
| Sledovat mravence | klik na mravence nebo královnu, `Esc` sledování zruší |
| Hodit kolonii drobek | klik do vzduchu nad zemí |
| Rychlost času | `1` až `4` (1×, 4×, 16×, 48×) |
| Úplná pauza | mezerník nebo tlačítko Pauza |
| Popisky komor, plán stavby, zvuk | `L`, `P`, `M` |
| Jazyk, nový svět | tlačítka v dolní liště |

Panel s čísly i lišta s tlačítky se po 15 sekundách bez pohybu myši, dotyku nebo klávesy schovají a s nimi i kurzor. Stačí pohnout myší a jsou zpět.

## Pauza, ukládání a jazyk

Pauza zastaví všechno. Smyčka kreslení neběží, zvuk se uspí a stránka nezatěžuje procesor ani grafickou kartu. Posun, přiblížení nebo změna velikosti okna během pauzy překreslí jediný snímek.

Stav kolonie se ukládá do prohlížeče (IndexedDB) každých 20 sekund, při pauze a při zavření nebo skrytí okna. Při příštím otevření se nabídne Pokračovat a svět naváže přesně tam, kde skončil, včetně pohledu a sledovaného mravence. Dokud na Pokračovat neklikneš, stojí. Čas, kdy byla stránka zavřená, se nedohání. Tlačítko Nový svět uložený stav smaže a začne znovu. Svět otevřený se semínkem v adrese (`#5`) má vlastní uloženou pozici, takže hlavní kolonii nepřepíše.

Uložený stav patří k adrese, ze které stránka běží. Na jiné adrese nebo portu začíná kolonie od začátku.

Texty jsou česky a anglicky. Jazyk se vybere podle nastavení systému (čeština i pro slovenštinu, jinak angličtina) a tlačítkem v liště ho jde přepnout. Volba se pamatuje, stejně jako rychlost, zvuk a popisky.

## Instalace jako aplikace (PWA)

Vedle `index.html` leží `manifest.webmanifest`, `sw.js` a ikony. Díky nim jde stránku nainstalovat jako samostatnou aplikaci. Prohlížeč to dovolí jen ze serveru (https nebo localhost), ne ze souboru na disku:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Potom otevři `http://localhost:8765/` v Chromu nebo Edgi a v adresním řádku zvol Instalovat. Service worker si stránku uloží, takže nainstalovaná aplikace naběhne i ve chvíli, kdy server neběží. Když server běží, vezme si z něj aktuální verzi.

## Co se tam děje

- Kolonie začíná se šachtou, komorou královny a spižírnou. Další komory si plánuje sama podle toho, co jí chybí (jesle, spižírny, odpočívárny), a dělnice je buňku po buňce vykopou.
- Vykopanou hlínu vynášejí ven a sypou kolem vchodu, takže roste val s kráterem.
- Sběračky hledají na povrchu semínka, bobule a mrtvé brouky. Cestou domů značí pachovou stopu, po které jdou další.
- Královna klade vajíčka, dokud ji chůvy krmí. Chůvy přenášejí plod do jeslí a krmí larvy, z kukel se líhnou světlé mladé dělnice.
- Střídá se den a noc (jeden den trvá 10 minut při rychlosti 1×). V noci většina sběraček zůstává doma.

## Jak vzniká obraz

- Hlína je jeden shader. Skládá půdní horizonty, hrudky a zrna ve třech měřítkách, oblázky, kameny a kořeny, a každému povrchu dopočítá sklon, takže ho lampa zleva shora nasvítí jako reliéf. Jemná zrna přibývají až s přiblížením.
- Chodby a komory jsou vykreslené jako vyhloubené žlaby se stínem pod stropem a s denním světlem, které slábne od vchodu.
- Mravenci, královna, plod, zásoby a rostliny se při startu vymodelují z elipsoidů a válečků do textury s barvou a mapou normál. Při kreslení pak dostávají stejné světlo jako okolí a vrhají měkký stín.
- Nad zemí svítí slunce nebo měsíc podle denní doby, obloha má mraky, hvězdy, kopce a les na obzoru.
- Obraz se počítá ve vysokém dynamickém rozsahu a na konci projde bloomem, filmovým tónováním, vinětou a zrnem. Když počítač nestíhá, rozlišení se samo sníží.

## Publikování na GitHub Pages

V repozitáři je připravený workflow `.github/workflows/pages.yml`. Sestaví stránku ze zdrojů a vystaví ji na GitHub Pages. Spouští se ručně, na GitHubu v záložce Actions (Deploy to GitHub Pages, Run workflow), nebo z příkazové řádky:

```bash
gh workflow run pages.yml
```

Stránka pak běží na `https://daliborkania-info.github.io/anthill/` a z této adresy ji jde i nainstalovat jako aplikaci, bez vlastního serveru.

## Úpravy a sestavení

Čitelný zdroj je ve složce `source`. K sestavení je potřeba Node.js 18 nebo novější:

```bash
cd source
npm install
npm run build
```

`npm run build:readable` zapíše neminifikovanou verzi pro ladění, `npm run build:packed` navíc vyrobí `index.packed.html`.

Ikony se dělají z `source/icon.svg` nástrojem `rsvg-convert` (velikosti 192 a 512, varianta `icon-maskable.png` je tatáž kresba bez zaoblených rohů).

| Soubor | Co v něm je |
|---|---|
| `source/src/sim.js` | Svět, plánování hnízda, hledání cest a chování kolonie, uložení a obnova stavu. Jde pustit i v Node. |
| `source/src/prefs.js` | Zapamatované volby a texty v obou jazycích |
| `source/src/store.js` | Uložený svět v IndexedDB, při startu ho načte nebo založí nový |
| `source/src/bake.js` | Modely mravenců, plodu, potravy a rostlin, které se při startu vypočítají do textury |
| `source/src/gfx.js` | Shader půdy, chodeb a oblohy, nasvícené sprity se stíny, závěrečné úpravy obrazu |
| `source/src/audio.js` | Zvuk skládaný za běhu |
| `source/src/main.js` | Kamera, ovládání, pauza, ukládání, skrývání panelů, panel s čísly |
| `source/template.html` | Stránka kolem simulace a její styly |
| `manifest.webmanifest`, `sw.js`, `icon-*.png` | Soubory pro instalaci jako aplikace |
