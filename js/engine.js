'use strict';
/* =========================================================
   ENGINE  —  Mathe, WebGL-Renderer mit Texturatlas,
              Mesh-Builder, Sprite-Sheets, Musik-Engine
   ========================================================= */

/* ---------------- Utils ---------------- */
const U = {
  clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  smooth: t => t * t * (3 - 2 * t),
  dist: (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz),
  dist2: (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; },
  angDiff(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; },
  angLerp(a, b, t) { return a + U.angDiff(a, b) * t; }
};
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- Matrix 4x4 (column major) ---------------- */
const M4 = {
  create() { const o = new Float32Array(16); o[0] = o[5] = o[10] = o[15] = 1; return o; },
  identity(o) { o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o; },
  perspective(o, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    o[0] = f / aspect; o[1] = 0; o[2] = 0; o[3] = 0;
    o[4] = 0; o[5] = f; o[6] = 0; o[7] = 0;
    o[8] = 0; o[9] = 0; o[10] = (far + near) * nf; o[11] = -1;
    o[12] = 0; o[13] = 0; o[14] = 2 * far * near * nf; o[15] = 0;
    return o;
  },
  multiply(o, a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (let i = 0; i < 4; i++) {
      const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      o[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      o[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      o[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      o[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    }
    return o;
  },
  lookAt(o, ex, ey, ez, cx, cy, cz, ux, uy, uz) {
    let zx = ex - cx, zy = ey - cy, zz = ez - cz;
    let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    let xx = uy * zz - uz * zy, xy = uz * zx - ux * zz, xz = ux * zy - uy * zx;
    l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
    o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
    o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * ex + xy * ey + xz * ez);
    o[13] = -(yx * ex + yy * ey + yz * ez);
    o[14] = -(zx * ex + zy * ey + zz * ez);
    o[15] = 1;
    return o;
  },
  /* out = T(pos) * Ry * Rx * Rz * S(scale) */
  compose(o, px, py, pz, rx, ry, rz, sx, sy, sz) {
    const cx = Math.cos(rx), sxr = Math.sin(rx);
    const cy = Math.cos(ry), syr = Math.sin(ry);
    const cz = Math.cos(rz), szr = Math.sin(rz);
    const m00 = cy * cz + syr * sxr * szr, m01 = cx * szr, m02 = -syr * cz + cy * sxr * szr;
    const m10 = -cy * szr + syr * sxr * cz, m11 = cx * cz, m12 = syr * szr + cy * sxr * cz;
    const m20 = syr * cx, m21 = -sxr, m22 = cy * cx;
    o[0] = m00 * sx; o[1] = m01 * sx; o[2] = m02 * sx; o[3] = 0;
    o[4] = m10 * sy; o[5] = m11 * sy; o[6] = m12 * sy; o[7] = 0;
    o[8] = m20 * sz; o[9] = m21 * sz; o[10] = m22 * sz; o[11] = 0;
    o[12] = px; o[13] = py; o[14] = pz; o[15] = 1;
    return o;
  },
  /* Billboard: Quad zur Kamera ausgerichtet (Basis aus der View-Matrix) */
  billboard(o, view, x, y, z, w, h, roll) {
    let rx = view[0], ry = view[4], rz = view[8];
    let ux = view[1], uy = view[5], uz = view[9];
    if (roll) {
      const c = Math.cos(roll), s = Math.sin(roll);
      const nx = rx * c + ux * s, ny = ry * c + uy * s, nz = rz * c + uz * s;
      ux = ux * c - rx * s; uy = uy * c - ry * s; uz = uz * c - rz * s;
      rx = nx; ry = ny; rz = nz;
    }
    o[0] = rx * w; o[1] = ry * w; o[2] = rz * w; o[3] = 0;
    o[4] = ux * h; o[5] = uy * h; o[6] = uz * h; o[7] = 0;
    o[8] = view[2]; o[9] = view[6]; o[10] = view[10]; o[11] = 0;
    o[12] = x; o[13] = y; o[14] = z; o[15] = 1;
    return o;
  }
};

function normalFromMat4(out, a) {
  const a00 = a[0], a01 = a[1], a02 = a[2], a10 = a[4], a11 = a[5], a12 = a[6], a20 = a[8], a21 = a[9], a22 = a[10];
  const b01 = a22 * a11 - a12 * a21, b11 = -a22 * a10 + a12 * a20, b21 = a21 * a10 - a11 * a20;
  let det = a00 * b01 + a01 * b11 + a02 * b21;
  if (!det) { out[0] = a00; out[1] = a01; out[2] = a02; out[3] = a10; out[4] = a11; out[5] = a12; out[6] = a20; out[7] = a21; out[8] = a22; return out; }
  det = 1 / det;
  out[0] = b01 * det; out[1] = (-a22 * a01 + a02 * a21) * det; out[2] = (a12 * a01 - a02 * a11) * det;
  out[3] = b11 * det; out[4] = (a22 * a00 - a02 * a20) * det; out[5] = (-a12 * a00 + a02 * a10) * det;
  out[6] = b21 * det; out[7] = (-a21 * a00 + a01 * a20) * det; out[8] = (a11 * a00 - a01 * a10) * det;
  return out;
}

/* =========================================================
   TEXTURATLAS  (4x4 Kacheln, prozedural gezeichnet)
   ========================================================= */
const TILE = {
  grass: 0, grassFlower: 1, dirt: 2, sand: 3,
  rock: 4, brick: 5, plank: 6, leaf: 7,
  water: 8, dunFloor: 9, dunWall: 10, shingle: 11,
  plaster: 12, metal: 13, blank: 14, gravel: 15
};
const ATLAS_N = 4, TILE_PX = 128, TILE_PAD = 0.03;

function tileUV(tile, u, v, out) {
  const cx = tile % ATLAS_N, cy = Math.floor(tile / ATLAS_N), s = 1 / ATLAS_N;
  out[0] = (cx + TILE_PAD + u * (1 - 2 * TILE_PAD)) * s;
  out[1] = (cy + TILE_PAD + v * (1 - 2 * TILE_PAD)) * s;
  return out;
}

function buildAtlasCanvas() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = ATLAS_N * TILE_PX;
  const x = cv.getContext('2d');
  const rnd = mulberry32(4242);
  const P = TILE_PX;
  const cell = (t) => ({ ox: (t % ATLAS_N) * P, oy: Math.floor(t / ATLAS_N) * P });
  const fill = (t, c) => { const { ox, oy } = cell(t); x.fillStyle = c; x.fillRect(ox, oy, P, P); };
  const speck = (t, n, cols, smin, smax) => {
    const { ox, oy } = cell(t);
    for (let i = 0; i < n; i++) {
      x.fillStyle = cols[Math.floor(rnd() * cols.length)];
      const s = smin + rnd() * (smax - smin);
      x.fillRect(ox + rnd() * (P - s), oy + rnd() * (P - s), s, s);
    }
  };
  const stroke = (t, n, col, w, len) => {
    const { ox, oy } = cell(t);
    x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const sx = ox + rnd() * P, sy = oy + rnd() * P;
      const a = -Math.PI / 2 + (rnd() - 0.5) * 0.9, l = len * (0.5 + rnd());
      x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l); x.stroke();
    }
  };

  // Gras
  fill(TILE.grass, '#4f8c3a');
  speck(TILE.grass, 260, ['#589a41', '#457f33', '#63a84b', '#3f7530'], 4, 13);
  stroke(TILE.grass, 90, '#68b350', 2, 9);
  // Blumenwiese
  fill(TILE.grassFlower, '#4a8637');
  speck(TILE.grassFlower, 220, ['#54973e', '#3f7530', '#5da345'], 4, 12);
  stroke(TILE.grassFlower, 60, '#66ae4c', 2, 9);
  {
    const { ox, oy } = cell(TILE.grassFlower);
    for (let i = 0; i < 12; i++) {
      const fx = ox + 10 + rnd() * (P - 20), fy = oy + 10 + rnd() * (P - 20);
      x.fillStyle = ['#f2e05a', '#f0f0f0', '#e88bc0', '#f0a93c'][Math.floor(rnd() * 4)];
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2;
        x.fillRect(fx + Math.cos(a) * 4 - 2, fy + Math.sin(a) * 4 - 2, 4, 4);
      }
      x.fillStyle = '#7a5c1c'; x.fillRect(fx - 1.5, fy - 1.5, 3, 3);
    }
  }
  // Erde / Weg
  fill(TILE.dirt, '#8a6a45');
  speck(TILE.dirt, 300, ['#7d5f3d', '#96754e', '#6d5334', '#a08059'], 4, 14);
  speck(TILE.dirt, 26, ['#b0a08a', '#5f4c33'], 5, 9);
  // Sand
  fill(TILE.sand, '#d8c98a');
  speck(TILE.sand, 320, ['#cfbe7c', '#e2d69a', '#c4b473'], 3, 11);
  // Fels
  fill(TILE.rock, '#767683');
  speck(TILE.rock, 200, ['#6a6a76', '#83838f', '#5d5d68', '#8e8e9a'], 8, 26);
  // Steinziegel
  fill(TILE.brick, '#8a8a95');
  {
    const { ox, oy } = cell(TILE.brick);
    x.strokeStyle = '#5f5f6b'; x.lineWidth = 3;
    for (let r = 0; r < 4; r++) {
      const yy = oy + r * P / 4;
      x.beginPath(); x.moveTo(ox, yy); x.lineTo(ox + P, yy); x.stroke();
      const off = (r % 2) * P / 4;
      for (let c = 0; c < 2; c++) {
        const xx = ox + off + c * P / 2;
        x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx, yy + P / 4); x.stroke();
      }
    }
    speck(TILE.brick, 120, ['#7e7e8a', '#95959f'], 4, 12);
  }
  // Holzplanken
  fill(TILE.plank, '#8a5f36');
  {
    const { ox, oy } = cell(TILE.plank);
    for (let r = 0; r < 4; r++) {
      x.fillStyle = ['#8a5f36', '#7d5530', '#96693c', '#835a33'][r % 4];
      x.fillRect(ox, oy + r * P / 4, P, P / 4 - 2);
      x.strokeStyle = '#5d3d21'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(ox, oy + r * P / 4 + P / 4 - 1); x.lineTo(ox + P, oy + r * P / 4 + P / 4 - 1); x.stroke();
    }
    stroke(TILE.plank, 26, '#6f4a28', 1.5, 16);
  }
  // Laub
  fill(TILE.leaf, '#2f6b2c');
  speck(TILE.leaf, 240, ['#358033', '#276024', '#3f8f39', '#1f5220'], 7, 20);
  // Wasser
  fill(TILE.water, '#2f6fa8');
  {
    const { ox, oy } = cell(TILE.water);
    x.strokeStyle = '#4a91c4'; x.lineWidth = 3;
    for (let i = 0; i < 14; i++) {
      const yy = oy + rnd() * P;
      x.beginPath();
      for (let k = 0; k <= 8; k++) x.lineTo(ox + k * P / 8, yy + Math.sin(k * 0.9 + i) * 4);
      x.stroke();
    }
    speck(TILE.water, 60, ['#5aa3d6', '#27608f'], 3, 8);
  }
  // Dungeonboden
  fill(TILE.dunFloor, '#4a4752');
  {
    const { ox, oy } = cell(TILE.dunFloor);
    x.strokeStyle = '#35323d'; x.lineWidth = 4;
    x.strokeRect(ox + 2, oy + 2, P - 4, P - 4);
    x.beginPath(); x.moveTo(ox + P / 2, oy); x.lineTo(ox + P / 2, oy + P);
    x.moveTo(ox, oy + P / 2); x.lineTo(ox + P, oy + P / 2); x.stroke();
    speck(TILE.dunFloor, 150, ['#524f5b', '#413e49', '#5a5764'], 4, 12);
  }
  // Dungeonwand
  fill(TILE.dunWall, '#565463');
  {
    const { ox, oy } = cell(TILE.dunWall);
    x.strokeStyle = '#3a3844'; x.lineWidth = 3;
    for (let r = 0; r < 3; r++) {
      const yy = oy + r * P / 3;
      x.beginPath(); x.moveTo(ox, yy); x.lineTo(ox + P, yy); x.stroke();
      const off = (r % 2) * P / 6;
      for (let c = 0; c < 3; c++) {
        const xx = ox + off + c * P / 3;
        x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx, yy + P / 3); x.stroke();
      }
    }
    speck(TILE.dunWall, 110, ['#4e4c59', '#615f6e'], 5, 14);
  }
  // Dachschindeln
  fill(TILE.shingle, '#9c3f34');
  {
    const { ox, oy } = cell(TILE.shingle);
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const xx = ox + c * P / 5 + (r % 2) * P / 10, yy = oy + r * P / 5;
        x.fillStyle = ['#a5453a', '#8e372d', '#b04c40'][(r + c) % 3];
        x.beginPath();
        x.moveTo(xx, yy); x.lineTo(xx + P / 5, yy); x.lineTo(xx + P / 5, yy + P / 5 * 0.8);
        x.lineTo(xx + P / 10, yy + P / 5); x.lineTo(xx, yy + P / 5 * 0.8); x.closePath(); x.fill();
      }
    }
  }
  // Putzwand
  fill(TILE.plaster, '#ddd0b0');
  speck(TILE.plaster, 200, ['#d4c6a4', '#e6dcc0', '#cabb98'], 4, 14);
  {
    const { ox, oy } = cell(TILE.plaster);
    x.strokeStyle = '#9c8760'; x.lineWidth = 5;
    x.beginPath(); x.moveTo(ox, oy + P * 0.25); x.lineTo(ox + P, oy + P * 0.25);
    x.moveTo(ox + P * 0.5, oy + P * 0.25); x.lineTo(ox + P * 0.5, oy + P); x.stroke();
  }
  // Metall / Gold
  fill(TILE.metal, '#d8b44a');
  speck(TILE.metal, 120, ['#e8c862', '#c2a03c', '#f0d888'], 6, 18);
  // Blank (für getönte Charakterteile)
  fill(TILE.blank, '#ffffff');
  speck(TILE.blank, 90, ['#f4f4f4', '#fafafa'], 6, 18);
  // Schotter / Bergfels
  fill(TILE.gravel, '#5e5a5e');
  speck(TILE.gravel, 260, ['#6b6770', '#524e56', '#767280', '#464349'], 5, 18);

  return cv;
}

