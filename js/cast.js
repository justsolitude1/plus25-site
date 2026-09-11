// Invoker holding the Astral Grimoire open: loads the model, poses the arms by aiming bones, and places
// the book at his hands. The returned root has his feet at its origin, facing +Z.
// Model: "Invoker DOTA 2" by ansaldotoys2 (Sketchfab, CC-BY-4.0), credited in the page footer.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createBook } from './book.js';

const MODEL_URL = 'models/invoker/scene.gltf';
export const HEIGHT = 3.6;   // scene units

// Arm pose as world directions for the arm on +X (mirrored for the other): upper arm, then forearm.
// Upper arms hang down and a little out; forearms come forward, level and in, so the hands meet under
// the book at chest height (the model's arms are short: hands end up only ~0.75 below the head).
export const POSE = {
  upper: [0.22, -0.9, 0.36],
  fore: [-0.38, -0.02, 0.92],
  book: { scale: 0.2, lift: 0.18, forward: 0.05, tilt: -0.4 },
};

export async function createInvoker({ renderer, mobile = false, pr = 1 }) {
  const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
  const invoker = gltf.scene;
  const bones = [];
  invoker.traverse((o) => {
    if (o.isBone) bones.push(o);
    if (o.isMesh) o.frustumCulled = false;   // skinned bounds go stale once the arms are posed
  });
  const bone = (prefix) => bones.find((b) => b.name.startsWith(prefix));
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();

  // scale to HEIGHT
  invoker.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(invoker, true);
  invoker.scale.multiplyScalar(HEIGHT / (box.max.y - box.min.y));
  invoker.updateMatrixWorld(true);

  // face +Z: the toes point forward
  const fwd = new THREE.Vector3();
  for (const s of ['R', 'L']) {
    bone(`toeBase_${s}`).getWorldPosition(v1); bone(`ankle_${s}`).getWorldPosition(v2);
    fwd.add(v1.sub(v2));
  }
  invoker.rotation.y -= Math.atan2(fwd.x, fwd.z);
  invoker.updateMatrixWorld(true);

  // feet on the ground, centred
  box.setFromObject(invoker, true);
  const c = box.getCenter(new THREE.Vector3());
  invoker.position.x -= c.x; invoker.position.z -= c.z; invoker.position.y -= box.min.y;

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.add(invoker);
  root.add(body);
  root.updateMatrixWorld(true);

  // Pose: rotate a bone (in world space) so the direction to its child joint points along `dir`
  const bind = new Map(bones.map((b) => [b, b.quaternion.clone()]));
  const qRot = new THREE.Quaternion(), qWorld = new THREE.Quaternion(), qParent = new THREE.Quaternion();
  function aim(b, child, dir) {
    b.getWorldPosition(v1); child.getWorldPosition(v2);
    qRot.setFromUnitVectors(v2.sub(v1).normalize(), dir);
    b.getWorldQuaternion(qWorld);
    b.parent.getWorldQuaternion(qParent).invert();
    b.quaternion.copy(qParent.multiply(qRot.multiply(qWorld)));
    b.updateMatrixWorld(true);
  }

  const hands = new THREE.Vector3();   // in root space
  function pose(p = POSE) {
    for (const [b, q] of bind) b.quaternion.copy(q);
    root.updateMatrixWorld(true);
    hands.set(0, 0, 0);
    for (const s of ['R', 'L']) {
      const upper = bone(`bicep_${s}`), fore = bone(`elbow_${s}`), wrist = bone(`wrist_${s}`);
      const side = Math.sign(root.worldToLocal(wrist.getWorldPosition(v1)).x) || 1;
      aim(upper, fore, new THREE.Vector3(p.upper[0] * side, p.upper[1], p.upper[2]).normalize());
      aim(fore, wrist, new THREE.Vector3(p.fore[0] * side, p.fore[1], p.fore[2]).normalize());
      hands.add(root.worldToLocal(bone(`mid_0_${s}`).getWorldPosition(v1)).multiplyScalar(0.5));
    }
  }
  pose();

  /* ---------- the Grimoire, held open at his hands ---------- */
  // The scene lights Invoker; the book keeps a softened glow, its point lights scaled down with it.
  // Its orbiting extras (pages, shards, ribbons) are off: held against his chest they clip through the body.
  const book = createBook({ renderer, mobile, pr, ambient: false, hazeOn: false, lightScale: 0.035, extrasOn: false, glow: 0.45 });
  const held = new THREE.Group();
  held.add(book.root);
  body.add(held);
  function placeBook(b = POSE.book) {
    book.root.scale.setScalar(b.scale);
    held.position.copy(hands).add(v1.set(0, b.lift, b.forward));
    held.rotation.x = b.tilt;
  }
  placeBook();
  const heldBase = held.position.clone();

  // Fade: every material under the root (Invoker + book) goes transparent while f < 1
  const mats = new Map();
  root.traverse((o) => { for (const m of [].concat(o.material || [])) if (!mats.has(m)) mats.set(m, { transparent: m.transparent, opacity: m.opacity }); });
  let fade = 1;
  function setFade(f) {
    if (f === fade) return;
    fade = f;
    for (const [m, base] of mats) {
      m.transparent = base.transparent || f < 1;
      m.opacity = base.opacity * f;
    }
    book.setFade(f);
  }

  return {
    root,
    setFade,
    // dt already scaled by the caller's time scale (0 when paused); motion 0 under reduced motion
    update(dt, t, motion, camera) {
      body.rotation.y = Math.sin(t * 0.3) * 0.04 * motion;
      held.position.y = heldBase.y + Math.sin(t * 1.1) * 0.025 * motion;
      book.update(dt, camera);
    },
    // dev aid: re-pose live
    pose(p) { Object.assign(POSE, p); pose(POSE); placeBook(POSE.book); heldBase.copy(held.position); return 'ok'; },
  };
}
