/**
 * The MapLibre earth — the alternative to src/scripts/globe/, sitting under it
 * on /about/travel-preview so the two can be judged side by side.
 *
 * It exists to answer one question the three.js globe cannot: what it would
 * cost to have BOTH a stylised globe of the places visited AND a real terrain
 * surface a recorded GPS track can be draped on. See the decision memo — the
 * three.js engine's normal map is ~20 km/px and stores a shading vector rather
 * than a height, so a track has nothing to sit on. That is the whole reason
 * this file exists; the globe half is here only so the comparison is fair.
 *
 * Deliberately the same shape as the three.js engine, so the comparison is
 * about looks and capability rather than plumbing:
 *
 *   - Not an island. A dynamic import behind an IntersectionObserver, exactly
 *     as src/scripts/mapglobe/index.ts does it. No React anywhere near it.
 *   - Colours are derived, never chosen. It imports the SAME palette.ts the
 *     three.js globe uses, so both earths step the same perceptual distances
 *     off the same ground in all nine themes. A theme change is a handful of
 *     setPaintProperty calls instead of two uniform writes.
 *   - The coastline is the SAME public/globe/land.json. Feeding both renderers
 *     identical data is what makes a look comparison mean anything.
 *
 * One property worth protecting, and the reason terrain is opt-in rather than
 * always on: in `places` mode this makes NO third-party network request. Every
 * byte comes from public/globe/, same as today. Only `terrain` mode reaches
 * for DEM tiles, and only once the visitor asks for it. public/globe/README.md
 * claims "nothing is fetched from a third party at runtime" — this keeps that
 * true everywhere except the one mode that cannot possibly hold it.
 */

// Named imports, not a default: maplibre-gl v6 has no default export.
import {
  Map as MlMap,
  Marker,
  LngLatBounds,
  setWorkerUrl,
  type GeoJSONSource,
  type HillshadeLayerSpecification,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { mix, palette, type Palette } from '../globe/palette';

/**
 * Hand MapLibre its own worker, explicitly. Required by v6 under every bundler.
 *
 * Left alone, MapLibre locates the worker with
 * `new URL('./maplibre-gl-worker.mjs', import.meta.url)`. That resolves against
 * wherever the *bundled* module ended up, which is not next to the worker file
 * in either mode. In dev it points into `node_modules/.vite/deps/`, where Vite
 * has not put a worker, and the dev server says so:
 *
 *   [vite] The file does not exist at ".../deps/maplibre-gl-worker.mjs" which is
 *   in the optimize deps directory.
 *
 * Production was broken the same way and more quietly — the URL resolved next to
 * the hashed chunk in `_astro/`, where no worker asset was emitted at all.
 *
 * `?worker&url` and NOT plain `?url`. The shipped worker imports a sibling,
 * `maplibre-gl-shared.mjs`; `?url` copies the file verbatim without following
 * that import, so the worker dies on its first line in a production build. The
 * `worker` half is what makes Vite process it as a real worker entry.
 */
setWorkerUrl(workerUrl);

import { ATLAS_LAYERS, DEFAULT_LAYERS, MAP_LAYERS, type MapLayer, type MapMode } from './modes';

export type { MapLayer, MapMode };

/** One visited city, as the page hands it over. Same shape as GlobeTrip. */
export interface MapTrip {
  id: string;
  label: string;
  when: string;
  href: string;
}

/** Matches public/globe/visited.json. `at` is [lat, lon]; `ring` is [lon, lat]. */
interface VisitedFeature {
  ring: [number, number][];
  at: [number, number];
  span: number;
}

/**
 * Matches public/globe/atlas-countries.json and atlas-cities.json. Both are
 * label anchors and nothing else — see scripts/build-atlas.mjs. `c` is
 * [lon, lat], the way GeoJSON wants it and unlike `visited.json`'s `at`.
 *
 * `z` is Natural Earth's own MIN_LABEL / min_zoom: the zoom a cartographer
 * decided the name should appear at. `r` is LABELRANK, which is the same
 * judgement expressed as a collision priority.
 */
interface AtlasCountry {
  n: string;
  c: [number, number];
  z: number;
  r: number;
}

interface AtlasCity extends AtlasCountry {
  /** Country, so a city can still say where it is once its country label has
      been decluttered away. */
  a: string;
  /** 1 for a national capital, which gets a slightly larger dot. */
  cap: 0 | 1;
}

/** Matches atlas-peaks.json. `e` is metres, and null where the source has none. */
interface AtlasPeak {
  n: string;
  c: [number, number];
  e: number | null;
  z: number;
}

export interface TrackStats {
  name: string;
  points: number;
  km: number;
  ascent: number | null;
  low: number | null;
  high: number | null;
}

export interface MapGlobe {
  setMode(mode: MapMode): void;
  /** Which optional layers `explore` draws. Ignored by every other mode. */
  setLayers(layers: MapLayer[]): void;
  loadGpx(file: File): Promise<TrackStats>;
  clearTrack(): void;
  refreshTheme(): void;
  destroy(): void;
}

const DATA_BASE = '/globe';

/**
 * Keyless global elevation. This is the source MapLibre's own globe + terrain
 * example uses, which is the main reason it is the one here — it is the
 * configuration the upstream project tests against.
 *
 * Terrarium on AWS (s3.amazonaws.com/elevation-tiles-prod/terrarium/…) is the
 * documented fallback if this ever goes away; it needs
 * `encoding: 'terrarium'` on the source and nothing else.
 */
const DEM_URL = 'https://tiles.mapterhorn.com/tilejson.json';

/**
 * Where Mapterhorn's data actually stops, supplied because its TileJSON does
 * not say. Measured, not assumed: z12 returns 200, z13 returns 404.
 *
 * 512px tiles at z12 is roughly 20 m per pixel at this latitude — enough to
 * read ridgelines and the shape of a valley, and NOT enough for fine trail
 * detail. If that turns out to matter, a keyed provider (MapTiler's free tier
 * goes deeper) is the upgrade, and it is a one-line change to DEM_URL.
 */
const DEM_MAX_ZOOM = 12;

/**
 * Where terrain mode opens. The Central Mountain Range above Taroko, which is
 * the closest real topography to any trip in the collection — and steep enough
 * that exaggeration is not doing the work.
 *
 * It is a starting view, not a claim about where anyone walked. Drop a GPX on
 * the stage and the camera goes to that instead.
 */
/**
 * Where the globe sits. zoom 2.3 rather than the 1.6 this shipped with: at 1.6
 * the earth was a small ball with a wide empty margin inside a frame that is
 * the biggest thing on the page.
 */
const PLACES_HOME = { center: [110, 18] as [number, number], zoom: 2.3 };

const TERRAIN_HOME = { center: [121.2736, 24.1425] as [number, number], zoom: 11.6 };

/* ---- label tuning --------------------------------------------------------- */

/**
 * The most labels allowed on the map at once, before decluttering.
 *
 * This is a rendering budget, not an aesthetic one. MapLibre repositions every
 * marker it holds on every frame, so a label that is off the map costs nothing
 * and a label that is merely invisible costs a projection and a style write
 * sixty times a second. The atlas has 420 names; this is what stops all of them
 * being resident at the zoom where neither the min-zoom nor the bounds filter
 * has bitten yet.
 */
const MAX_LABELS = 110;

/** Above this zoom the viewport is small enough for a bounds test to earn its
    keep. Below it the globe shows a whole hemisphere and `getBounds` is close
    enough to the whole world to filter nothing. */
const BOUNDS_CULL_ZOOM = 3.4;

/** Slack around the frame, so a label is not popped in and out at the edge. */
const EDGE_MARGIN = 48;

/** Breathing room between two labels that do not overlap but nearly do. */
const LABEL_PAD = 2;

/* -------------------------------------------------------------------------- */
/* data                                                                        */
/* -------------------------------------------------------------------------- */

type Ring = [number, number][];
type FC = GeoJSON.FeatureCollection;

/**
 * The coastline, as lines, from the ring file the three.js earth already uses.
 *
 * Two reasons it is not drawn from `land-polygons.json`. The polygon file closes
 * Antarctica with a synthetic edge running along the pole — required to fill the
 * continent, and wrong to stroke: as a line that edge is a circle of latitude,
 * and it drew a visible ring around the south pole. `land.json`'s Antarctic ring
 * is pure coast (-85.19 to -63.23) with no closure at all, so it is the right
 * geometry for a stroke. It is also already on this page for the other earth,
 * so on the preview it costs a cache hit rather than a download.
 *
 * The one thing it needs is the fix the polygon file exists for. Three rings jump
 * a full 360° of longitude where they cross the antimeridian — legal for lines on
 * a sphere, and read by MapLibre as a segment the long way across the map. Each
 * such jump ends the current line and starts a new one, which is exactly what the
 * jump means.
 *
 * public/globe/borders.json is the same shape from the same source and needs
 * exactly the same treatment, which is why this is named for what it does
 * rather than for the first thing it was used on.
 */
function ringsToLines(rings: Ring[]): FC {
  const lines: Ring[] = [];

  for (const ring of rings) {
    let run: Ring = [];
    for (let i = 0; i < ring.length; i++) {
      const point = ring[i]!;
      const previous = ring[i - 1];
      if (previous && Math.abs(point[0] - previous[0]) > 180) {
        if (run.length > 1) lines.push(run);
        run = [];
      }
      run.push(point);
    }
    if (run.length > 1) lines.push(run);
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'MultiLineString', coordinates: lines },
      },
    ],
  };
}

