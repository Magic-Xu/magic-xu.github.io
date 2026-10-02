import * as THREE from 'three';
import { createAtmosphere } from './landscape-atmosphere';
import { elevationAt, type TerrainData, type TerrainBuffers } from './landscape-terrain';
import { LANDSCAPE_SESSION_KEY, type LandscapeState } from './landscape-state';
import { createFlightRoute, worldPoint } from './landscape-route';
import { createTextureLoader, type TexturePixels } from './landscape-textures';

function prepareTerrain(data: TerrainData, height: Blob, small: boolean, signal: AbortSignal) {
  return new Promise<TerrainBuffers>((resolve, reject) => {
    const worker = new Worker(new URL('./landscape-terrain.worker.ts', import.meta.url), { type: 'module' });
    const clean = () => { worker.terminate(); signal.removeEventListener('abort', abort); };
    const abort = () => { clean(); reject(new DOMException('Aborted', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { abort(); return; }
    worker.onmessage = ({ data: result }: MessageEvent<TerrainBuffers & { error?: string }>) => {
      clean(); result.error ? reject(new Error(result.error)) : resolve(result);
    };
    worker.onerror = event => { event.preventDefault(); clean(); reject(new Error('Terrain worker unavailable')); };
    worker.postMessage({ data, height, divisions: small ? 384 : 768 });
  });
}

function createTerrain(data: TerrainData, buffers: TerrainBuffers) {
  const { samples, size } = data;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(buffers.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(buffers.normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(buffers.uv, 2));
  geometry.setIndex(new THREE.BufferAttribute(buffers.indices, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2500, 0), Math.hypot(size / 2, size / 2, 2500));
  return { geometry, heightAt: (x: number, z: number) => elevationAt(buffers.heights, samples, x / size + .5, z / size + .5) };
}

function createSky() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `
      varying vec3 direction; uniform float time;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      void main(){
        vec3 d=normalize(direction);
        vec3 color=mix(vec3(.65,.73,.76),vec3(.19,.39,.56),pow(max(d.y,0.),.48));
        vec3 sun=normalize(vec3(-.7,.35,-.4));
        float glow=pow(max(dot(d,sun),0.),16.);
        color+=vec3(.17,.12,.06)*glow;
        vec2 p=d.xz/max(d.y+.14,.015)*1.9+vec2(time*.0005,0.);
        float n=noise(p)*.55+noise(p*2.03)*.27+noise(p*4.1)*.13+noise(p*8.2)*.05;
        float cloud=smoothstep(.53,.79,n)*smoothstep(.03,.22,d.y)*.55;
        color=mix(color,vec3(.83,.85,.83),cloud);
        gl_FragColor=vec4(color,1.);
        #include <colorspace_fragment>
      }`
  });
}

export function createLandscape(host: HTMLElement) {
  const hero = host.closest<HTMLElement>('.home-hero')!;
  const pauseButton = hero.querySelector<HTMLButtonElement>('[data-scene-toggle]')!;
  const journeyButton = hero.querySelector<HTMLButtonElement>('[data-scene-journey]')!;
  const copy = hero.querySelector<HTMLElement>('.hero-copy')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const small = matchMedia('(max-width: 760px)').matches;
  const controller = new AbortController(), { signal } = controller;
  const loadTexture = createTextureLoader(signal);
  const resume = window.__landscapeResume?.state;
  delete window.__landscapeResume;
  let alive = true, ready = false, visible = true, paused = false, lost = false;
  let exploring = false, journey = 0, raf = 0, elapsed = 0, last = 0, distance = 0;
  let pointerX = 0, pointerY = 0, smoothX = 0, smoothY = 0;
  let presented = false, handover = false, speed = 0;
  let presentation = 0;
  let blendDetail = (_dt: number) => {};
  let readDetail = () => ({ detail: 0, rock: 0 });
  if (resume) {
    ({ paused, exploring, journey, elapsed, distance } = resume);
    pointerX = smoothX = resume.lookX; pointerY = smoothY = resume.lookY;
  }
  let drag: { id: number; x: number; y: number; lookX: number; lookY: number; moved: boolean } | undefined;
  let width = hero.clientWidth, height = hero.clientHeight, frameCount = 0, slowFrames = 0;
  const resources: { dispose(): void }[] = [];
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, powerPreference: 'high-performance' }); }
  catch { hero.dataset.scene = 'fallback'; hero.dataset.exploring = 'false'; copy.inert = false; return () => { controller.abort(); }; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.35 : 1.65));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(.65, .73, .76);
  scene.fog = new THREE.FogExp2(new THREE.Color(.65, .73, .76), .000058);
  const camera = new THREE.PerspectiveCamera(53, width / height, 8, 65000);
  const target = new THREE.Vector3();
  let route: THREE.CatmullRomCurve3;
  let routeLength = 1;
  let atmosphere: ReturnType<typeof createAtmosphere> | undefined;
  let terrainHeight: (x: number, z: number) => number;
  const ahead = new THREE.Vector3(), position = new THREE.Vector3();
  const skyGeometry = new THREE.SphereGeometry(50000, 32, 16), skyMaterial = createSky();
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  scene.add(sky); resources.push(skyGeometry, skyMaterial);
  host.append(canvas);

  function render(dt: number, flightDt = dt) {
    elapsed += flightDt;
    journey += ((exploring ? 1 : 0) - journey) * (1 - Math.exp(-dt * .65));
    smoothX += (pointerX - smoothX) * (1 - Math.exp(-dt * 12));
    smoothY += (pointerY - smoothY) * (1 - Math.exp(-dt * 12));
    // A closed, kilometre-scale route through surveyed terrain. Position and
    // look-ahead are arc-length sampled, so the aircraft never jumps at a loop.
    distance += flightDt * (72 + journey * 70);
    const progress = (distance / routeLength) % 1;
    route.getPointAt(progress, position);
    route.getPointAt((progress + 700 / routeLength) % 1, ahead);
    camera.position.copy(position);
    camera.position.y = Math.max(position.y, terrainHeight(position.x, position.z) + 260);
    const bearing = Math.atan2(ahead.x - position.x, ahead.z - position.z);
    target.copy(ahead);
    target.x += Math.cos(bearing) * smoothX * (90 + journey * 280);
    target.z -= Math.sin(bearing) * smoothX * (90 + journey * 280);
    target.y = THREE.MathUtils.lerp(camera.position.y - 170, ahead.y - 120, .4) - smoothY * (50 + journey * 90);
    camera.lookAt(target);
    sky.position.copy(camera.position); skyMaterial.uniforms.time.value = elapsed;
    if (atmosphere) atmosphere.render(scene, elapsed); else renderer.render(scene, camera);
  }
  function tick(now: number) {
    raf = 0;
    if (!alive || !ready || !visible || paused || lost || reduced.matches || document.hidden) return;
    const delta = last ? (now - last) / 1000 : 0;
    if (!small || !last || delta >= .03) {
      const dt = Math.min(delta, .07);
      speed = Math.min(1, speed + dt / 1.2);
      blendDetail(dt); last = now; render(dt, dt * speed); frameCount++;
      if (delta > (small ? .052 : .033)) slowFrames++;
      if (frameCount === 100 && slowFrames > 55) { renderer.setPixelRatio(1); renderer.setSize(width, height); atmosphere?.resize(width, height); }
    }
    raf = requestAnimationFrame(tick);
  }
  function start() { last = 0; if (alive && ready && presented && visible && !paused && !lost && !reduced.matches && !document.hidden && !raf) raf = requestAnimationFrame(tick); }
  function finishDrag() {
    if (!drag) return;
    const id = drag.id;
    drag = undefined;
    delete hero.dataset.dragging;
    // Keep the currently visible heading on release, with no residual turn.
    pointerX = smoothX; pointerY = smoothY;
    if (hero.hasPointerCapture(id)) hero.releasePointerCapture(id);
  }
  function stop() { finishDrag(); cancelAnimationFrame(raf); raf = 0; last = 0; }
  function resize() {
    width = hero.clientWidth; height = hero.clientHeight;
    renderer.setSize(width, height); camera.aspect = width / height;
    const baseAspect = width < 761 ? 390 / 844 : 1920 / 1080;
    const baseFov = width < 761 ? 62 : 53;
    // Match object-fit: cover on the opening poster for every viewport aspect.
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov) / 2) * Math.min(1, baseAspect / camera.aspect)));
    camera.updateProjectionMatrix(); atmosphere?.resize(width, height);
    if (ready && !lost) render(0);
  }
  function updatePause() {
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseButton.setAttribute('aria-label', paused ? '继续山野运镜' : '暂停山野运镜');
    pauseButton.querySelector('span')!.textContent = paused ? '继续漫游' : '暂停漫游';
  }
  function updateJourney() {
    hero.dataset.exploring = String(exploring); copy.inert = exploring;
    journeyButton.setAttribute('aria-pressed', String(exploring));
    journeyButton.querySelector('span')!.textContent = exploring ? '回到首页' : '走入山野';
  }
  function setJourney(value: boolean) {
    finishDrag();
    exploring = value; updateJourney();
    paused = false; updatePause(); start();
  }
  function fallback() {
    stop(); presented = false; handover = false; presentation++;
    delete hero.dataset.scenePresented;
    exploring = false; updateJourney();
    hero.dataset.scene = 'fallback';
    pauseButton.hidden = journeyButton.hidden = true;
  }
  async function present() {
    if (!alive || !ready || reduced.matches || lost || handover || presented) return;
    const attempt = ++presentation;
    handover = true;
    render(0);
    // Paint the stationary frame before starting the compositor crossfade.
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    if (!alive || reduced.matches || lost || attempt !== presentation) return;
    hero.dataset.scene = 'ready';
    const transitions = host.getAnimations();
    await Promise.allSettled(transitions.map(animation => animation.finished));
    if (!alive || reduced.matches || lost || attempt !== presentation || hero.dataset.scene !== 'ready') return;
    presented = true; handover = false;
    hero.dataset.scenePresented = 'true';
    pauseButton.hidden = journeyButton.hidden = false;
    updateJourney(); updatePause(); start();
  }
  function saveFrame() {
    if (!alive || !ready || !presented || lost || reduced.matches) return;
    finishDrag(); render(0);
    const image = document.createElement('canvas');
    image.width = Math.min(960, canvas.width); image.height = Math.round(image.width * height / width);
    const context = image.getContext('2d');
    if (!context) return;
    context.drawImage(canvas, 0, 0, image.width, image.height);
    const state: LandscapeState = { distance, elapsed, journey, lookX: smoothX, lookY: smoothY, paused, exploring, ...readDetail() };
    try { sessionStorage.setItem(LANDSCAPE_SESSION_KEY, JSON.stringify({ state, image: image.toDataURL('image/jpeg', .82), aspect: width / height, mobile: small, savedAt: Date.now() })); }
    catch { /* A denied/full store must not prevent navigation or the next opening. */ }
  }
  window.addEventListener('pagehide', saveFrame, { signal });
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (!visible && exploring) { setJourney(false); journey = 0; }
    visible ? start() : stop();
  });
  observer.observe(hero);
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(hero);
  hero.addEventListener('pointerdown', event => {
    if (!presented || lost || reduced.matches || drag || event.pointerType === 'touch' || !event.isPrimary || event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest('a, button, input, textarea, select, summary, [contenteditable]')) return;
    event.preventDefault();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, lookX: smoothX, lookY: smoothY, moved: false };
    hero.setPointerCapture(event.pointerId);
  }, { signal });
  hero.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    if (!(event.buttons & 1)) { finishDrag(); return; }
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true; hero.dataset.dragging = 'true';
    pointerX = THREE.MathUtils.clamp(drag.lookX + dx / width * 2, -1.5, 1.5);
    pointerY = THREE.MathUtils.clamp(drag.lookY + dy / height * 2, -1, 1);
    // Pausing stops the flight; an explicit drag can still look around it.
    if (paused) { smoothX = pointerX; smoothY = pointerY; render(0); }
  }, { passive: true, signal });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    hero.addEventListener(type, event => { if (event.pointerId === drag?.id) finishDrag(); }, { signal });
  }
  window.addEventListener('blur', finishDrag, { signal });
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start(), { signal });
  pauseButton.addEventListener('click', () => { paused = !paused; updatePause(); paused ? stop() : start(); }, { signal });
  journeyButton.addEventListener('click', () => setJourney(!exploring), { signal });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && exploring) { setJourney(false); journeyButton.focus({ preventScroll: true }); }
  }, { signal });
  reduced.addEventListener('change', () => {
    if (reduced.matches) { fallback(); journey = 0; }
    else void present();
  }, { signal });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); lost = true; fallback(); journey = 0;
  }, { signal });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    void present();
  }, { signal });

  Promise.all([
    fetch('/landscape/alpine.json', { signal }).then(response => { if (!response.ok) throw new Error('Terrain metadata unavailable'); return response.json() as Promise<TerrainData>; }),
    fetch('/landscape/alpine-height.png', { signal }).then(response => { if (!response.ok) throw new Error('Terrain heights unavailable'); return response.blob(); }),
    loadTexture(small ? '/landscape/alpine-color-mobile.webp' : '/landscape/alpine-color.webp'),
    loadTexture(small ? '/landscape/alpine-opening-mobile.webp' : '/landscape/alpine-opening.webp', true).catch(() => undefined)
  ]).then(async ([data, heightImage, photo, opening]) => {
    if (!alive) return;
    const buffers = await prepareTerrain(data, heightImage, small, signal);
    if (!alive) return;
    // Let the compositor finish the opening text before GPU uploads/compilation.
    await Promise.allSettled(Array.from(hero.querySelectorAll('.hero-copy > *, .hero-horizon')).flatMap(element => element.getAnimations().map(animation => animation.finished)));
    if (!alive) return;
    const terrain = createTerrain(data, buffers);
    terrainHeight = terrain.heightAt;
    if (!small) {
      atmosphere = createAtmosphere(renderer, camera, worldPoint(data, 46.577, 7.907, 1450));
      resources.push(atmosphere);
    }
    function makeTexture(image: TexturePixels) {
      const texture = new THREE.DataTexture(image.pixels, image.width, image.height);
      texture.generateMipmaps = true; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); texture.needsUpdate = true;
      resources.push(texture);
      return texture;
    }
    async function uploadTexture(texture: THREE.DataTexture) {
      const { data, width, height } = texture.image;
      if (!data) throw new Error('Texture pixels missing');
      if (data.byteLength < 4 * 1024 * 1024) { renderer.initTexture(texture); return; }
      // Reserve the full mip chain, then upload small strips between UI tasks.
      // The texture joins the scene only after all strips and mipmaps are ready.
      texture.source.dataReady = false; renderer.initTexture(texture); texture.source.dataReady = true;
      texture.generateMipmaps = false;
      for (let row = 0; row < height; row += 128) {
        if (!alive) throw new DOMException('Aborted', 'AbortError');
        if (lost) { texture.generateMipmaps = true; texture.needsUpdate = true; return; }
        const rows = Math.min(128, height - row);
        const strip = new THREE.DataTexture(data.subarray(row * width * 4, (row + rows) * width * 4), width, rows);
        texture.generateMipmaps = row + rows === height;
        renderer.copyTextureToTexture(strip, texture, null, new THREE.Vector2(0, row));
        strip.dispose();
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      }
    }
    resources.push(terrain.geometry);
    const texture = makeTexture(photo);
    const openingTexture = opening ? makeTexture(opening) : texture;
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const detailUniforms = {
      detailMap: { value: texture }, detailReady: { value: 0 },
      openingMap: { value: openingTexture }, openingReady: { value: opening ? 1 : 0 },
      detailOffset: { value: new THREE.Vector2(...data.detail.offset) },
      detailScale: { value: new THREE.Vector2(...data.detail.scale) },
      rockMap: { value: texture }, rockReady: { value: 0 }, terrainSize: { value: data.size }
    };
    let detailLoaded = false, rockLoaded = false;
    blendDetail = dt => {
      if (detailLoaded) detailUniforms.detailReady.value = Math.min(1, detailUniforms.detailReady.value + dt / 1.4);
      if (rockLoaded) detailUniforms.rockReady.value = Math.min(1, detailUniforms.rockReady.value + dt / 1.4);
    };
    readDetail = () => ({ detail: detailUniforms.detailReady.value, rock: detailUniforms.rockReady.value });
    // Geographic colour is preserved; a finer atlas covers the flight corridor.
    // Triplanar rock detail adds world-space texture to steep walls.
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, detailUniforms);
      shader.vertexShader = 'varying vec3 terrainPosition; varying vec3 terrainNormal;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nterrainPosition = position; terrainNormal = normal;');
      shader.fragmentShader = `varying vec3 terrainPosition; varying vec3 terrainNormal;
        uniform sampler2D detailMap, openingMap, rockMap; uniform float detailReady, openingReady, rockReady, terrainSize;
        uniform vec2 detailOffset, detailScale;\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #include <map_fragment>
        vec2 atlasUv = (vec2(vMapUv.x, 1. - vMapUv.y) - detailOffset) / detailScale;
        vec2 edge = smoothstep(vec2(0.), vec2(.03), atlasUv) * (1. - smoothstep(vec2(.97), vec2(1.), atlasUv));
        vec3 detail = texture2D(detailMap, vec2(atlasUv.x, 1. - atlasUv.y)).rgb;
        vec3 opening = texture2D(openingMap, vec2(atlasUv.x, 1. - atlasUv.y)).rgb;
        vec3 initial = mix(diffuseColor.rgb, opening, openingReady);
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(initial, detail, detailReady), edge.x * edge.y);
        vec3 weights = pow(abs(normalize(terrainNormal)), vec3(4.)); weights /= dot(weights, vec3(1.));
        vec3 rock = texture2D(rockMap, terrainPosition.yz / 180.).rgb * weights.x
          + texture2D(rockMap, terrainPosition.xz / 180.).rgb * weights.y
          + texture2D(rockMap, terrainPosition.xy / 180.).rgb * weights.z;
        float slope = 1. - abs(normalize(terrainNormal).y);
        float cliff = smoothstep(.35,.72,slope) * (1. - smoothstep(1500.,4500.,vFogDepth)) * rockReady;
        float relief = dot(rock, vec3(.3,.5,.2));
        diffuseColor.rgb *= mix(1., .68 + relief * 2., cliff * .55);
        float horizon = smoothstep(.35, .498, max(abs(terrainPosition.x),abs(terrainPosition.z)) / terrainSize);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.65,.73,.76), horizon);
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', `
        #include <fog_fragment>
        float valley = 1. - smoothstep(1100., 2400., terrainPosition.y);
        float distanceHaze = 1. - exp(-vFogDepth * .0001);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(.70,.76,.75), valley * distanceHaze * .24);
      `);
    };
    const loadDetail = (url: string, rock: boolean) => loadTexture(url, true).then(async image => {
      if (!alive) return;
      const detail = makeTexture(image);
      if (rock) detail.wrapS = detail.wrapT = THREE.RepeatWrapping;
      await uploadTexture(detail);
      if (!alive) return;
      if (rock) { detailUniforms.rockMap.value = detail; rockLoaded = true; detailUniforms.rockReady.value = resume?.rock ?? 0; }
      else { detailUniforms.detailMap.value = detail; detailLoaded = true; detailUniforms.detailReady.value = resume?.detail ?? 0; }
    }).catch(() => { /* The complete base atlas remains usable if detail is unavailable. */ });
    const loadDetails = () => Promise.all([
      loadDetail(small ? '/landscape/alpine-detail-mobile.webp' : '/landscape/alpine-detail.webp', false),
      loadDetail('/landscape/rock-detail.webp', true)
    ]);
    scene.add(new THREE.Mesh(terrain.geometry, material)); resources.push(material);
    route = createFlightRoute(data); routeLength = route.getLength();
    if (resume) await loadDetails();
    if (!alive) return;
    await uploadTexture(texture);
    if (opening) await uploadTexture(openingTexture);
    if (!alive) return;
    if (!lost) {
      if (atmosphere) await atmosphere.prepare(scene); else await renderer.compileAsync(scene, camera);
    }
    if (!alive) return;
    resize(); ready = true;
    await present();
    if (alive && !resume) void loadDetails();
  }).catch(() => {
    if (!alive) return;
    fallback();
  });

  resize();
  return () => {
    alive = false; stop(); controller.abort(); observer.disconnect(); resizeObserver.disconnect();
    resources.forEach(resource => resource.dispose()); renderer.dispose(); canvas.remove(); copy.inert = false;
  };
}
