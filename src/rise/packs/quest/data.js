/**
 * Pure quest logic (no DOM/CSS), testable in Node.
 */
export class QuestLog {
  constructor(events) {
    this.events = events;
    this.quests = new Map();
  }

  add({ id, title, steps = [] }) {
    if (this.quests.has(id)) return this.quests.get(id);
    const quest = {
      id,
      title,
      done: false,
      steps: steps.map((s) => ({ id: s.id, text: s.text, need: s.need ?? 1, count: 0 })),
    };
    this.quests.set(id, quest);
    this._emit();
    return quest;
  }

  progress(id, stepId, n = 1) {
    const quest = this.quests.get(id);
    if (!quest || quest.done) return;
    const step = quest.steps.find((s) => s.id === stepId);
    if (!step || step.count >= step.need) return;

    step.count = Math.min(step.need, step.count + n);
    this._emit();
    this.events?.emit('quest:progress', { quest, step });

    if (quest.steps.every((s) => s.count >= s.need)) {
      quest.done = true;
      this._emit();
      this.events?.emit('quest:complete', { quest });
    }
  }

  entries() {
    return [...this.quests.values()];
  }

  clear() {
    this.quests.clear();
    this._emit();
  }

  _emit() {
    this.events?.emit('quest:change', this.entries());
  }
}
