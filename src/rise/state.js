/**
 * State machine for the game lifecycle, shared by every genre.
 *
 *   app.setState('menu' | 'playing' | 'paused' | 'over')
 *   app.state.is('playing')
 */
export class GameState {
  constructor(initial = 'playing', events = null) {
    this.current = initial;
    this.prev = null;
    this.events = events;
    this.startedAt = performance.now();
  }

  set(next) {
    if (!next || next === this.current) return this.current;
    this.prev = this.current;
    this.current = next;
    this.events?.emit('state:change', { from: this.prev, to: next });
    return this.current;
  }

  is(...names) {
    return names.includes(this.current);
  }
}
