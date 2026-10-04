type Pin = { element: HTMLAnchorElement; id: string; name: string; region: string; country: string; lon: number; lat: number };
type Extent = { west: number; north: number; width: number; height: number };
type Point = { x: number; y: number };
let cleanup: (() => void) | undefined;

function initAtlas() {
	cleanup?.();
	const atlas = document.querySelector<HTMLElement>("[data-travel-atlas]");
	if (!atlas) return;
	const controller = new AbortController();
	const { signal } = controller;
	const directory = atlas.closest<HTMLElement>(".travel-directory")!;
	const explorer = directory.querySelector<HTMLElement>(".travel-explorer")!;
	const placeList = directory.querySelector<HTMLElement>("[data-place-list]")!;
	const wideLayout = window.matchMedia("(min-width: 761px)");
	const surface = atlas.querySelector<HTMLElement>(".atlas-surface")!;
	const land = atlas.querySelector<SVGElement>(".atlas-land")!;
	const points = atlas.querySelector<HTMLElement>(".atlas-points")!;
	const reset = atlas.querySelector<HTMLButtonElement>(".atlas-reset")!;
	const zoomIn = atlas.querySelector<HTMLButtonElement>('[data-atlas-zoom="in"]')!;
	const zoomOut = atlas.querySelector<HTMLButtonElement>('[data-atlas-zoom="out"]')!;
	const views = [...atlas.querySelectorAll<HTMLButtonElement>("[data-atlas-view]")];
	const pins: Pin[] = [...atlas.querySelectorAll<HTMLAnchorElement>("[data-atlas-place]")].map(element => ({
		element, id: element.dataset.atlasPlace!, name: element.dataset.name!, region: element.dataset.region!, country: element.dataset.country!,
		lon: Number(element.dataset.longitude), lat: Number(element.dataset.latitude),
	}));
	if (!pins.length) return;
	const countryView = (country: string) => country === "中国" ? "china" : country === "日本" ? "japan" : country === "澳大利亚" ? "australia" : "southeast";
	let view = views[0]?.dataset.atlasView || "china";
	let selection = "";
	let pristine = true;
	let extent: Extent;
	let groups: Pin[][] = [];
	let renderFrame = 0;
	const minWidth = .12;
	const maxWidth = () => Math.min(115, 135 * extent.width / extent.height);
	const viewPins = () => pins.filter(pin => countryView(pin.country) === view);
	const fit = (members: Pin[]): Extent => {
		const lons = members.map(pin => pin.lon), lats = members.map(pin => pin.lat);
		const lon = (Math.min(...lons) + Math.max(...lons)) / 2, lat = (Math.min(...lats) + Math.max(...lats)) / 2;
		const aspect = surface.clientWidth / surface.clientHeight;
		const correction = Math.cos(lat * Math.PI / 180);
		const padding = Math.min(.28, 65 / surface.clientWidth);
		let width = Math.max(.15, (Math.max(...lons) - Math.min(...lons)) / (1 - padding * 2));
		let height = Math.max(.12, (Math.max(...lats) - Math.min(...lats)) / (1 - padding * 2));
		width = Math.max(width, height * aspect / correction);
		height = width * correction / aspect;
		return { west: lon - width / 2, north: lat + height / 2, width, height };
	};
	const constrain = () => {
		extent.west = Math.max(65, Math.min(180 - extent.width, extent.west));
		extent.north = Math.max(-60 + extent.height, Math.min(75, extent.north));
	};
	const project = (pin: Pin) => ({ x: (pin.lon - extent.west) / extent.width * 100, y: (extent.north - pin.lat) / extent.height * 100 });
	const render = () => {
		cancelAnimationFrame(renderFrame); renderFrame = 0;
		land.setAttribute("viewBox", `${extent.west} ${-extent.north} ${extent.width} ${extent.height}`);
		points.querySelectorAll(".atlas-cluster").forEach(element => element.remove());
		pins.forEach(pin => { pin.element.hidden = true; pin.element.removeAttribute("aria-current"); });
		groups = pins.filter(pin => { const p = project(pin); return p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100; }).map(pin => [pin]);
		// Compare group centers so a chain of nearby cities cannot swallow an entire coast.
		const centerOf = (group: Pin[]) => group.reduce((sum, pin) => { const p = project(pin); return { x: sum.x + p.x / group.length, y: sum.y + p.y / group.length }; }, { x: 0, y: 0 });
		for (let i = 0; i < groups.length; i++) {
			for (let j = i + 1; j < groups.length; j++) {
				const a = centerOf(groups[i]), b = centerOf(groups[j]);
				if (Math.abs(a.x - b.x) * surface.clientWidth / 100 < 56 && Math.abs(a.y - b.y) * surface.clientHeight / 100 < 56) {
					groups[i].push(...groups[j]); groups.splice(j, 1); i = -1; break;
				}
			}
		}
		groups.forEach((group, index) => {
			if (group.length === 1) {
				const pin = group[0], p = project(pin);
				pin.element.style.left = `${p.x}%`; pin.element.style.top = `${p.y}%`; pin.element.hidden = false;
				if (pin.id === selection) pin.element.setAttribute("aria-current", "location");
				return;
			}
			const center = centerOf(group);
			const cluster = document.createElement("button");
			cluster.type = "button"; cluster.className = "atlas-cluster"; cluster.dataset.cluster = String(index);
			cluster.style.left = `${center.x}%`; cluster.style.top = `${center.y}%`;
			cluster.setAttribute("aria-label", `${group.map(pin => pin.name).join("、")}，${group.length} 处足迹`);
			cluster.textContent = String(group.length);
			const label = document.createElement("span"); label.className = "atlas-cluster-label";
			label.textContent = new Set(group.map(pin => pin.region)).size === 1 ? group[0].region : "处足迹";
			cluster.append(label); points.append(cluster);
		});
		views.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.atlasView === view)));
		zoomIn.disabled = extent.width <= minWidth + .000001;
		zoomOut.disabled = extent.width >= maxWidth() - .000001;
	};
	const scheduleRender = () => { if (!renderFrame) renderFrame = requestAnimationFrame(render); };
	const resetView = () => { pristine = true; extent = fit(viewPins()); constrain(); render(); };
	const openGroup = (members: Pin[], focus?: Pin) => {
		let next = fit(members);
		// Panning exposes surrounding cities too. Keep drill-down strictly inward even
		// when those neighbors change the cluster membership between zoom levels.
		if (next.width >= extent.width * .9) {
			const width = Math.max(minWidth, extent.width / 2), height = extent.height * width / extent.width;
			next = { west: (focus?.lon ?? next.west + next.width / 2) - width / 2,
				north: (focus?.lat ?? next.north - next.height / 2) + height / 2, width, height };
		}
		extent = next; pristine = false; constrain(); render();
	};
	const markDirectory = () => document.querySelectorAll<HTMLAnchorElement>("[data-map-link]").forEach(link => {
		if (link.dataset.mapLink === selection) link.setAttribute("aria-current", "location"); else link.removeAttribute("aria-current");
	});
	const scrollDirectory = (target: HTMLElement, category = false) => {
		const panel = placeList.getBoundingClientRect(), item = target.getBoundingClientRect();
		const headingHeight = target.closest(".place-section")?.querySelector("h2")?.getBoundingClientRect().height || 72;
		if (category || item.top < panel.top + headingHeight + 12 || item.bottom > panel.bottom - 12) {
			const offset = category ? 0 : headingHeight + (panel.height - headingHeight - item.height) / 2;
			placeList.scrollTo({ top: placeList.scrollTop + item.top - panel.top - offset, behavior: "instant" });
		}
	};
	// One gesture crosses page → docked directory → page, consuming each pixel once.
	// The left column keeps native page scrolling and can leave the directory at any time.
	const scrollLinked = (delta: number) => {
		const headerHeight = document.querySelector<HTMLElement>(".site-header")?.getBoundingClientRect().height || 0;
		const dock = Math.max(0, window.scrollY + explorer.getBoundingClientRect().top - headerHeight - 24);
		let pageTop = window.scrollY;
		let listTop = placeList.scrollTop;
		const listEnd = Math.max(0, placeList.scrollHeight - placeList.clientHeight);
		if (delta > 0) {
			if (pageTop < dock) {
				const step = Math.min(delta, dock - pageTop);
				pageTop += step; delta -= step;
			}
			if (pageTop <= dock + 1) {
				const step = Math.min(delta, listEnd - listTop);
				listTop += step; delta -= step;
			}
		} else {
			if (pageTop > dock) {
				const step = Math.min(-delta, pageTop - dock);
				pageTop -= step; delta += step;
			}
			if (pageTop >= dock - 1) {
				const step = Math.min(-delta, listTop);
				listTop -= step; delta += step;
			}
		}
		placeList.scrollTo({ top: listTop, behavior: "instant" });
		window.scrollTo({ top: pageTop + delta, behavior: "instant" });
	};
	placeList.addEventListener("wheel", event => {
		if (!wideLayout.matches || event.ctrlKey || event.shiftKey || !event.cancelable || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
		event.preventDefault();
		const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? placeList.clientHeight : 1;
		scrollLinked(event.deltaY * unit);
	}, { signal, passive: false });
	placeList.addEventListener("keydown", event => {
		if (!wideLayout.matches || event.ctrlKey || event.metaKey || event.altKey) return;
		const page = Math.max(40, placeList.clientHeight - 88);
		const delta = { ArrowDown: 40, ArrowUp: -40, PageDown: page, PageUp: -page, " ": event.shiftKey ? -page : page }[event.key];
		if (delta === undefined) return;
		event.preventDefault(); scrollLinked(delta);
	}, { signal });
	const reveal = (id: string) => {
		const pin = pins.find(item => item.id === id);
		if (!pin) return;
		selection = id; view = countryView(pin.country); resetView();
		for (let depth = 0; pin.element.hidden && depth < 8; depth++) {
			const group = groups.find(group => group.includes(pin));
			if (!group) break;
			openGroup(group, pin);
		}
		markDirectory();
	};
	// Pan and zoom share the same geographic viewport; SVG and points move together.
	const zoomAt = (factor: number, anchor: Point) => {
		const width = Math.max(minWidth, Math.min(maxWidth(), extent.width / factor));
		const height = extent.height * width / extent.width;
		extent = { west: extent.west + (extent.width - width) * anchor.x,
			north: extent.north - (extent.height - height) * anchor.y, width, height };
		pristine = false; constrain(); scheduleRender();
	};
	const pan = (dx: number, dy: number) => {
		extent.west -= dx / surface.clientWidth * extent.width;
		extent.north += dy / surface.clientHeight * extent.height;
		pristine = false; constrain(); scheduleRender();
	};
	const anchorAt = (p: Point): Point => {
		const box = surface.getBoundingClientRect();
		return { x: (p.x - box.left) / box.width, y: (p.y - box.top) / box.height };
	};
	const center = { x: .5, y: .5 };
	views.forEach(button => button.addEventListener("click", () => { view = button.dataset.atlasView!; resetView(); }, { signal }));
	reset.addEventListener("click", resetView, { signal });
	zoomIn.addEventListener("click", () => zoomAt(1.6, center), { signal });
	zoomOut.addEventListener("click", () => zoomAt(1 / 1.6, center), { signal });
	surface.addEventListener("wheel", event => {
		// Normal scrolling belongs to the page; trackpad pinch still zooms the map.
		if (!event.ctrlKey) return;
		event.preventDefault();
		const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? surface.clientHeight : 1);
		zoomAt(Math.exp(-Math.max(-240, Math.min(240, delta)) * .003), anchorAt({ x: event.clientX, y: event.clientY }));
	}, { signal, passive: false });
	surface.addEventListener("keydown", event => {
		if (event.target !== surface) return;
		const deltas: Record<string, Point> = { ArrowLeft: { x: 60, y: 0 }, ArrowRight: { x: -60, y: 0 }, ArrowUp: { x: 0, y: 60 }, ArrowDown: { x: 0, y: -60 } };
		if (deltas[event.key]) { event.preventDefault(); pan(deltas[event.key].x, deltas[event.key].y); }
		else if (["+", "=", "-", "Home"].includes(event.key)) { event.preventDefault(); if (event.key === "Home") resetView(); else zoomAt(event.key === "-" ? 1 / 1.6 : 1.6, center); }
	}, { signal });
	const pointers = new Map<number, Point>();
	let origin: Point | undefined;
	let dragging = false;
	let suppressClickUntil = 0;
	const gesture = () => {
		const active = [...pointers.values()];
		return { midpoint: active.length === 1 ? active[0] : { x: (active[0].x + active[1].x) / 2, y: (active[0].y + active[1].y) / 2 },
			distance: active.length > 1 ? Math.hypot(active[0].x - active[1].x, active[0].y - active[1].y) : 0 };
	};
	surface.addEventListener("pointerdown", event => {
		suppressClickUntil = 0;
		if (event.button !== 0 || (event.target as Element).closest(".atlas-controls")) return;
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		origin = { x: event.clientX, y: event.clientY };
		if (pointers.size > 1) { dragging = true; surface.setPointerCapture(event.pointerId); }
	}, { signal });
	surface.addEventListener("pointermove", event => {
		if (!pointers.has(event.pointerId)) return;
		const before = gesture();
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (!dragging && origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) < 4) return;
		dragging = true; surface.dataset.dragging = "";
		for (const id of pointers.keys()) if (!surface.hasPointerCapture(id)) surface.setPointerCapture(id);
		const after = gesture();
		pan(after.midpoint.x - before.midpoint.x, after.midpoint.y - before.midpoint.y);
		if (before.distance > 0 && after.distance > 0) zoomAt(after.distance / before.distance, anchorAt(after.midpoint));
	}, { signal });
	const endPointer = (event: PointerEvent) => {
		if (!pointers.has(event.pointerId)) return;
		if (dragging) suppressClickUntil = performance.now() + 350;
		pointers.delete(event.pointerId);
		if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);
		origin = [...pointers.values()][0];
		if (!pointers.size) { dragging = false; delete surface.dataset.dragging; }
	};
	window.addEventListener("pointerup", endPointer, { signal });
	window.addEventListener("pointercancel", endPointer, { signal });
	surface.addEventListener("dragstart", event => event.preventDefault(), { signal });
	surface.addEventListener("click", event => {
		if (event.detail > 0 && performance.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
	}, { signal, capture: true });
	points.addEventListener("click", event => {
		const target = (event.target as Element).closest<HTMLElement>("[data-cluster], [data-atlas-place]");
		if (!target) return;
		if (target.dataset.cluster !== undefined) {
			const group = groups[Number(target.dataset.cluster)];
			openGroup(group);
			surface.focus({ preventScroll: true });
		} else {
			event.preventDefault(); selection = target.dataset.atlasPlace!;
			pins.forEach(pin => { if (pin.id === selection) pin.element.setAttribute("aria-current", "location"); else pin.element.removeAttribute("aria-current"); });
			markDirectory();
			const entry = document.getElementById(`footprint-${selection}`);
			history.replaceState(history.state, "", `#footprint-${selection}`);
			if (entry) {
				entry.focus({ preventScroll: true });
				if (wideLayout.matches) scrollDirectory(entry);
				else entry.scrollIntoView({ block: "center", behavior: "instant" });
			}
		}
	}, { signal });
	document.querySelectorAll<HTMLAnchorElement>("[data-map-link]").forEach(link => link.addEventListener("click", event => {
		event.preventDefault(); reveal(link.dataset.mapLink!);
		history.replaceState(history.state, "", `#footprint-${selection}`);
		if (!wideLayout.matches) {
			atlas.scrollIntoView({ block: "start", behavior: "instant" });
			pins.find(pin => pin.id === selection)?.element.focus({ preventScroll: true });
		}
	}, { signal }));
	directory.querySelectorAll<HTMLAnchorElement>('.travel-index a[href="#places-china"], .travel-index a[href="#places-overseas"]').forEach(link => link.addEventListener("click", event => {
		if (!wideLayout.matches) return;
		const target = document.querySelector<HTMLElement>(link.hash);
		if (!target) return;
		event.preventDefault(); scrollDirectory(target, true);
		history.replaceState(history.state, "", link.hash);
	}, { signal }));
	const followHash = () => {
		if (!location.hash.startsWith("#footprint-")) return;
		reveal(location.hash.slice(11));
		const target = document.getElementById(location.hash.slice(1));
		if (wideLayout.matches && target) scrollDirectory(target);
	};
	window.addEventListener("hashchange", followHash, { signal });
	let previousWidth = surface.clientWidth;
	let previousHeight = surface.clientHeight;
	const resize = new ResizeObserver(() => {
		directory.style.setProperty("--places-height", `${Math.round(atlas.getBoundingClientRect().height)}px`);
		if (surface.clientWidth === previousWidth && surface.clientHeight === previousHeight) return;
		previousWidth = surface.clientWidth;
		previousHeight = surface.clientHeight;
		if (pristine) resetView(); else render();
	});
	resize.observe(surface);
	resize.observe(atlas);
	atlas.querySelector<HTMLElement>(".atlas-views")!.hidden = false;
	atlas.querySelector<HTMLElement>(".atlas-controls")!.hidden = false;
	surface.dataset.interactive = "";
	resetView(); followHash();
	cleanup = () => { controller.abort(); resize.disconnect(); cancelAnimationFrame(renderFrame); cleanup = undefined; };
}

document.addEventListener("astro:page-load", initAtlas);
document.addEventListener("astro:before-swap", () => cleanup?.());
if (document.readyState !== "loading") initAtlas();
