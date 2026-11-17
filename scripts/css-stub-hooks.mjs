/**
 * Node loader hook: every `*.css` import resolves to an empty module, so app.js can be tested without Vite.
 * Registered through css-stub-register.mjs.
 */
export async function load(url, context, nextLoad) {
  if (url.endsWith('.css')) return { format: 'module', source: 'export default "";', shortCircuit: true };
  return nextLoad(url, context);
}