/* Sprite-Sheet für HUD-Icons (1 Reihe à 64px) */
const ICON = { heart: 0, heartHalf: 1, heartEmpty: 2, rupee: 3, key: 4, bomb: 5, arrow: 6, potion: 7, sword: 8, shield: 9 };
function buildIconSheet() {
  const N = 10, S = 64;
  const cv = document.createElement('canvas'); cv.width = N * S; cv.height = S;
  const x = cv.getContext('2d');
  const at = i => i * S;
  const heart = (ox, fill1, fill2, clip) => {
    x.save();
    if (clip) { x.beginPath(); x.rect(ox, 0, S / 2, S); x.clip(); }
    const path = () => {
      x.beginPath();
      x.moveTo(ox + 32, 54);
      x.bezierCurveTo(ox + 4, 34, ox + 6, 12, ox + 20, 12);
      x.bezierCurveTo(ox + 28, 12, ox + 32, 20, ox + 32, 22);
      x.bezierCurveTo(ox + 32, 20, ox + 36, 12, ox + 44, 12);
      x.bezierCurveTo(ox + 58, 12, ox + 60, 34, ox + 32, 54);
      x.closePath();
    };
    path(); x.fillStyle = fill1; x.fill();
    x.restore();
    path(); x.lineWidth = 4; x.strokeStyle = fill2; x.stroke();
  };
  heart(at(ICON.heart), '#e8354a', '#7a1220');
  x.save(); x.fillStyle = '#3a2028';
  heart(at(ICON.heartEmpty), '#3a2028', '#7a1220'); x.restore();
  heart(at(ICON.heartHalf), '#3a2028', '#7a1220');
  heart(at(ICON.heartHalf), '#e8354a', '#7a1220', true);
  // Rubin
  {
    const o = at(ICON.rupee);
    x.beginPath(); x.moveTo(o + 32, 6); x.lineTo(o + 50, 24); x.lineTo(o + 32, 58); x.lineTo(o + 14, 24); x.closePath();
    x.fillStyle = '#3fd06a'; x.fill(); x.lineWidth = 4; x.strokeStyle = '#136b31'; x.stroke();
    x.beginPath(); x.moveTo(o + 32, 6); x.lineTo(o + 32, 58); x.moveTo(o + 14, 24); x.lineTo(o + 50, 24);
    x.lineWidth = 2; x.strokeStyle = 'rgba(255,255,255,.55)'; x.stroke();
  }
  // Schlüssel
  {
    const o = at(ICON.key);
    x.fillStyle = '#e8c85a'; x.strokeStyle = '#8a6a18'; x.lineWidth = 3;
    x.beginPath(); x.arc(o + 24, 22, 12, 0, 7); x.fill(); x.stroke();
    x.beginPath(); x.arc(o + 24, 22, 5, 0, 7); x.fillStyle = '#8a6a18'; x.fill();
    x.fillStyle = '#e8c85a';
    x.fillRect(o + 30, 26, 8, 28); x.fillRect(o + 36, 40, 12, 7); x.fillRect(o + 36, 50, 10, 6);
    x.strokeRect(o + 30, 26, 8, 28);
  }
  // Bombe
  {
    const o = at(ICON.bomb);
    x.beginPath(); x.arc(o + 30, 38, 20, 0, 7); x.fillStyle = '#2a2a34'; x.fill();
    x.lineWidth = 3; x.strokeStyle = '#12121a'; x.stroke();
    x.beginPath(); x.arc(o + 24, 32, 6, 0, 7); x.fillStyle = 'rgba(255,255,255,.35)'; x.fill();
    x.strokeStyle = '#9a7a44'; x.lineWidth = 5; x.beginPath();
    x.moveTo(o + 38, 22); x.quadraticCurveTo(o + 50, 12, o + 44, 6); x.stroke();
    x.beginPath(); x.arc(o + 44, 5, 5, 0, 7); x.fillStyle = '#ff9c2a'; x.fill();
  }
  // Pfeil
  {
    const o = at(ICON.arrow);
    x.strokeStyle = '#a67c48'; x.lineWidth = 6;
    x.beginPath(); x.moveTo(o + 16, 50); x.lineTo(o + 46, 18); x.stroke();
    x.fillStyle = '#d8dde8';
    x.beginPath(); x.moveTo(o + 56, 8); x.lineTo(o + 40, 12); x.lineTo(o + 52, 24); x.closePath(); x.fill();
    x.strokeStyle = '#e05a4a'; x.lineWidth = 5;
    x.beginPath(); x.moveTo(o + 12, 42); x.lineTo(o + 22, 54); x.moveTo(o + 8, 50); x.lineTo(o + 18, 58); x.stroke();
  }
  // Trank
  {
    const o = at(ICON.potion);
    x.fillStyle = '#c8443a';
    x.beginPath(); x.moveTo(o + 24, 26); x.lineTo(o + 40, 26); x.lineTo(o + 46, 54);
    x.quadraticCurveTo(o + 32, 62, o + 18, 54); x.closePath(); x.fill();
    x.lineWidth = 3; x.strokeStyle = '#f0e0c0'; x.stroke();
    x.fillStyle = '#e8dcc0'; x.fillRect(o + 26, 12, 12, 14);
    x.fillStyle = '#8a6a3a'; x.fillRect(o + 24, 6, 16, 8);
  }
  // Schwert
  {
    const o = at(ICON.sword);
    x.fillStyle = '#d8dde8'; x.beginPath();
    x.moveTo(o + 32, 4); x.lineTo(o + 38, 14); x.lineTo(o + 38, 40); x.lineTo(o + 26, 40); x.lineTo(o + 26, 14); x.closePath(); x.fill();
    x.lineWidth = 2.5; x.strokeStyle = '#7a8090'; x.stroke();
    x.fillStyle = '#e8c85a'; x.fillRect(o + 14, 40, 36, 8);
    x.fillStyle = '#8a5a2a'; x.fillRect(o + 28, 48, 8, 14);
  }
  // Schild
  {
    const o = at(ICON.shield);
    x.beginPath(); x.moveTo(o + 32, 6); x.lineTo(o + 54, 16); x.lineTo(o + 50, 42);
    x.quadraticCurveTo(o + 32, 60, o + 14, 42); x.lineTo(o + 10, 16); x.closePath();
    x.fillStyle = '#4a63b8'; x.fill(); x.lineWidth = 4; x.strokeStyle = '#e8c85a'; x.stroke();
    x.beginPath(); x.moveTo(o + 32, 16); x.lineTo(o + 42, 34); x.lineTo(o + 22, 34); x.closePath();
    x.fillStyle = '#e8c85a'; x.fill();
  }
  return cv;
}

