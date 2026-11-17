/**
 * Minimal plugins: app.use(plugin, options).
 * No container and no dependency wiring: a plugin receives the app and installs itself.
 *
 * Cleanup contract: install(app, options) MAY return a dispose function (or an object with .dispose()),
 * or `dispose(app)` can be declared here. app.destroy() calls dispose in REVERSE install order.
 */
export function definePlugin(name, install, dispose) {
  return dispose ? { name, install, dispose } : { name, install };
}
