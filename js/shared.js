// Shared clock + helpers for the orb and grimoire modules
import * as THREE from 'three';

export const uTime = { value: 0 };

// Additive light that leaves the alpha channel alone: on a transparent canvas (the hero) glows add onto
// the page behind instead of boxing it in; on an opaque canvas it looks exactly like AdditiveBlending.
export const ADDITIVE_BLEND = {
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
  blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
};

export function rng(seed) {
  let a = Math.floor(seed * 1e6) >>> 0;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
// 0 → 1 across [a, b]
export const band = (p, a, b) => clamp01((p - a) / (b - a));