/* ---------------- Mesh-Builder (mit UVs) ---------------- */
const _uv = [0, 0];
function MeshData() { this.p = []; this.n = []; this.c = []; this.u = []; }
MeshData.prototype = {
  vert(px, py, pz, nx, ny, nz, col, tile, tu, tv) {
    this.p.push(px, py, pz); this.n.push(nx, ny, nz); this.c.push(col[0], col[1], col[2]);
    tileUV(tile, tu, tv, _uv); this.u.push(_uv[0], _uv[1]);
  },
  tri(a, b, c, col, tile, uvA, uvB, uvC) {
    let ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    let vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    this.vert(a[0], a[1], a[2], nx, ny, nz, col, tile, uvA[0], uvA[1]);
    this.vert(b[0], b[1], b[2], nx, ny, nz, col, tile, uvB[0], uvB[1]);
    this.vert(c[0], c[1], c[2], nx, ny, nz, col, tile, uvC[0], uvC[1]);
  },
  /* Dreieck mit eigener Farbe je Eckpunkt (weiche Verläufe) */
  triVC(a, b, c, ca, cb, cc, tile) {
    let ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    let vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    this.vert(a[0], a[1], a[2], nx, ny, nz, ca, tile, 0.5, 0.5);
    this.vert(b[0], b[1], b[2], nx, ny, nz, cb, tile, 0.5, 0.5);
    this.vert(c[0], c[1], c[2], nx, ny, nz, cc, tile, 0.5, 0.5);
  },
  quad(a, b, c, d, col, tile) {
    tile = tile === undefined ? TILE.blank : tile;
    this.tri(a, b, c, col, tile, [0, 0], [0, 1], [1, 1]);
    this.tri(a, c, d, col, tile, [0, 0], [1, 1], [1, 0]);
  },
  /* Fläche in Kachelstücke unterteilen, damit die Textur nicht verzerrt */
  patchQuad(a, b, c, d, col, tile, su, sv, texScale) {
    const nu = Math.max(1, Math.round(su / texScale)), nv = Math.max(1, Math.round(sv / texScale));
    const mix = (p, q, t) => [U.lerp(p[0], q[0], t), U.lerp(p[1], q[1], t), U.lerp(p[2], q[2], t)];
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nv; j++) {
        const t0 = i / nu, t1 = (i + 1) / nu, s0 = j / nv, s1 = (j + 1) / nv;
        const e0 = mix(a, d, t0), e1 = mix(b, c, t0), f0 = mix(a, d, t1), f1 = mix(b, c, t1);
        this.quad(mix(e0, e1, s0), mix(e0, e1, s1), mix(f0, f1, s1), mix(f0, f1, s0), col, tile);
      }
    }
  },
  box(cx, cy, cz, sx, sy, sz, col, ry, tile, texScale) {
    ry = ry || 0; tile = tile === undefined ? TILE.blank : tile;
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const co = Math.cos(ry), si = Math.sin(ry);
    const v = [];
    for (const c of [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz],
    [-hx, hy, -hz], [hx, hy, -hz], [hx, hy, hz], [-hx, hy, hz]])
      v.push([cx + c[0] * co + c[2] * si, cy + c[1], cz + (-c[0] * si + c[2] * co)]);
    const sh = k => [col[0] * k, col[1] * k, col[2] * k];
    // umgekehrte Reihenfolge: Wicklung gegen den Uhrzeigersinn von außen,
    // damit die Normalen nach außen zeigen
    const F = (a, b, c, d, k, su, sv) => {
      if (texScale) this.patchQuad(v[d], v[c], v[b], v[a], sh(k), tile, su, sv, texScale);
      else this.quad(v[d], v[c], v[b], v[a], sh(k), tile);
    };
    F(4, 5, 6, 7, 1.0, sx, sz);
    F(3, 2, 1, 0, 0.58, sx, sz);
    F(0, 1, 5, 4, 0.84, sx, sy);
    F(2, 3, 7, 6, 0.90, sx, sy);
    F(1, 2, 6, 5, 0.95, sz, sy);
    F(3, 0, 4, 7, 0.78, sz, sy);
  },
  cylinder(cx, cy, cz, rBot, rTop, h, seg, col, tile) {
    tile = tile === undefined ? TILE.blank : tile;
    const hy = h / 2;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const k = 0.78 + 0.22 * (0.5 + 0.5 * Math.cos(a0 - 0.7));
      const sc = [col[0] * k, col[1] * k, col[2] * k];
      const bA = [cx + c0 * rBot, cy - hy, cz + s0 * rBot], bB = [cx + c1 * rBot, cy - hy, cz + s1 * rBot];
      const tA = [cx + c0 * rTop, cy + hy, cz + s0 * rTop], tB = [cx + c1 * rTop, cy + hy, cz + s1 * rTop];
      if (rTop > 0.001) {
        this.tri(bA, tA, tB, sc, tile, [0, 1], [0, 0], [1, 0]);
        this.tri(bA, tB, bB, sc, tile, [0, 1], [1, 0], [1, 1]);
        this.tri(tA, [cx, cy + hy, cz], tB, col, tile, [0, 0], [0.5, 0.5], [1, 0]);
      } else {
        this.tri(bA, [cx, cy + hy, cz], bB, sc, tile, [0, 1], [0.5, 0], [1, 1]);
      }
    }
  },
  sphere(cx, cy, cz, r, col, seg, rings, squash, tile) {
    seg = seg || 8; rings = rings || 6; squash = squash || 1;
    tile = tile === undefined ? TILE.blank : tile;
    for (let j = 0; j < rings; j++) {
      const p0 = Math.PI * (j / rings), p1 = Math.PI * ((j + 1) / rings);
      for (let i = 0; i < seg; i++) {
        const t0 = Math.PI * 2 * (i / seg), t1 = Math.PI * 2 * ((i + 1) / seg);
        const pt = (p, t) => [cx + r * Math.sin(p) * Math.cos(t), cy + r * squash * Math.cos(p), cz + r * Math.sin(p) * Math.sin(t)];
        const a = pt(p0, t0), b = pt(p1, t0), c = pt(p1, t1), d = pt(p0, t1);
        const k = 0.8 + 0.2 * (1 - j / rings);
        const sc = [col[0] * k, col[1] * k, col[2] * k];
        const u0 = i / seg, u1 = (i + 1) / seg, v0 = j / rings, v1 = (j + 1) / rings;
        if (j === 0) this.tri(a, c, b, sc, tile, [u0, v0], [u1, v1], [u0, v1]);
        else if (j === rings - 1) this.tri(a, d, b, sc, tile, [u0, v0], [u1, v0], [u0, v1]);
        else {
          this.tri(a, c, b, sc, tile, [u0, v0], [u1, v1], [u0, v1]);
          this.tri(a, d, c, sc, tile, [u0, v0], [u1, v0], [u1, v1]);
        }
      }
    }
  },
  disc(cx, cy, cz, r, col, seg, tile) {
    seg = seg || 16; tile = tile === undefined ? TILE.blank : tile;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      this.tri([cx, cy, cz], [cx + Math.cos(a1) * r, cy, cz + Math.sin(a1) * r], [cx + Math.cos(a0) * r, cy, cz + Math.sin(a0) * r],
        col, tile, [0.5, 0.5], [0.5 + Math.cos(a1) * 0.5, 0.5 + Math.sin(a1) * 0.5], [0.5 + Math.cos(a0) * 0.5, 0.5 + Math.sin(a0) * 0.5]);
    }
  },
  count() { return this.p.length / 3; }
};

