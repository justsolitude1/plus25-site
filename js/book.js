// The Astral Grimoire — open spellbook with PBR gold, procedural covers and glowing pages.
// Palette measured from the reference PNG. setOpen(0..1) swings the covers, fans the pages and releases the orbiting pieces.
import * as THREE from 'three';
import { uTime, rng, smooth, ADDITIVE_BLEND } from './shared.js';

export const M = {
  leather:   ['#221328', '#281a33', '#2f1e3a', '#3b2645', '#4d2e44', '#6f4766'],
  metal:     ['#532319', '#723727', '#994c26', '#c06628', '#de8839', '#f0af5e'],
  glow:      ['#fbca72', '#fcd882', '#fde891', '#fdf6ad', '#fdfce7'],
  gem:       ['#67172f', '#7d425b', '#9c5f7b'],
  parchment: ['#e19649', '#f3ba75', '#f8c276', '#fee29c'],
  ribbon:    ['#faa239', '#fdb42f', '#fef8bb'],
  haze:      ['#9f5e33', '#d49048', '#efbc71', '#f9d18d', '#fdf8db'],
  crystal:   ['#691e05', '#7c3612', '#de8839'],
};

export const H = 3.2, W = 2.3, T = 0.09, R = 0.42, D = 0.24;
const PHI = 0.56;                        // open: covers ~32° back from the camera plane
const PHI_CLOSED = Math.PI / 2 - 0.035;  // closed: boards parallel, spine toward the viewer

function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// Leather grain: one small tile of specks, repeated across each board. Painting every speck on the full
// boards was ~500k draw calls (~0.6 s of frozen page); the tile gives the same texture for a few % of that.
let grain = null;
function grainTile() {
  if (grain) return grain;
  const size = 256, g = (grain = makeCanvas(size, size)).getContext('2d'), rand = rng(71);
  for (let i = 0; i < (size * size) / 7; i++) {
    const dark = rand() < 0.6;
    g.fillStyle = dark ? M.leather[0] : M.leather[5];
    g.globalAlpha = dark ? 0.2 : 0.12;
    g.fillRect(rand() * size, rand() * size, 1 + rand() * 1.5, 1 + rand() * 1.5);
  }
  return grain;
}

// The painted canvases (covers, spine, page edges, loose pages) are the slow part of a book, so they are
// painted once per page and shared by every book (the hero's and the calculator's).
let paintedArt = null;

