import { gsap } from "gsap";

declare global { interface Window { __magicMotionCleanup?: () => void; } }

const initMotion = () => {
  const page = document.querySelector('main');
  if (!page || page.hasAttribute('data-motion-ready')) return;
  page.setAttribute('data-motion-ready', '');
  window.__magicMotionCleanup?.();
  const controller = new AbortController();
  const { signal } = controller;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const detailsTweens = new Map<HTMLDetailsElement, gsap.core.Tween>();
  let progressFrame = 0;
  let headingObserver: IntersectionObserver | undefined;
  document.querySelectorAll<HTMLElement>('.hero-copy > *, .hero-horizon, [data-reveal-group] > *').forEach(element => {
    const entrance = element.getAnimations().find(animation => animation instanceof CSSAnimation && /^(copy|horizon)-enter$/.test(animation.animationName));
    if (!entrance || entrance.playState === 'finished') element.dataset.entered = 'true';
    else entrance.finished.then(() => { element.dataset.entered = 'true'; }).catch(() => {});
  });

  document.querySelectorAll<HTMLDetailsElement>('.project-entry').forEach(details => {
    const summary = details.querySelector('summary')!;
    const content = details.querySelector<HTMLElement>('.project-expanded')!;
    let expanded = details.open;
    if (location.hash.slice(1) === details.id) expanded = details.open = true;
    details.dataset.expanded = String(expanded);
    summary.addEventListener('click', event => {
      event.preventDefault();
      expanded = !expanded;
      details.dataset.expanded = String(expanded);
      detailsTweens.get(details)?.kill();
      if (reduced.matches) { details.open = expanded; content.inert = !expanded; gsap.killTweensOf(content); gsap.set(content, { clearProps: 'opacity,transform' }); gsap.set(details, { clearProps: 'height,overflow' }); return; }
      const current = details.getBoundingClientRect().height;
      details.open = true;
      details.style.height = '';
      const full = details.getBoundingClientRect().height;
      const closed = summary.getBoundingClientRect().height + 1;
      gsap.set(details, { height: current, overflow: 'hidden' });
      content.inert = !expanded;
      detailsTweens.set(details, gsap.to(details, {
        height: expanded ? full : closed, duration: .52, ease: 'power3.inOut',
        onComplete: () => { details.open = expanded; gsap.set(details, { clearProps: 'height,overflow' }); detailsTweens.delete(details); }
      }));
      gsap.to(content, { opacity: expanded ? 1 : 0, y: expanded ? 0 : -7, duration: .3, ease: 'power2.out', overwrite: true });
    }, { signal });
  });

  const article = document.querySelector<HTMLElement>('.article-detail');
  const bar = document.querySelector<HTMLElement>('.reading-progress');
  if (article && bar) {
    const updateReading = () => {
      progressFrame = 0;
      const rect = article.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, -rect.top / Math.max(1, rect.height - innerHeight)));
      bar.style.transform = `scaleX(${progress})`;
    };
    const requestReading = () => { if (!progressFrame) progressFrame = requestAnimationFrame(updateReading); };
    window.addEventListener('scroll', requestReading, { passive: true, signal });
    window.addEventListener('resize', requestReading, { passive: true, signal });
    updateReading();
    const headings = article.querySelectorAll<HTMLElement>('.article-prose h2[id]');
    const links = document.querySelectorAll<HTMLAnchorElement>('.toc-link');
    headingObserver = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (!visible.length) return;
      const id = visible[0].target.id;
      links.forEach(link => decodeURIComponent(link.hash.slice(1)) === id ? link.setAttribute('aria-current', 'location') : link.removeAttribute('aria-current'));
    }, { rootMargin: '-100px 0px -65% 0px' });
    headings.forEach(heading => headingObserver!.observe(heading));
  }
  window.__magicMotionCleanup = () => {
    controller.abort(); headingObserver?.disconnect(); cancelAnimationFrame(progressFrame);
    detailsTweens.forEach(tween => tween.kill());
    gsap.killTweensOf('.project-expanded');
  };
};
document.addEventListener('astro:page-load', initMotion);
document.addEventListener('astro:before-swap', () => window.__magicMotionCleanup?.());
if (document.readyState !== 'loading') initMotion();
