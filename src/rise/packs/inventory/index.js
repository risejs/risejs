import './ui.css';
import { Inventory } from './data.js';
export { Inventory };

/**
 * Inventory and interaction pack (opt-in).
 *
 *   import { inventoryPlugin } from '../../rise/packs/inventory/index.js';
 *   app.use(inventoryPlugin, { capacity: 8 });
 *
 *   app.interaction.add(entity, { label: 'Pick up', range: 2.5, onUse: () => ... });
 *   app.inventory.add({ id: 'ammo', name: 'Ammo' }, 12);
 */

const _v = { x: 0, z: 0 };

export class InteractionSystem {
  constructor(app) {
    this.app = app;
    this.items = [];
    this.current = null;

    this.prompt = document.createElement('div');
    this.prompt.className = 'pkg-prompt off';
    app.hud.root.appendChild(this.prompt);

    this._off = app.events.on('frame', () => this.update());
  }

  dispose() {
    this._off?.();
    this._off = null;
    this.prompt.remove();
    this.items = [];
    this.current = null;
  }

  add(entity, { label = 'Interact', range = 2.6, onUse = null } = {}) {
    this.items.push({ entity, label, range, onUse });
    return entity;
  }

  remove(entity) {
    this.items = this.items.filter((i) => i.entity !== entity);
  }

  _keyLabel() {
    const code = this.app.input.binds.interact?.[0] || 'KeyE';
    return code.startsWith('Key') ? code.slice(3) : code.replace('Mouse', 'M');
  }

  update() {
    const app = this.app;
    const p = app.player;
    if (!p || !app.state.is('playing')) {
      this._show(null);
      return;
    }

    const yaw = p.yaw;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);

    let best = null;
    let bestScore = Infinity;

    for (const it of this.items) {
      if (!it.entity.alive) continue;
      const pos = it.entity.mesh.position;
      const dx = pos.x - p.pos.x;
      const dz = pos.z - p.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > it.range) continue;

      const dot = dist > 0.001 ? (dx / dist) * fx + (dz / dist) * fz : 1;
      if (dot < 0.15) continue;

      const score = dist - dot * 0.5;
      if (score < bestScore) {
        bestScore = score;
        best = it;
      }
    }

    this.current = best;
    this._show(best ? `${this._keyLabel()} · ${best.label}` : null);

    if (best && app.input.justPressed('interact')) {
      best.onUse?.(best.entity, app);
      if (!best.entity.alive) this.remove(best.entity);
    }
  }

  _show(text) {
    if (this.prompt.textContent === (text || '') && this.prompt.classList.contains('off') === !text) return;
    this.prompt.textContent = text || '';
    this.prompt.classList.toggle('off', !text);
  }
}

function createPanel(app, inventory) {
  const el = document.createElement('div');
  el.className = 'pkg-inv off';
  el.innerHTML = `
    <div class="pkg-inv-head"><b>INVENTORY</b><span class="pkg-inv-count">0/${inventory.capacity}</span></div>
    <div class="pkg-inv-equip"></div>
    <div class="pkg-inv-grid"></div>
    <div class="pkg-inv-tip off"></div>
    <div class="pkg-inv-foot">I — close · 1–8 select · R equip</div>
  `;
  app.hud.root.appendChild(el);

  const grid = el.querySelector('.pkg-inv-grid');
  const tip = el.querySelector('.pkg-inv-tip');
  const counter = el.querySelector('.pkg-inv-count');
  const equipEl = el.querySelector('.pkg-inv-equip');
  let selected = 0;

  const render = () => {
    const items = inventory.entries();
    counter.textContent = `${items.length}/${inventory.capacity}`;
    selected = Math.min(selected, Math.max(0, items.length - 1));

    grid.innerHTML = Array.from({ length: inventory.capacity }, (_, i) => {
      const it = items[i];
      if (!it) return `<div class="pkg-slot empty"><i>${i + 1}</i></div>`;
      const eq = [...inventory.equipment.values()].includes(it);
      return `<div class="pkg-slot${i === selected ? ' sel' : ''}${eq ? ' eq' : ''}">
        <i>${i + 1}</i>
        <b>${escapeHtml((it.name || it.id).slice(0, 12))}</b>
        <span>×${it.count}</span>
      </div>`;
    }).join('');

    const eq = [...inventory.equipment];
    equipEl.innerHTML = eq.length
      ? eq.map(([slot, item]) => `<span class="pkg-eq"><i>${slot}</i>${escapeHtml(item.name || item.id)}</span>`).join('')
      : '<span class="pkg-eq empty">nothing equipped</span>';

    showTip(items[selected]);
  };

  function showTip(item) {
    if (!item) {
      tip.classList.add('off');
      return;
    }
    tip.classList.remove('off');
    tip.innerHTML = `<b>${escapeHtml(item.name || item.id)}</b><span>${escapeHtml(item.desc || item.id)}</span>`;
  }

  const offs = [app.events.on('inventory:change', render)];
  render();

  offs.push(app.events.on('frame', () => {
    if (!app.state.is('playing')) return;
    if (app.input.justPressed('inventory')) {
      el.classList.toggle('off');
      return;
    }
    if (!el.classList.contains('off')) {
      for (let n = 1; n <= 8; n++) {
        if (app.input.justPressed('slot' + n)) {
          selected = n - 1;
          const items = inventory.entries();
          render();
          app.events.emit('inventory:select', items[selected] || null);
        }
      }

      // the reload key (R by default) equips or unequips the selected slot
      if (app.input.justPressed('reload')) {
        const item = inventory.entries()[selected];
        if (item) {
          const slot = item.slot || 'weapon';
          if ([...inventory.equipment.values()].includes(item)) inventory.unequip(slot);
          else inventory.equip(item.id, slot);
          render();
        }
      }
    }
  }));

  return {
    el,
    render,
    dispose() {
      while (offs.length) offs.pop()();
      el.remove();
    },
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

/** Plugin: installs Inventory, Interaction and the panel. */
export function inventoryPlugin(app, options = {}) {
  const inventory = new Inventory(options.capacity ?? 8, app.events);
  app.inventory = inventory;
  const interaction = new InteractionSystem(app);
  app.interaction = interaction;
  const panel = createPanel(app, inventory);
  app.log?.('inventory pack ready');
  return () => {
    panel.dispose();
    interaction.dispose();
    if (app.interaction === interaction) app.interaction = null;
    if (app.inventory === inventory) app.inventory = null;
  };
}
