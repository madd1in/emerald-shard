'use strict';
/* =========================================================
   ENTITIES — Modelle mit Toon-Kontur und Gegner-KI
   ========================================================= */

const Ents = (() => {
  const pool = []; for (let i = 0; i < 12; i++) pool.push(M4.create());
  const scratch = M4.create();
  const S = { outline: 0.03 };           // 0 = Konturen aus (Performance)

  function node(out, parent, px, py, pz, rx, ry, rz, sx, sy, sz) {
    M4.compose(scratch, px, py, pz, rx, ry, rz, sx, sy, sz);
    if (parent) M4.multiply(out, parent, scratch); else out.set(scratch);
    return out;
  }
  /* Körperteil: mit Kontur */
  function P(parent, prim, px, py, pz, rx, ry, rz, sx, sy, sz, col, opt) {
    node(pool[0], parent, px, py, pz, rx, ry, rz, sx, sy, sz);
    if (S.outline && !(opt && opt.noOutline)) {
      opt = opt || {};
      const o = {}; for (const k in opt) o[k] = opt[k];
      // Verschiebung in lokalen Einheiten: Weltdicke = outline * größte Achsenskalierung
      o.outline = S.outline / Math.max(0.25, Math.abs(sx), Math.abs(sy), Math.abs(sz));
      G.draw(prim, pool[0], col, o);
    } else G.draw(prim, pool[0], col, opt);
  }
  /* Detail ohne Kontur (Augen, Effekte) */
  function D(parent, prim, px, py, pz, rx, ry, rz, sx, sy, sz, col, opt) {
    node(pool[0], parent, px, py, pz, rx, ry, rz, sx, sy, sz);
    G.draw(prim, pool[0], col, opt);
  }

  const SKIN = [0.94, 0.78, 0.62], GREEN = [0.22, 0.60, 0.26], BEIGE = [0.90, 0.86, 0.72];
  const BROWN = [0.42, 0.28, 0.16], STEEL = [0.78, 0.80, 0.86], HAIR = [0.85, 0.68, 0.28];

  function shadow(x, y, z, r, alpha) {
    node(pool[1], null, x, y + 0.03, z, 0, 0, 0, r * 2, 1, r * 2);
    G.draw(PRIM.disc, pool[1], [0, 0, 0, alpha === undefined ? 0.3 : alpha], { noDepthWrite: true, noTex: true });
  }

  /* ---------- Held ---------- */
  function drawPlayer(p, time) {
    const root = node(pool[2], null, p.x, p.y, p.z, 0, p.yaw, 0, 1, 1, 1);
    const flash = p.invuln > 0 && Math.floor(p.invuln * 18) % 2 === 0;
    const tint = k => flash ? [1, 0.5, 0.5] : k;
    const w = p.walkPhase;
    const sw = p.speed > 0.4 ? Math.sin(w) * 0.6 : 0;
    const bob = p.speed > 0.4 ? Math.abs(Math.sin(w)) * 0.06 : Math.sin(time * 2) * 0.02;
    const roll = p.rollT > 0 ? (1 - p.rollT / 0.42) * Math.PI * 2 : 0;
    if (roll) node(root, null, p.x, p.y + 0.5, p.z, roll, p.yaw, 0, 1, 1, 1);

    P(root, PRIM.box, -0.19, 0.36, 0, sw, 0, 0, 0.26, 0.72, 0.26, tint(BEIGE));
    P(root, PRIM.box, 0.19, 0.36, 0, -sw, 0, 0, 0.26, 0.72, 0.26, tint(BEIGE));
    P(root, PRIM.box, -0.19, 0.08, 0.05, 0, 0, 0, 0.3, 0.2, 0.4, tint(BROWN));
    P(root, PRIM.box, 0.19, 0.08, 0.05, 0, 0, 0, 0.3, 0.2, 0.4, tint(BROWN));
    P(root, PRIM.box, 0, 1.06 + bob, 0, 0, 0, 0, 0.78, 0.86, 0.56, tint(GREEN));
    P(root, PRIM.box, 0, 0.72 + bob, 0, 0, 0, 0, 0.82, 0.16, 0.6, tint(BROWN));
    const hy = 1.75 + bob;
    P(root, PRIM.box, 0, hy, 0, 0, 0, 0, 0.62, 0.6, 0.6, tint(SKIN));
    P(root, PRIM.box, 0, hy + 0.12, -0.13, 0, 0, 0, 0.66, 0.42, 0.42, tint(HAIR));
    P(root, PRIM.box, -0.35, hy + 0.02, 0, 0, 0, 0, 0.12, 0.26, 0.3, tint(SKIN));
    P(root, PRIM.box, 0.35, hy + 0.02, 0, 0, 0, 0, 0.12, 0.26, 0.3, tint(SKIN));
    D(root, PRIM.box, -0.13, hy + 0.02, 0.31, 0, 0, 0, 0.1, 0.13, 0.06, [0.1, 0.1, 0.15]);
    D(root, PRIM.box, 0.13, hy + 0.02, 0.31, 0, 0, 0, 0.1, 0.13, 0.06, [0.1, 0.1, 0.15]);
    P(root, PRIM.cone, 0, hy + 0.5, -0.02, 0.35, 0, 0, 0.72, 1.15, 0.72, tint(GREEN));

    let ra = -sw * 0.8, la = sw * 0.8;
    if (p.attackT > 0) {
      const t = 1 - p.attackT / p.attackDur;
      ra = U.lerp(-2.3, 0.9, U.smooth(U.clamp(t * 1.4, 0, 1)));
    }
    const arm = node(pool[3], root, 0.5, 1.32 + bob, 0, 0, 0, 0, 1, 1, 1);
    P(arm, PRIM.box, 0, -0.28 * Math.cos(ra), 0.28 * Math.sin(ra), ra, 0, 0, 0.22, 0.62, 0.22, tint(SKIN));

    const blocking = p.blocking && p.items.shield;
    P(root, PRIM.box, -0.5, 1.05 + bob - 0.1, Math.sin(la) * 0.2, blocking ? -0.9 : la, 0, 0, 0.22, 0.62, 0.22, tint(SKIN));
    if (p.items.shield) {
      const sx = blocking ? -0.30 : -0.62, sz = blocking ? 0.5 : 0.22, sr = blocking ? 0 : 0.1;
      P(root, PRIM.box, sx, 1.1 + bob, sz, 0, blocking ? Math.PI / 2 : 0, sr, 0.16, 0.8, 0.62, [0.35, 0.42, 0.72]);
      D(root, PRIM.box, sx - (blocking ? 0 : 0.08), 1.1 + bob, sz + (blocking ? 0.1 : 0), 0, blocking ? Math.PI / 2 : 0, sr, 0.06, 0.5, 0.36, COL.gold);
    }
    if (p.items.sword) {
      const hand = node(pool[5], root, 0.52, 1.32 + bob, 0, 0, 0, 0, 1, 1, 1);
      const g = node(pool[6], hand, 0, -0.55 * Math.cos(ra), 0.55 * Math.sin(ra) - 0.05, ra, 0, 0, 1, 1, 1);
      P(g, PRIM.box, 0, 0.12, 0, 0, 0, 0, 0.1, 0.28, 0.1, BROWN);
      P(g, PRIM.box, 0, 0.28, 0, 0, 0, 0, 0.42, 0.08, 0.14, COL.gold);
      P(g, PRIM.box, 0, 0.95, 0, 0, 0, 0, 0.14, 1.25, 0.05, STEEL);
      P(g, PRIM.cone, 0, 1.72, 0, 0, 0, 0, 0.14, 0.35, 0.05, STEEL);
    }
    if (p.attackT > 0 && p.items.sword) {
      const t = 1 - p.attackT / p.attackDur;
      const a = U.lerp(-1.3, 1.5, U.smooth(U.clamp(t * 1.3, 0, 1)));
      for (let i = 0; i < 4; i++) {
        const aa = a - i * 0.26, al = (0.34 - i * 0.07) * (1 - t * 0.55);
        if (al <= 0) continue;
        D(root, PRIM.box, Math.sin(aa) * 1.35, 1.15 + Math.cos(aa) * 0.15, Math.cos(aa) * 1.35, 0, -aa, 0,
          1.0, 0.1, 0.22, [1, 1, 0.9, al], { noDepthWrite: true, emis: 0.9, noTex: true });
      }
    }
    shadow(p.x, World.height(p.x, p.z), p.z, 0.5, 0.32);
  }

  /* ---------- NPC ---------- */
  function drawNPC(n, time) {
    const root = node(pool[2], null, n.x, n.y, n.z, 0, n.yaw, 0, 1, 1, 1);
    const bob = Math.sin(time * 1.6 + n.x) * 0.03;
    const glow = n.fairy ? { emis: 0.55 } : undefined;
    P(root, PRIM.box, -0.18, 0.35, 0, 0, 0, 0, 0.26, 0.7, 0.26, BROWN, glow);
    P(root, PRIM.box, 0.18, 0.35, 0, 0, 0, 0, 0.26, 0.7, 0.26, BROWN, glow);
    P(root, PRIM.box, 0, 1.05 + bob, 0, 0, 0, 0, 0.8, 0.85, 0.58, n.color, glow);
    P(root, PRIM.box, 0, 1.72 + bob, 0, 0, 0, 0, 0.6, 0.58, 0.58, n.fairy ? n.color : SKIN, glow);
    P(root, PRIM.box, 0, 1.9 + bob, -0.06, 0, 0, 0, 0.66, 0.3, 0.62, [0.85, 0.85, 0.85], glow);
    D(root, PRIM.box, -0.13, 1.74 + bob, 0.3, 0, 0, 0, 0.1, 0.1, 0.06, [0.1, 0.1, 0.15]);
    D(root, PRIM.box, 0.13, 1.74 + bob, 0.3, 0, 0, 0, 0.1, 0.1, 0.06, [0.1, 0.1, 0.15]);
    P(root, PRIM.box, -0.5, 1.05 + bob, 0, 0, 0, 0, 0.2, 0.6, 0.2, n.fairy ? n.color : SKIN, glow);
    P(root, PRIM.box, 0.5, 1.05 + bob, 0, 0, 0, 0, 0.2, 0.6, 0.2, n.fairy ? n.color : SKIN, glow);
    if (n.beard) P(root, PRIM.box, 0, 1.5 + bob, 0.22, 0, 0, 0, 0.34, 0.4, 0.2, [0.9, 0.9, 0.9]);
    if (n.shop) {
      P(root, PRIM.box, 0, 2.16 + bob, 0, 0, 0, 0, 0.9, 0.18, 0.9, [0.5, 0.35, 0.2]);
      P(root, PRIM.cone, 0, 2.4 + bob, 0, 0, 0, 0, 0.7, 0.5, 0.7, [0.6, 0.42, 0.24]);
    }
    if (n.fairy) {
      for (let i = 0; i < 3; i++) {
        const a = time * 1.6 + i * 2.1;
        G.sprite(n.x + Math.cos(a) * 1.4, n.y + 1.6 + Math.sin(a * 1.7) * 0.5, n.z + Math.sin(a) * 1.4,
          0.28, 0.28, [0.7, 1, 0.95, 0.85], { emis: 1, noDepthWrite: true, noTex: true });
      }
    }
    shadow(n.x, World.height(n.x, n.z), n.z, 0.48, 0.28);
  }

  /* ---------- Gegner ---------- */
  function drawEnemy(e, time) {
    const flash = e.hurtT > 0;
    const T = c => flash ? [1, 0.45, 0.4] : c;
    if (e.t === 'chuchu') {
      const sq = 1 + Math.sin(e.anim * 6) * 0.16;
      const root = node(pool[2], null, e.x, e.y, e.z, 0, e.yaw, 0, 1, 1, 1);
      P(root, PRIM.sphere, 0, 0.5 / sq, 0, 0, 0, 0, 1.05 * sq, 1.0 / sq, 1.05 * sq, T([0.35, 0.75, 0.95]));
      D(root, PRIM.sphere, -0.2, 0.62, 0.36, 0, 0, 0, 0.16, 0.16, 0.1, [0.05, 0.05, 0.1]);
      D(root, PRIM.sphere, 0.2, 0.62, 0.36, 0, 0, 0, 0.16, 0.16, 0.1, [0.05, 0.05, 0.1]);
      shadow(e.x, e.groundY, e.z, 0.5, 0.3);
    } else if (e.t === 'moblin') {
      const w = e.anim * 5, sw = e.speed > 0.3 ? Math.sin(w) * 0.55 : 0;
      const root = node(pool[2], null, e.x, e.y, e.z, 0, e.yaw, 0, 1, 1, 1);
      P(root, PRIM.box, -0.26, 0.42, 0, sw, 0, 0, 0.32, 0.85, 0.32, T([0.35, 0.30, 0.24]));
      P(root, PRIM.box, 0.26, 0.42, 0, -sw, 0, 0, 0.32, 0.85, 0.32, T([0.35, 0.30, 0.24]));
      P(root, PRIM.box, 0, 1.32, 0, 0, 0, 0, 1.0, 1.05, 0.7, T([0.55, 0.45, 0.30]));
      P(root, PRIM.box, 0, 0.85, 0, 0, 0, 0, 1.05, 0.2, 0.75, T([0.30, 0.22, 0.14]));
      P(root, PRIM.box, 0, 2.12, 0.02, 0, 0, 0, 0.72, 0.66, 0.66, T([0.52, 0.42, 0.28]));
      P(root, PRIM.box, 0, 2.02, 0.36, 0, 0, 0, 0.34, 0.3, 0.3, T([0.62, 0.52, 0.36]));
      D(root, PRIM.box, -0.16, 2.22, 0.34, 0, 0, 0, 0.12, 0.12, 0.06, [0.9, 0.2, 0.15], { emis: 0.5 });
      D(root, PRIM.box, 0.16, 2.22, 0.34, 0, 0, 0, 0.12, 0.12, 0.06, [0.9, 0.2, 0.15], { emis: 0.5 });
      P(root, PRIM.cone, -0.3, 2.5, 0, 0, 0, -0.4, 0.16, 0.4, 0.16, [0.95, 0.92, 0.85]);
      P(root, PRIM.cone, 0.3, 2.5, 0, 0, 0, 0.4, 0.16, 0.4, 0.16, [0.95, 0.92, 0.85]);
      P(root, PRIM.box, -0.62, 1.35, 0, sw * 0.5, 0, 0, 0.26, 0.8, 0.26, T([0.52, 0.42, 0.28]));
      let ra = -0.2;
      if (e.state === 'wind') ra = -1.9;
      else if (e.state === 'swing') ra = U.lerp(-1.9, 1.1, U.smooth(U.clamp(1 - e.stateT / 0.28, 0, 1)));
      const arm = node(pool[3], root, 0.62, 1.6, 0, ra, 0, 0, 1, 1, 1);
      P(arm, PRIM.box, 0, -0.35, 0, 0, 0, 0, 0.26, 0.8, 0.26, T([0.52, 0.42, 0.28]));
      P(arm, PRIM.box, 0, -0.95, 0, 0, 0, 0, 0.2, 0.7, 0.2, BROWN);
      P(arm, PRIM.box, 0, -1.4, 0, 0, 0, 0, 0.42, 0.5, 0.42, [0.4, 0.36, 0.32]);
      shadow(e.x, e.groundY, e.z, 0.65, 0.32);
    } else if (e.t === 'keese') {
      const root = node(pool[2], null, e.x, e.y, e.z, 0, e.yaw, 0, 1, 1, 1);
      const f = Math.sin(time * 18 + e.seed) * 0.9;
      P(root, PRIM.sphere, 0, 0, 0, 0, 0, 0, 0.62, 0.58, 0.62, T([0.28, 0.20, 0.32]));
      P(root, PRIM.box, -0.5, 0.05, 0, 0, 0, f, 0.7, 0.06, 0.42, T([0.20, 0.14, 0.26]));
      P(root, PRIM.box, 0.5, 0.05, 0, 0, 0, -f, 0.7, 0.06, 0.42, T([0.20, 0.14, 0.26]));
      D(root, PRIM.sphere, -0.14, 0.05, 0.26, 0, 0, 0, 0.14, 0.14, 0.08, [1, 0.35, 0.2], { emis: 0.6 });
      D(root, PRIM.sphere, 0.14, 0.05, 0.26, 0, 0, 0, 0.14, 0.14, 0.08, [1, 0.35, 0.2], { emis: 0.6 });
      shadow(e.x, e.groundY, e.z, 0.35, 0.2);
    } else if (e.t === 'octorok') {
      const root = node(pool[2], null, e.x, e.y, e.z, 0, e.yaw, 0, 1, 1, 1);
      const puff = e.state === 'wind' ? 1 + (1 - e.stateT / 0.6) * 0.3 : 1;
      const hop = Math.abs(Math.sin(e.anim * 3)) * 0.08;
      P(root, PRIM.sphere, 0, 0.55 + hop, 0, 0, 0, 0, 1.15 * puff, 0.95 * puff, 1.15 * puff, T([0.82, 0.36, 0.28]));
      P(root, PRIM.cone, 0, 0.62 + hop, 0.55, Math.PI / 2, 0, 0, 0.34, 0.55, 0.34, T([0.9, 0.5, 0.35]));
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.7;
        P(root, PRIM.box, Math.cos(a) * 0.55, 0.16, Math.sin(a) * 0.55 - 0.2, 0, a, 0, 0.22, 0.24, 0.5, T([0.7, 0.3, 0.24]));
      }
      D(root, PRIM.sphere, -0.26, 0.92 + hop, 0.3, 0, 0, 0, 0.2, 0.24, 0.16, [1, 1, 1]);
      D(root, PRIM.sphere, 0.26, 0.92 + hop, 0.3, 0, 0, 0, 0.2, 0.24, 0.16, [1, 1, 1]);
      D(root, PRIM.sphere, -0.26, 0.92 + hop, 0.38, 0, 0, 0, 0.1, 0.12, 0.08, [0.1, 0.1, 0.12]);
      D(root, PRIM.sphere, 0.26, 0.92 + hop, 0.38, 0, 0, 0, 0.1, 0.12, 0.08, [0.1, 0.1, 0.12]);
      shadow(e.x, e.groundY, e.z, 0.6, 0.3);
    } else if (e.t === 'bigchuchu') {
      const sq = 1 + Math.sin(e.anim * 5) * 0.14, S2 = 1.85;
      const root = node(pool[2], null, e.x, e.y, e.z, 0, e.yaw, 0, S2, S2, S2);
      P(root, PRIM.sphere, 0, 0.5 / sq, 0, 0, 0, 0, 1.05 * sq, 1.0 / sq, 1.05 * sq, T([0.72, 0.42, 0.92]));
      D(root, PRIM.sphere, -0.22, 0.62, 0.36, 0, 0, 0, 0.18, 0.18, 0.1, [0.05, 0.05, 0.1]);
      D(root, PRIM.sphere, 0.22, 0.62, 0.36, 0, 0, 0, 0.18, 0.18, 0.1, [0.05, 0.05, 0.1]);
      shadow(e.x, e.groundY, e.z, 0.95, 0.32);
    } else if (e.t === 'stalfos') {
      const w = e.anim * 5, sw = e.speed > 0.3 ? Math.sin(w) * 0.5 : 0;
      const root = node(pool[2], null, e.x, e.y, e.z, 0, e.yaw, 0, 1, 1, 1);
      const bone = T(e.stunT > 0 ? [0.75, 0.75, 0.55] : [0.90, 0.88, 0.80]);
      P(root, PRIM.box, -0.18, 0.4, 0, sw, 0, 0, 0.2, 0.8, 0.2, bone);
      P(root, PRIM.box, 0.18, 0.4, 0, -sw, 0, 0, 0.2, 0.8, 0.2, bone);
      P(root, PRIM.box, 0, 1.15, 0, 0, 0, 0, 0.62, 0.75, 0.4, bone);
      for (let i = 0; i < 3; i++) D(root, PRIM.box, 0, 0.95 + i * 0.2, 0.21, 0, 0, 0, 0.66, 0.07, 0.06, [0.6, 0.58, 0.5]);
      P(root, PRIM.box, 0, 1.78, 0, 0, 0, 0, 0.55, 0.52, 0.5, bone);
      D(root, PRIM.box, -0.13, 1.78, 0.26, 0, 0, 0, 0.13, 0.14, 0.06, [0.9, 0.35, 0.15], { emis: 0.7 });
      D(root, PRIM.box, 0.13, 1.78, 0.26, 0, 0, 0, 0.13, 0.14, 0.06, [0.9, 0.35, 0.15], { emis: 0.7 });
      D(root, PRIM.box, 0, 1.6, 0.24, 0, 0, 0, 0.3, 0.1, 0.06, [0.35, 0.32, 0.28]);
      // Schild vorne links — blockt Angriffe von vorn
      P(root, PRIM.box, -0.52, 1.15, 0.34, 0, 0, 0, 0.18, 0.9, 0.7, T([0.42, 0.46, 0.55]));
      D(root, PRIM.box, -0.6, 1.15, 0.34, 0, 0, 0, 0.06, 0.5, 0.4, COL.gold);
      let ra = -0.2;
      if (e.state === 'wind') ra = -1.8;
      else if (e.state === 'swing') ra = U.lerp(-1.8, 1.0, U.smooth(U.clamp(1 - e.stateT / 0.24, 0, 1)));
      const arm = node(pool[3], root, 0.5, 1.45, 0, ra, 0, 0, 1, 1, 1);
      P(arm, PRIM.box, 0, -0.35, 0, 0, 0, 0, 0.17, 0.7, 0.17, bone);
      P(arm, PRIM.box, 0, -0.95, 0, 0, 0, 0, 0.12, 1.0, 0.05, STEEL);
      if (e.stunT > 0) G.sprite(e.x, e.y + 2.3, e.z, 0.9, 0.9, [1, 1, 0.4, 0.8], { emis: 1, noDepthWrite: true, noTex: true });
      shadow(e.x, e.groundY, e.z, 0.5, 0.3);
    } else if (e.t === 'cucco') {
      const root = node(pool[2], null, e.x, e.y, e.z, 0, e.yaw, 0, 1, 1, 1);
      const flap = e.panic > 0 ? Math.sin(time * 22) * 1.1 : Math.sin(time * 3 + e.seed) * 0.15;
      const body = e.angry ? [1, 0.85, 0.85] : [1, 1, 0.98];
      P(root, PRIM.sphere, 0, 0.42, 0, 0, 0, 0, 0.62, 0.58, 0.7, body);
      P(root, PRIM.sphere, 0, 0.78, 0.16, 0, 0, 0, 0.34, 0.34, 0.34, body);
      D(root, PRIM.cone, 0, 0.78, 0.36, Math.PI / 2, 0, 0, 0.14, 0.22, 0.14, [0.95, 0.72, 0.2]);
      D(root, PRIM.box, 0, 0.98, 0.1, 0, 0, 0, 0.1, 0.16, 0.2, [0.9, 0.2, 0.2]);
      D(root, PRIM.box, 0, 0.66, 0.28, 0, 0, 0, 0.09, 0.14, 0.08, [0.9, 0.2, 0.2]);
      D(root, PRIM.sphere, -0.1, 0.82, 0.3, 0, 0, 0, 0.08, 0.08, 0.06, [0.1, 0.1, 0.1]);
      D(root, PRIM.sphere, 0.1, 0.82, 0.3, 0, 0, 0, 0.08, 0.08, 0.06, [0.1, 0.1, 0.1]);
      P(root, PRIM.box, -0.32, 0.44, 0, 0, 0, flap, 0.12, 0.34, 0.5, body);
      P(root, PRIM.box, 0.32, 0.44, 0, 0, 0, -flap, 0.12, 0.34, 0.5, body);
      D(root, PRIM.box, -0.12, 0.1, 0, 0, 0, 0, 0.07, 0.24, 0.07, [0.95, 0.72, 0.2]);
      D(root, PRIM.box, 0.12, 0.1, 0, 0, 0, 0, 0.07, 0.24, 0.07, [0.95, 0.72, 0.2]);
      shadow(e.x, e.groundY, e.z, 0.34, 0.24);
    } else if (e.t === 'boss') {
      const root = node(pool[2], null, e.x, e.y, e.z, 0, e.yaw, 0, 1, 1, 1);
      const vul = e.state === 'stun';
      const body = T(vul ? [0.42, 0.40, 0.44] : [0.36, 0.35, 0.40]);
      const crouch = vul ? -0.5 : 0;
      P(root, PRIM.box, -0.75, 0.85, 0, 0, 0, 0, 0.85, 1.7, 0.9, body);
      P(root, PRIM.box, 0.75, 0.85, 0, 0, 0, 0, 0.85, 1.7, 0.9, body);
      P(root, PRIM.box, 0, 3.0 + crouch, 0, 0, 0, 0, 3.0, 2.6, 2.0, body);
      P(root, PRIM.box, 0, 4.55 + crouch, 0, 0, 0, 0, 1.7, 0.9, 1.5, T([0.30, 0.29, 0.34]));
      D(root, PRIM.box, -0.42, 4.6 + crouch, 0.72, 0, 0, 0, 0.3, 0.28, 0.2, vul ? [1, 0.9, 0.3] : [0.95, 0.35, 0.2], { emis: 0.8 });
      D(root, PRIM.box, 0.42, 4.6 + crouch, 0.72, 0, 0, 0, 0.3, 0.28, 0.2, vul ? [1, 0.9, 0.3] : [0.95, 0.35, 0.2], { emis: 0.8 });
      const pulse = 0.9 + Math.sin(time * 6) * 0.1;
      D(root, PRIM.sphere, 0, 3.0 + crouch, 1.05, 0, 0, 0, 1.0 * pulse, 1.0 * pulse, 0.5,
        vul ? [0.4, 1.0, 0.5] : [0.5, 0.2, 0.2], { emis: vul ? 0.9 : 0.2 });
      if (vul) G.sprite(e.x, e.y + 3.0, e.z, 3.4, 3.4, [0.4, 1, 0.6, 0.28], { emis: 1, noDepthWrite: true, noTex: true });
      let ar = -0.15;
      if (e.state === 'wind') ar = -2.3; else if (e.state === 'slam') ar = 0.9;
      const la = node(pool[3], root, -2.0, 3.7 + crouch, 0, ar, 0, 0.25, 1, 1, 1);
      P(la, PRIM.box, 0, -1.0, 0, 0, 0, 0, 0.95, 2.4, 0.95, body);
      P(la, PRIM.box, 0, -2.35, 0, 0, 0, 0, 1.3, 1.1, 1.3, T([0.30, 0.29, 0.34]));
      const ra2 = node(pool[4], root, 2.0, 3.7 + crouch, 0, ar, 0, -0.25, 1, 1, 1);
      P(ra2, PRIM.box, 0, -1.0, 0, 0, 0, 0, 0.95, 2.4, 0.95, body);
      P(ra2, PRIM.box, 0, -2.35, 0, 0, 0, 0, 1.3, 1.1, 1.3, T([0.30, 0.29, 0.34]));
      shadow(e.x, e.groundY, e.z, 2.1, 0.34);
    }
  }

  /* ---------- Objekte ---------- */
  function drawGrass(g) {
    node(pool[2], null, g.x, g.y, g.z, 0, g.seed, 0, 1.1, 1.0, 1.1);
    G.draw(PRIM.tuft, pool[2], [0.55, 0.95, 0.45], { noCull: true });
  }
  function drawPot(p) {
    const root = node(pool[2], null, p.x, p.y, p.z, 0, 0, 0, 1, 1, 1);
    P(root, PRIM.sphere, 0, 0.42, 0, 0, 0, 0, 0.85, 0.9, 0.85, [0.70, 0.55, 0.38]);
    P(root, PRIM.cyl, 0, 0.82, 0, 0, 0, 0, 0.45, 0.22, 0.45, [0.55, 0.42, 0.28]);
    shadow(p.x, p.y, p.z, 0.4, 0.25);
  }
  function drawChest(c, time) {
    const root = node(pool[2], null, c.x, c.y, c.z, 0, c.yaw || 0, 0, 1, 1, 1);
    P(root, PRIM.box, 0, 0.45, 0, 0, 0, 0, 1.5, 0.9, 1.1, [0.60, 0.42, 0.24]);
    P(root, PRIM.box, 0, 0.45, 0, 0, 0, 0, 1.55, 0.24, 1.15, COL.gold);
    const lid = node(pool[3], root, 0, 0.9, -0.55, -(c.openT || 0) * 1.9, 0, 0, 1, 1, 1);
    P(lid, PRIM.box, 0, 0.16, 0.55, 0, 0, 0, 1.5, 0.34, 1.1, [0.66, 0.48, 0.28]);
    P(lid, PRIM.box, 0, 0.16, 0.55, 0, 0, 0, 1.55, 0.14, 1.15, COL.gold);
    if (!c.opened) {
      P(root, PRIM.box, 0, 0.62, 0.58, 0, 0, 0, 0.3, 0.34, 0.12, COL.gold);
      G.sprite(c.x, c.y + 1.5 + Math.sin(time * 2) * 0.1, c.z, 0.5, 0.5, [1, 0.95, 0.5, 0.5], { emis: 1, noDepthWrite: true, noTex: true });
    }
    shadow(c.x, c.y, c.z, 0.8, 0.3);
  }
  function drawSign(s) {
    const root = node(pool[2], null, s.x, s.y, s.z, 0, s.yaw || 0, 0, 1, 1, 1);
    P(root, PRIM.box, 0, 0.5, 0, 0, 0, 0, 0.16, 1.0, 0.16, [0.5, 0.35, 0.2]);
    P(root, PRIM.box, 0, 1.2, 0, 0, 0, 0, 1.3, 0.8, 0.12, [0.78, 0.6, 0.36]);
    shadow(s.x, s.y, s.z, 0.4, 0.22);
  }
  function drawCrack(c) {
    const root = node(pool[2], null, c.x, c.y, c.z, 0, 0.4, 0, 1, 1, 1);
    P(root, PRIM.box, 0, 1.1, 0, 0, 0, 0, 2.6, 2.2, 2.6, [0.9, 0.9, 0.95]);
    D(root, PRIM.box, 0, 1.3, 1.32, 0, 0, 0.3, 0.18, 1.4, 0.2, [0.15, 0.15, 0.17]);
    D(root, PRIM.box, 0.4, 0.8, 1.32, 0, 0, -0.5, 0.16, 1.0, 0.2, [0.15, 0.15, 0.17]);
    shadow(c.x, c.y, c.z, 1.4, 0.3);
  }
  function drawDoor(d) {
    const root = node(pool[2], null, d.x, d.y || 0, d.z, 0, 0, 0, 1, 1, 1);
    P(root, PRIM.box, 0, 1.9, 0, 0, 0, 0, 3.4, 3.8, 0.8, [0.45, 0.38, 0.32]);
    D(root, PRIM.box, 0, 1.9, 0.3, 0, 0, 0, 0.9, 0.9, 0.3, COL.gold, { emis: 0.35 });
    D(root, PRIM.box, 0, 1.9, 0.42, 0, 0, 0, 0.24, 0.5, 0.16, [0.2, 0.18, 0.16]);
  }
  function drawPickup(p, time) {
    const spin = time * 2.5 + p.seed;
    const root = node(pool[2], null, p.x, p.y + 0.45 + Math.sin(time * 3 + p.seed) * 0.12, p.z, 0, spin, 0, 1, 1, 1);
    const O = { emis: 0.45 };
    if (p.kind === 'heart') {
      D(root, PRIM.box, -0.14, 0.1, 0, 0, 0, 0.5, 0.3, 0.3, 0.24, [0.95, 0.25, 0.35], O);
      D(root, PRIM.box, 0.14, 0.1, 0, 0, 0, -0.5, 0.3, 0.3, 0.24, [0.95, 0.25, 0.35], O);
      D(root, PRIM.box, 0, -0.12, 0, 0, 0, 0.78, 0.3, 0.3, 0.24, [0.95, 0.25, 0.35], O);
    } else if (p.kind === 'arrow') {
      D(root, PRIM.box, 0, 0, 0, 0, 0, 0.35, 0.07, 0.9, 0.07, [0.6, 0.45, 0.3], O);
      D(root, PRIM.cone, 0.16, 0.42, 0, 0, 0, 0.35, 0.16, 0.3, 0.16, [0.85, 0.88, 0.95], O);
    } else if (p.kind === 'key') {
      D(root, PRIM.box, 0, 0.2, 0, 0, 0, 0, 0.12, 0.7, 0.12, COL.gold, O);
      D(root, PRIM.box, 0, 0.55, 0, 0, 0, 0, 0.34, 0.34, 0.12, COL.gold, O);
      D(root, PRIM.box, 0.14, -0.1, 0, 0, 0, 0, 0.22, 0.12, 0.1, COL.gold, O);
    } else {
      const c = p.kind === 'rupee20' ? [0.95, 0.3, 0.3] : p.kind === 'rupee5' ? [0.35, 0.55, 0.95] : [0.35, 0.9, 0.45];
      D(root, PRIM.box, 0, 0, 0, 0, 0, 0, 0.28, 0.34, 0.28, c, O);
      D(root, PRIM.cone, 0, 0.3, 0, 0, 0, 0, 0.28, 0.32, 0.28, c, O);
      D(root, PRIM.cone, 0, -0.3, 0, Math.PI, 0, 0, 0.28, 0.32, 0.28, c, O);
    }
    shadow(p.x, p.groundY, p.z, 0.25, 0.18);
  }
  function drawProjectile(pr, time) {
    if (pr.kind === 'arrow') {
      const root = node(pool[2], null, pr.x, pr.y, pr.z, 0, pr.yaw, 0, 1, 1, 1);
      D(root, PRIM.box, 0, 0, 0, Math.PI / 2, 0, 0, 0.07, 1.1, 0.07, [0.6, 0.45, 0.3]);
      D(root, PRIM.cone, 0, 0, 0.6, Math.PI / 2, 0, 0, 0.14, 0.3, 0.14, [0.85, 0.88, 0.95]);
    } else if (pr.kind === 'bomb') {
      const blink = pr.fuse < 1.2 && Math.floor(pr.fuse * 10) % 2 === 0;
      const root = node(pool[2], null, pr.x, pr.y, pr.z, 0, 0, 0, 1, 1, 1);
      P(root, PRIM.sphere, 0, 0.3, 0, 0, 0, 0, 0.75, 0.75, 0.75, blink ? [1, 0.4, 0.35] : [0.16, 0.16, 0.2]);
      D(root, PRIM.box, 0, 0.72, 0, 0.3, 0, 0, 0.1, 0.3, 0.1, [0.5, 0.4, 0.3]);
      G.sprite(pr.x, pr.y + 0.95, pr.z, 0.3, 0.3, [1, 0.8, 0.3, 0.9], { emis: 1, noDepthWrite: true, noTex: true });
      shadow(pr.x, pr.groundY, pr.z, 0.35, 0.25);
    } else if (pr.kind === 'rock') {
      const s = pr.size || 1;
      const root = node(pool[2], null, pr.x, pr.y, pr.z, pr.spin, pr.spin * 0.7, 0, 1, 1, 1);
      P(root, PRIM.sphere, 0, 0, 0, 0, 0, 0, 1.1 * s, 1.0 * s, 1.1 * s, [0.75, 0.72, 0.70]);
    }
  }
  /* Schiebeblock */
  function drawBlock(b) {
    const root = node(pool[2], null, b.x, 0, b.z, 0, 0, 0, 1, 1, 1);
    P(root, PRIM.box, 0, 1.05, 0, 0, 0, 0, 2.1, 2.1, 2.1, [0.86, 0.84, 0.9]);
    for (const s of [-1, 1]) {
      D(root, PRIM.box, s * 1.02, 1.05, 0, 0, 0, 0, 0.1, 1.9, 1.9, COL.gold, { emis: 0.15 });
      D(root, PRIM.box, 0, 1.05, s * 1.02, 0, 0, 0, 1.9, 1.9, 0.1, COL.gold, { emis: 0.15 });
    }
    shadow(b.x, 0, b.z, 1.1, 0.32);
  }
  /* Druckplatte */
  function drawSwitch(s, time) {
    const y = s.pressed ? 0.06 : 0.16;
    const root = node(pool[2], null, s.x, 0, s.z, 0, 0, 0, 1, 1, 1);
    P(root, PRIM.box, 0, 0.04, 0, 0, 0, 0, 2.3, 0.08, 2.3, [0.5, 0.5, 0.58]);
    D(root, PRIM.box, 0, y, 0, 0, 0, 0, 1.9, 0.16, 1.9,
      s.pressed ? [0.4, 1, 0.5] : [0.9, 0.7, 0.3], { emis: s.pressed ? 0.8 : 0.35 });
  }
  /* Bumerang */
  function drawBoomerang(b, time) {
    const root = node(pool[2], null, b.x, b.y, b.z, 0, b.spin, 0, 1, 1, 1);
    P(root, PRIM.box, 0.18, 0, 0, 0, 0, 0, 0.62, 0.14, 0.2, [0.72, 0.5, 0.26]);
    P(root, PRIM.box, 0, 0, 0.18, 0, Math.PI / 2, 0, 0.62, 0.14, 0.2, [0.72, 0.5, 0.26]);
    G.sprite(b.x, b.y, b.z, 1.3, 1.3, [1, 0.95, 0.6, 0.3], { emis: 1, noDepthWrite: true, noTex: true });
  }
  /* Herzteil (Viertel eines Containers) */
  function drawHeartPiece(h, time) {
    const root = node(pool[2], null, h.x, h.y + 0.7 + Math.sin(time * 2) * 0.12, h.z, 0, time * 1.4, 0, 1, 1, 1);
    const O = { emis: 0.6 };
    D(root, PRIM.box, -0.16, 0.12, 0, 0, 0, 0.5, 0.34, 0.34, 0.26, [1, 0.35, 0.45], O);
    D(root, PRIM.box, 0.16, 0.12, 0, 0, 0, -0.5, 0.34, 0.34, 0.26, [1, 0.35, 0.45], O);
    D(root, PRIM.box, 0, -0.14, 0, 0, 0, 0.78, 0.34, 0.34, 0.26, [1, 0.35, 0.45], O);
    G.sprite(h.x, h.y + 0.8, h.z, 2.2, 2.2, [1, 0.5, 0.6, 0.22], { emis: 1, noDepthWrite: true, noTex: true });
  }
  function drawShockwave(s) {
    node(pool[2], null, s.x, s.y + 0.06, s.z, 0, 0, 0, s.r * 2, 1, s.r * 2);
    G.draw(PRIM.disc, pool[2], [1, 0.85, 0.4, U.clamp(s.life, 0, 0.55)], { noDepthWrite: true, emis: 0.7, noTex: true });
  }
  /* Fackel-/Lichtschein als Billboard-Sprite */
  function drawFlame(x, y, z, time, seed, col) {
    const f = 0.85 + Math.sin(time * 9 + seed) * 0.12;
    G.sprite(x, y + 0.1, z, 0.75 * f, 1.15 * f, (col || [1, 0.72, 0.25]).concat([0.9]), { emis: 1, noDepthWrite: true, noTex: true });
    G.sprite(x, y + 0.05, z, 2.4, 2.4, (col || [1, 0.6, 0.2]).concat([0.16]), { emis: 1, noDepthWrite: true, noTex: true });
  }

  /* =========================================================
     KI
     ========================================================= */
  function makeEnemy(t, x, z) {
    const base = { t, x, z, y: 0, yaw: 0, anim: Math.random() * 6, seed: Math.random() * 6, speed: 0, hurtT: 0, state: 'idle', stateT: 0, kbx: 0, kbz: 0, groundY: 0, dead: false, vy: 0 };
    if (t === 'chuchu') Object.assign(base, { hp: 2, maxhp: 2, r: 0.6, dmg: 1, agro: 15, spd: 3.4 });
    if (t === 'moblin') Object.assign(base, { hp: 4, maxhp: 4, r: 0.85, dmg: 2, agro: 18, spd: 3.0 });
    if (t === 'keese') Object.assign(base, { hp: 1, maxhp: 1, r: 0.5, dmg: 1, agro: 16, spd: 5.0, fly: true });
    if (t === 'octorok') Object.assign(base, { hp: 3, maxhp: 3, r: 0.7, dmg: 1, agro: 22, spd: 1.6 });
    if (t === 'bigchuchu') Object.assign(base, { hp: 5, maxhp: 5, r: 1.1, dmg: 2, agro: 17, spd: 3.0, splits: true });
    if (t === 'stalfos') Object.assign(base, { hp: 4, maxhp: 4, r: 0.7, dmg: 2, agro: 19, spd: 3.4, shielded: true, stunT: 0 });
    if (t === 'cucco') Object.assign(base, { hp: 99, maxhp: 99, r: 0.45, dmg: 1, agro: 8, spd: 3.2, peaceful: true, panic: 0, pecks: 0 });
    if (t === 'boss') Object.assign(base, { hp: 14, maxhp: 14, r: 2.3, dmg: 3, agro: 100, spd: 3.2, boss: true, cycle: 0 });
    return base;
  }

  function updateEnemy(e, dt, g) {
    const p = g.player;
    e.anim += dt;
    if (e.hurtT > 0) e.hurtT -= dt;
    e.stateT -= dt;
    const dx = p.x - e.x, dz = p.z - e.z;
    const d = Math.hypot(dx, dz) || 0.001;
    const night = g.nightFactor > 0.5;
    const canSee = d < e.agro * (night ? 1.25 : 1) && !p.dead;

    if (Math.abs(e.kbx) + Math.abs(e.kbz) > 0.01) {
      const m = World.move(e.x, e.z, e.kbx * dt, e.kbz * dt, e.r);
      e.x = m.x; e.z = m.z;
      e.kbx *= Math.pow(0.008, dt); e.kbz *= Math.pow(0.008, dt);
    }

    let vx = 0, vz = 0;
    const spd = e.spd * (night ? 1.15 : 1);

    if (e.stunT > 0) {                       // vom Bumerang betäubt
      e.stunT -= dt; e.speed = 0;
      e.groundY = World.height(e.x, e.z);
      if (!e.fly) e.y = e.groundY;
      return;
    }

    if (e.t === 'chuchu' || e.t === 'bigchuchu') {
      if (e.state === 'idle' && e.stateT <= 0) { e.state = 'hop'; e.stateT = 0.55; e.vy = 4.2; }
      if (e.state === 'hop') {
        if (canSee) { vx = dx / d * spd; vz = dz / d * spd; }
        else { vx = Math.cos(e.seed * 3) * 1.2; vz = Math.sin(e.seed * 3) * 1.2; }
        if (e.stateT <= 0) { e.state = 'idle'; e.stateT = 0.45 + Math.random() * 0.4; }
      }
      e.vy -= 14 * dt; e.y += e.vy * dt;
      if (e.y < e.groundY) { e.y = e.groundY; e.vy = 0; }
    } else if (e.t === 'moblin') {
      if (e.state === 'idle') {
        if (canSee) {
          if (d < 2.9) { e.state = 'wind'; e.stateT = 0.45; }
          else { vx = dx / d * spd; vz = dz / d * spd; }
        } else if (Math.sin(e.anim * 0.5 + e.seed) > 0.3) {
          vx = Math.cos(e.seed * 5) * 1.0; vz = Math.sin(e.seed * 5) * 1.0;
        }
      } else if (e.state === 'wind') {
        if (e.stateT <= 0) { e.state = 'swing'; e.stateT = 0.28; e.didHit = false; Snd.swing(); }
      } else if (e.state === 'swing') {
        if (!e.didHit && e.stateT < 0.18) {
          e.didHit = true;
          if (d < 3.3 && Math.abs(U.angDiff(e.yaw, Math.atan2(dx, dz))) < 1.1) g.damagePlayer(e.dmg, e.x, e.z);
        }
        if (e.stateT <= 0) { e.state = 'rest'; e.stateT = 0.75; }
      } else if (e.state === 'rest') { if (e.stateT <= 0) e.state = 'idle'; }
      e.y = e.groundY;
    } else if (e.t === 'keese') {
      const targetY = e.groundY + 2.0 + Math.sin(e.anim * 2 + e.seed) * 0.9;
      e.y += (targetY - e.y) * Math.min(1, dt * 3);
      if (canSee) {
        const s = d < 4 ? spd * 1.3 : spd;
        vx = dx / d * s + Math.cos(e.anim * 3 + e.seed) * 1.6;
        vz = dz / d * s + Math.sin(e.anim * 3 + e.seed) * 1.6;
      } else { vx = Math.cos(e.anim * 1.2 + e.seed) * 2.0; vz = Math.sin(e.anim * 1.1 + e.seed) * 2.0; }
    } else if (e.t === 'stalfos') {
      // Schildträger: hält den Schild zum Spieler, greift aus der Nähe an
      if (e.state === 'idle') {
        if (canSee) {
          if (d < 2.7) { e.state = 'wind'; e.stateT = 0.38; }
          else {
            const strafe = Math.sin(e.anim * 1.4 + e.seed) * 0.7;   // seitliches Umkreisen
            vx = (dx / d) * spd + (-dz / d) * strafe * spd;
            vz = (dz / d) * spd + (dx / d) * strafe * spd;
          }
        }
      } else if (e.state === 'wind') {
        if (e.stateT <= 0) { e.state = 'swing'; e.stateT = 0.24; e.didHit = false; Snd.swing(); }
      } else if (e.state === 'swing') {
        if (!e.didHit && e.stateT < 0.15) {
          e.didHit = true;
          if (d < 3.0 && Math.abs(U.angDiff(e.yaw, Math.atan2(dx, dz))) < 1.1) g.damagePlayer(e.dmg, e.x, e.z);
        }
        if (e.stateT <= 0) { e.state = 'rest'; e.stateT = 0.5; }
      } else if (e.state === 'rest') { if (e.stateT <= 0) e.state = 'idle'; }
      e.y = e.groundY;
    } else if (e.t === 'cucco') {
      // Friedlich — flieht; nach genug Schlägen ruft es Rache herbei
      e.y = e.groundY + (e.hopY || 0);
      if (e.panic > 0) {
        e.panic -= dt;
        const a = Math.atan2(-dx, -dz) + Math.sin(e.anim * 6) * 0.4;
        vx = Math.sin(a) * spd * 1.6; vz = Math.cos(a) * spd * 1.6;
        e.hopY = Math.abs(Math.sin(e.anim * 12)) * 0.45;
      } else if (e.angry) {
        vx = dx / d * spd * 1.5; vz = dz / d * spd * 1.5;
        e.hopY = Math.abs(Math.sin(e.anim * 14)) * 0.9;
        if (d < 1.3) g.damagePlayer(1, e.x, e.z);
      } else if (canSee && d < 3.2) {
        const a = Math.atan2(-dx, -dz);
        vx = Math.sin(a) * spd * 0.8; vz = Math.cos(a) * spd * 0.8;
        e.hopY = 0;
      } else {
        e.hopY = 0;
        if (Math.sin(e.anim * 0.6 + e.seed) > 0.6) { vx = Math.cos(e.seed * 9) * 1.1; vz = Math.sin(e.seed * 9) * 1.1; }
      }
    } else if (e.t === 'octorok') {
      e.y = e.groundY;
      if (e.state === 'idle') {
        if (canSee && d > 3 && e.stateT <= 0) { e.state = 'wind'; e.stateT = 0.6; }
        else if (!canSee && Math.sin(e.anim * 0.7 + e.seed) > 0.5) {
          vx = Math.cos(e.seed * 7) * spd; vz = Math.sin(e.seed * 7) * spd;
        } else if (canSee && d < 3) { vx = -dx / d * spd; vz = -dz / d * spd; }  // Abstand halten
      } else if (e.state === 'wind') {
        if (e.stateT <= 0) {
          g.spawnRock(e.x, e.y + 0.8, e.z, dx / d, dz / d, 17, 0.42, 1);
          Snd.tone(420, 0.12, 'square', 0.12, 200);
          e.state = 'idle'; e.stateT = 1.6 + Math.random() * 0.8;
        }
      }
    } else if (e.t === 'boss') {
      e.y = e.groundY;
      if (e.state === 'idle') {
        if (e.stateT <= 0) {
          e.cycle++;
          if (e.cycle % 4 === 0 && d > 6) { e.state = 'throw'; e.stateT = 0.8; }
          else { e.state = 'chase'; e.stateT = 2.6; }
        }
      } else if (e.state === 'chase') {
        vx = dx / d * e.spd; vz = dz / d * e.spd;
        if (d < 4.6 || e.stateT <= 0) { e.state = 'wind'; e.stateT = 0.75; }
      } else if (e.state === 'wind') {
        if (e.stateT <= 0) { e.state = 'slam'; e.stateT = 0.25; e.didHit = false; }
      } else if (e.state === 'slam') {
        if (!e.didHit) {
          e.didHit = true; Snd.boom();
          g.shockwave(e.x, e.z, 9.5, e.dmg);
          g.shake = 0.6;
          g.burst(e.x, e.groundY + 0.2, e.z, 26, [0.5, 0.45, 0.4], 7);
        }
        if (e.stateT <= 0) { e.state = 'stun'; e.stateT = 2.6; }
      } else if (e.state === 'stun') {
        if (e.stateT <= 0) { e.state = 'idle'; e.stateT = 0.5; }
      } else if (e.state === 'throw') {
        if (e.stateT <= 0) { g.spawnRock(e.x, e.y + 3.4, e.z, dx / d, dz / d, 15, 1, 2); e.state = 'idle'; e.stateT = 1.0; }
      }
      if (e.state === 'chase' && d < e.r + 0.9) g.damagePlayer(2, e.x, e.z);
    }

    const sp = Math.hypot(vx, vz);
    e.speed = sp;
    if (sp > 0.01) {
      const m = World.move(e.x, e.z, vx * dt, vz * dt, e.r);
      const moved = Math.hypot(m.x - e.x, m.z - e.z);
      e.x = m.x; e.z = m.z;
      e.yaw = U.angLerp(e.yaw, Math.atan2(vx, vz), Math.min(1, dt * 8));
      if (e.t === 'boss' && e.state === 'chase' && moved < sp * dt * 0.3) { e.state = 'wind'; e.stateT = 0.5; }
    } else if (canSee && e.t !== 'keese') {
      e.yaw = U.angLerp(e.yaw, Math.atan2(dx, dz), Math.min(1, dt * 6));
    }

    e.groundY = World.height(e.x, e.z);
    const hops = (e.t === 'chuchu' || e.t === 'bigchuchu');
    if (!e.fly && !hops && e.t !== 'cucco') e.y = e.groundY;
    if (hops && e.y < e.groundY) e.y = e.groundY;

    if (e.t !== 'boss' && !e.peaceful && d < e.r + 0.55 && !p.dead) {
      if ((e.t !== 'moblin' && e.t !== 'stalfos') || e.state === 'idle') g.damagePlayer(e.dmg, e.x, e.z);
    }
  }

  return {
    drawPlayer, drawNPC, drawEnemy, drawGrass, drawPot, drawChest, drawSign,
    drawCrack, drawDoor, drawPickup, drawProjectile, drawShockwave, drawFlame, shadow,
    drawBlock, drawSwitch, drawBoomerang, drawHeartPiece,
    makeEnemy, updateEnemy, node, P, settings: S
  };
})();
