#!/usr/bin/env node
/**
 * Writes the landing page's QR codes (docs/qr/*.png) with the sample's dependency-free encoder.
 *
 *   node tools/make-qr.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {encodeQr, renderPng} from '../sample/scripts/qr.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = 'https://imdreamrunner.github.io/astryx-nonsense';
const preview = platform =>
  `astryxneutral://preview?url=${encodeURIComponent(`${site}/${platform}/index.js`)}` +
  `&module=PreviewNonsense&name=${encodeURIComponent('Astryx Instant Preview')}`;

const codes = {
  'preview-ios.png': preview('ios'),
  'preview-android.png': preview('android'),
  'site.png': `${site}/`,
};
fs.mkdirSync(path.join(root, 'docs/qr'), {recursive: true});
for (const [file, text] of Object.entries(codes)) {
  fs.writeFileSync(path.join(root, 'docs/qr', file), renderPng(encodeQr(text, 'M'), {scale: 12, quiet: 4}));
  console.log(`${file}  ${text}`);
}
