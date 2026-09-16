// The three orbs drifting far behind a section, as scenery. Same shaders as the story, but small, slow and dim:
// the canvas is masked and faded by CSS so it reads as light in the room rather than a picture on the page.
import * as THREE from 'three';
import { uTime, tickTime } from './shared.js';
import { ORB_DEFS, createOrb } from './orbs.js';
import { createPost, createQuality } from './post.js';

// where each orb sits, how big it is, and how far it drifts
const PLACES = {
  quas: { pos: [-4.2, 0.9, 0], scale: 1.15, float: 0.22, speed: 0.5 },
  wex: { pos: [4.4, 1.4, -1.5], scale: 0.95, float: 0.3, speed: 0.42 },
  exort: { pos: [0.6, -2.6, -2.5], scale: 0.8, float: 0.26, speed: 0.6 },
};
const SPAN = { w: 13, h: 7.5 };   // the area the camera keeps in frame

export async function initBackdrop({ canvas, reduced = false, mobile = false }) {
  const pr = Math.min(devicePixelRatio, mobile ? 1 : 1.25);   // scenery: cheaper than the foreground scenes
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(pr);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);

  const orbs = Object.entries(PLACES).map(([key, place]) => {
    const orb = createOrb(ORB_DEFS.find((d) => d.key === key), { mobile: true, pr });   // the lighter build: this is scenery
    orb.root.position.set(...place.pos);
    orb.root.scale.setScalar(place.scale);
    scene.add(orb.root);
    return { orb, place, base: orb.root.position.clone() };
  });

  const post = createPost(renderer, scene, camera, { pr, bloom: [0.5, 0.6, 0.75] });

  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1, aspect = w / h;
    renderer.setSize(w, h, false);
    post.setSize(w, h);
    camera.aspect = aspect;
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    camera.position.set(0, 0, Math.max(SPAN.h / (2 * t), SPAN.w / (2 * t * aspect)));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);
  const quality = createQuality({ renderer, post, start: pr, onChange: resize });

  const motion = reduced ? 0 : 1;
  let active = false, raf = 0, shown = false;
  const clock = new THREE.Clock();

  function update(dt) {
    tickTime(dt, reduced ? 0.35 : 1);
    const t = uTime.value;
    for (const { orb, place, base } of orbs) {
      orb.root.position.y = base.y + Math.sin(t * place.speed) * place.float * motion;
      orb.root.position.x = base.x + Math.cos(t * place.speed * 0.6) * place.float * 0.5 * motion;
      orb.update(dt, camera);
    }
    post.render();
    if (!shown) { shown = true; canvas.dispatchEvent(new Event('backdropready', { bubbles: true })); }
  }

  await renderer.compileAsync(scene, camera);
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
