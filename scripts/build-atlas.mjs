/**
 * Generates public/globe/atlas-countries.json and public/globe/atlas-cities.json —
 * the label anchors the MapLibre earth's `atlas` mode reads.
 *
 * WHY NEW FILES, when public/globe already has borders.json and cities.json.
 *
 * Neither existing file carries a NAME. `borders.json` is boundary geometry with
 * no attributes at all, and `cities.json` is 900 bare `[lat, lon]` pairs — both
 * were built for the three.js earth, which draws them as anonymous lines and
 * dots. The atlas has to be able to say "Japan" and "Bangkok", so it needs the
 * one thing neither file kept.
 *
 * What it does keep is Natural Earth's own label metadata, which is the reason
 * this is a build step rather than a runtime filter:
 *
 *   - LABEL_X / LABEL_Y are hand-placed label anchors, not centroids. A centroid
 *     puts "Norway" in the sea and "Chile" in Argentina.
 *   - MIN_LABEL / min_zoom are the zoom each label is *intended* to appear at,
 *     decided by a cartographer. That is what tiers the atlas — see `retier()`
 *     in src/scripts/mapglobe/engine.ts — and inventing a tiering rule from
 *     population would be worse and would be mine.
 *
 * 110m rather than 50m on purpose. These are label anchors, not geometry: 177
 * countries and 243 cities is a world atlas's worth of names, and the 50m sets
 * are several times larger for names that would never survive decluttering.
 *
 *   node scripts/build-atlas.mjs
 */

import { writeFile } from 'node:fs/promises';

const BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';
const COUNTRIES = `${BASE}/ne_110m_admin_0_countries.geojson`;
const CITIES = `${BASE}/ne_110m_populated_places_simple.geojson`;

const OUT_COUNTRIES = new URL('../public/globe/atlas-countries.json', import.meta.url);
const OUT_CITIES = new URL('../public/globe/atlas-cities.json', import.meta.url);

/** Three places — about 110 m. A label anchor does not need more, and the
    files stay small enough to be a rounding error next to borders.json. */
const round = (n) => Math.round(n * 1000) / 1000;

async function get(url) {
  console.log(`fetching ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Natural Earth returned ${response.status} for ${url}`);
  return response.json();
}

/* ---- countries ----------------------------------------------------------- */

const countrySource = await get(COUNTRIES);
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

/* ---- cities -------------------------------------------------------------- */

const citySource = await get(CITIES);
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

/* ---- validation ---------------------------------------------------------- */

const problems = [];
if (countries.length < 150) problems.push(`only ${countries.length} countries`);
if (cities.length < 200) problems.push(`only ${cities.length} cities`);

// The trips' countries are the ones that get the visited treatment. If a rename
// upstream breaks the match, the atlas silently stops highlighting them, so the
// build says so here instead.
const VISITED = ['China', 'Japan', 'Thailand', 'Indonesia', 'Taiwan'];
const names = new Set(countries.map((c) => c.n));
const missing = VISITED.filter((v) => !names.has(v));
if (missing.length) {
  problems.push(
    `no country label named ${missing.join(', ')} — the visited highlight matches on ` +
      `NAME, so these trips would lose it. Check src/content/trips/*.md against the source.`,
  );
}

if (problems.length) throw new Error(problems.join('\n'));

/* ---- write --------------------------------------------------------------- */

const countryJson = JSON.stringify(countries);
const cityJson = JSON.stringify(cities);
await writeFile(OUT_COUNTRIES, countryJson);
await writeFile(OUT_CITIES, cityJson);

const zoomHist = (rows) =>
  Object.entries(
    rows.reduce((acc, r) => {
      const k = Math.floor(r.z);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([k, v]) => `z${k}:${v}`)
    .join('  ');

console.log(`countries       ${countries.length}`);
console.log(`  by min zoom   ${zoomHist(countries)}`);
console.log(`cities          ${cities.length}`);
console.log(`  by min zoom   ${zoomHist(cities)}`);
console.log(`visited matched ${VISITED.join(', ')}`);
console.log(`written         ${(countryJson.length / 1024).toFixed(1)} KB → atlas-countries.json`);
console.log(`                ${(cityJson.length / 1024).toFixed(1)} KB → atlas-cities.json`);
