const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl');
if (!gl) throw new Error('WebGL is not supported in this browser.');

const hudList = document.getElementById('shoppingList');
const statusLabel = document.getElementById('status');
const timerLabel = document.getElementById('timer');
const instructionsOverlay = document.getElementById('instructions');
const startBtn = document.getElementById('startBtn');
const pickupPromptEl = document.getElementById('pickupPrompt');

const DEG2RAD = Math.PI / 180;

const Mat4 = {
  identity() {
    return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
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
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++)
        out[i*4+j] = a[0*4+j]*b[i*4+0] + a[1*4+j]*b[i*4+1] + a[2*4+j]*b[i*4+2] + a[3*4+j]*b[i*4+3];
    return out;
  },
  translate(m, x, y, z) {
    const t = Mat4.identity(); t[12]=x; t[13]=y; t[14]=z;
    return Mat4.multiply(m, t);
  },
  scale(m, x, y, z) {
    const s = Mat4.identity(); s[0]=x; s[5]=y; s[10]=z;
    return Mat4.multiply(m, s);
  },
  rotateY(m, a) {
    const c=Math.cos(a), s=Math.sin(a);
    return Mat4.multiply(m, new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]));
  },
  rotateX(m, a) {
    const c=Math.cos(a), s=Math.sin(a);
    return Mat4.multiply(m, new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]));
  },
  rotateZ(m, a) {
    const c=Math.cos(a), s=Math.sin(a);
    return Mat4.multiply(m, new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]));
  },
  lookAt(eye, target, up) {
    const z = Vec3.normalize(Vec3.sub(eye, target));
    const x = Vec3.normalize(Vec3.cross(up, z));
    const y = Vec3.cross(z, x);
    return new Float32Array([
      x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
      -Vec3.dot(x,eye), -Vec3.dot(y,eye), -Vec3.dot(z,eye), 1,
    ]);
  },
};

const Vec3 = {
  add(a,b) { return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; },
  sub(a,b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; },
  mul(a,s) { return [a[0]*s, a[1]*s, a[2]*s]; },
  dot(a,b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; },
  length(a) { return Math.hypot(a[0],a[1],a[2]); },
  normalize(a) { const l=Vec3.length(a)||1; return [a[0]/l,a[1]/l,a[2]/l]; },
  cross(a,b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; },
};

class ShaderProgram {
  constructor(vsSource, fsSource) {
    const vs = this._compile(gl.VERTEX_SHADER, vsSource);
    const fs = this._compile(gl.FRAGMENT_SHADER, fsSource);
    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(this.program));
    this.uniforms = new Map();
  }
  _compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  use() { gl.useProgram(this.program); }
  u(name) {
    if (!this.uniforms.has(name)) this.uniforms.set(name, gl.getUniformLocation(this.program, name));
    return this.uniforms.get(name);
  }
}

class Texture {
  constructor(gen) {
    this.handle = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.handle);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const ctx = c.getContext('2d');
    gen(ctx, 128, 128);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.generateMipmap(gl.TEXTURE_2D);
  }
}

class Mesh {
  constructor(vertices, normals, uvs, indices) {
    this.indexCount = indices.length;
    this.vbo = this._buf(gl.ARRAY_BUFFER, new Float32Array(vertices));
    this.nbo = this._buf(gl.ARRAY_BUFFER, new Float32Array(normals));
    this.tbo = this._buf(gl.ARRAY_BUFFER, new Float32Array(uvs));
    this.ibo = this._buf(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices));
  }
  _buf(target, data) {
    const b = gl.createBuffer(); gl.bindBuffer(target, b);
    gl.bufferData(target, data, gl.STATIC_DRAW); return b;
  }
  draw(shader) {
    const bind = (buf, name, size) => {
      const loc = gl.getAttribLocation(shader.program, name);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(loc);
    };
    bind(this.vbo, 'aPosition', 3);
    bind(this.nbo, 'aNormal', 3);
    bind(this.tbo, 'aUV', 2);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
  }
}

class Material {
  constructor(texture, ambient=0.25, specular=0.6, shininess=24) {
    this.texture=texture; this.ambient=ambient; this.specular=specular; this.shininess=shininess;
  }
}

class Entity {
  constructor({ name, type, mesh, material, position=[0,0,0], scale=[1,1,1],
                rotationY=0, rotationZ=0, solid=false, pickable=false, isRequired=false }) {
    this.name=name; this.type=type; this.mesh=mesh; this.material=material;
    this.position=position; this.scale=scale; this.rotationY=rotationY; this.rotationZ=rotationZ;
    this.solid=solid; this.pickable=pickable; this.isRequired=isRequired; this.collected=false;
  }
  modelMatrix() {
    let m = Mat4.identity();
    m = Mat4.translate(m, this.position[0], this.position[1], this.position[2]);
    m = Mat4.rotateY(m, this.rotationY);
    m = Mat4.rotateZ(m, this.rotationZ);
    m = Mat4.scale(m, this.scale[0], this.scale[1], this.scale[2]);
    return m;
  }
  aabb() {
    const h = [this.scale[0]*0.5, this.scale[1]*0.5, this.scale[2]*0.5];
    return {
      min: [this.position[0]-h[0], this.position[1]-h[1], this.position[2]-h[2]],
      max: [this.position[0]+h[0], this.position[1]+h[1], this.position[2]+h[2]],
    };
  }
}

