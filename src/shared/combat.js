/** Server-side weapon state: ammo, fire rate, reload. Pure. */
import { weaponOf } from './weapons.js';

export class WeaponState {
  constructor(weapon = 'rifle', now = 0) {
    this.weapon = typeof weapon === 'string' ? weaponOf(weapon) : weapon;
    this.ammo = this.weapon.mag;
    this.nextFireAt = 0;
    this.reloadUntil = 0;
    this.reloading = false;
    this.shots = 0;
  }

  get intervalMs() {
    return 60000 / this.weapon.rpm;
  }

  tick(now) {
    if (this.reloading && now >= this.reloadUntil) {
      this.reloading = false;
      this.ammo = this.weapon.mag;
    }
  }

  canFire(now) {
    this.tick(now);
    if (this.reloading) return false;
    if (now < this.nextFireAt) return false;
    return this.ammo > 0;
  }

  fire(now) {
    if (!this.canFire(now)) return false;
    if (Number.isFinite(this.weapon.mag)) this.ammo--;
    this.nextFireAt = now + this.intervalMs;
    this.shots++;
    return true;
  }

  reload(now) {
    if (this.reloading || this.ammo === this.weapon.mag) return false;
    this.reloading = true;
    this.reloadUntil = now + this.weapon.reloadMs;
    return true;
  }
}
