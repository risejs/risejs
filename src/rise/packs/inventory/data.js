/**
 * Pure inventory logic (no DOM/CSS), testable in Node.
 */
export class Inventory {
  constructor(capacity = 8, events = null) {
    this.capacity = capacity;
    this.events = events;
    this.slots = new Map();
    this.equipment = new Map();
    this.maxStack = 99;
  }

  add(item, count = 1) {
    const id = item.id;
    const current = this.slots.get(id);
    if (!current && this.slots.size >= this.capacity) return false;
    if (current) current.count = Math.min(this.maxStack, current.count + count);
    else this.slots.set(id, { ...item, count: Math.min(this.maxStack, count) });
    this.events?.emit('inventory:change', this.entries());
    this.events?.emit('inventory:add', { item, count });
    return true;
  }

  /** Puts an item into an equipment slot (it must be in the bag). */
  equip(id, slot = 'weapon') {
    const item = this.slots.get(id);
    if (!item) return false;
    this.equipment.set(slot, item);
    this.events?.emit('inventory:equip', { slot, item });
    this.events?.emit('inventory:change', this.entries());
    return true;
  }

  unequip(slot) {
    const item = this.equipment.get(slot);
    if (!item) return null;
    this.equipment.delete(slot);
    this.events?.emit('inventory:equip', { slot, item: null });
    this.events?.emit('inventory:change', this.entries());
    return item;
  }

  equipped() {
    return Object.fromEntries([...this.equipment].map(([slot, item]) => [slot, item.id]));
  }

  /** Total stat bonus from equipped items. */
  bonus() {
    const out = {};
    for (const item of this.equipment.values()) {
      for (const [k, v] of Object.entries(item.stats || {})) out[k] = (out[k] || 0) + v;
    }
    return out;
  }

  remove(id, count = 1) {
    const slot = this.slots.get(id);
    if (!slot || slot.count < count) return false;
    slot.count -= count;
    if (slot.count <= 0) this.slots.delete(id);
    this.events?.emit('inventory:change', this.entries());
    return true;
  }

  count(id) {
    return this.slots.get(id)?.count ?? 0;
  }

  has(id, count = 1) {
    return this.count(id) >= count;
  }

  entries() {
    return [...this.slots.values()];
  }

  clear() {
    this.slots.clear();
    this.equipment.clear();
    this.events?.emit('inventory:change', []);
  }
}
