const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl');
if (!gl) {
  throw new Error('WebGL is not supported in this browser.');
}

const hudList = document.getElementById('shoppingList');
const statusLabel = document.getElementById('status');
const timerLabel = document.getElementById('timer');
const instructionsOverlay = document.getElementById('instructions');
const startBtn = document.getElementById('startBtn');

const DEG2RAD = Math.PI / 180;

const Mat4 = {
  identity() {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  },
  perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    ]);
  },
  multiply(a, b) {
    const out = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        out[i * 4 + j] =
          a[i * 4 + 0] * b[0 * 4 + j] +
          a[i * 4 + 1] * b[1 * 4 + j] +
          a[i * 4 + 2] * b[2 * 4 + j] +
          a[i * 4 + 3] * b[3 * 4 + j];
      }
    }
    return out;
  },
  translate(m, x, y, z) {
    const t = Mat4.identity();
    t[12] = x;
    t[13] = y;
    t[14] = z;
    return Mat4.multiply(m, t);
  },
  scale(m, x, y, z) {
    const s = Mat4.identity();
    s[0] = x;
    s[5] = y;
    s[10] = z;
    return Mat4.multiply(m, s);
  },
  rotateY(m, a) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const r = new Float32Array([
      c, 0, -s, 0,
      0, 1, 0, 0,
      s, 0, c, 0,
      0, 0, 0, 1,
    ]);
    return Mat4.multiply(m, r);
  },
  rotateX(m, a) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const r = new Float32Array([
      1, 0, 0, 0,
      0, c, s, 0,
      0, -s, c, 0,
      0, 0, 0, 1,
    ]);
    return Mat4.multiply(m, r);
  },
  lookAt(eye, target, up) {
    const z = Vec3.normalize(Vec3.sub(eye, target));
    const x = Vec3.normalize(Vec3.cross(up, z));
    const y = Vec3.cross(z, x);
    return new Float32Array([
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -Vec3.dot(x, eye), -Vec3.dot(y, eye), -Vec3.dot(z, eye), 1,
    ]);
  },
};

const Vec3 = {
  add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; },
  sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; },
  mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; },
  dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; },
  length(a) { return Math.hypot(a[0], a[1], a[2]); },
  normalize(a) {
    const len = Vec3.length(a) || 1;
    return [a[0] / len, a[1] / len, a[2] / len];
  },
  cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  },
};

class ShaderProgram {
  constructor(vsSource, fsSource) {
    const vs = this.compile(gl.VERTEX_SHADER, vsSource);
    const fs = this.compile(gl.FRAGMENT_SHADER, fsSource);
    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(this.program));
    }
    this.uniforms = new Map();
  }
  compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader));
    }
    return shader;
  }
  use() { gl.useProgram(this.program); }
  u(name) {
    if (!this.uniforms.has(name)) {
      this.uniforms.set(name, gl.getUniformLocation(this.program, name));
    }
    return this.uniforms.get(name);
  }
}

class Texture {
  constructor(canvasGenerator) {
    this.handle = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.handle);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const texCanvas = document.createElement('canvas');
    texCanvas.width = 128;
    texCanvas.height = 128;
    const ctx = texCanvas.getContext('2d');
    canvasGenerator(ctx, texCanvas.width, texCanvas.height);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texCanvas);
    gl.generateMipmap(gl.TEXTURE_2D);
  }
}

class Mesh {
  constructor(vertices, normals, uvs, indices) {
    this.indexCount = indices.length;

    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    this.nbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

    this.tbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);

    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  }

  draw(shader) {
    const posLoc = gl.getAttribLocation(shader.program, 'aPosition');
    const normLoc = gl.getAttribLocation(shader.program, 'aNormal');
    const uvLoc = gl.getAttribLocation(shader.program, 'aUV');

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(posLoc);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.nbo);
    gl.vertexAttribPointer(normLoc, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(normLoc);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.tbo);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(uvLoc);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
  }
}

class Material {
  constructor(texture, ambient = 0.25, specular = 0.6, shininess = 24.0) {
    this.texture = texture;
    this.ambient = ambient;
    this.specular = specular;
    this.shininess = shininess;
  }
}

