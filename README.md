# SoleSense web

Website and exhibition demo for [SoleSense](https://github.com/mustafamoe/sole-sense),
an open prototype for testing what the sole of the foot can feel.

- **Home page** (`/`): what the device is, how it works, and where the project stands.
- **Demo** (`/#/app`): a 10 gram touch test on a foot map, with a three-spot or
  ten-spot map. It runs with a simulated device on any phone or computer, and can
  read a real device over Bluetooth once firmware exists (see `docs/BLE_PROTOCOL.md`).
- English and Arabic (right-to-left), light and dark mode.
- The demo stores nothing. Results clear after 60 seconds; an abandoned test
  resets after 2 minutes.

SoleSense is an experimental prototype, not a medical device. The Arabic copy and
the medical wording are first drafts and need review by a clinician.

## Run it

```sh
npm install
npm run dev      # local development
npm run build    # production build in dist/
```

Built with Vue 3, Vite and TypeScript. The build uses relative paths and hash
routing, so `dist/` works from any folder or host.

## Publish on GitHub Pages

`.github/workflows/deploy.yml` builds and publishes on every push to `main`.
One-time setup: in the repository, open Settings > Pages and set Source to
"GitHub Actions".

## Where things are

| Path | Contents |
| --- | --- |
| `src/pages/Home.vue` | Home page |
| `src/pages/Demo.vue` | The test: setup, pressing, results, kiosk reset |
| `src/lib/messages.en.ts`, `messages.ar.ts` | All text, in both languages |
| `src/lib/sites.ts` | Test spots for the two maps |
| `src/lib/device.ts` | Simulated device and Bluetooth connection |
| `src/styles/base.css` | Colours, type and spacing tokens for both themes |
| `public/img/` | Renders cropped from the hardware repository |

The foot outline in `src/lib/footPath.ts` comes from the hardware repository's
clear foot guide. Spot positions are for display and are not validated
anatomical coordinates.
