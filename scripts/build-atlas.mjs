/**
 * Generates the label and feature files the MapLibre earth's `atlas` and
 * `explore` modes read, into public/globe/:
 *
 *   atlas-countries.json   177 country label anchors
 *   atlas-cities.json      243 city label anchors, with a capital flag
 *   atlas-peaks.json       632 named mountains, with elevation
 *   atlas-rivers.json      552 river lines, simplified
 *   atlas-lakes.json       411 lakes, simplified
 *
 * WHY THESE ARE NEW FILES, when public/globe already has borders.json and
 * cities.json.
 *
 * Neither existing file carries a NAME. `borders.json` is boundary geometry with
 * no attributes at all, and `cities.json` is 900 bare `[lat, lon]` pairs — both
 * were built for the three.js earth, which draws them as anonymous lines and
 * dots. The atlas has to be able to say "Japan" and "Bangkok", so it needs the
 * one thing neither file kept.
 *
 * What it does keep is each source's own label metadata, which is the reason
 * this is a build step rather than a runtime filter:
 *
 *   - LABEL_X / LABEL_Y are hand-placed label anchors, not centroids. A centroid
 *     puts "Norway" in the sea and "Chile" in Argentina.
 *   - MIN_LABEL / min_zoom are the zoom each label is *intended* to appear at,
 *     decided by a cartographer. That is what tiers the atlas — see `retier()`
 *     in src/scripts/mapglobe/engine.ts — and inventing a tiering rule from
 *     population would be worse and would be mine.
 *
 * 110m for countries and cities on purpose. These are label anchors, not
 * geometry: 177 countries and 243 cities is a world atlas's worth of names, and
 * the 50m sets are several times larger for names that would never survive
 * decluttering. Peaks and water have no 110m set worth having — 110m ships
 * thirteen rivers — so those come from 10m and 50m and are thinned here.
 *
 *   node scripts/build-atlas.mjs
 */

import { writeFile } from 'node:fs/promises';

const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';

const out = (name) => new URL(`../public/globe/${name}`, import.meta.url);

/** Three places — about 110 m. A label anchor does not need more, and the files
    stay a rounding error next to borders.json. */
const round = (n) => Math.round(n * 1000) / 1000;

/** Two places for geometry — about 1.1 km, matching land.json and borders.json,
    and finer than a 50m coastline is meaningful to anyway. */
const round2 = (n) => Math.round(n * 100) / 100;

const written = [];

