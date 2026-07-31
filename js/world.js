'use strict';
/* =========================================================
   WORLD — Terrain, Props, Kollision, Dungeon
   ========================================================= */

const WATER_Y = 0.0;
const LAND_BASE = 2.5;
const WORLD_R = 118;

const COL = {
  grass: [0.34, 0.60, 0.27], grass2: [0.42, 0.68, 0.30], grassDry: [0.55, 0.64, 0.30],
  sand: [0.80, 0.74, 0.50], rock: [0.47, 0.47, 0.52], rockDark: [0.36, 0.36, 0.41],
  dirt: [0.55, 0.43, 0.30], wood: [0.45, 0.31, 0.19], woodLight: [0.62, 0.45, 0.28],
  leaf: [0.20, 0.47, 0.22], leaf2: [0.26, 0.55, 0.25], leaf3: [0.16, 0.40, 0.20],
  roof: [0.62, 0.24, 0.20], wall: [0.86, 0.80, 0.66], water: [0.20, 0.48, 0.72],
  stone: [0.44, 0.44, 0.50], stone2: [0.36, 0.36, 0.42], floor: [0.30, 0.29, 0.34],
  gold: [0.90, 0.74, 0.24], flame: [1.0, 0.62, 0.15]
};

const World = {
  scene: 'over',
  over: null, dun: null,
  cur: null,

  /* ---------- Höhenfeld Overworld ---------- */
  height(x, z) {
    if (this.scene === 'dun') return 0;
    let hills = Math.sin(x * 0.048) * Math.cos(z * 0.042) * 1.35 + Math.sin((x * 0.7 + z * 0.9) * 0.031) * 1.05;
    // Dorf flach halten
    const dv = Math.hypot(x - 0, z - 62);
    hills *= U.clamp((dv - 13) / 15, 0.12, 1);
    // Seebecken glatt halten, damit die Wassertiefe stimmt
    const dl = Math.hypot(x - 60, z - 6);
    if (dl < 22) hills *= U.clamp((dl - 6) / 16, 0.15, 1);
    let h = LAND_BASE + hills;
    // Bergkette im Norden
    let m = U.clamp((-z - 50) / 15, 0, 1); m = U.smooth(m);
    let ridge = m * 19;
    // Passage in der Mitte (Weg zum Dungeon)
    const pass = U.clamp(1 - Math.abs(x) / 12, 0, 1);
    ridge *= 1 - U.smooth(pass) * 0.88;
    h += ridge;
    // Seebecken
    if (dl < 30) h -= U.smooth(1 - dl / 30) * 4.6;
    // Insel im See
    if (dl < 6.5) h += U.smooth(1 - dl / 6.5) * 5.6;
    // Ozean-Abfall am Rand
    const dr = Math.hypot(x, z);
    if (dr > WORLD_R - 24) h -= (dr - (WORLD_R - 24)) * 0.85;
    return h;
  },

  terrainColor(x, z, h, slope) {
    if (h < WATER_Y + 0.45) return COL.sand;
    if (slope > 0.85) return h > 8 ? COL.rockDark : COL.rock;
    if (h > 9) return COL.rock;
    // Weg vom Dorf zum Berg
    if (Math.abs(x) < 3.2 && z < 58 && z > -66) return COL.dirt;
    // Dorfplatz
    if (Math.hypot(x, z - 62) < 11) return COL.grassDry;
    const n = Math.sin(x * 0.9) * Math.cos(z * 0.8);
    return n > 0.25 ? COL.grass2 : COL.grass;
  },

  /* ---------- Aufbau ---------- */
  build() {
    this.buildOver();
    this.buildDungeon();
    this.cur = this.over;
  },

  buildOver() {
    const rng = mulberry32(20260731);
    const md = new MeshData();
    const props = new MeshData();
    const colliders = [];
    const spawns = { enemies: [], props: [], grass: [], npcs: [], chests: [] };

    /* Terrain */
    const S = 2.4, N = Math.ceil((WORLD_R + 16) * 2 / S);
    const O = -(WORLD_R + 16);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const x0 = O + i * S, z0 = O + j * S, x1 = x0 + S, z1 = z0 + S;
        const h00 = this.height(x0, z0), h10 = this.height(x1, z0), h11 = this.height(x1, z1), h01 = this.height(x0, z1);
        if (h00 < WATER_Y - 5 && h10 < WATER_Y - 5 && h11 < WATER_Y - 5 && h01 < WATER_Y - 5) continue;
        const hm = (h00 + h10 + h11 + h01) / 4;
        const slope = (Math.abs(h00 - h11) + Math.abs(h10 - h01)) / (S * 1.4);
        const c = this.terrainColor(x0 + S / 2, z0 + S / 2, hm, slope);
        const v = 0.92 + rng() * 0.16;
        const cc = [c[0] * v, c[1] * v, c[2] * v];
        md.quad([x0, h00, z0], [x0, h01, z1], [x1, h11, z1], [x1, h10, z0], cc);
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

    /* --- Baum --- */
    const tree = (x, z, s) => {
      const y = this.height(x, z);
      props.cylinder(x, y + 1.5 * s, z, 0.42 * s, 0.30 * s, 3.0 * s, 6, COL.wood);
      const lc = [COL.leaf, COL.leaf2, COL.leaf3][Math.floor(rng() * 3)];
      props.cylinder(x, y + 3.6 * s, z, 1.9 * s, 0.05, 2.4 * s, 7, lc);
      props.cylinder(x, y + 5.0 * s, z, 1.45 * s, 0.05, 2.0 * s, 7, [lc[0] * 1.1, lc[1] * 1.1, lc[2] * 1.1]);
      props.cylinder(x, y + 6.1 * s, z, 0.95 * s, 0.05, 1.6 * s, 7, lc);
      colliders.push({ x, z, r: 0.8 * s });
    };
    /* --- Fels --- */
    const rock = (x, z, s) => {
      const y = this.height(x, z);
      props.sphere(x, y + 0.35 * s, z, 0.9 * s, COL.rock, 6, 4, 0.8);
      props.box(x + 0.3 * s, y + 0.2 * s, z - 0.2 * s, 0.9 * s, 0.8 * s, 0.9 * s, COL.rockDark, rng() * 2);
      colliders.push({ x, z, r: 0.95 * s });
    };
    /* --- Haus --- */
    const house = (x, z, ry, w, d) => {
      const y = this.height(x, z);
      props.box(x, y + 1.6, z, w, 3.2, d, COL.wall, ry);
      // Dach
      const rh = 1.6, hw = w / 2 + 0.4, hd = d / 2 + 0.4;
      const co = Math.cos(ry), si = Math.sin(ry);
      const rot = (px, pz) => [x + px * co + pz * si, z - px * si + pz * co];
      const p1 = rot(-hw, -hd), p2 = rot(hw, -hd), p3 = rot(hw, hd), p4 = rot(-hw, hd);
      const r1 = rot(-hw * 0.15, -hd), r2 = rot(hw * 0.15, -hd), r3 = rot(hw * 0.15, hd), r4 = rot(-hw * 0.15, hd);
      const yb = y + 3.2, yt = y + 3.2 + rh;
      props.quad([p1[0], yb, p1[1]], [p4[0], yb, p4[1]], [r4[0], yt, r4[1]], [r1[0], yt, r1[1]], COL.roof);
      props.quad([p3[0], yb, p3[1]], [p2[0], yb, p2[1]], [r2[0], yt, r2[1]], [r3[0], yt, r3[1]], [COL.roof[0] * 0.85, COL.roof[1] * 0.85, COL.roof[2] * 0.85]);
      props.quad([p2[0], yb, p2[1]], [p1[0], yb, p1[1]], [r1[0], yt, r1[1]], [r2[0], yt, r2[1]], [COL.roof[0] * 0.7, COL.roof[1] * 0.7, COL.roof[2] * 0.7]);
      props.quad([p4[0], yb, p4[1]], [p3[0], yb, p3[1]], [r3[0], yt, r3[1]], [r4[0], yt, r4[1]], [COL.roof[0] * 0.7, COL.roof[1] * 0.7, COL.roof[2] * 0.7]);
      // Tür + Fenster
      const dz = rot(0, d / 2 + 0.06);
      props.box(dz[0], y + 0.9, dz[1], 1.0, 1.8, 0.12, COL.wood, ry);
      const w1 = rot(-w / 4, d / 2 + 0.06), w2 = rot(w / 4, d / 2 + 0.06);
      props.box(w1[0], y + 2.2, w1[1], 0.7, 0.7, 0.12, [0.35, 0.55, 0.7], ry);
      props.box(w2[0], y + 2.2, w2[1], 0.7, 0.7, 0.12, [0.35, 0.55, 0.7], ry);
      colliders.push({ x, z, hx: Math.max(w, d) / 2 + 0.2, hz: Math.max(w, d) / 2 + 0.2 });
    };
    /* --- Zaun --- */
    const fence = (x1, z1, x2, z2) => {
      const len = U.dist(x1, z1, x2, z2), n = Math.max(1, Math.round(len / 2));
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = U.lerp(x1, x2, t), z = U.lerp(z1, z2, t), y = this.height(x, z);
        props.box(x, y + 0.6, z, 0.18, 1.2, 0.18, COL.woodLight);
        if (i < n) {
          const xm = U.lerp(x1, x2, (i + 0.5) / n), zm = U.lerp(z1, z2, (i + 0.5) / n);
          const ang = Math.atan2(z2 - z1, x2 - x1);
          props.box(xm, this.height(xm, zm) + 0.85, zm, len / n, 0.14, 0.1, COL.woodLight, -ang);
        }
        colliders.push({ x, z, r: 0.35 });
      }
    };

    /* ---- Dorf (Süden) ---- */
    house(-9, 58, 0.3, 6, 5);
    house(9, 57, -0.4, 6, 5);
    house(-11, 70, 0.9, 5, 5);
    house(10, 70, -0.8, 6, 5);
    house(0, 76, Math.PI, 7, 6);
    // Brunnen (neben dem Weg, nicht darauf)
    {
      const wx = 6.5, wz = 63, y = this.height(wx, wz);
      props.cylinder(wx, y + 0.5, wz, 1.5, 1.5, 1.0, 10, COL.stone);
      props.cylinder(wx, y + 0.9, wz, 1.2, 1.2, 0.3, 10, [0.2, 0.35, 0.5]);
      props.box(wx - 1.3, y + 2.0, wz, 0.2, 2.6, 0.2, COL.wood);
      props.box(wx + 1.3, y + 2.0, wz, 0.2, 2.6, 0.2, COL.wood);
      props.box(wx, y + 3.2, wz, 3.2, 0.3, 1.4, COL.roof);
      colliders.push({ x: wx, z: wz, r: 1.7 });
    }
    fence(-20, 50, -20, 78); fence(20, 50, 20, 78);
    fence(-20, 78, -6, 78); fence(6, 78, 20, 78);

    /* ---- Dungeon-Eingang am Berg ---- */
    {
      const ex = 0, ez = -70, y = this.height(ex, ez);
      props.box(ex, y + 3.4, ez - 1.6, 11, 7, 4, COL.rockDark);
      props.box(ex - 2.6, y + 2.2, ez, 1.6, 4.4, 1.6, COL.stone);
      props.box(ex + 2.6, y + 2.2, ez, 1.6, 4.4, 1.6, COL.stone);
      props.box(ex, y + 4.7, ez, 6.4, 1.0, 1.8, COL.stone);
      props.box(ex, y + 1.9, ez - 0.9, 3.4, 3.8, 0.6, [0.06, 0.05, 0.08]);
      colliders.push({ x: ex - 3.4, z: ez, hx: 2.4, hz: 1.6 });
      colliders.push({ x: ex + 3.4, z: ez, hx: 2.4, hz: 1.6 });
      this.dungeonDoor = { x: ex, z: ez - 0.4 };
    }

    /* ---- Wald (Westen) ---- */
    for (let i = 0; i < 150; i++) {
      const x = -100 + rng() * 78, z = -40 + rng() * 110;
      if (Math.hypot(x, z - 62) < 26 || onPath(x, z)) continue;
      if (this.height(x, z) < WATER_Y + 0.8 || this.height(x, z) > 8) continue;
      if (!free(x, z, 1.6)) continue;
      tree(x, z, 0.8 + rng() * 0.7);
    }
    /* ---- Einzelbäume Osten ---- */
    for (let i = 0; i < 45; i++) {
      const x = 10 + rng() * 85, z = -50 + rng() * 130;
      if (Math.hypot(x - 60, z - 6) < 30 || onPath(x, z)) continue;
      if (this.height(x, z) < WATER_Y + 0.9 || this.height(x, z) > 8) continue;
      if (!free(x, z, 2.2)) continue;
      tree(x, z, 0.8 + rng() * 0.6);
    }
    /* ---- Felsen ---- */
    for (let i = 0; i < 80; i++) {
      const x = -110 + rng() * 220, z = -100 + rng() * 200;
      if (Math.hypot(x, z - 62) < 22 || onPath(x, z)) continue;
      const h = this.height(x, z);
      if (h < WATER_Y + 0.6 || h > 16) continue;
      if (!free(x, z, 1.6)) continue;
      rock(x, z, 0.7 + rng() * 1.1);
    }

    /* ---- Gras-Büschel (schneidbar) ---- */
    for (let i = 0; i < 190; i++) {
      const x = -110 + rng() * 220, z = -90 + rng() * 200;
      const h = this.height(x, z);
      if (h < WATER_Y + 0.5 || h > 9) continue;
      if (!free(x, z, 1.0)) continue;
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

    /* ---- Truhen & Objekte ---- */
    spawns.chests.push({ x: -58, z: 18, item: 'bomb', label: 'Bomben (10)' });
    spawns.chests.push({ x: 60, z: 6, item: 'bow', label: 'Bogen & 20 Pfeile' });
    spawns.chests.push({ x: 0, z: 80, item: 'rupee20', label: '20 Rubine' });
    spawns.props.push({ t: 'crack', x: -18, z: -58 });   // bombbarer Fels
    spawns.props.push({ t: 'sign', x: 3.6, z: 44, text: 'Norden: Berg der Ahnen. Vorsicht, Reisender!' });
    spawns.props.push({ t: 'sign', x: -3.6, z: 68, text: 'Willkommen in Ardun. Sprich mit dem Ältesten (E).' });

    /* ---- NPCs ---- */
    spawns.npcs.push({
      x: 0, z: 66, name: 'Ältester Roan', color: [0.75, 0.72, 0.68],
      lines: [
        'Du bist wach, {name}! Der Smaragdsplitter wurde aus dem Schrein gestohlen.',
        'Ohne ihn welkt unser Land. Der Dieb floh in die Ruine im Norden.',
        'Nimm mein altes Schwert. Möge es dir treu dienen!'
      ], give: 'sword'
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

    this.over = {
      mesh: G.upload(md), props: G.upload(props), colliders, spawns, baseCol: colliders.length,
      fog: [0.55, 0.75, 0.92], fogNear: 55, fogFar: 175, amb: 0.42,
      light: [0.5, 0.85, 0.35]
    };

    /* Wasser */
    const wm = new MeshData();
    const WS = 8, WN = 34, WO = -136;
    for (let i = 0; i < WN; i++) for (let j = 0; j < WN; j++) {
      const x0 = WO + i * WS, z0 = WO + j * WS;
      wm.quad([x0, WATER_Y, z0], [x0, WATER_Y, z0 + WS], [x0 + WS, WATER_Y, z0 + WS], [x0 + WS, WATER_Y, z0], COL.water);
    }
    this.over.water = G.upload(wm);
  },

  /* ---------- Dungeon ---------- */
  buildDungeon() {
    const T = 3.4, W = 33, H = 33;
    const grid = [];
    for (let r = 0; r < H; r++) { grid.push([]); for (let c = 0; c < W; c++) grid[r].push('#'); }
    const carve = (r0, c0, r1, c1) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) grid[r][c] = '.'; };

    carve(2, 8, 10, 24);     // Bossraum
    carve(11, 16, 14, 16);   // Korridor zum Boss
    carve(15, 11, 22, 21);   // Hub
    carve(15, 1, 22, 7);     // Westraum
    carve(18, 8, 18, 10);    // Korridor West
    carve(15, 25, 22, 31);   // Ostraum
    carve(18, 22, 18, 24);   // Korridor Ost
    carve(23, 16, 25, 16);   // Korridor Süd
    carve(26, 13, 30, 19);   // Eingangsraum

    const t2w = (r, c) => ({ x: (c - W / 2 + 0.5) * T, z: (r - H / 2 + 0.5) * T });
    this.t2w = t2w; this.dunT = T;

    const md = new MeshData(), glow = new MeshData();
    const colliders = [];
    const wallH = 6;

    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const p = t2w(r, c);
        if (grid[r][c] === '.') {
          const v = ((r + c) % 2 === 0) ? 1.0 : 0.9;
          md.quad([p.x - T / 2, 0, p.z - T / 2], [p.x - T / 2, 0, p.z + T / 2], [p.x + T / 2, 0, p.z + T / 2], [p.x + T / 2, 0, p.z - T / 2],
            [COL.floor[0] * v, COL.floor[1] * v, COL.floor[2] * v]);
        } else {
          // nur Wände, die an Boden grenzen
          let adj = false;
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr, cc = c + dc;
            if (rr >= 0 && rr < H && cc >= 0 && cc < W && grid[rr][cc] === '.') adj = true;
          }
          if (!adj) continue;
          const v = 0.9 + ((r * 7 + c * 13) % 5) * 0.04;
          md.box(p.x, wallH / 2, p.z, T, wallH, T, [COL.stone[0] * v, COL.stone[1] * v, COL.stone[2] * v]);
          md.box(p.x, wallH + 0.35, p.z, T * 1.06, 0.7, T * 1.06, COL.stone2);
          colliders.push({ x: p.x, z: p.z, hx: T / 2, hz: T / 2 });
        }
      }
    }
    // Fackeln
    const torches = [[14, 12], [14, 20], [16, 10], [16, 22], [23, 12], [23, 20], [11, 15], [11, 17], [3, 9], [3, 23], [17, 0], [17, 32]];
    for (const [r, c] of torches) {
      if (r < 0 || r >= H || c < 0 || c >= W || grid[r][c] !== '#') continue;
      const p = t2w(r, c);
      md.box(p.x, 2.6, p.z, 0.4, 1.4, 0.4, COL.wood);
      glow.sphere(p.x, 3.5, p.z, 0.55, COL.flame, 7, 5, 1.2);
    }

    const spawns = { enemies: [], chests: [], pots: [] };
    const en = (t, r, c) => { const p = t2w(r, c); spawns.enemies.push({ t, x: p.x, z: p.z }); };
    const pot = (r, c) => { const p = t2w(r, c); spawns.pots.push({ x: p.x, z: p.z }); };

    en('moblin', 17, 13); en('moblin', 20, 19); en('chuchu', 18, 16); en('chuchu', 21, 13);
    pot(16, 12); pot(16, 20); pot(21, 20); pot(21, 12);

    en('chuchu', 16, 3); en('chuchu', 18, 5); en('chuchu', 21, 2); en('chuchu', 20, 6); en('keese', 17, 4);
    { const p = t2w(18, 2); spawns.chests.push({ x: p.x, z: p.z, item: 'heart_container', label: 'Herzcontainer' }); }

    en('keese', 16, 27); en('keese', 20, 29); en('moblin', 18, 28); en('moblin', 21, 26); en('chuchu', 17, 30);
    { const p = t2w(18, 30); spawns.chests.push({ x: p.x, z: p.z, item: 'key', label: 'Kleiner Schlüssel', guard: 'east' }); }
    pot(15, 25); pot(22, 31);

    en('boss', 5, 16);
    { const p = t2w(3, 16); spawns.chests.push({ x: p.x, z: p.z, item: 'shard', label: 'Smaragdsplitter', hidden: true }); }

    const doorTile = t2w(12, 16);
    const exitTile = t2w(30, 16);
    const startTile = t2w(29, 16);
    const bossGateA = t2w(11, 16);

    this.dun = {
      mesh: G.upload(md), glow: G.upload(glow), colliders, spawns, baseCol: colliders.length,
      door: { x: doorTile.x, z: doorTile.z, open: false },
      bossGate: { x: bossGateA.x, z: bossGateA.z, closed: false },
      exit: exitTile, start: startTile,
      bossRoom: { minX: t2w(2, 8).x - T / 2, maxX: t2w(2, 24).x + T / 2, minZ: t2w(2, 8).z - T / 2, maxZ: t2w(10, 8).z + T / 2 },
      fog: [0.06, 0.055, 0.09], fogNear: 18, fogFar: 62, amb: 0.34,
      light: [0.35, 0.9, 0.25]
    };
  },

  enter(scene) {
    this.scene = scene;
    this.cur = scene === 'dun' ? this.dun : this.over;
  },

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

  /* verschiebt (px,pz) um (dx,dz) mit Radius r, achsenweise */
  move(px, pz, dx, dz, r, isPlayer) {
    let x = px, z = pz;
    const ok = (nx, nz) => {
      if (this.blockedStatic(nx, nz, r)) return false;
      if (this.scene === 'over') {
        const h0 = this.height(x, z), h1 = this.height(nx, nz);
        const d = Math.hypot(nx - x, nz - z) || 0.001;
        if ((h1 - h0) / d > 1.45) return false;           // zu steil
        if (h1 < WATER_Y - 1.7) return false;             // zu tief zum Waten
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
