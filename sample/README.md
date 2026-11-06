# `sample/`: the demo's source

The Astryx Nonsense app as it was bundled: React Native 0.88 and TypeScript, three tabs (`src/bubbles`, `src/deck`,
`src/disco`), words in `src/strings.ts`.

It imports an unreleased exploration library (`@astryx-exploration/react-native` and its navigation and platform
packages, derived from the MIT-licensed [Astryx](https://github.com/meta/astryx)), which is not published. The
`file:` dependencies in `package.json` and the paths in `tsconfig.json`/`metro.config.js` point at where that library
lives in its own project, so this folder does not install or build on its own; it is here to read. The prebuilt
bundles in `../docs/ios` and `../docs/android` contain everything the app needs.

- `index.js`: the entry (`AppRegistry` name `PreviewNonsense`).
- `index.pages.js` and `metro.pages.config.js`: the entry and Metro config used for the hosted bundles (images are
  read from next to an https bundle, since a static file host has no Metro asset server).
- `scripts/qr.mjs`: the small QR encoder used for the landing page's codes (`../tools/make-qr.mjs`).
