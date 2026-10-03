import { gsap } from "gsap";
import { radioChannels, radioCover, defaultRadioCover } from "../data/radio";

function initRadio() {
  const candidate = document.querySelector<HTMLElement>("[data-radio]");
  if (!candidate || candidate.dataset.ready) return;
  const root = candidate;
  root.dataset.ready = "true";
  const el = <T extends HTMLElement>(name: string) => root.querySelector<T>(`[data-${name}]`)!;
  const audio = el<HTMLAudioElement>("audio");
  const seek = el<HTMLInputElement>("seek");
  const volume = el<HTMLInputElement>("volume");
  const panel = el("panel");
  const playlist = el("playlist");
  const launcher = el("launcher");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const regions = {
    list: { element: el("list-region"), button: el("list-toggle"), open: false },
    channel: { element: el("channel-region"), button: el("channel-toggle"), open: false },
  };
  let opened = false;
  let panelMotion: gsap.core.Timeline | undefined;
  let layoutMotion: gsap.core.Timeline | undefined;
  let entrance: gsap.core.Tween | undefined;
  let gainMotion: gsap.core.Tween | undefined;
  const resizeTimer = gsap.delayedCall(.12, () => settleSize()).pause();
  const openButton = el<HTMLButtonElement>("open");
  const playButtons = root.querySelectorAll<HTMLButtonElement>("[data-play]");
  const trackButtons = root.querySelectorAll<HTMLButtonElement>("[data-track]");
  const channelButtons = root.querySelectorAll<HTMLButtonElement>("[data-channel]");
  const failedCovers = new Set<string>();
  const storageKey = "magic-field-radio";
  let channel = radioChannels[0];
  let index = 0;
  let userVolume = .45;
  let previousVolume = .45;
  let wantsPlay = false;
  let requestId = 0;
  let hasError = false;
  let changingPage = false;
  let switchPending = false;
  let pendingSeek = 0;
  const gain = { value: 1 };
  const currentTrack = () => channel.tracks[index];
  let duration = currentTrack().duration;
  const format = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  const save = () => {
    try { localStorage.setItem(storageKey, JSON.stringify({ channel: channel.id, id: currentTrack().id, volume: userVolume })); } catch { /* Playback also works when storage is unavailable. */ }
  };
  try {
    const remembered = JSON.parse(localStorage.getItem(storageKey) || "null");
    // Older preferences stored only a track ID. Keep those listeners in the vocal channel.
    channel = radioChannels.find(item => item.id === remembered?.channel)
      || radioChannels.find(item => item.tracks.some(track => track.id === remembered?.id)) || channel;
    index = Math.max(0, channel.tracks.findIndex(track => track.id === remembered?.id));
    if (typeof remembered?.volume === "number" && Number.isFinite(remembered.volume)) userVolume = Math.min(1, Math.max(0, remembered.volume));
  } catch { /* Ignore invalid or unavailable preferences. */ }
  previousVolume = userVolume || .45;
  const applyVolume = () => { audio.volume = Math.min(1, Math.max(0, userVolume * gain.value)); };
  applyVolume();

  function updateVolume() {
    const muted = audio.muted || userVolume === 0;
    root.toggleAttribute("data-muted", muted);
    volume.value = String(audio.muted ? 0 : userVolume);
    volume.style.setProperty("--radio-progress", `${Number(volume.value) * 100}%`);
    volume.setAttribute("aria-valuetext", `${Math.round(Number(volume.value) * 100)}%`);
    el("mute").setAttribute("aria-label", muted ? "取消静音" : "静音");
    el("mute").setAttribute("aria-pressed", String(muted));
  }
  function updateProgress() {
    const current = switchPending ? 0 : Math.min(audio.currentTime || 0, duration);
    seek.value = String(current);
    seek.style.setProperty("--radio-progress", `${current / duration * 100}%`);
    seek.setAttribute("aria-valuetext", `${format(current)}，共 ${format(duration)}`);
    el("current").textContent = format(current);
  }
  function updatePlayback() {
    const playing = !audio.paused && !hasError;
    root.toggleAttribute("data-playing", playing);
    root.toggleAttribute("data-active", wantsPlay && !hasError);
    playButtons.forEach(button => button.setAttribute("aria-label", hasError ? "重试播放" : wantsPlay ? "暂停音乐" : "播放音乐"));
    el("mini-status").textContent = hasError ? "点开重试" : playing ? "正在播放" : wantsPlay ? "正在加载" : "听一会儿";
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }
  function message(text: string) { el("message").textContent = text; }
  function failure() {
    gainMotion?.kill(); gain.value = 1; applyVolume();
    wantsPlay = false;
    hasError = true;
    root.setAttribute("data-error", "");
    message("这首暂时无法播放，点播放重试或换一首。");
    updatePlayback();
  }
  const coverFor = (track = currentTrack()) => failedCovers.has(radioCover(track)) ? defaultRadioCover : radioCover(track);
  function updateMetadata() {
    if (!("mediaSession" in navigator) || !("MediaMetadata" in window)) return;
    const track = currentTrack(), cover = coverFor(track);
    navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.artist, album: `在野电台 · ${channel.title}`, artwork: [{ src: new URL(cover, location.origin).href, sizes: cover.endsWith('.svg') ? "any" : "480x480", type: cover.endsWith('.svg') ? "image/svg+xml" : "image/webp" }] });
  }
  function setCover(image: HTMLImageElement, source: string) {
    if (image.getAttribute("src") !== source) image.src = source;
  }
  function updateTrack() {
    const track = currentTrack();
    root.dataset.channel = channel.id;
    root.dataset.track = track.id;
    duration = track.duration;
    el("title").textContent = track.title;
    el("mood").textContent = track.mood;
    el("artist").textContent = track.artist;
    el("channel-title").textContent = channel.title;
    el("channel-toggle").setAttribute("aria-label", `切换频道，当前${channel.title}`);
    el("track-count").textContent = `${channel.tracks.length} 首`;
    playlist.setAttribute("aria-label", `${channel.title}曲目`);
    channelButtons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.channel === channel.id)));
    trackButtons.forEach(button => {
      button.closest('li')!.hidden = button.closest<HTMLElement>('[data-track-channel]')!.dataset.trackChannel !== channel.id;
      if (button.dataset.track === track.id) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
    const cover = el<HTMLImageElement>("cover");
    setCover(cover, coverFor(track));
    cover.alt = `${track.title}封面`;
    setCover(el<HTMLImageElement>("disc-cover"), coverFor(track));
    seek.max = String(duration);
    el("duration").textContent = format(duration);
    updateMetadata(); updateProgress();
  }
  // One failed URL falls back consistently in the record, panel and playlist.
  function fallbackCover(image: HTMLImageElement) {
    const source = image.getAttribute("src");
    if (!source || source === defaultRadioCover) return;
    failedCovers.add(source);
    root.querySelectorAll<HTMLImageElement>('img').forEach(item => {
      if (item.getAttribute("src") === source) setCover(item, defaultRadioCover);
    });
    updateMetadata();
  }
  root.addEventListener("error", event => {
    if (event.target instanceof HTMLImageElement) fallbackCover(event.target);
  }, true);
  root.querySelectorAll<HTMLImageElement>('img').forEach(image => {
    if (image.complete && !image.naturalWidth) fallbackCover(image);
  });

  async function play(fadeIn = false) {
    if (switchPending) { commitSelection(true); return; }
    const thisRequest = ++requestId;
    const retry = hasError;
    hasError = false;
    wantsPlay = true;
    root.removeAttribute("data-error");
    gainMotion?.kill(); gain.value = fadeIn ? 0 : 1; applyVolume();
    if (!audio.getAttribute("src") || retry) {
      audio.src = currentTrack().src;
      audio.load();
    }
    message("正在加载音乐…"); updatePlayback();
    try {
      await audio.play();
      if (thisRequest !== requestId) return;
      if (fadeIn) gainMotion = gsap.to(gain, { value: 1, duration: .48, ease: "sine.out", onUpdate: applyVolume });
      message("正在播放，慢慢听。"); updatePlayback();
    } catch (error) {
      if (thisRequest !== requestId) return;
      gain.value = 1; applyVolume();
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        wantsPlay = false; message("点播放按钮，开始听音乐。"); updatePlayback();
      } else failure();
    }
  }
  function commitSelection(shouldPlay: boolean) {
    gainMotion?.kill();
    audio.pause(); audio.removeAttribute("src"); audio.preload = "none"; audio.load();
    switchPending = false;
    gain.value = 1; applyVolume(); updateProgress();
    if (shouldPlay) void play(true);
    else { wantsPlay = false; message("让音乐陪你待一会儿。"); updatePlayback(); }
  }
  function pause() {
    requestId++; wantsPlay = false;
    gainMotion?.kill();
    if (switchPending) commitSelection(false);
    else { audio.pause(); gain.value = 1; applyVolume(); }
    if (!hasError) message("已暂停，随时接着听。");
    updatePlayback();
  }
  function selectTrack(next: number, shouldPlay = true) {
    const wasPlaying = !audio.paused && wantsPlay;
    requestId++; gainMotion?.kill(); switchPending = true;
    index = (next + channel.tracks.length) % channel.tracks.length;
    wantsPlay = shouldPlay; hasError = false; pendingSeek = 0;
    root.removeAttribute("data-error");
    updateTrack(); updatePlayback(); save();
    if (!reduced.matches && opened) {
      gsap.fromTo(el("cover"), { opacity: .35, scale: .94 }, { opacity: 1, scale: 1, duration: .4, ease: "power2.out", overwrite: true, clearProps: "opacity,transform" });
      gsap.fromTo(el("title"), { opacity: .4, y: 5 }, { opacity: 1, y: 0, duration: .35, ease: "power2.out", overwrite: true, clearProps: "opacity,transform" });
    }
    if (opened) animateRegions();
    if (wasPlaying && shouldPlay && !audio.muted) {
      gainMotion = gsap.to(gain, { value: 0, duration: .16, ease: "sine.inOut", onUpdate: applyVolume, onComplete: () => commitSelection(true) });
    } else commitSelection(shouldPlay);
  }
  function selectChannel(id: string) {
    const next = radioChannels.find(item => item.id === id);
    if (!next) return;
    const shouldPlay = wantsPlay;
    regions.channel.open = false;
    regions.channel.button.setAttribute("aria-expanded", "false");
    regions.channel.button.focus({ preventScroll: true });
    if (next === channel) { animateRegions(); return; }
    channel = next;
    playlist.scrollTop = 0;
    selectTrack(0, shouldPlay);
  }
  function targetSize(open: boolean) {
    const target = open ? panel : launcher;
    const hidden = target.hidden;
    target.hidden = false;
    const size = { width: target.offsetWidth + 2, height: target.offsetHeight + 2 };
    target.hidden = hidden;
    return size;
  }
  function settleRegions() {
    for (const region of Object.values(regions)) {
      region.element.hidden = !region.open;
      region.element.inert = !region.open;
      gsap.set(region.element, { height: "auto", opacity: 1 });
    }
  }
  function settleSize() {
    panelMotion?.kill(); layoutMotion?.kill();
    gsap.killTweensOf(root, "width,height,borderRadius");
    settleRegions();
    panel.hidden = !opened; launcher.hidden = opened;
    panel.inert = !opened; launcher.inert = opened;
    gsap.set([panel, launcher], { clearProps: "opacity,visibility,transform" });
    gsap.set(root, { ...targetSize(opened), borderRadius: opened ? 22 : 34 });
  }
  function finishEntrance() {
    entrance?.kill(); entrance = undefined;
    gsap.set(root, { clearProps: "opacity,transform" });
    root.dataset.entered = "true";
  }
  function setOpen(open: boolean, restoreFocus = true) {
    if (open === opened) return;
    finishEntrance(); opened = open;
    panelMotion?.kill(); layoutMotion?.kill(); settleRegions();
    const panelWasHidden = panel.hidden, launcherWasHidden = launcher.hidden;
    panel.hidden = false; launcher.hidden = false;
    panel.inert = !open; launcher.inert = open;
    openButton.setAttribute("aria-expanded", String(open));
    if (open) el<HTMLButtonElement>("close").focus({ preventScroll: true });
    else if (restoreFocus) openButton.focus({ preventScroll: true });
    if (reduced.matches) { settleSize(); if (open) el<HTMLButtonElement>("close").focus({ preventScroll: true }); else if (restoreFocus) openButton.focus({ preventScroll: true }); return; }
    if (panelWasHidden) gsap.set(panel, { autoAlpha: 0, y: 16 });
    if (launcherWasHidden) gsap.set(launcher, { autoAlpha: 0, y: 5 });
    // Only this fixed, contained surface changes size; the page never reflows.
    panelMotion = gsap.timeline({ onComplete: () => {
      panel.hidden = !opened; launcher.hidden = opened;
      gsap.set([panel, launcher], { clearProps: "opacity,visibility,transform" });
      if (document.activeElement === document.body) {
        if (opened) el<HTMLButtonElement>("close").focus({ preventScroll: true });
        else if (restoreFocus) openButton.focus({ preventScroll: true });
      }
    } });
    panelMotion.to(root, { ...targetSize(open), borderRadius: open ? 22 : 34, duration: open ? .62 : .5, ease: "power3.inOut", overwrite: "auto" }, 0);
    panelMotion.to(open ? launcher : panel, { autoAlpha: 0, y: open ? -7 : 15, duration: .18, ease: "power2.out" }, 0);
    panelMotion.to(open ? panel : launcher, { autoAlpha: 1, y: 0, duration: open ? .38 : .3, ease: "power2.out" }, open ? .18 : .17);
  }
  function animateRegions() {
    layoutMotion?.kill();
    if (reduced.matches || !opened) { settleSize(); return; }
    const items = Object.values(regions).map(region => ({ ...region, height: region.element.hidden ? 0 : region.element.offsetHeight, opacity: region.element.hidden ? 0 : Number(gsap.getProperty(region.element, "opacity")) }));
    // Measure natural destinations together, then restore the visible intermediate sizes.
    for (const item of items) {
      item.element.hidden = false; item.element.inert = !item.open;
      gsap.set(item.element, { height: item.open ? "auto" : 0 });
    }
    const heights = items.map(item => item.element.offsetHeight);
    const destination = targetSize(true);
    layoutMotion = gsap.timeline({ onComplete: () => { settleRegions(); gsap.set(root, targetSize(opened)); } });
    items.forEach((item, i) => {
      gsap.set(item.element, { height: item.height, opacity: item.opacity });
      layoutMotion!.to(item.element, { height: heights[i], opacity: item.open ? 1 : 0, duration: .48, ease: "power3.inOut" }, 0);
    });
    layoutMotion.to(root, { ...destination, duration: .48, ease: "power3.inOut", overwrite: "auto" }, 0);
  }
  function setRegion(name: keyof typeof regions, open: boolean) {
    const region = regions[name];
    region.open = open;
    region.button.setAttribute("aria-expanded", String(open));
    if (!open && region.element.contains(document.activeElement)) region.button.focus({ preventScroll: true });
    animateRegions();
    if (name === "list" && open) {
      const active = playlist.querySelector<HTMLElement>('[aria-current="true"]');
      playlist.scrollTop = Math.max(0, (active?.offsetTop || 0) - playlist.offsetTop - 45);
    }
  }
  openButton.addEventListener("click", () => setOpen(true));
  el("close").addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !opened) return;
    event.preventDefault();
    if (regions.channel.open) setRegion("channel", false);
    else setOpen(false);
  });
  document.addEventListener("pointerdown", event => { if (opened && event.target instanceof Node && !root.contains(event.target)) setOpen(false, false); });
  root.addEventListener("pointerdown", finishEntrance, { once: true });
  root.addEventListener("focusin", finishEntrance, { once: true });
  playButtons.forEach(button => button.addEventListener("click", () => wantsPlay ? pause() : void play()));
  el("previous").addEventListener("click", () => selectTrack(index - 1));
  el("next").addEventListener("click", () => selectTrack(index + 1));
  trackButtons.forEach(button => button.addEventListener("click", () => {
    const next = channel.tracks.findIndex(track => track.id === button.dataset.track);
    if (next >= 0) selectTrack(next);
  }));
  channelButtons.forEach(button => button.addEventListener("click", () => selectChannel(button.dataset.channel!)));
  regions.list.button.addEventListener("click", () => setRegion("list", !regions.list.open));
  regions.channel.button.addEventListener("click", () => setRegion("channel", !regions.channel.open));
  window.addEventListener("resize", () => resizeTimer.restart(true));
  reduced.addEventListener("change", () => {
    if (reduced.matches) {
      finishEntrance(); gsap.killTweensOf([el("cover"), el("title")]);
      gsap.set([el("cover"), el("title")], { clearProps: "opacity,transform" });
    }
    settleSize();
  });
  seek.addEventListener("input", () => {
    const target = Number(seek.value);
    if (switchPending) commitSelection(wantsPlay);
    if (audio.readyState >= 1) audio.currentTime = target;
    else {
      pendingSeek = target;
      if (!audio.getAttribute("src")) { audio.src = currentTrack().src; audio.preload = "metadata"; audio.load(); }
    }
    el("current").textContent = format(target);
    seek.style.setProperty("--radio-progress", `${target / duration * 100}%`);
    seek.setAttribute("aria-valuetext", `${format(target)}，共 ${format(duration)}`);
  });
  volume.addEventListener("input", () => {
    audio.muted = false; userVolume = Number(volume.value);
    if (userVolume > 0) previousVolume = userVolume;
    applyVolume(); updateVolume(); save();
  });
  el("mute").addEventListener("click", () => {
    if (audio.muted || userVolume === 0) { audio.muted = false; userVolume = previousVolume || .45; applyVolume(); }
    else audio.muted = true;
    updateVolume(); save();
  });
  audio.addEventListener("timeupdate", updateProgress);
  audio.addEventListener("loadedmetadata", () => {
    if (switchPending) return;
    if (Number.isFinite(audio.duration) && audio.duration > 0) duration = audio.duration;
    seek.max = String(duration); el("duration").textContent = format(duration);
    if (pendingSeek) { audio.currentTime = Math.min(pendingSeek, duration); pendingSeek = 0; }
    updateProgress();
  });
  audio.addEventListener("playing", () => { hasError = false; root.removeAttribute("data-error"); message("正在播放，慢慢听。"); updatePlayback(); });
  audio.addEventListener("pause", () => {
    if (audio.paused && !changingPage && !switchPending) { wantsPlay = false; if (!hasError) message("已暂停，随时接着听。"); }
    updatePlayback();
  });
  audio.addEventListener("waiting", () => { if (wantsPlay) message("正在缓冲音乐…"); });
  audio.addEventListener("error", () => { if (audio.getAttribute("src") && !switchPending) failure(); });
  audio.addEventListener("ended", () => { if (!switchPending) selectTrack(index + 1); });
  audio.addEventListener("volumechange", updateVolume);
  // Astro preserves this node; older browsers may pause media when moving it.
  document.addEventListener("astro:before-swap", () => { changingPage = true; finishEntrance(); });
  document.addEventListener("astro:after-swap", () => {
    changingPage = false;
    if (wantsPlay && audio.paused && !hasError && !switchPending) void play();
    updatePlayback();
  });
  if ("mediaSession" in navigator) {
    const actions: Partial<Record<MediaSessionAction, MediaSessionActionHandler>> = {
      play: () => { void play(); }, pause, previoustrack: () => selectTrack(index - 1), nexttrack: () => selectTrack(index + 1),
      seekto: details => { if (details.seekTime !== undefined && audio.readyState >= 1) audio.currentTime = Math.min(details.seekTime, duration); },
    };
    for (const [action, handler] of Object.entries(actions)) {
      try { navigator.mediaSession.setActionHandler(action as MediaSessionAction, handler!); } catch { /* Some browsers expose only a subset of controls. */ }
    }
  }
  updateTrack(); updateVolume(); updatePlayback();
  root.hidden = false; settleSize();
  if (reduced.matches) finishEntrance();
  else entrance = gsap.fromTo(root, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .9, delay: Math.max(0, .62 - performance.now() / 1000), ease: "power2.out", onComplete: finishEntrance });
}

document.addEventListener("astro:page-load", initRadio);
initRadio();
