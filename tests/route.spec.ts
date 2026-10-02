import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { createFlightRoute } from '../src/lib/landscape-route';
import { elevationAt, type TerrainData } from '../src/lib/landscape-terrain';

test('the whole flight loop stays above real terrain, inside imagery and continuous at the seam', async () => {
  const metadata: TerrainData = JSON.parse(await readFile('public/landscape/alpine.json', 'utf8'));
  const { data, info } = await sharp('public/landscape/alpine-height.png').raw().toBuffer({ resolveWithObject: true });
  const heights = new Uint16Array(metadata.samples * metadata.samples);
  for (let i = 0; i < heights.length; i++) heights[i] = data[i * info.channels] * 256 + data[i * info.channels + 1];
  const route = createFlightRoute(metadata);
  for (let i = 0; i <= 10000; i++) {
    const point = route.getPointAt(i / 10000);
    expect(Math.max(Math.abs(point.x), Math.abs(point.z))).toBeLessThan(metadata.size / 2);
    const elevation = elevationAt(heights, metadata.samples, point.x / metadata.size + .5, point.z / metadata.size + .5);
    expect(point.y - elevation, `ground clearance at route fraction ${i}/10000`).toBeGreaterThan(260);
  }
  expect(route.getPointAt(0).distanceTo(route.getPointAt(1))).toBeLessThan(.001);
  expect(route.getTangentAt(0).dot(route.getTangentAt(1))).toBeGreaterThan(.999);
  expect(route.getLength()).toBeGreaterThan(20000);
});