/* ---------------- Shader ---------------- */
const VS = `
attribute vec3 a_pos; attribute vec3 a_norm; attribute vec3 a_col; attribute vec2 a_uv;
uniform mat4 u_proj, u_view, u_model; uniform mat3 u_nmat;
uniform float u_time, u_wave, u_fogNear, u_fogFar;
uniform mediump float u_outline;
varying vec3 v_norm; varying vec3 v_col; varying vec2 v_uv; varying float v_fog;
void main(){
  vec3 p = a_pos;
  if(u_wave > 0.5){ p.y += sin(p.x*0.32 + u_time*1.7)*0.16 + cos(p.z*0.38 + u_time*1.2)*0.14; }
  p += a_norm * u_outline;
  vec4 wp = u_model * vec4(p,1.0);
  vec4 vp = u_view * wp;
  gl_Position = u_proj * vp;
  v_norm = u_nmat * a_norm;
  v_col = a_col; v_uv = a_uv;
  v_fog = clamp((-vp.z - u_fogNear)/(u_fogFar-u_fogNear), 0.0, 1.0);
}`;
const FS = `
precision mediump float;
varying vec3 v_norm; varying vec3 v_col; varying vec2 v_uv; varying float v_fog;
uniform vec3 u_lightDir, u_fogColor, u_lightCol, u_ambCol;
uniform vec4 u_tint; uniform float u_emis, u_texMix;
uniform mediump float u_outline;
uniform sampler2D u_tex;
void main(){
  vec4 tex = texture2D(u_tex, v_uv);
  vec3 base = v_col * u_tint.rgb * mix(vec3(1.0), tex.rgb, u_texMix);
  if(u_outline > 0.0){
    gl_FragColor = vec4(mix(base*0.13, u_fogColor, v_fog*0.85), u_tint.a);
    return;
  }
  vec3 n = normalize(v_norm);
  float d = max(dot(n, normalize(u_lightDir)), 0.0);
  float band = d > 0.72 ? 1.0 : (d > 0.34 ? 0.80 : (d > 0.12 ? 0.64 : 0.52));
  float sky = 0.5 + 0.5*n.y;
  vec3 c = base * (band*u_lightCol + u_ambCol + sky*0.06);
  c = mix(c, base, u_emis);
  c = mix(c, u_fogColor, v_fog * (1.0 - u_emis));   // Leuchtendes ignoriert den Nebel
  gl_FragColor = vec4(c, u_tint.a);
}`;

