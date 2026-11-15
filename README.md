# SoleSense web

The website for [SoleSense](https://github.com/mustafamoe/sole-sense), an
open-hardware handheld instrument for the diabetic foot-sensation test. It
presses the sole with a force it can read, so every touch becomes a number on
record. A BatLabs project.

Live at <https://samhnoah.github.io/solesense-web/>.

## What's on the page

| Chapter | What it does |
| --- | --- |
| 01 Hero | Live 3D model of the current device, built from the project's own CAD. |
| 02 The problem | Diabetes numbers with sources, and a sole drawn as points that go dark from the toes as you scroll. Hover to "touch" it. |
| 03 The test | A scroll-driven 10 g monofilament: load rises, the filament buckles, and the force varies between filaments. |
| 04 Inside | Pinned 3D tour: two heads, lid off, the printed spring, magnet and Hall sensor, the handle electronics. Callouts track real parts. |
| 05 Press it | Hold the button or Space. The carriage moves, the flexure beams bend in a shader, and force, travel, field and Hall output update from the hardware repository's own sizing equations. The device's OLED shows the reading too. |
| 06 Foot guide | The clear acrylic template from the real laser-cut SVGs, with all five sizes. |
| 07 Status | What is done, what is next, the captioned 7:49 assembly video, and the prototype notice. |
| 08 Try the test | The 10 g screening demo: three or ten spots, either foot, simulated device or a SoleSense over Bluetooth. |

`test.html` is the same test in full-screen kiosk mode for exhibitions, with a QR
code and automatic reset (an abandoned test clears after 2 minutes, results after
60 seconds). Nothing is stored.

SoleSense is an experimental prototype, not a medical device. The press lab uses
ideal-beam estimates (E = 2500 MPa and N35 magnets assumed) and draws travel at
×2; 1, 10 and 75 gf are design targets.

## Run it

```sh
npm install
npm run dev      # local development
npm run build    # production build in dist/
```

Vite, TypeScript, Three.js, GSAP and Lenis. No framework. The build uses relative
paths, so `dist/` works from any folder or host. The 3D code loads in its own
chunk; without WebGL the page falls back to the CAD renders in `public/img/`.

## Publish on GitHub Pages

`.github/workflows/deploy.yml` builds and publishes on every push to `main`.

## The 3D model

`public/models/solesense.glb` (73 parts, 520 KB) is generated from the
assembly-positioned meshes in the hardware repository:

```sh
# with sole-sense checked out next to this repository
npm run model
```

`scripts/build-model.py` lists which parts go in, which group each belongs to
(what moves together on the page) and which material it gets. Alternative
cassettes, coupons, the assembly bridge and the earlier spring-contact concept
are left out. Rebuild the model whenever the CAD changes.

## Where things are

| Path | Contents |
| --- | --- |
| `index.html` | All page copy and structure |
| `src/main.ts` | Preloader, smooth scroll, reveals and the scroll-to-3D mapping |
| `src/scene/device.ts` | Three.js scene: materials, explode groups, flexure shader, OLED, callouts |
| `src/scene/poses.ts` | Camera framing and explode amounts for each step, and callout anchors |
| `src/lib/press.ts` | Spring, field and Hall-output equations |
| `src/sections/` | Sensation field, buckling filament, foot guide, press lab |
| `src/test/` | The 10 g test, the simulated device and Bluetooth |
| `src/data/foot.ts` | Foot-guide outlines and windows, generated from the laser-cut SVGs |
| `docs/BLE_PROTOCOL.md` | The Bluetooth contract the firmware has to meet |
| `src/styles/main.css` | Colours, type and every component |

Fonts: VG5000 by Justin Bihan / Velvetyne and Jost, both SIL OFL 1.1 (licences in
`public/fonts/`). Statistics are cited on the page next to each number.