const EMPTY: FC = { type: 'FeatureCollection', features: [] };

/**
 * Points for a dot layer. One property travels with them and no more — the names
 * are HTML labels, and nothing else about a place is styled by attribute.
 *
 * `cap` marks a capital, which is the only per-feature difference any dot layer
 * on this map draws.
 */
function points(rows: { c: [number, number]; cap?: 0 | 1 }[]): FC {
  return {
    type: 'FeatureCollection',
    features: rows.map((row) => ({
      type: 'Feature' as const,
      properties: { cap: row.cap ?? 0 },
      geometry: { type: 'Point' as const, coordinates: row.c },
    })),
  };
}

/** The visited footprints, as real GeoJSON — one feature per trip. */
function regionPolygons(trips: MapTrip[], visited: Record<string, VisitedFeature>): FC {
  return {
    type: 'FeatureCollection',
    features: trips
      .filter((trip) => visited[trip.id])
      .map((trip) => ({
        type: 'Feature' as const,
        properties: { id: trip.id, label: trip.label },
        geometry: { type: 'Polygon' as const, coordinates: [visited[trip.id]!.ring] },
      })),
  };
}

/* -------------------------------------------------------------------------- */
/* style                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The whole basemap, as a style document. This is the part the memo's argument
 * rests on: there is no imagery, no labels, no roads and no third-party tile
 * server in `places` mode — just two local GeoJSON sources painted in the
 * page's own colours. A MapLibre map only looks like an embedded widget if you
 * hand it a style that looks like one.
 */
function buildStyle(p: Palette, land: FC, coast: FC, regions: FC): StyleSpecification {
  return {
    version: 8,
    /* There is deliberately NO `glyphs` key here. No symbol layer exists, so no
       glyph server is needed — city names are HTML markers instead, same as the
       three.js engine, which also keeps them themeable from CSS.

       It must be OMITTED, not set to `undefined`. MapLibre validates the style
       on the key's presence, so `glyphs: undefined` fails with
       `glyphs: string expected, undefined found`, `_load` throws, and the `load`
       event never fires — leaving a live canvas, no layers, and a promise that
       never settles. That shipped, and it looked like a hang rather than an
       error. */
    projection: { type: 'globe' },
    sources: {
      land: { type: 'geojson', data: land },
      coast: { type: 'geojson', data: coast },
      regions: { type: 'geojson', data: regions },
      track: { type: 'geojson', data: EMPTY },
      /* The atlas sources are declared here EMPTY rather than added on first
         use, and unlike `dem` below that costs nothing: a geojson source with
         inline data makes no network request, so an empty one is free. What it
         buys is that the layer ORDER is fixed at build time — boundaries under
         the coastline, city dots over the visited footprints, the hillshade
         under all of them. A layer added later has to be positioned by naming a
         neighbour, and `addLayer(x, 'coast')` quietly means something different
         the moment another layer moves in between. The DATA is still fetched on
         first entry to atlas mode; see `loadAtlas`. */
      borders: { type: 'geojson', data: EMPTY },
      cities: { type: 'geojson', data: EMPTY },
      rivers: { type: 'geojson', data: EMPTY },
      lakes: { type: 'geojson', data: EMPTY },
      // No `dem` here on purpose — it is added on first entry to terrain mode.
      // A source is fetched when it is ADDED, not when a layer using it becomes
      // visible, so declaring it up front would put a Mapterhorn request on
      // every page load and quietly break the claim in the file header.
    },
    /* Sky, horizon and fog all take the ground colour, so the space around the
       globe is the band the frame is painted in and the sphere sits on the page
       rather than floating in a rendering of space. atmosphere-blend 0 because
       a blue halo is exactly the "embedded widget" tell. */
    sky: {
      'sky-color': p.ground,
      'horizon-color': p.ground,
      'fog-color': p.ground,
      'sky-horizon-blend': 1,
      'horizon-fog-blend': 1,
      'fog-ground-blend': 0,
      'atmosphere-blend': 0,
    },
    layers: [
      { id: 'sea', type: 'background', paint: { 'background-color': p.sea } },
      { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': p.land } },
      /* Water takes the SEA's colour, not a colour of its own. A lake is the
         same substance as the ocean and the palette already says what that
         looks like in nine themes; inventing a second one would be two answers
         to the same question. It reads because sea steps 0.10 off the ground
         against land's 0.20 — water is the lighter of the two in light themes,
         and the ramp inverts on its own in dark.

         `hillshade` is inserted immediately below these, so relief shows through
         land but not through water — which is what a lake looks like. */
      {
        id: 'lakes',
        type: 'fill',
        source: 'lakes',
        layout: { visibility: 'none' },
        paint: { 'fill-color': p.sea },
      },
      {
        id: 'rivers',
        type: 'line',
        source: 'rivers',
        layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': p.sea,
          /* Wider than it looks like it should be, because of what it is drawn
             IN. The sea steps 0.10 off the ground and the land 0.20, so a river
             on land is a tenth of the ramp apart from it — 1.24:1, which reads
             perfectly well as an ocean and not at all as a 0.5px hairline. It
             now names itself, so it has to be visible enough to be worth naming:
             at globe zoom a river should read as a thin arm of the sea, which is
             what it is. */
          'line-width': ['interpolate', ['linear'], ['zoom'], 1.5, 0.9, 6, 2.2],
        },
      },
      {
        id: 'borders',
        type: 'line',
        source: 'borders',
        layout: { visibility: 'none', 'line-join': 'round' },
        paint: {
          'line-color': p.boundary,
          'line-width': ['interpolate', ['linear'], ['zoom'], 1.5, 0.6, 6, 1.4],
          /* Dashed, and that is doing real work rather than decoration. A
             boundary and a coastline are otherwise the same mark in the same
             derived palette, and half the point of this mode is being able to
             tell at a glance which line is water and which is a country. */
          'line-dasharray': [3, 2],
        },
      },
      {
        id: 'coast',
        type: 'line',
        source: 'coast',
        paint: { 'line-color': p.coast, 'line-width': 0.7 },
      },
      {
        id: 'region-fill',
        type: 'fill',
        source: 'regions',
        paint: { 'fill-color': p.visited, 'fill-opacity': 0.34 },
      },
      {
        id: 'region-line',
        type: 'line',
        source: 'regions',
        paint: { 'line-color': p.visitedEdge, 'line-width': 1 },
      },
      {
        /* Above the visited footprints, so a dot inside a highlighted city is
           not swallowed by it. */
        id: 'city-dot',
        type: 'circle',
        source: 'cities',
        layout: { visibility: 'none' },
        paint: {
          /* The coastline's colour, not `p.city`. `city` steps 0.30 off the
             ground against land's 0.20 — a tenth of the ramp apart, which was
             invisible the moment the hillshade started texturing the land under
             it. A city dot is a mark of the same weight as a coastline, so it
             takes the same step. */
          'circle-color': p.coast,
          /* Stops may be expressions as long as they contain no zoom of their
             own, which is what lets one layer scale with the camera AND
             distinguish a capital. */
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            1.5,
            ['case', ['==', ['get', 'cap'], 1], 1.8, 1.1],
            6,
            ['case', ['==', ['get', 'cap'], 1], 3.8, 2.3],
          ],
          // The ground, so a dot keeps its edge over land, sea and a shaded
          // ridge alike.
          'circle-stroke-color': p.ground,
          'circle-stroke-width': 0.6,
        },
      },
      {
        id: 'track-casing',
        type: 'line',
        source: 'track',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': p.ground, 'line-width': 7, 'line-opacity': 0.8 },
      },
      {
        id: 'track',
        type: 'line',
        source: 'track',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': p.visited, 'line-width': 3.2 },
      },
    ],
  };
}

