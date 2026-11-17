/**
 * Queue for incremental generation work within a per-frame budget.
 * Pure logic: the caller passes the clock, so tests can use a fake one.
 */

export class BakeQueue {
  constructor({ budgetMs = 8, urgentMs = 12, maxJobs = 256 } = {}) {
    this.budgetMs = budgetMs;
    this.urgentMs = urgentMs;
    this.maxJobs = maxJobs;
    this.jobs = [];
    this.seq = 0;
    this.dropped = 0;
  }

  /**
   * @param {object} job
   * @param {string} [job.id]
   * @param {string} [job.owner]
   * @param {number} [job.priority] higher numbers run first
   * @param {boolean} [job.urgent] uses urgentMs
   * @param {Generator} job.work generator; each next() is one unit of work
   * @param {(value:any)=>void} [job.commit] called on the game thread when done
   */
  add(job = {}) {
    if (!job.work || typeof job.work.next !== 'function') throw new Error('[bakes] job.work must be a generator');
    if (this.jobs.length >= this.maxJobs) {
      this.dropped++;
      return null;
    }
    const entry = {
      id: job.id || `job-${++this.seq}`,
      owner: job.owner || 'default',
      priority: Number(job.priority) || 0,
      urgent: !!job.urgent,
      work: job.work,
      commit: job.commit,
      spent: 0,
      units: 0,
      addedAt: this.seq,
    };
    this.jobs.push(entry);
    return entry;
  }

  _pick() {
    let best = -1;
    for (let i = 0; i < this.jobs.length; i++) {
      const j = this.jobs[i];
      if (best < 0) {
        best = i;
        continue;
      }
      const b = this.jobs[best];
      if (j.urgent !== b.urgent) {
        if (j.urgent) best = i;
        continue;
      }
      if (j.priority !== b.priority) {
        if (j.priority > b.priority) best = i;
        continue;
      }
      if (j.addedAt < b.addedAt) best = i;
    }
    return best;
  }

  /**
   * Runs within the budget.
   * @returns {{spent:number, done:number, pending:number, units:number}}
   */
  run(now, { urgent = null } = {}) {
    const clock = typeof now === 'function' ? now : () => Date.now();
    const start = clock();
    let done = 0;
    let units = 0;

    for (;;) {
      const index = this._pick();
      if (index < 0) break;
      const job = this.jobs[index];

      const before = clock();
      let step;
      try {
        step = job.work.next();
      } catch (err) {
        this.jobs.splice(index, 1);
        job.commit?.({ error: err });
        continue;
      }
      job.spent += clock() - before;
      job.units++;
      units++;

      if (step.done) {
        this.jobs.splice(index, 1);
        job.commit?.(step.value);
        done++;
      }

      const limit = urgent === null ? (job.urgent ? this.urgentMs : this.budgetMs) : urgent;
      if (clock() - start >= limit) break;
    }

    return { spent: clock() - start, done, pending: this.jobs.length, units };
  }

  /** Runs until the queue is empty (tests/CLI), with a cap to avoid hanging. */
  drain(now, { maxSteps = 10000 } = {}) {
    const clock = typeof now === 'function' ? now : () => Date.now();
    let steps = 0;
    let done = 0;
    while (this.jobs.length && steps < maxSteps) {
      const r = this.run(clock, { urgent: 1e9 });
      done += r.done;
      if (r.units === 0) break;
      steps += r.units;
    }
    return { done, pending: this.jobs.length, steps };
  }

  cancel(id) {
    const before = this.jobs.length;
    this.jobs = this.jobs.filter((j) => j.id !== id);
    return before !== this.jobs.length;
  }

  clear(owner = null) {
    const before = this.jobs.length;
    this.jobs = owner ? this.jobs.filter((j) => j.owner !== owner) : [];
    return before - this.jobs.length;
  }

  stats() {
    const owners = {};
    for (const j of this.jobs) owners[j.owner] = (owners[j.owner] || 0) + 1;
    return { pending: this.jobs.length, owners, dropped: this.dropped };
  }
}
