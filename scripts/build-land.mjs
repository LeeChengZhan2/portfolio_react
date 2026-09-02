/**
 * Generates public/globe/land-polygons.json — the land as real GeoJSON polygons,
 * for the MapLibre earth.
 *
 * WHY THIS EXISTS, and why it is not just `land.json` reused.
 *
 * `land.json` is a flat array of coastline *rings*, and the three.js engine draws
 * it as line geometry between consecutive points on a sphere. Under that contract
 * a ring is allowed to jump straight from longitude +179.87 to -180: on a sphere
 * those two points are neighbours, and the segment wraps invisibly around the
 * back. Three rings in that file do exactly this — Antarctica, Eurasia at
 * Chukotka, and a small ring near 71°N.
 *
 * MapLibre does not read geometry that way. It interprets rings in Mercator
 * space, so that same +179.87 → -180 segment is the long way across the entire
 * map, and it draws a line straight across the globe. That is where the two
 * bands came from. The hole in Antarctica was the same cause wearing a different
 * hat: `land.json`'s Antarctic ring spans latitude -85.19 to -63.23 and never
 * closes over the pole, so filling it leaves the middle empty.
 *
 * Natural Earth's own GeoJSON has neither problem — it is split at the
 * antimeridian (largest longitude step measured at 5.72°, against 359.87° in the
 * ring file) and Antarctica closes to -89.999. So the fix is to use the polygons
 * as published rather than to reconstruct them.
 *
 * `land.json` stays exactly as it is. It is correct for the renderer it was made
 * for, and this file is correct for the other one — two engines, two contracts,
 * one source. When one earth wins, delete the other's file with it.
 *
 *   node scripts/build-land.mjs
 */

import { writeFile } from 'node:fs/promises';

const SOURCE =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson';
const OUT = new URL('../public/globe/land-polygons.json', import.meta.url);

/**
 * Two decimal places, matching `land.json`'s existing precision — about 1.1 km,
 * which is finer than a 50m-scale coastline is meaningful to anyway and roughly
 * halves the file. Anything more is bytes spent below the resolution of the data.
 */
const round = (n) => Math.round(n * 100) / 100;

/**
 * Latitude, rounded but never allowed to land exactly on a pole.
 *
 * NOTE this file is the FILL only. Its Antarctic ring carries a synthetic edge
 * running along the pole to close the continent — necessary to fill it, and
 * wrong to draw: as a line that edge is a circle of latitude, and it rendered as
 * a ring around the south pole. The coastline is drawn from `land.json` instead,
 * whose Antarctic ring is pure coast (-85.19 to -63.23) with no closure. See
 * `coastLines()` in src/scripts/mapglobe/engine.ts.
 *
 * Natural Earth closes Antarctica with 259 points at latitude -89.998926 — a
 * very small circle around the pole. Rounding that to two places gives -90 for
 * every one of them, and on a sphere all 259 are then the SAME point, so the
 * ring degenerates into a fan of zero-area triangles. Clamping to ±89.99 keeps
 * them distinct, stays inside two decimal places, and sits about 1.1 km from
 * the pole — closer than any real coastline in the file.
 *
 * This is geometry hygiene and nothing more. It was first written believing it
 * explained the wedge missing from Antarctica on the globe; it does not. That
 * wedge is MapLibre's triangulation of a polygon which encircles the pole, it
 * renders identically at -89.99, at the Web Mercator limit -85.05 and at a true
 * -90, and the same polygon fills correctly under mercator. Do not go looking
 * for the answer in this file.
 */
const roundLat = (n) => Math.min(89.99, Math.max(-89.99, round(n)));

/** Round a ring, drop points the rounding made identical, and re-close it. */
function cleanRing(ring) {
  const out = [];
  for (const [x, y] of ring) {
    const p = [round(x), roundLat(y)];
    const last = out[out.length - 1];
    if (last && last[0] === p[0] && last[1] === p[1]) continue;
    out.push(p);
  }
  // A polygon ring must be closed, and rounding can break the closure.
  const first = out[0];
  const last = out[out.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) out.push([...first]);
  // Fewer than four points cannot enclose an area once closed.
  return out.length >= 4 ? out : null;
}

console.log(`fetching ${SOURCE}`);
const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`Natural Earth returned ${response.status}`);
const source = await response.json();

/* Everything collapses into ONE MultiPolygon feature. MapLibre has no use for
   the per-feature properties here — nothing is clicked, labelled or styled by
   attribute — and one feature is cheaper to parse and to hand to the worker than
   1,420 of them. */
const polygons = [];
let dropped = 0;

for (const feature of source.features) {
  const { type, coordinates } = feature.geometry;
  const parts = type === 'Polygon' ? [coordinates] : coordinates;
  for (const part of parts) {
    // part[0] is the outer ring, the rest are holes — lakes and inland seas.
    // Preserving that distinction is the other half of what the ring file lost.
    const rings = part.map(cleanRing).filter(Boolean);
    if (!rings.length) {
      dropped += 1;
      continue;
    }
    polygons.push(rings);
  }
}

/* ---- validation, because this is exactly the class of bug that shipped ---- */
let worstJump = 0;
let southmost = 90;
let points = 0;
let holes = 0;

for (const poly of polygons) {
  holes += poly.length - 1;
  for (const ring of poly) {
    points += ring.length;
    for (let i = 1; i < ring.length; i++) {
      const jump = Math.abs(ring[i][0] - ring[i - 1][0]);
      if (jump > worstJump) worstJump = jump;
    }
    for (const [, y] of ring) if (y < southmost) southmost = y;
  }
}

if (worstJump > 180) {
  throw new Error(
    `A ring jumps ${worstJump.toFixed(2)}° of longitude — that is an antimeridian ` +
      `crossing and it will draw a line across the globe. This is the bug this file exists to fix.`,
  );
}
if (southmost > -89) {
  throw new Error(
    `Southernmost point is ${southmost}° — Antarctica does not close over the pole, ` +
      `so it will render with a hole in the middle.`,
  );
}
if (southmost <= -90) {
  throw new Error(
    `A point sits exactly on the pole. Every such point is the same point on a sphere, ` +
      `so the pole-closing ring collapses into degenerate triangles and Antarctica renders ` +
      `with a wedge missing. See roundLat.`,
  );
}

const geojson = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: polygons } },
  ],
};

const json = JSON.stringify(geojson);
await writeFile(OUT, json);

console.log(`polygons        ${polygons.length}`);
console.log(`holes           ${holes}`);
console.log(`points          ${points}`);
console.log(`dropped (tiny)  ${dropped}`);
console.log(`largest lon jump ${worstJump.toFixed(2)}°  (must stay under 180)`);
console.log(`southernmost     ${southmost}°  (must reach about -90)`);
console.log(`written         ${(json.length / 1024).toFixed(0)} KB → public/globe/land-polygons.json`);
