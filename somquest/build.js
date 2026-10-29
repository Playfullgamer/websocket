// Bundles src/*.js into one self-contained script, then writes the userscript and extension copies.
// Usage: node build.js
const fs = require('fs');
const path = require('path');

const root = __dirname;
const pkg = { version: '1.0.0' };
const src = fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js')).sort();
const sfxDir = path.join(root, 'assets', 'sfx');
const sfxData = Object.fromEntries(fs.readdirSync(sfxDir).filter(f => f.endsWith('.ogg')).sort()
  .map(f => [f.replace(/\.ogg$/, ''), fs.readFileSync(path.join(sfxDir, f)).toString('base64')]));
const sfxChunk = `// ── sound effects (CC0, see extension/music/CREDITS.txt) ──\nconst SFX_DATA = ${JSON.stringify(sfxData)};\n`;
const body = sfxChunk + src.map(f => `// ── ${f} ──\n` + fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n');
const bundle = `/*! SomQuest v${pkg.version} — Het Laatste Rapport. A fan-made story game mod for Somtoday. */\n(function () {\n'use strict';\n${body}\n})();\n`;

const header = `// ==UserScript==
// @name         SomQuest — Het Laatste Rapport
// @namespace    https://github.com/Playfullgamer/websocket
// @version      ${pkg.version}
// @description  Een complete verhaalgame in Somtoday: 5 hoofdstukken, bazen, lore, geluid en effecten. Klik op de SomQuest-knop of druk op Alt+Q.
// @match        https://*.somtoday.nl/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

`;

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'somquest.js'), bundle);
fs.writeFileSync(path.join(root, 'dist', 'somquest.user.js'), header + bundle);
fs.writeFileSync(path.join(root, 'extension', 'somquest.js'), bundle);

const manifest = {
  manifest_version: 3,
  name: 'SomQuest — Het Laatste Rapport',
  version: pkg.version,
  description: 'Een complete verhaalgame-mod voor Somtoday: 5 hoofdstukken, bazen, lore, geluid en effecten.',
  homepage_url: 'https://github.com/Playfullgamer/websocket',
  icons: { 16: 'icon16.png', 48: 'icon48.png', 128: 'icon128.png' },
  content_scripts: [{ matches: ['https://*.somtoday.nl/*'], js: ['somquest.js'], run_at: 'document_idle' }],
  web_accessible_resources: [{ resources: ['music/*.ogg'], matches: ['https://*.somtoday.nl/*'] }],
};
fs.writeFileSync(path.join(root, 'extension', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

// Zips: store/SomQuest-webstore.zip (manifest at the root, for the Chrome Web Store) and
// ../SomQuest-extensie.zip (a SomQuest/ folder, for "Load unpacked"). Skipped when `zip` isn't installed.
try {
  const { execFileSync } = require('child_process');
  const os = require('os');
  const ext = path.join(root, 'extension');
  const storeZip = path.join(root, 'store', 'SomQuest-webstore.zip');
  const unpackedZip = path.join(root, '..', 'SomQuest-extensie.zip');
  fs.rmSync(storeZip, { force: true });
  fs.rmSync(unpackedZip, { force: true });
  execFileSync('zip', ['-q', '-r', '-X', storeZip, '.'], { cwd: ext });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'somquest-'));
  fs.cpSync(ext, path.join(tmp, 'SomQuest'), { recursive: true });
  execFileSync('zip', ['-q', '-r', '-X', unpackedZip, 'SomQuest'], { cwd: tmp });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('zipped store/SomQuest-webstore.zip and ../SomQuest-extensie.zip');
} catch (e) {
  console.log('skipped zips (`zip` not available)');
}

console.log(`built ${src.length} files → dist/somquest.js (${(bundle.length / 1024).toFixed(1)} KB), dist/somquest.user.js, extension/`);
