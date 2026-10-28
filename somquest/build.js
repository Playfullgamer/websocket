// Bundles src/*.js into one self-contained script, then writes the userscript and extension copies.
// Usage: node build.js
const fs = require('fs');
const path = require('path');

const root = __dirname;
const pkg = { version: '1.0.0' };
const src = fs.readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.js')).sort();
const body = src.map(f => `// ── ${f} ──\n` + fs.readFileSync(path.join(root, 'src', f), 'utf8')).join('\n');
const bundle = `/*! SomQuest v${pkg.version} — Het Laatste Rapport. A fan-made story game mod for Somtoday. */\n(function () {\n'use strict';\n${body}\n})();\n`;

const header = `// ==UserScript==
// @name         SomQuest — Het Laatste Rapport
// @namespace    https://github.com/Playfullgamer/websocket
// @version      ${pkg.version}
// @description  A full story game inside Somtoday: 5 chapters, bosses, lore, sound and effects. Click the SomQuest button or press Alt+Q.
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
  description: 'A full story game mod for Somtoday: 5 chapters, bosses, lore, sound and effects.',
  icons: { 16: 'icon16.png', 48: 'icon48.png', 128: 'icon128.png' },
  content_scripts: [{ matches: ['https://*.somtoday.nl/*'], js: ['somquest.js'], run_at: 'document_idle' }],
};
fs.writeFileSync(path.join(root, 'extension', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log(`built ${src.length} files → dist/somquest.js (${(bundle.length / 1024).toFixed(1)} KB), dist/somquest.user.js, extension/`);
