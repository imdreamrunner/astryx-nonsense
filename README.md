# Astryx Instant Preview

**Play page:** https://imdreamrunner.github.io/astryx-nonsense/

Three playful, visual tabs, made to be opened in the Astryx app's Preview: scan the code on the page
with the app (**Apps → Scan**).

| Tab | What it does |
|---|---|
| **Bubbles** | Glass bubbles with silly labels ("Pet a cloud", "Argue with toast", "Be a lamp"…) over a drifting aurora. Drag one: it squashes and bumps the others. Tap: it pops. |
| **Deck** | A 3D stack of absurd fortunes. Swipe right to accept, left to skip, Shuffle to riffle. |
| **Disco** | Astryx components under sweeping spotlights. DISCO moves the whole app to the next Astryx theme; Party mode does it on the beat. |

## What this is (and isn't)

- A **playful exploration demo**. It is **not** an Astryx product, not an Astryx release, and not part of Astryx.
- It makes **no claim of native or platform support** for Astryx. It runs inside the Astryx app's Preview host;
  how it behaves there says nothing about Astryx on any platform or device.
- It is built on an unreleased exploration library that derives from the open-source
  [Astryx](https://github.com/meta/astryx) design system (MIT licensed). That library is not published; only the
  parts this demo uses are included, compiled into the prebuilt bundles below. See the Astryx notice at the end.

## What's in the repo

| Path | Contents |
|---|---|
| `docs/` | The GitHub Pages site: the landing page, screenshots and QR codes. |
| `docs/ios/index.js`, `docs/ios/assets/` | Prebuilt production bundle for iOS (`dev=false`, minified), with its image assets next to it. |
| `docs/android/index.js`, `docs/android/drawable-*/`, `docs/android/raw/` | The same for Android, with assets in the layout `react-native bundle` writes. |
| `sample/` | The demo's source (React Native 0.88, TypeScript). It depends on the unreleased exploration library, so it does not install or build on its own; it is here so you can read it. |
| `tools/make-qr.mjs` | Regenerates the QR codes in `docs/qr/`. |

Bundle URLs:

- iOS: https://imdreamrunner.github.io/astryx-nonsense/ios/index.js
- Android: https://imdreamrunner.github.io/astryx-nonsense/android/index.js

The Preview link in the main QR code is
`astryxneutral://preview?url=<iOS bundle URL>&module=PreviewNonsense&name=Astryx%20Instant%20Preview`. Opening hosted
(https) bundles needs a version of the Astryx app that allows them (version 14 or later); older versions only open
projects served from your local network.

The bundles were exported with `react-native bundle --dev false --minify true` from `sample/index.pages.js`, which is
`sample/index.js` plus one rule: when the bundle is loaded from an https URL, images are read from next to the bundle
(a plain static file host has no Metro asset server).

## License

No license has been chosen for the demo's own code yet. The Astryx-derived code compiled into the bundles is used
under the MIT License below. The bundles also contain open-source npm packages (React, React Native, React
Navigation and others) under their own licenses; their notices are in
[`docs/THIRD-PARTY-NOTICES.txt`](docs/THIRD-PARTY-NOTICES.txt).

### Astryx notice

```
MIT License

Copyright (c) 2026 Meta Platforms, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