class Entity {
  constructor({ name, type, mesh, material, position = [0, 0, 0], scale = [1, 1, 1], rotationY = 0, solid = false, pickable = false }) {
    this.name = name;
    this.type = type;
    this.mesh = mesh;
    this.material = material;
    this.position = position;
    this.scale = scale;
    this.rotationY = rotationY;
    this.solid = solid;
    this.pickable = pickable;
    this.collected = false;
  }
  modelMatrix() {
    let m = Mat4.identity();
    m = Mat4.translate(m, this.position[0], this.position[1], this.position[2]);
    m = Mat4.rotateY(m, this.rotationY);
    m = Mat4.scale(m, this.scale[0], this.scale[1], this.scale[2]);
    return m;
  }
  aabb() {
    const half = [this.scale[0] * 0.5, this.scale[1] * 0.5, this.scale[2] * 0.5];
    return {
      min: [this.position[0] - half[0], this.position[1] - half[1], this.position[2] - half[2]],
      max: [this.position[0] + half[0], this.position[1] + half[1], this.position[2] + half[2]],
    };
  }
}

function createCubeMesh() {
  const p = [
    -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1,
    1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1,
    -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1,
    -1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1,
    1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1,
    -1, -1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1,
  ];
  const n = [
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  ];
  const uv = [
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
  ];
  const idx = [];
  for (let i = 0; i < 6; i++) {
    const o = i * 4;
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  return new Mesh(p, n, uv, idx);
}

const vs = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUV;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUV;

void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorldPos = world.xyz;
  vNormal = mat3(uModel) * aNormal;
  vUV = aUV;
  gl_Position = uProj * uView * world;
}
`;

const fs = `
precision mediump float;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUV;

uniform sampler2D uTex;
uniform vec3 uCameraPos;
uniform vec3 uLightDir;
uniform vec3 uPointLightPos;
uniform float uPointLightOn;
uniform float uAmbient;
uniform float uSpecular;
uniform float uShininess;
uniform float uTime;
uniform float uGlobalFlicker;

