let queue = Promise.resolve();
self.onmessage = (event: MessageEvent<{ id: number; blob: Blob }>) => {
  queue = queue.then(async () => {
    const { id, blob } = event.data;
    try {
      const bitmap = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      const { width, height } = bitmap;
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      context.translate(0, height); context.scale(1, -1); context.drawImage(bitmap, 0, 0);
      bitmap.close();
      const pixels = context.getImageData(0, 0, width, height).data;
      self.postMessage({ id, width, height, pixels: new Uint8Array(pixels.buffer) }, { transfer: [pixels.buffer] });
      canvas.width = canvas.height = 1;
    } catch { self.postMessage({ id, error: 'Texture decoding failed' }); }
  });
};