const G = {
  gl: null, prog: null, loc: {}, canvas: null, tex: null,
  _nmat: new Float32Array(9), _bb: M4.create(),
  proj: M4.create(), view: M4.create(),

  init(canvas) {
    this.canvas = canvas;
    const opts = { antialias: true, alpha: false, powerPreference: 'high-performance' };
    const gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl) return false;
    this.gl = gl;
    const mk = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(p)); return false; }
    gl.useProgram(p); this.prog = p;
    for (const n of ['u_proj', 'u_view', 'u_model', 'u_nmat', 'u_time', 'u_wave', 'u_fogNear', 'u_fogFar',
      'u_lightDir', 'u_fogColor', 'u_tint', 'u_emis', 'u_outline', 'u_tex', 'u_texMix', 'u_lightCol', 'u_ambCol'])
      this.loc[n] = gl.getUniformLocation(p, n);
    this.loc.a_pos = gl.getAttribLocation(p, 'a_pos');
    this.loc.a_norm = gl.getAttribLocation(p, 'a_norm');
    this.loc.a_col = gl.getAttribLocation(p, 'a_col');
    this.loc.a_uv = gl.getAttribLocation(p, 'a_uv');
    for (const a of [this.loc.a_pos, this.loc.a_norm, this.loc.a_col, this.loc.a_uv]) gl.enableVertexAttribArray(a);

    // Atlas hochladen
    const cv = buildAtlasCanvas();
    this.atlasCanvas = cv;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(this.loc.u_tex, 0);
    this.tex = t;

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    return true;
  },

  upload(md) {
    const gl = this.gl, n = md.p.length / 3;
    const arr = new Float32Array(n * 11);
    for (let i = 0; i < n; i++) {
      const o = i * 11;
      arr[o] = md.p[i * 3]; arr[o + 1] = md.p[i * 3 + 1]; arr[o + 2] = md.p[i * 3 + 2];
      arr[o + 3] = md.n[i * 3]; arr[o + 4] = md.n[i * 3 + 1]; arr[o + 5] = md.n[i * 3 + 2];
      arr[o + 6] = md.c[i * 3]; arr[o + 7] = md.c[i * 3 + 1]; arr[o + 8] = md.c[i * 3 + 2];
      arr[o + 9] = md.u[i * 2]; arr[o + 10] = md.u[i * 2 + 1];
    }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
    return { buf, count: n };
  },

  frame(fog, fogNear, fogFar, ambCol, lightCol, lightDir, time) {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(fog[0], fog[1], fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform3fv(this.loc.u_fogColor, fog);
    gl.uniform1f(this.loc.u_fogNear, fogNear);
    gl.uniform1f(this.loc.u_fogFar, fogFar);
    gl.uniform3fv(this.loc.u_ambCol, ambCol);
    gl.uniform3fv(this.loc.u_lightCol, lightCol);
    gl.uniform3fv(this.loc.u_lightDir, lightDir);
    gl.uniform1f(this.loc.u_time, time);
    gl.uniformMatrix4fv(this.loc.u_proj, false, this.proj);
    gl.uniformMatrix4fv(this.loc.u_view, false, this.view);
    this.drawCalls = 0;
  },

  draw(mesh, model, tint, opt) {
    const gl = this.gl;
    opt = opt || {};
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buf);
    gl.vertexAttribPointer(this.loc.a_pos, 3, gl.FLOAT, false, 44, 0);
    gl.vertexAttribPointer(this.loc.a_norm, 3, gl.FLOAT, false, 44, 12);
    gl.vertexAttribPointer(this.loc.a_col, 3, gl.FLOAT, false, 44, 24);
    gl.vertexAttribPointer(this.loc.a_uv, 2, gl.FLOAT, false, 44, 36);
    normalFromMat4(this._nmat, model);
    gl.uniformMatrix4fv(this.loc.u_model, false, model);
    gl.uniformMatrix3fv(this.loc.u_nmat, false, this._nmat);
    gl.uniform4f(this.loc.u_tint, tint[0], tint[1], tint[2], tint.length > 3 ? tint[3] : 1);
    gl.uniform1f(this.loc.u_wave, opt.wave ? 1 : 0);
    gl.uniform1f(this.loc.u_emis, opt.emis || 0);
    gl.uniform1f(this.loc.u_texMix, opt.noTex ? 0 : 1);
    const blend = (tint.length > 3 && tint[3] < 1) || opt.blend;
    if (blend) { gl.enable(gl.BLEND); if (opt.noDepthWrite) gl.depthMask(false); }
    if (opt.noCull) gl.disable(gl.CULL_FACE);
    if (opt.noDepthTest) gl.disable(gl.DEPTH_TEST);

    if (opt.outline) {   // Toon-Kontur: Rückseiten leicht aufgeblasen
      gl.uniform1f(this.loc.u_outline, opt.outline);
      gl.cullFace(gl.FRONT);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
      gl.cullFace(gl.BACK);
      gl.uniform1f(this.loc.u_outline, 0);
    }
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    this.drawCalls++;

    if (opt.noDepthTest) gl.enable(gl.DEPTH_TEST);
    if (opt.noCull) gl.enable(gl.CULL_FACE);
    if (blend) { gl.disable(gl.BLEND); gl.depthMask(true); }
  },

  sprite(x, y, z, w, h, tint, opt) {
    M4.billboard(this._bb, this.view, x, y, z, w, h, opt && opt.roll);
    // Billboards sind einseitig: Culling abschalten, sonst verschwinden sie je nach Blickwinkel
    const o = opt ? Object.assign({}, opt) : {};
    o.noCull = true; o.blend = true;
    this.draw(PRIM.quad, this._bb, tint, o);
  }
};

