'use strict';
/* =========================================================
   GAME — Steuerung (Tastatur + Touch), Kampf, Items,
          Tag/Nacht, Laden, Speichern, HUD
   ========================================================= */

const DAY_LEN = 300;          // Sekunden pro voller Tag/Nacht-Zyklus
const SAVE_KEY = 'emerald-shard-save-v1';

/* Schwierigkeitsgrade — skalieren Schaden, Zähigkeit, Unverwundbarkeit und Fundglück */
const DIFF = {
  leicht: { name: 'Leicht', dmg: 0.5, hp: 0.7, iframes: 1.7, drops: 1.7, boss: 10, startHerzen: 8, kb: 0.7 },
  normal: { name: 'Normal', dmg: 1.0, hp: 1.0, iframes: 1.25, drops: 1.15, boss: 14, startHerzen: 6, kb: 1.0 },
  schwer: { name: 'Schwer', dmg: 1.4, hp: 1.3, iframes: 0.95, drops: 0.8, boss: 18, startHerzen: 6, kb: 1.2 }
};

const Game = {
  state: 'title',
  time: 0, shake: 0, dayT: 0.32, nightFactor: 0, sunElev: 1,
  keys: {}, mouse: { locked: false },
  camYaw: 0, camPitch: 0.42, camDist: 10.5,
  camPos: { x: 0, y: 5, z: 20 },
  enemies: [], pickups: [], projectiles: [], particles: [], shockwaves: [],
  chests: [], grass: [], pots: [], npcs: [], signs: [], cracks: [], doors: [], lights: [],
  bossActive: false, bossDead: false, prompt: null, dialog: null, hasShard: false,
  mobile: false, touch: { move: null, look: null, dx: 0, dz: 0 },
  player: null, fps: 60,
  diffKey: 'leicht',
  get D() { return DIFF[this.diffKey] || DIFF.leicht; },

  /* ---------------- Setup ---------------- */
  init() {
    const canvas = document.getElementById('c');
    if (!G.init(canvas)) {
      document.getElementById('title').innerHTML = '<h1>WebGL nicht verfügbar</h1><p class="small">Bitte einen aktuellen Browser mit WebGL nutzen.</p>';
      return;
    }
    this.canvas = canvas;
    this.mobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (this.mobile) {
      document.body.classList.add('touch');
      Ents.settings.outline = 0;               // Konturen kosten Zeichenaufrufe
      this.camDist = 11.5;
      QUALITY.grass = 0.4; QUALITY.rain = 0.5;
    }
    buildPrims();
    World.build();
    this.buildIcons();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
    this.bindInput();
    this.bindTouch();
    this.mini = document.getElementById('mini').getContext('2d');
    let gespeicherteStufe = null;
    try { gespeicherteStufe = localStorage.getItem('emerald-diff'); } catch (e) { }
    this.setDifficulty(gespeicherteStufe && DIFF[gespeicherteStufe] ? gespeicherteStufe : 'leicht');
    this.reset();
    if (localStorage.getItem(SAVE_KEY)) document.getElementById('continueBtn').style.display = 'inline-block';
    requestAnimationFrame(t => this.loop(t));
  },

  buildIcons() {
    const url = buildIconSheet().toDataURL();
    const st = document.createElement('style');
    st.textContent = `.ic{background-image:url(${url});}`;
    document.head.appendChild(st);
  },

  resize() {
    const cap = this.mobile ? 1.5 : 2;
    const dpr = Math.min(window.devicePixelRatio || 1, cap);
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
  },

  reset(keepSave) {
    const start = this.D.startHerzen;
    this.player = {
      x: 0, z: 70, y: 0, yaw: Math.PI, speed: 0, walkPhase: 0,
      hp: start, maxhp: start, rupees: 0, keys: 0, bombs: 0, arrows: 0, potions: 0, pieces: 0,
      fairies: 0, swordLvl: 1,
      items: { sword: false, shield: false, bow: false, bomb: false, boomerang: false },
      invuln: 0, attackT: 0, attackDur: 0.36, hitList: [], rollT: 0, rollDir: { x: 0, z: 1 },
      dead: false, stepT: 0, blocking: false, kbT: 0, kbx: 0, kbz: 0,
      charge: 0, spinT: 0
    };
    this.blocks = []; this.switches = []; this.heartPieces = []; this.boomerang = null;
    this.fireflies = []; this.rainT = 0; this.weather = 0; this.weatherTimer = 45;
    this.cuccoRage = 0;
    this.enemies = []; this.pickups = []; this.projectiles = []; this.particles = [];
    this.shockwaves = []; this.chests = []; this.grass = []; this.pots = [];
    this.npcs = []; this.signs = []; this.cracks = []; this.doors = []; this.lights = [];
    this.bossActive = false; this.bossDead = false; this.hasShard = false;
    this.camYaw = Math.PI; this.camPitch = 0.42; this.dayT = 0.32;
    this.talkedElder = false;

    World.enter('over');
    World.over.colliders.length = World.over.baseCol;
    const S = World.over.spawns;
    let id = 0;
    for (const e of S.enemies) {
      const en = Ents.makeEnemy(e.t, e.x, e.z);
      en.scene = 'over'; en.id = 'o' + (id++);
      en.groundY = World.height(e.x, e.z); en.y = en.groundY;
      this.scaleEnemy(en);
      this.enemies.push(en);
    }
    for (const gr of S.grass) this.grass.push({ x: gr.x, z: gr.z, y: World.height(gr.x, gr.z), seed: Math.random() * 6, scene: 'over' });
    let cid = 0;
    for (const c of S.chests) this.chests.push({ x: c.x, z: c.z, y: World.height(c.x, c.z), item: c.item, label: c.label, opened: false, openT: 0, scene: 'over', hidden: false, id: 'c' + (cid++) });
    for (const n of S.npcs) this.npcs.push({
      x: n.x, z: n.z, y: World.height(n.x, n.z), yaw: Math.PI, name: n.name, color: n.color,
      lines: n.lines, give: n.give, beard: !!n.give, shop: !!n.shop, fairy: !!n.fairy, scene: 'over'
    });
    for (const p of S.props) {
      if (p.t === 'sign') this.signs.push({ x: p.x, z: p.z, y: World.height(p.x, p.z), text: p.text, scene: 'over' });
      if (p.t === 'crack') this.cracks.push({ x: p.x, z: p.z, y: World.height(p.x, p.z), scene: 'over' });
      if (p.t === 'firelight') this.lights.push({ x: p.x, y: p.y, z: p.z, col: p.col, seed: Math.random() * 6, scene: 'over' });
      if (p.t === 'spring') this.spring = { x: p.x, z: p.z, y: p.y };
    }
    for (const cr of this.cracks) World.over.colliders.push(cr.col = { x: cr.x, z: cr.z, r: 1.7 });

    // Hühner im Dorf
    for (const c of [[-6, 60], [4, 69], [-3, 74], [13, 63], [-16, 71]]) {
      const cu = Ents.makeEnemy('cucco', c[0], c[1]);
      cu.scene = 'over'; cu.groundY = World.height(c[0], c[1]); cu.y = cu.groundY; cu.id = 'cu' + c[0];
      this.enemies.push(cu);
    }
    // Herzteile: vier Stück ergeben einen Container
    for (const h of [{ x: 60, z: 6, id: 'hp1' }, { x: -92, z: 40, id: 'hp2' }, { x: 86, z: -30, id: 'hp3' }])
      this.heartPieces.push({ x: h.x, z: h.z, y: World.height(h.x, h.z), id: h.id, scene: 'over' });

    // Reisesteine — sparen den langen Rückweg
    this.warps = [
      { x: 13, z: 58, name: 'Dorf Ardun', scene: 'over' },
      { x: 7.5, z: -64, name: 'Bergpass', scene: 'over' }
    ];
    for (const w of this.warps) { w.y = World.height(w.x, w.z); World.over.colliders.push({ x: w.x, z: w.z, r: 1.5 }); }

    this.spawnDungeon();
    this.spawnCave();
    this.updateHUD();
    if (!keepSave) this.objective = 'elder';
  },

  spawnDungeon() {
    const keep = a => a.filter(o => o.scene !== 'dun');
    this.enemies = keep(this.enemies); this.chests = keep(this.chests);
    this.pots = keep(this.pots); this.doors = keep(this.doors); this.pickups = keep(this.pickups);
    this.lights = keep(this.lights);
    const D = World.dun;
    D.colliders.length = D.baseCol;
    let id = 0;
    for (const e of D.spawns.enemies) {
      const en = Ents.makeEnemy(e.t, e.x, e.z);
      en.scene = 'dun'; en.groundY = 0; en.y = 0; en.id = 'd' + (id++);
      if (e.t === 'boss') { en.sleeping = true; this.boss = en; }
      this.scaleEnemy(en);
      this.enemies.push(en);
    }
    let cid = 100;
    for (const c of D.spawns.chests) this.chests.push({ x: c.x, z: c.z, y: 0, item: c.item, label: c.label, opened: false, openT: 0, scene: 'dun', hidden: !!c.hidden, id: 'c' + (cid++) });
    for (const p of D.spawns.pots) this.pots.push({ x: p.x, z: p.z, y: 0, scene: 'dun' });
    for (const l of D.lights) this.lights.push({ x: l.x, y: l.y, z: l.z, seed: Math.random() * 6, scene: 'dun' });
    D.door.open = false;
    const dcol = { x: D.door.x, z: D.door.z, hx: 1.7, hz: 1.0 };
    D.colliders.push(dcol);
    this.doors.push({ x: D.door.x, z: D.door.z, y: 0, col: dcol, locked: true, scene: 'dun' });
    this.gateCol = { x: D.bossGate.x, z: D.bossGate.z, hx: 1.7, hz: 1.0, disabled: true };
    D.colliders.push(this.gateCol);

    /* Schieberätsel */
    this.blocks = []; this.switches = [];
    for (const b of D.puzzle.blocks) {
      const col = { x: b.x, z: b.z, hx: 1.05, hz: 1.05 };
      D.colliders.push(col);
      this.blocks.push({ x: b.x, z: b.z, tx: b.x, tz: b.z, col, scene: 'dun', moving: false });
    }
    for (const s of D.puzzle.switches) this.switches.push({ x: s.x, z: s.z, pressed: false, scene: 'dun' });
    this.puzzleGate = { x: D.puzzle.gate.x, z: D.puzzle.gate.z, hx: 1.7, hz: 1.7, disabled: false };
    D.colliders.push(this.puzzleGate);
    this.puzzleSolved = false;

    this.bossDead = false; this.bossActive = false;
  },

  spawnCave() {
    const C = World.cave;
    C.colliders.length = C.baseCol;
    let id = 0;
    for (const e of C.spawns.enemies) {
      const en = Ents.makeEnemy(e.t, e.x, e.z);
      en.scene = 'cave'; en.groundY = 0; en.y = 0; en.id = 'k' + (id++);
      this.scaleEnemy(en);
      this.enemies.push(en);
    }
    let cid = 200;
    for (const c of C.spawns.chests)
      this.chests.push({ x: c.x, z: c.z, y: 0, item: c.item, label: c.label, opened: false, openT: 0, scene: 'cave', hidden: false, id: 'c' + (cid++) });
    for (const p of C.spawns.pots) this.pots.push({ x: p.x, z: p.z, y: 0, scene: 'cave' });
    for (const l of C.lights) this.lights.push({ x: l.x, y: l.y, z: l.z, col: l.col, seed: Math.random() * 6, scene: 'cave' });
  },

  enterCave() {
    World.enter('cave');
    const s = World.cave.start;
    this.player.x = s.x; this.player.z = s.z; this.player.y = 0; this.player.yaw = Math.PI;
    this.camYaw = Math.PI;
    Snd.door(); this.updateMusic(true);
    this.toast('Kristallhöhle', 3);
    this.save();
  },
  exitCave() {
    World.enter('over');
    const d = World.caveDoor;
    this.player.x = d.x; this.player.z = d.z + 4;
    this.player.y = World.height(this.player.x, this.player.z);
    this.player.yaw = 0; this.camYaw = 0;
    Snd.door(); this.updateMusic(true);
    this.save();
  },

  /* Gegnerwerte an den Schwierigkeitsgrad anpassen */
  scaleEnemy(e) {
    const D = this.D;
    if (e.peaceful) return;
    if (e.boss) { e.maxhp = D.boss; e.hp = D.boss; }
    else { e.maxhp = Math.max(1, Math.round(e.maxhp * D.hp)); e.hp = e.maxhp; }
  },
  setDifficulty(key) {
    if (!DIFF[key]) return;
    this.diffKey = key;
    for (const el of document.querySelectorAll('[data-diff]'))
      el.classList.toggle('aktiv', el.dataset.diff === key);
    const lbl = document.getElementById('diffLabel');
    if (lbl) lbl.textContent = this.D.name;
    try { localStorage.setItem('emerald-diff', key); } catch (e) { }
  },

  /* ---------------- Speichern / Laden ---------------- */
  save() {
    if (this.state === 'title') return;
    const p = this.player;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 1, x: p.x, z: p.z, scene: World.scene, yaw: p.yaw,
        hp: p.hp, maxhp: p.maxhp, rupees: p.rupees, keys: p.keys,
        bombs: p.bombs, arrows: p.arrows, potions: p.potions, pieces: p.pieces,
        fairies: p.fairies, swordLvl: p.swordLvl, diff: this.diffKey, items: p.items,
        dayT: this.dayT, bossDead: this.bossDead, hasShard: this.hasShard,
        objective: this.objective, talkedElder: this.talkedElder,
        chests: this.chests.filter(c => c.opened).map(c => c.id),
        kills: this.enemies.filter(e => e.dead).map(e => e.id),
        cracks: this.cracks.map(c => !!c.broken),
        doors: this.doors.map(d => !d.locked),
        hearts: this.heartPieces.filter(h => h.taken).map(h => h.id),
        puzzle: this.puzzleSolved
      }));
    } catch (e) { /* Speicher voll oder gesperrt */ }
  },
  load() {
    let s; try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return false; }
    if (!s || s.v !== 1) return false;
    if (s.diff && DIFF[s.diff]) this.setDifficulty(s.diff);
    this.reset(true);
    const p = this.player;
    Object.assign(p, {
      x: s.x, z: s.z, yaw: s.yaw, hp: s.hp, maxhp: s.maxhp, rupees: s.rupees,
      keys: s.keys, bombs: s.bombs, arrows: s.arrows, potions: s.potions || 0, pieces: s.pieces || 0,
      fairies: s.fairies || 0, swordLvl: s.swordLvl || 1
    });
    for (const h of this.heartPieces) if ((s.hearts || []).indexOf(h.id) >= 0) h.taken = true;
    if (s.puzzle) { this.puzzleSolved = true; this.puzzleGate.disabled = true; for (const sw of this.switches) sw.pressed = true; }
    p.items = Object.assign(p.items, s.items || {});
    this.dayT = s.dayT || 0.32;
    this.hasShard = !!s.hasShard;
    this.objective = s.objective || 'elder';
    this.talkedElder = !!s.talkedElder;
    for (const c of this.chests) if ((s.chests || []).indexOf(c.id) >= 0) { c.opened = true; c.openT = 1; }
    const kills = s.kills || [];
    this.enemies = this.enemies.filter(e => kills.indexOf(e.id) < 0);
    this.boss = this.enemies.find(e => e.boss) || null;
    if (s.bossDead) {
      this.bossDead = true;
      const sc = this.chests.find(c => c.item === 'shard'); if (sc) sc.hidden = false;
    }
    (s.cracks || []).forEach((br, i) => { if (br && this.cracks[i]) { this.cracks[i].broken = true; this.cracks[i].col.disabled = true; } });
    (s.doors || []).forEach((open, i) => { if (open && this.doors[i]) { this.doors[i].locked = false; this.doors[i].gone = true; this.doors[i].col.disabled = true; } });
    World.enter(s.scene || 'over');
    p.y = World.height(p.x, p.z);
    this.camYaw = p.yaw;
    this.updateHUD();
    return true;
  },

  /* ---------------- Eingabe ---------------- */
  bindInput() {
    window.addEventListener('keydown', e => {
      if (e.code === 'Tab') e.preventDefault();
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (this.state === 'title') { if (e.code === 'Enter' || e.code === 'Space') this.start(false); return; }
      if (e.code === 'KeyM') this.toggleMusic();
      if (this.state === 'shop') { this.shopKey(e.code); return; }
      if (this.state === 'dialog') { if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') this.advanceDialog(); return; }
      if (this.state !== 'play') return;
      if (e.code === 'Space' || e.code === 'KeyJ') this.attack();
      if (e.code === 'KeyE') this.interact();
      if (e.code === 'KeyQ') this.useBomb();
      if (e.code === 'KeyF') this.useBow();
      if (e.code === 'KeyC') this.useBoomerang();
      if (e.code === 'Digit1') this.usePotion();
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.roll();
    });
    window.addEventListener('keyup', e => {
      this.keys[e.code] = false;
      if (e.code === 'Space' || e.code === 'KeyJ') this.releaseAttack();
    });

    this.canvas.addEventListener('mousedown', e => {
      if (this.mobile) return;
      if (this.state === 'pause') { this.resume(); return; }
      if (this.state === 'dialog') { this.advanceDialog(); return; }
      if (this.state !== 'play') return;
      if (!this.mouse.locked) { this.canvas.requestPointerLock(); return; }
      if (e.button === 0) { this.attack(); this.mouseAttack = true; }
      if (e.button === 2) this.mouseBlock = true;
    });
    this.canvas.addEventListener('mouseup', e => {
      if (e.button === 2) this.mouseBlock = false;
      if (e.button === 0) { this.mouseAttack = false; this.releaseAttack(); }
    });
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      this.mouse.locked = document.pointerLockElement === this.canvas;
      if (!this.mouse.locked && this.state === 'play' && !this.mobile) this.pause();
    });
    document.addEventListener('mousemove', e => {
      if (this.mouse.locked && this.state === 'play') {
        this.camYaw -= e.movementX * 0.0026;
        this.camPitch = U.clamp(this.camPitch + e.movementY * 0.0022, -0.12, 1.15);
      }
    });
    document.getElementById('startBtn').addEventListener('click', () => this.start(false));
    document.getElementById('continueBtn').addEventListener('click', () => this.start(true));
    document.getElementById('againBtn').addEventListener('click', () => this.respawn());
    document.getElementById('musicBtn').addEventListener('click', () => this.toggleMusic());
    document.getElementById('fsBtn').addEventListener('click', () => this.toggleFullscreen());
    document.getElementById('shopClose').addEventListener('click', () => this.closeShop());
    for (const el of document.querySelectorAll('[data-diff]')) {
      el.addEventListener('click', () => {
        const neu = el.dataset.diff;
        this.setDifficulty(neu);
        // Läuft schon ein Spiel? Gegnerwerte sofort nachziehen.
        if (this.state !== 'title') {
          for (const e of this.enemies) if (!e.dead) this.scaleEnemy(e);
          this.toast('Schwierigkeit: ' + this.D.name, 2.5);
          this.save();
        }
      });
    }
    document.querySelectorAll('#shopList .buy').forEach(b => {
      b.addEventListener('click', () => this.buy(b.dataset.item));
    });
  },

  /* --- Touch: linker Stick, rechte Kamera, Buttons --- */
  bindTouch() {
    const cv = this.canvas;
    const T = this.touch;
    const half = () => window.innerWidth * 0.45;
    cv.addEventListener('touchstart', e => {
      if (this.state === 'dialog') { this.advanceDialog(); e.preventDefault(); return; }
      if (this.state !== 'play') return;
      for (const t of e.changedTouches) {
        if (t.clientX < half() && !T.move) {
          T.move = { id: t.identifier, bx: t.clientX, by: t.clientY, x: t.clientX, y: t.clientY };
          const st = document.getElementById('stick');
          st.style.display = 'block'; st.style.left = t.clientX + 'px'; st.style.top = t.clientY + 'px';
          document.getElementById('knob').style.transform = 'translate(-50%,-50%)';
        } else if (t.clientX >= half() && !T.look) {
          T.look = { id: t.identifier, x: t.clientX, y: t.clientY };
        }
      }
      e.preventDefault();
    }, { passive: false });
    cv.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (T.move && t.identifier === T.move.id) {
          T.move.x = t.clientX; T.move.y = t.clientY;
          let dx = t.clientX - T.move.bx, dy = t.clientY - T.move.by;
          const len = Math.hypot(dx, dy), max = 52;
          if (len > max) { dx = dx / len * max; dy = dy / len * max; }
          document.getElementById('knob').style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
          const n = Math.min(1, len / max);
          const a = Math.atan2(dy, dx);
          T.dx = Math.cos(a) * n; T.dz = Math.sin(a) * n;
        } else if (T.look && t.identifier === T.look.id) {
          this.camYaw -= (t.clientX - T.look.x) * 0.006;
          this.camPitch = U.clamp(this.camPitch + (t.clientY - T.look.y) * 0.005, -0.12, 1.15);
          T.look.x = t.clientX; T.look.y = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = e => {
      for (const t of e.changedTouches) {
        if (T.move && t.identifier === T.move.id) {
          T.move = null; T.dx = 0; T.dz = 0;
          document.getElementById('stick').style.display = 'none';
        }
        if (T.look && t.identifier === T.look.id) T.look = null;
      }
    };
    cv.addEventListener('touchend', end);
    cv.addEventListener('touchcancel', end);

    const bind = (id, down, up) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('on'); down(); }, { passive: false });
      const off = e => { e.preventDefault(); el.classList.remove('on'); if (up) up(); };
      el.addEventListener('touchend', off); el.addEventListener('touchcancel', off);
      el.addEventListener('click', e => { e.preventDefault(); });
    };
    bind('btnA', () => { this.attack(); this.touchAttack = true; }, () => { this.touchAttack = false; this.releaseAttack(); });
    bind('btnRoll', () => this.roll());
    bind('btnE', () => { if (this.state === 'dialog') this.advanceDialog(); else this.interact(); });
    bind('btnBomb', () => this.useBomb());
    bind('btnBow', () => this.useBow());
    bind('btnBoom', () => this.useBoomerang());
    bind('btnShield', () => { this.player.blocking = true; }, () => { this.player.blocking = false; });
    bind('btnPotion', () => this.usePotion());
  },

  /* Vollbild + Querformat beim Start (nur mit Nutzergeste erlaubt) */
  goFullscreen() {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (req && !document.fullscreenElement) {
      const p = req.call(el);
      if (p && p.catch) p.catch(() => { });
    }
    if (screen.orientation && screen.orientation.lock) {
      try { const q = screen.orientation.lock('landscape'); if (q && q.catch) q.catch(() => { }); } catch (e) { }
    }
  },

  toggleMusic() {
    Snd.musicOn = !Snd.musicOn;
    BGM.setEnabled(Snd.musicOn);
    document.getElementById('musicBtn').textContent = Snd.musicOn ? '♪' : '♪̶';
    this.toast(Snd.musicOn ? 'Musik an' : 'Musik aus');
  },
  toggleFullscreen() {
    if (!document.fullscreenElement) (document.documentElement.requestFullscreen || function () { }).call(document.documentElement);
    else document.exitFullscreen();
  },

  start(cont) {
    Snd.init(); Snd.resume();
    if (this.mobile) { this.goFullscreen(); setTimeout(() => this.resize(), 350); }
    let loaded = false;
    if (cont) loaded = this.load();
    document.getElementById('title').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    this.state = 'play';
    if (!this.mobile) this.canvas.requestPointerLock();
    BGM.preload(['village', 'over']);
    this.updateMusic(true);
    if (!loaded) this.toast('Sprich mit dem Ältesten im Dorf (E)', 4);
  },
  pause() { if (this.state !== 'play') return; this.state = 'pause'; document.getElementById('pause').style.display = 'flex'; this.save(); },
  resume() { document.getElementById('pause').style.display = 'none'; this.state = 'play'; if (!this.mobile) this.canvas.requestPointerLock(); },
  respawn() {
    const p = this.player;
    document.getElementById('over').style.display = 'none';
    p.dead = false; p.hp = p.maxhp; p.invuln = 2.2;
    // In der Ruine gestorben? Dann dort wieder anfangen, nicht im Dorf
    if (this.diedIn === 'dun') {
      World.enter('dun');
      const s = World.dun.start;
      p.x = s.x; p.z = s.z; p.y = 0; p.yaw = Math.PI; this.camYaw = Math.PI;
    } else {
      World.enter('over');
      p.x = 0; p.z = 70; p.y = World.height(p.x, p.z);
    }
    this.bossActive = false;
    if (this.boss && !this.boss.dead) { this.boss.sleeping = true; this.boss.hp = this.boss.maxhp; this.boss.state = 'idle'; }
    if (this.gateCol) this.gateCol.disabled = true;
    this.state = 'play';
    this.updateHUD();
    this.updateMusic(true);
    if (!this.mobile) this.canvas.requestPointerLock();
  },

  /* ---------------- Aktionen ---------------- */
  attack() {
    const p = this.player;
    if (!p.items.sword) { this.toast('Du hast noch keine Waffe!'); return; }
    if (p.attackT > 0 || p.rollT > 0 || p.spinT > 0 || p.dead) return;
    p.attackT = p.attackDur; p.hitList = [];
    Snd.swing();
  },
  /* Gedrückthalten lädt den Wirbelangriff auf */
  releaseAttack() {
    const p = this.player;
    if (p.charge >= 1 && p.items.sword && !p.dead) {
      p.spinT = 0.55; p.hitList = []; p.attackT = 0;
      Snd.noise(0.4, 0.3, 2200); Snd.tone(520, 0.4, 'square', 0.18, 200);
      this.burst(p.x, p.y + 1, p.z, 24, [1, 0.95, 0.5], 5);
      this.shake = 0.25;
    }
    p.charge = 0;
  },
  useBoomerang() {
    const p = this.player;
    if (!p.items.boomerang) return;
    if (this.boomerang) return;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    this.boomerang = {
      x: p.x + fx, y: p.y + 1.2, z: p.z + fz, vx: fx * 22, vz: fz * 22,
      spin: 0, t: 0, back: false, scene: World.scene, hit: []
    };
    Snd.tone(880, 0.18, 'triangle', 0.14, 1500);
  },
  roll() {
    const p = this.player;
    if (p.rollT > 0 || p.dead || p.attackT > 0) return;
    const m = this.moveInput();
    if (m.x === 0 && m.z === 0) { p.rollDir.x = Math.sin(p.yaw); p.rollDir.z = Math.cos(p.yaw); }
    else { p.rollDir.x = m.x; p.rollDir.z = m.z; }
    p.rollT = 0.42; p.invuln = Math.max(p.invuln, 0.32);
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
  usePotion() {
    const p = this.player;
    if (p.potions <= 0) { this.toast('Kein Trank vorhanden'); return; }
    if (p.hp >= p.maxhp) { this.toast('Du bist bei voller Kraft'); return; }
    p.potions--; p.hp = p.maxhp;
    Snd.heart(); this.burst(p.x, p.y + 1.2, p.z, 22, [1, 0.4, 0.45], 3.5);
    this.toast('Trank getrunken — volle Energie!');
    this.updateHUD(); this.save();
  },

  interact() {
    const p = this.player, t = this.prompt;
    if (!t) return;
    if (t.kind === 'npc') {
      const n = t.obj;
      n.yaw = Math.atan2(p.x - n.x, p.z - n.z);
      if (n.shop) { this.openShop(); return; }
      if (n.fairy) {
        if (p.hp < p.maxhp) {
          p.hp = p.maxhp; Snd.heart();
          this.burst(n.x, n.y + 1.4, n.z, 30, [0.6, 1, 0.9], 4);
          this.openDialog(n.name, ['Deine Wunden sind geheilt. Zieh weiter, Held.']);
          this.updateHUD(); this.save();
        } else this.openDialog(n.name, n.lines);
        return;
      }
      let lines = n.lines.slice();
      if (n.give && !p.items[n.give]) {
        this.openDialog(n.name, lines, () => {
          p.items.sword = true; p.items.shield = true;
          this.talkedElder = true; this.objective = 'dungeon';
          Snd.fanfare();
          this.toast(this.mobile ? 'Schwert & Schild erhalten!' : 'Schwert & Schild erhalten! (Leertaste = Angriff)', 5);
          this.updateHUD(); this.save();
        });
      } else {
        if (n.give && p.items.sword) lines = this.hasShard
          ? ['Du hast den Splitter zurückgebracht! Ardun ist gerettet, Held.']
          : ['Die Ruine liegt im Norden, hinter dem Pass. Sei wachsam!'];
        this.openDialog(n.name, lines);
      }
    } else if (t.kind === 'warp') {
      const ziel = this.warps.find(w => w !== t.obj) || t.obj;
      p.x = ziel.x; p.z = ziel.z + 2.8; p.y = World.height(p.x, p.z);
      this.camPos.x = p.x; this.camPos.z = p.z + 9;
      Snd.chest(); this.burst(p.x, p.y + 1, p.z, 30, [0.5, 1, 0.9], 5);
      this.toast('Gereist nach: ' + ziel.name, 2.5);
      this.save();
    }
    else if (t.kind === 'sign') this.openDialog('Schild', [t.obj.text]);
    else if (t.kind === 'chest') this.openChest(t.obj);
    else if (t.kind === 'dungeon') this.enterDungeon();
    else if (t.kind === 'exit') this.exitDungeon();
    else if (t.kind === 'cave') this.enterCave();
    else if (t.kind === 'exitcave') this.exitCave();
    else if (t.kind === 'door') {
      if (p.keys > 0) {
        p.keys--; t.obj.locked = false; t.obj.col.disabled = true; t.obj.gone = true;
        Snd.door(); this.toast('Tür aufgeschlossen'); this.objective = 'boss';
        this.updateHUD(); this.save();
      } else { Snd.deny(); this.toast('Verschlossen. Du brauchst einen Schlüssel.'); }
    }
  },

  openChest(c) {
    if (c.opened) return;
    c.opened = true; c.openT = 0.001;
    Snd.chest();
    const p = this.player;
    switch (c.item) {
      case 'bomb': p.items.bomb = true; p.bombs += 10; this.toast(this.mobile ? 'Bomben (10)!' : 'Bomben (10)! [Q] zum Werfen', 4.5); break;
      case 'bow': p.items.bow = true; p.arrows += 20; this.toast(this.mobile ? 'Bogen & 20 Pfeile!' : 'Bogen & 20 Pfeile! [F] zum Schießen', 4.5); break;
      case 'rupee20': p.rupees += 20; this.toast('20 Rubine!'); break;
      case 'rupee50': p.rupees += 50; this.toast('50 Rubine!'); break;
      case 'potion': p.potions++; this.toast(this.mobile ? 'Roter Trank!' : 'Roter Trank! [1] zum Trinken', 4); break;
      case 'key': p.keys++; this.toast('Kleiner Schlüssel!'); this.objective = 'door'; break;
      case 'boomerang': p.items.boomerang = true; this.toast(this.mobile ? 'Bumerang! Betäubt Gegner.' : 'Bumerang! [C] wirft ihn — betäubt Gegner.', 5); break;
      case 'heartpiece': this.gainHeartPiece(); break;
      case 'heart_container': p.maxhp += 2; p.hp = p.maxhp; Snd.heart(); this.toast('Herzcontainer! Maximale Energie erhöht.', 4); break;
      case 'shard': this.win(); break;
    }
    this.burst(c.x, c.y + 1.2, c.z, 20, [1, 0.9, 0.4], 4);
    this.updateHUD(); this.save();
  },

  gainHeartPiece() {
    const p = this.player;
    p.pieces++;
    if (p.pieces >= 4) {
      p.pieces = 0; p.maxhp += 2; p.hp = p.maxhp;
      Snd.fanfare(); this.toast('Vier Herzteile — ein ganzer Herzcontainer!', 5);
    } else {
      Snd.heart(); this.toast('Herzteil ' + p.pieces + '/4', 3);
    }
    this.burst(p.x, p.y + 1.2, p.z, 18, [1, 0.4, 0.5], 4);
    this.updateHUD(); this.save();
  },

  /* ---------------- Laden ---------------- */
  openShop() {
    this.state = 'shop';
    document.exitPointerLock();
    document.getElementById('shop').style.display = 'flex';
    this.updateShop();
  },
  closeShop() {
    document.getElementById('shop').style.display = 'none';
    this.state = 'play';
    if (!this.mobile) this.canvas.requestPointerLock();
    this.save();
  },
  shopKey(code) { if (code === 'Escape' || code === 'KeyE') this.closeShop(); },
  updateShop() {
    document.getElementById('shopRupees').textContent = this.player.rupees;
    document.querySelectorAll('#shopList .buy').forEach(b => {
      b.disabled = this.player.rupees < +b.dataset.price;
    });
  },
  buy(item) {
    const p = this.player;
    const price = { arrows: 10, bombs: 15, potion: 30, heal: 5, fairy: 45, sword: 120 }[item];
    if (p.rupees < price) { Snd.deny(); return; }
    if (item === 'heal' && p.hp >= p.maxhp) { Snd.deny(); this.toast('Du bist bei voller Kraft'); return; }
    if (item === 'arrows' && !p.items.bow) { Snd.deny(); this.toast('Du hast noch keinen Bogen'); return; }
    if (item === 'sword' && p.swordLvl >= 2) { Snd.deny(); this.toast('Deine Klinge ist bereits geschärft'); return; }
    if (item === 'sword' && !p.items.sword) { Snd.deny(); this.toast('Du hast noch kein Schwert'); return; }
    p.rupees -= price;
    if (item === 'arrows') { p.arrows += 10; this.toast('10 Pfeile gekauft'); }
    if (item === 'bombs') { p.items.bomb = true; p.bombs += 5; this.toast('5 Bomben gekauft'); }
    if (item === 'potion') { p.potions++; this.toast('Trank gekauft'); }
    if (item === 'heal') { p.hp = p.maxhp; this.toast('Vollständig geheilt'); }
    if (item === 'fairy') { p.fairies++; this.toast('Fee im Glas — sie rettet dich einmal vor dem Ende.', 4); }
    if (item === 'sword') { p.swordLvl = 2; this.toast('Klinge geschärft — doppelter Schaden!', 4); }
    Snd.buy(); this.updateHUD(); this.updateShop(); this.save();
  },

  /* ---------------- Szenenwechsel ---------------- */
  enterDungeon() {
    World.enter('dun');
    const s = World.dun.start;
    this.player.x = s.x; this.player.z = s.z; this.player.y = 0; this.player.yaw = Math.PI;
    this.camYaw = Math.PI;
    Snd.door(); this.updateMusic(true);
    this.toast('Ruine der Ahnen', 3);
    if (this.objective === 'dungeon') this.objective = 'key';
    this.save();
  },
  exitDungeon() {
    World.enter('over');
    const d = World.dungeonDoor;
    this.player.x = d.x; this.player.z = d.z + 4;
    this.player.y = World.height(this.player.x, this.player.z);
    this.player.yaw = 0; this.camYaw = 0;
    Snd.door(); this.bossActive = false; this.updateMusic(true);
    this.save();
  },

  /* ---------------- Kampf ---------------- */
  damagePlayer(dmg, sx, sz) {
    const p = this.player;
    if (p.invuln > 0 || p.dead || this.state !== 'play') return;
    if (p.blocking && p.items.shield && sx !== undefined) {
      const a = Math.atan2(sx - p.x, sz - p.z);
      if (Math.abs(U.angDiff(p.yaw, a)) < 0.9) {
        Snd.tone(900, 0.12, 'square', 0.2, 500); p.invuln = 0.3;
        this.burst(p.x, p.y + 1.2, p.z, 8, [1, 1, 0.7], 3);
        this.toast('Geblockt!', 1);
        return;
      }
    }
    const D = this.D;
    dmg = Math.max(1, Math.round(dmg * D.dmg));
    p.hp -= dmg; p.invuln = D.iframes;
    Snd.hurt(); this.shake = Math.max(this.shake, 0.35);
    if (sx !== undefined) {
      const a = Math.atan2(p.x - sx, p.z - sz);
      p.kbx = Math.sin(a) * 9 * D.kb; p.kbz = Math.cos(a) * 9 * D.kb; p.kbT = 0.22;
    }
    this.updateHUD();
    if (p.hp <= 0) {
      // Fee im Glas rettet einmal vor dem Bildschirmtod
      if (p.fairies > 0) {
        p.fairies--; p.hp = Math.max(6, Math.floor(p.maxhp / 2)); p.invuln = 2.4;
        Snd.heart(); Snd.fanfare();
        this.burst(p.x, p.y + 1.2, p.z, 40, [0.6, 1, 0.9], 5);
        this.toast('Die Fee im Glas erweckt dich wieder!', 4);
        this.updateHUD(); this.save();
        return;
      }
      p.hp = 0; p.dead = true; this.die();
    }
  },
  schwertSchaden() { return this.player.swordLvl >= 2 ? 2 : 1; },

  hitEnemy(e, dmg, fromX, fromZ, knock) {
    if (e.dead) return;
    if (e.peaceful) { this.angerCucco(e, fromX, fromZ); return; }
    // Stalfos blockt Treffer von vorn — von hinten oder betäubt ist er offen
    if (e.shielded && e.stunT <= 0 && dmg > 0) {
      const a = Math.atan2(fromX - e.x, fromZ - e.z);
      if (Math.abs(U.angDiff(e.yaw, a)) < 1.15) {
        Snd.tone(1400, 0.1, 'square', 0.16, 800);
        this.burst(e.x + Math.sin(a) * 0.7, e.y + 1.2, e.z + Math.cos(a) * 0.7, 6, [1, 1, 0.7], 3);
        e.kbx = -Math.sin(a) * 2; e.kbz = -Math.cos(a) * 2;
        return;
      }
    }
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
      this.objective = 'shard';
      this.updateMusic(true);
      this.toast('Der Steingolem zerfällt! Eine Truhe erscheint.', 5);
      this.save();
      return;
    }
    Snd.tone(160, 0.2, 'sawtooth', 0.14, 60);
    if (e.splits) {                          // Riesen-Chuchu zerfällt in zwei kleine
      for (let i = 0; i < 2; i++) {
        const a = i * Math.PI + Math.random();
        const c = Ents.makeEnemy('chuchu', e.x + Math.sin(a) * 1.6, e.z + Math.cos(a) * 1.6);
        c.scene = e.scene; c.groundY = World.height(c.x, c.z); c.y = c.groundY + 1;
        c.vy = 4; c.id = e.id + '_' + i;
        this.enemies.push(c);
      }
      this.toast('Es teilt sich!', 2);
    }
    const dr = this.D.drops, r = Math.random();
    if (r < 0.30) this.spawnPickup(e.x, e.z, 'rupee');
    else if (r < 0.40) this.spawnPickup(e.x, e.z, 'rupee5');
    else if (r < 0.30 + 0.28 * dr) this.spawnPickup(e.x, e.z, 'heart');
    else if (r < 0.36 + 0.28 * dr && this.player.items.bow) this.spawnPickup(e.x, e.z, 'arrow');
    if (this.player.hp <= 2 && Math.random() < 0.5) this.spawnPickup(e.x + 1, e.z, 'heart');  // Gnade bei wenig Energie
  },

  /* Hühner: wer zu oft zuschlägt, bekommt Besuch */
  angerCucco(e, fromX, fromZ) {
    e.pecks = (e.pecks || 0) + 1;
    e.panic = 3.5;
    Snd.tone(900, 0.12, 'square', 0.16, 1400);
    Snd.tone(1200, 0.1, 'square', 0.12, 700, 0.1);
    this.burst(e.x, e.y + 0.6, e.z, 8, [1, 1, 0.95], 3);
    const a = Math.atan2(e.x - fromX, e.z - fromZ);
    e.kbx = Math.sin(a) * 7; e.kbz = Math.cos(a) * 7;
    if (e.pecks >= 4 && !this.cuccoRage) {
      this.cuccoRage = 14;
      this.toast('Die Hühner sind erzürnt!', 3);
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * Math.PI * 2;
        const c = Ents.makeEnemy('cucco', this.player.x + Math.sin(ang) * 12, this.player.z + Math.cos(ang) * 12);
        c.scene = World.scene; c.angry = true; c.agro = 90;
        c.groundY = World.height(c.x, c.z); c.y = c.groundY; c.id = 'rage' + i;
        this.enemies.push(c);
      }
    }
  },

  spawnPickup(x, z, kind) {
    const gy = World.height(x, z);
    this.pickups.push({ x, z, y: gy + 0.6, vy: 3.5, vx: (Math.random() - 0.5) * 2, vz: (Math.random() - 0.5) * 2, kind, seed: Math.random() * 6, groundY: gy, life: 25, scene: World.scene });
  },
  spawnRock(x, y, z, dx, dz, speed, size, dmg) {
    this.projectiles.push({
      kind: 'rock', scene: World.scene, x, y, z, vx: dx * (speed || 15), vz: dz * (speed || 15),
      vy: speed > 16 ? 1.5 : 5, life: 4, spin: 0, size: size || 1, dmg: dmg || 2, groundY: World.height(x, z)
    });
  },
  shockwave(x, z, maxR, dmg) {
    this.shockwaves.push({ x, z, y: World.height(x, z), r: 1, maxR, dmg, life: 0.55, scene: World.scene, hit: false });
  },
  burstAt(x, y, z, col) {
    if (this.particles.length > (this.mobile ? 180 : 340)) return;
    this.particles.push({
      x, y, z, vx: 0, vy: 1.2, vz: 0, life: 0.25, maxlife: 0.25, size: 0.09,
      col, scene: World.scene
    });
  },
  burst(x, y, z, n, col, spread) {
    const cap = this.mobile ? 180 : 340;
    for (let i = 0; i < n; i++) {
      if (this.particles.length > cap) break;
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
        if (e.boss && e.state !== 'stun') this.hitEnemy(e, 0, x, z);
        else { e.hurtT = 0; this.hitEnemy(e, 3, x, z, 12); }
      }
    }
    if (U.dist(this.player.x, this.player.z, x, z) < 3.4) this.damagePlayer(2, x, z);
    for (const c of this.cracks) {
      if (c.broken || c.scene !== World.scene) continue;
      if (U.dist(c.x, c.z, x, z) < 4.6) {
        c.broken = true; c.col.disabled = true;
        this.burst(c.x, c.y + 1, c.z, 26, [0.5, 0.48, 0.5], 6);
        const gy = World.height(c.x, c.z + 2.4);
        this.chests.push({ x: c.x, z: c.z + 2.4, y: gy, item: 'heart_container', label: 'Herzcontainer', opened: false, openT: 0, scene: 'over', hidden: false, id: 'secret1' });
        this.toast('Ein Geheimnis wurde freigelegt!', 3);
        this.save();
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
    Snd.tone(300, 0.9, 'sawtooth', 0.25, 80);
    BGM.stop();
    this.diedIn = World.scene;
    this.state = 'dead';
    document.exitPointerLock();
    document.getElementById('over').style.display = 'flex';
  },
  win() {
    this.hasShard = true; this.objective = 'done';
    BGM.stop(); Snd.fanfare();
    this.state = 'win';
    document.exitPointerLock();
    document.getElementById('winRupees').textContent = this.player.rupees;
    document.getElementById('win').style.display = 'flex';
    this.save();
  },

  /* ---------------- Dialog / HUD ---------------- */
  openDialog(who, lines, onEnd) {
    this.state = 'dialog';
    this.dialog = { who, lines, i: 0, onEnd };
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
    const d = this.dialog; if (!d) return;
    d.i++;
    if (d.i >= d.lines.length) {
      document.getElementById('dialog').style.display = 'none';
      this.dialog = null; this.state = 'play';
      if (!this.mobile) this.canvas.requestPointerLock();
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
      h += `<i class="ic ${v >= 2 ? 'ic-heart' : v === 1 ? 'ic-heart-half' : 'ic-heart-empty'}"></i>`;
    }
    document.getElementById('hearts').innerHTML = h;
    document.getElementById('rupees').textContent = p.rupees;
    document.getElementById('keys').textContent = p.keys;
    document.getElementById('bombs').textContent = p.items.bomb ? p.bombs : '–';
    document.getElementById('arrows').textContent = p.items.bow ? p.arrows : '–';
    document.getElementById('potions').textContent = p.potions;
    const pc = document.getElementById('pieces');
    if (pc) pc.textContent = p.pieces + '/4';
    const fa = document.getElementById('fairies');
    if (fa) fa.parentElement.style.display = p.fairies > 0 ? '' : 'none';
    if (fa) fa.textContent = p.fairies;
    const setOp = (id, on) => { const el = document.getElementById(id); if (el) el.style.opacity = on ? 1 : 0.35; };
    setOp('btnBow', p.items.bow); setOp('btnBomb', p.items.bomb);
    setOp('btnPotion', p.potions > 0); setOp('btnBoom', p.items.boomerang);
  },

  /* Musik nach Ort wählen */
  updateMusic(force) {
    let want;
    if (World.scene === 'dun') want = this.bossActive ? 'boss' : 'dun';
    else if (World.scene === 'cave') want = 'dun';
    else want = (U.dist(this.player.x, this.player.z, 0, 66) < 34) ? 'village' : 'over';
    if (force || want !== BGM.cur) BGM.play(want);
  },

  /* ---------------- Update ---------------- */
  moveInput() {
    let f = 0, r = 0;
    if (this.touch.move) { r = this.touch.dx; f = -this.touch.dz; }
    else {
      const k = this.keys;
      if (k['KeyW']) f += 1; if (k['KeyS']) f -= 1;
      if (k['KeyA']) r -= 1; if (k['KeyD']) r += 1;
    }
    if (Math.abs(f) < 0.02 && Math.abs(r) < 0.02) return { x: 0, z: 0 };
    const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw);
    const rx = -fz, rz = fx;
    let x = fx * f + rx * r, z = fz * f + rz * r;
    const l = Math.hypot(x, z) || 1;
    const mag = Math.min(1, Math.hypot(f, r));
    return { x: x / l * mag, z: z / l * mag };
  },

  updateDayNight(dt) {
    this.dayT = (this.dayT + dt / DAY_LEN) % 1;
    const ang = (this.dayT - 0.25) * Math.PI * 2;
    const elev = Math.sin(ang);
    this.sunElev = elev;
    const day = U.clamp(elev * 2.4 + 0.15, 0, 1);
    const dusk = U.clamp(1 - Math.abs(elev) * 3.2, 0, 1) * U.clamp(0.35 + elev * 2, 0, 1);
    this.nightFactor = 1 - day;
    const W = World.over;
    const mix = (a, b, t) => [U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t), U.lerp(a[2], b[2], t)];
    const dayFog = [0.62, 0.79, 0.95], nightFog = [0.05, 0.07, 0.16], duskFog = [0.92, 0.55, 0.38];
    W.fog = mix(mix(nightFog, dayFog, day), duskFog, dusk * 0.8);
    W.amb = mix([0.13, 0.15, 0.26], [0.44, 0.45, 0.52], day);
    W.lightCol = mix([0.17, 0.21, 0.36], mix([0.80, 0.78, 0.70], [1.0, 0.72, 0.48], dusk), day);
    W.light = [Math.cos(ang) * 0.6, Math.max(0.18, Math.abs(elev)), 0.35];
    W.fogFar = U.lerp(110, 195, day);
    this.skyTint = mix([0.10, 0.13, 0.30], mix([1, 1, 1], [1.15, 0.72, 0.5], dusk), day);
    // Regen drückt Licht und Sicht
    if (this.weather > 0.01) {
      const w = this.weather;
      W.fog = mix(W.fog, [0.40, 0.43, 0.50], w * 0.75);
      W.amb = mix(W.amb, [0.28, 0.30, 0.36], w * 0.6);
      W.lightCol = mix(W.lightCol, [0.40, 0.43, 0.48], w * 0.7);
      W.fogFar = U.lerp(W.fogFar, 85, w * 0.7);
      this.skyTint = mix(this.skyTint, [0.48, 0.51, 0.58], w * 0.8);
    }
    if (this.lightning > 0) {                       // Blitz erhellt die Szene kurz
      const f = this.lightning * 2.2;
      W.amb = [W.amb[0] + f, W.amb[1] + f, W.amb[2] + f];
      this.skyTint = [this.skyTint[0] + f, this.skyTint[1] + f, this.skyTint[2] + f];
    }
  },

  update(dt) {
    this.time += dt;
    BGM.update();
    if (World.scene === 'over') this.updateDayNight(dt);
    this.updateWeather(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.6);
    if (this.keys['ArrowLeft']) this.camYaw += dt * 2.2;
    if (this.keys['ArrowRight']) this.camYaw -= dt * 2.2;
    if (this.keys['ArrowUp']) this.camPitch = U.clamp(this.camPitch - dt * 1.2, -0.12, 1.15);
    if (this.keys['ArrowDown']) this.camPitch = U.clamp(this.camPitch + dt * 1.2, -0.12, 1.15);
    if (this.state === 'play') this.updatePlayer(dt);
    this.updateWorldObjects(dt);
    this.updateCamera(dt);
    if (this.state === 'play' && this.time - (this._musT || 0) > 1.5) { this._musT = this.time; this.updateMusic(false); }
    if (this.state === 'play' && this.time - (this._saveT || 0) > 20) { this._saveT = this.time; this.save(); }
  },

  updatePlayer(dt) {
    const p = this.player;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.attackT > 0) p.attackT -= dt;
    if (p.rollT > 0) p.rollT -= dt;
    if (p.spinT > 0) p.spinT -= dt;
    if (p.kbT > 0) p.kbT -= dt;
    if (!this.mobile) p.blocking = !!this.keys['KeyK'] || !!this.mouseBlock;

    // Schwert aufladen -> Wirbelangriff
    const holding = this.keys['Space'] || this.keys['KeyJ'] || this.mouseAttack || this.touchAttack;
    if (holding && p.items.sword && p.attackT <= 0 && p.spinT <= 0 && !p.dead) {
      const was = p.charge;
      p.charge = Math.min(1, p.charge + dt / 0.62);
      if (was < 1 && p.charge >= 1) Snd.tone(1200, 0.12, 'triangle', 0.12, 1800);
    } else if (!holding && p.charge > 0 && p.charge < 1) p.charge = 0;
    if (p.charge > 0.25 && p.spinT <= 0) {
      const a = this.time * 9;
      for (let i = 0; i < 3; i++)
        this.burstAt(p.x + Math.sin(a + i * 2.1) * 1.1, p.y + 0.9, p.z + Math.cos(a + i * 2.1) * 1.1,
          p.charge >= 1 ? [1, 0.95, 0.4] : [0.7, 0.85, 1]);
    }
    // Wirbelangriff trifft rundum
    if (p.spinT > 0) {
      for (const e of this.enemies) {
        if (e.dead || e.scene !== World.scene || e.sleeping || p.hitList.indexOf(e) >= 0) continue;
        if (U.dist(p.x, p.z, e.x, e.z) < 3.4 + e.r) {
          p.hitList.push(e);
          this.hitEnemy(e, this.schwertSchaden() + 1, p.x, p.z, 13);
        }
      }
      for (const g of this.grass) if (!g.cut && g.scene === World.scene && U.dist(p.x, p.z, g.x, g.z) < 3.2) this.cutGrass(g);
      for (const o of this.pots) if (!o.broken && o.scene === World.scene && U.dist(p.x, p.z, o.x, o.z) < 3.2) this.breakPot(o);
      p.yaw += dt * 22;
    }

    const inWater = World.inWater(p.x, p.z);
    let m = this.moveInput();
    let spd = inWater ? 3.0 : 6.4;
    if (p.attackT > 0) spd *= 0.35;
    if (p.blocking) spd *= 0.45;
    if (p.rollT > 0) { m = { x: p.rollDir.x, z: p.rollDir.z }; spd = 11.5; }

    let vx = m.x * spd, vz = m.z * spd;
    if (p.kbT > 0) { vx += p.kbx; vz += p.kbz; }
    if (vx !== 0 || vz !== 0) {
      const mv = World.move(p.x, p.z, vx * dt, vz * dt, 0.45);
      p.x = mv.x; p.z = mv.z;
    }
    p.speed = Math.hypot(m.x, m.z) * spd;
    if (p.speed > 0.4 && p.rollT <= 0) p.yaw = U.angLerp(p.yaw, Math.atan2(m.x, m.z), Math.min(1, dt * 14));
    else if (p.rollT > 0) p.yaw = U.angLerp(p.yaw, Math.atan2(p.rollDir.x, p.rollDir.z), Math.min(1, dt * 14));
    p.walkPhase += dt * (p.rollT > 0 ? 26 : 9) * (p.speed > 0.4 ? 1 : 0);
    p.y = World.height(p.x, p.z);
    if (inWater) p.y = Math.max(p.y, WATER_Y - 0.55);

    p.stepT -= dt;
    if (p.speed > 1 && p.stepT <= 0) {
      p.stepT = inWater ? 0.34 : 0.30;
      if (inWater) { Snd.splash(); this.burst(p.x, WATER_Y + 0.1, p.z, 4, [0.6, 0.85, 1.0], 2); }
      else Snd.step();
    }

    if (p.attackT > 0 && p.items.sword) {
      const t = 1 - p.attackT / p.attackDur;
      if (t > 0.12 && t < 0.72) {
        for (const e of this.enemies) {
          if (e.dead || e.scene !== World.scene || e.sleeping) continue;
          if (p.hitList.indexOf(e) >= 0) continue;
          const d = U.dist(p.x, p.z, e.x, e.z);
          if (d < 2.5 + e.r) {
            const a = Math.atan2(e.x - p.x, e.z - p.z);
            if (Math.abs(U.angDiff(p.yaw, a)) < 1.35) { p.hitList.push(e); this.hitEnemy(e, this.schwertSchaden(), p.x, p.z); }
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

    // Interaktionsziel
    this.prompt = null;
    let best = 3.4;
    const consider = (kind, obj, x, z, text, range) => {
      const d = U.dist(p.x, p.z, x, z);
      if (d < (range || 3.0) && d < best) { best = d; this.prompt = { kind, obj, text }; }
    };
    if (World.scene === 'over') {
      for (const n of this.npcs) consider('npc', n, n.x, n.z, n.shop ? 'Laden' : 'Reden');
      for (const s of this.signs) consider('sign', s, s.x, s.z, 'Lesen', 2.6);
      for (const w of this.warps) consider('warp', w, w.x, w.z, 'Reisen', 3.2);
      const dd = World.dungeonDoor;
      consider('dungeon', null, dd.x, dd.z, 'Ruine betreten', 3.4);
      const cd = World.caveDoor;
      consider('cave', null, cd.x, cd.z, 'Höhle betreten', 3.4);
    } else if (World.scene === 'cave') {
      const ex = World.cave.exit;
      consider('exitcave', null, ex.x, ex.z, 'Höhle verlassen', 3.2);
    } else {
      const ex = World.dun.exit;
      consider('exit', null, ex.x, ex.z, 'Ruine verlassen', 3.0);
      for (const d of this.doors) if (!d.gone && d.scene === 'dun') consider('door', d, d.x, d.z, 'Aufschließen', 3.4);
    }
    for (const c of this.chests) {
      if (c.scene !== World.scene || c.opened || c.hidden) continue;
      consider('chest', c, c.x, c.z, 'Öffnen', 2.8);
    }
    const pel = document.getElementById('prompt');
    if (this.prompt) { pel.style.display = 'block'; pel.innerHTML = `<b>${this.mobile ? '⊙' : 'E'}</b>&nbsp; ${this.prompt.text}`; }
    else pel.style.display = 'none';

    // Boss wecken
    if (World.scene === 'dun' && this.boss && this.boss.sleeping && !this.boss.dead) {
      const br = World.dun.bossRoom;
      if (p.x > br.minX && p.x < br.maxX && p.z > br.minZ && p.z < br.maxZ) {
        this.boss.sleeping = false; this.bossActive = true;
        this.gateCol.disabled = false;
        this.updateMusic(true); this.shake = 0.8;
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
    for (const c of this.chests) if (c.opened && c.openT < 1) c.openT = Math.min(1, c.openT + dt * 2.5);

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
        if (pr.fuse <= 0) { this.explode(pr.x, pr.y + 0.4, pr.z); pr.dead = true; }
      } else if (pr.kind === 'rock') {
        pr.vy -= 12 * dt; pr.life -= dt; pr.spin += dt * 6;
        if (U.dist(pr.x, pr.z, p.x, p.z) < 1.2 + pr.size && Math.abs(pr.y - p.y - 1) < 2) {
          this.damagePlayer(pr.dmg || 2, pr.x, pr.z); pr.life = 0;
          this.burst(pr.x, pr.y, pr.z, 12, [0.5, 0.45, 0.4], 4);
        }
        if (pr.y < World.height(pr.x, pr.z) || World.blockedStatic(pr.x, pr.z, 0.3)) {
          pr.life = 0; this.burst(pr.x, pr.y, pr.z, 8, [0.5, 0.45, 0.4], 3);
        }
      }
    }
    this.projectiles = this.projectiles.filter(pr => (pr.life === undefined || pr.life > 0) && !pr.dead);

    for (const s of this.shockwaves) {
      s.life -= dt; s.r += dt * 26;
      const d = U.dist(p.x, p.z, s.x, s.z);
      if (!s.hit && s.scene === sc && d < s.r && d > s.r - 4) { s.hit = true; this.damagePlayer(s.dmg, s.x, s.z); }
    }
    this.shockwaves = this.shockwaves.filter(s => s.life > 0);

    for (const pk of this.pickups) {
      if (pk.scene !== sc) continue;
      pk.life -= dt; pk.vy -= 14 * dt;
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

    for (const q of this.particles) { q.life -= dt; q.vy -= 15 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; }
    this.particles = this.particles.filter(q => q.life > 0);

    /* Bumerang: fliegt hin, kehrt zurück, betäubt und sammelt ein */
    const b = this.boomerang;
    if (b) {
      b.t += dt; b.spin += dt * 22;
      if (!b.back && (b.t > 0.42 || World.blockedStatic(b.x, b.z, 0.3))) b.back = true;
      if (b.back) {
        const a = Math.atan2(p.x - b.x, p.z - b.z);
        const sp = 26;
        b.vx = Math.sin(a) * sp; b.vz = Math.cos(a) * sp;
        b.y = U.lerp(b.y, p.y + 1.2, Math.min(1, dt * 6));
      }
      b.x += b.vx * dt; b.z += b.vz * dt;
      for (const e of this.enemies) {
        if (e.dead || e.scene !== b.scene || e.sleeping || b.hit.indexOf(e) >= 0) continue;
        if (U.dist(b.x, b.z, e.x, e.z) < e.r + 0.7) {
          b.hit.push(e);
          if (e.peaceful) this.angerCucco(e, b.x, b.z);
          else if (e.boss) this.hitEnemy(e, 0, b.x, b.z);
          else { e.stunT = 2.2; e.state = 'idle'; this.hitEnemy(e, 1, b.x, b.z, 4); }
        }
      }
      for (const pk of this.pickups) if (pk.scene === b.scene && U.dist(b.x, b.z, pk.x, pk.z) < 1.6) { pk.x = b.x; pk.z = b.z; }
      for (const g of this.grass) if (!g.cut && g.scene === b.scene && U.dist(b.x, b.z, g.x, g.z) < 1.2) this.cutGrass(g);
      if (b.back && U.dist(b.x, b.z, p.x, p.z) < 1.2) { this.boomerang = null; Snd.tone(700, 0.1, 'triangle', 0.1, 400); }
      if (b.t > 4) this.boomerang = null;
    }

    /* Schiebeblöcke */
    for (const bl of this.blocks) {
      if (bl.scene !== sc) continue;
      if (bl.moving) {
        bl.x = U.lerp(bl.x, bl.tx, Math.min(1, dt * 7));
        bl.z = U.lerp(bl.z, bl.tz, Math.min(1, dt * 7));
        bl.col.x = bl.x; bl.col.z = bl.z;
        if (Math.abs(bl.x - bl.tx) < 0.04 && Math.abs(bl.z - bl.tz) < 0.04) {
          bl.x = bl.tx; bl.z = bl.tz; bl.col.x = bl.x; bl.col.z = bl.z; bl.moving = false;
          this.checkSwitches();
        }
        continue;
      }
      const d = U.dist(p.x, p.z, bl.x, bl.z);
      if (d < 2.4 && p.speed > 2) {
        const dx = bl.x - p.x, dz = bl.z - p.z;
        let ux = 0, uz = 0;
        if (Math.abs(dx) > Math.abs(dz)) ux = Math.sign(dx); else uz = Math.sign(dz);
        const T = World.dunT;
        const nx = bl.x + ux * T, nz = bl.z + uz * T;
        bl.col.disabled = true;
        const frei = !World.blockedStatic(nx, nz, 1.0);
        bl.col.disabled = false;
        if (frei) {
          bl.tx = nx; bl.tz = nz; bl.moving = true;
          Snd.noise(0.35, 0.2, 700); Snd.tone(90, 0.3, 'square', 0.12, 60);
        }
      }
    }

    /* Herzteile einsammeln */
    for (const h of this.heartPieces) {
      if (h.taken || h.scene !== sc) continue;
      if (U.dist(h.x, h.z, p.x, p.z) < 1.6) { h.taken = true; this.gainHeartPiece(); }
    }

    if (this.cuccoRage > 0) {
      this.cuccoRage -= dt;
      if (this.cuccoRage <= 0) {
        this.enemies = this.enemies.filter(e => !e.angry);
        this.toast('Die Hühner beruhigen sich.', 2);
      }
    }
  },

  /* Beide Platten gedrückt -> Gitter öffnet */
  checkSwitches() {
    if (this.puzzleSolved) return;
    let alle = true;
    for (const s of this.switches) {
      s.pressed = this.blocks.some(b => U.dist(b.x, b.z, s.x, s.z) < 1.2);
      if (!s.pressed) alle = false;
    }
    if (alle && this.switches.length) {
      this.puzzleSolved = true;
      this.puzzleGate.disabled = true;
      Snd.door(); Snd.fanfare();
      this.toast('Ein Gitter öffnet sich!', 3);
      this.save();
    }
  },

  updateWeather(dt) {
    if (World.scene !== 'over') { this.weather = Math.max(0, this.weather - dt); return; }
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = 70 + Math.random() * 120;
      this.raining = !this.raining && Math.random() < 0.45;
      if (this.raining) this.toast('Es beginnt zu regnen.', 2.5);
    }
    const ziel = this.raining ? 1 : 0;
    this.weather = U.lerp(this.weather, ziel, Math.min(1, dt * 0.35));
    this.rainT = (this.rainT + dt * 26) % World.rainH;
    if (this.raining && Math.random() < dt * 0.06) {         // Donner
      Snd.noise(1.2, 0.22, 300); Snd.tone(60, 0.9, 'sine', 0.16, 30);
      this.lightning = 0.35;
    }
    if (this.lightning > 0) this.lightning -= dt;
  },

  updateCamera(dt) {
    const p = this.player;
    const tx = p.x, ty = p.y + 1.5, tz = p.z;
    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    let ex = tx + Math.sin(this.camYaw) * cp * this.camDist;
    let ez = tz + Math.cos(this.camYaw) * cp * this.camDist;
    let ey = ty + sp * this.camDist;
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
    M4.perspective(G.proj, 1.0, asp, 0.1, 420);
    let sx = 0, sy = 0;
    if (this.shake > 0) { sx = (Math.random() - 0.5) * this.shake; sy = (Math.random() - 0.5) * this.shake; }
    const c = this.camPos, t = this.camTarget || { x: 0, y: 0, z: 0 };
    M4.lookAt(G.view, c.x + sx, c.y + sy, c.z, t.x, t.y, t.z, 0, 1, 0);
    G.frame(W.fog, W.fogNear, W.fogFar, W.amb, W.lightCol, W.light, this.time);

    const I = M4.create();
    const sc = World.scene;

    if (W.outdoor) {
      // Himmel + Sonne/Mond + Wolken
      const skyM = M4.create();
      M4.compose(skyM, c.x, c.y, c.z, 0, 0, 0, 1, 1, 1);
      G.draw(World.sky, skyM, this.skyTint || [1, 1, 1], { emis: 1, noCull: true, noDepthWrite: true, noTex: true, blend: true });
      // Sterne (nur nachts sichtbar)
      if (this.nightFactor > 0.08) {
        const D = 300, step = this.mobile ? 2 : 1;
        for (let i = 0; i < World.stars.length; i += step) {
          const st = World.stars[i];
          const tw = 0.75 + 0.25 * Math.sin(this.time * 2.2 + st.t);
          G.sprite(c.x + st.x * D, c.y + st.y * D, c.z + st.z * D, st.s * 2.6, st.s * 2.6,
            [1, 1, 0.94, this.nightFactor * tw], { emis: 1, noDepthWrite: true, noTex: true });
        }
      }
      const sunA = (this.dayT - 0.25) * Math.PI * 2;
      const sd = 240;
      const sunPos = [c.x + Math.cos(sunA) * 0.6 * sd, c.y + Math.sin(sunA) * sd, c.z + 0.35 * sd];
      if (this.sunElev > -0.15)
        G.sprite(sunPos[0], sunPos[1], sunPos[2], 34, 34, [1, 0.95, 0.75, 0.95], { emis: 1, noDepthWrite: true, noTex: true });
      if (this.sunElev < 0.15)
        G.sprite(c.x - Math.cos(sunA) * 0.6 * sd, c.y - Math.sin(sunA) * sd, c.z - 0.35 * sd, 22, 22, [0.85, 0.9, 1, 0.9], { emis: 1, noDepthWrite: true, noTex: true });
      const cloudM = M4.create();
      M4.compose(cloudM, c.x * 0.55 + this.time * 0.4, 0, c.z * 0.55, 0, 0, 0, 1, 1, 1);
      const ct = this.skyTint || [1, 1, 1];   // Wolken folgen der Tageslichtstimmung
      G.draw(World.clouds, cloudM, [0.35 + ct[0] * 0.65, 0.38 + ct[1] * 0.62, 0.45 + ct[2] * 0.55, 0.9],
        { emis: 0.85, noDepthWrite: true, noTex: true });
    }

    G.draw(W.mesh, I, [1, 1, 1]);
    if (W.grass) G.draw(W.grass, I, [1, 1, 1], { noCull: true });
    if (W.props) G.draw(W.props, I, [1, 1, 1]);
    if (W.glow) G.draw(W.glow, I, [1, 1, 1], { emis: 0.95 });

    for (const g of this.grass) if (!g.cut && g.scene === sc) Ents.drawGrass(g);
    for (const o of this.pots) if (!o.broken && o.scene === sc) Ents.drawPot(o);
    for (const s of this.signs) if (s.scene === sc) Ents.drawSign(s);
    for (const cr of this.cracks) if (!cr.broken && cr.scene === sc) Ents.drawCrack(cr);
    for (const ch of this.chests) if (ch.scene === sc && !ch.hidden) Ents.drawChest(ch, this.time);
    for (const d of this.doors) if (!d.gone && d.scene === sc) Ents.drawDoor(d);
    if (sc === 'dun' && this.gateCol && !this.gateCol.disabled) Ents.drawDoor({ x: this.gateCol.x, z: this.gateCol.z, y: 0 });
    for (const n of this.npcs) if (n.scene === sc) Ents.drawNPC(n, this.time);
    for (const e of this.enemies) {
      if (e.scene !== sc || e.dead || e.sleeping) continue;
      Ents.drawEnemy(e, this.time);
      // Lebensbalken über angeschlagenen Gegnern
      if (!e.boss && !e.peaceful && e.hp < e.maxhp && U.dist(e.x, e.z, this.player.x, this.player.z) < 26) {
        const h = e.y + (e.t === 'boss' ? 6 : e.r * 1.6 + 2.1);
        G.sprite(e.x, h, e.z, 1.5, 0.22, [0.1, 0.05, 0.05, 0.75], { hard: true, noDepthWrite: true, emis: 1, noTex: true });
        const f = Math.max(0, e.hp / e.maxhp);
        G.sprite(e.x - (1.44 * (1 - f)) / 2, h, e.z, 1.44 * f, 0.15, [0.95, 0.3, 0.3, 0.95], { hard: true, noDepthWrite: true, emis: 1, noTex: true });
      }
    }
    if (this.boss && this.boss.sleeping && sc === 'dun' && !this.boss.dead) Ents.drawEnemy(this.boss, this.time);
    if (this.warps) for (const w of this.warps) if (w.scene === sc) Ents.drawWarp(w, this.time);
    for (const bl of this.blocks) if (bl.scene === sc) Ents.drawBlock(bl);
    for (const sw of this.switches) if (sw.scene === sc) Ents.drawSwitch(sw, this.time);
    for (const h of this.heartPieces) if (!h.taken && h.scene === sc) Ents.drawHeartPiece(h, this.time);
    for (const pk of this.pickups) if (pk.scene === sc) Ents.drawPickup(pk, this.time);
    for (const pr of this.projectiles) if (pr.scene === sc) Ents.drawProjectile(pr, this.time);
    if (this.boomerang && this.boomerang.scene === sc) Ents.drawBoomerang(this.boomerang, this.time);
    if (!this.player.dead) Ents.drawPlayer(this.player, this.time);

    // Flammen (nachts / im Dungeon heller)
    const flameA = sc === 'dun' ? 1 : U.clamp(this.nightFactor * 1.4, 0.15, 1);
    for (const l of this.lights) {
      if (l.scene !== sc) continue;
      if (U.dist(l.x, l.z, this.player.x, this.player.z) > 46) continue;
      Ents.drawFlame(l.x, l.y, l.z, this.time * flameA, l.seed, l.col);
    }

    const pm = M4.create();
    for (const q of this.particles) {
      if (q.scene !== sc) continue;
      const a = U.clamp(q.life / q.maxlife, 0, 1);
      M4.compose(pm, q.x, q.y, q.z, q.life * 6, q.life * 4, 0, q.size, q.size, q.size);
      G.draw(PRIM.box, pm, [q.col[0], q.col[1], q.col[2], a], { noDepthWrite: true, emis: 0.4, noTex: true });
    }
    for (const s of this.shockwaves) if (s.scene === sc) Ents.drawShockwave(s);

    if (W.water) G.draw(W.water, I, [1, 1, 1, 0.74], { wave: true, noDepthWrite: true, noCull: true });

    // Glühwürmchen in lauen Nächten
    if (W.outdoor && this.nightFactor > 0.45 && this.weather < 0.3) {
      const n = this.mobile ? 12 : 22;
      for (let i = 0; i < n; i++) {
        const a = this.time * (0.3 + i * 0.017) + i * 2.3;
        const r = 6 + (i % 5) * 3.5;
        const fx = this.player.x + Math.sin(a) * r, fz = this.player.z + Math.cos(a * 0.8) * r;
        const fy = World.height(fx, fz) + 0.9 + Math.sin(this.time * 1.7 + i) * 0.6;
        const bl = 0.45 + 0.55 * Math.sin(this.time * 3 + i * 1.7);
        if (bl < 0.15) continue;
        G.sprite(fx, fy, fz, 0.3, 0.3, [0.85, 1, 0.4, bl * this.nightFactor], { emis: 1, noDepthWrite: true, noTex: true });
      }
    }
    // Regen (zwei Etagen, damit das Umlaufen nahtlos bleibt)
    if (W.outdoor && this.weather > 0.02) {
      const rm = M4.create();
      M4.compose(rm, Math.round(this.player.x), this.player.y - 4 - this.rainT, Math.round(this.player.z), 0, 0, 0, 1, 1, 1);
      G.draw(World.rain, rm, [0.75, 0.85, 1, 0.42 * this.weather], { noDepthWrite: true, noCull: true, emis: 0.75, noTex: true });
    }

    this.drawMinimap();
    this.drawBossBar();
    this.drawCompass();
    this.drawStatusUI();
  },

  drawStatusUI() {
    const p = this.player;
    const cb = document.getElementById('chargebar');
    if (cb) {
      if (p.charge > 0.06 && p.spinT <= 0) {
        cb.style.display = 'block';
        cb.classList.toggle('full', p.charge >= 1);
        document.getElementById('chargefill').style.width = (p.charge * 100) + '%';
      } else cb.style.display = 'none';
    }
    document.body.classList.toggle('lowhp', !p.dead && p.hp > 0 && p.hp <= 2);
  },

  drawBossBar() {
    const el = document.getElementById('bossbar');
    if (this.bossActive && this.boss && !this.boss.dead) {
      el.style.display = 'block';
      document.getElementById('bossfill').style.width = (100 * Math.max(0, this.boss.hp) / this.boss.maxhp) + '%';
    } else el.style.display = 'none';
  },

  /* Kompass zeigt aufs aktuelle Ziel */
  drawCompass() {
    const el = document.getElementById('compass');
    if (!el) return;
    let target = null, label = '';
    const p = this.player;
    if (World.scene === 'over') {
      if (!this.player.items.sword) { target = this.npcs.find(n => n.give); label = 'Ältester'; }
      else if (!this.hasShard) { target = World.dungeonDoor; label = 'Ruine'; }
    } else {
      if (this.bossDead) { const c = this.chests.find(c => c.item === 'shard' && !c.opened); if (c) { target = c; label = 'Splitter'; } }
      else if (p.keys > 0 && this.doors.some(d => !d.gone)) { target = this.doors.find(d => !d.gone); label = 'Tür'; }
      else if (!this.bossDead) { const c = this.chests.find(c => c.item === 'key' && !c.opened); if (c) { target = c; label = 'Schlüssel'; } else { target = World.dun.bossGate; label = 'Boss'; } }
    }
    if (!target) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    const a = Math.atan2(target.x - p.x, target.z - p.z);
    const rel = U.angDiff(this.camYaw + Math.PI, a);
    document.getElementById('compassArrow').style.transform = `rotate(${-rel}rad)`;
    document.getElementById('compassLabel').textContent = label + ' · ' + Math.round(U.dist(p.x, p.z, target.x, target.z)) + 'm';
  },

  drawMinimap() {
    const ctx = this.mini; if (!ctx) return;
    const S = 150;
    ctx.clearRect(0, 0, S, S);
    const p = this.player;
    if (World.scene === 'over') {
      const sc = S / (WORLD_R * 2.1), cx = S / 2, cy = S / 2;
      ctx.fillStyle = this.nightFactor > 0.5 ? '#1d3a20' : '#2f5d2c';
      ctx.beginPath(); ctx.arc(cx, cy, S * 0.47, 0, 7); ctx.fill();
      ctx.fillStyle = '#1c4a7a'; ctx.beginPath(); ctx.arc(cx + 60 * sc, cy + 6 * sc, 26 * sc, 0, 7); ctx.fill();
      ctx.fillStyle = '#5a5a62'; ctx.fillRect(cx - 90 * sc, cy - 100 * sc, 180 * sc, 42 * sc);
      ctx.fillStyle = '#22401f'; ctx.fillRect(cx - 100 * sc, cy - 40 * sc, 78 * sc, 110 * sc);
      ctx.fillStyle = '#8a7a4a'; ctx.beginPath(); ctx.arc(cx, cy + 62 * sc, 14 * sc, 0, 7); ctx.fill();
      ctx.strokeStyle = '#7a6244'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy + 58 * sc); ctx.lineTo(cx, cy - 70 * sc); ctx.stroke();
      ctx.fillStyle = '#d9534f';
      for (const e of this.enemies) if (e.scene === 'over' && !e.dead) ctx.fillRect(cx + e.x * sc - 1.5, cy + e.z * sc - 1.5, 3, 3);
      ctx.fillStyle = '#f0c419';
      for (const c of this.chests) if (c.scene === 'over' && !c.opened && !c.hidden) ctx.fillRect(cx + c.x * sc - 2, cy + c.z * sc - 2, 4, 4);
      this.miniPlayer(ctx, cx + p.x * sc, cy + p.z * sc);
    } else {
      const cx = S / 2, cy = S / 2, sc = World.scene === 'cave' ? S / 68 : S / 118;
      ctx.fillStyle = World.scene === 'cave' ? '#2e3a44' : '#3a3a45';
      for (const c of World.cur.colliders) {
        if (c.hx === undefined || c.disabled) continue;
        ctx.fillRect(cx + (c.x - c.hx) * sc, cy + (c.z - c.hz) * sc, c.hx * 2 * sc, c.hz * 2 * sc);
      }
      const sz = World.scene;
      ctx.fillStyle = '#d9534f';
      for (const e of this.enemies) if (e.scene === sz && !e.dead && !e.sleeping) ctx.fillRect(cx + e.x * sc - 1.5, cy + e.z * sc - 1.5, 3, 3);
      ctx.fillStyle = '#f0c419';
      for (const c of this.chests) if (c.scene === sz && !c.opened && !c.hidden) ctx.fillRect(cx + c.x * sc - 2, cy + c.z * sc - 2, 4, 4);
      this.miniPlayer(ctx, cx + p.x * sc, cy + p.z * sc);
    }
  },
  miniPlayer(ctx, x, y) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-this.player.yaw);
    ctx.fillStyle = '#fff'; ctx.beginPath();
    ctx.moveTo(0, -5); ctx.lineTo(4, 4); ctx.lineTo(0, 2); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  },

  loop(now) {
    const t = now / 1000;
    if (!this._last) this._last = t;
    let dt = Math.min(0.05, t - this._last);
    this._last = t;
    this.fps = U.lerp(this.fps, 1 / Math.max(dt, 0.001), 0.05);
    if (this.state !== 'title') { this.update(dt); this.render(); }
    requestAnimationFrame(n => this.loop(n));
  }
};

window.addEventListener('load', () => Game.init());
window.addEventListener('beforeunload', () => Game.save());
