// Invoker's three orbs — Quas (ice), Wex (storm), Exort (fire).
// Palettes measured from the reference art: ball = inside the sphere, outer = the ring just outside it.
import * as THREE from 'three';
import { uTime, rng, ADDITIVE_BLEND } from './shared.js';

export const ORB_DEFS = [
  { key: 'quas', name: 'Quas', element: 'Ice',
    ramp:  ['#01317f', '#0469e1', '#22aefb', '#80eafd', '#defdfd'],
    outer: ['#00112e', '#001b45', '#01327a', '#0869d8', '#49c4fb'],
    flame: 0.35, fill: 0.0, cell: 2.5, mode: 0, crystals: 8, particles: 360, wave: 0.08, seed: 1.3, rag: 0.45,
    fire: { layers: 4, height: 0.3, strength: 0.9, speed: 0.35, freq: 3.2 } },
  { key: 'wex', name: 'Wex', element: 'Storm',
    ramp:  ['#270a67', '#5316bc', '#8f33f8', '#e47ffc', '#fbd7fd'],
    outer: ['#0f0a30', '#180b46', '#2b0f6e', '#5d1cbd', '#b751f3'],
    flame: 0.6, fill: 0.0, cell: 2.3, mode: 0, crystals: 8, particles: 400, wave: 0.12, seed: 4.7, rag: 0.6,
    fire: { layers: 5, height: 0.4, strength: 1.0, speed: 0.3, freq: 2.6 } },
  { key: 'exort', name: 'Exort', element: 'Fire',
    ramp:  ['#8e2404', '#ee4c02', '#fd8f0d', '#fdda48', '#fdfba7'],
    outer: ['#330d05', '#611a03', '#b03306', '#fb6705', '#feb224'],
    flame: 1.0, fill: 1.0, cell: 2.1, mode: 1, crystals: 5, particles: 520, wave: 0.2, seed: 8.1, rag: 1.0,
    fire: { layers: 6, height: 0.5, strength: 1.4, speed: 0.55, freq: 3.0 } },
];

const NOISE_CORE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){float f=0.0,a=0.5;for(int i=0;i<4;i++){f+=a*snoise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=0.5;}return f;}
float fbm3(vec3 p){float f=0.0,a=0.5;for(int i=0;i<3;i++){f+=a*snoise(p);p=p*2.07+vec3(4.1,2.3,8.7);a*=0.5;}return f;}
float spow(float x, float e){ return pow(max(x, 0.0), e); }
vec3 hash3(vec3 p){
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453123);
}
vec2 worley(vec3 p, float t){
  vec3 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 o = 0.5 + 0.42 * sin(t + 6.2831 * hash3(i + g));
    vec3 r = g + o - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return sqrt(vec2(d1, d2));
}
`;
const RAMPS = /* glsl */`
uniform vec3 c0, c1, c2, c3, c4;
uniform vec3 o0, o1, o2, o3, o4;
vec3 ramp5(vec3 a0, vec3 a1, vec3 a2, vec3 a3, vec3 a4, float x){
  x = clamp(x, 0.0, 1.0);
  vec3 a = mix(a0, a1, smoothstep(0.0, 0.25, x));
  a = mix(a, a2, smoothstep(0.25, 0.5, x));
  a = mix(a, a3, smoothstep(0.5, 0.75, x));
  return mix(a, a4, smoothstep(0.75, 1.0, x));
}
vec3 ramp(float x){ return ramp5(c0, c1, c2, c3, c4, x); }
vec3 rampO(float x){ return ramp5(o0, o1, o2, o3, o4, x); }
`;
const NOISE = NOISE_CORE + RAMPS;
const additive = { transparent: true, depthWrite: false, ...ADDITIVE_BLEND };

function palette(o) {
  if (!o._pal) {
    o._pal = {};
    o.ramp.forEach((hex, i) => { o._pal['c' + i] = { value: new THREE.Color(hex) }; });
    o.outer.forEach((hex, i) => { o._pal['o' + i] = { value: new THREE.Color(hex) }; });
  }
  return o._pal;
}

function coreShellMaterial(o, side, strength) {
  return new THREE.ShaderMaterial({
    ...additive, side,
    uniforms: { uTime, uSeed: { value: o.seed }, uSide: { value: strength }, uFill: { value: o.fill }, uCell: { value: o.cell }, ...palette(o) },
    vertexShader: /* glsl */`
      varying vec3 vObj; varying vec3 vN; varying vec3 vV;
      void main(){
        vObj = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: NOISE + /* glsl */`
      uniform float uTime, uSeed, uSide, uFill, uCell;
      varying vec3 vObj; varying vec3 vN; varying vec3 vV;
      void main(){
        vec3 p = normalize(vObj);
        float t = uTime * 0.16;
        float ang = t + p.y * 1.4;
        float s = sin(ang), c = cos(ang);
        vec3 q = vec3(c*p.x - s*p.z, p.y, s*p.x + c*p.z);
        vec3 w = q * 1.5 + uSeed;
        vec3 warp = vec3(fbm3(w + t), fbm3(w + vec3(5.2, 1.3, 2.8) - t), fbm3(w + vec3(9.1, 4.7, 7.3)));
        vec3 cp = q * uCell + warp * 0.55;
        vec2 F = worley(cp, uTime * 0.25);
        float edge = F.y - F.x;
        float crack = 1.0 - smoothstep(0.0, 0.11, edge);
        float bleed = exp(-edge * 10.0);
        vec2 Fs = worley(cp * 2.3 + 4.0, uTime * 0.35);
        float crack2 = 1.0 - smoothstep(0.0, 0.07, Fs.y - Fs.x);
        float mottle = spow(fbm3(w * 3.0 - warp) * 0.5 + 0.5, 1.4);
        vec3 nv = normalize(vN);
        float rho = clamp(length(nv.xy), 0.0, 1.0);
        float inner = exp(-rho * rho * 2.6);
        float fres = clamp(1.0 - abs(dot(nv, normalize(vV))), 0.0, 1.0);
        float e = 0.1 + mottle * 0.3 + uFill * 0.05;
        e += bleed * 0.14 * (0.5 + inner);
        e += inner * 0.2;
        e += spow(fres, 3.0) * 0.18;
        e = clamp(e, 0.0, 0.72);
        vec3 col = ramp(e) * 0.8;
        float glowCrack = crack + crack2 * 0.35;
        col += ramp(0.7 + 0.25 * inner) * glowCrack * (0.45 + 0.55 * inner);
        gl_FragColor = vec4(col * uSide, 1.0);
      }`,
  });
}

