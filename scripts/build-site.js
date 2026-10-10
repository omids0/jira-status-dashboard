// Builds the static site that GitHub Pages serves: the bookmarklet bundle
// (dashboard.js) and the install page (index.html).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'site');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

await build({
  entryPoints: [path.join(root, 'src/browser/main.js')],
  outfile: path.join(out, 'dashboard.js'),
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  platform: 'browser',
  legalComments: 'none'
});

fs.copyFileSync(path.join(root, 'site-src/index.html'), path.join(out, 'index.html'));
fs.writeFileSync(path.join(out, '.nojekyll'), '');

const kb = (fs.statSync(path.join(out, 'dashboard.js')).size / 1024).toFixed(1);
console.log(`site/ ready — dashboard.js ${kb} KB`);
