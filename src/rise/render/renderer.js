import * as THREE from 'three';

/** Renderer + tone mapping + pixel ratio cap. */
export function createRenderer(canvas, cfg = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: cfg.antialias !== false,
    powerPreference: cfg.powerPreference || 'high-performance',
    preserveDrawingBuffer: cfg.preserveDrawingBuffer === true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cfg.pixelRatioCap ?? 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = cfg.exposure ?? 1.3;
  renderer.shadowMap.enabled = cfg.shadows !== false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

/**
 * Resizes with the viewport. Returns a function that REMOVES the listener (`unbind()`); the resize function is still available as `unbind.resize`.
 */
export function bindResize(renderer, camera) {
  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);
  const unbind = () => window.removeEventListener('resize', resize);
  unbind.resize = resize;
  return unbind;
}