function ribbonMaterial(o, speed, opacity, seed, outer) {
  return new THREE.ShaderMaterial({
    ...additive, side: THREE.DoubleSide,
    uniforms: { uTime, uSpeed: { value: speed }, uOpacity: { value: opacity }, uSeed: { value: seed }, uRag: { value: o.rag }, uOuter: { value: outer ? 1 : 0 }, ...palette(o) },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: NOISE + /* glsl */`
      uniform float uTime, uSpeed, uOpacity, uSeed, uRag, uOuter;
      varying vec2 vUv;
      void main(){
        float a = clamp(vUv.x, 0.0, 1.0);
        float along = smoothstep(0.0, 0.22, a) * smoothstep(1.0, 0.72, a) * (0.6 + 0.4 * a);
        float x = abs(vUv.y - 0.5) * 2.0;
        float rag = snoise(vec3(a * 7.0 - uTime * uSpeed * 1.3, vUv.y * 2.0, uSeed + 9.0));
        float body = smoothstep(1.0, 0.45, x + rag * 0.4 * uRag);
        float core = exp(-x * x * 9.0);
        float streak = clamp(0.5 + 0.5 * snoise(vec3(a * 14.0 - uTime * uSpeed, vUv.y * 4.0, uSeed)), 0.0, 1.0);
        float fil = spow(1.0 - abs(snoise(vec3(a * 8.0 - uTime * uSpeed * 0.7, vUv.y * 2.6, uSeed + 3.0))), 8.0);
        float e = along * body * (0.3 + core * 0.55 + streak * 0.25 + fil * 0.35);
        vec3 col = mix(ramp(0.45 + e * 0.4), rampO(0.55 + e * 0.45), uOuter) * min(e * 2.2, 1.0);
        gl_FragColor = vec4(col * uOpacity, 1.0);
      }`,
  });
}

