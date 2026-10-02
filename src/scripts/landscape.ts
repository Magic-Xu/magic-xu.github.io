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
  } catch { host.closest<HTMLElement>('.home-hero')!.dataset.scene = 'fallback'; }
}
document.addEventListener('astro:before-swap', () => { generation++; dispose?.(); dispose = undefined; });
document.addEventListener('astro:page-load', initLandscape);
reduced.addEventListener('change', () => { if (!reduced.matches) initLandscape(); });
initLandscape();
