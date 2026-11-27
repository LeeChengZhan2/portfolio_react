#!/usr/bin/env node
/**
 * Add, or replace, one trip's built-up footprint in public/globe/visited.json.
 *
 *   node scripts/build-footprint.mjs <ne_10m_urban_areas.geojson> <trip-id> <lon,lat> [<lon,lat> …]
 *
 * The urban areas file is Natural Earth's 10m urban areas (public domain), for
 * example ne_10m_urban_areas.geojson from github.com/nvkelso/natural-earth-vector.
 * It is 28 MB and stays outside the repo, the way the GPX originals do.
 *
 * Give one point per city; a city hall is a good one. The urban area holding
 * the first point becomes `ring`. A later city that falls OUTSIDE every outline
 * so far adds its own as `more` — Seoul and Busan are 325 km apart (25 Nov
 * 2026). One that falls inside adds nothing: Guangzhou and Shenzhen share one
 * conurbation. (The Taichung & Taipei entry holds Taipei's outline alone;
 * Taichung has one of its own, and running that trip through here would add
 * it.)
 *
 * The first eight entries predate this script and nothing that made them was
 * kept, so it was worked back from them: rings of [lon, lat] rounded to four
 * decimals and closed; `at` the bounding-box centre of every outline together,
 * as [lat, lon]; `span` the larger of the box's height and its width times the
 * cosine of its latitude, in degrees. Recomputed from their own rings, all
 * eight agree exactly. A new trip goes first — the file runs newest first, as
 * getTrips() does — and an existing one is replaced in place.
 *
 * The trip id must match its file in src/content/trips/, or the engine has no
 * footprint for it and leaves it off the map.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [file, id, ...points] = process.argv.slice(2);
if (!file || !id || !points.length) {
  console.error('usage: node scripts/build-footprint.mjs <ne_10m_urban_areas.geojson> <trip-id> <lon,lat> [<lon,lat> …]');
  process.exit(1);
}

const TARGET = new URL('../public/globe/visited.json', import.meta.url);
const urban = JSON.parse(readFileSync(file, 'utf8'));

/** Ray casting; the urban outlines carry no holes worth testing against. */
function inside([x, y], ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

const outers = urban.features.flatMap(({ geometry }) =>
  geometry.type === 'Polygon' ? [geometry.coordinates[0]] : geometry.type === 'MultiPolygon' ? geometry.coordinates.map((p) => p[0]) : [],
);

const round = (n) => Math.round(n * 1e4) / 1e4;
function tidy(ring) {
  const rounded = ring.map(([x, y]) => [round(x), round(y)]);
  // Rounding leaves consecutive duplicates; drop them, and close the ring.
  const clean = rounded.filter((p, i) => i === 0 || p[0] !== rounded[i - 1][0] || p[1] !== rounded[i - 1][1]);
  const [first, last] = [clean[0], clean.at(-1)];
  if (first[0] !== last[0] || first[1] !== last[1]) clean.push([...first]);
  return clean;
}

const outlines = [];
for (const point of points) {
  const at = point.split(',').map(Number);
  if (at.length !== 2 || at.some(Number.isNaN)) throw new Error(`"${point}" is not lon,lat`);
  if (outlines.some((ring) => inside(at, ring))) {
    console.error(`${point}: inside an outline already taken, nothing added`);
    continue;
  }
  const found = outers.find((ring) => inside(at, ring));
  if (!found) throw new Error(`no urban area in the file contains ${point}`);
  const ring = tidy(found);
  outlines.push(ring);
  console.error(`${point}: ${ring.length} points`);
}

const all = outlines.flat();
const xs = all.map(([x]) => x);
const ys = all.map(([, y]) => y);
const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
const lat = (y0 + y1) / 2;
const entry = {
  ring: outlines[0],
  ...(outlines.length > 1 ? { more: outlines.slice(1) } : {}),
  at: [round(lat), round((x0 + x1) / 2)],
  span: Math.max((x1 - x0) * Math.cos((lat * Math.PI) / 180), y1 - y0),
};

const visited = JSON.parse(readFileSync(TARGET, 'utf8'));
const next = id in visited ? { ...visited, [id]: entry } : { [id]: entry, ...visited };
writeFileSync(TARGET, JSON.stringify(next));
console.error(`${id}: ${outlines.length} outline(s), at ${JSON.stringify(entry.at)}, span ${entry.span.toFixed(4)}`);
