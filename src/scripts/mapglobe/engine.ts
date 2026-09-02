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

import type { MapMode } from './modes';

export type { MapMode };

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
 */
function coastLines(rings: Ring[]): FC {
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

/** The hillshade layer, built on demand. See `ensureDem`. */
function hillshadeLayer(p: Palette): HillshadeLayerSpecification {
  return {
    id: 'hillshade',
    type: 'hillshade',
    source: 'dem-hillshade',
    /* Shading steps toward black and white, NOT toward the theme's foreground.
       This is the one place the site's "everything derives from the page" rule
       has to bend, because a shadow being darker than the surface is physics
       rather than palette.

       Deriving them the usual way was a real bug: `p.coast` steps toward `fg`,
       which is LIGHT in the dark theme, so shadows came out lighter than the
       highlights and the whole relief rendered as a negative — a near-white
       mountain range on a dark page, which read as "the theme did not apply".
       Anchoring to black and white inverts correctly on its own, because the
       land colour it starts from is already themed. */
    paint: {
      'hillshade-shadow-color': mix(p.land, '#000000', 0.45),
      'hillshade-highlight-color': mix(p.land, '#ffffff', 0.35),
      'hillshade-accent-color': mix(p.land, '#000000', 0.2),
      'hillshade-exaggeration': 0.55,
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

/** Layers that belong to the globe rather than to the terrain view. */
const PLACES_ONLY = ['coast', 'region-fill', 'region-line'];

export async function createMapGlobe(
  host: HTMLElement,
  labelLayer: HTMLElement,
  trips: MapTrip[],
  mode: MapMode,
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
    style: buildStyle(p, land, coastLines(landRings), regionPolygons(trips, visited)),
    ...PLACES_HOME,
    attributionControl: { compact: true },
    // The site has its own keyboard story and a map that swallows arrow keys
    // inside a scrolling article is a trap. Drag and wheel stay on.
    keyboard: false,
  });

  /* MapLibre reports tile, source and style failures through an `error` event
     rather than by throwing, so without this they vanish. A DEM tile that 404s
     or a style property the version rejects is otherwise a map that silently
     does nothing. */
  map.on('error', (event) => {
    console.error('mapglobe:', (event as unknown as { error?: unknown }).error ?? event);
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

  /* ---- city markers ------------------------------------------------------ */
  /* HTML markers rather than a symbol layer, because a symbol layer needs a
     glyph server — which would be a third-party font fetch on every load, for
     eight words. These are styled by the component's CSS and themed for free. */
  const markers = shown.map((trip) => {
    const el = document.createElement('a');
    el.className = 'mapglobe__label';
    el.href = trip.href;
    el.innerHTML =
      `<span class="mapglobe__label-name"></span>` +
      `<span class="mapglobe__label-when"></span>`;
    el.querySelector('.mapglobe__label-name')!.textContent = trip.label;
    el.querySelector('.mapglobe__label-when')!.textContent = trip.when;

    const [lat, lon] = visited[trip.id]!.at;
    return new Marker({ element: el, anchor: 'bottom' })
      .setLngLat([lon, lat])
      .addTo(map);
  });

  // Markers are appended to the map container by MapLibre. Moving them into the
  // page's own label layer would fight its positioning, so instead the layer is
  // used only as the visibility switch the component styles.
  void labelLayer;

  /* ---- decluttering ------------------------------------------------------ */
  /**
   * Hide labels that would sit on top of each other, greedily.
   *
   * MapLibre declutters `symbol` layers for you; it does nothing for HTML
   * markers, and six of the eight cities sit inside one 2,000 km square. At the
   * default view that produced a stack of five overlapping cards with
   * "Guangzhou & Shenzhen" written across three of them.
   *
   * The one nearest the middle of the frame wins its space, which keeps the
   * label the reader is most likely looking at. Hidden rather than faded,
   * because a label that cannot be read must not be clickable either — the same
   * rule the three.js engine follows.
   */
  function declutter(): void {
    if (current === 'terrain') return;

    const rect = host.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const entries = markers
      .map((marker) => {
        const el = marker.getElement();
        // MapLibre already hides markers on the far side of the globe; respect
        // that rather than second-guessing the occlusion maths.
        if (el.style.opacity === '0') return null;
        const point = map.project(marker.getLngLat());
        return {
          el,
          x: point.x,
          y: point.y,
          w: el.offsetWidth,
          h: el.offsetHeight,
          d: (point.x - cx) ** 2 + (point.y - cy) ** 2,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((a, b) => a.d - b.d);

    const kept: { x: number; y: number; w: number; h: number }[] = [];

    for (const entry of entries) {
      // Marker anchor is 'bottom', so the card sits above its point.
      const box = { x: entry.x - entry.w / 2, y: entry.y - entry.h, w: entry.w, h: entry.h };
      const clash = kept.some(
        (k) =>
          box.x < k.x + k.w && box.x + box.w > k.x && box.y < k.y + k.h && box.y + box.h > k.y,
      );
      entry.el.style.visibility = clash ? 'hidden' : '';
      if (!clash) kept.push(box);
    }
  }

  // `render` rather than `move`: the globe keeps drawing after a fly settles,
  // and a label must not be left behind by one frame. It is cheap — eight
  // rectangles — but bail early in terrain mode where no labels are shown.
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

  /* ---- modes -------------------------------------------------------------- */
  /* One map object in two configurations, which is the entire claim being
     tested here. Switching is a camera animation and two layer toggles — not a
     second renderer, a second canvas or a second download.

     The projection is never changed by hand: MapLibre's globe hands over to
     mercator on its own around z12, so flying from the globe down to a ridge is
     one continuous move. */
  let current: MapMode = mode;

  /**
   * Bring in the elevation source, once, on first entry to terrain mode.
   *
   * This is the whole reason `places` mode touches no third-party server: a
   * MapLibre source is fetched the moment it is added, so the only way not to
   * request Mapterhorn is not to have declared it yet. The hillshade goes in
   * beneath `coast` so the coastline still reads over the relief.
   */
  function ensureDem(): void {
    if (map.getSource('dem')) return;
    /* Two rules pulling opposite ways, and both matter.

       DO NOT override what the TileJSON declares. Mapterhorn's says
       `"tileSize": 512, "encoding": "terrarium"`, and a value set here wins over
       it — a hardcoded `tileSize: 256` decodes 512px DEM tiles at half size and
       the elevation comes out as noise. That shipped once.

       DO supply what it omits. The same TileJSON declares no `maxzoom`, so
       MapLibre falls back to 22 and requests tiles that do not exist: measured,
       z12 returns 200 and z13 returns 404, and flying to a 2 km track produced a
       screenful of 404s. `maxzoom: 12` makes MapLibre overzoom the deepest real
       tile instead of asking for one past the end of the data. */
    map.addSource('dem', { type: 'raster-dem', url: DEM_URL, maxzoom: DEM_MAX_ZOOM });

    /* A second source over the same URL, which looks redundant and is not.
       MapLibre warns when one raster-dem feeds both a hillshade layer and
       `setTerrain`, because the two want different tiles resident at different
       moments and sharing one cache costs rendering quality. Two sources, one
       HTTP cache underneath — the tiles are fetched once by the browser. */
    map.addSource('dem-hillshade', { type: 'raster-dem', url: DEM_URL, maxzoom: DEM_MAX_ZOOM });
    map.addLayer(hillshadeLayer(p), 'coast');
  }

  /**
   * Attach the terrain once the camera has stopped, never before.
   *
   * Terrain has to be OFF while the camera is down at globe zoom. Globe
   * projection plus an attached terrain is the combination MapLibre had to fix
   * once already (issue #4792), and flying from z1.6 to a ridge with terrain
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
    current = next;
    const terrain = next === 'terrain';

    for (const id of PLACES_ONLY) {
      map.setLayoutProperty(id, 'visibility', terrain ? 'none' : 'visible');
    }
    for (const marker of markers) {
      marker.getElement().style.display = terrain ? 'none' : '';
    }

    if (!terrain) {
      // Detach BEFORE going back to the globe, for the reason above — the order
      // of these three lines is the whole point of them.
      map.setTerrain(null);
      if (map.getLayer('hillshade')) map.setLayoutProperty('hillshade', 'visibility', 'none');
      map.setProjection({ type: 'globe' });

      const home = { ...PLACES_HOME, pitch: 0, bearing: 0 };
      if (animate) map.flyTo({ ...home, duration: 2200, essential: true });
      else map.jumpTo(home);
      return;
    }

    ensureDem();
    map.setLayoutProperty('hillshade', 'visibility', 'visible');
    // Mercator explicitly rather than relying on the globe handing over near
    // z12 on its own. The automatic transition is real, but it happens mid-fly
    // and this is the one mode where the projection must be settled first.
    map.setProjection({ type: 'mercator' });

    const camera = { ...TERRAIN_HOME, pitch: 66, bearing: -22 };
    if (animate) map.flyTo({ ...camera, duration: 2200, essential: true });
    else map.jumpTo(camera);

    attachTerrainWhenSettled();
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
    // Only present once terrain mode has been entered at least once.
    if (map.getLayer('hillshade')) {
      // Same black/white anchoring as the layer builder — see the note there.
      map.setPaintProperty('hillshade', 'hillshade-shadow-color', mix(p.land, '#000000', 0.45));
      map.setPaintProperty('hillshade', 'hillshade-highlight-color', mix(p.land, '#ffffff', 0.35));
      map.setPaintProperty('hillshade', 'hillshade-accent-color', mix(p.land, '#000000', 0.2));
    }
    map.setSky({
      'sky-color': p.ground,
      'horizon-color': p.ground,
      'fog-color': p.ground,
      'sky-horizon-blend': 1,
      'horizon-fog-blend': 1,
      'fog-ground-blend': 0,
      'atmosphere-blend': 0,
    });

  }

  void hasTrack;

  return {
    setMode: (next) => applyMode(next, true),
    loadGpx,
    clearTrack,
    refreshTheme,
    destroy: () => map.remove(),
  };
}
