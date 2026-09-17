// Post chain for the site's transparent canvases: bloom + a hue-preserving shoulder, with alpha kept so the
// page shows through. Solid surfaces keep their coverage; glow is screened over the page.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SavePass } from 'three/addons/postprocessing/SavePass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Phones: the 3D scenes draw at 30fps with the bloom blur at half resolution, start at 1x pixels and may drop to
// 0.75x. The quality thresholds are in frame time, so they're set for 30fps (a frame is ~33ms even when it's fine).
export const PHONE_3D = { fps: 30, pr: 1, bloomScale: 0.5, quality: { floor: 0.75, slowMs: 45, fastMs: 36 } };

// Draws at most `fps` frames a second (0 = every frame). Feed it each rAF's delta; it returns the time since the
// last drawn frame, or 0 when this one should be skipped.
export function createFrameGate(fps) {
  const min = fps ? 1 / fps - 0.004 : 0;
  let acc = 0;
  return (delta) => { acc += delta; if (acc < min) return 0; const d = acc; acc = 0; return d; };
}

// bloom = [strength, radius, threshold]; bloomScale < 1 runs the blur at a fraction of the canvas size (cheaper)
export function createPost(renderer, scene, camera, { pr = 1, bloom = [0.55, 0.45, 0.62], bloomScale = 1 } = {}) {
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(pr);
  composer.addPass(new RenderPass(scene, camera));
  // UnrealBloomPass writes alpha = 1 across the frame, so keep the scene's own coverage from before bloom
  const coverage = new SavePass();
  composer.addPass(coverage);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), ...bloom);
  composer.addPass(bloomPass);
  const finish = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, tCoverage: { value: null } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse, tCoverage; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        float a = texture2D(tCoverage, vUv).a;
        if (any(isnan(c)) || any(isinf(c)) || isnan(a)) { c = vec3(0.0); a = 0.0; }
        c = max(c, 0.0);
        // identity for dark/mid tones (measured colors display as measured), soft hue-preserving shoulder above 0.8
        float m = max(max(c.r, c.g), c.b);
        float tm = m < 0.8 ? m : 0.8 + 0.2 * (1.0 - exp(-(m - 0.8) / 0.2));
        vec3 col = m > 1e-5 ? c / m * tm : vec3(0.0);
        col = mix(col, vec3(tm), smoothstep(3.0, 10.0, m) * 0.8);
        // Glow over empty pixels gets alpha from its own brightness (in display gamma, since OutputPass
        // converts next) so the browser screens it over the page; rgb with alpha 0 would be dropped.
        float glow = min(1.0, pow(max(max(col.r, col.g), col.b), 0.4545) * 1.01);
        gl_FragColor = vec4(col, max(clamp(a, 0.0, 1.0), glow));
      }`,
  });
  finish.uniforms.tCoverage.value = coverage.renderTarget.texture;   // set after construction: ShaderPass clones its uniforms
  composer.addPass(finish);
  composer.addPass(new OutputPass());

  return {
    render() { composer.render(); },
    setSize(w, h) { composer.setSize(w, h); bloomPass.setSize(Math.max(1, Math.round(w * bloomScale)), Math.max(1, Math.round(h * bloomScale))); },
    setPixelRatio(pr) { composer.setPixelRatio(pr); },
  };
}

// Pixel-ratio budget for the 3D canvases. They start below full retina (the scenes are soft glow, so ~1.5x
// looks the same as 2x for about half the GPU work), then step down 0.25 at a time while frames keep
// running slower than slowMs on this device. Call sample() once per rendered frame with the raw interval.
export function createQuality({ renderer, post, start, onChange, floor = 1, slowMs = 22, fastMs = 13 }) {
  let pr = start, sum = 0, n = 0, good = 0;
  const set = (next) => {
    pr = Math.round(next * 100) / 100;
    renderer.setPixelRatio(pr);
    post.setPixelRatio(pr);
    onChange();
  };
  return {
    get pixelRatio() { return pr; },
    sample(dtSec) {
      if (document.visibilityState !== 'visible' || dtSec > 0.1) return;   // ignore throttled / background frames
      sum += dtSec; n++;
      if (n < 90) return;
      const avgMs = (sum / n) * 1000;
      sum = n = 0;
      if (avgMs > slowMs && pr > floor) { good = 0; set(Math.max(floor, pr - 0.25)); return; }
      // frames are comfortable again (e.g. the other canvases stopped drawing): climb back towards full detail,
      // one step per two good windows, so a brief slow patch doesn't leave the scene soft for the whole visit
      if (avgMs < fastMs && pr < start && ++good >= 2) { good = 0; set(Math.min(start, pr + 0.25)); }
      else if (avgMs >= fastMs) good = 0;
    },
  };
}