/* Einheits-Primitives */
const PRIM = {};
function buildPrims() {
  const w = [1, 1, 1];
  let m = new MeshData(); m.box(0, 0, 0, 1, 1, 1, w); PRIM.box = G.upload(m);
  m = new MeshData(); m.sphere(0, 0, 0, 0.5, w, 9, 7); PRIM.sphere = G.upload(m);
  m = new MeshData(); m.cylinder(0, 0, 0, 0.5, 0.5, 1, 10, w); PRIM.cyl = G.upload(m);
  m = new MeshData(); m.cylinder(0, 0, 0, 0.5, 0, 1, 10, w); PRIM.cone = G.upload(m);
  m = new MeshData(); m.disc(0, 0, 0, 0.5, w, 18); PRIM.disc = G.upload(m);
  m = new MeshData();
  m.quad([-0.5, -0.5, 0], [-0.5, 0.5, 0], [0.5, 0.5, 0], [0.5, -0.5, 0], w, TILE.blank);
  PRIM.quad = G.upload(m);
  m = new MeshData();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2, r = 0.22;
    m.cylinder(Math.cos(a) * r, 0.22, Math.sin(a) * r, 0.09, 0, 0.55, 4, w, TILE.grass);
  }
  PRIM.tuft = G.upload(m);
}

/* =========================================================
   AUDIO — Effekte + mehrspurige Musik mit Lookahead-Scheduler
   ========================================================= */