function haloMaterial(o) {
  return new THREE.ShaderMaterial({
    ...additive,
    uniforms: { uTime, uSeed: { value: o.seed }, uFlame: { value: o.flame }, uFill: { value: o.fill }, ...palette(o) },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: NOISE + /* glsl */`
      uniform float uTime, uSeed, uFlame, uFill;
      varying vec2 vUv;
      void main(){
        vec2 p = (vUv - 0.5) * 4.6; float r = length(p); vec2 dir = p / max(r, 1e-4);
        float d = r - 1.0;
        float outer = exp(-max(d, 0.0) * 3.2) * smoothstep(0.85, 1.0, r);
        vec3 col = rampO(0.6) * outer * 0.22;
        float disk = smoothstep(1.02, 0.85, r);
        float gr = spow(snoise(vec3(dir * 2.6, uTime * 0.25 + uSeed)) * 0.5 + 0.5, 3.0);
        col += ramp(0.55) * (exp(-r * 2.6) * (0.18 + 0.1 * uFill) + gr * exp(-r * 1.8) * 0.12) * disk;
        col += c4 * exp(-r * 6.0) * 0.35;
        float sw = max(d, 0.0) * 0.35 + uTime * 0.04;
        vec2 ps = mat2(cos(sw), -sin(sw), sin(sw), cos(sw)) * p;
        vec2 pd = ps / max(r, 1e-4);
        float n = fbm(vec3(ps * 1.6 - pd * uTime * 0.5, uTime * 0.15 + uSeed));
        float n2 = fbm(vec3(ps * 3.2 - pd * uTime * 0.85, uTime * 0.28 + uSeed + 7.0));
        float f = clamp(n * 0.55 + n2 * 0.3 + 0.5, 0.0, 1.0);
        float fall = exp(-max(d, 0.0) * 3.0) * smoothstep(0.92, 1.02, r);
        float tongue = smoothstep(0.42, 0.78, f);
        col += rampO(0.4 + tongue * fall * 0.55) * tongue * fall * uFlame * 0.6;
        float pulse = 1.0 + 0.12 * sin(uTime * 2.3 + uSeed * 5.0);
        float pin = exp(-r * 38.0) * 14.0;
        float core = exp(-r * 7.0);
        float rays = exp(-abs(p.x) * 90.0) * exp(-abs(p.y) * 6.0) + exp(-abs(p.y) * 90.0) * exp(-abs(p.x) * 6.0);
        vec2 q = mat2(0.7071, -0.7071, 0.7071, 0.7071) * p;
        rays += 0.4 * (exp(-abs(q.x) * 100.0) * exp(-abs(q.y) * 9.0) + exp(-abs(q.y) * 100.0) * exp(-abs(q.x) * 9.0));
        col += (vec3(1.0) * pin + c4 * core + c3 * rays * 0.8) * pulse;
        col *= smoothstep(2.3, 1.7, r);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

function fireShellMaterial(o, h) {
  const f = o.fire;
  return new THREE.ShaderMaterial({
    ...additive, side: THREE.FrontSide,
    uniforms: { uTime, uH: { value: h }, uHeight: { value: f.height }, uStrength: { value: f.strength },
      uSpeed: { value: f.speed }, uFreq: { value: f.freq }, uSeed: { value: o.seed }, ...palette(o) },
    vertexShader: NOISE_CORE + /* glsl */`
      uniform float uTime, uH, uHeight, uSeed;
      varying vec3 vDir; varying vec3 vN; varying float vR;
      void main(){
        vec3 dir = normalize(position);
        float breath = 0.5 + 0.5 * sin(uTime * 1.1 + uSeed);
        float bulge = snoise(dir * 1.7 + vec3(uTime * 0.22, uSeed, -uTime * 0.13)) * 0.5 + 0.5;
        float r = 1.0 + uH * uHeight * (0.7 + 0.3 * breath + 0.35 * bulge);
        vDir = dir; vR = r;
        vN = normalize(normalMatrix * dir);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(dir * r, 1.0);
      }`,
    fragmentShader: NOISE + /* glsl */`
      uniform float uTime, uH, uStrength, uSpeed, uFreq, uSeed;
      varying vec3 vDir; varying vec3 vN; varying float vR;
      float field(vec3 d, float phase, float cycle){
        vec3 P = d * (uFreq + uH * 1.8 - phase * 1.4) + vec3(cycle * 7.13, cycle * 3.71, uSeed);
        return fbm3(P);
      }
      void main(){
        vec3 nv = normalize(vN);
        float rho = length(nv.xy) * vR;
        float mask = smoothstep(0.82, 1.0, rho);
        if (mask < 0.001) discard;
        float turb = snoise(vDir * 2.2 + vec3(uTime * 0.2, -uTime * 0.15, uSeed));
        float ang = uH * 0.35 + uTime * 0.07 + turb * 0.3;
        float s = sin(ang), c = cos(ang);
        vec3 d = vec3(c * vDir.x - s * vDir.z, vDir.y, s * vDir.x + c * vDir.z);
        float t = uTime * uSpeed;
        float ph1 = fract(t), ph2 = fract(t + 0.5);
        float n1 = field(d, ph1, floor(t));
        float n2 = field(d, ph2, floor(t + 0.5) + 0.5);
        float n = clamp(mix(n1, n2, abs(ph1 - 0.5) * 2.0) * 0.65 + 0.5, 0.0, 1.0);
        float breath = 0.5 + 0.5 * sin(uTime * 1.1 + uSeed);
        float flick = snoise(vec3(uTime * 2.1, uSeed, uH * 3.0)) * 0.035;
        float thr = mix(0.42, 0.72, uH) - breath * 0.05 + flick;
        float tongue = smoothstep(thr - 0.04, thr + 0.26, n);
        float e = tongue * spow(1.0 - uH, 1.1);
        vec3 col = rampO(0.4 + e * 0.6) * e * mask * uStrength;
        gl_FragColor = vec4(col * 0.8, 1.0);
      }`,
  });
}

function innerCloudMaterial(o, radius) {
  return new THREE.ShaderMaterial({
    ...additive, side: THREE.DoubleSide,
    uniforms: { uTime, uSeed: { value: o.seed }, uR: { value: radius }, uStrength: { value: 0.5 }, ...palette(o) },
    vertexShader: /* glsl */`
      varying vec3 vObj; varying vec3 vN; varying vec3 vV;
      void main(){
        vObj = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: NOISE + /* glsl */`
      uniform float uTime, uSeed, uR, uStrength;
      varying vec3 vObj; varying vec3 vN; varying vec3 vV;
      void main(){
        vec3 p = normalize(vObj);
        float t = uTime * (0.1 + (1.0 - uR) * 0.25);
        float dirn = uR > 0.6 ? -1.0 : 1.0;
        float ang = dirn * t + p.y * 2.0;
        float s = sin(ang), c = cos(ang);
        vec3 q = vec3(c*p.x - s*p.z, p.y, s*p.x + c*p.z);
        vec3 w = q * (1.8 + uR * 1.2) + uSeed + uR * 13.0;
        float warp = snoise(w * 0.7 + t);
        float n = fbm3(w + warp * 1.2) * 0.5 + 0.5;
        float cloud = smoothstep(0.35, 0.85, n);
        float wisp = spow(1.0 - abs(snoise(w * 1.8 + warp * 1.5 - t)), 6.0);
        float fres = clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
        float face = mix(1.0, 0.45, fres);
        float e = cloud * 0.45 + wisp * 0.35;
        vec3 col = ramp(0.25 + e * 0.45) * e * face * uStrength * (0.55 + 0.9 * (1.0 - uR));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

function particleMaterial(o, pr) {
  return new THREE.ShaderMaterial({
    ...additive,
    uniforms: { uTime, uMode: { value: o.mode }, uPR: { value: pr }, ...palette(o) },
    vertexShader: /* glsl */`
      attribute vec3 aDir; attribute vec4 aP;
      uniform float uTime, uMode, uPR;
      varying float vA; varying float vStar; varying float vTone;
      vec3 rotY(vec3 v, float a){ float s = sin(a), c = cos(a); return vec3(c*v.x - s*v.z, v.y, s*v.x + c*v.z); }
      void main(){
        vec3 pos; float life = 1.0;
        if (uMode < 0.5) {
          pos = rotY(aDir * aP.x, uTime * aP.y);
          pos.y += sin(uTime * 0.6 + aP.z * 6.283) * 0.06;
          vTone = 0.6 + fract(aP.z * 7.3) * 0.3;
          vStar = step(0.94, fract(aP.z * 13.7));
        } else {
          float f = fract(aP.z + uTime * aP.y * 0.22);
          pos = aDir * (0.95 + f * 1.5 * aP.x) + vec3(0.0, f * f * 0.7, 0.0);
          pos = rotY(pos, f * 0.9);
          life = sin(f * 3.14159);
          vTone = 0.95 - f * 0.4;
          vStar = 0.0;
        }
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        vA = life * (0.55 + 0.45 * sin(uTime * 3.0 + aP.z * 40.0));
        gl_PointSize = aP.w * (1.0 + vStar * 2.2) * uPR * (11.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: RAMPS + /* glsl */`
      varying float vA; varying float vStar; varying float vTone;
      void main(){
        vec2 p = gl_PointCoord * 2.0 - 1.0; float r = length(p);
        float d = exp(-r * r * 5.0);
        float star = exp(-abs(p.x) * 16.0) * exp(-abs(p.y) * 2.2) + exp(-abs(p.y) * 16.0) * exp(-abs(p.x) * 2.2);
        float I = mix(d, star + d * 0.7, vStar) * smoothstep(1.0, 0.7, r);
        gl_FragColor = vec4(rampO(vTone + d * 0.08) * I * vA * 1.3, 1.0);
      }`,
  });
}

function crystalMaterial(o) {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uCenter: { value: new THREE.Vector3() }, ...palette(o) },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: RAMPS + /* glsl */`
      uniform vec3 uCenter;
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){
        vec3 n = normalize(vN); vec3 L = normalize(uCenter - vW);
        float lit = max(dot(n, L), 0.0);
        float fres = pow(clamp(1.0 - abs(dot(n, vV)), 0.0, 1.0), 2.0);
        float spec = pow(max(dot(reflect(-L, n), vV), 0.0), 18.0);
        vec3 col = o2 * 0.5 + o3 * lit * 0.8 + o4 * fres * 0.6 + c3 * spec * 0.8;
        gl_FragColor = vec4(col, 0.5 + fres * 0.4);
      }`,
  });
}

