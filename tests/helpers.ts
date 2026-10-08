import { test as base, expect, type Page } from '@playwright/test';

type Probe = {
  camera: number[]; view: number[]; frames: number; detail: number; rock: number;
  detailSamples: number[]; introStarts: number; opacities: number[];
  longTasks: { start: number; duration: number }[];
};
declare global { interface Window { __probe: Probe; __testAudio: HTMLAudioElement; __lose: WEBGL_lose_context | null; } }

export const test = base.extend<{ noPageErrors: void }>({
  noPageErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (/THREE\.WebGLProgram|GL_INVALID|WebGL: INVALID/.test(message.text())) errors.push(message.text());
    });
    await use();
    expect(errors, 'No uncaught page errors').toEqual([]);
  }, { auto: true }]
});
export { expect };
export async function instrumentScene(page: Page) {
  await page.addInitScript(() => {
    const probe: Probe = window.__probe = { camera: [], view: [], frames: 0, detail: 0, rock: 0, detailSamples: [], introStarts: 0, opacities: [], longTasks: [] };
    // Observe actual uniforms sent to WebGL, not a separate application test state.
    const names = new WeakMap<WebGLUniformLocation, string>();
    const proto = WebGL2RenderingContext.prototype;
    const locate = proto.getUniformLocation, matrix = proto.uniformMatrix4fv, scalar = proto.uniform1f, clear = proto.clear;
    proto.getUniformLocation = function(program, name) {
      const location = locate.call(this, program, name); if (location) names.set(location, name); return location;
    };
    proto.uniformMatrix4fv = function(location, transpose, value) {
      const name = location && names.get(location);
      if (name === 'cameraWorld') probe.camera = Array.from(value);
      if (name === 'viewMatrix') probe.view = Array.from(value);
      matrix.call(this, location, transpose, value);
    };
    proto.uniform1f = function(location, value) {
      const name = location && names.get(location);
      if (name === 'detailReady') { probe.detail = value; probe.detailSamples.push(value); }
      if (name === 'rockReady') probe.rock = value;
      scalar.call(this, location, value);
    };
    proto.clear = function(mask) { probe.frames++; clear.call(this, mask); };
    document.addEventListener('animationstart', event => { if ((event.target as Element).id === 'home-title') probe.introStarts++; });
    const sample = () => {
      const title = document.querySelector('#home-title');
      if (title) probe.opacities.push(Number(getComputedStyle(title).opacity));
      if (performance.now() < 15000) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    new PerformanceObserver(list => {
      for (const task of list.getEntries()) probe.longTasks.push({ start: task.startTime, duration: task.duration });
    }).observe({ type: 'longtask' });
  });
}
export const sceneReady = (page: Page) => page.locator('[data-scene-presented="true"]').waitFor({ timeout: 45_000 });
export const camera = (page: Page) => page.evaluate(() => window.__probe.camera.length ? window.__probe.camera : window.__probe.view);
export const matrixDifference = (a: number[], b: number[]) => Math.max(...a.map((n, i) => Math.abs(n - b[i])));
export const pauseScene = async (page: Page) => {
  await sceneReady(page);
  const button = page.locator('[data-scene-toggle]');
  if (await button.getAttribute('aria-pressed') === 'false') await button.click();
};
export const fitsViewport = async (page: Page) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const radio = await page.locator('[data-radio]').boundingBox();
  expect(radio).not.toBeNull();
  expect(radio!.x).toBeGreaterThanOrEqual(0); expect(radio!.y).toBeGreaterThanOrEqual(0);
  expect(radio!.x + radio!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(radio!.y + radio!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
};