const Snd = {
  ctx: null, master: null, sfxGain: null, musGain: null,
  on: true, musicOn: true,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.42;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.85; this.sfxGain.connect(this.master);
    this.musGain = this.ctx.createGain(); this.musGain.gain.value = 0.5; this.musGain.connect(this.master);
    Music.init(this);
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  tone(freq, dur, type, vol, slideTo, delay) {
    if (!this.ctx || !this.on) return;
    const t0 = this.ctx.currentTime + (delay || 0);
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.25, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },
  noise(dur, vol, filterFreq) {
    if (!this.ctx || !this.on) return;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = b;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
    const g = this.ctx.createGain(); g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start();
  },
  swing() { this.noise(0.16, 0.20, 2600); this.tone(700, 0.10, 'triangle', 0.10, 1500); },
  hit() { this.noise(0.14, 0.34, 800); this.tone(180, 0.14, 'square', 0.18, 70); },
  hurt() { this.tone(300, 0.22, 'sawtooth', 0.22, 110); this.noise(0.15, 0.2, 500); },
  rupee() { this.tone(1050, 0.09, 'square', 0.16); this.tone(1560, 0.13, 'square', 0.16, null, 0.08); },
  heart() { this.tone(660, 0.1, 'triangle', 0.2); this.tone(880, 0.12, 'triangle', 0.2, null, 0.09); this.tone(1320, 0.18, 'triangle', 0.18, null, 0.19); },
  chest() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'square', 0.16, null, i * 0.11)); },
  boom() { this.noise(0.55, 0.5, 420); this.tone(90, 0.5, 'sawtooth', 0.3, 35); },
  door() { this.noise(0.4, 0.25, 300); this.tone(140, 0.35, 'square', 0.14, 90); },
  bow() { this.noise(0.1, 0.18, 3000); this.tone(1400, 0.08, 'triangle', 0.1, 600); },
  step() { this.noise(0.05, 0.06, 500); },
  splash() { this.noise(0.25, 0.16, 1600); },
  buy() { this.tone(880, 0.1, 'square', 0.16); this.tone(1320, 0.16, 'square', 0.16, null, 0.09); },
  deny() { this.tone(220, 0.18, 'square', 0.16, 140); },
  fanfare() { [523, 523, 523, 698, 880, 1046].forEach((f, i) => this.tone(f, 0.3, 'square', 0.2, null, i * 0.14)); }
};