function ribbonGeometry({ radius, arc, width, wave, waveFreq, phase, mode, segs = 160, rows = 8 }) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs, th = u * arc;
    const wob = wave * Math.sin(th * waveFreq + phase);
    for (let j = 0; j <= rows; j++) {
      const v = j / rows, off = (v - 0.5) * width;
      if (mode === 'lat') {
        const lat = off + wob;
        pos.push(radius * Math.cos(lat) * Math.cos(th), radius * Math.sin(lat), radius * Math.cos(lat) * Math.sin(th));
      } else {
        const r = radius + off;
        pos.push(r * Math.cos(th), wob * 0.6, r * Math.sin(th));
      }
      uv.push(u, v);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < rows; j++) {
    const a = i * (rows + 1) + j, b = a + rows + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function crystalGeometry(rand) {
  const g = new THREE.OctahedronGeometry(1, 0);
  const p = g.attributes.position;
  const sx = 0.04 + rand() * 0.03, sy = 0.09 + rand() * 0.09, sz = 0.025 + rand() * 0.025;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, p.getX(i) * sx * (0.8 + rand() * 0.4), p.getY(i) * sy * (0.85 + rand() * 0.3), p.getZ(i) * sz);
  }
  g.computeVertexNormals();
  return g;
}

const _q = new THREE.Quaternion();

