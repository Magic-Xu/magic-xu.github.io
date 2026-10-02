import * as THREE from 'three';
import type { TerrainData } from './landscape-terrain';

export function worldPoint(data: TerrainData, lat: number, lon: number, altitude: number) {
  const scale = 2 ** data.tileZoom;
  const u = ((lon + 180) / 360 * scale - data.tileX) / data.tiles;
  const v = ((1 - Math.asinh(Math.tan(THREE.MathUtils.degToRad(lat))) / Math.PI) / 2 * scale - data.tileY) / data.tiles;
  return new THREE.Vector3((u - .5) * data.size, altitude, (v - .5) * data.size);
}

export function createFlightRoute(data: TerrainData) {
  const waypoints = [
    [46.610, 7.895, 2200], [46.585, 7.900, 2650],
    [46.561, 7.905, 3250], [46.545, 7.925, 3850],
    [46.557, 7.950, 3800], [46.588, 7.958, 3400],
    [46.613, 7.930, 2750], [46.628, 7.900, 2400]
  ];
  const route = new THREE.CatmullRomCurve3(waypoints.map(([lat, lon, altitude]) => worldPoint(data, lat, lon, altitude)), true, 'centripetal');
  route.arcLengthDivisions = 2000; route.updateArcLengths();
  return route;
}
