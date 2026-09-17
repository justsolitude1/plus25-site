// The whole scroll story in one scene, driven by v ∈ [-1, 1]:
//   v ∈ [-1, 0)  hero: Invoker holds the grimoire, Quas, Wex and Exort circle him. As the hero scrolls away he
//                holds still on screen while the orbs leave his orbit one by one and come down into the resting
//                tableau; he fades back into the dark as they land.
//   v ∈ [0, 1]   the beats: the three orbs at rest, then Quas, Wex and Exort each in close-up.
// The canvas is transparent so the page's wordmark shows behind Invoker; glow is screened over the page.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createPost, createQuality, createFrameGate, PHONE_3D } from './post.js';
import { uTime, tickTime, rng, smooth, band } from './shared.js';
import { ORB_DEFS, createOrb } from './orbs.js';
import { createInvoker } from './cast.js';

// Beat map for v ≥ 0 (must match the story steps in index.html)
export const BEATS = { intro: 0.03, quas: 0.35, wex: 0.66, exort: 0.97 };

// Resting tableau — echoes the hero video: ice left, storm right, fire low and in front
const TABLEAU = [new THREE.Vector3(-2.7, 0.6, 0), new THREE.Vector3(2.7, 0.6, 0), new THREE.Vector3(0, -1.5, 1.2)];

// Invoker's feet: above and behind the tableau, so the camera sinks from him down to the orbs
const INVOKER_AT = new THREE.Vector3(0, 4.6, -3);
// In the hero the orbs circle his upper body on a tilted ring, passing in front of and behind him
const ORBIT = { center: [0, 3.0, 0], radius: 1.35, tiltX: 0.28, tiltZ: -0.12, speed: 0.45, scale: 0.2 };
const HERO_FOV = 30, STORY_FOV = 35;

// Hero framing, relative to Invoker's feet. Desktop: centred, head over the lower third of the wordmark,
// cut off by the bottom edge; squarer screens pull back so the ring fits. Portrait: whole, above the copy.
// The camera sits a little above his chest and looks down, so the book never rises over his face.
function heroFrame(aspect) {
  let pos, tgt;
  if (aspect < 0.85) { pos = [0, 1.65, 14.6]; tgt = [0, 0.9, 0]; }
  else { const k = Math.max(1, 1.3 / aspect); pos = [0, 3.35, 6.9 * k]; tgt = [0, 2.85 - (k - 1) * 0.6, 0]; }
  return { pos: new THREE.Vector3(...pos).add(INVOKER_AT), tgt: new THREE.Vector3(...tgt).add(INVOKER_AT) };
}

// Each close-up frames its orb off-center so the copy sits over open sky on the other side.
function cameraKeys(portrait) {
  const k = (p, pos, tgt) => ({ p, pos: new THREE.Vector3(...pos), tgt: new THREE.Vector3(...tgt) });
  if (portrait) {   // subject in the upper half, copy along the bottom
    return [
      k(BEATS.intro,  [0, 1.0, 24],      [0, -2.0, 0]),
      k(BEATS.quas,   [-2.5, 0.8, 11],   [-2.7, -1.0, 0]),
      k(BEATS.wex,    [2.5, 0.8, 11],    [2.7, -1.0, 0]),
      k(BEATS.exort,  [0, -0.6, 12],     [0, -3.1, 1.2]),
    ];
  }
  return [
    k(BEATS.intro,  [0, 0.5, 13],      [0, -1.0, 0]),     // tableau high; intro copy below
    k(BEATS.quas,   [-3.5, 1.0, 5.6],  [-4.0, 0.6, 0]),   // orb right of center, copy left
    k(BEATS.wex,    [3.5, 1.0, 5.6],   [4.0, 0.6, 0]),    // orb left of center, copy right
    k(BEATS.exort,  [0.9, -0.8, 7.0],  [1.3, -1.3, 1.2]), // orb left, copy right
  ];
}