async function get(url, init) {
  console.log(`fetching ${url.slice(0, 96)}${url.length > 96 ? '…' : ''}`);
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function emit(name, value) {
  const json = JSON.stringify(value);
  await writeFile(out(name), json);
  written.push([name, json.length]);
}

/* ========================================================================== */
/* countries                                                                  */
/* ========================================================================== */

const countrySource = await get(`${NE}/ne_110m_admin_0_countries.geojson`);
const countries = [];

for (const feature of countrySource.features) {
  const p = feature.properties;

  /* NAME, not NAME_EN. NAME is Natural Earth's short *cartographic* label —
     "China", "Russia", "Dem. Rep. Congo" — which is the field made for drawing
     on a map. NAME_EN is the formal name and gives "People's Republic of China"
     and "Russian Federation", which are too long for a label on a globe and
     stop matching src/content/trips/*.md `country`. The validation at the foot
     of this file catches that second half. */
  const name = p.NAME || p.NAME_EN;
  const lon = p.LABEL_X;
  const lat = p.LABEL_Y;

  // A country with no hand-placed anchor is skipped rather than centroided.
  // Nothing in the 110m set actually hits this; the check is here so a future
  // source swap fails loudly instead of dropping labels into the ocean.
  if (!name || !Number.isFinite(lon) || !Number.isFinite(lat)) {
    console.warn(`  skipped (no label anchor): ${name ?? '<unnamed>'}`);
    continue;
  }

  countries.push({
    n: name,
    c: [round(lon), round(lat)],
    // MIN_LABEL is fractional (1.7, 2.5, 4.6 …). Kept as given — it is compared
    // against map.getZoom(), which is fractional too.
    z: p.MIN_LABEL ?? 4,
    r: p.LABELRANK ?? 5,
  });
}

await emit('atlas-countries.json', countries);

/* ========================================================================== */
/* cities                                                                     */
/* ========================================================================== */

const citySource = await get(`${NE}/ne_110m_populated_places_simple.geojson`);
const cities = [];

for (const feature of citySource.features) {
  const p = feature.properties;
  const [lon, lat] = feature.geometry.coordinates;
  if (!p.name || !Number.isFinite(lon) || !Number.isFinite(lat)) continue;

  cities.push({
    n: p.name,
    // The country, so a city label can say where it is when the country label
    // itself has been decluttered away.
    a: p.adm0name ?? '',
    c: [round(lon), round(lat)],
    z: p.min_zoom ?? 4,
    r: p.labelrank ?? 5,
    // Capitals get a slightly larger dot. `adm0cap` is 1/0 in this source.
    cap: p.adm0cap ? 1 : 0,
  });
}

await emit('atlas-cities.json', cities);

/* ========================================================================== */
/* peaks                                                                      */
/* ========================================================================== */

/**
 * Natural Earth's elevation points, filtered to named mountains.
 *
 * The zoom is shifted DOWN by 3 from the published `min_zoom`, and that shift is
 * the only invented number in this file. Natural Earth's zooms are calibrated
 * for a flat web map where z4 shows a continent; this globe opens at z2.3
 * showing a hemisphere, so its "continent" sits about three levels lower. Left
 * unshifted, the highest mountain on earth appears at z4 and the globe shows no
 * peaks at all.
 *
 * Measured before shifting: z4 has 1 (Everest), z5 has 25, z6 has 243, z7 has
 * 362. After the shift the globe view carries the 26 that Natural Earth ranks
 * highest — Everest, K2, Kilimanjaro, Denali, Aconcagua, Elbrus, Kosciuszko,
 * Vinson — which is close enough to the Seven Summits to be the right answer to
 * "famous mountains" without anyone here choosing them.
 */
const PEAK_ZOOM_SHIFT = 3;

const peakSource = await get(`${NE}/ne_10m_geography_regions_elevation_points.geojson`);
const peaks = [];

for (const feature of peakSource.features) {
  const p = feature.properties;
  if (p.featurecla !== 'mountain' || !p.name) continue;
  const [lon, lat] = feature.geometry.coordinates;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;

  peaks.push({
    n: p.name,
    c: [round(lon), round(lat)],
    // Metres. Some rows carry no elevation; the label just omits it.
    e: Number.isFinite(p.elevation) ? Math.round(p.elevation) : null,
    z: Math.max(1.2, (p.min_zoom ?? 7) - PEAK_ZOOM_SHIFT),
  });
}

peaks.sort((a, b) => a.z - b.z || (b.e ?? 0) - (a.e ?? 0));
await emit('atlas-peaks.json', peaks);

/* ========================================================================== */
/* water                                                                      */
/* ========================================================================== */

/**
 * Rivers and lakes, 50m.
 *
 * 110m was the obvious choice and is useless: it ships **thirteen** rivers and
 * twenty-four lakes, which is not enough to help anyone work out where they are
 * looking. 50m is 462 rivers and 412 lakes, at the cost of a megabyte before
 * rounding — so both are rounded to two places and stripped of every property.
 *
 * Stripped of every property, because nothing here is labelled or styled by
 * attribute. Rivers and lakes were named for one round (3 Sep 2026) — a third
 * file, `atlas-water.json`, holding 494 label anchors — and the names came back
 * off at the author's request: at globe zoom they were 91 candidates in the most
 * crowded part of the map. The file and this section's name extraction are gone
 * rather than left emitting an orphan; both are in git history.
 *
 * Rounding can also collapse consecutive points onto each other, which leaves
 * zero-length segments in a line and degenerate rings in a polygon, so both are
 * cleaned the way scripts/build-land.mjs cleans the coastline.
 *
 * Two thinning passes on top of that, because rounding alone left rivers at
 * 115 KB gzipped — bigger than every other atlas file put together, for the
 * least important layer on the map:
 *
 *   - **Scalerank 6 rivers are dropped.** That band is 207 of the 462 features
 *     and a third of all the points, and it is the minor tributaries. This globe
 *     never goes past about z8 in atlas mode, where they are a smudge.
 *   - **Douglas–Peucker, tolerance 0.02°.** About 2 km, against roughly 20 km
 *     per pixel at the home zoom and ~600 m at z8 — so the discarded vertices
 *     are below a pixel everywhere this layer is ever drawn. Lakes get the same
 *     treatment; a closed ring keeps its first and last point under DP, so
 *     closure survives, and `cleanRing` re-checks it anyway.
 */

/** Perpendicular distance from `p` to the segment `a`–`b`, in degrees. */
function pointLineDistance(point, a, b) {
  let [x, y] = a;
  let dx = b[0] - x;
  let dy = b[1] - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      [x, y] = b;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = point[0] - x;
  dy = point[1] - y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Douglas–Peucker, iteratively rather than recursively — a 2,000-point river
 * recursed on a pathological shape is a stack overflow in a build script, and
 * an explicit stack costs three extra lines.
 */
function simplify(coords, tolerance) {
  if (coords.length <= 2) return coords;

  const keep = new Uint8Array(coords.length);
  keep[0] = 1;
  keep[coords.length - 1] = 1;

  const stack = [[0, coords.length - 1]];

  while (stack.length) {
    const [first, last] = stack.pop();
    let worst = tolerance;
    let index = -1;

    for (let i = first + 1; i < last; i++) {
      const distance = pointLineDistance(coords[i], coords[first], coords[last]);
      if (distance > worst) {
        worst = distance;
        index = i;
      }
    }

    if (index === -1) continue;
    keep[index] = 1;
    stack.push([first, index], [index, last]);
  }

  return coords.filter((_, i) => keep[i]);
}

const WATER_TOLERANCE = 0.02;

function cleanLine(coords) {
  const outp = [];
  for (const [x, y] of simplify(coords, WATER_TOLERANCE)) {
    const point = [round2(x), round2(y)];
    const last = outp[outp.length - 1];
    if (last && last[0] === point[0] && last[1] === point[1]) continue;
    outp.push(point);
  }
  return outp.length >= 2 ? outp : null;
}

function cleanRing(coords) {
  const outp = cleanLine(coords);
  if (!outp) return null;
  const first = outp[0];
  const last = outp[outp.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) outp.push([...first]);
  return outp.length >= 4 ? outp : null;
}

const riverSource = await get(`${NE}/ne_50m_rivers_lake_centerlines.geojson`);
const riverLines = [];

/** The minor tributaries. See the note above `cleanLine`. */
const RIVER_SCALERANK_LIMIT = 5;

for (const feature of riverSource.features) {
  if ((feature.properties.scalerank ?? 0) > RIVER_SCALERANK_LIMIT) continue;
  const { type, coordinates } = feature.geometry;
  const parts = type === 'LineString' ? [coordinates] : coordinates;
  for (const part of parts) {
    const line = cleanLine(part);
    if (line) riverLines.push(line);
  }
}

const lakeSource = await get(`${NE}/ne_50m_lakes.geojson`);
const lakePolygons = [];

for (const feature of lakeSource.features) {
  const { type, coordinates } = feature.geometry;
  const parts = type === 'Polygon' ? [coordinates] : coordinates;
  for (const part of parts) {
    const rings = part.map(cleanRing).filter(Boolean);
    if (rings.length) lakePolygons.push(rings);
  }
}

/* Same antimeridian check build-land.mjs runs, and for the same reason: MapLibre
   reads coordinates in Mercator, so a segment jumping most of the way round the
   world draws as a line straight across the map rather than wrapping. */
function worstJump(rings) {
  let worst = 0;
  for (const ring of rings) {
    for (let i = 1; i < ring.length; i++) {
      const jump = Math.abs(ring[i][0] - ring[i - 1][0]);
      if (jump > worst) worst = jump;
    }
  }
  return worst;
}

const riverJump = worstJump(riverLines);
const lakeJump = worstJump(lakePolygons.flat());
if (riverJump > 180 || lakeJump > 180) {
  throw new Error(
    `A water feature jumps ${Math.max(riverJump, lakeJump).toFixed(2)}° of longitude — ` +
      `that is an antimeridian crossing and it will draw a line across the globe.`,
  );
}

await emit('atlas-rivers.json', {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: { type: 'MultiLineString', coordinates: riverLines },
    },
  ],
});

