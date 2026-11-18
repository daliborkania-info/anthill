# Anthill

English · [Česky](README.cs.md) · [Deutsch](README.de.md)

A living cross-section of an ant colony in the browser. The soil, the tunnels, the ants, the plants, the sky and the sound are all computed by code. There is not a single image or recording. The whole thing fits into one HTML file of 64 kB (28 kB gzipped).

**[Open the live version](https://daliborkania-info.github.io/anthill/)**

Inspired by [Abyssal Garden](https://github.com/Noniv/abyssal-garden), an underwater world in a single 97 kB file.

## Running it

Open [daliborkania-info.github.io/anthill](https://daliborkania-info.github.io/anthill/) in a browser (Chrome, Edge, Firefox, Safari; WebGL 2 is all it needs). Nothing to install.

[index.packed.html](https://daliborkania-info.github.io/anthill/index.packed.html) is the same program with the script compressed. It unpacks itself in the browser and weighs 39 kB.

The world is defined by a seed. [The address with `#5` at the end](https://daliborkania-info.github.io/anthill/#5) generates the same landscape every time, without a number you get a random one.

The page is one self-contained file, so a downloaded `index.html` also runs straight from disk, offline.

## Controls

| Action | How |
|---|---|
| Pan | drag with the mouse or a finger |
| Zoom | mouse wheel, two fingers, keys `+` and `-` |
| Follow an ant | click an ant or the queen, `Esc` stops following |
| Drop the colony a crumb | click the air above the ground |
| Speed of time | `1` to `4` (1×, 4×, 16×, 48×) |
| Full pause | Space or the Pause button |
| Chamber labels, building plan, sound | `L`, `P`, `M` |
| Language, new world | buttons in the bottom bar |

The stats panel and the button bar hide after 15 seconds without mouse movement, touch or a key press, and the cursor hides with them. Move the mouse and they are back.

## Pause, saving and language

Pause stops everything. The render loop does not run, the audio engine is suspended and the page puts no load on the CPU or the GPU. Panning, zooming or resizing the window while paused redraws a single frame.

The state of the colony is saved in the browser (IndexedDB) every 20 seconds, on pause, and when the window is closed or hidden. The next time you open the page it offers Continue, and the world picks up exactly where it stopped, including the view and the ant you were following. It stays frozen until you click Continue. Time that passed while the page was closed is not caught up. The New world button deletes the saved state and starts over. A world opened with a seed in the address (`#5`) has its own save slot, so it does not overwrite the main colony.

The saved state belongs to the address the page runs from. A copy opened from another address or from a file on disk has a colony of its own.

The interface is in Czech, English and German. The language follows the system setting (Czech for Czech and Slovak, German for German, English otherwise) and a button in the bar cycles through the three. The choice is remembered, and so are speed, sound and labels.

## Installing it as an app (PWA)

Open [the live page](https://daliborkania-info.github.io/anthill/) in Chrome or Edge and choose Install in the address bar. On a phone, use Add to Home screen in the browser menu. The service worker keeps a copy of the page, so the installed app starts without a connection too, and it picks up the current version whenever it is online.

The installed app takes its name from the language that is active when you install it: Mraveniště, Anthill or Ameisenhügel.

The files that make this possible sit next to `index.html`: one manifest per language, `sw.js` and the icons.

## What goes on in there

- The colony starts with a shaft, the queen's chamber and a pantry. It plans further chambers on its own according to what it lacks (nurseries, pantries, resting rooms), and the workers dig them out cell by cell.
- They carry the excavated soil outside and dump it around the entrance, so a mound with a crater grows there.
- Foragers search the surface for seeds, berries and dead beetles. On the way home they lay a scent trail that others follow.
- The queen lays eggs as long as the nurses feed her. The nurses move the brood to the nurseries and feed the larvae, and pale young workers hatch from the pupae.
- Day and night alternate (one day takes 10 minutes at 1× speed). At night most foragers stay home.

## How the picture is made

- The soil is one shader. It layers soil horizons, clods and grains at three scales, pebbles, stones and roots, and works out a slope for every surface, so the lamp from the upper left lights it as a relief. Fine grains appear only as you zoom in.
- Tunnels and chambers are drawn as carved troughs with a shadow under the ceiling and daylight that fades with distance from the entrance.
- The ants, the queen, the brood, the food and the plants are modelled at start-up from ellipsoids and capsules into a texture with colour and a normal map. When drawn they receive the same light as their surroundings and cast a soft shadow.
- Above ground the sun or the moon shines depending on the time of day, and the sky has clouds, stars, hills and a tree line on the horizon.
- The picture is computed in high dynamic range and finishes with bloom, filmic tone mapping, a vignette and grain. When the computer cannot keep up, the resolution drops by itself.

## Publishing to GitHub Pages

The repository contains a ready workflow, `.github/workflows/pages.yml`. It builds the page from source and deploys it to GitHub Pages. It is started by hand, on GitHub in the Actions tab (Deploy to GitHub Pages, Run workflow), or from the command line:

```bash
gh workflow run pages.yml
```

The page then runs at [daliborkania-info.github.io/anthill](https://daliborkania-info.github.io/anthill/).

## Editing and building

The readable source is in the `source` folder. Building needs Node.js 18 or newer:

```bash
cd source
npm install
npm run build
```

`npm run build:readable` writes an unminified version for debugging, `npm run build:packed` also produces `index.packed.html`.

The icons are made from `source/icon.svg` with `rsvg-convert` (sizes 192 and 512; `icon-maskable.png` is the same drawing without rounded corners).

Comments in the source code are in Czech.

| File | What is in it |
|---|---|
| `source/src/sim.js` | The world, nest planning, pathfinding and colony behaviour, saving and restoring state. Runs in Node too. |
| `source/src/prefs.js` | Remembered settings and the texts in all three languages |
| `source/src/store.js` | The saved world in IndexedDB; loads it at start-up or creates a new one |
| `source/src/bake.js` | Models of ants, brood, food and plants, computed into a texture at start-up |
| `source/src/gfx.js` | The shader for soil, tunnels and sky, lit sprites with shadows, post-processing |
| `source/src/audio.js` | Sound synthesised at run time |
| `source/src/main.js` | Camera, controls, pause, saving, hiding the panels, the stats panel |
| `source/template.html` | The page around the simulation and its styles |
| `manifest*.webmanifest`, `sw.js`, `icon-*.png` | Files for installing it as an app |