// ambient: add the book's own hemi/key/rim lights. hazeOn: the warm backdrop glow.
// lightScale: multiplies the gutter + emblem point lights (scale down when the book is small in a larger scene).
// extrasOn: the orbiting ribbons, loose pages, crystals and sparkles. glow: scales cover self-light and the glow planes.
export function createBook({ renderer, mobile = false, pr = 1, ambient = true, hazeOn = true, lightScale = 1, extrasOn = true, glow = 1 } = {}) {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const tex = (canvas, srgb) => {
    const t = new THREE.CanvasTexture(canvas);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  };

  /* ---------- painting ---------- */
  function paintLeather(ctx, w, h, rand) {
    ctx.fillStyle = M.leather[2]; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const x = rand() * w, y = rand() * h, r = 40 + rand() * 220;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, [M.leather[0], M.leather[1], M.leather[3], M.leather[4]][Math.floor(rand() * 4)]); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.16 + rand() * 0.14; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat');
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.18; ctx.strokeStyle = M.leather[4]; ctx.lineWidth = 1;
    for (let i = 0; i < 60; i++) {
      const x = rand() * w, y = rand() * h, a = rand() * Math.PI, l = 20 + rand() * 90;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,4,14,0.15)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  }

  // Raised gold inlay painted into color / bump / roughness-metalness / emissive layers at once
  class Engraver {
    constructor(w, h, seed) {
      this.w = w; this.h = h;
      this.colC = makeCanvas(w, h); this.bumpC = makeCanvas(w, h); this.mrC = makeCanvas(w, h); this.emC = makeCanvas(w, h);
      this.c = this.colC.getContext('2d'); this.b = this.bumpC.getContext('2d'); this.m = this.mrC.getContext('2d'); this.e = this.emC.getContext('2d');
      paintLeather(this.c, w, h, rng(seed));
      this.b.fillStyle = '#000'; this.b.fillRect(0, 0, w, h);
      this.m.fillStyle = 'rgb(0,205,0)'; this.m.fillRect(0, 0, w, h);
      // reference leather already contains its lighting → leather self-lights at ~0.45 (25% layer × intensity 1.8)
      this.e.drawImage(this.colC, 0, 0);
      this.e.fillStyle = 'rgba(0,0,0,0.75)'; this.e.fillRect(0, 0, w, h);
      const g = this.c.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, M.metal[3]); g.addColorStop(0.35, M.metal[5]); g.addColorStop(0.6, M.metal[4]); g.addColorStop(1, M.metal[2]);
      this.gold = g;
    }
    layers(color, height) {
      return [[this.c, color], [this.b, `rgba(255,255,255,${height})`], [this.m, 'rgb(0,84,255)'], [this.e, '#000']];
    }
    stroke(build, width, height = 1, color = this.gold) {
      this.c.save(); this.c.lineCap = 'round'; this.c.lineJoin = 'round'; this.c.strokeStyle = 'rgba(18,8,16,0.55)';
      this.c.lineWidth = width + 5; this.c.beginPath(); build(this.c); this.c.stroke(); this.c.restore();
      for (const [ctx, style] of this.layers(color, height)) {
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = style; ctx.lineWidth = width;
        ctx.beginPath(); build(ctx); ctx.stroke(); ctx.restore();
      }
    }
    fill(build, color, height = 1) {
      for (const [ctx, style] of this.layers(color, height)) {
        ctx.save(); ctx.fillStyle = style; ctx.beginPath(); build(ctx); ctx.fill(); ctx.restore();
      }
    }
    textures() {
      return { map: tex(this.colC, true), bumpMap: tex(this.bumpC, false), mrMap: tex(this.mrC, false), emissiveMap: tex(this.emC, true) };
    }
  }

  const drawFrame = (E) => {
    E.stroke((c) => c.rect(46, 46, E.w - 92, E.h - 92), 11);
    E.stroke((c) => c.rect(76, 76, E.w - 152, E.h - 152), 3, 0.6);
  };
  const starPoint = (E, cx, cy, a, len, base, half, inner) => {
    const tip = [cx + Math.cos(a) * len, cy + Math.sin(a) * len];
    const l = [cx + Math.cos(a - half) * base, cy + Math.sin(a - half) * base];
    const r = [cx + Math.cos(a + half) * base, cy + Math.sin(a + half) * base];
    const n = [cx + Math.cos(a) * inner, cy + Math.sin(a) * inner];
    E.fill((c) => { c.moveTo(...tip); c.lineTo(...l); c.lineTo(...n); c.closePath(); }, M.metal[5]);
    E.fill((c) => { c.moveTo(...tip); c.lineTo(...r); c.lineTo(...n); c.closePath(); }, M.metal[3], 0.85);
  };
  const cornerArcs = (E, rad) => {
    for (const [x, y, a0] of [[76, 76, 0], [E.w - 76, 76, Math.PI / 2], [E.w - 76, E.h - 76, Math.PI], [76, E.h - 76, -Math.PI / 2]]) {
      E.stroke((c) => c.arc(x, y, rad, a0, a0 + Math.PI / 2), 3, 0.6);
    }
  };

  function paintCompassCover() {
    const E = new Engraver(1024, 1424, 11);
    drawFrame(E);
    const cx = E.w / 2, cy = E.h / 2;
    const ring = (r, wd, hgt = 1) => E.stroke((c) => c.arc(cx, cy, r, 0, Math.PI * 2), wd, hgt);
    ring(350, 9); ring(326, 3, 0.55); ring(250, 8); ring(228, 3, 0.55); ring(122, 10); ring(98, 3, 0.55);
    E.stroke((c) => {
      for (let i = 0; i < 36; i++) {
        const a = i / 36 * Math.PI * 2, r1 = 126, r2 = i % 3 === 0 ? 322 : 228;
        c.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); c.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      }
    }, 2.2, 0.45);
    for (let i = 0; i < 8; i++) starPoint(E, cx, cy, (i + 0.5) / 8 * Math.PI * 2, 395, 345, 0.045, 355);
    for (let i = 0; i < 4; i++) starPoint(E, cx, cy, i * Math.PI / 2 - Math.PI / 2, 520, 150, 0.16, 70);
    for (let i = 0; i < 4; i++) starPoint(E, cx, cy, i * Math.PI / 2 - Math.PI / 4, 380, 130, 0.14, 70);
    cornerArcs(E, 170);
    const core = (ctx, stops, r) => {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      stops.forEach(([o, col]) => g.addColorStop(o, col));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    };
    core(E.c, [[0, '#fdfcd5'], [0.22, '#fdec66'], [0.55, M.metal[4]], [0.85, M.metal[3]], [1, M.metal[2]]], 96);
    core(E.e, [[0, '#ffffff'], [0.25, '#fdec66'], [0.6, 'rgba(222,136,57,0.55)'], [1, 'rgba(0,0,0,0)']], 110);
    E.m.fillStyle = 'rgb(0,110,0)'; E.m.beginPath(); E.m.arc(cx, cy, 90, 0, Math.PI * 2); E.m.fill();
    return E;
  }

  function paintAstrolabeCover() {
    const E = new Engraver(1024, 1424, 23);
    drawFrame(E);
    const cx = E.w / 2, cy = E.h / 2 + 20, rand = rng(5);
    E.stroke((c) => c.arc(cx, cy, 305, 0, Math.PI * 2), 8);
    E.stroke((c) => c.arc(cx, cy, 215, 0, Math.PI * 2), 5);
    E.stroke((c) => c.arc(cx, cy + 40, 150, 0, Math.PI * 2), 3, 0.6);
    E.stroke((c) => c.ellipse(cx, cy, 305, 250, 0, 0, Math.PI * 2), 3, 0.55);
    E.stroke((c) => { for (let i = 0; i < 90; i++) { const a = i / 90 * Math.PI * 2; c.moveTo(cx + Math.cos(a) * 280, cy + Math.sin(a) * 280); c.arc(cx + Math.cos(a) * 280, cy + Math.sin(a) * 280, 2.5, 0, Math.PI * 2); } }, 3, 0.5);
    E.stroke((c) => { c.moveTo(cx, cy - 470); c.lineTo(cx, cy + 520); }, 5);
    E.stroke((c) => c.arc(cx, cy - 500, 30, 0, Math.PI * 2), 5);
    E.stroke((c) => c.arc(cx, cy - 500, 11, 0, Math.PI * 2), 3);
    const vessel = (side) => (c) => {
      c.moveTo(cx, cy - 250); c.lineTo(cx + side * 12, cy - 230); c.lineTo(cx + side * 16, cy - 40);
      c.quadraticCurveTo(cx + side * 110, cy + 40, cx + side * 70, cy + 120); c.lineTo(cx, cy + 150); c.closePath();
    };
    E.fill(vessel(-1), M.metal[5]);
    E.fill(vessel(1), M.metal[3], 0.85);
    for (const s of [-1, 1]) {
      const x = cx + s * 305, y = cy;
      E.fill((c) => { c.moveTo(x - 70, y); c.lineTo(x, y - 22); c.lineTo(x + 70, y); c.closePath(); }, M.metal[5]);
      E.fill((c) => { c.moveTo(x - 70, y); c.lineTo(x, y + 22); c.lineTo(x + 70, y); c.closePath(); }, M.metal[3], 0.85);
    }
    E.stroke((c) => {
      for (let i = 0; i < 34; i++) {
        const a = rand() * Math.PI * 2, r = 60 + rand() * 220, l = 20 + rand() * 50, b = a + (rand() - 0.5) * 2;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        c.moveTo(x, y); c.lineTo(x + Math.cos(b) * l, y + Math.sin(b) * l);
      }
    }, 1.6, 0.35);
    cornerArcs(E, 190);
    return E;
  }

  const SPINE = { bands: [0.63, 0.08, -0.33, -0.39], motifs: [0.82, 0.3, -0.12, -0.6], bigGems: [0.45, -0.8], smallGems: [0.82, 0.3, -0.12] };
  function paintSpine() {
    const E = new Engraver(512, 1024, 37);
    const yOf = (yn) => (1 - (yn + 1) / 2) * 1024;
    for (const yn of SPINE.motifs) {
      const cy = yOf(yn), cx = 256;
      E.stroke((c) => {
        for (const s of [-1, 1]) {
          c.moveTo(cx, cy - 64);
          c.bezierCurveTo(cx + s * 16, cy - 30, cx + s * 110, cy - 46, cx + s * 96, cy + 4);
          c.moveTo(cx + s * 96 + 14, cy + 4); c.arc(cx + s * 96, cy + 4, 14, 0, Math.PI * 2);
          c.moveTo(cx, cy + 58);
          c.bezierCurveTo(cx + s * 20, cy + 30, cx + s * 70, cy + 50, cx + s * 64, cy + 18);
          c.moveTo(cx + s * 30, cy - 70); c.quadraticCurveTo(cx + s * 60, cy - 90, cx + s * 80, cy - 70);
        }
      }, 7);
      E.stroke((c) => { c.moveTo(cx, cy - 36); c.lineTo(cx + 22, cy); c.lineTo(cx, cy + 36); c.lineTo(cx - 22, cy); c.closePath(); }, 6);
    }
    return E;
  }

  function paintPageEdges() {
    const c = makeCanvas(512, 128), ctx = c.getContext('2d'), rand = rng(3);
    ctx.fillStyle = M.glow[1]; ctx.fillRect(0, 0, 512, 128);
    for (let y = 0; y < 128; y += 1 + Math.floor(rand() * 3)) {
      ctx.fillStyle = [M.glow[0], M.glow[2], M.glow[3], M.metal[5]][Math.floor(rand() * 4)];
      ctx.globalAlpha = 0.35 + rand() * 0.4; ctx.fillRect(0, y, 512, 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintLoosePage(seed) {
    const w = 512, h = 640, c = makeCanvas(w, h), ctx = c.getContext('2d'), rand = rng(seed);
    const g = ctx.createRadialGradient(w / 2, h / 2, 60, w / 2, h / 2, 420);
    g.addColorStop(0, M.parchment[3]); g.addColorStop(0.5, M.parchment[2]); g.addColorStop(0.85, M.parchment[1]); g.addColorStop(1, M.parchment[0]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { ctx.fillStyle = rand() < 0.5 ? M.parchment[0] : M.parchment[3]; ctx.globalAlpha = 0.12; ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 3, 1); }
    ctx.globalAlpha = 0.85; ctx.strokeStyle = '#b0622a'; ctx.lineCap = 'round';
    const cx = w / 2, cy = h / 2 - 10;
    for (const [r, lw] of [[170, 4], [150, 2], [96, 3], [44, 2]]) { ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI * 4 - Math.PI / 2; const x = cx + Math.cos(a) * 150, y = cy + Math.sin(a) * 150; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.moveTo(cx + Math.cos(a) * 44, cy + Math.sin(a) * 44); ctx.lineTo(cx + Math.cos(a) * 96, cy + Math.sin(a) * 96); }
    ctx.stroke();
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2, x = cx + Math.cos(a) * 205, y = cy + Math.sin(a) * 205;
      ctx.beginPath(); ctx.moveTo(x - 6, y - 8); ctx.lineTo(x + 5, y); ctx.lineTo(x - 5, y + 8); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return c;
  }

  /* ---------- materials ---------- */
  const goldMat = new THREE.MeshStandardMaterial({ color: '#eaa04a', metalness: 1, roughness: 0.3, envMapIntensity: 1.2 });
  const gemMat = new THREE.MeshPhysicalMaterial({ color: M.gem[0], roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, emissive: M.gem[0], emissiveIntensity: 0.45 });
  const gemBlueMat = new THREE.MeshPhysicalMaterial({ color: '#35246e', roughness: 0.08, clearcoat: 1, emissive: '#2a1a5c', emissiveIntensity: 0.4 });
  const leatherEdgeMat = new THREE.MeshStandardMaterial({ color: M.leather[1], emissive: M.leather[1], emissiveIntensity: 0.45, roughness: 0.75 });
  const leatherInnerMat = new THREE.MeshStandardMaterial({ color: M.leather[2], emissive: M.leather[2], emissiveIntensity: 0.45, roughness: 0.85 });
  const coverMaterial = (t) => new THREE.MeshStandardMaterial({
    map: t.map, bumpMap: t.bumpMap, bumpScale: 3.5, roughnessMap: t.mrMap, metalnessMap: t.mrMap, roughness: 1, metalness: 1,
    emissive: '#ffffff', emissiveMap: t.emissiveMap, emissiveIntensity: 1.8 * glow,
  });
  const art = paintedArt ??= {
    compass: paintCompassCover(), astro: paintAstrolabeCover(), spine: paintSpine(),
    edges: paintPageEdges(), pages: [paintLoosePage(1), paintLoosePage(2)],
  };
  const coverR = coverMaterial(art.compass.textures());
  const coverL = coverMaterial(art.astro.textures());
  const spineMat = coverMaterial(art.spine.textures());

  const edgeCanvas = art.edges;
  const edgeTop = tex(edgeCanvas, true);
  const edgeFore = tex(edgeCanvas, true); edgeFore.center.set(0.5, 0.5); edgeFore.rotation = Math.PI / 2;
  const pageEdgeMat = (t) => new THREE.MeshStandardMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.9, roughness: 0.9 });
  const pageTopMat = pageEdgeMat(edgeTop), pageForeMat = pageEdgeMat(edgeFore);
  const pagePlainMat = new THREE.MeshStandardMaterial({ color: M.glow[0], emissive: M.glow[0], emissiveIntensity: 0.4, roughness: 0.9 });

  function glowMaterial({ inner, outer, opacity = 1, additive = false, stretch = [1, 1], power = 2 }) {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, ...(additive ? ADDITIVE_BLEND : { blending: THREE.NormalBlending }),
      uniforms: { cIn: { value: new THREE.Color(inner) }, cOut: { value: new THREE.Color(outer) }, uOpacity: { value: opacity },
        uStretch: { value: new THREE.Vector2(...stretch) }, uPow: { value: power }, uAdd: { value: additive ? 1 : 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform vec3 cIn, cOut; uniform float uOpacity, uPow, uAdd; uniform vec2 uStretch; varying vec2 vUv;
        void main(){
          vec2 p = (vUv - 0.5) * 2.0 * uStretch;
          float a = pow(clamp(1.0 - length(p), 0.0, 1.0), uPow);
          vec3 col = mix(cOut, cIn, a);
          gl_FragColor = vec4(col * mix(1.0, a * uOpacity, uAdd), a * uOpacity);
        }`,
    });
  }

  /* ---------- hardware geometry ---------- */
  const cornerShape = new THREE.Shape();
  cornerShape.moveTo(-0.17, -0.17);
  cornerShape.quadraticCurveTo(0.22, -0.1, 0.76, 0.0);
  cornerShape.quadraticCurveTo(0.38, 0.08, 0.3, 0.3);
  cornerShape.quadraticCurveTo(0.08, 0.38, 0.0, 0.76);
  cornerShape.quadraticCurveTo(-0.1, 0.22, -0.17, -0.17);
  { const hole = new THREE.Path(); hole.moveTo(0.06, 0.06); hole.lineTo(0.31, 0.1); hole.lineTo(0.1, 0.31); hole.closePath(); cornerShape.holes.push(hole); }
  const cornerGeo = new THREE.ExtrudeGeometry(cornerShape, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.016, bevelSegments: 3, curveSegments: 18 });
  const studShape = new THREE.Shape();
  studShape.moveTo(0, 0.17); studShape.lineTo(0.075, 0); studShape.lineTo(0, -0.17); studShape.lineTo(-0.075, 0); studShape.closePath();
  const studGeo = new THREE.ExtrudeGeometry(studShape, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.012, bevelSegments: 2 });
  const gemGeo = new THREE.SphereGeometry(1, 24, 16);

  function addCoverHardware(parent, blueTopGem) {
    for (const c of [{ x: W, y: H / 2, sx: -1, sy: -1, s: 1 }, { x: W, y: -H / 2, sx: -1, sy: 1, s: 1 },
                     { x: 0.02, y: H / 2, sx: 1, sy: -1, s: 0.8 }, { x: 0.02, y: -H / 2, sx: 1, sy: 1, s: 0.8 }]) {
      const piece = new THREE.Mesh(cornerGeo, goldMat);
      piece.position.set(c.x, c.y, T - 0.006); piece.scale.set(c.sx * c.s, c.sy * c.s, 1);
      parent.add(piece);
      const gem = new THREE.Mesh(gemGeo, gemMat);
      gem.position.set(c.x + c.sx * c.s * 0.155, c.y + c.sy * c.s * 0.155, T + 0.03);
      gem.rotation.z = Math.atan2(c.sy, c.sx); gem.scale.set(0.075 * c.s, 0.036 * c.s, 0.028);
      parent.add(gem);
    }
    for (const s of [{ x: W / 2, y: H / 2 - 0.1, rz: 0, blue: blueTopGem }, { x: W / 2, y: -H / 2 + 0.1, rz: 0 },
                     { x: 0.14, y: 0, rz: Math.PI / 2 }, { x: W - 0.1, y: 0, rz: Math.PI / 2 }]) {
      const stud = new THREE.Mesh(studGeo, goldMat);
      stud.position.set(s.x, s.y, T - 0.004); stud.rotation.z = s.rz; parent.add(stud);
      const gem = new THREE.Mesh(gemGeo, s.blue ? gemBlueMat : gemMat);
      gem.position.set(s.x, s.y, T + 0.035); gem.rotation.z = s.rz; gem.scale.set(0.028, 0.06, 0.018); parent.add(gem);
    }
  }

  function buildHalf(coverMat, blueTopGem) {
    const g = new THREE.Group();
    const boardGeo = new THREE.BoxGeometry(W, H, T); boardGeo.translate(W / 2, 0, T / 2);
    g.add(new THREE.Mesh(boardGeo, [leatherEdgeMat, leatherEdgeMat, leatherEdgeMat, leatherEdgeMat, coverMat, leatherInnerMat]));
    const Wb = W * 0.95, Hb = H * 0.955;
    const blockGeo = new THREE.BoxGeometry(Wb, Hb, D); blockGeo.translate(0.05 + Wb / 2, 0, -D / 2 - 0.004);
    g.add(new THREE.Mesh(blockGeo, [pageForeMat, pagePlainMat, pageTopMat, pageTopMat, pagePlainMat, pagePlainMat]));
    addCoverHardware(g, blueTopGem);
    return g;
  }

  /* ---------- assemble ---------- */
  const root = new THREE.Group();
  const book = new THREE.Group();
  root.add(book);

  const hemi = new THREE.HemisphereLight('#6b5a9a', M.leather[0], 0.7);
  const key = new THREE.DirectionalLight('#ffe2b0', 2.2); key.position.set(-3, 4, 6);
  const rim = new THREE.DirectionalLight('#ffcf80', 1.6); rim.position.set(1, 2.5, -6);
  if (ambient) root.add(hemi, key, rim);
  const gutterLight = new THREE.PointLight('#ffc46a', 40, 0, 2); gutterLight.position.set(0, H / 2 + 0.25, -0.55);
  book.add(gutterLight);

  const rightHinge = new THREE.Group(); rightHinge.position.set(R, 0, 0);
  rightHinge.add(buildHalf(coverR, true));
  book.add(rightHinge);
  const leftMirror = new THREE.Group(); leftMirror.scale.x = -1;
  const leftHinge = new THREE.Group(); leftHinge.position.set(R, 0, 0);
  leftHinge.add(buildHalf(coverL, false));
  leftMirror.add(leftHinge);
  book.add(leftMirror);

  const emblemGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), glowMaterial({ inner: '#fdec66', outer: M.metal[4], opacity: 0.9, additive: true, power: 2.4 }));
  emblemGlow.position.set(W / 2, 0, T + 0.02);
  rightHinge.add(emblemGlow);
  const emblemLight = new THREE.PointLight('#ff9a3c', 5, 0, 2); emblemLight.position.set(W / 2, 0, T + 0.45);
  rightHinge.add(emblemLight);

  let topGlowMat;
  {
    const spine = new THREE.Group();
    spine.add(new THREE.Mesh(new THREE.CylinderGeometry(R, R, H + 0.04, 64, 1, true, -Math.PI / 2, Math.PI), spineMat));
    const bandGeo = new THREE.CylinderGeometry(R + 0.03, R + 0.03, 0.075, 64, 1, true, -Math.PI / 2, Math.PI);
    const lipGeo = new THREE.TorusGeometry(R + 0.03, 0.014, 8, 48, Math.PI);
    for (const yn of SPINE.bands) {
      const band = new THREE.Mesh(bandGeo, goldMat); band.position.y = yn * H / 2; spine.add(band);
      const lip = new THREE.Mesh(lipGeo, goldMat); lip.rotation.x = Math.PI / 2; lip.position.y = yn * H / 2 + 0.04; spine.add(lip);
    }
    const capGeo = new THREE.TorusGeometry(R + 0.005, 0.05, 12, 48, Math.PI);
    for (const yEnd of [H / 2 + 0.02, -H / 2 - 0.02]) {
      const cap = new THREE.Mesh(capGeo, goldMat); cap.rotation.x = Math.PI / 2; cap.position.y = yEnd; spine.add(cap);
    }
    topGlowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(M.glow[3]).multiplyScalar(2.2), side: THREE.DoubleSide });
    const topGlow = new THREE.Mesh(new THREE.CircleGeometry(R * 0.96, 40, 0, Math.PI), topGlowMat);
    topGlow.rotation.x = Math.PI / 2; topGlow.position.y = H / 2 + 0.015; spine.add(topGlow);
    const bezelGeo = new THREE.TorusGeometry(0.115, 0.026, 12, 36);
    for (const yn of SPINE.bigGems) {
      const y = yn * H / 2;
      const bezel = new THREE.Mesh(bezelGeo, goldMat); bezel.position.set(0, y, R + 0.012); spine.add(bezel);
      const gem = new THREE.Mesh(gemGeo, gemMat); gem.position.set(0, y, R + 0.02); gem.scale.set(0.098, 0.098, 0.06); spine.add(gem);
    }
    const octGeo = new THREE.OctahedronGeometry(1, 0);
    for (const yn of SPINE.smallGems) {
      const gem = new THREE.Mesh(octGeo, gemMat); gem.position.set(0, yn * H / 2, R + 0.012); gem.scale.set(0.03, 0.05, 0.02); spine.add(gem);
    }
    book.add(spine);
  }

  /* ---------- fanned pages ---------- */
  const PAGE_W = W * 0.94, PAGE_H = H * 0.95;
  const pageGeo = new THREE.PlaneGeometry(PAGE_W, PAGE_H, 32, 8); pageGeo.translate(PAGE_W / 2, 0, 0);
  const pageShared = {
    uTime, uOpen: { value: 1 }, uFlutterOn: { value: 1 }, uFade: { value: 1 },
    gA: { value: new THREE.Color(M.glow[0]) }, gB: { value: new THREE.Color(M.glow[2]) }, gC: { value: new THREE.Color(M.glow[4]) }, gEdge: { value: new THREE.Color(M.metal[5]) },
  };
  const pageMaterial = (bend, lift, flutter, phase) => new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { ...pageShared, uBend: { value: bend }, uLift: { value: lift }, uFlutter: { value: flutter }, uPhase: { value: phase } },
    vertexShader: `
      uniform float uTime, uBend, uLift, uFlutter, uPhase, uOpen, uFlutterOn;
      varying vec2 vUv;
      void main(){
        vUv = uv;
        vec3 p = position;
        float u = p.x / ${PAGE_W.toFixed(4)};
        float top = clamp(p.y / ${(PAGE_H / 2).toFixed(4)} * 0.5 + 0.5, 0.0, 1.0);
        float fl = sin(uTime * 1.3 + uPhase + u * 2.6) * uFlutter * uFlutterOn;
        p.z += (uBend + fl) * uOpen * sin(u * 3.14159 * 0.85);
        p.y += (uLift + fl * 0.6) * uOpen * u * u * top;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 gA, gB, gC, gEdge; uniform float uOpen, uFade; varying vec2 vUv;
      void main(){
        float glow = pow(1.0 - vUv.x, 1.6) * 0.55 + pow(vUv.y, 3.0) * 0.45;
        vec3 col = mix(gA, gB, smoothstep(0.0, 0.5, glow));
        col = mix(col, gC, smoothstep(0.45, 1.0, glow));
        col = mix(col, gEdge, smoothstep(0.82, 1.0, vUv.x) * 0.45);
        gl_FragColor = vec4(col * mix(0.55, 1.3, uOpen), uFade);
      }`,
  });
  const pages = [];
  {
    const group = new THREE.Group(); group.position.set(0, 0, -0.12);
    const rand = rng(17);
    const add = (psi, bend, lift, flutter) => {
      const m = new THREE.Mesh(pageGeo, pageMaterial(bend, lift, flutter, rand() * 6.28));
      group.add(m); pages.push({ m, psi });
    };
    for (let i = 0; i < 8; i++) {
      add(PHI + 0.08 + i * 0.035, 0.03 + rand() * 0.05, 0.04 + i * 0.03, 0.01);
      add(Math.PI - PHI - 0.08 - i * 0.035, -(0.03 + rand() * 0.05), 0.04 + i * 0.03, 0.01);
    }
    for (let i = 0; i < 8; i++) {
      const t = (i + 0.5) / 8;
      add(THREE.MathUtils.lerp(PHI + 0.42, Math.PI - PHI - 0.42, t), (t < 0.5 ? 1 : -1) * (0.18 + rand() * 0.2), 0.35 + rand() * 0.55, 0.05 + rand() * 0.05);
    }
    book.add(group);
  }

  const gutterGlowMat = glowMaterial({ inner: M.glow[4], outer: M.glow[0], opacity: 0.75, additive: true, stretch: [1, 1.2], power: 2.2 });
  const gutterGlow = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.6), gutterGlowMat);
  gutterGlow.position.set(0, H / 2 + 0.25, -0.6);
  book.add(gutterGlow);

  /* ---------- extras released when the book opens ---------- */
  const extras = new THREE.Group();
  root.add(extras);

  const hazeMat = glowMaterial({ inner: M.haze[3], outer: M.haze[1], opacity: 0.5, stretch: [1.0, 1.05], power: 1.6 });
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(13, 9), hazeMat);
  haze.position.set(0, 0.25, -2.4); haze.renderOrder = -1; haze.visible = hazeOn;
  root.add(haze);

  const ribbonMat = (core, seed) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime, uSeed: { value: seed }, uCore: { value: core ? 1 : 0 },
      cA: { value: new THREE.Color(M.ribbon[0]) }, cB: { value: new THREE.Color(M.ribbon[1]) }, cC: { value: new THREE.Color(M.ribbon[2]) } },
    vertexShader: `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      uniform float uTime, uSeed, uCore; uniform vec3 cA, cB, cC;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float s = fract(vUv.x * 2.0 - uTime * 0.07 + uSeed);
        float comet = smoothstep(0.0, 0.7, s) * smoothstep(1.0, 0.93, s);
        float I = 0.3 + 0.7 * comet;
        float soft = pow(abs(dot(normalize(vN), normalize(vV))), 1.5);
        vec3 col = mix(mix(cA, cB, I), cC, pow(I, 3.0) * mix(0.3, 1.0, uCore));
        float a = uCore > 0.5 ? I : I * soft * 0.28;
        gl_FragColor = vec4(col * mix(1.0, 1.7, uCore), a);
      }`,
  });
  const ribbons = [];
  for (const [ax, az, y0, tx, tz, seed] of [[3.0, 2.15, -0.45, -0.18, 0.1, 0.1], [3.45, 2.4, 0.55, 0.2, -0.14, 0.45], [2.7, 1.95, -1.15, 0.06, 0.2, 0.8]]) {
    const pts = [];
    for (let i = 0; i < 128; i++) { const a = i / 128 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * ax, y0 + Math.sin(a * 2) * 0.08, Math.sin(a) * az)); }
    const curve = new THREE.CatmullRomCurve3(pts, true);
    const grp = new THREE.Group(); grp.rotation.set(tx, 0, tz);
    grp.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 360, 0.011, 8, true), ribbonMat(true, seed)));
    grp.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 260, 0.07, 10, true), ribbonMat(false, seed)));
    extras.add(grp); ribbons.push(grp);
  }

  const loosePages = [];
  {
    const geo = new THREE.PlaneGeometry(0.95, 1.2, 14, 14);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      p.setZ(i, 0.14 * Math.sin((x / 0.95 + 0.5) * Math.PI) + 0.1 * (y / 0.6) * (y / 0.6) - 0.05 * x);
    }
    geo.computeVertexNormals();
    const texes = art.pages.map((c) => tex(c, true));
    const rand = rng(29), count = mobile ? 5 : 7;
    for (let i = 0; i < count; i++) {
      const t = texes[i % 2];
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.15, roughness: 0.85, side: THREE.DoubleSide }));
      m.scale.setScalar(0.6 + rand() * 0.3);
      extras.add(m);
      loosePages.push({ m, a0: i / count * Math.PI * 2 + rand() * 0.4, ax: 3.0 + rand() * 0.7, az: 2.0 + rand() * 0.5, y0: -1.0 + rand() * 2.6, sp: 0.07 + rand() * 0.05, ph: rand() * 6.28 });
    }
  }

  const crystals = [];
  {
    const mat = new THREE.MeshStandardMaterial({ color: M.crystal[2], roughness: 0.18, metalness: 0.35, emissive: M.metal[1], emissiveIntensity: 0.7, flatShading: true });
    const geo = new THREE.OctahedronGeometry(1, 0), rand = rng(41);
    for (let i = 0; i < 11; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.scale.set(0.05 + rand() * 0.04, 0.13 + rand() * 0.09, 0.05 + rand() * 0.04);
      extras.add(m);
      crystals.push({ m, a0: rand() * Math.PI * 2, r: 2.3 + rand() * 1.4, y0: -1.3 + rand() * 3.0, sp: (0.05 + rand() * 0.06) * (rand() < 0.5 ? -1 : 1), spin: new THREE.Vector3(rand(), rand(), rand()).multiplyScalar(1.2) });
    }
  }

  {
    const n = mobile ? 90 : 180, base = new Float32Array(n * 3), seedA = new Float32Array(n), rand = rng(53);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, r = 1.2 + rand() * 2.8;
      base.set([Math.cos(a) * r, -2 + rand() * 4.5, Math.sin(a) * r * 0.75], i * 3);
      seedA[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(base, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seedA, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime, uPR: { value: pr }, cA: { value: new THREE.Color(M.glow[0]) }, cB: { value: new THREE.Color(M.glow[4]) } },
      vertexShader: `
        attribute float aSeed; uniform float uTime, uPR; varying float vA; varying float vStar;
        void main(){
          vec3 p = position;
          p.y = mod(p.y + 2.0 + uTime * (0.08 + aSeed * 0.12), 4.5) - 2.0;
          p.x += sin(uTime * 0.5 + aSeed * 20.0) * 0.08;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vStar = step(0.9, aSeed);
          vA = (0.5 + 0.5 * sin(uTime * 2.5 + aSeed * 40.0)) * smoothstep(2.5, 1.8, abs(p.y - 0.25));
          gl_PointSize = (2.0 + aSeed * 2.5) * (1.0 + vStar * 2.0) * uPR * (10.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 cA, cB; varying float vA; varying float vStar;
        void main(){
          vec2 p = gl_PointCoord * 2.0 - 1.0; float r = length(p);
          float d = exp(-r * r * 5.0);
          float star = exp(-abs(p.x) * 14.0) * exp(-abs(p.y) * 2.0) + exp(-abs(p.y) * 14.0) * exp(-abs(p.x) * 2.0);
          float I = mix(d, star + d * 0.6, vStar) * smoothstep(1.0, 0.7, r);
          gl_FragColor = vec4(mix(cA, cB, d) * 1.4, I * vA);
        }`,
    });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false;
    extras.add(pts);
  }

  /* ---------- state ---------- */
  let open = 1, openEased = 1, fade = 1;
  function setOpen(v) {
    open = Math.min(1, Math.max(0, v));
    openEased = smooth(open);
    const phi = THREE.MathUtils.lerp(PHI_CLOSED, PHI, openEased);
    rightHinge.rotation.y = phi;
    leftHinge.rotation.y = phi;
    for (const pg of pages) pg.m.rotation.y = THREE.MathUtils.lerp(Math.PI / 2 + (pg.psi - Math.PI / 2) * 0.06, pg.psi, openEased);
    pageShared.uOpen.value = openEased;
    gutterGlowMat.uniforms.uOpacity.value = 0.75 * openEased * glow * fade;
    topGlowMat.color.set(M.glow[3]).multiplyScalar(0.4 + 1.8 * openEased);
    hazeMat.uniforms.uOpacity.value = 0.32 * openEased;
    const release = smooth((open - 0.35) / 0.65);          // pieces fly out once the covers are mostly open
    extras.scale.setScalar(Math.max(0.001, release));
    extras.visible = extrasOn && release > 0.005;
  }
  setOpen(1);

  function setFlutter(on) { pageShared.uFlutterOn.value = on ? 1 : 0; }

  const _q = new THREE.Quaternion();
  function update(dt, camera) {
    const t = uTime.value;
    emblemGlow.material.uniforms.uOpacity.value = (0.75 + 0.25 * Math.sin(t * 2.2)) * glow * fade;
    emblemLight.intensity = (4 + 1.5 * Math.sin(t * 2.2)) * lightScale * fade;
    gutterLight.intensity = (36 + 6 * Math.sin(t * 1.7)) * openEased * lightScale * fade;
    for (const r of ribbons) r.rotation.y += dt * 0.12;
    for (const p of loosePages) {
      const a = p.a0 + t * p.sp;
      p.m.position.set(Math.cos(a) * p.ax, p.y0 + Math.sin(t * 0.6 + p.ph) * 0.15, Math.sin(a) * p.az);
      p.m.rotation.set(Math.sin(t * 0.8 + p.ph) * 0.35 - 0.2, -a + Math.PI / 2 + Math.sin(t * 0.5 + p.ph) * 0.4, Math.cos(t * 0.7 + p.ph) * 0.3);
    }
    for (const c of crystals) {
      const a = c.a0 + t * c.sp;
      c.m.position.set(Math.cos(a) * c.r, c.y0 + Math.sin(t * 0.9 + c.a0) * 0.12, Math.sin(a) * c.r * 0.7);
      c.m.rotation.x += c.spin.x * dt * 0.4; c.m.rotation.y += c.spin.y * dt; c.m.rotation.z += c.spin.z * dt * 0.3;
    }
    // camera-facing glows, corrected for any parent rotation
    root.getWorldQuaternion(_q).invert();
    gutterGlow.quaternion.copy(_q).multiply(camera.quaternion);
    haze.quaternion.copy(_q).multiply(camera.quaternion);
  }

  // fade the book's own glow (pages, emblem, gutter, point lights); standard-material opacity is up to the caller
  function setFade(f) {
    fade = f;
    pageShared.uFade.value = f;
    gutterGlowMat.uniforms.uOpacity.value = 0.75 * openEased * glow * f;
  }

  return { root, book, setOpen, setFlutter, setFade, update, get open() { return open; } };
}