await emit('atlas-lakes.json', {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: { type: 'MultiPolygon', coordinates: lakePolygons },
    },
  ],
});

/* ========================================================================== */
/* validation                                                                 */
/* ========================================================================== */

const problems = [];
if (countries.length < 150) problems.push(`only ${countries.length} countries`);
if (cities.length < 200) problems.push(`only ${cities.length} cities`);
if (peaks.length < 400) problems.push(`only ${peaks.length} peaks`);
if (riverLines.length < 200) problems.push(`only ${riverLines.length} river lines`);
if (lakePolygons.length < 200) problems.push(`only ${lakePolygons.length} lakes`);

/* A spot check that the labels are still Natural Earth's SHORT cartographic
   names. `NAME` gives "China"; `NAME_EN` gives "People's Republic of China",
   which is too long to draw on a globe — and the first draft of this script used
   it, which is how this check earned its keep.

   These five used to be checked for a different reason: they are the countries
   the trips are in, and the atlas drew their labels in the page's accent. That
   highlight came off on 3 Sep 2026 at the author's request, so nothing depends
   on the match any more. The sample is kept because it is as good a sample as
   any — three of the five have a short form that differs from the formal one. */
const SHORT_NAMES = ['China', 'Japan', 'Thailand', 'Indonesia', 'Taiwan'];
const names = new Set(countries.map((c) => c.n));
const missing = SHORT_NAMES.filter((v) => !names.has(v));
if (missing.length) {
  problems.push(
    `no country label named ${missing.join(', ')} — that usually means the source field ` +
      `changed from NAME to something longer. Check the country loop above.`,
  );
}