/* ---- Musik: eigener Sequencer, alle Themen selbst komponiert ---- */
const Music = {
  snd: null, ctx: null, timer: null, cur: null,
  step: 0, nextTime: 0, bpm: 108,
  init(snd) { this.snd = snd; this.ctx = snd.ctx; },

  /* n = MIDI-Note; 0/null = Pause */
  themes: {
    village: {
      bpm: 96, sw: 0.5,
      lead: [76, 0, 79, 0, 81, 0, 79, 0, 76, 0, 72, 0, 74, 0, 0, 0,
             74, 0, 77, 0, 81, 0, 79, 0, 77, 0, 74, 0, 72, 0, 0, 0],
      bass: [48, 0, 55, 0, 52, 0, 55, 0, 45, 0, 52, 0, 50, 0, 55, 0,
             50, 0, 57, 0, 53, 0, 57, 0, 43, 0, 50, 0, 48, 0, 55, 0],
      pad:  [64, 0, 0, 0, 67, 0, 0, 0, 62, 0, 0, 0, 65, 0, 0, 0,
             66, 0, 0, 0, 69, 0, 0, 0, 64, 0, 0, 0, 60, 0, 0, 0],
      drum: [1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0,
             1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 1, 0, 2, 0, 2, 0],
      leadType: 'triangle', bassType: 'sine'
    },
    over: {
      bpm: 132, sw: 0,
      lead: [74, 76, 78, 0, 81, 0, 78, 0, 76, 0, 74, 0, 71, 0, 74, 0,
             78, 79, 81, 0, 83, 0, 81, 0, 78, 0, 76, 0, 74, 0, 0, 0,
             81, 0, 83, 0, 85, 0, 83, 81, 78, 0, 81, 0, 76, 0, 78, 0,
             74, 0, 78, 0, 81, 0, 78, 0, 74, 0, 71, 0, 74, 0, 0, 0],
      bass: [50, 0, 50, 0, 57, 0, 57, 0, 45, 0, 45, 0, 52, 0, 52, 0,
             48, 0, 48, 0, 55, 0, 55, 0, 50, 0, 50, 0, 57, 0, 57, 0,
             53, 0, 53, 0, 60, 0, 60, 0, 45, 0, 45, 0, 52, 0, 52, 0,
             50, 0, 50, 0, 57, 0, 45, 0, 50, 0, 52, 0, 54, 0, 55, 0],
      pad:  [62, 0, 0, 0, 0, 0, 0, 0, 57, 0, 0, 0, 0, 0, 0, 0,
             60, 0, 0, 0, 0, 0, 0, 0, 62, 0, 0, 0, 0, 0, 0, 0,
             65, 0, 0, 0, 0, 0, 0, 0, 57, 0, 0, 0, 0, 0, 0, 0,
             62, 0, 0, 0, 0, 0, 0, 0, 62, 0, 0, 0, 0, 0, 0, 0],
      drum: [1, 0, 3, 0, 2, 0, 3, 0, 1, 0, 3, 0, 2, 0, 3, 3,
             1, 0, 3, 0, 2, 0, 3, 0, 1, 0, 3, 0, 2, 0, 3, 3,
             1, 0, 3, 0, 2, 0, 3, 0, 1, 0, 3, 0, 2, 0, 3, 3,
             1, 0, 3, 0, 2, 0, 3, 0, 1, 1, 3, 0, 2, 2, 3, 3],
      leadType: 'square', bassType: 'sawtooth'
    },
    dun: {
      bpm: 84, sw: 0,
      lead: [62, 0, 0, 63, 0, 0, 65, 0, 0, 0, 63, 0, 62, 0, 0, 0,
             58, 0, 0, 60, 0, 0, 62, 0, 0, 0, 60, 0, 58, 0, 0, 0],
      bass: [38, 0, 0, 0, 38, 0, 0, 0, 41, 0, 0, 0, 38, 0, 0, 0,
             34, 0, 0, 0, 34, 0, 0, 0, 36, 0, 0, 0, 37, 0, 0, 0],
      pad:  [50, 0, 0, 0, 0, 0, 0, 0, 53, 0, 0, 0, 0, 0, 0, 0,
             46, 0, 0, 0, 0, 0, 0, 0, 48, 0, 0, 0, 0, 0, 0, 0],
      drum: [1, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 1, 0, 0, 0,
             1, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 1, 0, 2, 0],
      leadType: 'triangle', bassType: 'sine'
    },
    boss: {
      bpm: 156, sw: 0,
      lead: [50, 50, 0, 50, 0, 51, 0, 50, 45, 0, 50, 0, 53, 0, 51, 0,
             50, 50, 0, 50, 0, 51, 0, 53, 55, 0, 53, 0, 51, 0, 50, 0],
      bass: [26, 26, 0, 26, 26, 0, 26, 0, 27, 27, 0, 27, 29, 0, 26, 0,
             26, 26, 0, 26, 26, 0, 26, 0, 31, 0, 29, 0, 27, 0, 26, 0],
      pad:  [62, 0, 0, 0, 0, 0, 63, 0, 0, 0, 0, 0, 65, 0, 0, 0,
             62, 0, 0, 0, 0, 0, 60, 0, 0, 0, 0, 0, 58, 0, 0, 0],
      drum: [1, 3, 2, 3, 1, 3, 2, 3, 1, 3, 2, 3, 1, 1, 2, 2,
             1, 3, 2, 3, 1, 3, 2, 3, 1, 3, 2, 3, 1, 1, 2, 2],
      leadType: 'sawtooth', bassType: 'sawtooth'
    }
  },

  freq(n) { return 440 * Math.pow(2, (n - 69) / 12); },

  play(name) {
    if (!this.snd || !this.snd.ctx) return;
    if (this.cur === name && this.timer) return;
    this.stop();
    if (!this.snd.musicOn) { this.cur = name; return; }
    this.cur = name;
    this.step = 0;
    this.nextTime = this.snd.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), 25);
  },
  stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } },
  restart() { const c = this.cur; this.cur = null; if (c) this.play(c); },

  schedule() {
    const t = this.themes[this.cur]; if (!t || !this.snd.ctx) return;
    const ctx = this.snd.ctx;
    const spb = 60 / t.bpm / 2;                       // Achtelschritt
    while (this.nextTime < ctx.currentTime + 0.15) {
      const i = this.step % t.lead.length;
      const swing = (t.sw && i % 2 === 1) ? spb * 0.16 : 0;
      const at = this.nextTime + swing;
      this.note(t.lead[i], at, spb * 1.7, t.leadType, 0.16, true);
      this.note(t.bass[i % t.bass.length], at, spb * 1.9, t.bassType, 0.20);
      this.note(t.pad[i % t.pad.length], at, spb * 7.0, 'sine', 0.055);
      this.perc(t.drum[i % t.drum.length], at);
      this.nextTime += spb;
      this.step++;
    }
  },
  note(n, at, dur, type, vol, vib) {
    if (!n) return;
    const ctx = this.snd.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(this.freq(n), at);
    if (vib) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5.5; lg.gain.value = 3.2;
      lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(at); lfo.stop(at + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(this.snd.musGain);
    o.start(at); o.stop(at + dur + 0.05);
  },
  perc(kind, at) {
    if (!kind) return;
    const ctx = this.snd.ctx;
    if (kind === 1) {                                  // Kick
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(150, at);
      o.frequency.exponentialRampToValueAtTime(45, at + 0.11);
      g.gain.setValueAtTime(0.30, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      o.connect(g); g.connect(this.snd.musGain); o.start(at); o.stop(at + 0.18);
    } else {                                            // Snare / HiHat
      const dur = kind === 2 ? 0.13 : 0.045;
      const n = Math.floor(ctx.sampleRate * dur);
      const b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = ctx.createBufferSource(); s.buffer = b;
      const f = ctx.createBiquadFilter();
      f.type = kind === 2 ? 'bandpass' : 'highpass';
      f.frequency.value = kind === 2 ? 1900 : 7000;
      const g = ctx.createGain(); g.gain.value = kind === 2 ? 0.16 : 0.05;
      s.connect(f); f.connect(g); g.connect(this.snd.musGain);
      s.start(at); s.stop(at + dur);
    }
  }
};

/* =========================================================
   BGM — MP3-Tracks mit Crossfade; fällt auf den
   Synthesizer zurück, wenn eine Datei fehlt
   ========================================================= */
const BGM = {
  files: {
    village: 'assets/bgm/village.mp3',
    over: 'assets/bgm/overworld.mp3',
    dun: 'assets/bgm/dungeon.mp3',
    boss: 'assets/bgm/boss.mp3'
  },
  vol: 0.55, cur: null, el: {}, failed: {}, fades: [], enabled: true,

  get(name) {
    if (this.el[name]) return this.el[name];
    const src = this.files[name];
    if (!src || this.failed[name]) return null;
    const a = new Audio();
    a.src = src; a.loop = true; a.preload = 'auto'; a.volume = 0;
    a.addEventListener('error', () => { this.failed[name] = true; if (this.cur === name) Music.play(name); });
    this.el[name] = a;
    return a;
  },
  /* Nachbarn vorladen, damit der Wechsel nicht stockt */
  preload(names) { for (const n of names) { const a = this.get(n); if (a) a.load(); } },

  play(name) {
    if (this.cur === name && !this.failed[name]) return;
    const prev = this.cur;
    this.cur = name;
    if (!this.enabled) { Music.stop(); return; }
    const a = this.get(name);
    if (!a) { Music.play(name); return; }
    Music.stop();                                   // Synth aus, MP3 übernimmt
    if (prev && this.el[prev] && prev !== name) this.fade(this.el[prev], 0, 0.7, true);
    a.currentTime = a.currentTime || 0;
    const p = a.play();
    if (p && p.catch) p.catch(() => { /* Autoplay erst nach Klick erlaubt */ });
    this.fade(a, this.vol, 0.7, false);
  },
  fade(el, to, dur, stopAtEnd) {
    const from = el.volume, t0 = performance.now();
    this.fades = this.fades.filter(f => f.el !== el);
    this.fades.push({ el, from, to, t0, dur: dur * 1000, stopAtEnd });
  },
  update() {
    if (!this.fades.length) return;
    const now = performance.now();
    for (const f of this.fades) {
      const t = U.clamp((now - f.t0) / f.dur, 0, 1);
      f.el.volume = U.clamp(U.lerp(f.from, f.to, t), 0, 1);
      if (t >= 1 && f.stopAtEnd) { f.el.pause(); f.el.currentTime = 0; }
    }
    this.fades = this.fades.filter(f => (now - f.t0) < f.dur);
  },
  setEnabled(on) {
    this.enabled = on;
    if (!on) {
      Music.stop();
      for (const k in this.el) { this.el[k].pause(); }
    } else if (this.cur) { const c = this.cur; this.cur = null; this.play(c); }
  },
  setVolume(v) {
    this.vol = U.clamp(v, 0, 1);
    if (this.cur && this.el[this.cur]) this.el[this.cur].volume = this.vol;
  },
  stop() { this.cur = null; Music.stop(); for (const k in this.el) { this.el[k].pause(); this.el[k].currentTime = 0; } }
};
