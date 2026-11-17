import * as THREE from 'three';

const UNIFORM = new THREE.MeshStandardMaterial({ color: 0x343a41, roughness: 0.85 });
const VEST = new THREE.MeshStandardMaterial({ color: 0x4d545c, roughness: 0.7, metalness: 0.2 });
const SKIN = new THREE.MeshStandardMaterial({ color: 0x9a6a4f, roughness: 0.9 });
const VISOR = new THREE.MeshStandardMaterial({
  color: 0x120c08,
  emissive: 0xffa14a,
  emissiveIntensity: 1.6,
  roughness: 0.4,
});

/**
 * Procedural character shared by the player and NPCs.
 * Has standing, crouching and swimming poses; limbs swing with speed.
 */
export class Character {
  constructor({ color = 0x4d545c } = {}) {
    this.group = new THREE.Group();
    this.phase = 0;
    this.crouchBlend = 0;

    const vest = color === 0x4d545c ? VEST : new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.2 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.29), vest);
    torso.position.y = 1.16;
    torso.castShadow = true;
    this.group.add(torso);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8), SKIN);
    neck.position.y = 1.51;
    this.group.add(neck);

    const hips = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.28), UNIFORM);
    hips.position.y = 0.8;
    this.group.add(hips);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 16, 12), SKIN);
    head.position.y = 1.62;
    head.castShadow = true;
    this.group.add(head);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.03), VISOR);
    visor.position.set(0, 1.64, 0.125);
    this.group.add(visor);

    this.legs = [];
    this.arms = [];
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.12, 0.78, 0);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.72, 0.17), UNIFORM);
      leg.position.y = -0.36;
      leg.castShadow = true;
      hip.add(leg);
      this.group.add(hip);
      this.legs.push(hip);

      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.3, 1.4, 0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.58, 0.13), vest);
      arm.position.y = -0.29;
      arm.castShadow = true;
      shoulder.add(arm);
      this.group.add(shoulder);
      this.arms.push(shoulder);
    }

    this.visible = true;
  }

  setVisible(v) {
    this.visible = v;
    this.group.visible = v;
  }

  /**
   * @param {number} dt
   * @param {number} speed  horizontal speed (m/s)
   * @param {number} heading  movement direction (rad)
   * @param {boolean} swimming
   * @param {boolean} crouched
   */
  update(dt, speed, heading, swimming = false, crouched = false) {
    this.phase += dt * (2.4 + speed * 1.6);
    const k = Math.min(1, speed / 4);
    const swing = Math.sin(this.phase) * (swimming ? 0.5 : 0.7) * k * (crouched ? 0.6 : 1);

    this.legs[0].rotation.x = swing;
    this.legs[1].rotation.x = -swing;
    this.arms[0].rotation.x = -swing * 0.7;
    this.arms[1].rotation.x = swing * 0.7;

    this.group.rotation.x = swimming ? -1.15 : 0;

    // lower the body when crouching
    this.crouchBlend += ((crouched ? 1 : 0) - this.crouchBlend) * Math.min(1, dt * 10);
    this.group.scale.y = 1 - this.crouchBlend * 0.24;

    const diff = ((heading - this.group.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    this.group.rotation.y += diff * Math.min(1, dt * 10);
  }
}
