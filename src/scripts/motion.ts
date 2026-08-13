import { gsap } from "gsap";

declare global {
	interface Window {
		__magicMotionCleanup?: () => void;
	}
}

const normalizePath = (path: string) => path !== "/" && path.endsWith("/") ? path.slice(0, -1) : path;

const syncNavState = () => {
	const currentPath = normalizePath(window.location.pathname);
	document.querySelectorAll<HTMLAnchorElement>(".nav-link:not(.nav-external)").forEach((link) => {
		const linkPath = normalizePath(new URL(link.href).pathname);
		const active = currentPath === linkPath || currentPath.startsWith(`${linkPath}/`);
		link.classList.toggle("active", active);
		if (active) link.setAttribute("aria-current", "page");
		else link.removeAttribute("aria-current");
	});
};

const clearMotionState = () => {
	const targets = document.querySelectorAll<HTMLElement>(".site-header, [data-reveal-group] > *, .motion-card, .motion-row, .code-panel");
	if (targets.length === 0) return;
	gsap.killTweensOf(targets);
	gsap.set(targets, { clearProps: "transform,opacity,visibility" });
};

const initMotion = () => {
	window.__magicMotionCleanup?.();
	clearMotionState();
	syncNavState();

	const media = gsap.matchMedia();
	const cleanup: Array<() => void> = [];

	media.add(
		{
			desktop: "(min-width: 768px)",
			reduceMotion: "(prefers-reduced-motion: reduce)"
		},
		(context) => {
			const { desktop, reduceMotion } = context.conditions as { desktop: boolean; reduceMotion: boolean };
			if (reduceMotion) return;

			const header = document.querySelector(".site-header");
			const revealItems = document.querySelectorAll("[data-reveal-group] > *");
			const motionRows = document.querySelectorAll(".motion-row");
			if (header) gsap.from(header, { y: -12, autoAlpha: 0, duration: 0.45, ease: "power2.out" });
			if (revealItems.length) gsap.from(revealItems, {
				y: 18,
				autoAlpha: 0,
				duration: 0.65,
				stagger: 0.065,
				ease: "power3.out"
			});
			if (motionRows.length) gsap.from(motionRows, {
				y: 12,
				autoAlpha: 0,
				duration: 0.55,
				stagger: 0.055,
				delay: 0.08,
				ease: "power2.out"
			});

			if (document.querySelector(".product-stack")) {
				gsap.from(".featured-product", { x: desktop ? 28 : 0, y: desktop ? 0 : 14, autoAlpha: 0, duration: 0.78, delay: 0.13, ease: "power3.out" });
				gsap.from(".code-panel", { y: 18, autoAlpha: 0, duration: 0.72, stagger: 0.1, delay: 0.22, ease: "power3.out" });

				if (desktop) {
					const hero = document.querySelector<HTMLElement>(".home-hero");
					const topPanel = document.querySelector<HTMLElement>(".code-panel-top");
					const bottomPanel = document.querySelector<HTMLElement>(".code-panel-bottom");
					if (hero && topPanel && bottomPanel) {
						const topX = gsap.quickTo(topPanel, "x", { duration: 0.42, ease: "power3.out" });
						const topY = gsap.quickTo(topPanel, "y", { duration: 0.42, ease: "power3.out" });
						const bottomX = gsap.quickTo(bottomPanel, "x", { duration: 0.48, ease: "power3.out" });
						const bottomY = gsap.quickTo(bottomPanel, "y", { duration: 0.48, ease: "power3.out" });
						const move = (event: PointerEvent) => {
							const bounds = hero.getBoundingClientRect();
							const x = (event.clientX - bounds.left) / bounds.width - 0.5;
							const y = (event.clientY - bounds.top) / bounds.height - 0.5;
							topX(x * -16); topY(y * -10);
							bottomX(x * 12); bottomY(y * 9);
						};
						hero.addEventListener("pointermove", move);
						cleanup.push(() => hero.removeEventListener("pointermove", move));
					}
				}
			}
		}
	);

	window.__magicMotionCleanup = () => {
		cleanup.forEach((callback) => callback());
		media.revert();
	};
};

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initMotion, { once: true });
} else {
	initMotion();
}

document.addEventListener("astro:page-load", initMotion);
document.addEventListener("astro:before-swap", () => {
	window.__magicMotionCleanup?.();
	clearMotionState();
});