/** Which of the two shading settings a mode uses. */
type ShadeKind = 'atlas' | 'terrain';

interface Shade {
  shadow: number;
  highlight: number;
  accent: number;
  exaggeration: number;
  /**
   * Sun height above the horizon, in degrees. THIS is the control that decides
   * whether relief reads at globe zoom, and it is not obvious why.
   *
   * MapLibre shades by slope, and at 20 km per pixel even the Himalaya is a
   * gentle slope from one pixel to the next — so a high sun lights the whole
   * range almost flatly and `hillshade-exaggeration`, which is capped at 1,
   * runs out of room long before the relief reads. Dropping the sun lengthens
   * every shadow, which is exactly the trick a relief atlas uses on a page that
   * cannot be zoomed. Terrain mode does not need it: one ridge filling the
   * frame is a steep slope per pixel already.
   */
  altitude: number;
  /**
   * `multidirectional` lights the surface from several angles at once and
   * combines them, so a ridge running parallel to a single sun still catches
   * something. At global scale that is the difference between "some mountains
   * are visible" and "the mountain ranges are the shape of the continent".
   */
  method: 'standard' | 'multidirectional';
}

/**
 * How hard the relief is shaded, per mode.
 *
 * Terrain mode is one ridge filling the frame and can take a strong shade from a
 * conventional 45° sun. The atlas is a whole hemisphere at roughly 20 km per
 * pixel — the same resolution as the three.js relief look — where the same
 * settings produce a globe with a suggestion of mountains on it. Same layer,
 * same source, two genuinely different jobs.
 *
 * The atlas row was settled by shipping a ladder of five strengths and letting
 * the author pick (3 Sep 2026), which is the same conclusion the light themes
 * reached: when the right amount is a matter of screen, room and eyes, the page
 * can let the reader say — and once they have said, the picker is one control
 * that no longer earns its space. `faint` won, and these are its numbers.
 *
 * What the ladder established, and what these values encode:
 *
 *   - **The sun angle is the control that matters.** MapLibre shades by SLOPE,
 *     and at 20 km per pixel even the Himalaya is a gentle slope from one pixel
 *     to the next, so `hillshade-exaggeration` — capped at 1 — runs out of room
 *     long before the relief reads. Dropping the sun lengthens every shadow.
 *   - **`multidirectional` is the bigger visible step of the two**, because it
 *     lights ridges that run parallel to a single sun.
 *   - And **neither is what the author wanted here.** A 45° sun and `standard`
 *     is the gentlest rung on the ladder, and it is the one that leaves the
 *     landmass light enough for a page of typography to sit next to.
 *
 * Rejected, so do not reach for them again: shadow 0.42 at a 28° sun with
 * exaggeration 1 (shipped for one round, came back as too obvious), and shadow
 * 0.52 at 20° (the whole landmass darkens until the globe reads as a satellite
 * render, which is the one thing this page is trying not to look like).
 */
const SHADE: Record<ShadeKind, Shade> = {
  atlas: {
    shadow: 0.26,
    highlight: 0.2,
    accent: 0.12,
    exaggeration: 0.9,
    altitude: 45,
    method: 'standard',
  },
  terrain: {
    shadow: 0.45,
    highlight: 0.35,
    accent: 0.2,
    exaggeration: 0.55,
    altitude: 45,
    method: 'standard',
  },
};

/**
 * Shading steps toward black and white, NOT toward the theme's foreground.
 * This is the one place the site's "everything derives from the page" rule has
 * to bend, because a shadow being darker than the surface is physics rather
 * than palette.
 *
 * Deriving them the usual way was a real bug: `p.coast` steps toward `fg`,
 * which is LIGHT in the dark theme, so shadows came out lighter than the
 * highlights and the whole relief rendered as a negative — a near-white
 * mountain range on a dark page, which read as "the theme did not apply".
 * Anchoring to black and white inverts correctly on its own, because the land
 * colour it starts from is already themed.
 */
function hillshadePaint(p: Palette, s: Shade) {
  return {
    'hillshade-shadow-color': mix(p.land, '#000000', s.shadow),
    'hillshade-highlight-color': mix(p.land, '#ffffff', s.highlight),
    'hillshade-accent-color': mix(p.land, '#000000', s.accent),
    'hillshade-exaggeration': s.exaggeration,
    'hillshade-illumination-altitude': s.altitude,
    'hillshade-method': s.method,
  };
}

/**
 * The same four values, pushed at a layer that already exists.
 *
 * Written out one call at a time rather than looped over `Object.entries`:
 * `setPaintProperty` is keyed by a union of every paint property MapLibre
 * knows, and `Object.entries` widens the key back to `string`, so the loop only
 * compiles behind a cast that turns off the one check worth having here. The
 * arithmetic still lives in exactly one place above.
 */
