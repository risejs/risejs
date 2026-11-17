import { BakeQueue } from './core.js';
export { BakeQueue };

/**
 * Bakes pack: spreads incremental generation work over a millisecond budget per frame.
 * This is streaming infrastructure rather than gameplay, and not every game needs it,
 * so it is an opt-in pack instead of part of the core.
 *
 *   app.use(bakesPlugin, { budgetMs: 8, urgentMs: 12 });
 *   app.bakes.add({ owner: 'world', work: gen(), commit: (chunk) => world.add(chunk) });
 */
export function bakesPlugin(app, { budgetMs = 8, urgentMs = 12 } = {}) {
  const queue = new BakeQueue({ budgetMs, urgentMs });
  const clock = () => (globalThis.performance?.now?.() ?? Date.now());

  const off = app.events.on('frame', () => {
    if (queue.jobs.length) queue.run(clock);
  });

  const api = {
    add: (job) => queue.add(job),
    runNow: (opts) => queue.run(clock, opts),
    drain: () => queue.drain(clock),
    cancel: (id) => queue.cancel(id),
    clear: (owner) => queue.clear(owner),
    get pending() {
      return queue.jobs.length;
    },
    stats: () => queue.stats(),
    queue,
    dispose() {
      off();
      queue.clear();
      if (app.bakes === api) app.bakes = null;
    },
  };

  app.bakes = api;
  return api;
}
