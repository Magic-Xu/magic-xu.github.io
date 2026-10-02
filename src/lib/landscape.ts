import * as THREE from 'three';
import { createAtmosphere } from './landscape-atmosphere';

type TerrainData = { samples: number; size: number; tileZoom: number; tileX: number; tileY: number; tiles: number; detail: { offset: [number, number]; scale: [number, number] } };

function loadImage(url: string, signal: AbortSignal) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const clean = () => { image.onload = null; image.onerror = null; signal.removeEventListener('abort', abort); };
    const abort = () => { clean(); image.src = ''; reject(new DOMException('Aborted', 'AbortError')); };
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    image.onload = () => { clean(); resolve(image); };
    image.onerror = () => { clean(); reject(new Error(`Could not load landscape asset: ${url}`)); };
    image.src = url;
  });
}

function createTerrain(data: TerrainData, heights: Uint16Array, small: boolean) {
  const { samples, size } = data;
  function elevation(u: number, v: number) {
    const x = THREE.MathUtils.clamp(u * (samples - 1), 0, samples - 1);
    const y = THREE.MathUtils.clamp(v * (samples - 1), 0, samples - 1);
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(x0 + 1, samples - 1), y1 = Math.min(y0 + 1, samples - 1);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(heights[y0 * samples + x0], heights[y0 * samples + x1], x - x0),
      THREE.MathUtils.lerp(heights[y1 * samples + x0], heights[y1 * samples + x1], x - x0), y - y0);
  }
  const divisions = small ? 384 : 768;
  const geometry = new THREE.PlaneGeometry(size, size, divisions, divisions);
  const positions = geometry.attributes.position;
  for (let row = 0; row <= divisions; row++) {
    for (let col = 0; col <= divisions; col++) {
      positions.setXYZ(row * (divisions + 1) + col, (col / divisions - .5) * size,
        elevation(col / divisions, row / divisions), (row / divisions - .5) * size);
    }
  }
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  function world(lat: number, lon: number, altitude: number) {
    const scale = 2 ** data.tileZoom;
    const u = ((lon + 180) / 360 * scale - data.tileX) / data.tiles;
    const v = ((1 - Math.asinh(Math.tan(THREE.MathUtils.degToRad(lat))) / Math.PI) / 2 * scale - data.tileY) / data.tiles;
    return new THREE.Vector3((u - .5) * size, altitude, (v - .5) * size);
  }
  return { geometry, world, heightAt: (x: number, z: number) => elevation(x / size + .5, z / size + .5) };
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
  let alive = true, ready = false, visible = true, paused = false, lost = false;
  let exploring = false, journey = 0, raf = 0, elapsed = 0, last = 0, distance = 0;
  let pointerX = 0, pointerY = 0, smoothX = 0, smoothY = 0;
  let drag: { id: number; x: number; y: number; lookX: number; lookY: number; moved: boolean } | undefined;
  let width = hero.clientWidth, height = hero.clientHeight, frameCount = 0, slowFrames = 0;
  const resources: { dispose(): void }[] = [];
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, powerPreference: 'high-performance' }); }
  catch { hero.dataset.scene = 'fallback'; return () => { controller.abort(); }; }
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

  function render(dt: number) {
    elapsed += dt;
    journey += ((exploring ? 1 : 0) - journey) * (1 - Math.exp(-dt * .65));
    smoothX += (pointerX - smoothX) * (1 - Math.exp(-dt * 12));
    smoothY += (pointerY - smoothY) * (1 - Math.exp(-dt * 12));
    // A closed, kilometre-scale route through surveyed terrain. Position and
    // look-ahead are arc-length sampled, so the aircraft never jumps at a loop.
    distance += dt * (72 + journey * 70);
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
      last = now; render(Math.min(delta, .07)); frameCount++;
      if (delta > (small ? .052 : .033)) slowFrames++;
      if (frameCount === 100 && slowFrames > 55) { renderer.setPixelRatio(1); renderer.setSize(width, height); atmosphere?.resize(width, height); }
    }
    raf = requestAnimationFrame(tick);
  }
  function start() { last = 0; if (alive && ready && visible && !paused && !lost && !reduced.matches && !document.hidden && !raf) raf = requestAnimationFrame(tick); }
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
    camera.fov = width < 761 ? 62 : 53;
    camera.updateProjectionMatrix(); atmosphere?.resize(width, height);
    if (ready && !lost) render(0);
  }
  function updatePause() {
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseButton.setAttribute('aria-label', paused ? '继续山野运镜' : '暂停山野运镜');
    pauseButton.querySelector('span')!.textContent = paused ? '继续漫游' : '暂停漫游';
  }
  function setJourney(value: boolean) {
    finishDrag();
    exploring = value; hero.dataset.exploring = String(value); copy.inert = value;
    journeyButton.setAttribute('aria-pressed', String(value));
    journeyButton.querySelector('span')!.textContent = value ? '回到首页' : '走入山野';
    paused = false; updatePause(); start();
  }
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (!visible && exploring) { setJourney(false); journey = 0; }
    visible ? start() : stop();
  });
  observer.observe(hero);
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(hero);
  hero.addEventListener('pointerdown', event => {
    if (!ready || lost || reduced.matches || drag || event.pointerType === 'touch' || !event.isPrimary || event.button !== 0) return;
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
    stop(); setJourney(false); journey = 0;
    const available = ready && !lost && !reduced.matches;
    pauseButton.hidden = journeyButton.hidden = !available;
    hero.dataset.scene = available ? 'ready' : 'fallback';
    if (available) { render(0); start(); }
  }, { signal });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); lost = true; stop(); setJourney(false); journey = 0;
    hero.dataset.scene = 'fallback'; pauseButton.hidden = journeyButton.hidden = true;
  }, { signal });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    if (ready && !reduced.matches) { render(0); hero.dataset.scene = 'ready'; pauseButton.hidden = journeyButton.hidden = false; start(); }
  }, { signal });

  Promise.all([
    fetch('/landscape/alpine.json', { signal }).then(response => { if (!response.ok) throw new Error('Terrain metadata unavailable'); return response.json() as Promise<TerrainData>; }),
    loadImage('/landscape/alpine-height.png', signal),
    loadImage(small ? '/landscape/alpine-color-mobile.webp' : '/landscape/alpine-color.webp', signal)
  ]).then(([data, heightImage, photo]) => {
    if (!alive) return;
    if (heightImage.width !== data.samples || heightImage.height !== data.samples) throw new Error('Invalid terrain');
    const heightCanvas = document.createElement('canvas');
    heightCanvas.width = heightCanvas.height = data.samples;
    const context = heightCanvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(heightImage, 0, 0);
    const pixels = context.getImageData(0, 0, data.samples, data.samples).data;
    const heights = new Uint16Array(data.samples * data.samples);
    for (let i = 0; i < heights.length; i++) heights[i] = pixels[i * 4] * 256 + pixels[i * 4 + 1];
    const terrain = createTerrain(data, heights, small);
    terrainHeight = terrain.heightAt;
    if (!small) {
      atmosphere = createAtmosphere(renderer, camera, terrain.world(46.577, 7.907, 1450));
      resources.push(atmosphere);
    }
    const texture = new THREE.Texture(photo);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); texture.needsUpdate = true;
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const detailUniforms = {
      detailMap: { value: texture }, detailReady: { value: 0 },
      detailOffset: { value: new THREE.Vector2(...data.detail.offset) },
      detailScale: { value: new THREE.Vector2(...data.detail.scale) },
      rockMap: { value: texture }, rockReady: { value: 0 }, terrainSize: { value: data.size }
    };
    // Geographic colour is preserved; a finer atlas covers the flight corridor.
    // Triplanar rock detail adds world-space texture to steep walls.
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, detailUniforms);
      shader.vertexShader = 'varying vec3 terrainPosition; varying vec3 terrainNormal;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nterrainPosition = position; terrainNormal = normal;');
      shader.fragmentShader = `varying vec3 terrainPosition; varying vec3 terrainNormal;
        uniform sampler2D detailMap, rockMap; uniform float detailReady, rockReady, terrainSize;
        uniform vec2 detailOffset, detailScale;\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #include <map_fragment>
        vec2 atlasUv = (vec2(vMapUv.x, 1. - vMapUv.y) - detailOffset) / detailScale;
        vec2 edge = smoothstep(vec2(0.), vec2(.03), atlasUv) * (1. - smoothstep(vec2(.97), vec2(1.), atlasUv));
        vec3 detail = texture2D(detailMap, vec2(atlasUv.x, 1. - atlasUv.y)).rgb;
        diffuseColor.rgb = mix(diffuseColor.rgb, detail, edge.x * edge.y * detailReady);
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
    const loadDetail = (url: string, rock: boolean) => loadImage(url, signal).then(image => {
      if (!alive) return;
      const detail = new THREE.Texture(image); detail.colorSpace = THREE.SRGBColorSpace;
      detail.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      if (rock) detail.wrapS = detail.wrapT = THREE.RepeatWrapping;
      detail.needsUpdate = true; resources.push(detail);
      if (rock) { detailUniforms.rockMap.value = detail; detailUniforms.rockReady.value = 1; }
      else { detailUniforms.detailMap.value = detail; detailUniforms.detailReady.value = 1; }
      if (ready && !lost && !paused && visible && !reduced.matches) render(0);
    }).catch(() => { /* The complete base atlas remains usable if detail is unavailable. */ });
    void loadDetail(small ? '/landscape/alpine-detail-mobile.webp' : '/landscape/alpine-detail.webp', false);
    void loadDetail('/landscape/rock-detail.webp', true);
    scene.add(new THREE.Mesh(terrain.geometry, material)); resources.push(texture, terrain.geometry, material);
    const waypoints = [
      [46.610, 7.895, 2200], [46.585, 7.900, 2650],
      [46.561, 7.905, 3250], [46.545, 7.925, 3850],
      [46.557, 7.950, 3800], [46.588, 7.958, 3400],
      [46.613, 7.930, 2750], [46.628, 7.900, 2400]
    ];
    route = new THREE.CatmullRomCurve3(waypoints.map(([lat, lon, altitude]) => terrain.world(lat, lon, altitude)), true, 'centripetal');
    route.arcLengthDivisions = 2000; route.updateArcLengths(); routeLength = route.getLength();
    ready = true; resize();
    if (!reduced.matches && !lost) { hero.dataset.scene = 'ready'; pauseButton.hidden = journeyButton.hidden = false; start(); }
  }).catch(() => {
    if (!alive) return;
    hero.dataset.scene = 'fallback'; pauseButton.hidden = journeyButton.hidden = true; stop();
  });

  resize();
  return () => {
    alive = false; stop(); controller.abort(); observer.disconnect(); resizeObserver.disconnect();
    resources.forEach(resource => resource.dispose()); renderer.dispose(); canvas.remove(); copy.inert = false;
  };
}
