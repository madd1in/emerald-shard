'use strict';
/* =========================================================
   WORLD — Terrain mit Kachel-Texturen, Props, Kollision,
           Dungeon, Himmel
   ========================================================= */

const WATER_Y = 0.0;
const LAND_BASE = 2.5;
const WORLD_R = 118;

const COL = {
  grass: [0.86, 1.00, 0.80], grass2: [1.00, 1.00, 0.90], grassDry: [1.00, 0.96, 0.74],
  sand: [1.00, 1.00, 0.98], rock: [1.00, 1.00, 1.00], rockDark: [0.72, 0.72, 0.78],
  dirt: [1.00, 0.98, 0.92], wood: [0.86, 0.80, 0.74], woodLight: [1.00, 0.96, 0.88],
  leaf: [0.90, 1.00, 0.86], leaf2: [1.00, 1.00, 0.94], leaf3: [0.74, 0.92, 0.74],
  roof: [1.00, 0.96, 0.92], wall: [1.00, 1.00, 1.00], water: [1.00, 1.00, 1.00],
  stone: [1.00, 1.00, 1.00], stone2: [0.84, 0.84, 0.90], floor: [1.00, 1.00, 1.00],
  gold: [1.00, 0.98, 0.80], flame: [1.0, 0.62, 0.15], white: [1, 1, 1]
};

