import { gsap } from "gsap";
import { radioTracks } from "../data/radio";

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
  const listRegion = el("list-region");
  const launcher = el("launcher");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let opened = false;
  let listOpened = false;
  let panelMotion: gsap.core.Timeline | undefined;
  let listMotion: gsap.core.Timeline | undefined;
  const resizeTimer = gsap.delayedCall(.12, () => settleSize()).pause();
  const openButton = el<HTMLButtonElement>("open");
  const playButtons = root.querySelectorAll<HTMLButtonElement>("[data-play]");
  const trackButtons = root.querySelectorAll<HTMLButtonElement>("[data-track]");
  const storageKey = "magic-field-radio";
  let index = 0;
  let previousVolume = .45;
  let wantsPlay = false;
  let requestId = 0;
  let hasError = false;
  let changingPage = false;
  let duration = radioTracks[0].duration;
  let pendingSeek = 0;
  const format = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  const save = () => {
    try { localStorage.setItem(storageKey, JSON.stringify({ id: radioTracks[index].id, volume: audio.volume })); } catch { /* Playback also works when storage is unavailable. */ }
  };
  try {
    const remembered = JSON.parse(localStorage.getItem(storageKey) || "null");
    const found = radioTracks.findIndex((track) => track.id === remembered?.id);
    if (found >= 0) index = found;
    if (typeof remembered?.volume === "number" && Number.isFinite(remembered.volume)) previousVolume = Math.min(1, Math.max(0, remembered.volume));
  } catch { /* Ignore invalid or unavailable preferences. */ }
  audio.volume = previousVolume;

  function updateVolume() {
    const muted = audio.muted || audio.volume === 0;
    root.toggleAttribute("data-muted", muted);
    volume.value = String(audio.muted ? 0 : audio.volume);
    volume.style.setProperty("--radio-progress", `${Number(volume.value) * 100}%`);
    volume.setAttribute("aria-valuetext", `${Math.round(Number(volume.value) * 100)}%`);
    el("mute").setAttribute("aria-label", muted ? "取消静音" : "静音");
    el("mute").setAttribute("aria-pressed", String(muted));
  }
  function updateProgress() {
    const current = Math.min(audio.currentTime || 0, duration);
    seek.value = String(current);
    seek.style.setProperty("--radio-progress", `${current / duration * 100}%`);
    seek.setAttribute("aria-valuetext", `${format(current)}，共 ${format(duration)}`);
    el("current").textContent = format(current);
  }
  function updatePlayback() {
    const playing = !audio.paused && !hasError;
    root.toggleAttribute("data-playing", playing);
    root.toggleAttribute("data-active", wantsPlay && !hasError);
    playButtons.forEach((button) => button.setAttribute("aria-label", hasError ? "重试播放" : wantsPlay ? "暂停音乐" : "播放音乐"));
    el("mini-status").textContent = hasError ? "点开重试" : playing ? "正在播放" : wantsPlay ? "正在加载" : "听一会儿";
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }
  function message(text: string) { el("message").textContent = text; }
  function failure() {
    wantsPlay = false;
    hasError = true;
    root.setAttribute("data-error", "");
    message("这首暂时无法播放，点播放重试或换一首。");
    updatePlayback();
  }
  function updateTrack() {
    const track = radioTracks[index];
    duration = track.duration;
    el("title").textContent = track.title;
    el("mood").textContent = track.mood;
    el("artist").textContent = track.artist;
    const cover = el<HTMLImageElement>("cover");
    cover.src = track.cover;
    cover.alt = `${track.title}封面`;
    el<HTMLImageElement>("disc-cover").src = track.cover;
    seek.max = String(duration);
    el("duration").textContent = format(duration);
    trackButtons.forEach((button, i) => i === index ? button.setAttribute("aria-current", "true") : button.removeAttribute("aria-current"));
    if ("mediaSession" in navigator && "MediaMetadata" in window) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.artist, album: "在野电台 · AI 生成", artwork: [{ src: new URL(track.cover, location.origin).href, sizes: "480x480", type: "image/webp" }] });
    }
    updateProgress();
  }
  async function play() {
    const thisRequest = ++requestId;
    const retry = hasError;
    hasError = false;
    wantsPlay = true;
    root.removeAttribute("data-error");
    if (!audio.getAttribute("src") || retry) {
      audio.src = radioTracks[index].src;
      audio.load();
    }
    message("正在加载音乐…");
    updatePlayback();
    try {
      await audio.play();
      if (thisRequest !== requestId) return;
      message("正在播放，慢慢听。");
      updatePlayback();
    } catch (error) {
      if (thisRequest !== requestId) return;
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        wantsPlay = false;
        message("点播放按钮，开始听音乐。");
        updatePlayback();
      } else failure();
    }
  }
  function pause() {
    requestId++;
    wantsPlay = false;
    audio.pause();
    if (!hasError) message("已暂停，随时接着听。");
    updatePlayback();
  }
  function selectTrack(next: number) {
    pause();
    index = (next + radioTracks.length) % radioTracks.length;
    hasError = false;
    pendingSeek = 0;
    audio.removeAttribute("src");
    audio.load();
    updateTrack();
    if (!reduced.matches && opened) {
      gsap.fromTo(el("cover"), { opacity: .35, scale: .94 }, { opacity: 1, scale: 1, duration: .4, ease: "power2.out", overwrite: true });
      gsap.fromTo(el("title"), { opacity: .4, y: 5 }, { opacity: 1, y: 0, duration: .35, ease: "power2.out", overwrite: true });
    }
    if (opened) {
      if (listMotion?.isActive()) setList(listOpened);
      else gsap.to(root, { ...targetSize(true), duration: reduced.matches ? 0 : .35, ease: "power2.out", overwrite: "auto" });
    }
    save();
    void play();
  }
  function targetSize(open: boolean) {
    const target = open ? panel : launcher;
    const hidden = target.hidden;
    target.hidden = false;
    const size = { width: target.offsetWidth + 2, height: target.offsetHeight + 2 };
    target.hidden = hidden;
    return size;
  }
  function settleSize() {
    panelMotion?.kill(); listMotion?.kill();
    listRegion.hidden = !listOpened;
    gsap.set(listRegion, { height: "auto", opacity: 1 });
    panel.hidden = !opened; launcher.hidden = opened;
    panel.inert = !opened; launcher.inert = opened;
    gsap.set([panel, launcher], { clearProps: "opacity,visibility,transform" });
    gsap.set(root, { ...targetSize(opened), borderRadius: opened ? 22 : 34 });
  }
  function setOpen(open: boolean, restoreFocus = true) {
    if (open === opened) return;
    opened = open;
    panelMotion?.kill();
    listMotion?.kill();
    listRegion.hidden = !listOpened;
    gsap.set(listRegion, { height: "auto", opacity: 1 });
    const panelWasHidden = panel.hidden;
    const launcherWasHidden = launcher.hidden;
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
      if (document.activeElement === document.body || root.contains(document.activeElement)) {
        if (opened) el<HTMLButtonElement>("close").focus({ preventScroll: true });
        else if (restoreFocus) openButton.focus({ preventScroll: true });
      }
    } });
    panelMotion.to(root, { ...targetSize(open), borderRadius: open ? 22 : 34, duration: open ? .62 : .5, ease: "power3.inOut", overwrite: "auto" }, 0);
    panelMotion.to(open ? launcher : panel, { autoAlpha: 0, y: open ? -7 : 15, duration: .18, ease: "power2.out" }, 0);
    panelMotion.to(open ? panel : launcher, { autoAlpha: 1, y: 0, duration: open ? .38 : .3, ease: "power2.out" }, open ? .18 : .17);
  }
  function setList(open: boolean) {
    listOpened = open;
    listMotion?.kill();
    const wasHidden = listRegion.hidden;
    const currentHeight = wasHidden ? 0 : listRegion.getBoundingClientRect().height;
    const panelBase = panel.offsetHeight - currentHeight;
    listRegion.hidden = false;
    listRegion.inert = !open;
    el("list-toggle").setAttribute("aria-expanded", String(open));
    if (reduced.matches) { settleSize(); return; }
    const fullHeight = playlist.offsetHeight + 6;
    const targetHeight = open ? fullHeight : 0;
    gsap.set(listRegion, { height: currentHeight });
    if (wasHidden) gsap.set(listRegion, { opacity: 0 });
    listMotion = gsap.timeline({ onComplete: () => {
      listRegion.hidden = !listOpened;
      gsap.set(listRegion, { height: "auto", opacity: 1 });
    } });
    listMotion.to(listRegion, { height: targetHeight, opacity: open ? 1 : 0, duration: .48, ease: "power3.inOut" }, 0);
    listMotion.to(root, { height: Math.min(panelBase + targetHeight + 2, innerHeight - (innerWidth <= 600 ? 24 : 48)), duration: .48, ease: "power3.inOut", overwrite: "auto" }, 0);
    if (open) {
      const active = playlist.querySelector<HTMLElement>('[aria-current="true"]');
      playlist.scrollTop = Math.max(0, (active?.offsetTop || 0) - playlist.offsetTop - 45);
    }
  }
  openButton.addEventListener("click", () => setOpen(true));
  el("close").addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && opened) setOpen(false); });
  document.addEventListener("pointerdown", (event) => { if (opened && event.target instanceof Node && !root.contains(event.target)) setOpen(false, false); });
  playButtons.forEach((button) => button.addEventListener("click", () => wantsPlay ? pause() : void play()));
  el("previous").addEventListener("click", () => selectTrack(index - 1));
  el("next").addEventListener("click", () => selectTrack(index + 1));
  trackButtons.forEach((button) => button.addEventListener("click", () => selectTrack(Number(button.dataset.track))));
  el("list-toggle").addEventListener("click", () => setList(!listOpened));
  window.addEventListener("resize", () => resizeTimer.restart(true));
  reduced.addEventListener("change", settleSize);
  seek.addEventListener("input", () => {
    const target = Number(seek.value);
    if (audio.readyState >= 1) audio.currentTime = target;
    else {
      pendingSeek = target;
      if (!audio.getAttribute("src")) { audio.src = radioTracks[index].src; audio.preload = "metadata"; audio.load(); }
    }
    el("current").textContent = format(target);
    seek.style.setProperty("--radio-progress", `${target / duration * 100}%`);
    seek.setAttribute("aria-valuetext", `${format(target)}，共 ${format(duration)}`);
  });
  volume.addEventListener("input", () => { audio.muted = false; audio.volume = Number(volume.value); if (audio.volume > 0) previousVolume = audio.volume; updateVolume(); save(); });
  el("mute").addEventListener("click", () => {
    if (audio.muted || audio.volume === 0) { audio.muted = false; audio.volume = previousVolume || .45; }
    else audio.muted = true;
    updateVolume();
  });
  audio.addEventListener("timeupdate", updateProgress);
  audio.addEventListener("loadedmetadata", () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) duration = audio.duration;
    seek.max = String(duration);
    el("duration").textContent = format(duration);
    if (pendingSeek) { audio.currentTime = Math.min(pendingSeek, duration); pendingSeek = 0; }
    updateProgress();
  });
  audio.addEventListener("playing", () => { hasError = false; root.removeAttribute("data-error"); message("正在播放，慢慢听。"); updatePlayback(); });
  audio.addEventListener("pause", () => { if (audio.paused && !changingPage) { wantsPlay = false; if (!hasError) message("已暂停，随时接着听。"); } updatePlayback(); });
  audio.addEventListener("waiting", () => { if (wantsPlay) message("正在缓冲音乐…"); });
  audio.addEventListener("error", () => { if (audio.getAttribute("src")) failure(); });
  audio.addEventListener("ended", () => selectTrack(index + 1));
  audio.addEventListener("volumechange", updateVolume);
  // Astro preserves this node; older browsers may pause media when moving it.
  document.addEventListener("astro:before-swap", () => { changingPage = true; });
  document.addEventListener("astro:after-swap", () => {
    changingPage = false;
    if (wantsPlay && audio.paused && !hasError) void play();
    updatePlayback();
  });
  if ("mediaSession" in navigator) {
    const actions: Partial<Record<MediaSessionAction, MediaSessionActionHandler>> = {
      play: () => { void play(); }, pause, previoustrack: () => selectTrack(index - 1), nexttrack: () => selectTrack(index + 1),
      seekto: (details) => { if (details.seekTime !== undefined && audio.readyState >= 1) audio.currentTime = Math.min(details.seekTime, duration); },
    };
    for (const [action, handler] of Object.entries(actions)) {
      try { navigator.mediaSession.setActionHandler(action as MediaSessionAction, handler!); } catch { /* Some browsers expose only a subset of controls. */ }
    }
  }
  updateTrack();
  updateVolume();
  updatePlayback();
  root.hidden = false;
  settleSize();
}

document.addEventListener("astro:page-load", initRadio);
initRadio();
