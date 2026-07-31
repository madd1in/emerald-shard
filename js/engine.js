'use strict';
/* =========================================================
   ENGINE  —  Mathe, WebGL-Renderer, Mesh-Builder, Sound
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
  identity(o) { o[0] = 1; o[1] = 0; o[2] = 0; o[3] = 0; o[4] = 0; o[5] = 1; o[6] = 0; o[7] = 0; o[8] = 0; o[9] = 0; o[10] = 1; o[11] = 0; o[12] = 0; o[13] = 0; o[14] = 0; o[15] = 1; return o; },
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
    // R = Ry * Rx * Rz
    const m00 = cy * cz + syr * sxr * szr, m01 = cx * szr, m02 = -syr * cz + cy * sxr * szr;
    const m10 = -cy * szr + syr * sxr * cz, m11 = cx * cz, m12 = syr * szr + cy * sxr * cz;
    const m20 = syr * cx, m21 = -sxr, m22 = cy * cx;
    o[0] = m00 * sx; o[1] = m01 * sx; o[2] = m02 * sx; o[3] = 0;
    o[4] = m10 * sy; o[5] = m11 * sy; o[6] = m12 * sy; o[7] = 0;
    o[8] = m20 * sz; o[9] = m21 * sz; o[10] = m22 * sz; o[11] = 0;
    o[12] = px; o[13] = py; o[14] = pz; o[15] = 1;
    return o;
  }
};

/* Normalmatrix (3x3) aus Modelmatrix */
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

/* ---------------- Mesh-Builder ---------------- */
function MeshData() { this.p = []; this.n = []; this.c = []; }
MeshData.prototype = {
  tri(ax, ay, az, bx, by, bz, cx, cy, cz, col) {
    let ux = bx - ax, uy = by - ay, uz = bz - az;
    let vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    this.p.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    this.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    for (let i = 0; i < 3; i++) this.c.push(col[0], col[1], col[2]);
  },
  quad(a, b, c, d, col) {
    this.tri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], col);
    this.tri(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2], col);
  },
  box(cx, cy, cz, sx, sy, sz, col, ry) {
    ry = ry || 0;
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const co = Math.cos(ry), si = Math.sin(ry);
    const v = [];
    const corners = [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz],
    [-hx, hy, -hz], [hx, hy, -hz], [hx, hy, hz], [-hx, hy, hz]];
    for (const c of corners) v.push([cx + c[0] * co + c[2] * si, cy + c[1], cz + (-c[0] * si + c[2] * co)]);
    const sh = (k) => [col[0] * k, col[1] * k, col[2] * k];
    this.quad(v[4], v[5], v[6], v[7], sh(1.0));   // top
    this.quad(v[3], v[2], v[1], v[0], sh(0.55));  // bottom
    this.quad(v[0], v[1], v[5], v[4], sh(0.82));  // -z
    this.quad(v[2], v[3], v[7], v[6], sh(0.88));  // +z
    this.quad(v[1], v[2], v[6], v[5], sh(0.94));  // +x
    this.quad(v[3], v[0], v[4], v[7], sh(0.76));  // -x
  },
  cylinder(cx, cy, cz, rBot, rTop, h, seg, col, capTop) {
    const hy = h / 2;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const k = 0.78 + 0.22 * (0.5 + 0.5 * Math.cos(a0 - 0.7));
      const shade = [col[0] * k, col[1] * k, col[2] * k];
      const bA = [cx + c0 * rBot, cy - hy, cz + s0 * rBot], bB = [cx + c1 * rBot, cy - hy, cz + s1 * rBot];
      const tA = [cx + c0 * rTop, cy + hy, cz + s0 * rTop], tB = [cx + c1 * rTop, cy + hy, cz + s1 * rTop];
      if (rTop > 0.001) this.quad(bA, bB, tB, tA, shade);
      else this.tri(bA[0], bA[1], bA[2], bB[0], bB[1], bB[2], cx, cy + hy, cz, shade);
      if (capTop !== false && rTop > 0.001) this.tri(tA[0], tA[1], tA[2], tB[0], tB[1], tB[2], cx, cy + hy, cz, col);
    }
  },
  sphere(cx, cy, cz, r, col, seg, rings, squash) {
    seg = seg || 8; rings = rings || 6; squash = squash || 1;
    for (let j = 0; j < rings; j++) {
      const p0 = Math.PI * (j / rings), p1 = Math.PI * ((j + 1) / rings);
      for (let i = 0; i < seg; i++) {
        const t0 = Math.PI * 2 * (i / seg), t1 = Math.PI * 2 * ((i + 1) / seg);
        const pt = (p, t) => [cx + r * Math.sin(p) * Math.cos(t), cy + r * squash * Math.cos(p), cz + r * Math.sin(p) * Math.sin(t)];
        const a = pt(p0, t0), b = pt(p1, t0), c = pt(p1, t1), d = pt(p0, t1);
        const k = 0.8 + 0.2 * (1 - j / rings);
        const sc = [col[0] * k, col[1] * k, col[2] * k];
        if (j === 0) this.tri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], sc);
        else if (j === rings - 1) this.tri(a[0], a[1], a[2], b[0], b[1], b[2], d[0], d[1], d[2], sc);
        else this.quad(a, b, c, d, sc);
      }
    }
  },
  disc(cx, cy, cz, r, col, seg) {
    seg = seg || 16;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      this.tri(cx, cy, cz, cx + Math.cos(a1) * r, cy, cz + Math.sin(a1) * r, cx + Math.cos(a0) * r, cy, cz + Math.sin(a0) * r, col);
    }
  },
  count() { return this.p.length / 3; }
};