// Returns { def, root, update(dt, camera) }. `root` is positioned/scaled by the caller.
export function createOrb(o, { mobile = false, pr = 1 } = {}) {
  const rand = rng(o.seed);
  const root = new THREE.Group();
  const spin = new THREE.Group();
  root.add(spin);

  const sphereGeo = new THREE.SphereGeometry(1, mobile ? 64 : 96, mobile ? 40 : 64);
  const back = new THREE.Mesh(sphereGeo, coreShellMaterial(o, THREE.BackSide, 0.25));
  const front = new THREE.Mesh(sphereGeo, coreShellMaterial(o, THREE.FrontSide, 1.0));
  back.renderOrder = 1; front.renderOrder = 2;
  spin.add(back, front);

  const innerGeo = new THREE.SphereGeometry(1, 48, 32);
  for (const r of (mobile ? [0.5] : [0.38, 0.6, 0.82])) {
    const cloud = new THREE.Mesh(innerGeo, innerCloudMaterial(o, r));
    cloud.scale.setScalar(r); cloud.renderOrder = 1;
    spin.add(cloud);
  }

  const fireLayers = mobile ? Math.ceil(o.fire.layers / 2) : o.fire.layers;
  const fireGeo = new THREE.SphereGeometry(1, 64, 40);
  for (let i = 0; i < fireLayers; i++) {
    const shell = new THREE.Mesh(fireGeo, fireShellMaterial(o, (i + 0.6) / fireLayers));
    shell.renderOrder = 2;
    spin.add(shell);
  }

  const ribbons = [];
  const addRibbon = (params, speed, opacity, tilt, outer) => {
    const pivot = new THREE.Group(); pivot.quaternion.copy(tilt);
    const mesh = new THREE.Mesh(ribbonGeometry(params), ribbonMaterial(o, 1 + rand() * 1.5, opacity, rand() * 20, outer));
    mesh.rotation.y = rand() * Math.PI * 2; mesh.renderOrder = 3;
    pivot.add(mesh); spin.add(pivot);
    ribbons.push({ mesh, speed });
  };
  const randomQuat = () => new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI));
  for (let i = 0; i < 5; i++) {
    addRibbon({ mode: 'lat', radius: 1.01 + rand() * 0.05, arc: 2.6 + rand() * 2.0, width: 0.16 + rand() * 0.26,
      wave: o.wave + rand() * 0.1, waveFreq: 2 + rand() * 3, phase: rand() * 6 }, 0.3 + rand() * 0.5, 0.9 + rand() * 0.3, randomQuat(), false);
  }
  for (let i = 0; i < 2; i++) {
    const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler((rand() - 0.5) * 0.9, rand() * Math.PI, (rand() - 0.5) * 0.9));
    addRibbon({ mode: 'rad', radius: 1.18 + rand() * 0.25, arc: 2.4 + rand() * 2.0, width: 0.08 + rand() * 0.12,
      wave: 0.1 + rand() * 0.15, waveFreq: 2 + rand() * 2, phase: rand() * 6 }, 0.25 + rand() * 0.35, 0.8, tilt, true);
  }

  const count = Math.round(o.particles * (mobile ? 0.45 : 1));
  const dirs = new Float32Array(count * 3), props = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3(rand() * 2 - 1, (rand() * 2 - 1) * 0.8, rand() * 2 - 1).normalize();
    dirs.set([v.x, v.y, v.z], i * 3);
    props.set(o.mode === 0
      ? [1.0 + Math.pow(rand(), 1.6) * 1.1, (rand() - 0.3) * 0.35, rand(), 1.4 + rand() * 2.2]
      : [0.4 + rand() * 0.8, 0.4 + rand() * 0.8, rand(), 1.2 + rand() * 2.2], i * 4);
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  pg.setAttribute('aDir', new THREE.BufferAttribute(dirs, 3));
  pg.setAttribute('aP', new THREE.BufferAttribute(props, 4));
  const points = new THREE.Points(pg, particleMaterial(o, pr));
  points.frustumCulled = false; points.renderOrder = 4;
  spin.add(points);

  const crystals = [];
  const cMat = crystalMaterial(o);
  const edgeMat = new THREE.LineBasicMaterial({ color: new THREE.Color(o.outer[4]), transparent: true, opacity: 0.5, depthWrite: false, ...ADDITIVE_BLEND });
  for (let i = 0; i < o.crystals; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.set((rand() - 0.5) * 1.2, rand() * Math.PI * 2, (rand() - 0.5) * 1.2);
    const geo = crystalGeometry(rand);
    const mesh = new THREE.Mesh(geo, cMat);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
    mesh.position.set(1.35 + rand() * 0.45, (rand() - 0.5) * 0.3, 0);
    mesh.rotation.set(rand() * 6, rand() * 6, rand() * 6);
    pivot.add(mesh); root.add(pivot);
    crystals.push({ pivot, mesh, orbit: (0.08 + rand() * 0.12) * (rand() < 0.5 ? -1 : 1), tumble: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.8) });
  }

  const halo = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), haloMaterial(o));
  halo.renderOrder = 5;
  root.add(halo);

  function update(dt, camera) {
    spin.rotation.y += dt * 0.12;
    spin.scale.setScalar(1 + 0.012 * Math.sin(uTime.value * 1.1 + o.seed));
    for (const r of ribbons) r.mesh.rotation.y -= r.speed * dt;
    for (const c of crystals) {
      c.pivot.rotation.y += c.orbit * dt;
      c.mesh.rotation.x += c.tumble.x * dt; c.mesh.rotation.y += c.tumble.y * dt; c.mesh.rotation.z += c.tumble.z * dt;
    }
    root.getWorldPosition(cMat.uniforms.uCenter.value);
    // billboard the halo in world space regardless of parent transforms
    root.getWorldQuaternion(_q).invert();
    halo.quaternion.copy(_q).multiply(camera.quaternion);
  }

  return { def: o, root, update };
}