function createCubeMesh() {
  const p = [
    -0.5,-0.5,0.5, 0.5,-0.5,0.5, 0.5,0.5,0.5, -0.5,0.5,0.5,
     0.5,-0.5,-0.5,-0.5,-0.5,-0.5,-0.5,0.5,-0.5,0.5,0.5,-0.5,
    -0.5,0.5,0.5, 0.5,0.5,0.5, 0.5,0.5,-0.5,-0.5,0.5,-0.5,
    -0.5,-0.5,-0.5,0.5,-0.5,-0.5,0.5,-0.5,0.5,-0.5,-0.5,0.5,
     0.5,-0.5,0.5, 0.5,-0.5,-0.5,0.5,0.5,-0.5,0.5,0.5,0.5,
    -0.5,-0.5,-0.5,-0.5,-0.5,0.5,-0.5,0.5,0.5,-0.5,0.5,-0.5,
  ];
  const n = [
    0,0,1,0,0,1,0,0,1,0,0,1,
    0,0,-1,0,0,-1,0,0,-1,0,0,-1,
    0,1,0,0,1,0,0,1,0,0,1,0,
    0,-1,0,0,-1,0,0,-1,0,0,-1,0,
    1,0,0,1,0,0,1,0,0,1,0,0,
    -1,0,0,-1,0,0,-1,0,0,-1,0,0,
  ];
  const uv = Array(6).fill([0,0,1,0,1,1,0,1]).flat();
  const idx = [];
  for (let i=0;i<6;i++){const o=i*4; idx.push(o,o+1,o+2,o,o+2,o+3);}
  return new Mesh(p, n, uv, idx);
}

// ── SHADERS ───────────────────────────────────────────────────────────────────

const vs = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUV;
uniform mat4 uModel, uView, uProj;
varying vec3 vWorldPos, vNormal;
varying vec2 vUV;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorldPos = world.xyz;
  vNormal = mat3(uModel) * aNormal;
  vUV = aUV;
  gl_Position = uProj * uView * world;
}`;

const fs = `
precision mediump float;
varying vec3 vWorldPos, vNormal;
varying vec2 vUV;
uniform sampler2D uTex;
uniform vec3 uCameraPos, uLightDir;
uniform vec3 uPointLightPos[4];
uniform vec3 uPointLightColor[4];
uniform float uPointLightOn[4];
uniform float uAmbient, uSpecular, uShininess, uTime, uGlobalFlicker;

