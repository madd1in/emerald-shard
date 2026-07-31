'use strict';
/* =========================================================
   ENTITIES — Modelle (Boxen-Charaktere) und Gegner-KI
   ========================================================= */

const Ents = (() => {
  /* Matrix-Pool */
  const pool = []; for (let i = 0; i < 12; i++) pool.push(M4.create());
  const scratch = M4.create();

  function node(out, parent, px, py, pz, rx, ry, rz, sx, sy, sz) {
    M4.compose(scratch, px, py, pz, rx, ry, rz, sx, sy, sz);
    if (parent) M4.multiply(out, parent, scratch); else out.set(scratch);
    return out;
  }
  function P(parent, prim, px, py, pz, rx, ry, rz, sx, sy, sz, col, opt) {
    node(pool[0], parent, px, py, pz, rx, ry, rz, sx, sy, sz);
    G.draw(prim, pool[0], col, opt);
  }

  const SKIN = [0.94, 0.78, 0.62], GREEN = [0.22, 0.60, 0.26], BEIGE = [0.90, 0.86, 0.72];
  const BROWN = [0.42, 0.28, 0.16], STEEL = [0.78, 0.80, 0.86], HAIR = [0.85, 0.68, 0.28];

  /* ---------- Schatten ---------- */
  function shadow(x, y, z, r, alpha) {
    node(pool[1], null, x, y + 0.03, z, 0, 0, 0, r * 2, 1, r * 2);
    G.draw(PRIM.disc, pool[1], [0, 0, 0, alpha === undefined ? 0.3 : alpha], { noDepthWrite: true });
  }

  /* ---------- Held ---------- */
  function drawPlayer(p, time) {
    const root = node(pool[2], null, p.x, p.y, p.z, 0, p.yaw, 0, 1, 1, 1);
    const flash = p.invuln > 0 && Math.floor(p.invuln * 18) % 2 === 0;
    const tint = k => flash ? [1, 0.5, 0.5] : k;
    const w = p.walkPhase;
    const sw = p.speed > 0.4 ? Math.sin(w) * 0.6 : 0;
    const bob = p.speed > 0.4 ? Math.abs(Math.sin(w)) * 0.06 : Math.sin(time * 2) * 0.02;

    // Beine
    P(root, PRIM.box, -0.19, 0.36, 0, sw, 0, 0, 0.26, 0.72, 0.26, tint(BEIGE));
    P(root, PRIM.box, 0.19, 0.36, 0, -sw, 0, 0, 0.26, 0.72, 0.26, tint(BEIGE));
    P(root, PRIM.box, -0.19, 0.08, 0.05, 0, 0, 0, 0.3, 0.2, 0.4, tint(BROWN));
    P(root, PRIM.box, 0.19, 0.08, 0.05, 0, 0, 0, 0.3, 0.2, 0.4, tint(BROWN));
    // Körper
    P(root, PRIM.box, 0, 1.06 + bob, 0, 0, 0, 0, 0.78, 0.86, 0.56, tint(GREEN));
    P(root, PRIM.box, 0, 0.72 + bob, 0, 0, 0, 0, 0.82, 0.16, 0.6, tint(BROWN));
    // Kopf
    const hy = 1.75 + bob;
    P(root, PRIM.box, 0, hy, 0, 0, 0, 0, 0.62, 0.6, 0.6, tint(SKIN));
    P(root, PRIM.box, 0, hy + 0.12, -0.13, 0, 0, 0, 0.66, 0.42, 0.42, tint(HAIR));
    P(root, PRIM.box, -0.35, hy + 0.02, 0, 0, 0, 0, 0.12, 0.26, 0.3, tint(SKIN));
    P(root, PRIM.box, 0.35, hy + 0.02, 0, 0, 0, 0, 0.12, 0.26, 0.3, tint(SKIN));
    P(root, PRIM.box, -0.13, hy + 0.02, 0.31, 0, 0, 0, 0.1, 0.12, 0.06, [0.1, 0.1, 0.15]);
    P(root, PRIM.box, 0.13, hy + 0.02, 0.31, 0, 0, 0, 0.1, 0.12, 0.06, [0.1, 0.1, 0.15]);
    // Zipfelmütze
    P(root, PRIM.cone, 0, hy + 0.5, -0.02, 0.35, 0, 0, 0.72, 1.15, 0.72, tint(GREEN));

    // Arme (rechts = Schwert)
    let ra = -sw * 0.8, la = sw * 0.8;
    if (p.attackT > 0) {
      const t = 1 - p.attackT / p.attackDur;
      ra = U.lerp(-2.3, 0.9, U.smooth(U.clamp(t * 1.4, 0, 1)));
    }
    const arm = node(pool[3], root, 0.5, 1.32 + bob, 0, 0, 0, 0, 1, 1, 1);
    P(arm, PRIM.box, 0, -0.28 * Math.cos(ra), 0.28 * Math.sin(ra), ra, 0, 0, 0.22, 0.62, 0.22, tint(SKIN));

    // linker Arm / Schild
    P(root, PRIM.box, -0.5, 1.05 + bob - 0.1, Math.sin(la) * 0.2, la, 0, 0, 0.22, 0.62, 0.22, tint(SKIN));
    if (p.items.shield) {
      P(root, PRIM.box, -0.62, 1.1 + bob, 0.22, 0, 0, 0.1, 0.16, 0.8, 0.62, [0.35, 0.42, 0.72]);
      P(root, PRIM.box, -0.7, 1.1 + bob, 0.22, 0, 0, 0.1, 0.06, 0.5, 0.36, COL.gold);
    }
    // Schwert in der Hand
    if (p.items.sword) {
      const hand = node(pool[5], root, 0.52, 1.32 + bob, 0, 0, 0, 0, 1, 1, 1);
      const g = node(pool[6], hand, Math.sin(0) * 0, -0.55 * Math.cos(ra), 0.55 * Math.sin(ra) - 0.05, ra, 0, 0, 1, 1, 1);
      P(g, PRIM.box, 0, 0.12, 0, 0, 0, 0, 0.1, 0.28, 0.1, BROWN);
      P(g, PRIM.box, 0, 0.28, 0, 0, 0, 0, 0.42, 0.08, 0.14, COL.gold);
      P(g, PRIM.box, 0, 0.95, 0, 0, 0, 0, 0.14, 1.25, 0.05, STEEL);
      P(g, PRIM.cone, 0, 1.72, 0, 0, 0, 0, 0.14, 0.35, 0.05, STEEL);
    }
    // Schwertspur
    if (p.attackT > 0 && p.items.sword) {
      const t = 1 - p.attackT / p.attackDur;
      const a = U.lerp(-1.3, 1.5, U.smooth(U.clamp(t * 1.3, 0, 1)));
      for (let i = 0; i < 4; i++) {
        const aa = a - i * 0.26;
        const al = (0.34 - i * 0.07) * (1 - t * 0.55);
        if (al <= 0) continue;
        P(root, PRIM.box, Math.sin(aa) * 1.35, 1.15 + Math.cos(aa) * 0.15, Math.cos(aa) * 1.35, 0, -aa, 0, 1.0, 0.1, 0.22, [1, 1, 0.9, al], { noDepthWrite: true, emis: 0.9 });
      }
    }
    shadow(p.x, World.height(p.x, p.z), p.z, 0.5, 0.32);
  }

  /* ---------- NPC ---------- */
  function drawNPC(n, time) {
    const root = node(pool[2], null, n.x, n.y, n.z, 0, n.yaw, 0, 1, 1, 1);
    const bob = Math.sin(time * 1.6 + n.x) * 0.03;
    P(root, PRIM.box, -0.18, 0.35, 0, 0, 0, 0, 0.26, 0.7, 0.26, BROWN);
    P(root, PRIM.box, 0.18, 0.35, 0, 0, 0, 0, 0.26, 0.7, 0.26, BROWN);
    P(root, PRIM.box, 0, 1.05 + bob, 0, 0, 0, 0, 0.8, 0.85, 0.58, n.color);
    P(root, PRIM.box, 0, 1.72 + bob, 0, 0, 0, 0, 0.6, 0.58, 0.58, SKIN);
    P(root, PRIM.box, 0, 1.9 + bob, -0.06, 0, 0, 0, 0.66, 0.3, 0.62, [0.85, 0.85, 0.85]);
    P(root, PRIM.box, -0.13, 1.74 + bob, 0.3, 0, 0, 0, 0.1, 0.1, 0.06, [0.1, 0.1, 0.15]);
    P(root, PRIM.box, 0.13, 1.74 + bob, 0.3, 0, 0, 0, 0.1, 0.1, 0.06, [0.1, 0.1, 0.15]);
    P(root, PRIM.box, -0.5, 1.05 + bob, 0, 0, 0, 0, 0.2, 0.6, 0.2, SKIN);
    P(root, PRIM.box, 0.5, 1.05 + bob, 0, 0, 0, 0, 0.2, 0.6, 0.2, SKIN);
    if (n.beard) P(root, PRIM.box, 0, 1.5 + bob, 0.22, 0, 0, 0, 0.34, 0.4, 0.2, [0.9, 0.9, 0.9]);
    shadow(n.x, World.height(n.x, n.z), n.z, 0.48, 0.28);
  }

  /* ---------- Gegner-Modelle ---------- */
  function drawEnemy(e, time) {
    const flash = e.hurtT > 0;
    const T = c => flash ? [1, 0.45, 0.4] : c;
    if (e.t === 'chuchu') {
      const sq = 1 + Math.sin(e.anim * 6) * 0.16;
      const root = node(pool[2], null, e.x, e.y, e.z, 0, e.yaw, 0, 1, 1, 1);
      P(root, PRIM.sphere, 0, 0.5 / sq, 0, 0, 0, 0, 1.05 * sq, 1.0 / sq, 1.05 * sq, T([0.35, 0.75, 0.95, 0.9]), { noDepthWrite: false });
      P(root, PRIM.sphere, -0.2, 0.62, 0.36, 0, 0, 0, 0.16, 0.16, 0.1, [0.05, 0.05, 0.1]);
      P(root, PRIM.sphere, 0.2, 0.62, 0.36, 0, 0, 0, 0.16, 0.16, 0.1, [0.05, 0.05, 0.1]);
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
      P(root, PRIM.box, -0.16, 2.22, 0.34, 0, 0, 0, 0.12, 0.12, 0.06, [0.9, 0.2, 0.15]);
      P(root, PRIM.box, 0.16, 2.22, 0.34, 0, 0, 0, 0.12, 0.12, 0.06, [0.9, 0.2, 0.15]);
      P(root, PRIM.cone, -0.3, 2.5, 0, 0, 0, -0.4, 0.16, 0.4, 0.16, [0.95, 0.92, 0.85]);
      P(root, PRIM.cone, 0.3, 2.5, 0, 0, 0, 0.4, 0.16, 0.4, 0.16, [0.95, 0.92, 0.85]);
      P(root, PRIM.box, -0.62, 1.35, 0, sw * 0.5, 0, 0, 0.26, 0.8, 0.26, T([0.52, 0.42, 0.28]));
      // Keulenarm
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
      P(root, PRIM.sphere, -0.14, 0.05, 0.26, 0, 0, 0, 0.14, 0.14, 0.08, [1, 0.35, 0.2]);
      P(root, PRIM.sphere, 0.14, 0.05, 0.26, 0, 0, 0, 0.14, 0.14, 0.08, [1, 0.35, 0.2]);
      shadow(e.x, e.groundY, e.z, 0.35, 0.2);
    } else if (e.t === 'boss') {
      const s = 1;
      const root = node(pool[2], null, e.x, e.y, e.z, 0, e.yaw, 0, s, s, s);
      const vul = e.state === 'stun';
      const body = T(vul ? [0.42, 0.40, 0.44] : [0.36, 0.35, 0.40]);
      const crouch = e.state === 'stun' ? -0.5 : 0;
      P(root, PRIM.box, -0.75, 0.85, 0, 0, 0, 0, 0.85, 1.7, 0.9, body);
      P(root, PRIM.box, 0.75, 0.85, 0, 0, 0, 0, 0.85, 1.7, 0.9, body);
      P(root, PRIM.box, 0, 3.0 + crouch, 0, 0, 0, 0, 3.0, 2.6, 2.0, body);
      P(root, PRIM.box, 0, 4.55 + crouch, 0, 0, 0, 0, 1.7, 0.9, 1.5, T([0.30, 0.29, 0.34]));
      P(root, PRIM.box, -0.42, 4.6 + crouch, 0.72, 0, 0, 0, 0.3, 0.28, 0.2, vul ? [1, 0.9, 0.3] : [0.95, 0.35, 0.2]);
      P(root, PRIM.box, 0.42, 4.6 + crouch, 0.72, 0, 0, 0, 0.3, 0.28, 0.2, vul ? [1, 0.9, 0.3] : [0.95, 0.35, 0.2]);
      // Kern
      const pulse = 0.9 + Math.sin(time * 6) * 0.1;
      P(root, PRIM.sphere, 0, 3.0 + crouch, 1.05, 0, 0, 0, 1.0 * pulse, 1.0 * pulse, 0.5,
        vul ? [0.4, 1.0, 0.5] : [0.5, 0.2, 0.2], { emis: vul ? 0.85 : 0.2 });
      // Arme
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
    G.draw(PRIM.tuft, pool[2], [0.35, 0.68, 0.28], { noCull: true });
  }
  function drawPot(p) {
    const root = node(pool[2], null, p.x, p.y, p.z, 0, 0, 0, 1, 1, 1);
    P(root, PRIM.sphere, 0, 0.42, 0, 0, 0, 0, 0.85, 0.9, 0.85, [0.70, 0.55, 0.38]);
    P(root, PRIM.cyl, 0, 0.82, 0, 0, 0, 0, 0.45, 0.22, 0.45, [0.55, 0.42, 0.28]);
    shadow(p.x, p.y, p.z, 0.4, 0.25);
  }
  function drawChest(c, time) {
    const root = node(pool[2], null, c.x, c.y, c.z, 0, c.yaw || 0, 0, 1, 1, 1);
    P(root, PRIM.box, 0, 0.45, 0, 0, 0, 0, 1.5, 0.9, 1.1, [0.50, 0.34, 0.20]);
    P(root, PRIM.box, 0, 0.45, 0, 0, 0, 0, 1.55, 0.24, 1.15, COL.gold);
    const lid = node(pool[3], root, 0, 0.9, -0.55, -(c.openT || 0) * 1.9, 0, 0, 1, 1, 1);
    P(lid, PRIM.box, 0, 0.16, 0.55, 0, 0, 0, 1.5, 0.34, 1.1, [0.58, 0.40, 0.24]);
    P(lid, PRIM.box, 0, 0.16, 0.55, 0, 0, 0, 1.55, 0.14, 1.15, COL.gold);
    if (!c.opened) P(root, PRIM.box, 0, 0.62, 0.58, 0, 0, 0, 0.3, 0.34, 0.12, COL.gold);
    shadow(c.x, c.y, c.z, 0.8, 0.3);
  }
  function drawSign(s) {
    const root = node(pool[2], null, s.x, s.y, s.z, 0, s.yaw || 0, 0, 1, 1, 1);
    P(root, PRIM.box, 0, 0.5, 0, 0, 0, 0, 0.16, 1.0, 0.16, COL.wood);
    P(root, PRIM.box, 0, 1.2, 0, 0, 0, 0, 1.3, 0.8, 0.12, [0.72, 0.55, 0.34]);
    shadow(s.x, s.y, s.z, 0.4, 0.22);
  }
  function drawCrack(c) {
    const root = node(pool[2], null, c.x, c.y, c.z, 0, 0.4, 0, 1, 1, 1);
    P(root, PRIM.box, 0, 1.1, 0, 0, 0, 0, 2.6, 2.2, 2.6, [0.42, 0.40, 0.44]);
    P(root, PRIM.box, 0, 1.3, 1.32, 0, 0, 0.3, 0.18, 1.4, 0.2, [0.2, 0.2, 0.22]);
    P(root, PRIM.box, 0.4, 0.8, 1.32, 0, 0, -0.5, 0.16, 1.0, 0.2, [0.2, 0.2, 0.22]);
    shadow(c.x, c.y, c.z, 1.4, 0.3);
  }
  function drawDoor(d) {
    const root = node(pool[2], null, d.x, d.y || 0, d.z, 0, 0, 0, 1, 1, 1);
    P(root, PRIM.box, 0, 1.9, 0, 0, 0, 0, 3.4, 3.8, 0.8, [0.35, 0.30, 0.26]);
    P(root, PRIM.box, 0, 1.9, 0.3, 0, 0, 0, 0.9, 0.9, 0.3, COL.gold, { emis: 0.3 });
    P(root, PRIM.box, 0, 1.9, 0.42, 0, 0, 0, 0.24, 0.5, 0.16, [0.2, 0.18, 0.16]);
  }
  function drawPickup(p, time) {
    const spin = time * 2.5 + p.seed;
    const root = node(pool[2], null, p.x, p.y + 0.45 + Math.sin(time * 3 + p.seed) * 0.12, p.z, 0, spin, 0, 1, 1, 1);
    if (p.kind === 'heart') {
      P(root, PRIM.box, -0.14, 0.1, 0, 0, 0, 0.5, 0.3, 0.3, 0.24, [0.95, 0.25, 0.35], { emis: 0.35 });
      P(root, PRIM.box, 0.14, 0.1, 0, 0, 0, -0.5, 0.3, 0.3, 0.24, [0.95, 0.25, 0.35], { emis: 0.35 });
      P(root, PRIM.box, 0, -0.12, 0, 0, 0, 0.78, 0.3, 0.3, 0.24, [0.95, 0.25, 0.35], { emis: 0.35 });
    } else if (p.kind === 'arrow') {
      P(root, PRIM.box, 0, 0, 0, 0, 0, 0.35, 0.07, 0.9, 0.07, [0.6, 0.45, 0.3], { emis: 0.2 });
      P(root, PRIM.cone, 0.16, 0.42, 0, 0, 0, 0.35, 0.16, 0.3, 0.16, STEEL, { emis: 0.2 });
    } else if (p.kind === 'key') {
      P(root, PRIM.box, 0, 0.2, 0, 0, 0, 0, 0.12, 0.7, 0.12, COL.gold, { emis: 0.4 });
      P(root, PRIM.box, 0, 0.55, 0, 0, 0, 0, 0.34, 0.34, 0.12, COL.gold, { emis: 0.4 });
      P(root, PRIM.box, 0.14, -0.1, 0, 0, 0, 0, 0.22, 0.12, 0.1, COL.gold, { emis: 0.4 });
    } else {
      const c = p.kind === 'rupee20' ? [0.95, 0.3, 0.3] : p.kind === 'rupee5' ? [0.35, 0.55, 0.95] : [0.35, 0.9, 0.45];
      P(root, PRIM.box, 0, 0, 0, 0, 0, 0, 0.28, 0.34, 0.28, c, { emis: 0.35 });
      P(root, PRIM.cone, 0, 0.3, 0, 0, 0, 0, 0.28, 0.32, 0.28, c, { emis: 0.35 });
      P(root, PRIM.cone, 0, -0.3, 0, Math.PI, 0, 0, 0.28, 0.32, 0.28, c, { emis: 0.35 });
    }
    shadow(p.x, p.groundY, p.z, 0.25, 0.18);
  }
  function drawProjectile(pr, time) {
    if (pr.kind === 'arrow') {
      const root = node(pool[2], null, pr.x, pr.y, pr.z, 0, pr.yaw, 0, 1, 1, 1);
      P(root, PRIM.box, 0, 0, 0, Math.PI / 2, 0, 0, 0.07, 1.1, 0.07, [0.6, 0.45, 0.3]);
      P(root, PRIM.cone, 0, 0, 0.6, Math.PI / 2, 0, 0, 0.14, 0.3, 0.14, STEEL);
    } else if (pr.kind === 'bomb') {
      const t = pr.fuse;
      const blink = t < 1.2 && Math.floor(t * 10) % 2 === 0;
      const root = node(pool[2], null, pr.x, pr.y, pr.z, 0, 0, 0, 1, 1, 1);
      P(root, PRIM.sphere, 0, 0.3, 0, 0, 0, 0, 0.75, 0.75, 0.75, blink ? [1, 0.4, 0.35] : [0.16, 0.16, 0.2]);
      P(root, PRIM.box, 0, 0.72, 0, 0.3, 0, 0, 0.1, 0.3, 0.1, [0.5, 0.4, 0.3]);
      shadow(pr.x, pr.groundY, pr.z, 0.35, 0.25);
    } else if (pr.kind === 'rock') {
      const root = node(pool[2], null, pr.x, pr.y, pr.z, pr.spin, pr.spin * 0.7, 0, 1, 1, 1);
      P(root, PRIM.sphere, 0, 0, 0, 0, 0, 0, 1.1, 1.0, 1.1, [0.4, 0.38, 0.36]);
    }
  }
  function drawShockwave(s) {
    node(pool[2], null, s.x, s.y + 0.06, s.z, 0, 0, 0, s.r * 2, 1, s.r * 2);
    G.draw(PRIM.disc, pool[2], [1, 0.85, 0.4, U.clamp(s.life, 0, 0.55)], { noDepthWrite: true, emis: 0.7 });
  }

  /* =========================================================
     GEGNER-KI
     ========================================================= */
  function makeEnemy(t, x, z) {
    const base = { t, x, z, y: 0, yaw: 0, anim: Math.random() * 6, seed: Math.random() * 6, speed: 0, hurtT: 0, state: 'idle', stateT: 0, kbx: 0, kbz: 0, groundY: 0, dead: false, vy: 0 };
    if (t === 'chuchu') Object.assign(base, { hp: 2, maxhp: 2, r: 0.6, dmg: 1, agro: 15, spd: 3.4 });
    if (t === 'moblin') Object.assign(base, { hp: 4, maxhp: 4, r: 0.85, dmg: 2, agro: 18, spd: 3.0 });
    if (t === 'keese') Object.assign(base, { hp: 1, maxhp: 1, r: 0.5, dmg: 1, agro: 16, spd: 5.0, fly: true });
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
    const canSee = d < e.agro && !p.dead;

    // Rückstoß
    if (Math.abs(e.kbx) + Math.abs(e.kbz) > 0.01) {
      const m = World.move(e.x, e.z, e.kbx * dt, e.kbz * dt, e.r, false);
      e.x = m.x; e.z = m.z;
      e.kbx *= Math.pow(0.008, dt); e.kbz *= Math.pow(0.008, dt);
    }

    let vx = 0, vz = 0;
    if (e.t === 'chuchu') {
      if (e.state === 'idle' && e.stateT <= 0) { e.state = 'hop'; e.stateT = 0.55; e.vy = 4.2; }
      if (e.state === 'hop') {
        if (canSee) { vx = dx / d * e.spd; vz = dz / d * e.spd; }
        else { vx = Math.cos(e.seed * 3) * 1.2; vz = Math.sin(e.seed * 3) * 1.2; }
        if (e.stateT <= 0) { e.state = 'idle'; e.stateT = 0.45 + Math.random() * 0.4; }
      }
      e.vy -= 14 * dt;
      e.y += e.vy * dt;
      if (e.y < e.groundY) { e.y = e.groundY; e.vy = 0; }
    } else if (e.t === 'moblin') {
      if (e.state === 'idle') {
        if (canSee) {
          if (d < 2.9) { e.state = 'wind'; e.stateT = 0.45; }
          else { vx = dx / d * e.spd; vz = dz / d * e.spd; }
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
        const s = d < 4 ? e.spd * 1.3 : e.spd;
        vx = dx / d * s + Math.cos(e.anim * 3 + e.seed) * 1.6;
        vz = dz / d * s + Math.sin(e.anim * 3 + e.seed) * 1.6;
      } else {
        vx = Math.cos(e.anim * 1.2 + e.seed) * 2.0; vz = Math.sin(e.anim * 1.1 + e.seed) * 2.0;
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
        if (d < 4.6) { e.state = 'wind'; e.stateT = 0.75; }
        else if (e.stateT <= 0) { e.state = 'wind'; e.stateT = 0.75; }
      } else if (e.state === 'wind') {
        if (e.stateT <= 0) { e.state = 'slam'; e.stateT = 0.25; e.didHit = false; }
      } else if (e.state === 'slam') {
        if (!e.didHit) {
          e.didHit = true;
          Snd.boom();
          g.shockwave(e.x, e.z, 9.5, e.dmg);
          g.shake = 0.6;
          g.burst(e.x, e.groundY + 0.2, e.z, 26, [0.5, 0.45, 0.4], 7);
        }
        if (e.stateT <= 0) { e.state = 'stun'; e.stateT = 2.6; }
      } else if (e.state === 'stun') {
        if (e.stateT <= 0) { e.state = 'idle'; e.stateT = 0.5; }
      } else if (e.state === 'throw') {
        if (e.stateT <= 0) {
          g.spawnRock(e.x, e.y + 3.4, e.z, dx / d, dz / d);
          e.state = 'idle'; e.stateT = 1.0;
        }
      }
      // Kontaktschaden beim Ansturm
      if (e.state === 'chase' && d < e.r + 0.9) g.damagePlayer(2, e.x, e.z);
    }

    // Bewegung anwenden
    const sp = Math.hypot(vx, vz);
    e.speed = sp;
    if (sp > 0.01) {
      const m = World.move(e.x, e.z, vx * dt, vz * dt, e.r, false);
      const moved = Math.hypot(m.x - e.x, m.z - e.z);
      e.x = m.x; e.z = m.z;
      e.yaw = U.angLerp(e.yaw, Math.atan2(vx, vz), Math.min(1, dt * 8));
      if (e.t === 'boss' && e.state === 'chase' && moved < sp * dt * 0.3) { e.state = 'wind'; e.stateT = 0.5; }
    } else if (canSee && e.t !== 'keese') {
      e.yaw = U.angLerp(e.yaw, Math.atan2(dx, dz), Math.min(1, dt * 6));
    }

    e.groundY = World.height(e.x, e.z);
    if (!e.fly && e.t !== 'chuchu') e.y = e.groundY;
    if (e.t === 'chuchu' && e.y < e.groundY) e.y = e.groundY;

    // Kontaktschaden
    if (e.t !== 'boss' && d < e.r + 0.55 && !p.dead) {
      if (e.t !== 'moblin' || e.state === 'idle') g.damagePlayer(e.dmg, e.x, e.z);
    }
  }

  return {
    drawPlayer, drawNPC, drawEnemy, drawGrass, drawPot, drawChest, drawSign,
    drawCrack, drawDoor, drawPickup, drawProjectile, drawShockwave, shadow,
    makeEnemy, updateEnemy, node, P
  };
})();
