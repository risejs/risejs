import './console.css';

/**
 * Console pack: an in-game developer console. Install it only in development builds.
 *
 *   app.use(consolePlugin);
 *   app.console.add('heal', { args: '[n]', desc: 'restore health', run: (app, n) => ... });
 *
 * Keys: ` (backquote) opens · Enter runs · ↑↓ history · Tab completes · Esc closes.
 */
export function consolePlugin(app, { key = 'Backquote' } = {}) {
  const offs = [];
  const on = (t, type, fn, o) => {
    t.addEventListener(type, fn, o);
    offs.push(() => t.removeEventListener(type, fn, o));
  };
  const runOffs = () => {
    while (offs.length) {
      try {
        offs.pop()();
      } catch {}
    }
  };
  const timers = new Set();
  const el = document.createElement('div');
  el.className = 'devcon off';
  el.innerHTML = `
    <div class="devcon-log"></div>
    <div class="devcon-row">
      <span class="devcon-prompt">&gt;</span>
      <input class="devcon-input" spellcheck="false" autocomplete="off" />
      <span class="devcon-hint"></span>
    </div>
  `;
  app.hud.root.appendChild(el);

  const logEl = el.querySelector('.devcon-log');
  const input = el.querySelector('.devcon-input');
  const hintEl = el.querySelector('.devcon-hint');

  const commands = new Map();
  const history = [];
  let histIndex = -1;

  const print = (text, cls = '') => {
    const line = document.createElement('div');
    line.className = 'devcon-line ' + cls;
    line.textContent = text;
    logEl.appendChild(line);
    while (logEl.children.length > 120) logEl.firstChild.remove();
    logEl.scrollTop = logEl.scrollHeight;
  };

  let api;
  function add(name, { args = '', desc = '', run } = {}) {
    commands.set(name, { name, args, desc, run });
    return api;
  }

  function complete(text) {
    const list = [...commands.keys()].filter((k) => k.startsWith(text));
    hintEl.textContent = list.length ? list.slice(0, 6).join(' · ') : '';
    return list;
  }

  function exec(raw) {
    const line = String(raw || '').trim();
    if (!line) return;
    history.push(line);
    histIndex = -1;
    print(`> ${line}`, 'echo');

    const [name, ...rest] = line.split(/\s+/);
    const cmd = commands.get(name);
    if (!cmd) {
      print(`unknown command "${name}" (type help)`, 'err');
      return;
    }
    try {
      const out = cmd.run?.(app, ...rest);
      if (out !== undefined) print(String(out));
    } catch (err) {
      print(`error: ${err.message}`, 'err');
    }
  }

  on(
    window,
    'keydown',
    (e) => {
      if (e.code === key && !e.repeat) {
        e.preventDefault();
        el.classList.toggle('off');
        if (!el.classList.contains('off')) {
          const t = setTimeout(() => {
            timers.delete(t);
            input.focus();
          }, 0);
          timers.add(t);
        } else input.blur();
        return;
      }
      if (el.classList.contains('off')) return;
      if (e.code === 'Escape') {
        el.classList.add('off');
        input.blur();
      } else if (e.code === 'Enter') {
        exec(input.value);
        input.value = '';
        hintEl.textContent = '';
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        if (!history.length) return;
        histIndex = histIndex < 0 ? history.length - 1 : Math.max(0, histIndex - 1);
        input.value = history[histIndex];
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        if (histIndex < 0) return;
        histIndex = Math.min(history.length - 1, histIndex + 1);
        input.value = history[histIndex] || '';
      } else if (e.code === 'Tab') {
        e.preventDefault();
        const list = complete(input.value);
        if (list.length === 1) input.value = list[0] + ' ';
      }
    },
    true
  );

  on(input, 'input', () => complete(input.value));

  // --- built-in commands ---
  add('help', {
    desc: 'list commands',
    run: () =>
      [...commands.values()]
        .map((c) => `${c.name} ${c.args}`.trim().padEnd(22) + (c.desc || ''))
        .join('\n'),
  });

  add('tp', {
    args: '<x> <z>',
    desc: 'teleport the player',
    run: (a, x, z) => {
      if (!a.player) return 'no player';
      a.player.pos.x = Number(x) || 0;
      a.player.pos.z = Number(z) || 0;
      return `→ ${a.player.pos.x}, ${a.player.pos.z}`;
    },
  });

  add('give', {
    args: '<id> [n]',
    desc: 'add an item to the inventory',
    run: (a, id, n = '1') => {
      if (!a.inventory) return 'inventory pack is not installed';
      a.inventory.add({ id, name: id }, Number(n) || 1);
      return `+${n} ${id}`;
    },
  });

  add('spawn', {
    args: '<npc|box> [x] [z]',
    desc: 'spawn an entity at the player',
    run: (a, kind = 'box', x, z) => {
      const px = x !== undefined ? Number(x) : a.player?.pos.x ?? 0;
      const pz = z !== undefined ? Number(z) : (a.player?.pos.z ?? 0) + 3;
      if (kind === 'npc') {
        if (!a.spawnNpc) return 'requires app.use(npcPlugin)';
        a.spawnNpc({ path: [[px, 0, pz]], speed: 1.2, name: 'console' });
        return `npc @ ${px},${pz}`;
      }
      a.spawnBox?.({ size: [1, 1, 1], position: [px, 0.5, pz], tags: ['debug'] });
      return `box @ ${px},${pz}`;
    },
  });

  add('god', {
    desc: 'toggle invulnerability',
    run: (a) => {
      a.god = !a.god;
      if (a.player) a.player.god = a.god;
      return `god ${a.god ? 'on' : 'off'}`;
    },
  });

  add('weather', {
    args: '<clear|rain|snow>',
    desc: 'change the weather',
    run: (a, mode = 'clear') => {
      if (!a.weather) return 'weather pack is not installed';
      return a.weather.set(mode);
    },
  });

  add('time', {
    args: '<0..1>',
    desc: 'set the time of day',
    run: (a, t = '0.3') => {
      if (!a.weather) return 'weather pack is not installed';
      a.weather.time = Number(t);
      return `time ${a.weather.time.toFixed(2)}`;
    },
  });

  add('seed', {
    desc: 'show the current seed',
    run: (a) => String(a.rng?.seed ?? '?'),
  });

  add('level', {
    args: '<url>',
    desc: 'load a level JSON',
    run: async (a, url) => {
      const level = await a.loadLevel(url);
      return `level ${level?.name || url} (${level?.entities?.length ?? 0} entity)`;
    },
  });

  add('clear', {
    desc: 'clear the log',
    run: () => {
      logEl.innerHTML = '';
      return '';
    },
  });

  api = {
    add,
    exec,
    print,
    commands,
    get isOpen() {
      return !el.classList.contains('off');
    },
    dispose() {
      runOffs();
      timers.forEach(clearTimeout);
      timers.clear();
      el.remove();
      if (app.console === api) app.console = null;
    },
  };
  app.console = api;
  print('Rise dev console. Type "help".');
  return api;
}