const World = {
  scene: 'over',
  over: null, dun: null, cur: null, sky: null,

  /* ---------- Höhenfeld ---------- */
  height(x, z) {
    if (this.scene === 'dun') return 0;
    let hills = Math.sin(x * 0.048) * Math.cos(z * 0.042) * 1.35 + Math.sin((x * 0.7 + z * 0.9) * 0.031) * 1.05;
    const dv = Math.hypot(x - 0, z - 62);
    hills *= U.clamp((dv - 13) / 15, 0.12, 1);
    const dl = Math.hypot(x - 60, z - 6);
    if (dl < 22) hills *= U.clamp((dl - 6) / 16, 0.15, 1);
    let h = LAND_BASE + hills;
    let m = U.clamp((-z - 50) / 15, 0, 1); m = U.smooth(m);
    let ridge = m * 19;
    const pass = U.clamp(1 - Math.abs(x) / 12, 0, 1);
    ridge *= 1 - U.smooth(pass) * 0.88;
    h += ridge;
    if (dl < 30) h -= U.smooth(1 - dl / 30) * 4.6;
    if (dl < 6.5) h += U.smooth(1 - dl / 6.5) * 5.6;
    const dr = Math.hypot(x, z);
    if (dr > WORLD_R - 24) h -= (dr - (WORLD_R - 24)) * 0.85;
    return h;
  },

  terrainTile(x, z, h, slope) {
    if (h < WATER_Y + 0.5) return TILE.sand;
    if (slope > 0.85) return h > 8 ? TILE.gravel : TILE.rock;
    if (h > 9) return TILE.gravel;
    if (Math.abs(x) < 3.2 && z < 58 && z > -66) return TILE.dirt;
    if (Math.hypot(x, z - 62) < 12) return TILE.dirt;
    const n = Math.sin(x * 0.31) * Math.cos(z * 0.27);
    return n > 0.55 ? TILE.grassFlower : TILE.grass;
  },

  build() { this.buildSky(); this.buildOver(); this.buildDungeon(); this.cur = this.over; },

  /* ---------- Himmel ---------- */
  buildSky() {
    const md = new MeshData(), R = 320, seg = 30, rings = 16;
    // Farbe pro Eckpunkt aus der Höhe -> stufenloser Verlauf
    const grad = p => {
      const k = U.smooth(U.clamp(Math.sin(p) * 1.25, 0, 1));
      return [U.lerp(1.0, 0.40, k), U.lerp(0.97, 0.64, k), U.lerp(0.90, 1.0, k)];
    };
    for (let j = 0; j < rings; j++) {
      const p0 = Math.PI * 0.5 * (j / rings), p1 = Math.PI * 0.5 * ((j + 1) / rings);
      const c0 = grad(p0), c1 = grad(p1);
      for (let i = 0; i < seg; i++) {
        const t0 = Math.PI * 2 * (i / seg), t1 = Math.PI * 2 * ((i + 1) / seg);
        const pt = (p, t) => [Math.cos(p) * Math.cos(t) * R, Math.sin(p) * R - 12, Math.cos(p) * Math.sin(t) * R];
        const a = pt(p0, t0), b = pt(p0, t1), c = pt(p1, t1), d = pt(p1, t0);
        md.triVC(a, c, b, c0, c1, c0, TILE.blank);
        md.triVC(a, d, c, c0, c1, c1, TILE.blank);
      }
    }
    this.sky = G.upload(md);

    // Wolken (weiche Kugelhaufen)
    const cm = new MeshData(), rng = mulberry32(77);
    for (let i = 0; i < 22; i++) {
      const a = rng() * Math.PI * 2, d = 70 + rng() * 180;
      const cx = Math.cos(a) * d, cz = Math.sin(a) * d, cy = 48 + rng() * 34;
      const s = 6 + rng() * 9;
      for (let k = 0; k < 4; k++)
        cm.sphere(cx + (rng() - 0.5) * s * 2.4, cy + (rng() - 0.5) * s * 0.4, cz + (rng() - 0.5) * s * 1.6,
          s * (0.6 + rng() * 0.5), [1, 1, 1], 7, 5, 0.62, TILE.blank);
    }
    this.clouds = G.upload(cm);

    // Sternenrichtungen (feste Positionen am Himmelszelt)
    const srng = mulberry32(913);
    this.stars = [];
    for (let i = 0; i < 70; i++) {
      const a = srng() * Math.PI * 2, e = 0.06 + srng() * 0.9;
      const r = Math.sqrt(1 - e * e);
      this.stars.push({ x: Math.cos(a) * r, y: e, z: Math.sin(a) * r, s: 0.7 + srng() * 1.5, t: srng() * 6 });
    }
  },

  /* ---------- Overworld ---------- */
  buildOver() {
    const rng = mulberry32(20260731);
    const md = new MeshData(), props = new MeshData(), glow = new MeshData();
    const colliders = [];
    const spawns = { enemies: [], props: [], grass: [], npcs: [], chests: [] };

    /* Terrain */
    const S = 2.4, N = Math.ceil((WORLD_R + 16) * 2 / S), O = -(WORLD_R + 16);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const x0 = O + i * S, z0 = O + j * S, x1 = x0 + S, z1 = z0 + S;
        const h00 = this.height(x0, z0), h10 = this.height(x1, z0), h11 = this.height(x1, z1), h01 = this.height(x0, z1);
        if (h00 < WATER_Y - 5 && h10 < WATER_Y - 5 && h11 < WATER_Y - 5 && h01 < WATER_Y - 5) continue;
        const hm = (h00 + h10 + h11 + h01) / 4;
        const slope = (Math.abs(h00 - h11) + Math.abs(h10 - h01)) / (S * 1.4);
        const tile = this.terrainTile(x0 + S / 2, z0 + S / 2, hm, slope);
        const v = 0.94 + rng() * 0.12;
        md.quad([x0, h00, z0], [x0, h01, z1], [x1, h11, z1], [x1, h10, z0], [v, v, v], tile);
      }
    }

    const free = (x, z, r) => {
      for (const c of colliders) {
        if (c.r !== undefined) { if (U.dist(x, z, c.x, c.z) < c.r + r) return false; }
        else if (Math.abs(x - c.x) < c.hx + r && Math.abs(z - c.z) < c.hz + r) return false;
      }
      return true;
    };
    const onPath = (x, z) => Math.abs(x) < 5 && z < 60 && z > -70;

    const tree = (x, z, s) => {
      const y = this.height(x, z);
      props.cylinder(x, y + 1.5 * s, z, 0.42 * s, 0.30 * s, 3.0 * s, 6, COL.wood, TILE.plank);
      const lc = [COL.leaf, COL.leaf2, COL.leaf3][Math.floor(rng() * 3)];
      props.cylinder(x, y + 3.6 * s, z, 1.9 * s, 0.05, 2.4 * s, 7, lc, TILE.leaf);
      props.cylinder(x, y + 5.0 * s, z, 1.45 * s, 0.05, 2.0 * s, 7, [lc[0] * 1.06, lc[1] * 1.06, lc[2] * 1.06], TILE.leaf);
      props.cylinder(x, y + 6.1 * s, z, 0.95 * s, 0.05, 1.6 * s, 7, lc, TILE.leaf);
      colliders.push({ x, z, r: 0.8 * s });
    };
    const rock = (x, z, s) => {
      const y = this.height(x, z);
      props.sphere(x, y + 0.35 * s, z, 0.9 * s, COL.rock, 6, 4, 0.8, TILE.rock);
      props.box(x + 0.3 * s, y + 0.2 * s, z - 0.2 * s, 0.9 * s, 0.8 * s, 0.9 * s, COL.rockDark, rng() * 2, TILE.rock);
      colliders.push({ x, z, r: 0.95 * s });
    };
    const house = (x, z, ry, w, d, roofCol) => {
      const y = this.height(x, z);
      props.box(x, y + 1.6, z, w, 3.2, d, COL.wall, ry, TILE.plaster, 2.2);
      const rh = 1.7, hw = w / 2 + 0.45, hd = d / 2 + 0.45;
      const co = Math.cos(ry), si = Math.sin(ry);
      const rot = (px, pz) => [x + px * co + pz * si, z - px * si + pz * co];
      const p1 = rot(-hw, -hd), p2 = rot(hw, -hd), p3 = rot(hw, hd), p4 = rot(-hw, hd);
      const r1 = rot(-hw * 0.14, -hd), r2 = rot(hw * 0.14, -hd), r3 = rot(hw * 0.14, hd), r4 = rot(-hw * 0.14, hd);
      const yb = y + 3.2, yt = y + 3.2 + rh, rc = roofCol || COL.roof;
      const shade = k => [rc[0] * k, rc[1] * k, rc[2] * k];
      props.patchQuad([p1[0], yb, p1[1]], [p4[0], yb, p4[1]], [r4[0], yt, r4[1]], [r1[0], yt, r1[1]], rc, TILE.shingle, d, 2.4, 1.6);
      props.patchQuad([p3[0], yb, p3[1]], [p2[0], yb, p2[1]], [r2[0], yt, r2[1]], [r3[0], yt, r3[1]], shade(0.9), TILE.shingle, d, 2.4, 1.6);
      props.quad([p2[0], yb, p2[1]], [p1[0], yb, p1[1]], [r1[0], yt, r1[1]], [r2[0], yt, r2[1]], shade(0.8), TILE.shingle);
      props.quad([p4[0], yb, p4[1]], [p3[0], yb, p3[1]], [r3[0], yt, r3[1]], [r4[0], yt, r4[1]], shade(0.8), TILE.shingle);
      const dz = rot(0, d / 2 + 0.06);
      props.box(dz[0], y + 0.9, dz[1], 1.0, 1.8, 0.12, COL.wood, ry, TILE.plank);
      const w1 = rot(-w / 4, d / 2 + 0.06), w2 = rot(w / 4, d / 2 + 0.06);
      for (const wp of [w1, w2]) {
        props.box(wp[0], y + 2.2, wp[1], 0.78, 0.78, 0.1, [0.45, 0.68, 0.85], ry, TILE.blank);
        props.box(wp[0], y + 2.2, wp[1], 0.9, 0.12, 0.14, COL.wood, ry, TILE.plank);
        props.box(wp[0], y + 2.2, wp[1], 0.12, 0.9, 0.14, COL.wood, ry, TILE.plank);
      }
      colliders.push({ x, z, hx: Math.max(w, d) / 2 + 0.2, hz: Math.max(w, d) / 2 + 0.2 });
    };
    const fence = (x1, z1, x2, z2) => {
      const len = U.dist(x1, z1, x2, z2), n = Math.max(1, Math.round(len / 2));
      const ang = Math.atan2(z2 - z1, x2 - x1);
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = U.lerp(x1, x2, t), z = U.lerp(z1, z2, t), y = this.height(x, z);
        props.box(x, y + 0.6, z, 0.2, 1.2, 0.2, COL.woodLight, 0, TILE.plank);
        if (i < n) {
          const xm = U.lerp(x1, x2, (i + 0.5) / n), zm = U.lerp(z1, z2, (i + 0.5) / n);
          props.box(xm, this.height(xm, zm) + 0.9, zm, len / n, 0.16, 0.1, COL.woodLight, -ang, TILE.plank);
        }
        colliders.push({ x, z, r: 0.35 });
      }
    };
    const torch = (x, z) => {
      const y = this.height(x, z);
      props.box(x, y + 1.1, z, 0.22, 2.2, 0.22, COL.wood, 0, TILE.plank);
      props.cylinder(x, y + 2.3, z, 0.3, 0.36, 0.4, 7, COL.stone, TILE.brick);
      glow.sphere(x, y + 2.7, z, 0.42, COL.flame, 7, 5, 1.3, TILE.blank);
      colliders.push({ x, z, r: 0.35 });
      spawns.props.push({ t: 'firelight', x, z, y: y + 2.7 });
    };

    /* ---- Dorf ---- */
    house(-9, 58, 0.3, 6, 5);
    house(9, 57, -0.4, 6, 5, [1.0, 0.9, 0.86]);
    house(-11, 70, 0.9, 5, 5);
    house(10, 70, -0.8, 6, 5, [0.92, 1.0, 0.94]);
    house(0, 76, Math.PI, 7, 6);
    house(-19, 64, 1.4, 6, 6, [0.95, 0.92, 1.0]);      // Laden
    {   // Ladenschild
      const y = this.height(-15.6, 64);
      props.box(-15.6, y + 2.6, 64, 0.16, 0.9, 0.16, COL.wood, 0, TILE.plank);
      props.box(-15.6, y + 3.2, 64, 1.9, 0.9, 0.14, COL.gold, 0, TILE.metal);
      colliders.push({ x: -15.6, z: 64, r: 0.3 });
    }
    {   // Brunnen
      const wx = 6.5, wz = 63, y = this.height(wx, wz);
      props.cylinder(wx, y + 0.5, wz, 1.5, 1.5, 1.0, 10, COL.stone, TILE.brick);
      props.cylinder(wx, y + 0.95, wz, 1.2, 1.2, 0.3, 10, [0.5, 0.75, 1.0], TILE.water);
      props.box(wx - 1.3, y + 2.0, wz, 0.2, 2.6, 0.2, COL.wood, 0, TILE.plank);
      props.box(wx + 1.3, y + 2.0, wz, 0.2, 2.6, 0.2, COL.wood, 0, TILE.plank);
      props.box(wx, y + 3.3, wz, 3.4, 0.4, 1.6, COL.roof, 0, TILE.shingle, 1.2);
      colliders.push({ x: wx, z: wz, r: 1.7 });
    }
    fence(-24, 50, -24, 78); fence(22, 50, 22, 78);
    fence(-24, 78, -6, 78); fence(6, 78, 22, 78);
    torch(-4, 56); torch(4, 56); torch(-4, 72); torch(4, 72);

    /* ---- Dungeon-Eingang ---- */
    {
      const ex = 0, ez = -70, y = this.height(ex, ez);
      props.box(ex, y + 3.4, ez - 1.6, 11, 7, 4, COL.rockDark, 0, TILE.gravel, 3);
      props.box(ex - 2.6, y + 2.2, ez, 1.6, 4.4, 1.6, COL.stone, 0, TILE.brick, 1.6);
      props.box(ex + 2.6, y + 2.2, ez, 1.6, 4.4, 1.6, COL.stone, 0, TILE.brick, 1.6);
      props.box(ex, y + 4.7, ez, 6.4, 1.0, 1.8, COL.stone, 0, TILE.brick, 1.6);
      props.box(ex, y + 1.9, ez - 0.9, 3.4, 3.8, 0.6, [0.05, 0.04, 0.07], 0, TILE.blank);
      colliders.push({ x: ex - 3.4, z: ez, hx: 2.4, hz: 1.6 });
      colliders.push({ x: ex + 3.4, z: ez, hx: 2.4, hz: 1.6 });
      this.dungeonDoor = { x: ex, z: ez - 0.4 };
    }
    torch(-4.2, -67); torch(4.2, -67);

    /* ---- Feenquelle im Wald ---- */
    {
      const fx = -66, fz = 46, y = this.height(fx, fz);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        props.box(fx + Math.cos(a) * 3.1, y + 0.35, fz + Math.sin(a) * 3.1, 1.1, 0.8, 1.1, COL.stone, a, TILE.brick);
        colliders.push({ x: fx + Math.cos(a) * 3.4, z: fz + Math.sin(a) * 3.4, r: 0.55 });
      }
      props.disc(fx, y + 0.32, fz, 2.9, [0.6, 0.9, 1.0], 20, TILE.water);
      glow.sphere(fx, y + 1.5, fz, 0.7, [0.7, 1.0, 0.95], 8, 6, 1, TILE.blank);
      spawns.props.push({ t: 'spring', x: fx, z: fz, y });
      spawns.props.push({ t: 'firelight', x: fx, z: fz, y: y + 1.5, col: [0.5, 1.0, 0.9] });
    }

    /* ---- Vegetation ---- */
    for (let i = 0; i < 150; i++) {
      const x = -100 + rng() * 78, z = -40 + rng() * 110;
      if (Math.hypot(x, z - 62) < 30 || onPath(x, z) || Math.hypot(x + 66, z - 46) < 8) continue;
      const h = this.height(x, z);
      if (h < WATER_Y + 0.8 || h > 8 || !free(x, z, 1.6)) continue;
      tree(x, z, 0.8 + rng() * 0.7);
    }
    for (let i = 0; i < 45; i++) {
      const x = 10 + rng() * 85, z = -50 + rng() * 130;
      if (Math.hypot(x - 60, z - 6) < 30 || onPath(x, z)) continue;
      const h = this.height(x, z);
      if (h < WATER_Y + 0.9 || h > 8 || !free(x, z, 2.2)) continue;
      tree(x, z, 0.8 + rng() * 0.6);
    }
    for (let i = 0; i < 80; i++) {
      const x = -110 + rng() * 220, z = -100 + rng() * 200;
      if (Math.hypot(x, z - 62) < 26 || onPath(x, z)) continue;
      const h = this.height(x, z);
      if (h < WATER_Y + 0.6 || h > 16 || !free(x, z, 1.6)) continue;
      rock(x, z, 0.7 + rng() * 1.1);
    }
    for (let i = 0; i < 220; i++) {
      const x = -110 + rng() * 220, z = -90 + rng() * 200;
      const h = this.height(x, z);
      if (h < WATER_Y + 0.5 || h > 9 || !free(x, z, 1.0)) continue;
      spawns.grass.push({ x, z });
    }

    /* ---- Gegner ---- */
    const en = (t, x, z) => spawns.enemies.push({ t, x, z });
    en('chuchu', 12, 40); en('chuchu', -14, 36); en('chuchu', 22, 22); en('chuchu', -26, 12);
    en('chuchu', 6, 8); en('chuchu', -8, -12); en('chuchu', 34, 44); en('chuchu', -40, 50);
    en('moblin', -30, 26); en('moblin', -46, -6); en('moblin', 18, -24); en('moblin', -16, -34);
    en('moblin', 40, 62);
    en('keese', -4, -46); en('keese', 8, -50); en('keese', -12, -56); en('keese', 12, -60);
    en('chuchu', 62, 30); en('moblin', 74, -18);
    en('octorok', 30, 8); en('octorok', -34, 44); en('octorok', 48, 40);
    en('octorok', -52, 24); en('octorok', 16, -40); en('octorok', 70, 20);

    /* ---- Truhen & Objekte ---- */
    spawns.chests.push({ x: -58, z: 18, item: 'bomb', label: 'Bomben (10)' });
    spawns.chests.push({ x: 60, z: 6, item: 'bow', label: 'Bogen & 20 Pfeile' });
    spawns.chests.push({ x: 0, z: 80, item: 'rupee20', label: '20 Rubine' });
    spawns.chests.push({ x: -86, z: -14, item: 'potion', label: 'Roter Trank' });
    spawns.props.push({ t: 'crack', x: -18, z: -58 });
    spawns.props.push({ t: 'sign', x: 3.6, z: 44, text: 'Norden: Berg der Ahnen. Vorsicht, Reisender!' });
    spawns.props.push({ t: 'sign', x: -3.6, z: 68, text: 'Willkommen in Ardun. Sprich mit dem Ältesten (E).' });
    spawns.props.push({ t: 'sign', x: -14.4, z: 61, text: 'Kramladen — Pfeile, Bomben und Tränke gegen Rubine.' });
    spawns.props.push({ t: 'sign', x: -62, z: 46, text: 'Die Quelle der Ahnen schenkt Kraft den Müden.' });

    /* ---- NPCs ---- */
    spawns.npcs.push({
      x: 0, z: 66, name: 'Ältester Roan', color: [0.75, 0.72, 0.68],
      lines: ['Du bist wach, {name}! Der Smaragdsplitter wurde aus dem Schrein gestohlen.',
        'Ohne ihn welkt unser Land. Der Dieb floh in die Ruine im Norden.',
        'Nimm mein altes Schwert. Möge es dir treu dienen!'], give: 'sword'
    });
    spawns.npcs.push({
      x: -12, z: 55, name: 'Mira', color: [0.85, 0.55, 0.6],
      lines: ['Hohes Gras versteckt oft Rubine — schwing einfach dein Schwert hinein!',
        'Im Wald soll eine Truhe mit Bomben liegen.']
    });
    spawns.npcs.push({
      x: 12, z: 72, name: 'Torvin', color: [0.55, 0.6, 0.8],
      lines: ['Rissiges Gestein? Da hilft nur eine Bombe.',
        'Auf der Insel im See liegt etwas für Fernkämpfer.']
    });
    spawns.npcs.push({
      x: -15.5, z: 61.5, name: 'Händler Bodo', color: [0.9, 0.75, 0.35], shop: true,
      lines: ['Willkommen im Kramladen! Alles ehrlich erworben — meistens.']
    });
    spawns.npcs.push({
      x: -66, z: 42.5, name: 'Quellgeist', color: [0.6, 0.95, 0.9], fairy: true,
      lines: ['Ruh dich aus, Wanderer. Deine Wunden sollen heilen.']
    });

    this.over = {
      mesh: G.upload(md), props: G.upload(props), glow: G.upload(glow),
      colliders, spawns, baseCol: colliders.length,
      fog: [0.62, 0.79, 0.95], fogNear: 60, fogFar: 195,
      amb: [0.44, 0.45, 0.52], lightCol: [0.80, 0.78, 0.70], light: [0.5, 0.85, 0.35],
      outdoor: true
    };

    const wm = new MeshData();
    const WS = 8, WN = 34, WO = -136;
    for (let i = 0; i < WN; i++) for (let j = 0; j < WN; j++) {
      const x0 = WO + i * WS, z0 = WO + j * WS;
      wm.quad([x0, WATER_Y, z0], [x0, WATER_Y, z0 + WS], [x0 + WS, WATER_Y, z0 + WS], [x0 + WS, WATER_Y, z0], COL.water, TILE.water);
    }
    this.over.water = G.upload(wm);
  },

  /* ---------- Dungeon ---------- */
  buildDungeon() {
    const T = 3.4, W = 33, H = 33;
    const grid = [];
    for (let r = 0; r < H; r++) { grid.push([]); for (let c = 0; c < W; c++) grid[r].push('#'); }
    const carve = (r0, c0, r1, c1) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) grid[r][c] = '.'; };
    carve(2, 8, 10, 24); carve(11, 16, 14, 16); carve(15, 11, 22, 21);
    carve(15, 1, 22, 7); carve(18, 8, 18, 10);
    carve(15, 25, 22, 31); carve(18, 22, 18, 24);
    carve(23, 16, 25, 16); carve(26, 13, 30, 19);

    const t2w = (r, c) => ({ x: (c - W / 2 + 0.5) * T, z: (r - H / 2 + 0.5) * T });
    this.t2w = t2w; this.dunT = T; this.dunGrid = grid; this.dunW = W; this.dunH = H;

    const md = new MeshData(), glow = new MeshData();
    const colliders = [], lights = [];
    const wallH = 6;

    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const p = t2w(r, c);
        if (grid[r][c] === '.') {
          const v = ((r + c) % 2 === 0) ? 1.0 : 0.88;
          md.quad([p.x - T / 2, 0, p.z - T / 2], [p.x - T / 2, 0, p.z + T / 2],
            [p.x + T / 2, 0, p.z + T / 2], [p.x + T / 2, 0, p.z - T / 2], [v, v, v], TILE.dunFloor);
        } else {
          let adj = false;
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr, cc = c + dc;
            if (rr >= 0 && rr < H && cc >= 0 && cc < W && grid[rr][cc] === '.') adj = true;
          }
          if (!adj) continue;
          const v = 0.92 + ((r * 7 + c * 13) % 5) * 0.035;
          md.box(p.x, wallH / 2, p.z, T, wallH, T, [v, v, v], 0, TILE.dunWall, 2.2);
          md.box(p.x, wallH + 0.35, p.z, T * 1.06, 0.7, T * 1.06, COL.stone2, 0, TILE.brick, 1.8);
          colliders.push({ x: p.x, z: p.z, hx: T / 2, hz: T / 2 });
        }
      }
    }
    const torches = [[14, 12], [14, 20], [16, 10], [16, 22], [23, 12], [23, 20], [11, 15], [11, 17],
    [3, 9], [3, 23], [17, 0], [17, 32], [25, 13], [25, 19], [9, 12], [9, 20]];
    for (const [r, c] of torches) {
      if (r < 0 || r >= H || c < 0 || c >= W || grid[r][c] !== '#') continue;
      const p = t2w(r, c);
      md.box(p.x, 2.6, p.z, 0.4, 1.4, 0.4, COL.wood, 0, TILE.plank);
      glow.sphere(p.x, 3.5, p.z, 0.5, COL.flame, 7, 5, 1.25, TILE.blank);
      lights.push({ x: p.x, y: 3.5, z: p.z });
    }

    const spawns = { enemies: [], chests: [], pots: [] };
    const en = (t, r, c) => { const p = t2w(r, c); spawns.enemies.push({ t, x: p.x, z: p.z }); };
    const pot = (r, c) => { const p = t2w(r, c); spawns.pots.push({ x: p.x, z: p.z }); };

    en('moblin', 17, 13); en('moblin', 20, 19); en('chuchu', 18, 16); en('chuchu', 21, 13);
    pot(16, 12); pot(16, 20); pot(21, 20); pot(21, 12);
    en('chuchu', 16, 3); en('chuchu', 18, 5); en('chuchu', 21, 2); en('chuchu', 20, 6); en('keese', 17, 4);
    { const p = t2w(18, 2); spawns.chests.push({ x: p.x, z: p.z, item: 'heart_container', label: 'Herzcontainer' }); }
    en('keese', 16, 27); en('keese', 20, 29); en('moblin', 18, 28); en('moblin', 21, 26); en('octorok', 17, 30);
    { const p = t2w(18, 30); spawns.chests.push({ x: p.x, z: p.z, item: 'key', label: 'Kleiner Schlüssel' }); }
    pot(15, 25); pot(22, 31);
    en('boss', 5, 16);
    { const p = t2w(3, 16); spawns.chests.push({ x: p.x, z: p.z, item: 'shard', label: 'Smaragdsplitter', hidden: true }); }

    this.dun = {
      mesh: G.upload(md), glow: G.upload(glow), colliders, spawns, lights, baseCol: colliders.length,
      door: { x: t2w(12, 16).x, z: t2w(12, 16).z, open: false },
      bossGate: t2w(11, 16), exit: t2w(30, 16), start: t2w(29, 16),
      bossRoom: { minX: t2w(2, 8).x - T / 2, maxX: t2w(2, 24).x + T / 2, minZ: t2w(2, 8).z - T / 2, maxZ: t2w(10, 8).z + T / 2 },
      fog: [0.05, 0.045, 0.08], fogNear: 16, fogFar: 60,
      amb: [0.30, 0.28, 0.38], lightCol: [0.55, 0.50, 0.48], light: [0.35, 0.9, 0.25],
      outdoor: false
    };
  },

  enter(scene) { this.scene = scene; this.cur = scene === 'dun' ? this.dun : this.over; },

  /* ---------- Kollision ---------- */
  blockedStatic(x, z, r) {
    const cs = this.cur.colliders;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (c.disabled) continue;
      if (c.r !== undefined) { if (U.dist2(x, z, c.x, c.z) < (c.r + r) * (c.r + r)) return true; }
      else if (Math.abs(x - c.x) < c.hx + r && Math.abs(z - c.z) < c.hz + r) return true;
    }
    return false;
  },

  move(px, pz, dx, dz, r) {
    let x = px, z = pz;
    const ok = (nx, nz) => {
      if (this.blockedStatic(nx, nz, r)) return false;
      if (this.scene === 'over') {
        const h0 = this.height(x, z), h1 = this.height(nx, nz);
        const d = Math.hypot(nx - x, nz - z) || 0.001;
        if ((h1 - h0) / d > 1.45) return false;
        if (h1 < WATER_Y - 1.7) return false;
        if (Math.hypot(nx, nz) > WORLD_R + 6) return false;
      }
      return true;
    };
    if (ok(x + dx, z)) x += dx;
    if (ok(x, z + dz)) z += dz;
    if (dx !== 0 && dz !== 0 && x === px && z === pz && ok(x + dx * 0.5, z + dz * 0.5)) { x += dx * 0.5; z += dz * 0.5; }
    return { x, z };
  },

  inWater(x, z) { return this.scene === 'over' && this.height(x, z) < WATER_Y - 0.05; }
};
