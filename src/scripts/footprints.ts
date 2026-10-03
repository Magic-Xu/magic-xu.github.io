import { gsap } from "gsap";

let cleanup: (() => void) | undefined;

const initFootprints = () => {
	const page = document.querySelector<HTMLElement>("[data-footprints]");
	if (!page || page.dataset.ready || !page.querySelector("[data-trip]")) return;
	cleanup?.();
	page.dataset.ready = "true";
	const controller = new AbortController();
	const { signal } = controller;
	const reduced = matchMedia("(prefers-reduced-motion: reduce)");
	const entries = [...page.querySelectorAll<HTMLDetailsElement>("[data-trip]")];
	const markers = [...page.querySelectorAll<HTMLAnchorElement>("[data-place]")];
	const expanded = new Map(entries.map(entry => [entry, entry.open]));
	const tweens = new Map<HTMLDetailsElement, gsap.core.Tween>();
	let selected = entries.find(entry => entry.open)?.dataset.trip;
	let selectionFrame = 0;
	let selectionVersion = 0;

	const select = (id?: string) => {
		selected = id;
		markers.forEach(marker => marker.dataset.place === id ? marker.setAttribute("aria-current", "location") : marker.removeAttribute("aria-current"));
	};
	const setOpen = (entry: HTMLDetailsElement, open: boolean, animate = true, complete?: () => void) => {
		const summary = entry.querySelector("summary")!;
		const content = entry.querySelector<HTMLElement>(".trip-expanded")!;
		const wasOpen = entry.open;
		expanded.set(entry, open);
		entry.dataset.expanded = String(open);
		summary.setAttribute("aria-expanded", String(open));
		content.inert = !open;
		tweens.get(entry)?.kill();
		tweens.delete(entry);
		gsap.killTweensOf(content);
		const finish = () => {
			entry.open = open;
			gsap.set(entry, { clearProps: "height,overflow" });
			gsap.set(content, { clearProps: "opacity,transform" });
			tweens.delete(entry);
			complete?.();
		};
		if (!animate || reduced.matches) { finish(); return; }
		const current = entry.getBoundingClientRect().height;
		entry.open = true;
		entry.style.height = "";
		const full = entry.getBoundingClientRect().height;
		const closed = summary.getBoundingClientRect().height + parseFloat(getComputedStyle(entry).borderBottomWidth);
		gsap.set(entry, { height: current, overflow: "hidden" });
		if (!wasOpen) gsap.set(content, { opacity: 0, y: -7 });
		tweens.set(entry, gsap.to(entry, { height: open ? full : closed, duration: .52, ease: "power3.inOut", onComplete: finish }));
		gsap.to(content, { opacity: open ? 1 : 0, y: open ? 0 : -7, duration: .3, ease: "power2.out" });
	};
	const updateHash = (entry: HTMLDetailsElement) => {
		// Keep Astro's navigation state so browser back/forward still restores pages.
		history.replaceState(history.state, "", `#${entry.id}`);
	};
	const locate = (entry: HTMLDetailsElement, focus: boolean) => {
		const rect = entry.getBoundingClientRect();
		const header = document.querySelector(".site-header")!.getBoundingClientRect();
		if (rect.top < header.bottom + 16 || rect.bottom > innerHeight - 32) {
			entry.scrollIntoView({ behavior: reduced.matches ? "instant" : "smooth", block: "start" });
		}
		if (focus) entry.querySelector("summary")!.focus({ preventScroll: true });
	};
	const visit = (entry: HTMLDetailsElement, fromMap: boolean) => {
		const version = ++selectionVersion;
		select(entry.dataset.trip);
		setOpen(entry, true, fromMap, () => {
			if (version !== selectionVersion) return;
			cancelAnimationFrame(selectionFrame);
			selectionFrame = requestAnimationFrame(() => locate(entry, fromMap));
		});
	};

	entries.forEach(entry => {
		const summary = entry.querySelector("summary")!;
		setOpen(entry, entry.open, false);
		summary.addEventListener("click", event => {
			event.preventDefault();
			selectionVersion++;
			const open = !expanded.get(entry);
			setOpen(entry, open);
			if (open) { select(entry.dataset.trip); updateHash(entry); }
			else if (selected === entry.dataset.trip) {
				select();
				if (location.hash === `#${entry.id}`) history.replaceState(history.state, "", location.pathname + location.search);
			}
		}, { signal });
	});
	markers.forEach(marker => marker.addEventListener("click", event => {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
		const entry = entries.find(item => item.dataset.trip === marker.dataset.place);
		if (!entry) return;
		event.preventDefault();
		updateHash(entry);
		visit(entry, true);
	}, { signal }));
	const followHash = () => {
		const entry = entries.find(item => `#${item.id}` === location.hash);
		if (entry) visit(entry, false);
	};
	const settle = () => entries.forEach(entry => setOpen(entry, expanded.get(entry)!, false));
	window.addEventListener("hashchange", followHash, { signal });
	window.addEventListener("resize", settle, { signal });
	reduced.addEventListener("change", settle, { signal });
	select(selected);
	followHash();
	cleanup = () => {
		controller.abort();
		cancelAnimationFrame(selectionFrame);
		tweens.forEach(tween => tween.kill());
		entries.forEach(entry => gsap.killTweensOf(entry.querySelector(".trip-expanded")));
		cleanup = undefined;
	};
};

document.addEventListener("astro:page-load", initFootprints);
document.addEventListener("astro:before-swap", () => cleanup?.());
if (document.readyState !== "loading") initFootprints();