function paintHillshade(map: MlMap, p: Palette, s: Shade): void {
  const paint = hillshadePaint(p, s);
  map.setPaintProperty('hillshade', 'hillshade-shadow-color', paint['hillshade-shadow-color']);
  map.setPaintProperty(
    'hillshade',
    'hillshade-highlight-color',
    paint['hillshade-highlight-color'],
  );
  map.setPaintProperty('hillshade', 'hillshade-accent-color', paint['hillshade-accent-color']);
  map.setPaintProperty('hillshade', 'hillshade-exaggeration', paint['hillshade-exaggeration']);
  map.setPaintProperty(
    'hillshade',
    'hillshade-illumination-altitude',
    paint['hillshade-illumination-altitude'],
  );
  // Not strictly a colour, but it moves with the strength and a mode change is
  // the only thing that ever sets it.
  map.setPaintProperty('hillshade', 'hillshade-method', paint['hillshade-method']);
}

/** The hillshade layer, built on demand. See `ensureHillshade`. */
function hillshadeLayer(p: Palette, s: Shade): HillshadeLayerSpecification {
  return {
    id: 'hillshade',
    type: 'hillshade',
    source: 'dem-hillshade',
    layout: { visibility: 'none' },
    paint: {
      ...hillshadePaint(p, s),
      // North-west, which is the cartographic convention and not a preference:
      // lit from below, the eye reads ridges as valleys. Same reasoning as the
      // three.js relief look.
      'hillshade-illumination-direction': 315,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* GPX                                                                         */
/* -------------------------------------------------------------------------- */

const R_EARTH = 6371;

function haversine(a: number[], b: number[]): number {
  const rad = Math.PI / 180;
  const dLat = (b[1]! - a[1]!) * rad;
  const dLon = (b[0]! - a[0]!) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1]! * rad) * Math.cos(b[1]! * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(s));
}

/**
 * A GPX file to a LineString, parsed in the browser and never uploaded.
 *
 * Deliberately tolerant about which element the points live in: an Apple Watch
 * workout exported through one of the Health readers comes out as `<trkpt>`,
 * but a route planned elsewhere arrives as `<rtept>`, and there is no reason to
 * reject one of them. Elevation is optional — a track with no `<ele>` still
 * draws, it just reports no ascent rather than reporting zero.
 */
function parseGpx(text: string, fallbackName: string): { line: GeoJSON.Feature; stats: TrackStats } {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('That file is not valid XML.');

  const nodes = [...doc.querySelectorAll('trkpt, rtept')];
  if (nodes.length < 2) throw new Error('No track points found — is this a GPX file?');

  const coords: number[][] = [];
  const eles: number[] = [];

  for (const node of nodes) {
    const lon = Number(node.getAttribute('lon'));
    const lat = Number(node.getAttribute('lat'));
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    coords.push([lon, lat]);
    const ele = Number(node.querySelector('ele')?.textContent);
    if (Number.isFinite(ele)) eles.push(ele);
  }

  if (coords.length < 2) throw new Error('No usable coordinates in that file.');

  let km = 0;
  for (let i = 1; i < coords.length; i++) km += haversine(coords[i - 1]!, coords[i]!);

  /* Ascent is summed off a 3 m threshold rather than raw deltas. GPS altitude
     noise is a couple of metres per sample, and summing every positive tick
     turns a flat walk into a thousand metres of climbing — the classic bug in
     naive elevation-gain code. */
  let ascent: number | null = null;
  if (eles.length === coords.length && eles.length > 1) {
    ascent = 0;
    let mark = eles[0]!;
    for (const e of eles) {
      if (e > mark + 3) {
        ascent += e - mark;
        mark = e;
      } else if (e < mark) {
        mark = e;
      }
    }
  }

  const name = doc.querySelector('trk > name, metadata > name')?.textContent?.trim();

  return {
    line: {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    },
    stats: {
      name: name || fallbackName,
      points: coords.length,
      km,
      ascent: ascent === null ? null : Math.round(ascent),
      low: eles.length ? Math.round(Math.min(...eles)) : null,
      high: eles.length ? Math.round(Math.max(...eles)) : null,
    },
  };
}

function boundsOf(coords: number[][]): LngLatBounds {
  const b = new LngLatBounds(
    coords[0] as [number, number],
    coords[0] as [number, number],
  );
  for (const c of coords) b.extend(c as [number, number]);
  return b;
}

/* -------------------------------------------------------------------------- */
/* engine                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The paint layers each optional layer owns. A layer with none of its own —
 * `relief` is the hillshade, `peaks` is labels only — still appears here, so
 * that the one loop below both toggles paint and triggers the data fetch.
 */
const LAYER_IDS: Record<MapLayer, readonly string[]> = {
  countries: ['borders'],
  cities: ['city-dot'],
  relief: [],
  peaks: [],
  water: ['lakes', 'rivers'],
};

/** Layers every globe mode draws, and `terrain` does not. Not optional: the
    footprints are what the page is about. */
const GLOBE_LAYERS = ['coast', 'region-fill', 'region-line'] as const;

/** Which label kind belongs to which filter. Trips answer to no filter. */
/* `water` is deliberately absent: rivers and lakes are geometry only. They were
   named for one round (3 Sep 2026) and the names came back off at the author's
   request — see the note on `loadWater`. A layer with no labels simply never
   appears here, and `retier` reads this map to decide which filter a label
   answers to. */
const LABEL_LAYER: Record<Exclude<LabelKind, 'trip'>, MapLayer> = {
  country: 'countries',
  city: 'cities',
  peak: 'peaks',
};

type LabelKind = 'trip' | 'country' | 'city' | 'peak';

/** What `atlas` is fixed at, and what `explore` opens with. They are no longer
    the same list: see the note on DEFAULT_LAYERS in modes.ts. */
const ATLAS_SET: ReadonlySet<MapLayer> = new Set(ATLAS_LAYERS);
const NO_LAYERS: ReadonlySet<MapLayer> = new Set();

export async function createMapGlobe(
  host: HTMLElement,
  labelLayer: HTMLElement,
  trips: MapTrip[],
  mode: MapMode,
  layers: MapLayer[] = [...DEFAULT_LAYERS],
): Promise<MapGlobe> {
  /* land-polygons.json, NOT land.json. The ring file is coastline drawn as line
     geometry on a sphere, where a jump from longitude +179.87 to -180 wraps
     invisibly around the back — correct for the three.js engine, and exactly
     wrong here, because MapLibre reads rings in Mercator and draws that segment
     as a line straight across the globe. See scripts/build-land.mjs. */
  const [land, landRings, visited] = await Promise.all([
    fetch(`${DATA_BASE}/land-polygons.json`).then((r) => r.json() as Promise<FC>),
    fetch(`${DATA_BASE}/land.json`).then((r) => r.json() as Promise<Ring[]>),
    fetch(`${DATA_BASE}/visited.json`).then(
      (r) => r.json() as Promise<Record<string, VisitedFeature>>,
    ),
  ]);

  let p = palette(host);
  const shown = trips.filter((trip) => visited[trip.id]);

  const map = new MlMap({
    container: host,
    style: buildStyle(p, land, ringsToLines(landRings), regionPolygons(trips, visited)),
    ...PLACES_HOME,
    attributionControl: { compact: true },
    // The site has its own keyboard story and a map that swallows arrow keys
    // inside a scrolling article is a trap. Drag and wheel stay on.
    keyboard: false,
  });

  /* MapLibre reports tile, source and style failures through an `error` event
     rather than by throwing, so without this they vanish. A style property the
     version rejects is otherwise a map that silently does nothing.

     The one thing filtered out is a 404 on a DEM tile, because from this source
     that is data rather than a failure. Mapterhorn is a SPARSE pyramid: a tile
     containing no land does not exist. Measured — 0/0/0, 2/3/1 and 6/53/26
     return 200 while 3/0/0 and 6/54/28 return 404 — and over a whole hemisphere
     that is a handful of expected misses per view, which is exactly enough to
     bury the errors worth reading. MapLibre draws nothing where a tile is
     missing, which is the right answer for open ocean anyway.

     The browser still logs its own "failed to load resource" line for each; that
     one belongs to the network stack and no handler here can remove it. */
  map.on('error', (event) => {
    const detail = event as unknown as { error?: { status?: number }; sourceId?: string };
    const isDem = detail.sourceId === 'dem' || detail.sourceId === 'dem-hillshade';
    if (isDem && detail.error?.status === 404) return;
    console.error('mapglobe:', detail.error ?? event);
  });

  /* Raced against a timeout on purpose. A style that fails validation never
     fires `load` and never rejects either, so an un-raced await here is an
     unkillable "Drawing the map" with no error anywhere — which is exactly how
     the `glyphs` bug above hid. Now a hang becomes a visible failure. */
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('MapLibre never fired `load` — the style was probably rejected.')),
      15000,
    );
    map.once('load', () => {
      clearTimeout(timer);
      resolve();
    });
  });

  /* The mode is read by `declutter` and `retier`, both wired to map events
     below, so it is declared before them rather than beside `applyMode`. */
  let current: MapMode = mode;

  /** Which optional layers `explore` draws. Every other mode ignores it. */
  let chosen: ReadonlySet<MapLayer> = new Set(layers);

  /** The optional layers the CURRENT mode actually draws. */
  function activeLayers(): ReadonlySet<MapLayer> {
    if (current === 'atlas') return ATLAS_SET;
    if (current === 'explore') return chosen;
    return NO_LAYERS;
  }

  /* ---- labels ------------------------------------------------------------ */
  /* One registry for every name on the map, whatever it names.

     HTML markers rather than a symbol layer, because a symbol layer needs a
     glyph server — a third-party font fetch on every page load. That was an
     easy call for eight city names. The atlas pushes it past three thousand, so
     the cost of the choice is now real, and it is paid in the two functions
     below: MapLibre does tiering and collision for `symbol` layers and neither
     for markers, so `retier` decides which labels are on the map at all and
     `declutter` decides which of those can be read.

     What it buys is that every label is a themeable DOM node styled by
     MapGlobeStage.astro's own CSS, so a country name follows the theme picker
     for free and a trip label is a real link. */

  interface Label {
    marker: Marker;
    el: HTMLElement;
    /** [lon, lat]. */
    at: [number, number];
    kind: LabelKind;
    /** The source's own min zoom for this name. See scripts/build-atlas.mjs. */
    minZoom: number;
    /** Lower wins a collision. Trips are 0 — they are what the page is about. */
    priority: number;
    /** Where the box sits relative to the anchor point, per marker anchor. */
    ax: number;
    ay: number;
    dx: number;
    /** Measured once and cached. `offsetWidth` forces a layout, and taking it
        per marker per frame at this label count is the whole frame budget. */
    w: number;
    h: number;
    /** Currently added to the map. */
    on: boolean;
  }

  interface LabelSpec {
    el: HTMLElement;
    at: [number, number];
    anchor: 'bottom' | 'center' | 'left';
    kind: LabelKind;
    minZoom: number;
    priority: number;
    /** Pixels right of the anchor point. A city name has to clear the dot drawn
        under it; a peak's own ▲ glyph IS its mark, so it sits on the point. */
    dx?: number;
  }

  const labels: Label[] = [];

  function addLabel(spec: LabelSpec): void {
    const dx = spec.dx ?? 0;

    labels.push({
      /* `opacityWhenCovered: '0'`, overriding MapLibre's default of '0.2'.
         The default is why the far side of the globe read as names showing
         through the earth, and it was quietly worse than that: `declutter`
         has always skipped markers at opacity '0', a test that never fired
         while the covered value was '0.2'. So every occluded label still
         claimed a slot in the greedy pass and could hide a label the reader
         could actually see, and an occluded trip label stayed clickable at
         20% opacity. Eight trips hid the symptom; twenty country names did
         not. */
      marker: new Marker({
        element: spec.el,
        anchor: spec.anchor,
        offset: [dx, 0],
        opacityWhenCovered: '0',
      }).setLngLat(spec.at),
      el: spec.el,
      at: spec.at,
      kind: spec.kind,
      minZoom: spec.minZoom,
      priority: spec.priority,
      ax: spec.anchor === 'left' ? 0 : 0.5,
      ay: spec.anchor === 'bottom' ? 1 : 0.5,
      dx,
      w: 0,
      h: 0,
      on: false,
    });
  }

  /**
   * A label element for one of the atlas ranks.
   *
   * The optional `mark` is a text glyph rather than an icon, and that is the
   * point: a MapLibre icon needs a sprite sheet, which is a second network
   * request and a build step, while "▲" is already in every system font. Three
   * ranks of name then tell themselves apart by setting and mark with no
   * legend, no sprite and no glyph server: countries in letterspaced mono caps,
   * cities in mixed-case sans, and peaks with a ▲ and a height.
   */
  function placeElement(
    kind: string,
    name: string,
    options: { mark?: string; sub?: string; title?: string } = {},
  ): HTMLElement {
    const el = document.createElement('span');
    el.className = `mapglobe__place mapglobe__place--${kind}`;

    if (options.mark) {
      const mark = document.createElement('span');
      mark.className = 'mapglobe__place-mark';
      mark.textContent = options.mark;
      // Decoration, not content. "Black up-pointing triangle Everest" is a
      // worse thing for a screen reader to say than "Everest".
      mark.setAttribute('aria-hidden', 'true');
      el.append(mark);
    }

    el.append(document.createTextNode(name));

    if (options.sub) {
      const sub = document.createElement('span');
      sub.className = 'mapglobe__place-sub';
      sub.textContent = options.sub;
      // A real space, not just the margin. The margin separates them on screen;
      // without this the accessible name and anything copied out of the page
      // read "Mount Everest8,848 m".
      el.append(document.createTextNode(' '), sub);
    }

    if (options.title) el.title = options.title;
    return el;
  }

  /* ---- the trips --------------------------------------------------------- */
  for (const trip of shown) {
    const el = document.createElement('a');
    el.className = 'mapglobe__label';
    el.href = trip.href;
    el.innerHTML =
      `<span class="mapglobe__label-name"></span>` +
      `<span class="mapglobe__label-when"></span>`;
    el.querySelector('.mapglobe__label-name')!.textContent = trip.label;
    el.querySelector('.mapglobe__label-when')!.textContent = trip.when;

    const [lat, lon] = visited[trip.id]!.at;
    addLabel({ el, at: [lon, lat], anchor: 'bottom', kind: 'trip', minZoom: 0, priority: 0 });
  }

  // Markers are appended to the map container by MapLibre. Moving them into the
  // page's own label layer would fight its positioning, so instead the layer is
  // used only as the visibility switch the component styles.
  void labelLayer;

  /* ---- the optional data, fetched one layer at a time -------------------- */
  /* The same deferral `places` mode gets from the whole engine, one level down
     and now per filter. Nothing is requested until a layer is switched on, and
     switching it off again never re-requests it.

     That granularity is the difference between a filter row and a menu of
     downloads: a reader who wants rivers should not also pay 82 KB for borders,
     and gzipped these are not small — borders 82 KB, rivers 48, lakes 37,
     peaks 12, cities 6, countries 3.

     It is also what lets this mode stay honest about the network: every one of
     those files is local, and the ONLY third-party request any globe mode makes
     is for the DEM tiles the relief reads. */

  const json = <T,>(name: string): Promise<T> =>
    fetch(`${DATA_BASE}/${name}`).then((response) => {
      if (!response.ok) throw new Error(`${name} returned ${response.status}`);
      return response.json() as Promise<T>;
    });

  const source = (id: string): GeoJSONSource => map.getSource(id) as GeoJSONSource;

  async function loadCountries(): Promise<void> {
    const [countries, borderRings] = await Promise.all([
      json<AtlasCountry[]>('atlas-countries.json'),
      json<Ring[]>('borders.json'),
    ]);

    source('borders').setData(ringsToLines(borderRings));

    /* Every country label is the same rank, ordered by Natural Earth's own
       LABELRANK and nothing else.

       A country with a trip in it used to read in the page's accent and win its
       space ahead of every other country. That came off on 3 Sep 2026 at the
       author's request — *"no need to highlight country name, just the area that
       I visit is enough"* — and the accent footprint on the map is what answers
       "where has this person been". The priority boost went with the colour
       rather than surviving it: a label that quietly outranks its neighbours for
       a reason the reader cannot see is worse than one that does not. */
    for (const country of countries) {
      addLabel({
        el: placeElement('country', country.n),
        at: country.c,
        anchor: 'center',
        kind: 'country',
        minZoom: country.z,
        priority: 10 + country.r,
      });
    }
  }

  async function loadCities(): Promise<void> {
    const cities = await json<AtlasCity[]>('atlas-cities.json');
    source('cities').setData(points(cities));

    for (const city of cities) {
      addLabel({
        // The country goes in a tooltip rather than on the label: it answers a
        // question the reader only sometimes has, and 243 city-and-country
        // pairs on screen is not an atlas, it is a wall.
        el: placeElement('city', city.n, {
          title: city.a ? `${city.n}, ${city.a}` : undefined,
        }),
        at: city.c,
        anchor: 'left',
        kind: 'city',
        minZoom: city.z,
        priority: 24 + city.r,
        dx: 7,
      });
    }
  }

  async function loadPeaks(): Promise<void> {
    const peaks = await json<AtlasPeak[]>('atlas-peaks.json');

    peaks.forEach((peak, index) => {
      addLabel({
        el: placeElement('peak', peak.n, {
          mark: '▲',
          // The height is the information. It is the reason this layer is not
          // just more dots.
          sub: peak.e === null ? undefined : `${peak.e.toLocaleString()} m`,
        }),
        at: peak.c,
        anchor: 'left',
        kind: 'peak',
        minZoom: peak.z,
        // The file is sorted by zoom band then by height, so the index carries
        // that ordering into a collision between two peaks in the same band.
        priority: 32 + (index / peaks.length) * 6,
      });
    });
  }

  /**
   * Rivers and lakes, as geometry and nothing else.
   *
   * They were named for one round (3 Sep 2026) — 494 anchors in an
   * `atlas-water.json`, set in italic — and the names came straight back off at
   * the author's request. The brief for this whole mode is "more information,
   * but do not make it messy", and at globe zoom the water names were 91
   * candidates in the most crowded part of the map: they read, and they read
   * over everything else. The file, its build step and the `water` label rank
   * are all gone rather than left switched off.
   *
   * The line width the naming prompted is kept. A river at 0.5px and 1.24:1
   * against the land was invisible whether or not it had a name on it.
   */
  async function loadWater(): Promise<void> {
    const [rivers, lakes] = await Promise.all([
      json<FC>('atlas-rivers.json'),
      json<FC>('atlas-lakes.json'),
    ]);
    source('rivers').setData(rivers);
    source('lakes').setData(lakes);
  }

  /** `relief` is the one layer with no data of its own — the hillshade brings
      its source in with it. See `ensureHillshade`. */
  const LOADERS: Record<MapLayer, (() => Promise<void>) | null> = {
    countries: loadCountries,
    cities: loadCities,
    relief: null,
    peaks: loadPeaks,
    water: loadWater,
  };

  const loaded = new Map<MapLayer, Promise<void>>();

  function ensureData(layer: MapLayer): void {
    const load = LOADERS[layer];
    if (!load || loaded.has(layer)) return;

    loaded.set(
      layer,
      load()
        .then(retier)
        .catch((error: unknown) => {
          // A layer that will not load is a plainer globe, not a broken page —
          // the same rule index.ts applies to the engine as a whole.
          console.error(`mapglobe: the ${layer} layer could not be loaded`, error);
        }),
    );
  }

  /* ---- which labels are on the map at all -------------------------------- */
  /**
   * Every source ships a `min_zoom` for every name — the zoom a cartographer
   * decided that label should appear at — and this is where it is spent.
   *
   * Below its own zoom a name is not merely hidden, it is off the map. That
   * distinction is the whole function: MapLibre reprojects every marker it holds
   * on every frame, so a label that was never added costs nothing, while a label
   * that is added and invisible costs a projection and a style write sixty times
   * a second. With every layer on there are over three thousand names.
   *
   * Four filters, cheapest first: the layer's own on/off, the cartographer's
   * zoom, a bounds test once the viewport is small enough for it to throw
   * anything away, then MAX_LABELS as the backstop at the zooms where none of
   * them has bitten yet.
   */
  function retier(): void {
    const wanted = new Set<Label>();

    if (current !== 'terrain') {
      for (const label of labels) if (label.kind === 'trip') wanted.add(label);
    }

    const active = activeLayers();

    if (active.size) {
      const zoom = map.getZoom();
      const bounds = zoom > BOUNDS_CULL_ZOOM ? map.getBounds() : null;

      const candidates = labels.filter((label) => {
        if (label.kind === 'trip') return false;
        if (!active.has(LABEL_LAYER[label.kind])) return false;
        if (label.minZoom > zoom + 0.001) return false;
        return !bounds || bounds.contains(label.at);
      });

      candidates.sort((a, b) => a.priority - b.priority);
      for (const label of candidates.slice(0, MAX_LABELS)) wanted.add(label);
    }

    for (const label of labels) {
      const want = wanted.has(label);
      if (want === label.on) continue;
      label.on = want;
      if (want) label.marker.addTo(map);
      else label.marker.remove();
    }

    /* Place them straight away rather than waiting for the next frame.
       `declutter` is wired to `render`, and MapLibre only renders when something
       changes — so switching a layer on while the camera is still added its
       labels and then left every one of them visible, stacked, until the map
       happened to repaint. With four optional layers on that is twenty peak
       names piled over the Himalaya, and it looked like the collision test was
       broken rather than un-run.

       A just-added marker has no occlusion opacity yet, so a far-side label can
       claim a slot for exactly one pass; the next real render corrects it. That
       is the right way round — a label that appears and then goes is better than
       a screenful that never resolves. */
    declutter();
  }

  // `moveend` rather than `move`: retiering adds and removes DOM, which is far
  // too expensive per frame and is not needed per frame — a label's tier can
  // only change once the camera has finished going somewhere.
  map.on('moveend', retier);

  /* ---- decluttering ------------------------------------------------------ */
  /**
   * Hide labels that would sit on top of each other, greedily.
   *
   * MapLibre declutters `symbol` layers for you; it does nothing for HTML
   * markers, and six of the eight cities sit inside one 2,000 km square. At the
   * default view that produced a stack of five overlapping cards with
   * "Guangzhou & Shenzhen" written across three of them. The atlas makes the
   * same problem an order of magnitude worse, because country and city names
   * arrive pre-crowded.
   *
   * Priority first, then distance from the middle of the frame. Trips are
   * priority 0, so a country name can never cover one; below them the order is
   * Natural Earth's LABELRANK, which is a cartographer's judgement of which
   * names matter. Within one priority the label nearest the centre wins — the
   * rule this shipped with, and unchanged for the eight trips, which all share
   * priority 0.
   *
   * Hidden rather than faded, because a label that cannot be read must not be
   * clickable either — the same rule the three.js engine follows.
   */
  function declutter(): void {
    if (current === 'terrain') return;

    const rect = host.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const entries: { label: Label; x: number; y: number; d: number }[] = [];

    for (const label of labels) {
      if (!label.on) continue;

      /* MapLibre decides what the globe occludes; this only acts on the answer,
         rather than second-guessing the occlusion maths. Hidden rather than
         skipped: a label left `visibility: visible` at zero opacity is invisible
         and still clickable, which for the trip labels means an unreachable link
         sitting on top of the ocean. */
      if (label.el.style.opacity === '0') {
        label.el.style.visibility = 'hidden';
        continue;
      }

      const point = map.project(label.at);

      // Off the frame entirely: hide it and, more to the point, do not let it
      // claim a slot in the greedy pass below.
      if (
        point.x < -EDGE_MARGIN ||
        point.y < -EDGE_MARGIN ||
        point.x > rect.width + EDGE_MARGIN ||
        point.y > rect.height + EDGE_MARGIN
      ) {
        label.el.style.visibility = 'hidden';
        continue;
      }

      if (!label.w) {
        label.w = label.el.offsetWidth;
        label.h = label.el.offsetHeight;
      }

      entries.push({
        label,
        x: point.x,
        y: point.y,
        d: (point.x - cx) ** 2 + (point.y - cy) ** 2,
      });
    }

    entries.sort((a, b) => a.label.priority - b.label.priority || a.d - b.d);

    const kept: { x: number; y: number; w: number; h: number }[] = [];

    for (const { label, x, y } of entries) {
      // Reconstructed from the marker's anchor rather than measured, so this
      // stays one arithmetic pass with no second forced layout.
      const box = {
        x: x + label.dx - label.w * label.ax - LABEL_PAD,
        y: y - label.h * label.ay - LABEL_PAD,
        w: label.w + LABEL_PAD * 2,
        h: label.h + LABEL_PAD * 2,
      };
      const clash = kept.some(
        (k) =>
          box.x < k.x + k.w && box.x + box.w > k.x && box.y < k.y + k.h && box.y + box.h > k.y,
      );
      label.el.style.visibility = clash ? 'hidden' : '';
      if (!clash) kept.push(box);
    }
  }

  // `render` rather than `move`: the globe keeps drawing after a fly settles,
  // and a label must not be left behind by one frame. Bail early in terrain
  // mode, where no labels are shown at all.
  map.on('render', declutter);

  /* ---- who gets the wheel ------------------------------------------------ */
  /* Identical problem to the three.js globe, identical fix. MapLibre calls
     preventDefault on the wheel, which stops the *browser* scrolling — but this
     site scrolls with Lenis, which has its own window listener that
     preventDefault does nothing about, so the page moved while the map zoomed.
     Lenis honours data-lenis-prevent on an ancestor of the event target.
     Crucially the attribute comes back OFF at either zoom limit, so scrolling
     past the closest or furthest point hands the wheel back to the page instead
     of trapping it under the cursor. */
  const updateWheelOwner = (deltaY: number): void => {
    const zoom = map.getZoom();
    const canZoom = deltaY < 0 ? zoom < map.getMaxZoom() - 0.01 : zoom > map.getMinZoom() + 0.01;
    if (canZoom) host.dataset.lenisPrevent = '';
    else delete host.dataset.lenisPrevent;
  };

  host.addEventListener('wheel', (event) => updateWheelOwner(event.deltaY), { passive: true });
  host.addEventListener('pointerleave', () => {
    delete host.dataset.lenisPrevent;
  });

  /* ---- modes and layers --------------------------------------------------- */
  /* One map object in four configurations, which is the entire claim being
     tested here. Switching is a camera animation and a handful of layer toggles
     — not a second renderer, a second canvas or a second download.

     `places`, `atlas` and `explore` are the same globe at the same scale, so
     switching between them deliberately does NOT move the camera: the reader
     stays where they spun to and the world gains or loses its names underneath
     them. Only `terrain` is a journey, and only a return from it flies home. */

  /**
   * The elevation source `setTerrain` reads, brought in on first entry to
   * terrain mode.
   *
   * This is half of why `places` mode touches no third-party server: a MapLibre
   * source is fetched the moment it is added, so the only way not to request
   * Mapterhorn is not to have declared it yet.
   *
   * Two rules pulling opposite ways, and both matter.
   *
   * DO NOT override what the TileJSON declares. Mapterhorn's says
   * `"tileSize": 512, "encoding": "terrarium"`, and a value set here wins over
   * it — a hardcoded `tileSize: 256` decodes 512px DEM tiles at half size and
   * the elevation comes out as noise. That shipped once.
   *
   * DO supply what it omits. The same TileJSON declares no `maxzoom`, so
   * MapLibre falls back to 22 and requests tiles that do not exist: measured,
   * z12 returns 200 and z13 returns 404, and flying to a 2 km track produced a
   * screenful of 404s. `maxzoom: 12` makes MapLibre overzoom the deepest real
   * tile instead of asking for one past the end of the data.
   */
  function ensureTerrainSource(): void {
    if (map.getSource('dem')) return;
    map.addSource('dem', { type: 'raster-dem', url: DEM_URL, maxzoom: DEM_MAX_ZOOM });
  }

  /**
   * The hillshade, and its own copy of the source. Shared by the `relief` filter
   * and by `terrain` mode — the same relief at two scales and two strengths.
   *
   * A second source over the same URL looks redundant and is not. MapLibre warns
   * when one raster-dem feeds both a hillshade layer and `setTerrain`, because
   * the two want different tiles resident at different moments and sharing one
   * cache costs rendering quality. Two sources, one HTTP cache underneath — the
   * browser fetches each tile once.
   *
   * It goes in beneath `lakes`, which puts it under the water, the boundaries
   * and the coastline: relief shows through land and not through a lake, which
   * is what a lake looks like.
   */
  function ensureHillshade(): void {
    if (map.getLayer('hillshade')) return;
    if (!map.getSource('dem-hillshade')) {
      map.addSource('dem-hillshade', { type: 'raster-dem', url: DEM_URL, maxzoom: DEM_MAX_ZOOM });
    }
    map.addLayer(hillshadeLayer(p, SHADE.atlas), 'lakes');
  }

  /** Which of the two settings the hillshade is currently painted at, so a
      theme change can repaint it at the same one. Null when no relief is
      shown. */
  let shade: ShadeKind | null = null;

  function setHillshade(kind: ShadeKind | null): void {
    shade = kind;

    if (!kind) {
      if (map.getLayer('hillshade')) map.setLayoutProperty('hillshade', 'visibility', 'none');
      return;
    }

    ensureHillshade();
    map.setLayoutProperty('hillshade', 'visibility', 'visible');
    paintHillshade(map, p, SHADE[kind]);
  }

  /**
   * Show exactly the layers the current mode and filter ask for.
   *
   * One pass over the whole table rather than a diff against what was showing:
   * `setLayoutProperty` to the value a layer already has is a no-op inside
   * MapLibre, and a diff would be state to keep correct for no gain.
   */
  function applyLayers(): void {
    const globe = current !== 'terrain';
    for (const id of GLOBE_LAYERS) {
      map.setLayoutProperty(id, 'visibility', globe ? 'visible' : 'none');
    }

    const active = activeLayers();

    for (const layer of MAP_LAYERS) {
      const on = active.has(layer);
      // Fetching is triggered here rather than in the click handler, so that a
      // stored filter set loads on arrival exactly as a click would.
      if (on) ensureData(layer);
      for (const id of LAYER_IDS[layer]) {
        map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
      }
    }

    // `terrain` shades the one ridge it flew to, at its own strength. A globe
    // mode shades the whole world, and only if the reader asked for it.
    setHillshade(current === 'terrain' ? 'terrain' : active.has('relief') ? 'atlas' : null);

    retier();
  }

  /**
   * Attach the terrain once the camera has stopped, never before.
   *
   * Terrain has to be OFF while the camera is down at globe zoom. Globe
   * projection plus an attached terrain is the combination MapLibre had to fix
   * once already (issue #4792), and flying from z2.3 to a ridge with terrain
   * already attached drags the camera through exactly that state for two
   * seconds. Attaching on arrival costs nothing — there is no terrain worth
   * seeing at z2 anyway.
   */
  function attachTerrainWhenSettled(): void {
    const attach = (): void => {
      if (current === 'terrain') map.setTerrain({ source: 'dem', exaggeration: 1.35 });
    };
    if (map.isMoving()) map.once('moveend', attach);
    else attach();
  }

  function applyMode(next: MapMode, animate: boolean): void {
    const wasGlobe = current !== 'terrain';
    current = next;

    if (next !== 'terrain') {
      // Detach BEFORE going back to the globe, for the reason above — the order
      // of these three lines is the whole point of them.
      map.setTerrain(null);
      applyLayers();
      map.setProjection({ type: 'globe' });

      // Same globe, same scale: leave the camera where the reader put it. Only
      // arriving back from terrain is a journey home.
      if (!wasGlobe) {
        const home = { ...PLACES_HOME, pitch: 0, bearing: 0 };
        if (animate) map.flyTo({ ...home, duration: 2200, essential: true });
        else map.jumpTo(home);
      }
      return;
    }

    applyLayers();
    ensureTerrainSource();
    // Mercator explicitly rather than relying on the globe handing over near
    // z12 on its own. The automatic transition is real, but it happens mid-fly
    // and this is the one mode where the projection must be settled first.
    map.setProjection({ type: 'mercator' });

    const camera = { ...TERRAIN_HOME, pitch: 66, bearing: -22 };
    if (animate) map.flyTo({ ...camera, duration: 2200, essential: true });
    else map.jumpTo(camera);

    attachTerrainWhenSettled();
  }

  function setLayers(next: MapLayer[]): void {
    chosen = new Set(next);
    // Only `explore` reads the set, so a filter changed in any other mode is
    // remembered and costs nothing until the reader switches back to it.
    if (current === 'explore') applyLayers();
  }

  applyMode(mode, false);

  /* ---- a track ------------------------------------------------------------ */
  let hasTrack = false;

  async function loadGpx(file: File): Promise<TrackStats> {
    const { line, stats } = parseGpx(await file.text(), file.name.replace(/\.gpx$/i, ''));
    (map.getSource('track') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: [line],
    });
    hasTrack = true;

    if (current !== 'terrain') applyMode('terrain', false);

    map.fitBounds(boundsOf((line.geometry as GeoJSON.LineString).coordinates), {
      padding: 80,
      pitch: 62,
      bearing: -22,
      duration: 2000,
      essential: true,
    });
    // fitBounds re-starts the camera, so re-arm: the attach queued by applyMode
    // above would otherwise fire against the pre-fit view.
    attachTerrainWhenSettled();

    return stats;
  }

  function clearTrack(): void {
    (map.getSource('track') as GeoJSONSource).setData(EMPTY);
    hasTrack = false;
    if (current === 'terrain') map.flyTo({ ...TERRAIN_HOME, pitch: 66, bearing: -22, duration: 1400 });
  }

  /* ---- theme -------------------------------------------------------------- */
  /* The site's theme controls only add and remove classes on <html>, so neither
     side has to know about the other — same contract the three.js globe honours.
     The difference is what it costs to obey it: two uniform writes there, a
     handful of setPaintProperty calls here. Nothing is re-fetched, and the
     GeoJSON sources are untouched. */
  function refreshTheme(): void {
    p = palette(host);
    map.setPaintProperty('sea', 'background-color', p.sea);
    map.setPaintProperty('land', 'fill-color', p.land);
    map.setPaintProperty('coast', 'line-color', p.coast);
    map.setPaintProperty('region-fill', 'fill-color', p.visited);
    map.setPaintProperty('region-line', 'line-color', p.visitedEdge);
    map.setPaintProperty('track', 'line-color', p.visited);
    map.setPaintProperty('track-casing', 'line-color', p.ground);
    map.setPaintProperty('borders', 'line-color', p.boundary);
    map.setPaintProperty('city-dot', 'circle-color', p.coast);
    map.setPaintProperty('city-dot', 'circle-stroke-color', p.ground);
    map.setPaintProperty('lakes', 'fill-color', p.sea);
    map.setPaintProperty('rivers', 'line-color', p.sea);
    // Only present once a mode that shades relief has been entered, and only
    // repainted at the strength the current mode asked for.
    if (map.getLayer('hillshade') && shade) paintHillshade(map, p, SHADE[shade]);
    map.setSky({
      'sky-color': p.ground,
      'horizon-color': p.ground,
      'fog-color': p.ground,
      'sky-horizon-blend': 1,
      'horizon-fog-blend': 1,
      'fog-ground-blend': 0,
      'atmosphere-blend': 0,
    });

    // Label boxes are measured once and cached. A theme cannot change a label's
    // text, but it can change the font stack under it, so drop the measurements
    // and let the next declutter re-take them.
    for (const label of labels) label.w = 0;
  }

  void hasTrack;

  return {
    setMode: (next) => applyMode(next, true),
    setLayers,
    loadGpx,
    clearTrack,
    refreshTheme,
    destroy: () => map.remove(),
  };
}
