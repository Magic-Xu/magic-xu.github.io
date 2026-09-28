import { gsap } from "gsap";

declare global {
  interface Window { __magicMotionCleanup?: () => void; }
}

const initMotion = () => {
  window.__magicMotionCleanup?.();
  const media = gsap.matchMedia();
  media.add("(prefers-reduced-motion: no-preference)", () => {
    gsap.from("[data-reveal-group] > *, .motion-row", {
      y: 10, opacity: 0, duration: 0.45, stagger: 0.045, ease: "power2.out", clearProps: "all"
    });
  });
  window.__magicMotionCleanup = () => media.revert();
};
document.addEventListener("astro:page-load", initMotion);
document.addEventListener("astro:before-swap", () => window.__magicMotionCleanup?.());
if (document.readyState === "complete") initMotion();
