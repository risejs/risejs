# Browser, mobile, XR

## Support matrix (expected, not verified on every platform)

| Platform | Minimum | Notes |
|---|---|---|
| Chrome / Edge desktop | 90+ | WebGL2, WebXR (Chrome Android for AR) |
| Firefox desktop | 90+ | WebGL2; **no** WebXR |
| Safari macOS | 15.4+ | WebGL2; WebXR not stable |
| iOS Safari | 15.4+ | WebGL2, PWA; **no** WebXR |
| Chrome Android | 90+ | touch, AR (ARCore), PWA |
| Meta Quest Browser | latest | VR; AR depends on the device |

Rise **does not guess** support. Call `hasWebGL2()` and `detectSupport()`; when something is missing, show a clear message or hide the UI.
The matrix above is what the APIs in use should allow. Automated tests cover desktop browser engines only (see Test status).

## APIs used and fallbacks

| API | Used by | If missing |
|---|---|---|
| WebGL2 | `createRenderer` | `createApp` throws a clear error; `main.js` shows a red box |
| ES modules + `import()` | everything | build target is `es2022`; old browsers cannot run it |
| Pointer Events | touch, editor, menu | no touch joystick |
| `navigator.maxTouchPoints` | `touchPlugin`, `env` | treated as desktop |
| `navigator.xr` | `xr` pack | AR/VR buttons hidden, `app.xr.available=false` |
| `crypto.subtle` | save HMAC, hash | saves use a weak checksum, `hash.sha256Hex` returns null |
| `AudioContext` | audio, music | no sound |
| `serviceWorker` | PWA | no offline mode |
| `matchMedia` | a11y, `prefersReducedMotion` | defaults to false |
| `DecompressionStream` | demo receiving compressed raster data (if used) | affects only that feature |

`isSecureContext()` is checked before XR is enabled. `localStorage` is wrapped in try/catch in save/menu/a11y.

## Mobile

- Viewport: `viewport-fit=cover`; the HUD uses `env(safe-area-inset-*)`.
- `touch-action: none` on the canvas and joystick; context menu and double-tap are blocked in the touch area.
- `touchPlugin` turns itself on when a touch screen is present (or force it with `app.use(touchPlugin, { force: true })`). `app.touch.reset()` clears state on
  rotation, focus loss and tab hide.
- PWA: manifest + SW (`rise-shell-v2`), installable to the home screen; check offline mode after the first load.
- Audio on iOS needs a first gesture. `music`/`audio` unlock it on pointerdown.

**Not yet tested**: real iPhone, real Android, landscape/portrait rotation, notch, virtual keyboard.

## XR (AR-first)

```js
app.use(xrPlugin, { mode: 'immersive-ar' });   // automatic VR fallback
app.xr.available;      // false if unsupported
app.xr.support;        // { hasXR, ar, vr }
app.xr.enter();        // call from a click (requires a user gesture)
app.events.on('xr:start', ({ mode }) => {});
```

- Needs **HTTPS** (except localhost); otherwise `xr:unavailable { reason:'insecure' }`.
- No `navigator.xr`, or no supported mode: the button is hidden and the `xr:unavailable` event fires.
- AR requests optional `local-floor`, `hit-test`, `anchors`, `hand-tracking`, `dom-overlay` (none required).
- VR requests optional `local-floor`, `bounded-floor`, `hand-tracking`.
- Without a session, no XR resources are created; `renderer.xr.enabled` is turned on only inside the pack.

**Not yet tested**: Quest, Android AR, Vision Pro, controllers/hand tracking, hit-test placement.

## Test status

| Item | Status |
|---|---|
| Node tests (environment detection, XR mode selection, security helpers) | covered by `npm test` |
| Browser smoke tests (boot each sample game in Chromium, Firefox and WebKit, no console errors) | available as `npm run test:e2e` in the repository |
| Real mobile devices (touch, rotation, PWA) | not yet tested |
| XR headsets | not yet tested |
| Frame rate on real hardware | not yet measured |

## Manual testing (in the repository)

```bash
npm run dev
# desktop: open the demo shell and pick a sample game (demo only: ?game=<id>)
http://localhost:5173/?game=city
# mobile (same LAN)
http://<ip>:5173/?game=arena
# XR (HTTPS or localhost, Chrome Android / Quest)
http://localhost:5173/?game=arena
```

The framework does not read the URL. In your own project, measure fps with `app.use(benchPlugin, { seconds: 10 })`,
force the touch controls with `app.use(touchPlugin, { force: true })`, and enter XR with
`app.use(xrPlugin, { mode: 'immersive-ar' })` (or `'immersive-vr'`).

Quick check in the console:

```js
import('risejs-core').then((m) => console.log(m.envInfo()));
```

Expected: `webgl2:true`, correct `secure`, correct `touch` for the device. If `webgl2:false`, the cause is the browser or
hardware acceleration, not a Rise bug.
