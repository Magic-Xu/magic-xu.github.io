export type TexturePixels = { width: number; height: number; pixels: Uint8Array };

// Decode and orient pixels off the UI thread. Uploading raw bytes avoids the
// expensive browser ImageBitmap-to-WebGL conversion on each large atlas.
export function createTextureLoader(signal: AbortSignal) {
  let worker: Worker | undefined, nextId = 0;
  const pending = new Map<number, { resolve(value: TexturePixels): void; reject(reason: Error): void }>();
  const stop = (reason: Error) => {
    worker?.terminate(); worker = undefined;
    pending.forEach(task => task.reject(reason)); pending.clear();
  };
  signal.addEventListener('abort', () => stop(new DOMException('Aborted', 'AbortError')), { once: true });

  return async (url: string, optional = false): Promise<TexturePixels> => {
    const requestSignal = optional ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : signal;
    const response = await fetch(url, { signal: requestSignal });
    if (!response.ok) throw new Error('Landscape texture unavailable');
    const blob = await response.blob();
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (!worker) {
      worker = new Worker(new URL('./landscape-textures.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }: MessageEvent<TexturePixels & { id: number; error?: string }>) => {
        const task = pending.get(data.id); pending.delete(data.id);
        if (data.error) task?.reject(new Error(data.error)); else task?.resolve(data);
      };
      worker.onerror = event => { event.preventDefault(); stop(new Error('Texture worker unavailable')); };
    }
    return new Promise((resolve, reject) => {
      const id = ++nextId; pending.set(id, { resolve, reject });
      worker!.postMessage({ id, blob });
    });
  };
}
