export type TerrainData = {
  samples: number; size: number; tileZoom: number; tileX: number; tileY: number; tiles: number;
  detail: { offset: [number, number]; scale: [number, number] };
};
export type TerrainBuffers = {
  heights: Uint16Array; positions: Float32Array; normals: Float32Array;
  uv: Float32Array; indices: Uint32Array;
};

export function elevationAt(heights: Uint16Array, samples: number, u: number, v: number) {
  const x = Math.max(0, Math.min(samples - 1, u * (samples - 1)));
  const y = Math.max(0, Math.min(samples - 1, v * (samples - 1)));
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(x0 + 1, samples - 1), y1 = Math.min(y0 + 1, samples - 1);
  const top = heights[y0 * samples + x0] * (1 - x + x0) + heights[y0 * samples + x1] * (x - x0);
  const bottom = heights[y1 * samples + x0] * (1 - x + x0) + heights[y1 * samples + x1] * (x - x0);
  return top * (1 - y + y0) + bottom * (y - y0);
}

// Worker-owned buffers are transferred, not copied, to the renderer.
export function buildTerrainBuffers(data: TerrainData, heights: Uint16Array, divisions: number): TerrainBuffers {
  const edge = divisions + 1, count = edge * edge;
  const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3), uv = new Float32Array(count * 2);
  const indices = new Uint32Array(divisions * divisions * 6);
  for (let row = 0; row <= divisions; row++) {
    for (let col = 0; col <= divisions; col++) {
      const i = row * edge + col, u = col / divisions, v = row / divisions;
      positions.set([(u - .5) * data.size, elevationAt(heights, data.samples, u, v), (v - .5) * data.size], i * 3);
      uv.set([u, 1 - v], i * 2);
      if (row < divisions && col < divisions) indices.set([i, i + edge, i + 1, i + edge, i + edge + 1, i + 1], (row * divisions + col) * 6);
    }
  }
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const abx = positions[a] - positions[b], aby = positions[a + 1] - positions[b + 1], abz = positions[a + 2] - positions[b + 2];
    const cbx = positions[c] - positions[b], cby = positions[c + 1] - positions[b + 1], cbz = positions[c + 2] - positions[b + 2];
    const nx = cby * abz - cbz * aby, ny = cbz * abx - cbx * abz, nz = cbx * aby - cby * abx;
    for (const offset of [a, b, c]) { normals[offset] += nx; normals[offset + 1] += ny; normals[offset + 2] += nz; }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= length; normals[i + 1] /= length; normals[i + 2] /= length;
  }
  return { heights, positions, normals, uv, indices };
}
