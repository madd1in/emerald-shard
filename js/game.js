'use strict';
/* =========================================================
   GAME — Steuerung, Kampf, Items, Kamera, HUD
   ========================================================= */

const Game = {
  state: 'title',
  time: 0, shake: 0,
  keys: {}, mouse: { dx: 0, dy: 0, locked: false },
  camYaw: 0, camPitch: 0.42, camDist: 10.5,
  camPos: { x: 0, y: 5, z: 20 },
  enemies: [], pickups: [], projectiles: [], particles: [], shockwaves: [],
  chests: [], grass: [], pots: [], npcs: [], signs: [], cracks: [], doors: [],
  bossActive: false, bossDead: false, prompt: null, dialog: null,
  hasShard: false,

  player: null,

  /* ---------------- Setup ---------------- */
  init() {
    const canvas = document.getElementById('c');
    if (!G.init(canvas)) {
      document.getElementById('title').innerHTML = '<h1>WebGL nicht verfügbar</h1><p>Bitte einen aktuellen Browser mit WebGL nutzen.</p>';
      return;
    }
    this.canvas = canvas;
    buildPrims();
    World.build();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
    this.mini = document.getElementById('mini').getContext('2d');
    this.reset();
    requestAnimationFrame(t => this.loop(t));
  },

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
  },

  reset() {
    this.player = {
      x: 0, z: 70, y: 0, yaw: Math.PI, vy: 0, speed: 0, walkPhase: 0,
      hp: 6, maxhp: 6, rupees: 0, keys: 0, bombs: 0, arrows: 0,
      items: { sword: false, shield: false, bow: false, bomb: false },
      invuln: 0, attackT: 0, attackDur: 0.36, hitList: [], rollT: 0, rollDir: { x: 0, z: 1 },
      dead: false, splashT: 0, stepT: 0
    };
    this.enemies = []; this.pickups = []; this.projectiles = []; this.particles = [];
    this.shockwaves = []; this.chests = []; this.grass = []; this.pots = [];
    this.npcs = []; this.signs = []; this.cracks = []; this.doors = [];
    this.bossActive = false; this.bossDead = false; this.hasShard = false;
    this.camYaw = Math.PI; this.camPitch = 0.42;

    World.enter('over');
    World.over.colliders.length = World.over.baseCol;   // dynamische Collider zurücksetzen
    const S = World.over.spawns;
    for (const e of S.enemies) { const en = Ents.makeEnemy(e.t, e.x, e.z); en.scene = 'over'; en.groundY = World.height(e.x, e.z); en.y = en.groundY; this.enemies.push(en); }
    for (const gr of S.grass) this.grass.push({ x: gr.x, z: gr.z, y: World.height(gr.x, gr.z), seed: Math.random() * 6, scene: 'over' });
    for (const c of S.chests) this.chests.push({ x: c.x, z: c.z, y: World.height(c.x, c.z), item: c.item, label: c.label, opened: false, openT: 0, yaw: 0, scene: 'over', hidden: false });
    for (const n of S.npcs) this.npcs.push({ x: n.x, z: n.z, y: World.height(n.x, n.z), yaw: Math.PI, name: n.name, color: n.color, lines: n.lines, give: n.give, beard: !!n.give, scene: 'over' });
    for (const p of S.props) {
      if (p.t === 'sign') this.signs.push({ x: p.x, z: p.z, y: World.height(p.x, p.z), text: p.text, yaw: 0, scene: 'over' });
      if (p.t === 'crack') this.cracks.push({ x: p.x, z: p.z, y: World.height(p.x, p.z), scene: 'over' });
    }
    for (const cr of this.cracks) World.over.colliders.push(cr.col = { x: cr.x, z: cr.z, r: 1.7 });

    this.spawnDungeon();
    this.updateHUD();
  },

  spawnDungeon() {
    // vorhandene Dungeon-Objekte entfernen
    const notDun = a => a.filter(o => o.scene !== 'dun');
    this.enemies = notDun(this.enemies); this.chests = notDun(this.chests);
    this.pots = notDun(this.pots); this.doors = notDun(this.doors);
    this.pickups = notDun(this.pickups);
    const D = World.dun;
    D.colliders.length = D.baseCol;
    for (const e of D.spawns.enemies) {
      const en = Ents.makeEnemy(e.t, e.x, e.z); en.scene = 'dun'; en.groundY = 0; en.y = 0;
      if (e.t === 'boss') { en.sleeping = true; this.boss = en; }
      this.enemies.push(en);
    }
    for (const c of D.spawns.chests) this.chests.push({ x: c.x, z: c.z, y: 0, item: c.item, label: c.label, opened: false, openT: 0, yaw: 0, scene: 'dun', hidden: !!c.hidden });
    for (const p of D.spawns.pots) this.pots.push({ x: p.x, z: p.z, y: 0, scene: 'dun' });
    // verschlossene Tür
    D.door.open = false;
    const dcol = { x: D.door.x, z: D.door.z, hx: 1.7, hz: 1.0 };
    World.dun.colliders.push(dcol);
    this.doors.push({ x: D.door.x, z: D.door.z, y: 0, col: dcol, locked: true, scene: 'dun' });
    // Bosstor (erst aktiv, wenn Boss erwacht)
    this.gateCol = { x: D.bossGate.x, z: D.bossGate.z, hx: 1.7, hz: 1.0, disabled: true };
    World.dun.colliders.push(this.gateCol);
    this.bossDead = false; this.bossActive = false;
  },

  /* ---------------- Eingabe ---------------- */
  bindInput() {
    window.addEventListener('keydown', e => {
      if (e.repeat) { return; }
      this.keys[e.code] = true;
      if (this.state === 'title') { if (e.code === 'Enter' || e.code === 'Space') this.start(); return; }
      if (e.code === 'KeyM') { Snd.musicOn = !Snd.musicOn; if (Snd.musicOn) Snd.music(World.scene === 'dun' ? (this.bossActive ? 'boss' : 'dun') : 'over'); else Snd.stopMusic(); this.toast(Snd.musicOn ? 'Musik an' : 'Musik aus'); }
      if (this.state === 'dialog') { if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') this.advanceDialog(); return; }
      if (this.state !== 'play') return;
      if (e.code === 'Space' || e.code === 'KeyJ') this.attack();
      if (e.code === 'KeyE') this.interact();
      if (e.code === 'KeyQ') this.useBomb();
      if (e.code === 'KeyF') this.useBow();
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.roll();
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    this.canvas.addEventListener('mousedown', e => {
      if (this.state === 'pause') { this.resume(); return; }
      if (this.state === 'dialog') { this.advanceDialog(); return; }
      if (this.state !== 'play') return;
      if (!this.mouse.locked) { this.canvas.requestPointerLock(); return; }
      if (e.button === 0) this.attack();
    });
    document.addEventListener('pointerlockchange', () => {
      this.mouse.locked = document.pointerLockElement === this.canvas;
      if (!this.mouse.locked && this.state === 'play') this.pause();
    });
    document.addEventListener('mousemove', e => {
      if (this.mouse.locked && this.state === 'play') {
        this.camYaw -= e.movementX * 0.0026;
        this.camPitch = U.clamp(this.camPitch + e.movementY * 0.0022, -0.12, 1.15);
      }
    });
    document.getElementById('startBtn').addEventListener('click', () => this.start());
    document.getElementById('againBtn').addEventListener('click', () => { this.reset(); this.state = 'play'; document.getElementById('over').style.display = 'none'; this.canvas.requestPointerLock(); Snd.music('over'); });
  },

  start() {
    Snd.init();
    document.getElementById('title').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    this.state = 'play';
    this.canvas.requestPointerLock();
    Snd.music('over');
    this.toast('Sprich mit dem Ältesten im Dorf (E)', 4);
  },
  pause() { if (this.state !== 'play') return; this.state = 'pause'; document.getElementById('pause').style.display = 'flex'; },
  resume() { document.getElementById('pause').style.display = 'none'; this.state = 'play'; this.canvas.requestPointerLock(); },

  /* ---------------- Aktionen ---------------- */
  attack() {
    const p = this.player;
    if (!p.items.sword) { this.toast('Du hast noch keine Waffe!'); return; }
    if (p.attackT > 0 || p.rollT > 0 || p.dead) return;
    p.attackT = p.attackDur; p.hitList = [];
    Snd.swing();
  },
  roll() {
    const p = this.player;
    if (p.rollT > 0 || p.dead || p.attackT > 0) return;
    const m = this.moveInput();
    if (m.x === 0 && m.z === 0) { p.rollDir.x = Math.sin(p.yaw); p.rollDir.z = Math.cos(p.yaw); }
    else { p.rollDir.x = m.x; p.rollDir.z = m.z; }
    p.rollT = 0.42; p.invuln = Math.max(p.invuln, 0.3);
    Snd.tone(320, 0.12, 'triangle', 0.12, 620);
  },
  useBomb() {
    const p = this.player;
    if (!p.items.bomb || p.bombs <= 0) { if (p.items.bomb) this.toast('Keine Bomben mehr'); return; }
    p.bombs--;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    this.projectiles.push({
      kind: 'bomb', scene: World.scene, x: p.x + fx * 0.8, z: p.z + fz * 0.8, y: p.y + 1.2,
      vx: fx * 7, vz: fz * 7, vy: 4.5, fuse: 2.6, groundY: World.height(p.x, p.z)
    });
    Snd.tone(220, 0.1, 'square', 0.12, 400);
    this.updateHUD();
  },
  useBow() {
    const p = this.player;
    if (!p.items.bow) return;
    if (p.arrows <= 0) { this.toast('Keine Pfeile mehr'); return; }
    p.arrows--;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    this.projectiles.push({ kind: 'arrow', scene: World.scene, x: p.x + fx, z: p.z + fz, y: p.y + 1.3, vx: fx * 30, vz: fz * 30, vy: 0.6, life: 1.8, yaw: p.yaw });
    Snd.bow();
    this.updateHUD();
  },

  interact() {
    const p = this.player;
    const t = this.prompt;
    if (!t) return;
    if (t.kind === 'npc') {
      const n = t.obj;
      n.yaw = Math.atan2(p.x - n.x, p.z - n.z);
      let lines = n.lines.slice();
      if (n.give && !p.items[n.give]) {
        this.openDialog(n.name, lines, () => {
          p.items.sword = true; p.items.shield = true;
          Snd.fanfare(); this.toast('Schwert & Schild erhalten! (Leertaste = Angriff)', 5);
          this.updateHUD();
        });
      } else {
        if (n.give && p.items.sword) lines = this.hasShard
          ? ['Du hast den Splitter zurückgebracht! Ardun ist gerettet, Held.']
          : ['Die Ruine liegt im Norden, hinter dem Pass. Sei wachsam!'];
        this.openDialog(n.name, lines);
      }
    } else if (t.kind === 'sign') {
      this.openDialog('Schild', [t.obj.text]);
    } else if (t.kind === 'chest') {
      this.openChest(t.obj);
    } else if (t.kind === 'dungeon') {
      this.enterDungeon();
    } else if (t.kind === 'exit') {
      this.exitDungeon();
    } else if (t.kind === 'door') {
      if (p.keys > 0) {
        p.keys--; t.obj.locked = false; t.obj.col.disabled = true;
        t.obj.gone = true;
        Snd.door(); this.toast('Tür aufgeschlossen'); this.updateHUD();
      } else this.toast('Verschlossen. Du brauchst einen Schlüssel.');
    }
  },

  openChest(c) {
    if (c.opened) return;
    c.opened = true; c.openT = 0.001;
    Snd.chest();
    const p = this.player;
    switch (c.item) {
      case 'bomb': p.items.bomb = true; p.bombs += 10; this.toast('Bomben (10)! [Q] zum Werfen', 4.5); break;
      case 'bow': p.items.bow = true; p.arrows += 20; this.toast('Bogen & 20 Pfeile! [F] zum Schießen', 4.5); break;
      case 'rupee20': p.rupees += 20; this.toast('20 Rubine!'); break;
      case 'key': p.keys++; this.toast('Kleiner Schlüssel!'); break;
      case 'heart_container': p.maxhp += 2; p.hp = p.maxhp; Snd.heart(); this.toast('Herzcontainer! Maximale Energie erhöht.', 4); break;
      case 'shard': this.win(); break;
    }
    this.burst(c.x, c.y + 1.2, c.z, 20, [1, 0.9, 0.4], 4);
    this.updateHUD();
  },

  /* ---------------- Szenenwechsel ---------------- */
  enterDungeon() {
    World.enter('dun');
    const s = World.dun.start;
    this.player.x = s.x; this.player.z = s.z; this.player.y = 0; this.player.yaw = Math.PI;
    this.camYaw = Math.PI;
    Snd.door(); Snd.music('dun');
    this.toast('Ruine der Ahnen', 3);
  },
  exitDungeon() {
    World.enter('over');
    const d = World.dungeonDoor;
    this.player.x = d.x; this.player.z = d.z + 4;
    this.player.y = World.height(this.player.x, this.player.z);
    this.player.yaw = 0; this.camYaw = 0;
    Snd.door(); Snd.music('over');
    this.bossActive = false;
  },

  /* ---------------- Kampf ---------------- */
  damagePlayer(dmg, sx, sz) {
    const p = this.player;
    if (p.invuln > 0 || p.dead || this.state !== 'play') return;
    // Schild blockt Frontalschaden
    if (p.items.shield && sx !== undefined) {
      const a = Math.atan2(sx - p.x, sz - p.z);
      if (Math.abs(U.angDiff(p.yaw, a)) < 0.75 && this.keys['KeyK']) {
        Snd.tone(900, 0.12, 'square', 0.2, 500); p.invuln = 0.3;
        this.burst(p.x, p.y + 1.2, p.z, 6, [1, 1, 0.7], 3); return;
      }
    }
    p.hp -= dmg; p.invuln = 1.1;
    Snd.hurt(); this.shake = Math.max(this.shake, 0.35);
    if (sx !== undefined) {
      const a = Math.atan2(p.x - sx, p.z - sz);
      p.kbx = Math.sin(a) * 9; p.kbz = Math.cos(a) * 9; p.kbT = 0.22;
    }
    this.updateHUD();
    if (p.hp <= 0) { p.hp = 0; p.dead = true; this.die(); }
  },

  hitEnemy(e, dmg, fromX, fromZ, knock) {
    if (e.dead) return;
    if (e.boss && e.state !== 'stun') {
      Snd.tone(1200, 0.09, 'square', 0.14, 700);
      this.burst(e.x, e.y + 3, e.z, 5, [1, 1, 0.6], 3);
      return;
    }
    if (e.hurtT > 0.18) return;
    e.hp -= dmg; e.hurtT = 0.32;
    Snd.hit();
    this.burst(e.x, e.y + (e.boss ? 3 : 0.8), e.z, e.boss ? 14 : 8, [1, 0.85, 0.5], 4);
    const a = Math.atan2(e.x - fromX, e.z - fromZ);
    const k = knock === undefined ? 9 : knock;
    e.kbx = Math.sin(a) * k; e.kbz = Math.cos(a) * k;
    if (e.hp <= 0) this.killEnemy(e);
    else if (e.boss) this.shake = 0.2;
  },

  killEnemy(e) {
    e.dead = true;
    this.burst(e.x, e.y + 0.8, e.z, e.boss ? 60 : 16, e.boss ? [0.6, 0.6, 0.65] : [0.9, 0.7, 0.4], e.boss ? 9 : 5);
    if (e.boss) {
      Snd.boom(); Snd.fanfare(); this.shake = 1.0;
      this.bossDead = true; this.bossActive = false;
      this.gateCol.disabled = true;
      const c = this.chests.find(c => c.item === 'shard'); if (c) c.hidden = false;
      Snd.music('dun');
      this.toast('Der Steingolem zerfällt! Eine Truhe erscheint.', 5);
      return;
    }
    Snd.tone(160, 0.2, 'sawtooth', 0.14, 60);
    const r = Math.random();
    if (r < 0.30) this.spawnPickup(e.x, e.z, 'rupee');
    else if (r < 0.40) this.spawnPickup(e.x, e.z, 'rupee5');
    else if (r < 0.58) this.spawnPickup(e.x, e.z, 'heart');
    else if (r < 0.66 && this.player.items.bow) this.spawnPickup(e.x, e.z, 'arrow');
  },

  spawnPickup(x, z, kind) {
    const gy = World.height(x, z);
    this.pickups.push({ x, z, y: gy + 0.6, vy: 3.5, vx: (Math.random() - 0.5) * 2, vz: (Math.random() - 0.5) * 2, kind, seed: Math.random() * 6, groundY: gy, life: 25, scene: World.scene });
  },
  spawnRock(x, y, z, dx, dz) {
    this.projectiles.push({ kind: 'rock', scene: World.scene, x, y, z, vx: dx * 15, vz: dz * 15, vy: 5, life: 4, spin: 0, groundY: World.height(x, z) });
    Snd.tone(150, 0.2, 'sawtooth', 0.14, 90);
  },
  shockwave(x, z, maxR, dmg) {
    this.shockwaves.push({ x, z, y: World.height(x, z), r: 1, maxR, dmg, life: 0.55, scene: World.scene, hit: false });
  },
  burst(x, y, z, n, col, spread) {
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 320) break;
      const a = Math.random() * Math.PI * 2, s = Math.random() * (spread || 4);
      this.particles.push({
        x, y, z, vx: Math.cos(a) * s, vy: 1 + Math.random() * (spread || 4), vz: Math.sin(a) * s,
        life: 0.4 + Math.random() * 0.5, maxlife: 0.9, size: 0.1 + Math.random() * 0.18,
        col: [col[0] * (0.8 + Math.random() * 0.4), col[1] * (0.8 + Math.random() * 0.4), col[2] * (0.8 + Math.random() * 0.4)],
        scene: World.scene
      });
    }
  },

  explode(x, y, z) {
    Snd.boom(); this.shake = Math.max(this.shake, 0.7);
    this.burst(x, y, z, 40, [1, 0.7, 0.25], 9);
    this.burst(x, y, z, 18, [0.35, 0.35, 0.35], 6);
    for (const e of this.enemies) {
      if (e.dead || e.scene !== World.scene) continue;
      if (U.dist(e.x, e.z, x, z) < 4.6) {
        if (e.boss && e.state !== 'stun') { this.hitEnemy(e, 0, x, z); }
        else { e.hurtT = 0; this.hitEnemy(e, 3, x, z, 12); }
      }
    }
    if (U.dist(this.player.x, this.player.z, x, z) < 3.4) this.damagePlayer(2, x, z);
    for (const c of this.cracks) {
      if (c.broken || c.scene !== World.scene) continue;
      if (U.dist(c.x, c.z, x, z) < 4.6) {
        c.broken = true; c.col.disabled = true;
        this.burst(c.x, c.y + 1, c.z, 26, [0.5, 0.48, 0.5], 6);
        this.spawnPickup(c.x, c.z + 2, 'heartContainerDrop');
        const gy = World.height(c.x, c.z + 2.4);
        this.chests.push({ x: c.x, z: c.z + 2.4, y: gy, item: 'heart_container', label: 'Herzcontainer', opened: false, openT: 0, yaw: 0, scene: 'over', hidden: false });
        this.pickups = this.pickups.filter(p => p.kind !== 'heartContainerDrop');
        this.toast('Ein Geheimnis wurde freigelegt!', 3);
      }
    }
    for (const g of this.grass) if (!g.cut && g.scene === World.scene && U.dist(g.x, g.z, x, z) < 4.6) this.cutGrass(g);
    for (const p of this.pots) if (!p.broken && p.scene === World.scene && U.dist(p.x, p.z, x, z) < 4.6) this.breakPot(p);
  },

  cutGrass(g) {
    g.cut = true;
    this.burst(g.x, g.y + 0.4, g.z, 10, [0.4, 0.75, 0.3], 3.5);
    Snd.noise(0.12, 0.16, 3000);
    const r = Math.random();
    if (r < 0.22) this.spawnPickup(g.x, g.z, 'rupee');
    else if (r < 0.32) this.spawnPickup(g.x, g.z, 'heart');
  },
  breakPot(p) {
    p.broken = true;
    this.burst(p.x, p.y + 0.5, p.z, 14, [0.7, 0.55, 0.38], 4.5);
    Snd.noise(0.2, 0.28, 1800);
    const r = Math.random();
    if (r < 0.35) this.spawnPickup(p.x, p.z, 'heart');
    else if (r < 0.6) this.spawnPickup(p.x, p.z, 'rupee5');
    else if (r < 0.8 && this.player.items.bow) this.spawnPickup(p.x, p.z, 'arrow');
  },

  die() {
    Snd.stopMusic();
    Snd.tone(300, 0.9, 'sawtooth', 0.25, 80);
    this.state = 'dead';
    document.exitPointerLock();
    document.getElementById('over').style.display = 'flex';
  },
  win() {
    this.hasShard = true;
    Snd.stopMusic(); Snd.fanfare();
    this.state = 'win';
    document.exitPointerLock();
    document.getElementById('winRupees').textContent = this.player.rupees;
    document.getElementById('win').style.display = 'flex';
  },

  /* ---------------- Dialog / HUD ---------------- */
  openDialog(who, lines, onEnd) {
    this.state = 'dialog';
    this.dialog = { who, lines, i: 0, onEnd, char: 0 };
    document.exitPointerLock();
    this.renderDialog();
    document.getElementById('dialog').style.display = 'block';
  },
  renderDialog() {
    const d = this.dialog;
    document.getElementById('dlgName').textContent = d.who;
    document.getElementById('dlgText').textContent = d.lines[d.i].replace('{name}', 'Held');
    Snd.tone(660, 0.05, 'square', 0.06);
  },
  advanceDialog() {
    const d = this.dialog;
    d.i++;
    if (d.i >= d.lines.length) {
      document.getElementById('dialog').style.display = 'none';
      this.dialog = null; this.state = 'play';
      this.canvas.requestPointerLock();
      if (d.onEnd) d.onEnd();
    } else this.renderDialog();
  },
  toast(text, dur) {
    const el = document.getElementById('toast');
    el.textContent = text; el.style.opacity = '1';
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { el.style.opacity = '0'; }, (dur || 2.4) * 1000);
  },
  updateHUD() {
    const p = this.player;
    let h = '';
    for (let i = 0; i < p.maxhp / 2; i++) {
      const v = p.hp - i * 2;
      h += `<span class="heart ${v >= 2 ? 'full' : v === 1 ? 'half' : 'empty'}">${v >= 2 ? '♥' : v === 1 ? '♥' : '♡'}</span>`;
    }
    document.getElementById('hearts').innerHTML = h;
    document.getElementById('rupees').textContent = p.rupees;
    document.getElementById('keys').textContent = p.keys;
    document.getElementById('bombs').textContent = p.items.bomb ? p.bombs : '–';
    document.getElementById('arrows').textContent = p.items.bow ? p.arrows : '–';
  },

  /* ---------------- Update ---------------- */
  moveInput() {
    const k = this.keys;
    let f = 0, r = 0;
    if (k['KeyW']) f += 1; if (k['KeyS']) f -= 1;
    if (k['KeyA']) r -= 1; if (k['KeyD']) r += 1;
    if (f === 0 && r === 0) return { x: 0, z: 0 };
    const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw);
    const rx = -fz, rz = fx;
    let x = fx * f + rx * r, z = fz * f + rz * r;
    const l = Math.hypot(x, z) || 1;
    return { x: x / l, z: z / l };
  },

  update(dt) {
    this.time += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.6);
    if (this.keys['ArrowLeft']) this.camYaw += dt * 2.2;
    if (this.keys['ArrowRight']) this.camYaw -= dt * 2.2;
    if (this.keys['ArrowUp']) this.camPitch = U.clamp(this.camPitch - dt * 1.2, -0.12, 1.15);
    if (this.keys['ArrowDown']) this.camPitch = U.clamp(this.camPitch + dt * 1.2, -0.12, 1.15);

    if (this.state === 'play') this.updatePlayer(dt);
    this.updateWorldObjects(dt);
    this.updateCamera(dt);
  },

  updatePlayer(dt) {
    const p = this.player;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.attackT > 0) p.attackT -= dt;
    if (p.rollT > 0) p.rollT -= dt;
    if (p.kbT > 0) p.kbT -= dt;

    const inWater = World.inWater(p.x, p.z);
    let m = this.moveInput();
    let spd = inWater ? 3.0 : 6.4;
    if (p.attackT > 0) spd *= 0.35;
    if (p.rollT > 0) { m = { x: p.rollDir.x, z: p.rollDir.z }; spd = 11.5; }

    let vx = m.x * spd, vz = m.z * spd;
    if (p.kbT > 0) { vx += p.kbx; vz += p.kbz; }

    if (vx !== 0 || vz !== 0) {
      const mv = World.move(p.x, p.z, vx * dt, vz * dt, 0.45, true);
      p.x = mv.x; p.z = mv.z;
    }
    p.speed = Math.hypot(m.x, m.z) * spd;
    if (p.speed > 0.4 && p.rollT <= 0) {
      p.yaw = U.angLerp(p.yaw, Math.atan2(m.x, m.z), Math.min(1, dt * 14));
    } else if (p.rollT > 0) {
      p.yaw = U.angLerp(p.yaw, Math.atan2(p.rollDir.x, p.rollDir.z), Math.min(1, dt * 14));
    }
    p.walkPhase += dt * (p.rollT > 0 ? 26 : 9) * (p.speed > 0.4 ? 1 : 0);
    p.y = World.height(p.x, p.z);
    if (inWater) p.y = Math.max(p.y, WATER_Y - 0.55);

    // Schritte / Wasserspritzer
    p.stepT -= dt;
    if (p.speed > 1 && p.stepT <= 0) {
      p.stepT = inWater ? 0.34 : 0.30;
      Snd.step();
      if (inWater) this.burst(p.x, WATER_Y + 0.1, p.z, 4, [0.6, 0.85, 1.0], 2);
    }

    // Schwerttreffer
    if (p.attackT > 0 && p.items.sword) {
      const t = 1 - p.attackT / p.attackDur;
      if (t > 0.12 && t < 0.72) {
        const reach = 2.5;
        for (const e of this.enemies) {
          if (e.dead || e.scene !== World.scene || e.sleeping) continue;
          if (p.hitList.indexOf(e) >= 0) continue;
          const d = U.dist(p.x, p.z, e.x, e.z);
          if (d < reach + e.r) {
            const a = Math.atan2(e.x - p.x, e.z - p.z);
            if (Math.abs(U.angDiff(p.yaw, a)) < 1.35) { p.hitList.push(e); this.hitEnemy(e, 1, p.x, p.z); }
          }
        }
        for (const g of this.grass) {
          if (g.cut || g.scene !== World.scene) continue;
          if (U.dist(p.x, p.z, g.x, g.z) < 2.0) {
            const a = Math.atan2(g.x - p.x, g.z - p.z);
            if (Math.abs(U.angDiff(p.yaw, a)) < 1.5) this.cutGrass(g);
          }
        }
        for (const o of this.pots) {
          if (o.broken || o.scene !== World.scene) continue;
          if (U.dist(p.x, p.z, o.x, o.z) < 2.1) this.breakPot(o);
        }
      }
    }

    // Interaktions-Ziel bestimmen
    this.prompt = null;
    let best = 3.2;
    const consider = (kind, obj, x, z, text, range) => {
      const d = U.dist(p.x, p.z, x, z);
      if (d < (range || 3.0) && d < best) { best = d; this.prompt = { kind, obj, text }; }
    };
    if (World.scene === 'over') {
      for (const n of this.npcs) consider('npc', n, n.x, n.z, 'Reden');
      for (const s of this.signs) consider('sign', s, s.x, s.z, 'Lesen', 2.6);
      const dd = World.dungeonDoor;
      consider('dungeon', null, dd.x, dd.z, 'Ruine betreten', 3.4);
    } else {
      const ex = World.dun.exit;
      consider('exit', null, ex.x, ex.z, 'Ruine verlassen', 3.0);
      for (const d of this.doors) if (!d.gone && d.scene === 'dun') consider('door', d, d.x, d.z, d.locked ? 'Aufschließen' : 'Tür', 3.4);
    }
    for (const c of this.chests) {
      if (c.scene !== World.scene || c.opened || c.hidden) continue;
      consider('chest', c, c.x, c.z, 'Öffnen', 2.8);
    }
    const pel = document.getElementById('prompt');
    if (this.prompt) { pel.style.display = 'block'; pel.innerHTML = `<b>E</b> &nbsp;${this.prompt.text}`; }
    else pel.style.display = 'none';

    // Boss aktivieren
    if (World.scene === 'dun' && this.boss && this.boss.sleeping && !this.boss.dead) {
      const br = World.dun.bossRoom;
      if (p.x > br.minX && p.x < br.maxX && p.z > br.minZ && p.z < br.maxZ) {
        this.boss.sleeping = false; this.bossActive = true;
        this.gateCol.disabled = false;
        Snd.music('boss'); this.shake = 0.8;
        this.toast('STEINGOLEM ERWACHT', 3.5);
      }
    }
  },

  updateWorldObjects(dt) {
    const p = this.player, sc = World.scene;

    for (const e of this.enemies) {
      if (e.dead || e.scene !== sc || e.sleeping) continue;
      if (U.dist(e.x, e.z, p.x, p.z) > 70) continue;
      Ents.updateEnemy(e, dt, this);
    }
    this.enemies = this.enemies.filter(e => !e.dead);

    // Truhen-Animation
    for (const c of this.chests) if (c.opened && c.openT < 1) c.openT = Math.min(1, c.openT + dt * 2.5);

    // Projektile
    for (const pr of this.projectiles) {
      if (pr.scene !== sc) continue;
      pr.x += pr.vx * dt; pr.z += pr.vz * dt; pr.y += pr.vy * dt;
      if (pr.kind === 'arrow') {
        pr.vy -= 6 * dt; pr.life -= dt;
        pr.yaw = Math.atan2(pr.vx, pr.vz);
        for (const e of this.enemies) {
          if (e.dead || e.scene !== sc || e.sleeping) continue;
          if (U.dist(pr.x, pr.z, e.x, e.z) < e.r + 0.5 && Math.abs(pr.y - (e.y + (e.boss ? 3 : 0.9))) < (e.boss ? 3.5 : 1.4)) {
            this.hitEnemy(e, 1, pr.x, pr.z, 5); pr.life = 0; break;
          }
        }
        if (pr.y < World.height(pr.x, pr.z) || World.blockedStatic(pr.x, pr.z, 0.2)) pr.life = 0;
      } else if (pr.kind === 'bomb') {
        pr.vy -= 16 * dt;
        pr.groundY = World.height(pr.x, pr.z);
        if (pr.y <= pr.groundY) { pr.y = pr.groundY; pr.vy *= -0.32; pr.vx *= 0.6; pr.vz *= 0.6; }
        if (World.blockedStatic(pr.x, pr.z, 0.4)) { pr.vx *= -0.4; pr.vz *= -0.4; pr.x -= pr.vx * dt; pr.z -= pr.vz * dt; }
        pr.fuse -= dt;
        if (pr.fuse <= 0) { this.explode(pr.x, pr.y + 0.4, pr.z); pr.life = 0; pr.dead = true; }
      } else if (pr.kind === 'rock') {
        pr.vy -= 12 * dt; pr.life -= dt; pr.spin += dt * 6;
        if (U.dist(pr.x, pr.z, p.x, p.z) < 1.5 && Math.abs(pr.y - p.y - 1) < 2) {
          this.damagePlayer(2, pr.x, pr.z); pr.life = 0;
          this.burst(pr.x, pr.y, pr.z, 12, [0.5, 0.45, 0.4], 4);
        }
        if (pr.y < World.height(pr.x, pr.z)) { pr.life = 0; this.burst(pr.x, pr.y, pr.z, 10, [0.5, 0.45, 0.4], 4); }
      }
    }
    this.projectiles = this.projectiles.filter(pr => (pr.life === undefined || pr.life > 0) && !pr.dead);

    // Schockwellen
    for (const s of this.shockwaves) {
      s.life -= dt; s.r += dt * 26;
      if (!s.hit && s.scene === sc && U.dist(p.x, p.z, s.x, s.z) < s.r && U.dist(p.x, p.z, s.x, s.z) > s.r - 4) {
        s.hit = true; this.damagePlayer(s.dmg, s.x, s.z);
      }
    }
    this.shockwaves = this.shockwaves.filter(s => s.life > 0);

    // Pickups
    for (const pk of this.pickups) {
      if (pk.scene !== sc) continue;
      pk.life -= dt;
      pk.vy -= 14 * dt;
      pk.x += pk.vx * dt; pk.z += pk.vz * dt; pk.y += pk.vy * dt;
      pk.vx *= 0.94; pk.vz *= 0.94;
      pk.groundY = World.height(pk.x, pk.z);
      if (pk.y < pk.groundY) { pk.y = pk.groundY; pk.vy = 0; }
      const d = U.dist(pk.x, pk.z, p.x, p.z);
      if (d < 2.4) { const a = Math.atan2(p.x - pk.x, p.z - pk.z); pk.x += Math.sin(a) * dt * 7; pk.z += Math.cos(a) * dt * 7; }
      if (d < 1.0) {
        pk.taken = true;
        if (pk.kind === 'heart') { p.hp = Math.min(p.maxhp, p.hp + 2); Snd.heart(); }
        else if (pk.kind === 'arrow') { p.arrows = Math.min(60, p.arrows + 5); Snd.rupee(); }
        else if (pk.kind === 'key') { p.keys++; Snd.chest(); }
        else { p.rupees += pk.kind === 'rupee20' ? 20 : pk.kind === 'rupee5' ? 5 : 1; Snd.rupee(); }
        this.updateHUD();
      }
    }
    this.pickups = this.pickups.filter(pk => !pk.taken && pk.life > 0);

    // Partikel
    for (const q of this.particles) {
      q.life -= dt; q.vy -= 15 * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
    }
    this.particles = this.particles.filter(q => q.life > 0);
  },

  updateCamera(dt) {
    const p = this.player;
    const tx = p.x, ty = p.y + 1.5, tz = p.z;
    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    let dist = this.camDist;
    let ex = tx + Math.sin(this.camYaw) * cp * dist;
    let ez = tz + Math.cos(this.camYaw) * cp * dist;
    let ey = ty + sp * dist;
    // Kollision: von Ziel zur Kamera abtasten
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      const sx = U.lerp(tx, ex, t), sz = U.lerp(tz, ez, t), sy = U.lerp(ty, ey, t);
      if (World.blockedStatic(sx, sz, 0.6) || (World.scene === 'over' && sy < World.height(sx, sz) + 0.8)) {
        const t2 = Math.max(0.25, t - 1 / 8);
        ex = U.lerp(tx, ex, t2); ez = U.lerp(tz, ez, t2); ey = U.lerp(ty, ey, t2);
        break;
      }
    }
    if (World.scene === 'over') ey = Math.max(ey, World.height(ex, ez) + 1.0);
    const k = Math.min(1, dt * 12);
    this.camPos.x = U.lerp(this.camPos.x, ex, k);
    this.camPos.y = U.lerp(this.camPos.y, ey, k);
    this.camPos.z = U.lerp(this.camPos.z, ez, k);
    this.camTarget = { x: tx, y: ty, z: tz };
  },

  /* ---------------- Rendering ---------------- */
  render() {
    const W = World.cur;
    const asp = this.canvas.width / this.canvas.height;
    M4.perspective(G.proj, 1.0, asp, 0.1, 400);
    let sx = 0, sy = 0;
    if (this.shake > 0) { sx = (Math.random() - 0.5) * this.shake; sy = (Math.random() - 0.5) * this.shake; }
    const c = this.camPos, t = this.camTarget || { x: 0, y: 0, z: 0 };
    M4.lookAt(G.view, c.x + sx, c.y + sy, c.z, t.x, t.y, t.z, 0, 1, 0);
    G.frame(W.fog, W.fogNear, W.fogFar, W.amb, W.light, this.time);

    const I = M4.create();
    if (World.scene === 'over') {
      G.draw(W.mesh, I, [1, 1, 1]);
      G.draw(W.props, I, [1, 1, 1]);
    } else {
      G.draw(W.mesh, I, [1, 1, 1]);
      G.draw(W.glow, I, [1, 1, 1], { emis: 0.95 });
    }

    const sc = World.scene;
    for (const g of this.grass) if (!g.cut && g.scene === sc) Ents.drawGrass(g);
    for (const o of this.pots) if (!o.broken && o.scene === sc) Ents.drawPot(o);
    for (const s of this.signs) if (s.scene === sc) Ents.drawSign(s);
    for (const cr of this.cracks) if (!cr.broken && cr.scene === sc) Ents.drawCrack(cr);
    for (const ch of this.chests) if (ch.scene === sc && !ch.hidden) Ents.drawChest(ch, this.time);
    for (const d of this.doors) if (!d.gone && d.scene === sc) Ents.drawDoor(d);
    if (sc === 'dun' && !this.gateCol.disabled) Ents.drawDoor({ x: this.gateCol.x, z: this.gateCol.z, y: 0 });
    for (const n of this.npcs) if (n.scene === sc) Ents.drawNPC(n, this.time);
    for (const e of this.enemies) if (e.scene === sc && !e.dead && !e.sleeping) Ents.drawEnemy(e, this.time);
    if (this.boss && this.boss.sleeping && sc === 'dun') Ents.drawEnemy(this.boss, this.time);
    for (const pk of this.pickups) if (pk.scene === sc) Ents.drawPickup(pk, this.time);
    for (const pr of this.projectiles) if (pr.scene === sc) Ents.drawProjectile(pr, this.time);
    if (!this.player.dead) Ents.drawPlayer(this.player, this.time);

    // Partikel
    const pm = M4.create();
    for (const q of this.particles) {
      if (q.scene !== sc) continue;
      const a = U.clamp(q.life / q.maxlife, 0, 1);
      M4.compose(pm, q.x, q.y, q.z, q.life * 6, q.life * 4, 0, q.size, q.size, q.size);
      G.draw(PRIM.box, pm, [q.col[0], q.col[1], q.col[2], a], { noDepthWrite: true, emis: 0.4 });
    }
    for (const s of this.shockwaves) if (s.scene === sc) Ents.drawShockwave(s);

    if (World.scene === 'over') G.draw(W.water, I, [1, 1, 1, 0.72], { wave: true, noDepthWrite: true, noCull: true });

    this.drawMinimap();
    this.drawBossBar();
  },

  drawBossBar() {
    const el = document.getElementById('bossbar');
    if (this.bossActive && this.boss && !this.boss.dead) {
      el.style.display = 'block';
      document.getElementById('bossfill').style.width = (100 * Math.max(0, this.boss.hp) / this.boss.maxhp) + '%';
    } else el.style.display = 'none';
  },

  drawMinimap() {
    const ctx = this.mini; if (!ctx) return;
    const S = 150;
    ctx.clearRect(0, 0, S, S);
    const p = this.player;
    if (World.scene === 'over') {
      const sc = S / (WORLD_R * 2.1);
      const cx = S / 2, cy = S / 2;
      ctx.fillStyle = '#2f5d2c'; ctx.beginPath(); ctx.arc(cx, cy, S * 0.47, 0, 7); ctx.fill();
      ctx.fillStyle = '#1c4a7a'; ctx.beginPath(); ctx.arc(cx + 60 * sc, cy + 6 * sc, 29 * sc, 0, 7); ctx.fill();
      ctx.fillStyle = '#5a5a62'; ctx.beginPath(); ctx.rect(cx - 90 * sc, cy - 100 * sc, 180 * sc, 42 * sc); ctx.fill();
      ctx.fillStyle = '#22401f'; ctx.beginPath(); ctx.rect(cx - 100 * sc, cy - 40 * sc, 78 * sc, 110 * sc); ctx.fill();
      ctx.fillStyle = '#8a7a4a'; ctx.beginPath(); ctx.arc(cx, cy + 62 * sc, 14 * sc, 0, 7); ctx.fill();
      ctx.strokeStyle = '#7a6244'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy + 58 * sc); ctx.lineTo(cx, cy - 70 * sc); ctx.stroke();
      ctx.fillStyle = '#d9534f';
      for (const e of this.enemies) if (e.scene === 'over' && !e.dead) { ctx.fillRect(cx + e.x * sc - 1.5, cy + e.z * sc - 1.5, 3, 3); }
      ctx.fillStyle = '#f0c419';
      for (const c of this.chests) if (c.scene === 'over' && !c.opened && !c.hidden) ctx.fillRect(cx + c.x * sc - 2, cy + c.z * sc - 2, 4, 4);
      this.miniPlayer(ctx, cx + p.x * sc, cy + p.z * sc);
    } else {
      const T = World.dunT, cx = S / 2, cy = S / 2, sc = S / 118;
      ctx.fillStyle = '#3a3a45';
      for (const c of World.dun.colliders) {
        if (c.hx === undefined) continue;
        ctx.fillRect(cx + (c.x - c.hx) * sc, cy + (c.z - c.hz) * sc, c.hx * 2 * sc, c.hz * 2 * sc);
      }
      ctx.fillStyle = '#d9534f';
      for (const e of this.enemies) if (e.scene === 'dun' && !e.dead && !e.sleeping) ctx.fillRect(cx + e.x * sc - 1.5, cy + e.z * sc - 1.5, 3, 3);
      ctx.fillStyle = '#f0c419';
      for (const c of this.chests) if (c.scene === 'dun' && !c.opened && !c.hidden) ctx.fillRect(cx + c.x * sc - 2, cy + c.z * sc - 2, 4, 4);
      this.miniPlayer(ctx, cx + p.x * sc, cy + p.z * sc);
    }
  },
  miniPlayer(ctx, x, y) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-this.player.yaw);
    ctx.fillStyle = '#fff'; ctx.beginPath();
    ctx.moveTo(0, -5); ctx.lineTo(4, 4); ctx.lineTo(0, 2); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  },

  /* ---------------- Hauptschleife ---------------- */
  loop(now) {
    const t = now / 1000;
    if (!this._last) this._last = t;
    let dt = Math.min(0.05, t - this._last);
    this._last = t;
    if (this.state !== 'title') { this.update(dt); this.render(); }
    requestAnimationFrame(n => this.loop(n));
  }
};

window.addEventListener('load', () => Game.init());