/* ---------------- WebGL ---------------- */
const VS = `
attribute vec3 a_pos; attribute vec3 a_norm; attribute vec3 a_col;
uniform mat4 u_proj, u_view, u_model; uniform mat3 u_nmat;
uniform float u_time, u_wave, u_fogNear, u_fogFar;
varying vec3 v_norm; varying vec3 v_col; varying float v_fog; varying float v_y;
void main(){
  vec3 p = a_pos;
  if(u_wave > 0.5){ p.y += sin(p.x*0.32 + u_time*1.7)*0.16 + cos(p.z*0.38 + u_time*1.2)*0.14; }
  vec4 wp = u_model * vec4(p,1.0);
  vec4 vp = u_view * wp;
  gl_Position = u_proj * vp;
  v_norm = u_nmat * a_norm;
  v_col = a_col;
  v_y = wp.y;
  v_fog = clamp((-vp.z - u_fogNear)/(u_fogFar-u_fogNear), 0.0, 1.0);
}`;
const FS = `
precision mediump float;
varying vec3 v_norm; varying vec3 v_col; varying float v_fog; varying float v_y;
uniform vec3 u_lightDir, u_fogColor; uniform vec4 u_tint; uniform float u_amb, u_emis;
void main(){
  vec3 n = normalize(v_norm);
  float d = max(dot(n, normalize(u_lightDir)), 0.0);
  float band = d > 0.72 ? 1.0 : (d > 0.34 ? 0.80 : (d > 0.12 ? 0.64 : 0.52));
  float sky = 0.5 + 0.5*n.y;
  vec3 base = v_col * u_tint.rgb;
  vec3 c = base * (band*0.86 + u_amb + sky*0.07);
  c = mix(c, base, u_emis);
  c = mix(c, u_fogColor, v_fog);
  gl_FragColor = vec4(c, u_tint.a);
}`;

const G = {
  gl: null, prog: null, loc: {}, canvas: null,
  _model: M4.create(), _nmat: new Float32Array(9), _tmp: M4.create(),
  proj: M4.create(), view: M4.create(),

  init(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false }) ||
      canvas.getContext('experimental-webgl', { antialias: true, alpha: false });
    if (!gl) return false;
    this.gl = gl;
    const mk = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); }
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(p)); return false; }
    gl.useProgram(p); this.prog = p;
    for (const n of ['u_proj', 'u_view', 'u_model', 'u_nmat', 'u_time', 'u_wave', 'u_fogNear', 'u_fogFar', 'u_lightDir', 'u_fogColor', 'u_tint', 'u_amb', 'u_emis'])
      this.loc[n] = gl.getUniformLocation(p, n);
    this.loc.a_pos = gl.getAttribLocation(p, 'a_pos');
    this.loc.a_norm = gl.getAttribLocation(p, 'a_norm');
    this.loc.a_col = gl.getAttribLocation(p, 'a_col');
    gl.enableVertexAttribArray(this.loc.a_pos);
    gl.enableVertexAttribArray(this.loc.a_norm);
    gl.enableVertexAttribArray(this.loc.a_col);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    return true;
  },

  upload(md) {
    const gl = this.gl, n = md.p.length / 3;
    const arr = new Float32Array(n * 9);
    for (let i = 0; i < n; i++) {
      arr[i * 9] = md.p[i * 3]; arr[i * 9 + 1] = md.p[i * 3 + 1]; arr[i * 9 + 2] = md.p[i * 3 + 2];
      arr[i * 9 + 3] = md.n[i * 3]; arr[i * 9 + 4] = md.n[i * 3 + 1]; arr[i * 9 + 5] = md.n[i * 3 + 2];
      arr[i * 9 + 6] = md.c[i * 3]; arr[i * 9 + 7] = md.c[i * 3 + 1]; arr[i * 9 + 8] = md.c[i * 3 + 2];
    }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
    return { buf, count: n };
  },

  frame(fog, fogNear, fogFar, amb, lightDir, time) {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(fog[0], fog[1], fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform3fv(this.loc.u_fogColor, fog);
    gl.uniform1f(this.loc.u_fogNear, fogNear);
    gl.uniform1f(this.loc.u_fogFar, fogFar);
    gl.uniform1f(this.loc.u_amb, amb);
    gl.uniform3fv(this.loc.u_lightDir, lightDir);
    gl.uniform1f(this.loc.u_time, time);
    gl.uniformMatrix4fv(this.loc.u_proj, false, this.proj);
    gl.uniformMatrix4fv(this.loc.u_view, false, this.view);
  },

  draw(mesh, model, tint, opt) {
    const gl = this.gl;
    opt = opt || {};
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buf);
    gl.vertexAttribPointer(this.loc.a_pos, 3, gl.FLOAT, false, 36, 0);
    gl.vertexAttribPointer(this.loc.a_norm, 3, gl.FLOAT, false, 36, 12);
    gl.vertexAttribPointer(this.loc.a_col, 3, gl.FLOAT, false, 36, 24);
    normalFromMat4(this._nmat, model);
    gl.uniformMatrix4fv(this.loc.u_model, false, model);
    gl.uniformMatrix3fv(this.loc.u_nmat, false, this._nmat);
    gl.uniform4f(this.loc.u_tint, tint[0], tint[1], tint[2], tint.length > 3 ? tint[3] : 1);
    gl.uniform1f(this.loc.u_wave, opt.wave ? 1 : 0);
    gl.uniform1f(this.loc.u_emis, opt.emis || 0);
    const blend = (tint.length > 3 && tint[3] < 1);
    if (blend) { gl.enable(gl.BLEND); if (opt.noDepthWrite) gl.depthMask(false); }
    if (opt.noCull) gl.disable(gl.CULL_FACE);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    if (opt.noCull) gl.enable(gl.CULL_FACE);
    if (blend) { gl.disable(gl.BLEND); gl.depthMask(true); }
  }
};

