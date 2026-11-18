// ===== prefs.js: zapamatované volby a texty česky, anglicky a německy =====
// Volby (jazyk, zvuk, popisky, plán, rychlost) žijí v localStorage. Selhání úložiště (soukromé okno apod.) se tiše přejde.
const cfg = (() => { try { return JSON.parse(localStorage.mraveniste) || {}; } catch (e) { return {}; } })();
const saveCfg = () => { try { localStorage.mraveniste = JSON.stringify(cfg); } catch (e) { } };

// Jazyk se bere z nastavení systému (prohlížeče), tlačítko v liště jazyky střídá a volba se zapamatuje.
// Prvky stránky s data-t dostanou text, s data-h bublinu (title). V textech se {x} nahrazuje hodnotou.
const TEXTS = {
  cs: {
    title: 'Mraveniště', code: 'CS',
    sub: 'Řez živou kolonií. Půdu, chodby, mravence i zvuk počítá kód v téhle jedné stránce, bez jediného obrázku nebo nahrávky.',
    go: 'Nahlédnout dovnitř', cont: 'Pokračovat', saved: 'Uložená kolonie: den {d}, dělnic {n}',
    help: 'Tažením posouváš, kolečkem přibližuješ. Klikni na mravence a sleduj ho, klikni do vzduchu a hoď kolonii drobek. Klávesy 1 až 4 zrychlují čas, mezerník všechno zastaví.',
    workers: 'Dělnice', brood: 'Vajíčka · larvy · kukly', food: 'Zásoby potravy', rooms: 'Hotové komory', jobs: 'Kopou · sbírají · chůvy · volno',
    pause: 'Pauza', resume: 'Pokračovat', labels: 'Popisky', plan: 'Plán stavby', sound: 'Zvuk', fresh: 'Nový svět', space: 'Mezerník',
    freshQ: 'Opravdu začít nový svět? Současná kolonie se smaže.',
    day: 'den', paused: 'pozastaveno', dig: 'výkop {n} %',
    names: ['Královna', 'Spižírna', 'Jesle', 'Odpočívárna'],
    queen: 'Královna · klade vajíčka, dokud ji chůvy krmí', worker: 'Dělnice č. {n} · {a} · stáří {t}',
    act: ['jde kopat', 'kope', 'vynáší hlínu ven', 'jde na povrch pro potravu', 'sype hlínu na val', 'nese potravu domů a značí cestu', 'vrací se do hnízda', 'hledá potravu', 'bere si sousto',
      'jde pro plod ke královně', 'jde do spižírny pro krmení larvy', 'jde do spižírny pro krmení královny', 'přenáší plod do jeslí', 'nese krmení larvě', 'nese krmení královně',
      'ukládá potravu do spižírny', 'odpočívá', 'prochází hnízdem'],
    gl2: 'Tahle simulace potřebuje WebGL 2. Zkus aktuální Chrome, Edge nebo Firefox.'
  },
  en: {
    title: 'Anthill', code: 'EN',
    sub: 'A cross-section of a living colony. The soil, the tunnels, the ants and the sound are all computed by code in this one page, without a single image or recording.',
    go: 'Look inside', cont: 'Continue', saved: 'Saved colony: day {d}, {n} workers',
    help: 'Drag to pan, scroll to zoom. Click an ant to follow it, click the air to drop the colony a crumb. Keys 1 to 4 speed up time, Space stops everything.',
    workers: 'Workers', brood: 'Eggs · larvae · pupae', food: 'Food stores', rooms: 'Finished chambers', jobs: 'Digging · foraging · nursing · idle',
    pause: 'Pause', resume: 'Resume', labels: 'Labels', plan: 'Building plan', sound: 'Sound', fresh: 'New world', space: 'Space',
    freshQ: 'Start a new world? The current colony will be deleted.',
    day: 'day', paused: 'paused', dig: '{n}% dug',
    names: ['Queen', 'Pantry', 'Nursery', 'Resting room'],
    queen: 'Queen · lays eggs as long as the nurses feed her', worker: 'Worker #{n} · {a} · age {t}',
    act: ['heading off to dig', 'digging', 'carrying soil out', 'heading up to forage', 'dumping soil on the mound', 'carrying food home and marking the trail', 'returning to the nest', 'searching for food', 'picking up a morsel',
      'fetching brood from the queen', 'fetching food for a larva', 'fetching food for the queen', 'moving brood to the nursery', 'bringing food to a larva', 'bringing food to the queen',
      'storing food in the pantry', 'resting', 'wandering the nest'],
    gl2: 'This simulation needs WebGL 2. Try a current Chrome, Edge or Firefox.'
  },
  de: {
    title: 'Ameisenhügel', code: 'DE',
    sub: 'Ein Querschnitt durch eine lebende Kolonie. Erde, Gänge, Ameisen und Ton berechnet der Code auf dieser einen Seite, ganz ohne Bilder oder Aufnahmen.',
    go: 'Hineinschauen', cont: 'Weiter', saved: 'Gespeicherte Kolonie: Tag {d}, {n} Arbeiterinnen',
    help: 'Ziehen verschiebt, das Mausrad zoomt. Klicke auf eine Ameise, um ihr zu folgen, oder in die Luft, um der Kolonie einen Krümel zuzuwerfen. Die Tasten 1 bis 4 beschleunigen die Zeit, die Leertaste hält alles an.',
    workers: 'Arbeiterinnen', brood: 'Eier · Larven · Puppen', food: 'Futtervorrat', rooms: 'Fertige Kammern', jobs: 'Graben · Sammeln · Pflegen · Frei',
    pause: 'Pause', resume: 'Weiter', labels: 'Beschriftung', plan: 'Bauplan', sound: 'Ton', fresh: 'Neue Welt', space: 'Leertaste',
    freshQ: 'Wirklich eine neue Welt beginnen? Die jetzige Kolonie wird gelöscht.',
    day: 'Tag', paused: 'angehalten', dig: '{n} % ausgehoben',
    names: ['Königin', 'Vorratskammer', 'Brutkammer', 'Ruhekammer'],
    queen: 'Königin · legt Eier, solange die Ammen sie füttern', worker: 'Arbeiterin Nr. {n} · {a} · Alter {t}',
    act: ['geht graben', 'gräbt', 'trägt Erde hinaus', 'geht zur Futtersuche nach oben', 'schüttet Erde auf den Wall', 'trägt Futter heim und markiert den Weg', 'kehrt ins Nest zurück', 'sucht Futter', 'nimmt einen Bissen auf',
      'holt Brut bei der Königin', 'holt Futter für eine Larve', 'holt Futter für die Königin', 'trägt Brut in die Brutkammer', 'bringt einer Larve Futter', 'bringt der Königin Futter',
      'lagert Futter in der Vorratskammer ein', 'ruht', 'läuft durchs Nest'],
    gl2: 'Diese Simulation braucht WebGL 2. Versuche es mit einem aktuellen Chrome, Edge oder Firefox.'
  }
};
let lang, T;
const fmt = (s, o) => s.replace(/{(\w)}/g, (_, k) => o[k]);
function setLang(l) {
  lang = l; T = TEXTS[l];
  document.documentElement.lang = l; document.title = T.title;
  for (const e of document.querySelectorAll('[data-t]')) e.textContent = T[e.dataset.t];
  for (const e of document.querySelectorAll('[data-h]')) e.title = T[e.dataset.h];
  // nainstalovaná aplikace se jmenuje podle jazyka: každý jazyk má svůj manifest
  document.querySelector('link[rel=manifest]').href = l == 'en' ? 'manifest.webmanifest' : `manifest.${l}.webmanifest`;
}
const sys = (navigator.language || '').slice(0, 2).toLowerCase();  // slovenština dostane češtinu, neznámý jazyk angličtinu
setLang(TEXTS[cfg.lang] ? cfg.lang : sys == 'sk' ? 'cs' : TEXTS[sys] ? sys : 'en');
