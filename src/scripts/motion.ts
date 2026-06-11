import { gsap } from "gsap";

declare global {
	interface Window {
		__magicMotionBooted?: boolean;
		__magicMotionCleanup?: () => void;
	}
}

const runEntrance = (isDesktop: boolean) => {
	gsap.from(".site-header", {
		y: -12,
		autoAlpha: 0,
		duration: 0.45
	});

	gsap.from(".home-copy > *", {
		y: 20,
		autoAlpha: 0,
		stagger: 0.07,
		delay: 0.04
	});

	gsap.from(".featured-product", {
		x: isDesktop ? 28 : 0,
		y: isDesktop ? 0 : 16,
		rotationY: isDesktop ? -6 : 0,
		autoAlpha: 0,
		duration: 0.75,
		delay: 0.14,
		transformOrigin: "50% 50%"
	});

	gsap.from(".code-window", {
		y: 18,
		rotation: (index) => (index === 0 ? -1 : 1),
		autoAlpha: 0,
		stagger: 0.1,
		delay: 0.22
	});

	gsap.from(".signal-line", {
		scaleX: 0,
		transformOrigin: "right center",
		stagger: 0.1,
		delay: 0.26
	});

	gsap.from(".motion-card, .content-block, .article-detail", {
		y: 14,
		autoAlpha: 0,
		stagger: {
			each: 0.045,
			from: "start"
		},
		delay: 0.12
	});
};

const motionTargets = [
	".site-header",
	".home-copy > *",
	".featured-product",
	".code-window",
	".signal-line",
	".motion-card",
	".content-block",
	".article-detail"
].join(", ");

const clearMotionState = () => {
	gsap.killTweensOf(motionTargets);
	gsap.set(motionTargets, {
		clearProps: "transform,opacity,visibility"
	});
};

const bindInteractions = (isDesktop: boolean) => {
	const cleanupCallbacks: (() => void)[] = [];

	if (isDesktop) {
		const hero = document.querySelector<HTMLElement>(".home-hero");
		const codeWindows = gsap.utils.toArray<HTMLElement>(".code-window");

		const handlePointerMove = (event: PointerEvent) => {
			if (!hero || codeWindows.length === 0) return;

			const rect = hero.getBoundingClientRect();
			const x = (event.clientX - rect.left) / rect.width - 0.5;
			const y = (event.clientY - rect.top) / rect.height - 0.5;

			codeWindows.forEach((item, index) => {
				gsap.to(item, {
					x: x * (index === 0 ? -18 : 14),
					y: y * (index === 0 ? -14 : 10),
					rotation: index === 0 ? 2 + x * 1.2 : -3 + x * -1.2,
					duration: 0.45
				});
			});
		};

		hero?.addEventListener("pointermove", handlePointerMove);
		cleanupCallbacks.push(() => hero?.removeEventListener("pointermove", handlePointerMove));
	}

	document.querySelectorAll<HTMLElement>(".motion-card").forEach((card) => {
		const handleEnter = () => {
			gsap.to(card, { y: -5, scale: 1.01, duration: 0.26 });
		};
		const handleLeave = () => {
			gsap.to(card, { y: 0, scale: 1, duration: 0.32 });
		};

		card.addEventListener("pointerenter", handleEnter);
		card.addEventListener("pointerleave", handleLeave);

		cleanupCallbacks.push(() => {
			card.removeEventListener("pointerenter", handleEnter);
			card.removeEventListener("pointerleave", handleLeave);
		});
	});

	return () => {
		cleanupCallbacks.forEach((cleanup) => cleanup());
	};
};

const syncNavState = () => {
	const normalizePath = (path: string) => {
		if (path !== "/" && path.endsWith("/")) return path.slice(0, -1);
		return path;
	};
	const currentPath = normalizePath(window.location.pathname);

	document.querySelectorAll<HTMLAnchorElement>(".nav-link").forEach((link) => {
		const linkPath = normalizePath(new URL(link.href).pathname);
		link.classList.toggle("active", linkPath === currentPath);
	});
};

const initMotion = () => {
	window.__magicMotionCleanup?.();
	clearMotionState();
	syncNavState();

	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const isDesktop = window.matchMedia("(min-width: 900px)").matches;

	gsap.defaults({
		duration: 0.65,
		ease: "power3.out",
		overwrite: "auto"
	});

	if (reduceMotion) {
		gsap.set(".home-copy > *, .featured-product, .motion-card, .content-block, .article-detail", {
			clearProps: "all"
		});
		window.__magicMotionCleanup = undefined;
		return;
	}

	if (!window.__magicMotionBooted) {
		runEntrance(isDesktop);
		window.__magicMotionBooted = true;
	}

	window.__magicMotionCleanup = bindInteractions(isDesktop);
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