export async function initInvokeScene({ canvas, reduced = false, mobile = false, debug = false }) {
  // dev aid (?debug): how long each setup step takes, logged once the scene is ready
  const t0 = performance.now(), timings = [];
  const mark = (label) => { if (debug) timings.push([label, Math.round(performance.now() - t0)]); };
  const pr = Math.min(devicePixelRatio, mobile ? PHONE_3D.pr : 1.5);   // starting budget; createQuality lowers it on slow devices
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !mobile, powerPreference: 'high-performance', preserveDrawingBuffer: debug });
  mark('renderer');
  // start loading Invoker straight away; the rest of the scene is built while his files download
  const invokerLoading = createInvoker({ renderer, mobile, pr });
  renderer.setPixelRatio(pr);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();   // no background: the hero panel, then the page's void, shows through
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environmentIntensity = 0.3;
  mark('environment');
  const camera = new THREE.PerspectiveCamera(STORY_FOV, 1, 0.1, 300);

  // faint starfield — fades in once the hero has gone, so it never speckles the wordmark
  const starMat = new THREE.PointsMaterial({ color: 0x3a4466, size: 1.3 * pr, sizeAttenuation: false, transparent: true, opacity: 0 });
  {
    const n = mobile ? 500 : 1100, arr = new Float32Array(n * 3), r = rng(99);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize().multiplyScalar(80 + r() * 40);
      arr.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    scene.add(new THREE.Points(g, starMat));
  }

  // Invoker + grimoire, lit warm from the front with Quas-blue and Wex-violet rims (orb shaders are unlit)
  // His transform is set every frame (see pinInvoker), so his lights and orbit ring ride along as children.
  const invoker = await invokerLoading;
  mark('invoker model');
  invoker.root.matrixAutoUpdate = false;
  invoker.root.matrix.makeTranslation(INVOKER_AT.x, INVOKER_AT.y, INVOKER_AT.z);
  scene.add(invoker.root);
  for (const [color, intensity, x, y, z] of [['#ffd6a0', 1.6, -3, 5, 6], ['#4fc3ff', 2.2, -6, 3, -4], ['#c07bff', 2.0, 6, 2.5, -5]]) {
    const l = new THREE.DirectionalLight(color, intensity);
    l.position.set(x, y, z);
    l.target = invoker.root;
    invoker.root.add(l);
  }
  scene.add(new THREE.HemisphereLight('#4a3f6e', '#07060a', 0.5));

  const orbs = ORB_DEFS.map((d) => {
    const orb = createOrb(d, { mobile, pr });
    orb.root.add(new THREE.PointLight(d.ramp[2], 1.5, 0, 2));   // tints his robes as it passes, without blowing out the book
    scene.add(orb.root);
    return orb;
  });

  // the hero orbit, around Invoker (a child, so the orbs set off from around him wherever he is drawn)
  const heroRing = new THREE.Group();
  heroRing.position.set(...ORBIT.center);
  heroRing.rotation.set(ORBIT.tiltX, 0, ORBIT.tiltZ);
  invoker.root.add(heroRing);
  invoker.root.updateMatrixWorld(true);

  mark('orbs');
  const post = createPost(renderer, scene, camera, { pr, bloomScale: mobile ? PHONE_3D.bloomScale : 1 });
  mark('bloom');

  // Invoker holds still on screen while the camera travels: each frame he is placed in the camera's frame
  // exactly as he stood in the hero shot. Scaling him about the camera by d sends him back behind the orbs'
  // landing spot without changing how he looks; f undoes the hero → story FOV change.
  const UP = new THREE.Vector3(0, 1, 0);
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3();   // the camera path, before pointer parallax and drift
  const mCam = new THREE.Matrix4(), mPin = new THREE.Matrix4(), mRel = new THREE.Matrix4(), mAt = new THREE.Matrix4();
  const cameraMatrix = (out, pos, tgt) => out.lookAt(pos, tgt, UP).setPosition(pos);
  let pinScale = 1;
  function pinInvoker(h, fov) {
    const f = Math.tan(THREE.MathUtils.degToRad(fov) / 2) / Math.tan(THREE.MathUtils.degToRad(HERO_FOV) / 2);
    const d = 1 + 3 * smooth(band(h, 0.1, 0.8));
    pinScale = f * d;
    mPin.makeScale(f * d, f * d, d);
    invoker.root.matrix.multiplyMatrices(cameraMatrix(mCam, camPos, camTgt), mPin).multiply(mRel);
    invoker.root.updateMatrixWorld(true);
  }

  let keys = cameraKeys(false), hero = heroFrame(1.6);
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    post.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    keys = cameraKeys(w / h < 0.85);
    hero = heroFrame(w / h);
    // Invoker's pose relative to the hero camera
    mRel.copy(cameraMatrix(mCam, hero.pos, hero.tgt)).invert().multiply(mAt.makeTranslation(INVOKER_AT.x, INVOKER_AT.y, INVOKER_AT.z));
  }
  resize();
  addEventListener('resize', resize);
  const quality = createQuality({ renderer, post, start: pr, onChange: resize, ...(mobile && PHONE_3D.quality) });

  const motion = reduced ? 0 : 1;
  const drift = new THREE.Vector3();
  const pointer = new THREE.Vector2(), pointerS = new THREE.Vector2();

  function storyCamera(p) {
    const last = keys[keys.length - 1];
    if (p <= keys[0].p) { camPos.copy(keys[0].pos); camTgt.copy(keys[0].tgt); return; }
    if (p >= last.p) { camPos.copy(last.pos); camTgt.copy(last.tgt); return; }
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (p >= a.p && p <= b.p) {
        const t = smooth((p - a.p) / (b.p - a.p));      // eases into each beat so the camera rests on it
        camPos.lerpVectors(a.pos, b.pos, t);
        camTgt.lerpVectors(a.tgt, b.tgt, t);
        return;
      }
    }
  }

  function placeCamera(v) {
    storyCamera(Math.max(0, v));
    const h = Math.min(1, v + 1), e = smooth(h);   // 0 at the top of the hero → 1 once the orbs have landed
    if (e < 1) {
      camPos.lerpVectors(hero.pos, camPos, e);
      camTgt.lerpVectors(hero.tgt, camTgt, e);
    }
    const fov = THREE.MathUtils.lerp(HERO_FOV, STORY_FOV, e);
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    if (h < 1) pinInvoker(h, fov);   // pinned to the path, so pointer parallax below still reads as depth
    const t = uTime.value;
    drift.set(Math.sin(t * 0.21) * 0.12, Math.sin(t * 0.17) * 0.08, 0).multiplyScalar(motion * e);
    camera.position.copy(camPos).add(drift);
    camera.position.x += pointerS.x * 0.35 * (1 - e);   // pointer parallax belongs to the hero only
    camera.position.y -= pointerS.y * 0.18 * (1 - e);
    camera.lookAt(camTgt);
  }

  // The orbs rest in the tableau; each grows while its own beat is on screen
  const focusCenters = [BEATS.quas, BEATS.wex, BEATS.exort];
  function placeOrbs(p, t) {
    orbs.forEach((orb, i) => {
      const fw = 1 - smooth(Math.abs(p - focusCenters[i]) / 0.16);
      orb.root.position.copy(TABLEAU[i]);
      orb.root.position.y += Math.sin(t * 0.8 + i * 2.1) * 0.12 * motion;
      orb.root.scale.setScalar(0.52 + 0.32 * fw);
    });
  }

  // Hero: start on Invoker's orbit, then come down to wherever placeOrbs put them (the tableau)
  const orbitPos = new THREE.Vector3();
  function heroOrbs(h, t) {
    orbs.forEach((orb, i) => {
      const a = i / 3 * Math.PI * 2 + t * ORBIT.speed;
      heroRing.localToWorld(orbitPos.set(Math.cos(a) * ORBIT.radius, Math.sin(t * 1.2 + i * 2.1) * 0.1 * motion, Math.sin(a) * ORBIT.radius));
      const e = smooth(band(h, 0.1 + i * 0.1, 0.7 + i * 0.1));   // Quas leaves first, then Wex, then Exort
      const landed = orb.root.scale.x;
      orb.root.position.lerpVectors(orbitPos, orb.root.position, e);
      orb.root.position.z += Math.sin(e * Math.PI) * 1.8;        // they swing toward the viewer on the way down
      // on his orbit they scale with him (pinScale), so they look the same size while he holds still
      orb.root.scale.setScalar(THREE.MathUtils.lerp(ORBIT.scale * pinScale, landed, e));
    });
  }

  let active = false, paused = false, target = -1, p = -1, raf = 0;
  const clock = new THREE.Clock(), gate = createFrameGate(mobile ? PHONE_3D.fps : 0);
  const timeScale = reduced ? 0.35 : 1;

  function frame() {
    raf = requestAnimationFrame(frame);
    const raw = gate(clock.getDelta());
    if (!raw) return;
    const dt = Math.min(raw, 0.05);
    if (active) { renderFrame(dt); quality.sample(raw); }
  }

  function renderFrame(dt) {
    const tdt = paused ? 0 : dt * timeScale;
    // the grimoire beside the guide shares this clock; tickTime lets whichever canvas draws first advance it, so
    // while both are on screen (scrolling between the story and the guide) it still runs at normal speed
    if (tdt) tickTime(tdt);
    const t = uTime.value;
    // ease toward the scroll position, faster the further behind it is: a flick from the bottom of the page lands
    // almost at once, while ordinary scrolling keeps its smoothing
    p += (target - p) * (1 - Math.exp(-dt * (6 + 18 * Math.min(1, Math.abs(target - p)))));
    pointerS.lerp(pointer, 1 - Math.exp(-dt * 3));
    const h = Math.min(1, p + 1);

    placeCamera(p);
    placeOrbs(Math.max(0, p), t);
    if (h < 1) heroOrbs(h, t);
    const fade = h < 1 ? 1 - smooth(band(h, 0.55, 0.95)) : 0;   // he fades back into the dark as his orbs land
    invoker.root.visible = fade > 0.001;
    if (invoker.root.visible) { invoker.setFade(fade); invoker.update(tdt, t, motion, camera); }
    starMat.opacity = smooth(band(h, 0.4, 1));
    for (const orb of orbs) orb.update(tdt, camera);
    post.render();
  }
  // compile every shader up front, in parallel where the browser supports it, so the first frame doesn't stall
  await renderer.compileAsync(scene, camera);
  mark('shaders compiled');
  if (debug) console.log('[scene setup ms]', 'started at', Math.round(t0), JSON.stringify(timings));
  raf = requestAnimationFrame(frame);

  return {
    setProgress(v) { target = Math.min(1, Math.max(-1, v)); },
    // Off screen the scene stops drawing, so its eased position goes stale (e.g. still mid-intro after a fast scroll
    // past the story). Returning, snap to the scroll position rather than sweep across the story from there.
    setActive(v) { if (v && !active) { clock.getDelta(); p = target; } active = v; },
    setPaused(v) { paused = v; },
    setPointer(x, y) { pointer.set(x, y); },
    state() { return { p, target, active, paused }; },   // dev aid
    jumpTo(v) { target = p = Math.min(1, Math.max(-1, v)); },
    dispose() { cancelAnimationFrame(raf); removeEventListener('resize', resize); renderer.dispose(); },
    // Dev aids (?debug): render a settled frame at story value v, independent of rAF
    // (which browsers throttle in hidden windows); re-pose Invoker live
    capture(v, time = 6) {
      target = p = v; uTime.value = time;
      for (let i = 0; i < 3; i++) renderFrame(1 / 60);
      return new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.86));
    },
    pose: invoker.pose,
  };
}
