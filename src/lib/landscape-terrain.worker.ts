import { buildTerrainBuffers, type TerrainData } from './landscape-terrain';

self.onmessage = async (event: MessageEvent<{ data: TerrainData; height: Blob; divisions: number }>) => {
  try {
    const { data, height, divisions } = event.data;
    const image = await createImageBitmap(height);
    if (image.width !== data.samples || image.height !== data.samples) { image.close(); throw new Error('Invalid terrain dimensions'); }
    const canvas = new OffscreenCanvas(data.samples, data.samples);
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(image, 0, 0); image.close();
    const pixels = context.getImageData(0, 0, data.samples, data.samples).data;
    const heights = new Uint16Array(data.samples * data.samples);
    for (let i = 0; i < heights.length; i++) heights[i] = pixels[i * 4] * 256 + pixels[i * 4 + 1];
    const result = buildTerrainBuffers(data, heights, divisions);
    self.postMessage(result, { transfer: Object.values(result).map(array => array.buffer) });
  } catch { self.postMessage({ error: 'Terrain preparation failed' }); }
};