void main() {
  vec3 baseColor = texture2D(uTex, vUV).rgb;
  vec3 norm = normalize(vNormal);
  vec3 viewDir = normalize(uCameraPos - vWorldPos);

  vec3 dirL = normalize(-uLightDir);
  float diffD = max(dot(norm, dirL), 0.0);
  vec3 reflD = reflect(-dirL, norm);
  float specD = pow(max(dot(viewDir, reflD), 0.0), uShininess) * uSpecular;

  vec3 ptAccum = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec3 pv = uPointLightPos[i] - vWorldPos;
    float dist = max(length(pv), 0.01);
    vec3 pl = normalize(pv);
    float att = 1.0 / (1.0 + 0.22 * dist * dist);
    float diffP = max(dot(norm, pl), 0.0) * att;
    vec3 reflP = reflect(-pl, norm);
    float specP = pow(max(dot(viewDir, reflP), 0.0), uShininess) * uSpecular * att;
    ptAccum += uPointLightColor[i] * uPointLightOn[i] * (diffP + specP);
  }

  float ambient = uAmbient * uGlobalFlicker;
  vec3 color = baseColor * (ambient + diffD * 0.12 + ptAccum) + vec3(specD * 0.05);

  float fogDist = length(uCameraPos - vWorldPos);
  float fogFactor = clamp(exp(-fogDist * 0.048), 0.0, 1.0);
  color = mix(vec3(0.02, 0.022, 0.028), color, fogFactor);

  gl_FragColor = vec4(color, 1.0);
}`;

const shader = new ShaderProgram(vs, fs);
const cubeMesh = createCubeMesh();

// ── CEILING LIGHT DEFINITIONS ─────────────────────────────────────────────────
const CEILING_LIGHTS = [
  { pos: [-5.0, 3.0,  15.0], color: [0.65, 0.95, 0.65], phase: 0.0 },
  { pos: [  0,  3.0,   0.0], color: [0.65, 0.95, 0.65], phase: 2.1 },
  { pos: [ 5.0, 3.0, -15.0], color: [0.65, 0.95, 0.65], phase: 4.4 },
];
const FLASHLIGHT_COLOR = [1.0, 0.88, 0.65];

// ── MONSTER PATROL ────────────────────────────────────────────────────────────
const PATROL_WP = [
  [0, 1.0, 18], [-5, 1.0, 6], [5, 1.0, 6],
  [-5, 1.0, -4], [5, 1.0, -4], [0, 1.0, -19],
];

// ── TEXTURES ─────────────────────────────────────────────────────────────────
const textures = {
  floor: new Texture((ctx,w,h) => {
    ctx.fillStyle='#6f6f6f'; ctx.fillRect(0,0,w,h);
    for(let y=0;y<8;y++) for(let x=0;x<8;x++){
      ctx.fillStyle=(x+y)%2===0?'#878787':'#5d5d5d';
      ctx.fillRect(x*16,y*16,16,16);
    }
  }),
  shelf: new Texture((ctx,w,h) => {
    ctx.fillStyle='#8b633f'; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#6b4729';
    for(let i=0;i<12;i++){ctx.beginPath();ctx.moveTo(0,i*10+(i%2?2:0));ctx.lineTo(w,i*10+6);ctx.stroke();}
  }),
  wall: new Texture((ctx,w,h) => {
    ctx.fillStyle='#55606c'; ctx.fillRect(0,0,w,h);
    for(let i=0;i<450;i++){const x=Math.random()*w,y=Math.random()*h,c=70+Math.random()*80;
      ctx.fillStyle=`rgba(${c},${c},${c},0.2)`;ctx.fillRect(x,y,3,3);}
  }),
  concrete: new Texture((ctx,w,h) => {
    ctx.fillStyle='#6e6a60'; ctx.fillRect(0,0,w,h);
    for(let i=0;i<700;i++){const x=Math.random()*w,y=Math.random()*h,c=Math.floor(80+Math.random()*55);
      ctx.fillStyle=`rgba(${c},${c-5},${c-12},0.28)`;ctx.fillRect(x,y,2+Math.random()*3,2+Math.random()*3);}
    ctx.strokeStyle='rgba(40,36,30,0.35)';ctx.lineWidth=1;
    for(let i=0;i<10;i++){ctx.beginPath();ctx.moveTo(Math.random()*w,Math.random()*h);ctx.lineTo(Math.random()*w,Math.random()*h);ctx.stroke();}
  }),
  freezer: new Texture((ctx,w,h) => {
    ctx.fillStyle='#cdd1ce'; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#9aada3'; ctx.lineWidth=2; ctx.strokeRect(6,6,w-12,h-12);
    ctx.lineWidth=1; ctx.strokeRect(6,h*0.48,w-12,h*0.04);
    ctx.fillStyle='rgba(180,210,200,0.3)'; ctx.fillRect(10,10,w-20,h*0.44);
  }),
  monster: new Texture((ctx,w,h) => {
    ctx.fillStyle='#4f6f54'; ctx.fillRect(0,0,w,h);
    for(let i=0;i<160;i++){const x=Math.random()*w,y=Math.random()*h;
      ctx.fillStyle=i%3===0?'#a53333':'#38553f';ctx.fillRect(x,y,6,6);}
  }),
  checkout: new Texture((ctx,w,h) => {
    ctx.fillStyle='#353535'; ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#777';ctx.fillRect(0,h*0.35,w,10);ctx.fillRect(0,h*0.65,w,10);
  }),
  door: new Texture((ctx,w,h) => {
    ctx.fillStyle='#40472e'; ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#a8b377'; ctx.fillRect(w*0.75,h*0.45,10,10);
  }),
  ceiling: new Texture((ctx,w,h) => {
    ctx.fillStyle='#383838'; ctx.fillRect(0,0,w,h);
    for(let i=0;i<220;i++){const x=Math.random()*w,y=Math.random()*h,c=45+Math.floor(Math.random()*30);
      ctx.fillStyle=`rgba(${c},${c},${c},0.35)`;ctx.fillRect(x,y,4,4);}
  }),
  ceilingLight: new Texture((ctx,w,h) => {
    ctx.fillStyle='#b8dfb0'; ctx.fillRect(0,0,w,h);
    ctx.fillStyle='rgba(240,255,220,0.85)'; ctx.fillRect(6,6,w-12,h-12);
    ctx.strokeStyle='#7aaa72'; ctx.lineWidth=2; ctx.strokeRect(4,4,w-8,h-8);
  }),
  deadFixture: new Texture((ctx,w,h) => {
    ctx.fillStyle='#252520'; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#3a3a35'; ctx.lineWidth=2; ctx.strokeRect(4,4,w-8,h-8);
    for(let i=0;i<6;i++){const rx=8+Math.random()*(w-24),ry=8+Math.random()*(h-24);
      ctx.fillStyle='rgba(5,3,0,0.7)';ctx.fillRect(rx,ry,14+Math.random()*10,5+Math.random()*5);}
  }),
  exitLight: new Texture((ctx,w,h) => {
    ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,w,h);
  }),
};

const materials = {
  floor:       new Material(textures.floor,       0.28, 0.25,  8),
  shelf:       new Material(textures.shelf,       0.25, 0.40, 16),
  wall:        new Material(textures.wall,        0.20, 0.35, 12),
  concrete:    new Material(textures.concrete,    0.18, 0.30,  8),
  freezer:     new Material(textures.freezer,     0.26, 0.50, 20),
  monster:     new Material(textures.monster,     0.20, 0.70, 20),
  checkout:    new Material(textures.checkout,    0.22, 0.45, 14),
  door:        new Material(textures.door,        0.24, 0.45, 18),
  ceiling:     new Material(textures.ceiling,     0.15, 0.08,  4),
  ceilingLight:new Material(textures.ceilingLight,0.95, 0.15,  4),
  deadFixture: new Material(textures.deadFixture, 0.12, 0.05,  4),
  exitLight:   new Material(textures.exitLight,   10.0, 0.0,   1),
};

const entities = [];
const colliders = [];
function addEntity(opts) {
  const e = new Entity({ mesh: cubeMesh, ...opts });
  entities.push(e);
  if (e.solid) colliders.push(e);
  return e;
}

function makeItemTexture(name, bandColor) {
  return new Texture((ctx,w,h) => {
    ctx.fillStyle='#e8e4d4'; ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#1a1a2e'; ctx.fillRect(0,0,w,22);
    ctx.fillStyle=bandColor; ctx.fillRect(8,34,w-16,30);
    ctx.fillStyle='#111'; ctx.font='bold 12px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(name.toUpperCase(), w/2, 49);
    ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    ctx.fillStyle='#bbb'; ctx.font='9px sans-serif';
    ctx.fillText('HAUNTED GROCERY', 10, 14);
  });
}

// ── STRUCTURAL ────────────────────────────────────────────────────────────────
addEntity({ name:'floor',   type:'floor',   material:materials.floor,   position:[0,-0.6,-4],  scale:[54,1,60] });
addEntity({ name:'ceiling', type:'ceiling', material:materials.ceiling, position:[0,3.55,-4],  scale:[54,0.5,60] });

addEntity({ name:'wall-south-left',   type:'wall', material:materials.wall, position:[-14.45, 1.4, 26], scale:[25.1, 4, 1], solid:true });
addEntity({ name:'wall-south-right',  type:'wall', material:materials.wall, position:[ 14.45, 1.4, 26], scale:[25.1, 4, 1], solid:true });
addEntity({ name:'wall-south-top',    type:'wall', material:materials.wall, position:[0, 3.3, 26],      scale:[3.8, 0.2, 1], solid:true });
addEntity({ name:'wall-south-bottom', type:'wall', material:materials.wall, position:[0, -0.3, 26],     scale:[3.8, 0.6, 1], solid:true });

addEntity({ name:'wall-west',    type:'wall', material:materials.wall, position:[-26,1.4,0],      scale:[1,4,54],    solid:true });
addEntity({ name:'wall-east',    type:'wall', material:materials.wall, position:[26,1.4,0],       scale:[1,4,54],    solid:true });
addEntity({ name:'wall-north-w', type:'wall', material:materials.wall, position:[-14.25,1.4,-26], scale:[23.5,4,1],  solid:true });
addEntity({ name:'wall-north-e', type:'wall', material:materials.wall, position:[14.25,1.4,-26],  scale:[23.5,4,1],  solid:true });

addEntity({ name:'storage-north', type:'storage', material:materials.concrete, position:[0,1.4,-34],  scale:[16,4,1], solid:true });
addEntity({ name:'storage-west',  type:'storage', material:materials.concrete, position:[-8,1.4,-30], scale:[1,4,8],  solid:true });
addEntity({ name:'storage-east',  type:'storage', material:materials.concrete, position:[8,1.4,-30],  scale:[1,4,8],  solid:true });

addEntity({ name:'checkout', type:'checkout', material:materials.checkout, position:[0,0.6,-18], scale:[12,2.2,2], solid:true });

const door = addEntity({ name:'exit-door', type:'door', material:materials.door, position:[0,1.6,25.3], scale:[3.8,3.2,0.5], solid:true });

// ── OUTSIDE EXIT (THE WHITE VOID) ─────────────────────────────────────────────
// FIXED Z-FIGHTING: Pushed to 33.5 so the tunnel starts exactly at 26.5 where the wall ends
addEntity({ name:'exit-tunnel-back',  type:'wall', material:materials.exitLight, position:[0, 2, 40.0],  scale:[12, 6, 1],  solid:false });
addEntity({ name:'exit-tunnel-left',  type:'wall', material:materials.exitLight, position:[-5.5, 2, 33.5], scale:[1, 6, 14], solid:false });
addEntity({ name:'exit-tunnel-right', type:'wall', material:materials.exitLight, position:[5.5, 2, 33.5], scale:[1, 6, 14], solid:false });
addEntity({ name:'exit-tunnel-floor', type:'floor', material:materials.exitLight, position:[0, -0.5, 33.5], scale:[12, 1, 14], solid:false });
addEntity({ name:'exit-tunnel-ceil',  type:'ceiling', material:materials.exitLight, position:[0, 4.5, 33.5], scale:[12, 1, 14], solid:false });

// ── CEILING FIXTURES ──────────────────────────────────────────────────────────
addEntity({ name:'fixture-0', type:'fixture', material:materials.ceilingLight, position:[-5,  3.3,  15], scale:[3.5,0.15,0.7] });
addEntity({ name:'fixture-1', type:'fixture', material:materials.ceilingLight, position:[ 0,  3.3,   0], scale:[3.5,0.15,0.7] });
addEntity({ name:'fixture-2', type:'fixture', material:materials.ceilingLight, position:[ 5,  3.3, -15], scale:[3.5,0.15,0.7] });
addEntity({ name:'fixture-3', type:'fixture', material:materials.deadFixture,  position:[ 5,  3.3,  15], scale:[3.5,0.15,0.7] });
addEntity({ name:'fixture-4', type:'fixture', material:materials.deadFixture,  position:[-5,  3.3,   0], scale:[3.5,0.15,0.7] });
addEntity({ name:'fixture-5', type:'fixture', material:materials.deadFixture,  position:[ 0,  3.3, -20], scale:[3.5,0.15,0.7] });

// ── MAIN AISLES ───────────────────────────────────────────────────────────────
for (const side of [-1,1]) {
  const sx = side*9, tag = side<0?'left':'right';
  addEntity({ name:`shelf-${tag}-south`, type:'shelf', material:materials.shelf, position:[sx,0.8, 12], scale:[1.6,2.2,8], solid:true });
  addEntity({ name:`shelf-${tag}-mid`,   type:'shelf', material:materials.shelf, position:[sx,0.8,  1], scale:[1.6,2.2,8], solid:true });
  addEntity({ name:`shelf-${tag}-north`, type:'shelf', material:materials.shelf, position:[sx,0.8,-11], scale:[1.6,2.2,8], solid:true });
}

addEntity({ name:'endcap-left-south',  type:'shelf', material:materials.shelf, position:[-9,0.6, 17], scale:[2.5,1.8,1], solid:true });
addEntity({ name:'endcap-right-south', type:'shelf', material:materials.shelf, position:[ 9,0.6, 17], scale:[2.5,1.8,1], solid:true });
addEntity({ name:'endcap-left-north',  type:'shelf', material:materials.shelf, position:[-9,0.6,-16], scale:[2.5,1.8,1], solid:true });
addEntity({ name:'endcap-right-north', type:'shelf', material:materials.shelf, position:[ 9,0.6,-16], scale:[2.5,1.8,1], solid:true });

addEntity({ name:'freezer-1', type:'freezer', material:materials.freezer, position:[24,0.3, -3], scale:[3,1.2,6], solid:true });
addEntity({ name:'freezer-2', type:'freezer', material:materials.freezer, position:[24,0.3,-13], scale:[3,1.2,6], solid:true });

addEntity({ name:'fallen-1', type:'shelf', material:materials.shelf, position:[-4,0.8,-29], scale:[1.6,2.2,5], rotationY: 0.35, rotationZ:Math.PI/2, solid:true });
addEntity({ name:'fallen-2', type:'shelf', material:materials.shelf, position:[ 4,0.8,-29], scale:[1.6,2.2,5], rotationY:-0.30, rotationZ:Math.PI/2, solid:true });

// ── ITEMS ─────────────────────────────────────────────────────────────────────
const requiredItemDefs = [
  { name:'Milk',      pos:[-7.5,1.4, 12], color:'#2196F3' },
  { name:'Cereal',    pos:[ 7.5,1.4, 12], color:'#FF9800' },
  { name:'Bread',     pos:[-7.5,1.4,  2], color:'#795548' },
  { name:'Batteries', pos:[ 7.5,1.4,  2], color:'#9C27B0' },
  { name:'Soap',      pos:[-7.5,1.4,-11], color:'#4CAF50' },
  { name:'Coffee',    pos:[ 7.5,1.4,-11], color:'#607D8B' },
  { name:'Can Soup',  pos:[ 0,  1.4,-28],  color:'#F44336'},
  { name:'Bandages',  pos:[21,  1.4, -3], color:'#E91E63' },
];
const decoyItemDefs = [
  { name:'Chips',       pos:[-7.5,1.4, 6.5], color:'#FFD600' },
  { name:'Candy',       pos:[ 7.5,1.4, 6.5], color:'#00BCD4' },
  { name:'Juice',       pos:[-7.5,1.4,  -5], color:'#8BC34A' },
  { name:'Crackers',    pos:[ 7.5,1.4,  -5], color:'#FF5722' },
  { name:'Frozen Peas', pos:[21,  1.4, -13], color:'#03A9F4' },
  { name:'Soda',        pos:[-6,  1.4, -32], color:'#673AB7' },
];
for (const item of requiredItemDefs) {
  addEntity({ name:item.name, type:'item', material:new Material(makeItemTexture(item.name,item.color),0.3,0.55,28),
              position:item.pos, scale:[0.7,0.7,0.7], pickable:true, isRequired:true });
}
for (const item of decoyItemDefs) {
  addEntity({ name:item.name, type:'item', material:new Material(makeItemTexture(item.name,item.color),0.3,0.55,28),
              position:item.pos, scale:[0.7,0.7,0.7], pickable:true, isRequired:false });
}

// ── MONSTER ───────────────────────────────────────────────────────────────────
const monster = addEntity({ name:'monster', type:'monster', material:materials.monster,
                            position:[0,1.0,-2], scale:[1.6,2.4,1.6], solid:true });

// ── PLAYER STATE ──────────────────────────────────────────────────────────────
const GRAVITY=16, JUMP_VEL=6.5, GROUND_Y=1.0;
const player = {
  position:[0,GROUND_Y,22], velocity:[0,0,0], yaw:Math.PI, pitch:0,
  radius:0.42, speed:5.5, turnSpeed:2.2, flashlightOn:true, velY:0, isGrounded:true,
};
const input = { w:false, a:false, s:false, d:false, arrowleft:false, arrowright:false, ' ':false };
let gameStarted = false;

// ── GAME STATE ────────────────────────────────────────────────────────────────
let doorOpened=false, doorOpening=false, doorAngle=0;
let flickerUntil=0, scareCenter=false, scareCrossAisle=false, scareStorage=false;
let gameOver=false, victory=false;
let monsterStuckTime=0, monsterSideBias=1, patrolIndex=0;
let bobPhase=0;
let startTime=performance.now(), lastTime=startTime;

// ── HUD ───────────────────────────────────────────────────────────────────────
function updateListUI() {
  hudList.innerHTML='';
  const required = entities.filter(e=>e.pickable&&e.isRequired);
  const decoys   = entities.filter(e=>e.pickable&&!e.isRequired&&e.collected);
  for (const item of required) {
    const li=document.createElement('li');
    li.textContent=item.name;
    if(item.collected) li.classList.add('done');
    hudList.appendChild(li);
  }
  if (decoys.length>0) {
    const hdr=document.createElement('li');
    hdr.textContent='Extra (not needed):';
    hdr.style.cssText='margin-top:8px;font-size:0.72em;color:#777;list-style:none;border-top:1px solid #333;padding-top:5px;';
    hudList.appendChild(hdr);
    for (const item of decoys) {
      const li=document.createElement('li');
      li.textContent=item.name;
      li.style.cssText='color:#666;font-size:0.8em;text-decoration:line-through;';
      hudList.appendChild(li);
    }
  }
}
function setStatus(t) { statusLabel.textContent=t; }
function allItemsCollected() {
  return entities.filter(e=>e.pickable&&e.isRequired).every(e=>e.collected);
}

// ── COLLISION ─────────────────────────────────────────────────────────────────
function playerCollides(pos, pad=player.radius) {
  const pyBot = pos[1] - 0.3;   // slightly below feet
  const pyTop = pos[1] + 1.8;   // head height
  for (const c of colliders) {
    if (c===monster || (c===door&&doorOpened)) continue;
    const a=c.aabb();
    if (pyTop <= a.min[1] || pyBot >= a.max[1]) continue;  // no vertical overlap
    const cx=Math.max(a.min[0],Math.min(pos[0],a.max[0]));
    const cz=Math.max(a.min[2],Math.min(pos[2],a.max[2]));
    const dx=pos[0]-cx, dz=pos[2]-cz;
    if (dx*dx+dz*dz<pad*pad) return true;
  }
  return false;
}
function monsterHits(pos) {
  for (const c of colliders) {
    if (c===monster || (c===door&&doorOpened)) continue;
    const a=c.aabb();
    if (pos[0]>a.min[0]-0.85&&pos[0]<a.max[0]+0.85&&
        pos[2]>a.min[2]-0.85&&pos[2]<a.max[2]+0.85&&
        pos[1]>a.min[1]-0.8 &&pos[1]<a.max[1]+0.8) return true;
  }
  return false;
}

// ── MOVEMENT ──────────────────────────────────────────────────────────────────
function movePlayer(dt) {
  if (input.arrowleft)  player.yaw += player.turnSpeed*dt;
  if (input.arrowright) player.yaw -= player.turnSpeed*dt;

  if (player.isGrounded && input[' ']) { player.velY=JUMP_VEL; player.isGrounded=false; }
  if (!player.isGrounded) {
    player.position[1]+=player.velY*dt; player.velY-=GRAVITY*dt;
    if (player.position[1]<=GROUND_Y) { player.position[1]=GROUND_Y; player.isGrounded=true; player.velY=0; }
  }

  const fwd=[Math.sin(player.yaw),0,Math.cos(player.yaw)];
  const rgt=[-Math.cos(player.yaw),0,Math.sin(player.yaw)];
  let wish=[0,0,0];
  if(input.w) wish=Vec3.add(wish,fwd);
  if(input.s) wish=Vec3.sub(wish,fwd);
  if(input.a) wish=Vec3.sub(wish,rgt);
  if(input.d) wish=Vec3.add(wish,rgt);
  wish=Vec3.normalize(wish);

  const moving=input.w||input.s||input.a||input.d;
  if(moving&&player.isGrounded) bobPhase+=12*dt;

  const mv=Vec3.mul(wish,player.speed*dt);
  const nx=[player.position[0]+mv[0],player.position[1],player.position[2]];
  if(!playerCollides(nx)) player.position[0]=nx[0];
  const nz=[player.position[0],player.position[1],player.position[2]+mv[2]];
  if(!playerCollides(nz)) player.position[2]=nz[2];

  // Hard outer boundary
  player.position[0] = Math.max(-25.3, Math.min(25.3, player.position[0]));
  player.position[2] = Math.max(-33.3, Math.min(38.0, player.position[2]));
}

function moveMonster(dt) {
  const toPlayer=Vec3.sub(player.position,monster.position);
  const dist=Vec3.length(toPlayer);

  // Patrol when far; chase when close
  let targetPos;
  if (dist>16) {
    const wp=PATROL_WP[patrolIndex];
    const dx=wp[0]-monster.position[0], dz=wp[2]-monster.position[2];
    if (Math.hypot(dx,dz)<1.5) patrolIndex=(patrolIndex+1)%PATROL_WP.length;
    targetPos=wp;
  } else {
    targetPos=player.position;
  }

  const td=[targetPos[0]-monster.position[0], 0, targetPos[2]-monster.position[2]];
  const dir=Vec3.normalize(td);
  monster.rotationY=Math.atan2(dir[0],dir[2]);

  const speed=dist>16?1.8:dist>10?3.0:dist>5?3.8:4.5;
  const step=Vec3.mul(dir,speed*dt);
  const cand=[monster.position[0]+step[0],monster.position[1],monster.position[2]+step[2]];

  if (!monsterHits(cand)) {
    monster.position[0]=cand[0]; monster.position[2]=cand[2]; monsterStuckTime=0;
  } else {
    monsterStuckTime+=dt;
    if(monsterStuckTime>1.2){monsterSideBias=-monsterSideBias;monsterStuckTime=0;}
    const angles=[0.5*monsterSideBias,-0.5*monsterSideBias,1.05*monsterSideBias,-1.05*monsterSideBias,1.57,-1.57];
    for(const ang of angles){
      const c=Math.cos(ang),s=Math.sin(ang);
      const ad=[dir[0]*c-dir[2]*s,0,dir[0]*s+dir[2]*c];
      const alt=Vec3.add(monster.position,Vec3.mul(ad,speed*dt));
      alt[1]=monster.position[1];
      if(!monsterHits(alt)){monster.position[0]=alt[0];monster.position[2]=alt[2];break;}
    }
  }

  if(dist<1.4&&!gameOver&&!victory){
    gameOver=true;
    setStatus('The monster caught you. Press R to restart.');
    instructionsOverlay.classList.add('visible');
  }
}

// ── PICKUP ────────────────────────────────────────────────────────────────────
function getNearbyItem(range=3.5) {
  const fwd=[Math.sin(player.yaw),0,Math.cos(player.yaw)];
  let best=null, bestDist=range;
  for(const e of entities){
    if(!e.pickable||e.collected) continue;
    const dx=e.position[0]-player.position[0], dz=e.position[2]-player.position[2];
    const d=Math.hypot(dx,dz);
    if(d<bestDist){const dot=(dx/d)*fwd[0]+(dz/d)*fwd[2];if(dot>0.2){bestDist=d;best=e;}}
  }
  return best;
}

let pickupNotifTimer=0;
const pickupNotifEl=document.getElementById('pickupNotif');
function showPickupNotif(name){pickupNotifEl.textContent=`+ ${name}`;pickupNotifEl.classList.add('visible');pickupNotifTimer=1.6;}

function handlePickup(){
  if(gameOver||victory||!gameStarted) return;
  const best=getNearbyItem(3.5);
  if(best){
    best.collected=true; updateListUI(); showPickupNotif(best.name);
    if(best.isRequired) setStatus(allItemsCollected()?'All items found! Get to the exit.':'');
  }
}

// ── EVENTS ────────────────────────────────────────────────────────────────────
function resetGame(){
  player.position=[0,GROUND_Y,22]; player.yaw=Math.PI; player.pitch=0;
  player.velY=0; player.isGrounded=true; player.flashlightOn=true;
  monster.position=[0,1.0,-2];
  gameOver=false; victory=false;
  doorOpened=false; doorOpening=false; doorAngle=0;
  door.position[0]=0; door.position[1]=1.6; door.position[2]=25.3;
  door.rotationY=0; door.solid=true;
  if(!colliders.includes(door)) colliders.push(door);
  scareCenter=false; scareCrossAisle=false; scareStorage=false; flickerUntil=0;
  monsterStuckTime=0; monsterSideBias=1; patrolIndex=0; bobPhase=0;
  vignetteEl.style.boxShadow='';
  startTime=performance.now();
  setStatus('Collect the full list. Stay away from the monster.');
  entities.filter(e=>e.pickable).forEach(e=>{e.collected=false;});
  updateListUI();
  if(gameStarted) instructionsOverlay.classList.remove('visible');
}

function checkPickupPrompt(){
  if(gameOver||victory||!gameStarted){pickupPromptEl.textContent='';return;}
  const best=getNearbyItem(3.5);
  pickupPromptEl.textContent=best?`[E]  ${best.name}`:'';
}

function updateEvents(nowMs){
  const now=nowMs/1000, px=player.position[0], pz=player.position[2];

  if(Math.abs(px)<2.5&&Math.abs(pz)<2.5&&!scareCenter){
    scareCenter=true; flickerUntil=now+4.5; setStatus('Lights flicker... something is hunting you.');
  }
  if(pz>5&&pz<8&&!scareCrossAisle){
    scareCrossAisle=true; flickerUntil=now+3.5; setStatus('A shadow darts across the aisle...');
  }
  if(pz<-26&&!scareStorage){
    scareStorage=true; flickerUntil=now+5.0; setStatus('The storage room plunges into darkness...');
  }

  if(allItemsCollected()&&!doorOpened){
    doorOpened=true; doorOpening=true;
    door.solid=false;
    const idx=colliders.indexOf(door); if(idx>=0) colliders.splice(idx,1);
    setStatus('All items collected! Exit door is opening — reach the south wall!');
  }
  if(doorOpened&&pz>30.0&&Math.abs(px)<2.5&&!victory){
    victory=true; setStatus('You escaped! Press R to play again.');
    instructionsOverlay.classList.add('visible');
  }
}

function worldFlicker(nowMs){
  const t=nowMs/1000;
  return t<flickerUntil ? 0.35+0.65*Math.abs(Math.sin(t*19.0)) : 1.0;
}

const vignetteEl=document.getElementById('vignette');
function updateVignette(){
  const dx=player.position[0]-monster.position[0], dz=player.position[2]-monster.position[2];
  const dist=Math.hypot(dx,dz);
  const alpha=dist<9 ? Math.min(0.55,(9-dist)/(9-1.5)*0.55) : 0;
  vignetteEl.style.boxShadow=alpha>0.005?`inset 0 0 80px rgba(180,0,0,${alpha.toFixed(3)})`:'';
}

// ── INPUT ─────────────────────────────────────────────────────────────────────
function setupInput(){
  document.addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();
    if(k in input) input[k]=true;
    if(k==='arrowleft'||k==='arrowright'||k===' ') e.preventDefault();
    if(k==='e') handlePickup();
    if(k==='f'){player.flashlightOn=!player.flashlightOn;setStatus(player.flashlightOn?'Flashlight ON':'Flashlight OFF');}
    if(k==='r') resetGame();
  });
  document.addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(k in input)input[k]=false;});
  document.addEventListener('mousemove',e=>{
    if(document.pointerLockElement!==canvas) return;
    player.yaw-=e.movementX*0.002;
    player.pitch=Math.max(-1.2,Math.min(1.2,player.pitch-e.movementY*0.002));
  });
  canvas.addEventListener('click',()=>{if(gameStarted) canvas.requestPointerLock();});
  startBtn.addEventListener('click',()=>{
    gameStarted=true; instructionsOverlay.classList.remove('visible'); canvas.requestPointerLock();
  });
  document.addEventListener('pointerlockchange',()=>{
    if(document.pointerLockElement===canvas&&!gameOver&&!victory)
      instructionsOverlay.classList.remove('visible');
  });
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function resize(){
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const w=Math.floor(canvas.clientWidth*dpr), h=Math.floor(canvas.clientHeight*dpr);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
}

function draw(nowMs){
  resize();
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.02,0.03,0.035,1);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  shader.use();

  const proj=Mat4.perspective(72*DEG2RAD, canvas.width/canvas.height, 0.1, 100);
  const lookDir=[
    Math.sin(player.yaw)*Math.cos(player.pitch),
    Math.sin(player.pitch),
    Math.cos(player.yaw)*Math.cos(player.pitch),
  ];
  const moving=input.w||input.s||input.a||input.d;
  const bobOff=(moving&&player.isGrounded)?0.055*Math.sin(bobPhase):0;
  const eye=[player.position[0], player.position[1]+0.4+bobOff, player.position[2]];
  const view=Mat4.lookAt(eye, Vec3.add(eye,lookDir), [0,1,0]);

  gl.uniformMatrix4fv(shader.u('uView'),false,view);
  gl.uniformMatrix4fv(shader.u('uProj'),false,proj);
  gl.uniform3fv(shader.u('uCameraPos'),new Float32Array(eye));
  gl.uniform3fv(shader.u('uLightDir'),new Float32Array([0.5,-1.0,0.3]));
  gl.uniform1f(shader.u('uGlobalFlicker'),worldFlicker(nowMs));
  gl.uniform1f(shader.u('uTime'),nowMs/1000);

  const t=nowMs/1000, gf=worldFlicker(nowMs);
  const lPos=new Float32Array(12), lCol=new Float32Array(12), lOn=new Float32Array(4);
  for(let i=0;i<3;i++){
    const L=CEILING_LIGHTS[i];
    lPos[i*3]=L.pos[0]; lPos[i*3+1]=L.pos[1]; lPos[i*3+2]=L.pos[2];
    lCol[i*3]=L.color[0]; lCol[i*3+1]=L.color[1]; lCol[i*3+2]=L.color[2];
    lOn[i]=gf*(0.6+0.4*Math.abs(Math.sin(t*3.7+L.phase)))*0.5;
  }
  lPos[9]=eye[0]; lPos[10]=eye[1]; lPos[11]=eye[2];
  lCol[9]=FLASHLIGHT_COLOR[0]; lCol[10]=FLASHLIGHT_COLOR[1]; lCol[11]=FLASHLIGHT_COLOR[2];
  lOn[3]=player.flashlightOn?1.0:0.0;

  gl.uniform3fv(shader.u('uPointLightPos[0]'),lPos);
  gl.uniform3fv(shader.u('uPointLightColor[0]'),lCol);
  gl.uniform1fv(shader.u('uPointLightOn[0]'),lOn);

  for(const e of entities){
    if(e.pickable&&e.collected) continue;
    gl.uniformMatrix4fv(shader.u('uModel'),false,e.modelMatrix());
    gl.uniform1f(shader.u('uAmbient'),e.material.ambient);
    gl.uniform1f(shader.u('uSpecular'),e.material.specular);
    gl.uniform1f(shader.u('uShininess'),e.material.shininess);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,e.material.texture.handle);
    gl.uniform1i(shader.u('uTex'),0);
    e.mesh.draw(shader);
  }
}

function frame(nowMs){
  const dt=Math.min(0.033,(nowMs-lastTime)/1000);
  lastTime=nowMs;

  if(gameStarted&&!gameOver&&!victory){
    movePlayer(dt); moveMonster(dt); updateEvents(nowMs); updateVignette();
  }

  if(doorOpening&&doorAngle<Math.PI/2){
    doorAngle=Math.min(doorAngle+(Math.PI/2)/1.2*dt, Math.PI/2);
    door.position[0]=1.9*(1-Math.cos(doorAngle));
    door.position[2]=25.3-1.9*Math.sin(doorAngle);
    door.rotationY=doorAngle;
  }

  for(const e of entities) if(e.pickable&&!e.collected) e.rotationY+=dt*1.4;

  if(pickupNotifTimer>0){pickupNotifTimer-=dt;if(pickupNotifTimer<=0)pickupNotifEl.classList.remove('visible');}

  checkPickupPrompt();
  const elapsed=(nowMs-startTime)/1000;
  timerLabel.textContent=`Time Survived: ${elapsed.toFixed(1)}s`;

  draw(nowMs);
  requestAnimationFrame(frame);
}

setupInput();
resetGame();
requestAnimationFrame(frame);
