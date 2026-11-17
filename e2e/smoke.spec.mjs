// Real-browser smoke tests: every sample game must boot, run its loop, let the player walk, and log no errors.
// Runs against `npm run dev` only (needs window.__rise and the ?nopause flag, both dev-only).
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const GAMES = ['city', 'foundry', 'arena', 'tactics', 'side', 'game2d', 'fmv', 'rpg', 'rogue', 'editor'];

// Allowlist of noise that is not a framework error. Add a reason with every new entry.
const IGNORED = [
  /favicon/i, // the browser requests a favicon by itself
  /service.?worker|sw\.js/i, // the service worker is only registered in production builds
  /Failed to load resource.*404/i, // optional assets (images/audio/glb) that are not in the repo
  /pointer ?lock|requestPointerLock/i, // headless browsers do not grant pointer lock
  /autoplay|AudioContext was not allowed/i, // audio needs a user gesture
];
const isIgnored = (text) => IGNORED.some((re) => re.test(text));

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => {
    const text = String(err?.stack || err?.message || err);
    if (!isIgnored(text)) errors.push(`pageerror: ${text}`);
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (!isIgnored(text)) errors.push(`console.error: ${text}`);
  });
  return errors;
}

async function bootGame(page, id) {
  await page.goto(`/?game=${id}&nopause=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__rise?.running === true && !document.getElementById('boot'), null, {
    timeout: 30_000,
  });
}

async function frames(page, n = 5) {
  await page.evaluate(
    (count) =>
      new Promise((resolve) => {
        let left = count;
        const step = () => (--left <= 0 ? resolve() : requestAnimationFrame(step));
        requestAnimationFrame(step);
      }),
    n
  );
}

test.describe('smoke: sample games', () => {
  for (const id of GAMES) {
    test(`${id}: boots, walks, no errors`, async ({ page }, testInfo) => {
      const errors = watchErrors(page);
      await bootGame(page, id);

      // Click the canvas (a UI layer may cover it, so use mouse coordinates), then walk forward and jump:
      // the walking path once had an undeclared-variable bug on the footstep sound line.
      try {
        await page.locator('#view').click({ force: true, timeout: 5000 });
      } catch {
        await page.mouse.click(640, 360);
      }
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(1200);
      await page.keyboard.press('Space');
      await page.keyboard.up('KeyW');
      await frames(page, 5);

      expect(errors, errors.join('\n')).toEqual([]);

      // renderer.info may not exist for some games/renderers; skip the check if so.
      const calls = await page.evaluate(() => window.__rise?.renderer?.info?.render?.calls ?? null);
      if (calls !== null) expect(calls).toBeGreaterThan(0);

      fs.mkdirSync('e2e/shots', { recursive: true });
      await page.screenshot({ path: `e2e/shots/${testInfo.project.name}-${id}.png` });
    });
  }
});

test('destroy: calling it twice does not throw and logs no errors afterwards', async ({ page }) => {
  const errors = watchErrors(page);
  await bootGame(page, 'city');

  const hasDestroy = await page.evaluate(() => typeof window.__rise?.destroy === 'function');
  test.skip(!hasDestroy, 'app.destroy() is not available in this build');

  const result = await page.evaluate(() => {
    try {
      // keep a reference: destroy() also removes the window.__rise global
      const app = window.__rise;
      app.destroy();
      app.destroy();
      if (window.__rise) return 'window.__rise still exists after destroy()';
      return null;
    } catch (e) {
      return String(e?.stack || e);
    }
  });
  expect(result, 'destroy() threw').toBeNull();

  await page.waitForTimeout(500);
  await frames(page, 3);
  expect(errors, errors.join('\n')).toEqual([]);
});
