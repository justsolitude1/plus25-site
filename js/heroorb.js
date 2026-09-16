// One of Invoker's orbs, alone, in a service page's header: Quas on replay analysis, Wex on coaching, Exort on the
// MMR boost. Same shaders as the story's orbs; transparent canvas, glow screened over the page. It floats, turns
// slowly and leans a little toward the pointer.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { uTime, tickTime } from './shared.js';
import { ORB_DEFS, createOrb } from './orbs.js';
import { createPost, createQuality } from './post.js';

// The orb with its crystals and halo, in scene units, so the camera keeps all of it in frame
const SPAN = 4.4;

export async function initHeroOrb({ canvas, key, reduced = false, mobile = false }) {
  const def = ORB_DEFS.find((d) => d.key === key);
  if (!def) throw new Error(`unknown orb ${key}`);
  const pr = Math.min(devicePixelRatio, mobile ? 1.25 : 1.5);   // starting budget; createQuality lowers it on slow devices
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !mobile, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pr);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environmentIntensity = 0.3;   // as in the story
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  const orb = createOrb(def, { mobile, pr });
  scene.add(orb.root);
  const post = createPost(renderer, scene, camera, { pr });

  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1, aspect = w / h;
    renderer.setSize(w, h, false);
    post.setSize(w, h);
    camera.aspect = aspect;
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    camera.position.set(0, 0, Math.max(SPAN / (2 * t), SPAN / (2 * t * aspect)));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);
  const quality = createQuality({ renderer, post, start: pr, onChange: resize });

  const motion = reduced ? 0 : 1;
  const lean = { x: 0, y: 0 }, leanS = { x: 0, y: 0 };
  if (!reduced && matchMedia('(pointer: fine)').matches) {
    addEventListener('pointermove', (e) => { lean.x = e.clientX / innerWidth * 2 - 1; lean.y = e.clientY / innerHeight * 2 - 1; }, { passive: true });
  }

  let active = false, raf = 0, shown = false;
  const clock = new THREE.Clock();
  function update(dt) {
    tickTime(dt, reduced ? 0.35 : 1);
    const t = uTime.value, k = 1 - Math.exp(-dt * 3);
    leanS.x += (lean.x - leanS.x) * k; leanS.y += (lean.y - leanS.y) * k;
    orb.root.position.y = Math.sin(t * 0.8) * 0.1 * motion;
    orb.root.rotation.set(leanS.y * 0.18, leanS.x * 0.3, 0);
    orb.update(dt, camera);
    post.render();
    if (!shown) { shown = true; canvas.dispatchEvent(new Event('orbready', { bubbles: true })); }
  }

  await renderer.compileAsync(scene, camera);   // compile shaders up front, in parallel where supported
  (function loop() {
    raf = requestAnimationFrame(loop);
    const raw = clock.getDelta(), dt = Math.min(raw, 0.05);
    if (active) { update(dt); quality.sample(raw); }
  })();

  return {
    setActive(v) { if (v && !active) clock.getDelta(); active = v; },
    dispose() { cancelAnimationFrame(raf); removeEventListener('resize', resize); renderer.dispose(); },
  };
}
