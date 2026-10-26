// Shared cartoon look: toon materials, ink outlines and little canvas textures.
import * as THREE from 'three';

const gradientMap = (() => {
  const data = new Uint8Array([90, 170, 255]);
  const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
})();

const matCache = new Map();

export function toon(color, opts = {}) {
  const key = `${color}|${JSON.stringify(opts)}`;
  if (!opts.map && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap, ...opts });
  if (!opts.map) matCache.set(key, m);
  return m;
}

const outlineMat = new THREE.MeshBasicMaterial({ color: 0x1b1020, side: THREE.BackSide });

// Inverted-hull outline: a slightly bigger black copy drawn from the inside.
export function addOutline(mesh, thickness = 0.035) {
  const geo = mesh.geometry;
  if (!geo.boundingSphere) geo.computeBoundingSphere();
  const r = geo.boundingSphere.radius || 1;
  const o = new THREE.Mesh(geo, outlineMat);
  o.scale.setScalar(1 + thickness / r);
  o.castShadow = false;
  o.receiveShadow = false;
  o.userData.isOutline = true;
  mesh.add(o);
  return o;
}

// Build a mesh, add a shadow + optional outline in one call.
export function part(geo, mat, { outline = 0.03, shadow = true, pos, rot, scale } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow;
  m.receiveShadow = true;
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  if (scale) m.scale.set(...scale);
  if (outline) addOutline(m, outline);
  return m;
}

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Round badge with a letter, like the emblem on a cap.
export function emblemTexture(letter, color) {
  return canvasTexture(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.beginPath(); g.arc(w / 2, h / 2, w * 0.47, 0, Math.PI * 2);
    g.fillStyle = '#ffffff'; g.fill();
    g.lineWidth = 8; g.strokeStyle = '#1b1020'; g.stroke();
    g.fillStyle = color;
    g.font = `900 ${w * 0.62}px "Arial Black", Arial, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(letter, w / 2, h / 2 + w * 0.04);
  });
}

export function questionBlockTexture(used = false) {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = used ? '#9a6b3c' : '#f7b52c';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = used ? '#5a3a1c' : '#b5641a';
    g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = used ? '#5a3a1c' : '#b5641a';
    for (const [x, y] of [[16, 16], [w - 16, 16], [16, h - 16], [w - 16, h - 16]]) {
      g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
    }
    if (!used) {
      g.font = '900 86px "Arial Black", Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#7a3b0c'; g.fillText('?', w / 2 + 5, h / 2 + 9);
      g.fillStyle = '#ffffff'; g.fillText('?', w / 2, h / 2 + 4);
    }
  });
}

export function brickTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#c4622d'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#3d1c0c'; g.lineWidth = 5;
    const rows = 4, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      g.beginPath(); g.moveTo(0, r * rh); g.lineTo(w, r * rh); g.stroke();
      const off = r % 2 ? w / 4 : 0;
      for (let x = off; x <= w; x += w / 2) {
        g.beginPath(); g.moveTo(x, r * rh); g.lineTo(x, (r + 1) * rh); g.stroke();
      }
    }
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, w, 6);
  });
}

export function grassTexture() {
  const tex = canvasTexture(256, 256, (g, w, h) => {
    const s = w / 8;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      g.fillStyle = (x + y) % 2 ? '#5ccf3a' : '#4fbf31';
      g.fillRect(x * s, y * s, s, s);
    }
    for (let i = 0; i < 260; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,60,0,0.08)';
      g.fillRect(Math.random() * w, Math.random() * h, 3, 6);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function dirtTexture() {
  const tex = canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = '#b8692e'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = Math.random() < 0.5 ? '#8f4d1f' : '#d48a4a';
      g.beginPath();
      g.ellipse(Math.random() * w, 20 + Math.random() * (h - 20), 6 + Math.random() * 6, 4 + Math.random() * 3, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#4fbf31'; g.fillRect(0, 0, w, 14);
    g.fillStyle = '#3c9a24';
    for (let x = 0; x < w; x += 16) { g.beginPath(); g.arc(x + 8, 14, 8, 0, Math.PI); g.fill(); }
  });
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function pipeTexture() {
  const tex = canvasTexture(256, 8, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0.0, '#0c7a1e');
    grd.addColorStop(0.15, '#21b33b');
    grd.addColorStop(0.28, '#9df27a');
    grd.addColorStop(0.36, '#3fd257');
    grd.addColorStop(0.7, '#15912a');
    grd.addColorStop(1.0, '#0c7a1e');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}