/* Einheits-Primitives (weiß, werden über u_tint eingefärbt) */
const PRIM = {};
function buildPrims() {
  const w = [1, 1, 1];
  let m = new MeshData(); m.box(0, 0, 0, 1, 1, 1, w); PRIM.box = G.upload(m);
  m = new MeshData(); m.sphere(0, 0, 0, 0.5, w, 9, 7); PRIM.sphere = G.upload(m);
  m = new MeshData(); m.cylinder(0, 0, 0, 0.5, 0.5, 1, 10, w); PRIM.cyl = G.upload(m);
  m = new MeshData(); m.cylinder(0, 0, 0, 0.5, 0, 1, 10, w); PRIM.cone = G.upload(m);
  m = new MeshData(); m.disc(0, 0, 0, 0.5, w, 18); PRIM.disc = G.upload(m);
  m = new MeshData();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2, r = 0.22;
    m.cylinder(Math.cos(a) * r, 0.22, Math.sin(a) * r, 0.09, 0, 0.55, 4, w);
  }
  PRIM.tuft = G.upload(m);
}

/* ---------------- Sound (synthetisch) ---------------- */
const Snd = {
  ctx: null, master: null, on: true, musicOn: true, _musicTimer: null, _step: 0,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.32;
    this.master.connect(this.ctx.destination);
  },
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
    o.connect(g); g.connect(this.master);
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
    src.connect(f); f.connect(g); g.connect(this.master);
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
  fanfare() { [523, 523, 523, 698, 880, 1046].forEach((f, i) => this.tone(f, 0.3, 'square', 0.2, null, i * 0.14)); },
  /* schlichtes, eigenes Hintergrund-Motiv */
  music(kind) {
    if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; }
    if (!this.ctx || !this.musicOn) return;
    const seqs = {
      over: [293.66, 440, 587.33, 440, 493.88, 392, 587.33, 392, 349.23, 440, 523.25, 440, 329.63, 493.88, 392, 293.66],
      dun: [146.83, 155.56, 146.83, 130.81, 116.54, 130.81, 146.83, 110],
      boss: [110, 116.54, 110, 98, 87.31, 98, 110, 123.47]
    };
    const seq = seqs[kind] || seqs.over;
    const rate = kind === 'over' ? 400 : 520;
    this._step = 0;
    const play = () => {
      if (!this.musicOn) return;
      const f = seq[this._step % seq.length];
      this.tone(f, kind === 'over' ? 0.26 : 0.42, kind === 'over' ? 'triangle' : 'sawtooth', 0.075);
      if (this._step % 4 === 0) this.tone(f / 2, 0.5, 'sine', 0.09);
      this._step++;
    };
    play();
    this._musicTimer = setInterval(play, rate);
  },
  stopMusic() { if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; } }
};