void main() {
  vec3 baseColor = texture2D(uTex, vUV).rgb;
  vec3 norm = normalize(vNormal);
  vec3 viewDir = normalize(uCameraPos - vWorldPos);

  vec3 dirL = normalize(-uLightDir);
  float diffD = max(dot(norm, dirL), 0.0);
  vec3 reflectD = reflect(-dirL, norm);
  float specD = pow(max(dot(viewDir, reflectD), 0.0), uShininess) * uSpecular;

  vec3 pointVec = uPointLightPos - vWorldPos;
  float dist = max(length(pointVec), 0.01);
  vec3 pointL = normalize(pointVec);
  float diffP = max(dot(norm, pointL), 0.0) / (1.0 + 0.25 * dist * dist);
  vec3 reflectP = reflect(-pointL, norm);
  float specP = pow(max(dot(viewDir, reflectP), 0.0), uShininess) * uSpecular / (1.0 + 0.25 * dist * dist);

  float ambient = uAmbient * uGlobalFlicker;
  float lighting = ambient + diffD * 0.65 + uPointLightOn * diffP;
  vec3 color = baseColor * lighting + vec3(specD + uPointLightOn * specP);

  gl_FragColor = vec4(color, 1.0);
}
`;

const shader = new ShaderProgram(vs, fs);
const cubeMesh = createCubeMesh();

const textures = {
  floor: new Texture((ctx, w, h) => {
    ctx.fillStyle = '#6f6f6f';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#878787' : '#5d5d5d';
        ctx.fillRect(x * 16, y * 16, 16, 16);
      }
    }
  }),
  shelf: new Texture((ctx, w, h) => {
    ctx.fillStyle = '#8b633f';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#6b4729';
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * 10 + (i % 2 ? 2 : 0));
      ctx.lineTo(w, i * 10 + 6);
      ctx.stroke();
    }
  }),
  wall: new Texture((ctx, w, h) => {
    ctx.fillStyle = '#55606c';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 450; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const c = 70 + Math.random() * 80;
      ctx.fillStyle = `rgba(${c}, ${c}, ${c}, 0.2)`;
      ctx.fillRect(x, y, 3, 3);
    }
  }),
  label: new Texture((ctx, w, h) => {
    ctx.fillStyle = '#ece8d8';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, w, 16);
    ctx.fillStyle = '#f0c820';
    ctx.fillRect(10, 30, 108, 26);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('ITEM', 44, 47);
  }),
  monster: new Texture((ctx, w, h) => {
    ctx.fillStyle = '#4f6f54';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.fillStyle = i % 3 === 0 ? '#a53333' : '#38553f';
      ctx.fillRect(x, y, 6, 6);
    }
  }),
  checkout: new Texture((ctx, w, h) => {
    ctx.fillStyle = '#353535';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#777';
    ctx.fillRect(0, h * 0.35, w, 10);
    ctx.fillRect(0, h * 0.65, w, 10);
  }),
  door: new Texture((ctx, w, h) => {
    ctx.fillStyle = '#40472e';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#a8b377';
    ctx.fillRect(w * 0.75, h * 0.45, 10, 10);
  }),
};

const materials = {
  floor: new Material(textures.floor, 0.28, 0.25, 8),
  shelf: new Material(textures.shelf, 0.25, 0.4, 16),
  wall: new Material(textures.wall, 0.2, 0.35, 12),
  item: new Material(textures.label, 0.24, 0.55, 28),
  monster: new Material(textures.monster, 0.2, 0.7, 20),
  checkout: new Material(textures.checkout, 0.22, 0.45, 14),
  door: new Material(textures.door, 0.24, 0.45, 18),
};

const entities = [];
const colliders = [];

function addEntity(opts) {
  const e = new Entity({ mesh: cubeMesh, ...opts });
  entities.push(e);
  if (e.solid) colliders.push(e);
  return e;
}

addEntity({ name: 'floor', type: 'floor', material: materials.floor, position: [0, -0.6, 0], scale: [44, 1, 44], solid: true });
addEntity({ name: 'checkout', type: 'checkout', material: materials.checkout, position: [0, 0.6, -16], scale: [12, 2.2, 2], solid: true });

for (const z of [-8, 0, 8]) {
  addEntity({ name: `shelf-left-${z}`, type: 'shelf', material: materials.shelf, position: [-6, 0.8, z], scale: [1.6, 2.2, 7.5], solid: true });
  addEntity({ name: `shelf-right-${z}`, type: 'shelf', material: materials.shelf, position: [6, 0.8, z], scale: [1.6, 2.2, 7.5], solid: true });
}

addEntity({ name: 'wall-north', type: 'wall', material: materials.wall, position: [0, 1.4, -21], scale: [44, 4, 1], solid: true });
addEntity({ name: 'wall-south', type: 'wall', material: materials.wall, position: [0, 1.4, 21], scale: [44, 4, 1], solid: true });
addEntity({ name: 'wall-west', type: 'wall', material: materials.wall, position: [-21, 1.4, 0], scale: [1, 4, 44], solid: true });
addEntity({ name: 'wall-east', type: 'wall', material: materials.wall, position: [21, 1.4, 0], scale: [1, 4, 44], solid: true });

const door = addEntity({ name: 'exit-door', type: 'door', material: materials.door, position: [0, 1.6, 20.3], scale: [3.8, 3.2, 0.5], solid: true });

const shoppingItems = [
  { name: 'Milk', pos: [-6, 1.9, -8] },
  { name: 'Cereal', pos: [6, 1.9, -8] },
  { name: 'Bread', pos: [-6, 1.9, 0] },
  { name: 'Batteries', pos: [6, 1.9, 0] },
  { name: 'Soap', pos: [-6, 1.9, 8] },
  { name: 'Coffee', pos: [6, 1.9, 8] },
  { name: 'Can Soup', pos: [0, 1.6, -16] },
  { name: 'Bandages', pos: [0, 1.6, 14] },
];

for (const item of shoppingItems) {
  addEntity({ name: item.name, type: 'item', material: materials.item, position: item.pos, scale: [0.7, 0.7, 0.7], pickable: true });
}

const monster = addEntity({ name: 'monster', type: 'monster', material: materials.monster, position: [0, 1.0, -2], scale: [1.6, 2.4, 1.6], solid: true });

const player = {
  position: [0, 1.0, 16],
  velocity: [0, 0, 0],
  yaw: Math.PI,
  pitch: 0,
  radius: 0.42,
  speed: 5.5,
  flashlightOn: true,
};

const input = { w: false, a: false, s: false, d: false };

let doorOpened = false;
let flickerUntil = 0;
let scareTriggered = false;
let gameOver = false;
let victory = false;
let startTime = performance.now();
let lastTime = startTime;

function updateListUI() {
  hudList.innerHTML = '';
  const items = entities.filter((e) => e.pickable);
  for (const item of items) {
    const li = document.createElement('li');
    li.textContent = item.name;
    if (item.collected) li.classList.add('done');
    hudList.appendChild(li);
  }
}

function setStatus(text) {
  statusLabel.textContent = text;
}

function allItemsCollected() {
  return entities.filter((e) => e.pickable).every((e) => e.collected);
}

function rayAABB(origin, dir, aabb, maxDist) {
  let tmin = 0;
  let tmax = maxDist;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dir[i]) < 0.0001) {
      if (origin[i] < aabb.min[i] || origin[i] > aabb.max[i]) return null;
      continue;
    }
    const inv = 1 / dir[i];
    let t1 = (aabb.min[i] - origin[i]) * inv;
    let t2 = (aabb.max[i] - origin[i]) * inv;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmax < tmin) return null;
  }
  return tmin;
}

function playerCollides(pos, padding = player.radius) {
  for (const c of colliders) {
    if (c === monster || (c === door && doorOpened)) continue;
    const a = c.aabb();
    const nearestX = Math.max(a.min[0], Math.min(pos[0], a.max[0]));
    const nearestZ = Math.max(a.min[2], Math.min(pos[2], a.max[2]));
    const dx = pos[0] - nearestX;
    const dz = pos[2] - nearestZ;
    if (dx * dx + dz * dz < padding * padding && pos[1] > a.min[1] - 1.8 && pos[1] < a.max[1] + 1.8) {
      return true;
    }
  }
  return false;
}

function movePlayer(dt) {
  const forward = [Math.sin(player.yaw), 0, Math.cos(player.yaw)];
  const right = [Math.cos(player.yaw), 0, -Math.sin(player.yaw)];
  let wish = [0, 0, 0];
  if (input.w) wish = Vec3.add(wish, forward);
  if (input.s) wish = Vec3.sub(wish, forward);
  if (input.a) wish = Vec3.sub(wish, right);
  if (input.d) wish = Vec3.add(wish, right);
  wish = Vec3.normalize(wish);

  const move = Vec3.mul(wish, player.speed * dt);
  const nextX = [player.position[0] + move[0], player.position[1], player.position[2]];
  if (!playerCollides(nextX)) player.position[0] = nextX[0];
  const nextZ = [player.position[0], player.position[1], player.position[2] + move[2]];
  if (!playerCollides(nextZ)) player.position[2] = nextZ[2];
}

function moveMonster(dt) {
  const toPlayer = Vec3.sub(player.position, monster.position);
  const dist = Vec3.length(toPlayer);
  const dir = Vec3.normalize([toPlayer[0], 0, toPlayer[2]]);
  monster.rotationY = Math.atan2(dir[0], dir[2]);

  const speed = dist > 8 ? 1.8 : 2.7;
  const step = Vec3.mul(dir, speed * dt);
  const candidate = [monster.position[0] + step[0], monster.position[1], monster.position[2] + step[2]];

  let blocked = false;
  for (const c of colliders) {
    if (c === monster || (c === door && doorOpened)) continue;
    const a = c.aabb();
    if (candidate[0] > a.min[0] - 0.8 && candidate[0] < a.max[0] + 0.8 && candidate[2] > a.min[2] - 0.8 && candidate[2] < a.max[2] + 0.8) {
      blocked = true;
      break;
    }
  }
  if (!blocked) {
    monster.position[0] = candidate[0];
    monster.position[2] = candidate[2];
  }

  if (dist < 1.4 && !gameOver && !victory) {
    gameOver = true;
    setStatus('The monster caught you. Press R to restart.');
    instructionsOverlay.classList.add('visible');
  }
}

function handlePickup() {
  if (gameOver || victory) return;
  const origin = [player.position[0], player.position[1] + 0.4, player.position[2]];
  const dir = [
    Math.sin(player.yaw) * Math.cos(player.pitch),
    Math.sin(player.pitch),
    Math.cos(player.yaw) * Math.cos(player.pitch),
  ];
  let best = null;
  let bestT = 3.0;
  for (const e of entities) {
    if (!e.pickable || e.collected) continue;
    const t = rayAABB(origin, dir, e.aabb(), 3.0);
    if (t !== null && t < bestT) {
      bestT = t;
      best = e;
    }
  }
  if (best) {
    best.collected = true;
    updateListUI();
    setStatus(`Picked up: ${best.name}`);
  }
}

function resetGame() {
  player.position = [0, 1.0, 16];
  player.yaw = Math.PI;
  player.pitch = 0;
  player.flashlightOn = true;
  monster.position = [0, 1.0, -2];
  gameOver = false;
  victory = false;
  doorOpened = false;
  door.position[1] = 1.6;
  door.solid = true;
  if (!colliders.includes(door)) colliders.push(door);
  scareTriggered = false;
  flickerUntil = 0;
  startTime = performance.now();
  setStatus('Collect the full list. Stay away from the monster.');
  entities.filter((e) => e.pickable).forEach((e) => { e.collected = false; });
  updateListUI();
}

function updateEvents(nowMs) {
  const now = nowMs / 1000;
  const nearAisleCenter = Math.abs(player.position[0]) < 2.3 && Math.abs(player.position[2]) < 2.3;
  if (nearAisleCenter && !scareTriggered) {
    scareTriggered = true;
    flickerUntil = now + 4.5;
    setStatus('Lights flicker... something is hunting you.');
  }

  if (allItemsCollected() && !doorOpened) {
    doorOpened = true;
    door.position[1] = 4.8;
    door.solid = false;
    const idx = colliders.indexOf(door);
    if (idx >= 0) colliders.splice(idx, 1);
    setStatus('All items collected! Exit door opened. Reach the south wall opening.');
  }

  if (doorOpened && player.position[2] > 19.0 && Math.abs(player.position[0]) < 2.0 && !victory) {
    victory = true;
    setStatus('You escaped! Press R to play again.');
    instructionsOverlay.classList.add('visible');
  }
}

function worldFlicker(nowMs) {
  const t = nowMs / 1000;
  if (t < flickerUntil) {
    return 0.35 + 0.65 * Math.abs(Math.sin(t * 19.0));
  }
  return 1.0;
}

function setupInput() {
  document.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k in input) input[k] = true;
    if (k === 'e') handlePickup();
    if (k === 'f') {
      player.flashlightOn = !player.flashlightOn;
      setStatus(player.flashlightOn ? 'Flashlight ON' : 'Flashlight OFF');
    }
    if (k === 'r') {
      resetGame();
    }
  });
  document.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k in input) input[k] = false;
  });

  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas) return;
    player.yaw -= e.movementX * 0.002;
    player.pitch -= e.movementY * 0.002;
    player.pitch = Math.max(-1.2, Math.min(1.2, player.pitch));
  });

  canvas.addEventListener('click', () => canvas.requestPointerLock());
  startBtn.addEventListener('click', () => {
    instructionsOverlay.classList.remove('visible');
    canvas.requestPointerLock();
  });

  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== canvas && !gameOver && !victory) {
      instructionsOverlay.classList.add('visible');
    } else if (!gameOver && !victory) {
      instructionsOverlay.classList.remove('visible');
    }
  });
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.floor(canvas.clientWidth * dpr);
  const height = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
  }
}

function draw(nowMs) {
  resize();
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.02, 0.03, 0.035, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  shader.use();
  const aspect = canvas.width / canvas.height;
  const proj = Mat4.perspective(72 * DEG2RAD, aspect, 0.1, 100);

  const lookDir = [
    Math.sin(player.yaw) * Math.cos(player.pitch),
    Math.sin(player.pitch),
    Math.cos(player.yaw) * Math.cos(player.pitch),
  ];
  const eye = [player.position[0], player.position[1] + 0.4, player.position[2]];
  const target = Vec3.add(eye, lookDir);
  const view = Mat4.lookAt(eye, target, [0, 1, 0]);

  gl.uniformMatrix4fv(shader.u('uView'), false, view);
  gl.uniformMatrix4fv(shader.u('uProj'), false, proj);
  gl.uniform3fv(shader.u('uCameraPos'), new Float32Array(eye));
  gl.uniform3fv(shader.u('uLightDir'), new Float32Array([0.5, -1.0, 0.3]));
  gl.uniform1f(shader.u('uPointLightOn'), player.flashlightOn ? 1.0 : 0.0);
  gl.uniform3fv(shader.u('uPointLightPos'), new Float32Array(eye));
  gl.uniform1f(shader.u('uGlobalFlicker'), worldFlicker(nowMs));
  gl.uniform1f(shader.u('uTime'), nowMs / 1000);

  for (const e of entities) {
    if (e.pickable && e.collected) continue;
    gl.uniformMatrix4fv(shader.u('uModel'), false, e.modelMatrix());
    gl.uniform1f(shader.u('uAmbient'), e.material.ambient);
    gl.uniform1f(shader.u('uSpecular'), e.material.specular);
    gl.uniform1f(shader.u('uShininess'), e.material.shininess);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, e.material.texture.handle);
    gl.uniform1i(shader.u('uTex'), 0);
    e.mesh.draw(shader);
  }
}

function frame(nowMs) {
  const dt = Math.min(0.033, (nowMs - lastTime) / 1000);
  lastTime = nowMs;

  if (!gameOver && !victory && document.pointerLockElement === canvas) {
    movePlayer(dt);
    moveMonster(dt);
    updateEvents(nowMs);
  }

  const elapsed = (nowMs - startTime) / 1000;
  timerLabel.textContent = `Time Survived: ${elapsed.toFixed(1)}s`;

  draw(nowMs);
  requestAnimationFrame(frame);
}

setupInput();
resetGame();
requestAnimationFrame(frame);
