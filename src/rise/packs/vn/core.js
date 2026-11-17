/** Typewriter and pagination for visual novels. Pure and testable. */
export class Typewriter {
  constructor(text = '', { speed = 45 } = {}) {
    this.text = String(text);
    this.speed = Math.max(1, speed);
    this.elapsed = 0;
  }

  setText(text) {
    this.text = String(text);
    this.elapsed = 0;
    return this;
  }

  get total() {
    return this.text.length;
  }

  get visible() {
    return Math.min(this.total, Math.floor(this.elapsed * this.speed));
  }

  get done() {
    return this.visible >= this.total;
  }

  update(dt) {
    if (!this.done) this.elapsed += dt;
    return this.visible;
  }

  skip() {
    this.elapsed = this.total / this.speed;
    return this.total;
  }

  /** The visible string (trailing whitespace is kept so the layout does not jump). */
  render() {
    return this.text.slice(0, this.visible);
  }
}

/** Splits long text into pages by character count, preferring to break at punctuation. */
export function paginate(text = '', maxChars = 220) {
  const clean = String(text).replace(/\r\n/g, '\n').trim();
  if (clean.length <= maxChars) return [clean];

  const pages = [];
  let rest = clean;
  while (rest.length > maxChars) {
    const slice = rest.slice(0, maxChars);
    const cut = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '), slice.lastIndexOf('\n'));
    const at = cut > maxChars * 0.5 ? cut + 1 : maxChars;
    pages.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) pages.push(rest);
  return pages;
}

/** Valid expression names. */
export const EXPRESSIONS = ['neutral', 'happy', 'angry', 'sad', 'shock', 'smug'];

export function normalizeNode(node = {}) {
  return {
    id: node.id || 'node',
    speaker: node.speaker || '',
    portrait: node.portrait || null,
    expression: EXPRESSIONS.includes(node.expression) ? node.expression : 'neutral',
    text: node.text || '',
    choices: Array.isArray(node.choices) ? node.choices : [],
    next: node.next ?? null,
    auto: node.auto ?? 1.6,
  };
}
