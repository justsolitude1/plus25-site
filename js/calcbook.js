// The Astral Grimoire beside the calculator: as the section scrolls in it flies up from the bottom right,
// turning as it comes, and opens as it lands (pages fan, its loose pages and ribbons are released).
// Transparent canvas; glow is screened over the page.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { uTime, tickTime, smooth, band } from './shared.js';
import { createBook } from './book.js';
import { createPost, createQuality, createFrameGate, PHONE_3D } from './post.js';

// Where the book starts (below and right of the frame) and where it rests, turned slightly toward the form
const FROM = { pos: new THREE.Vector3(4.3, -4.8, 1.2), rot: new THREE.Euler(0.5, -1.1, 0.5) };   // just outside the frame, so it shows early
const REST = { pos: new THREE.Vector3(0, 0, 0), rot: new THREE.Euler(0.08, -0.4, 0) };
// Open book plus its orbiting pieces, in scene units, so the camera can keep all of it in frame
const SPAN = { w: 7.6, h: 5.6 };

export async function initCalcBook({ canvas, reduced = false, mobile = false, debug = false }) {
  const pr = Math.min(devicePixelRatio, mobile ? PHONE_3D.pr : 1.5);   // starting budget; createQuality lowers it on slow devices
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !mobile, powerPreference: 'high-performance', preserveDrawingBuffer: debug });
  renderer.setPixelRatio(pr);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environmentIntensity = 0.55;   // as in the grimoire viewer
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

  // no haze plane: on a transparent canvas it would reach the canvas edges and show as a warm box; bloom carries the glow
  const book = createBook({ renderer, mobile, pr, hazeOn: false });
  const holder = new THREE.Group();
  holder.add(book.root);
  scene.add(holder);

  const post = createPost(renderer, scene, camera, { pr, bloom: [0.55, 0.55, 0.9], bloomScale: mobile ? PHONE_3D.bloomScale : 1 });

  function resize() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1, aspect = w / h;
    renderer.setSize(w, h, false);
    post.setSize(w, h);
    camera.aspect = aspect;
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    camera.position.set(0, 0.4, Math.max(SPAN.h / (2 * t), SPAN.w / (2 * t * aspect)));
    camera.lookAt(0, 0.2, 0);
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);
  const quality = createQuality({ renderer, post, start: pr, onChange: resize, ...(mobile && PHONE_3D.quality) });

  const motion = reduced ? 0 : 1;
  let enter = reduced ? 1 : 0, enterS = enter, active = false, raf = 0;
  const clock = new THREE.Clock(), gate = createFrameGate(mobile ? PHONE_3D.fps : 0);

  function update(dt) {
    tickTime(dt, reduced ? 0.35 : 1);
    const t = uTime.value;
    enterS += (enter - enterS) * (1 - Math.exp(-dt * 5));
    const e = smooth(enterS);
    holder.position.lerpVectors(FROM.pos, REST.pos, e);
    holder.position.y += Math.sin(t * 0.9) * 0.08 * motion * e;   // floats once it has landed
    holder.rotation.set(
      THREE.MathUtils.lerp(FROM.rot.x, REST.rot.x, e),
      THREE.MathUtils.lerp(FROM.rot.y, REST.rot.y, e) + Math.sin(t * 0.35) * 0.06 * motion * e,
      THREE.MathUtils.lerp(FROM.rot.z, REST.rot.z, e),
    );
    book.setOpen(band(enterS, 0.55, 1));        // closed in flight, opens as it lands
    canvas.style.opacity = smooth(band(enterS, 0, 0.4)).toFixed(3);   // slight fade in on the way
    book.update(dt, camera);
    post.render();
  }

  await renderer.compileAsync(scene, camera);   // compile shaders up front, in parallel where supported
  (function loop() {
    raf = requestAnimationFrame(loop);
    const raw = gate(clock.getDelta());
    if (!raw) return;
    const dt = Math.min(raw, 0.05);
    if (active) { update(dt); quality.sample(raw); }
  })();

  return {
    setEnter(v) { enter = reduced ? 1 : Math.min(1, Math.max(0, v)); },
    setActive(v) { if (v && !active) clock.getDelta(); active = v; },
    dispose() { cancelAnimationFrame(raf); removeEventListener('resize', resize); renderer.dispose(); },
    // dev aid (?debug): render a settled frame at entrance progress v
    capture(v, time = 6) {
      enter = enterS = v; uTime.value = time;
      for (let i = 0; i < 3; i++) update(1 / 60);
      return new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.86));
    },
  };
}
