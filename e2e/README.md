# e2e: real-browser smoke tests

Each sample game (`city foundry arena tactics side game2d fmv rpg rogue editor`) is opened with `/?game=<id>&nopause=1`.
The test waits for `window.__rise.running`, clicks the canvas, walks forward (W for 1.2 s) and jumps, then checks that there is no `pageerror`/`console.error`
and that `renderer.info.render.calls > 0`, and saves a screenshot to `e2e/shots/<browser>-<id>.png`. One more test covers `destroy()` (skipped
when `app.destroy` does not exist). The noise allowlist (favicon, service worker, 404s for optional assets…) is at the top of `smoke.spec.mjs`.

## Setup (once)

```bash
npm i -D @playwright/test
npx playwright install            # chromium + firefox + webkit
```

## Running

```bash
npm run test:e2e                          # all 3 browsers (starts `npm run dev` if it is not running)
npm run test:e2e -- --project=chromium    # one browser only
npm run test:e2e -- -g "rpg"              # one game only
```

Chromium uses software WebGL (SwiftShader), so it runs on machines without a GPU; it is slower than real hardware and must not be used to measure fps.

## Recording results in the release evidence file (`RISE_EVIDENCE`, kept outside the repo)

`scripts/release-check.mjs` reads `browserMatrix`: each entry needs `browser`, `date` (YYYY-MM-DD, expires after 120 days),
`consoleErrors` (must be `0`) and `games` (array of ids that ran clean). The `browser` name is matched in lowercase and tier R1 requires
exactly `chrome`, `safari`, `firefox`, so map them: chromium → `chrome`, webkit → `safari`.
Only record an entry when that project passes every game.

```json
"browserMatrix": [
  { "browser": "chrome",  "version": "Chromium 141", "date": "2026-11-17", "consoleErrors": 0,
    "games": ["city","foundry","arena","tactics","side","game2d","fmv","rpg","rogue"] },
  { "browser": "firefox", "version": "Firefox 142",  "date": "2026-11-17", "consoleErrors": 0,
    "games": ["city","foundry","arena","tactics","side","game2d","fmv","rpg","rogue"] },
  { "browser": "safari",  "version": "WebKit 26",    "date": "2026-11-17", "consoleErrors": 0,
    "games": ["city","foundry","arena","tactics","side","game2d","fmv","rpg","rogue"] }
]
```

Then run `npm run release:check`. Note that Playwright's WebKit is not the same as real Safari on iOS/macOS;
`mobile` and `xr` still have to be checked by hand.
