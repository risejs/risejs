import * as THREE from 'three';
import { Rng } from '../../rng.js';

/**
 * Embers: glowing particles drifting upward, a **per-game** decoration (not part of the core).
 *
 *   const embers = createEmbers({ count: 240, color: 0xffa257 });
 *   app.scene.add(embers);
 *   app.events.on('frame', (dt) => embers.userData.update(dt, elapsed));
 */
export function createEmbers({ count = 300, color = 0xffa257, area = 160, height = 26, seed = 7 } = {}) {
  const rng = new Rng(seed);
  const pos = new Float32Array(count * 3);
  const speed = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    pos[i * 3] = rng.range(-area / 2, area / 2);
    pos[i * 3 + 1] = rng.range(0, height);
    pos[i * 3 + 2] = rng.range(-area / 2, area / 2);
    speed[i] = rng.range(0.35, 1.45);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

  const mat = new THREE.PointsMaterial({
    color,
    size: 0.13,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  points.userData.update = (dt, t) => {
    const arr = geo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += speed[i] * dt;
      arr[i * 3] += Math.sin(t * 0.6 + i) * dt * 0.35;
      if (arr[i * 3 + 1] > height + 2) {
        arr[i * 3 + 1] = -1;
        arr[i * 3] = rng.range(-area / 2, area / 2);
        arr[i * 3 + 2] = rng.range(-area / 2, area / 2);
      }
    }
    geo.attributes.position.needsUpdate = true;
    mat.opacity = 0.7 + Math.sin(t * 2) * 0.08;
  };

  /** Removes it from the scene and frees GPU resources (the game calls this on teardown). */
  points.userData.dispose = () => {
    points.removeFromParent();
    geo.dispose();
    mat.dispose();
  };

  return points;
}
