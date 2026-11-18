# Ameisenhügel

[English](README.md) · [Česky](README.cs.md) · Deutsch

Ein lebendiger Querschnitt durch eine Ameisenkolonie im Browser. Erde, Gänge, Ameisen, Pflanzen, Himmel und Ton werden vollständig vom Code berechnet. Es gibt kein einziges Bild und keine Aufnahme. Das Ganze passt in eine einzige HTML-Datei mit 62 kB (27 kB mit gzip).

Vorbild war [Abyssal Garden](https://github.com/Noniv/abyssal-garden), eine Unterwasserwelt in einer einzigen Datei mit 97 kB.

Die Oberfläche der Anwendung gibt es bisher auf Tschechisch und Englisch, eine deutsche Übersetzung ist geplant. Die Namen der Schaltflächen stehen hier deshalb auf Englisch.

## Starten

Öffne `index.html` im Browser (Chrome, Edge, Firefox, Safari; WebGL 2 genügt). Es muss nichts installiert werden, und es läuft offline.

`index.packed.html` ist dasselbe Programm mit komprimiertem Skript. Es entpackt sich im Browser selbst und hat 38 kB.

Die Welt wird durch einen Startwert (Seed) bestimmt. `index.html#5` erzeugt jedes Mal dieselbe Landschaft, ohne Zahl entsteht eine zufällige.

## Bedienung

| Aktion | Wie |
|---|---|
| Verschieben | mit der Maus oder dem Finger ziehen |
| Zoomen | Mausrad, zwei Finger, Tasten `+` und `-` |
| Einer Ameise folgen | Klick auf eine Ameise oder die Königin, `Esc` beendet das Folgen |
| Der Kolonie einen Krümel zuwerfen | Klick in die Luft über dem Boden |
| Zeitgeschwindigkeit | `1` bis `4` (1×, 4×, 16×, 48×) |
| Vollständige Pause | Leertaste oder die Schaltfläche Pause |
| Kammerbeschriftung, Bauplan, Ton | `L`, `P`, `M` |
| Sprache, neue Welt | Schaltflächen in der unteren Leiste |

Die Anzeige mit den Zahlen und die Leiste mit den Schaltflächen verschwinden nach 15 Sekunden ohne Mausbewegung, Berührung oder Tastendruck, der Mauszeiger ebenfalls. Eine Mausbewegung holt sie zurück.

## Pause, Speichern und Sprache

Die Pause hält alles an. Die Zeichenschleife läuft nicht, die Tonausgabe ruht, und die Seite belastet weder Prozessor noch Grafikkarte. Verschieben, Zoomen oder eine Größenänderung des Fensters zeichnet während der Pause genau ein Bild neu.

Der Zustand der Kolonie wird alle 20 Sekunden, beim Pausieren und beim Schließen oder Verbergen des Fensters im Browser gespeichert (IndexedDB). Beim nächsten Öffnen bietet die Seite Continue an, und die Welt macht genau dort weiter, wo sie aufgehört hat, samt Bildausschnitt und verfolgter Ameise. Bis zum Klick auf Continue steht sie still. Die Zeit, in der die Seite geschlossen war, wird nicht nachgeholt. Die Schaltfläche New world löscht den gespeicherten Zustand und beginnt von vorn. Eine Welt, die mit einem Startwert in der Adresse geöffnet wird (`#5`), hat ihren eigenen Speicherplatz und überschreibt die Hauptkolonie nicht.

Der gespeicherte Zustand gehört zu der Adresse, unter der die Seite läuft. Unter einer anderen Adresse oder einem anderen Port beginnt die Kolonie von vorn.

Die Sprache richtet sich nach der Systemeinstellung (Tschechisch bei Tschechisch und Slowakisch, sonst Englisch) und lässt sich mit einer Schaltfläche in der Leiste umschalten. Die Wahl wird gemerkt, ebenso Geschwindigkeit, Ton und Beschriftung.

## Als App installieren (PWA)

Neben `index.html` liegen `manifest.webmanifest`, `sw.js` und die Symbole. Damit lässt sich die Seite als eigenständige App installieren. Browser erlauben das nur von einem Server (https oder localhost), nicht von einer Datei auf der Festplatte:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Öffne danach `http://localhost:8765/` in Chrome oder Edge und wähle in der Adressleiste Installieren. Der Service Worker bewahrt eine Kopie der Seite auf, die installierte App startet also auch dann, wenn der Server nicht läuft. Läuft er, holt sie sich von dort die aktuelle Version.

## Was dort passiert

- Die Kolonie beginnt mit einem Schacht, der Kammer der Königin und einer Vorratskammer. Weitere Kammern plant sie selbst, je nachdem, was ihr fehlt (Brutkammern, Vorratskammern, Ruhekammern), und die Arbeiterinnen graben sie Zelle für Zelle aus.
- Die ausgehobene Erde tragen sie nach draußen und schütten sie rund um den Eingang auf, sodass dort ein Wall mit Krater wächst.
- Sammlerinnen suchen an der Oberfläche nach Samen, Beeren und toten Käfern. Auf dem Heimweg legen sie eine Duftspur, der andere folgen.
- Die Königin legt Eier, solange die Ammen sie füttern. Die Ammen tragen die Brut in die Brutkammern und füttern die Larven, aus den Puppen schlüpfen helle junge Arbeiterinnen.
- Tag und Nacht wechseln sich ab (ein Tag dauert bei Geschwindigkeit 1× zehn Minuten). Nachts bleiben die meisten Sammlerinnen zu Hause.

## Wie das Bild entsteht

- Die Erde ist ein einziger Shader. Er schichtet Bodenhorizonte, Klumpen und Körner in drei Größen, Kiesel, Steine und Wurzeln und berechnet für jede Oberfläche eine Neigung, sodass die Lampe von links oben sie als Relief beleuchtet. Feine Körner kommen erst beim Heranzoomen dazu.
- Gänge und Kammern sind als ausgehöhlte Rinnen gezeichnet, mit Schatten unter der Decke und Tageslicht, das mit der Entfernung vom Eingang schwächer wird.
- Ameisen, Königin, Brut, Vorräte und Pflanzen werden beim Start aus Ellipsoiden und Kapseln in eine Textur mit Farbe und Normalenkarte modelliert. Beim Zeichnen bekommen sie dasselbe Licht wie ihre Umgebung und werfen einen weichen Schatten.
- Über der Erde scheint je nach Tageszeit die Sonne oder der Mond, der Himmel hat Wolken, Sterne, Hügel und einen Waldrand am Horizont.
- Das Bild wird mit hohem Dynamikumfang berechnet und durchläuft am Ende Bloom, filmisches Tone Mapping, Vignette und Korn. Kommt der Rechner nicht hinterher, sinkt die Auflösung von selbst.

## Veröffentlichen auf GitHub Pages

Im Repository liegt ein fertiger Workflow, `.github/workflows/pages.yml`. Er baut die Seite aus den Quellen und stellt sie auf GitHub Pages bereit. Gestartet wird er von Hand, auf GitHub im Reiter Actions (Deploy to GitHub Pages, Run workflow) oder von der Kommandozeile:

```bash
gh workflow run pages.yml
```

Die Seite läuft dann unter `https://daliborkania-info.github.io/anthill/` und lässt sich von dieser Adresse aus auch als App installieren, ganz ohne eigenen Server.

## Ändern und Bauen

Der lesbare Quelltext liegt im Ordner `source`. Zum Bauen braucht man Node.js 18 oder neuer:

```bash
cd source
npm install
npm run build
```

`npm run build:readable` schreibt eine nicht minifizierte Version zur Fehlersuche, `npm run build:packed` erzeugt zusätzlich `index.packed.html`.

Die Symbole entstehen aus `source/icon.svg` mit `rsvg-convert` (Größen 192 und 512; `icon-maskable.png` ist dieselbe Zeichnung ohne abgerundete Ecken).

Die Kommentare im Quelltext sind auf Tschechisch.

| Datei | Inhalt |
|---|---|
| `source/src/sim.js` | Die Welt, Nestplanung, Wegfindung und Verhalten der Kolonie, Speichern und Wiederherstellen des Zustands. Läuft auch in Node. |
| `source/src/prefs.js` | Gemerkte Einstellungen und die Texte in beiden Sprachen |
| `source/src/store.js` | Die gespeicherte Welt in IndexedDB; lädt sie beim Start oder legt eine neue an |
| `source/src/bake.js` | Modelle von Ameisen, Brut, Nahrung und Pflanzen, die beim Start in eine Textur berechnet werden |
| `source/src/gfx.js` | Shader für Erde, Gänge und Himmel, beleuchtete Sprites mit Schatten, Nachbearbeitung des Bildes |
| `source/src/audio.js` | Zur Laufzeit erzeugter Ton |
| `source/src/main.js` | Kamera, Bedienung, Pause, Speichern, Ausblenden der Anzeigen, Anzeige mit den Zahlen |
| `source/template.html` | Die Seite um die Simulation und ihre Stile |
| `manifest.webmanifest`, `sw.js`, `icon-*.png` | Dateien für die Installation als App |
