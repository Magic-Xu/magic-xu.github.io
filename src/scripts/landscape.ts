import { LANDSCAPE_SESSION_KEY } from '../lib/landscape-state';

let dispose: (() => void) | undefined;
let generation = 0;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
async function initLandscape() {
  const host = document.querySelector<HTMLElement>('[data-landscape]');
  if (!host || host.dataset.initialized) return;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  if (reduced.matches || saveData) return;
  host.dataset.initialized = 'true';
  const current = ++generation;
  try {
    const { createLandscape } = await import('../lib/landscape');
    if (current === generation && host.isConnected) dispose = createLandscape(host);
  } catch {
    delete window.__landscapeResume;
    if (!host.isConnected) return;
    const hero = host.closest<HTMLElement>('.home-hero')!;
    hero.dataset.scene = 'fallback'; hero.dataset.exploring = 'false';
    hero.querySelector<HTMLElement>('.hero-copy')!.inert = false;
  }
}
document.addEventListener('astro:before-swap', () => {
  generation++; dispose?.(); dispose = undefined;
  delete window.__landscapeResume;
  try { sessionStorage.removeItem(LANDSCAPE_SESSION_KEY); } catch { /* Storage is optional. */ }
});
document.addEventListener('astro:page-load', initLandscape);
reduced.addEventListener('change', () => { if (!reduced.matches) initLandscape(); });
initLandscape();