// The globe opens at zoom 2.3. A layer with nothing to show there is a filter
// chip that appears to do nothing when it is switched on.
const HOME_ZOOM = 2.3;
for (const [label, rows] of [
  ['countries', countries],
  ['cities', cities],
  ['peaks', peaks],
]) {
  const atHome = rows.filter((r) => r.z <= HOME_ZOOM).length;
  if (!atHome) problems.push(`no ${label} are visible at the home zoom of ${HOME_ZOOM}`);
}

if (problems.length) throw new Error(problems.join('\n'));

/* ========================================================================== */
/* report                                                                     */
/* ========================================================================== */

const atHome = (rows) => rows.filter((r) => r.z <= HOME_ZOOM).length;

console.log('');
console.log(`countries       ${countries.length}  (${atHome(countries)} at the home zoom)`);
console.log(`cities          ${cities.length}  (${atHome(cities)} at the home zoom)`);
console.log(`peaks           ${peaks.length}  (${atHome(peaks)} at the home zoom)`);
console.log(`rivers          ${riverLines.length} lines`);
console.log(`lakes           ${lakePolygons.length} polygons`);
console.log(`short names ok  ${SHORT_NAMES.join(', ')}`);
console.log('');
for (const [name, bytes] of written) {
  console.log(`  ${(bytes / 1024).toFixed(1).padStart(8)} KB  ${name}`);
}
