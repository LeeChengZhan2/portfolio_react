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
 * `terrain` mode carries the author's own recorded routes — see MapTrail and
 * scripts/build-trails.mjs. It used to also accept a GPX dropped on the frame,
 * parsed in the browser; that came off on 7 Sep 2026 once the ten routes were
 * built in, because the feature answered a question the page no longer asks.
 * The parser, its ascent threshold and the drop target are all gone — git
 * history has them if a "bring your own track" mode is ever wanted again.
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
 * One property worth protecting, and the reason terrain is a separate mode
 * rather than a layer: entering `explore` makes NO third-party network request.
 * Its two default chips are local files, so every byte comes from
 * public/globe/. Only Relief and `terrain` mode reach for DEM tiles, and only
 * once the visitor asks for them. public/globe/README.md claims "nothing is
 * fetched from a third party at runtime" — this keeps that true everywhere
 * except where the reader has pressed the control that cannot hold it.
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

import {
  MAP_LAYERS,
  TERRAIN_VIEW,
  type MapContent,
  type MapLayer,
  type MapMode,
  type MapView,
} from './modes';

export type { MapContent, MapLayer, MapMode, MapView };

/** One visited city, as the page hands it over. Same shape as GlobeTrip. */
export interface MapTrip {
  id: string;
  label: string;
  when: string;
  href: string;
}

/**
 * One recorded route, exactly as `src/data/trails.json` carries it.
 *
 * Built by scripts/build-trails.mjs from the author's own GPX exports. Every
 * figure here is measured off the FULL recording, while the geometry the map
 * draws — fetched separately from public/globe/trails/<id>.json — is simplified
 * to a few hundred points. That split is the whole reason the readout can be
 * trusted: simplifying the line harder can never shorten the distance the page
 * claims, because the two never touch.
 *
 * There is deliberately no bounding box here. The camera is framed from the
 * geometry it just drew, so a second copy of the extent would be a second
 * source of truth for where the route is — one that could disagree with the
 * line on the map and would be believed.
 */
export interface MapTrail {
  id: string;
  /** Short, for a picker chip: "Belumut", "Muluozi – Wuguishi". */
  label: string;
  /** Where, for the readout: "Changping Valley, Chuanxi, China". */
  place: string;
  kind: 'hike' | 'run';
  /** Already formatted — "25 Jul 2026". See localDate() in the build script. */
  when: string;
  /** The same date sortable. Only the build script reads it — it is what orders
      the list, and therefore what picks the route terrain mode opens on. */
  date: string;
  km: number;
  /** Null where the recording carried no elevation at all. Never estimated. */
  ascent: number | null;
  /** The mirror of `ascent`, summed with the same 3 m rule (16 Sep 2026). */
  descent: number | null;
  low: number | null;
  high: number | null;
  points: number;
  /* The clock and the durations (16 Sep 2026), for the Summary detail view.
     Local wall-clock times by the build script's longitude rule — "07:24" —
     and seconds for the two durations. `moving` is every interval faster than
     a standstill; the difference from `elapsed` is time spent stopped. */
  start: string;
  end: string;
  elapsed: number | null;
  moving: number | null;
  /** From the geometry: does the walk retrace itself, close on itself, or end
      somewhere else. Gives the start dot and the end ring a word. */
  shape: 'loop' | 'out-and-back' | 'point-to-point';
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

export interface MapGlobe {
  setMode(mode: MapMode): void;
  /** Which of the five optional layers the globe modes draw. Terrain ignores it. */
  setLayers(layers: MapLayer[]): void;
  /** Which of the trips and the trails `combined` draws. Every other mode has
      its own answer and ignores this. */
  setContent(content: MapContent[]): void;
  /**
   * The angle `combined` looks from — flat on the sphere, or pitched and
   * shaded. It changes the camera and the hillshade and NOTHING else: the same
   * trips, the same routes, the same five layers, from a different angle.
   *
   * Stored whatever the mode, applied only in `combined`, exactly as the layer
   * and content filters are.
   *
   * `trail` is the route to arrive on, and only one caller passes it: a route
   * clicked on the flat globe, which moves this switch to Terrain on the
   * reader's behalf rather than handing them to the Trails tab. Passing the two
   * together is what makes that one camera movement instead of a flight to the
   * route the view would have opened on followed by a second to the right one.
   * It counts as the reader choosing a walk, so it drills; every other way into
   * the Terrain view arrives at the region.
   */
  setView(view: MapView, trail?: MapTrail | null): void;
  /**
   * Draw one of the built-in routes, fetching its geometry on first use.
   *
   * `animate` is false for the route terrain mode opens on, so the map arrives
   * already looking at it rather than flying there from the overview.
   */
  loadTrail(trail: MapTrail, animate?: boolean): Promise<void>;
  /**
   * Terrain mode's other half: every route at once, grouped by area, with
   * nothing picked. This is where the mode opens unless a route was stored.
   */
  showAllTrails(): Promise<void>;
  /**
   * Aim one of `All`'s terrain views at a TRIP rather than at a route — the
   * ground a visited place sits on, with the walks taken there in frame.
   *
   * The counterpart to `loadTrail` for the index rail, where the eight trips
   * are rows beside the ten routes. Five of them have no recorded route in
   * them at all, which is why this cannot just be "load that trip's first
   * route": the subject is the place.
   *
   * Silently does nothing for an id with no footprint, which is the same
   * treatment the trip cards get — `visited.json` is what decides which trips
   * the map can point at.
   */
  showPlace(id: string, animate?: boolean): Promise<void>;
  /**
   * Put a dot on the drawn route, or take it off — the map half of the detail
   * views (16 Sep 2026). Hovering the elevation profile or a split moves this
   * to the matching point on the ground, so the chart and the line answer each
   * other. `null` clears it. Its layer is one of TRACK_LAYERS, so it can never
   * show without the route it sits on.
   */
  setProbe(at: [number, number] | null): void;
  /**
   * Colour the drawn route by a series along it — the Colour detail view. The
   * values are 0–1, evenly spaced along the line by distance, and the ramp
   * runs from the accent to the page's text colour so a higher value reads as
   * "more ink" in both themes. `null` puts the flat accent back.
   *
   * The series is kept, so a theme change re-derives the same ramp in the new
   * colours rather than dropping back to the flat line.
   */
  colourTrack(values: number[] | null): void;
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
 * It is a starting view, not a claim about where anyone walked. Nothing can ask
 * for it any more: the ten routes are built in and Clear was removed on
 * 7 Sep 2026, so it is reached only on a failure — an empty manifest, or an
 * opening route that will not load. Not dead code; the null-`trackBounds`
 * fallback in `applyMode`.
 */
/**
 * Where the globe sits. zoom 2.3 rather than the 1.6 this shipped with: at 1.6
 * the earth was a small ball with a wide empty margin inside a frame that is
 * the biggest thing on the page.
 *
 * Named for the projection, not for a mode. It was PLACES_HOME until the mode
 * called `places` was removed on 7 Sep 2026, which is the kind of name that
 * quietly outlives the thing it referred to.
 */
const GLOBE_HOME = { center: [110, 18] as [number, number], zoom: 2.3 };

const TERRAIN_HOME = { center: [121.2736, 24.1425] as [number, number], zoom: 11.6 };

/** The terrain setting, as one object because it is now applied from two places
    — on arrival in terrain mode, and again on a theme change. See refreshTheme
    for why the second one exists. */
const TERRAIN = { source: 'dem', exaggeration: 1.35 };

/**
 * The angle every camera in terrain mode arrives at — the overview of all the
 * routes and the single route alike (9 Sep 2026, the author's call).
 *
 * The overview shipped flat and top-down for a day, which was wrong for the
 * mode it opens: this is the half of the page that is about ground you can
 * stand on, and a hillshade seen square-on reads as a pattern rather than as
 * relief. Tilting it is what makes a range look like a range before you have
 * clicked into anything. The numbers are the ones the single-route view has
 * used since it shipped, so the two views are the same camera at two scales
 * and flying between them changes only how far away you are.
 */
const TRAILS_VIEW = { pitch: 62, bearing: -22 };

/* A GLOBE_TILT of pitch 40 / bearing 0 stood here, the angle the whole-world
   `tilted` view leaned to. It went with that view on 14 Sep 2026 — the surviving
   Terrain is at a ridge's scale and takes TRAILS_VIEW, which is what it was
   always tuned for. The four-candidate measurement behind 40/0 is in the git
   history and in CLAUDE.md if a hemisphere ever needs leaning again. */

/**
 * How much wider than the route itself the Terrain view frames on ARRIVAL
 * (10 Sep 2026).
 *
 * Six times the route's own extent, applied to the BOUNDS rather than as a zoom
 * offset, so the whole thing stays in the one `fitBounds` idiom every other
 * camera in this file uses and the padding keeps working. Six is 2^2.6, so it
 * is about two and a half zoom levels out from the drilled frame: a 14 km walk
 * becomes an 84 km box, which at this frame lands near z8 — close enough that
 * the mesh still reads as mountains, wide enough that the mountains rather than
 * the walk are the subject. That is the whole difference between the view's two
 * scales, and it is one number.
 */
const REGION_GROWTH = 6;

/**
 * And how much wider the Trails tab's own single-route fit is, in zoom levels
 * (10 Sep 2026, author's request — the third of three changes asked for
 * together).
 *
 * Applied as a bounds growth like the above rather than by subtracting from a
 * zoom, for the same reason. 1.6 is a little over half a zoom level, which is
 * deliberately modest: the single-route view was not wrong, it was tight, and
 * the ask was for a route to sit in more of its surroundings rather than for a
 * different picture. One number to revert.
 */
const TRAIL_GROWTH = 1.6;

/**
 * And how much wider than a TRIP's own ground the Terrain view frames it
 * (10 Sep 2026).
 *
 * Far smaller than REGION_GROWTH, and the reason is what it is applied to. Six
 * is right for a 14 km walk, which is a line on a mountain and needs the
 * mountain put around it. A trip's box is already region-sized before anything
 * is added to it — Tokyo's built-up footprint is 140 km across, and Chengdu's
 * grows to 130 km once the three walks up the Changping valley are folded in —
 * so the same multiplier would frame a thousand kilometres of China to show one
 * valley. 1.6 is a margin around ground that is already the subject rather than
 * a search for context that is missing.
 */
const PLACE_GROWTH = 1.6;

/**
 * How close a fit is allowed to get to ONE route or ONE place — the cap that
 * stops a short walk being framed from three metres away (14 Sep 2026,
 * author's request: *"the terrain for single trail view some of it is too near.
 * Use lamasi-muluozi range as default"*; loosened to this value the next day,
 * *"now to far already, make the view between previous and now"*).
 *
 * `fitBounds` frames whatever it is given, and the ten routes differ in extent
 * by a factor of six: Lamasi–Muluozi spans 9.2 km corner to corner and Cape
 * Krathing 1.5 km. Fitting each one to its own extent therefore framed them at
 * six different scales, spread over three and a half zoom levels, and the short
 * ones ended up absurdly close — measured on a 1182x790 frame, uncapped:
 *
 *     Lamasi–Muluozi  9.2 km   z12.00    225 px of line, 23% of the frame
 *     Kulai           7.3 km   z12.67    314 px, 32%
 *     Belumut         4.6 km   z13.47    368 px, 37%
 *     Pulai           3.6 km   z14.09    795 px, 81%
 *     Lambak          1.7 km   z15.02    575 px, 58%
 *     Cape Krathing   1.5 km   z15.50    891 px, 91% — and CLIPPED
 *
 * Two separate things go wrong at the bottom of that list. The one the author
 * saw is that the ROUTE STOPS FITTING: at z15.5 Cape Krathing spans nearly the
 * whole frame, so its far end slid under the index rail and off the edge —
 * `fitBounds` cannot help, because it computes the frame top-down and this
 * camera is pitched 62 degrees over a terrain mesh, so the ground it actually
 * shows is a trapezoid narrower at the near edge than the box it fitted. The
 * second is that there is less and less TO see: the DEM ends at DEM_MAX_ZOOM,
 * so past it MapLibre is overzooming the same tiles and the hillside goes soft.
 *
 * THE NUMBER TOOK TWO TRIES, and the first one is why this is not simply
 * `DEM_MAX_ZOOM`. Capping at the data's own depth is the principled answer and
 * it over-corrected: every route landed at z12, which is the author's reference
 * framing exactly, and a 3.8 km coastal walk at that scale is a 77 px mark in a
 * 1182 px frame — 8% of the width. It also flattened the view's two scales for
 * the two smallest routes, since six times a 1.5 km extent already reaches z12,
 * so arriving and drilling were the same picture and the click did nothing.
 *
 * A level and a half of deliberate overzoom is the answer to both. Measured
 * across the three candidates, as the share of the frame's width the line
 * spans, and every route fully visible in all three:
 *
 *     cap        smallest   widest    capped   drill step   relief
 *     z12             8%      23%     8 of 10  0.00-2.58    native
 *     z13            14%      38%     7 of 10  0.59-2.59    soft
 *     z13.5 <--      20%      53%     3 of 10  0.59-2.59    still reads
 *     z14            29%      76%     3 of 10  0.59-2.59    visibly mushy
 *
 * So seven of the ten routes are framed by their own extent and only the three
 * smallest are held back, every route keeps a real drill step, and the spread
 * of scales is a level and a half rather than three and a half. Past here the
 * gain is only in size: z14 is no more visible and the DEM is two levels
 * overzoomed, which shows.
 *
 * IT IS ON THE REGION FIT AS WELL AS THE DRILLED ONE, and that is not
 * belt-and-braces — it is what stops the drill running BACKWARDS if this number
 * is ever lowered again. At z12 it mattered: six times a 1.5 km extent asks for
 * z12.9, so capping only the drilled frame would have left Cape Krathing
 * arriving at z12.9 and zooming OUT to z12 when the reader picked it. At z13.5
 * no region fit reaches the cap, so it currently binds on the drilled frame
 * alone; leave it on both.
 *
 * And it decides where the camera LANDS, not how close the reader may get:
 * the map's own maxZoom is untouched at 22, and four notches of wheel take the
 * capped frame from z12 to z12.72 with the page pinned under the cursor.
 */
const TRACK_MAX_ZOOM = DEM_MAX_ZOOM + 1.5;

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

/**
 * The strip along the bottom of the frame that MapLibre's attribution sits in,
 * margin included. A camera fit always leaves this much room, so a label is
 * never flown into the licence notice. See `framePadding` for why it is a
 * constant rather than a measurement.
 */
const ATTRIBUTION_STRIP = 42;

/* ---- the trails overview -------------------------------------------------- */

/**
 * How close two routes have to be, in pixels at the overview camera, to be
 * grouped under one area label.
 *
 * Pixels rather than kilometres, because the question is not "are these routes
 * near each other" but "would their two labels be the same mark on this
 * screen", and that depends on the frame. Measured on the real data: six of the
 * ten routes are in Johor, spread over 76 km, which is fifteen pixels once the
 * whole collection is in frame — one blob whichever unit you count it in. A
 * fixed kilometre threshold got that wrong in both directions, splitting Johor
 * in two at 40 km while still merging nothing in Sichuan.
 */
const CLUSTER_PX = 120;

/**
 * And how far apart two routes can be on the GROUND and still be grouped,
 * whatever the pixels say — as a fraction of the equator, so it is in the units
 * the clustering works in. 0.003 is about 120 km.
 *
 * This is a truthfulness cap rather than a layout one, and it was put in
 * because of what happened without it at 390px: the frame is small enough that
 * the whole collection sits at a zoom where Phuket is eighty pixels from Johor,
 * so the two grouped, and the group took the name five of its seven members
 * agreed on. The card read "Johor · 7 routes" over a group that spanned two
 * countries and 1,100 km. A group is named after a place, so it has to BE one.
 *
 * Mercator inflates distance away from the equator, so the same figure is a
 * stricter cap in ground kilometres the further north a route is — about 100 km
 * in Sichuan. That is the safe direction: it can only refuse to group things,
 * never group two places that are far apart.
 */
const CLUSTER_MAX = 0.003;

/**
 * How far apart a cluster's two furthest routes must be before it breaks open
 * into its members, again in pixels.
 *
 * This is what makes the overview a two-step map rather than a pile: below this
 * the group reads as "Johor · 6 routes", above it as six named routes. It is
 * deliberately measured on the cluster's DIAMETER rather than on its tightest
 * pair — two routes that start in the same car park never separate at any zoom
 * (three of these are legs of one trek), so waiting for the tightest pair would
 * mean the group never opened at all. The pairs that still collide after the
 * break are what `declutter` is for, and the picker below the map is what
 * guarantees every route is reachable regardless.
 */
const CLUSTER_BREAK_PX = 150;

/* ---- merged cards ---------------------------------------------------------

   There is no threshold constant here, and that is the design. Two cards are
   drawn as one exactly when the collision pass would otherwise have hidden the
   second — same boxes, same padding, same test — so every name that used to
   disappear behind a neighbour now appears on it instead. A number of its own
   would be a second, slightly different definition of "too close", and the two
   would disagree at the margin: a card that is hidden and not named anywhere.

   Which is a completely different question from the clustering above, asked at
   a different time. `CLUSTER_PX` groups ROUTES once, at build, at one camera,
   and hands the group a place name — so it needs a ground cap to stay honest.
   Merging asks only "would these two cards be the same mark on the screen the
   reader is looking at right now", it re-asks it every frame, and the card it
   produces names its members outright rather than inventing a name for them.
   There is nothing for a distance cap to protect: a card reading "Bangkok &
   Cape Krathing" cannot mislead anyone about where either of them is.

   Which is also why this, and not the clustering, is what puts a trip and a
   trail on one card. The two could never group: they are different kinds of
   thing, built at different times, and `CLUSTER_MAX` would refuse Chengdu and
   the Changping valley anyway — 120 km apart, past that cap by design. */

/**
 * How wide a merged card may be before it stops naming its members, as a
 * fraction of the frame — with a floor, because a fraction of a 342px phone
 * frame is narrower than some single cards already are.
 *
 * There is a budget at all because merging trades width for names, and the
 * width is spent on the neighbours: a merged card is centred on the same anchor
 * its winner was, so every pixel it gains reaches half as far again on each
 * side, and what is under there is another card. 0.24 was picked against the
 * real collection at the home view, where it is the widest a card can be
 * without the ones beside it starting to go.
 */
/**
 * The zoom from which two colliding cards are STACKED rather than merged
 * (16 Sep 2026, author's request: two routes that start at the same trailhead
 * were reaching the terrain view as one card reading
 * "Muluozi – Lamasi & Muluozi – Wuguishi", and *"when zoom until a certain view
 * move the tab to let them dont conflict"*).
 *
 * A ZOOM GATE, and it has to be one — a screen-distance rule cannot express
 * this, which is worth writing down because that was the first thing tried.
 * Merging and stacking want opposite answers at the two ends of the map, and
 * not in the order a distance threshold can produce:
 *
 *     Bangkok and Phuket, home view z2.3    50 px apart   merge (author's ask,
 *                                                         10 Sep)
 *     the two Muluozi starts, drilled z12   23 px apart   stack (author's ask,
 *                                                         16 Sep)
 *
 * The pair that must merge is FURTHER apart on screen than the pair that must
 * stack, so any single px threshold gets one of them wrong. What actually
 * separates the two cases is scale: at collection scale a card stands for a
 * place and two of them an hour apart are one story, while at a single ridge
 * two trailheads 370 m apart are two walks and the reader is there to tell
 * them apart. z10 is about where the frame stops holding a country and starts
 * holding one mountain region.
 */
const NUDGE_MIN_ZOOM = 10;

/**
 * And how far apart the two ANCHORS must be before stacking is honest.
 *
 * Above the zoom gate this is the other half of the question: a stacked card
 * still points at its own place by sitting over it, so if the two places are
 * the same dot on screen, two cards pointing at it say less than one card
 * naming both.
 *
 * NINE PIXELS IS THE START DOT'S OWN DIAMETER — `trail-start` is radius 4.5 at
 * z12 — so the rule is exactly "the two dots do not overlap". Below it there is
 * one mark on the map and two cards would both be pointing at it; at or above
 * it the reader can see two, which is the thing a stacked card needs in order
 * to mean anything.
 *
 * MEASURED, NOT COMPUTED, and the difference bit: on the flat map the two
 * Muluozi starts are 370 m apart, which is 23 px at z12, and the first version
 * of this constant was set to 16 on that arithmetic. In the frame they are
 * **14 px** apart, because the view is pitched 62 degrees and those two
 * anchors are in its far half, where everything is foreshortened. The gate was
 * therefore shut in exactly the view it was written for. Any threshold here has
 * to be checked against `map.project`, not against metres.
 */
const NUDGE_MIN_APART = 9;

/**
 * Where a stacked card may go, in multiples of its own box height, tried in
 * order. Up first: cards hang above their anchor here, so up is the direction
 * the eye already associates with the mark, and in a pitched frame the space
 * above a point is the far distance, which is the emptier half.
 *
 * Vertical only, deliberately. These cards are wide and short, so a sideways
 * step is most of a card width — 150 px and up — which puts the name a long way
 * from the thing it names, while a step of one box height is under 40 px and
 * leaves the card still centred on its own anchor. Two cards 23 px apart
 * horizontally and a box height apart vertically each visibly sit over their
 * own dot, which is the whole point of stacking rather than merging.
 */
const NUDGE_STEPS = [-1, 1, -2, 2];

const MERGE_WIDTH = 0.24;
const MERGE_MIN_WIDTH = 150;

/**
 * How far in a merged card zooms when it is clicked, at most.
 *
 * A merged card says "several things are here"; clicking it is the request to
 * separate them, so it fits their combined extent — and that extent can be
 * tiny. Two trailheads 200 m apart would ask for zoom 18, a street corner on a
 * map whose deepest elevation data is z12. Stopping short leaves the reader
 * somewhere they can recognise, and if two cards still overlap there, the
 * picker below the frame reaches every route regardless.
 */
const MERGE_MAX_ZOOM = 12;

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
 * server in the style at all — just local GeoJSON sources painted in the page's
 * own colours. A MapLibre map only looks like an embedded widget if you hand it
 * a style that looks like one. Everything the optional layers add is bolted on
 * to this, and the DEM the Relief chip reaches for is the only part of the map
 * that ever leaves the site.
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
      /* `lineMetrics` is what makes `line-gradient` legal on the track layer —
         MapLibre only computes the along-line progress a gradient is keyed on
         when the source asks for it. It costs a little tile-time per route and
         nothing on the wire. See `colourTrack`. */
      track: { type: 'geojson', data: EMPTY, lineMetrics: true },
      /* The two ends of that track, as their own source rather than as extra
         features on `track`. A circle layer over a LineString draws a circle at
         every vertex, so there is no way to mark just the ends off one source. */
      'track-ends': { type: 'geojson', data: EMPTY },
      /* And a single point somewhere along it, driven by the detail card's
         charts. Its own source for the same reason the ends have one. */
      probe: { type: 'geojson', data: EMPTY },
      /* Every recorded route at once, and a dot on each start — what terrain
         mode opens on. Kept separate from `track` rather than folded into it:
         the two are never on screen together, they are drawn at different
         weights, and one source holding "all of them" and "the one you picked"
         by turns would have to be rewritten on every pick. These are written
         once, when the overview is first built. */
      trails: { type: 'geojson', data: EMPTY },
      'trail-starts': { type: 'geojson', data: EMPTY },
      /* The atlas sources are declared here EMPTY rather than added on first
         use, and unlike `dem` below that costs nothing: a geojson source with
         inline data makes no network request, so an empty one is free. What it
         buys is that the layer ORDER is fixed at build time — boundaries under
         the coastline, city dots over the visited footprints, the hillshade
         under all of them. A layer added later has to be positioned by naming a
         neighbour, and `addLayer(x, 'coast')` quietly means something different
         the moment another layer moves in between. The DATA is still fetched
         only when its own chip is switched on; see `loadAtlas` and `ensureData`. */
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
      /* The overview's two layers. A 14 km walk is a couple of pixels long when
         the whole collection is in frame, so the line alone would be a fleck of
         accent nobody could find — the dot on its start is what says a route is
         here, and it is the same mark the focused view uses for the same thing.
         The line takes over as the reader zooms in, which is why the dot barely
         grows and the line does. */
      {
        id: 'trails-line',
        type: 'line',
        source: 'trails',
        layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': p.visited,
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.4, 10, 2.4, 14, 3.2],
        },
      },
      {
        id: 'trail-start',
        type: 'circle',
        source: 'trail-starts',
        layout: { visibility: 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 3.2, 12, 4.5],
          'circle-color': p.visited,
          // The ground, so the dot keeps its edge over land, sea and shaded
          // relief alike — same reasoning as the city dot above.
          'circle-stroke-color': p.ground,
          'circle-stroke-width': 1.2,
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
      /* Where the walk started and where it stopped — a filled dot and a ring.
         Without these a point-to-point route and a loop are the same picture,
         and three of the routes here are one half of an out-and-back that only
         makes sense once you can see which end is which. Filled at the start
         because that is the one you read first.

         For a genuine loop the two land on top of each other, and `drawTrack`
         pushes the end first so the start wins that overlap. Two circles in
         exactly the same place is itself the right answer for a loop. */
      {
        id: 'track-end',
        type: 'circle',
        source: 'track-ends',
        paint: {
          'circle-radius': 5,
          'circle-color': ['case', ['==', ['get', 'role'], 'start'], p.visited, p.ground],
          'circle-stroke-color': ['case', ['==', ['get', 'role'], 'start'], p.ground, p.visited],
          'circle-stroke-width': 2,
        },
      },
      /* The probe: where on the ground the reader's cursor is on the chart.
         The page's text colour inside a ground-coloured ring, so it is neither
         the accent start dot nor the ground-filled end ring — a third mark
         that reads as "here", and the strongest thing on the line because it
         is the one the reader is moving. Drawn last so it sits over both
         ends. */
      {
        id: 'track-probe',
        type: 'circle',
        source: 'probe',
        paint: {
          'circle-radius': 6,
          'circle-color': p.ink,
          'circle-stroke-color': p.ground,
          'circle-stroke-width': 2.5,
        },
      },
    ],
  };
}

/** Which of the two shading settings a mode uses. `globe` was `atlas` until
    that mode was removed; the setting outlived it, because the whole-hemisphere
    hillshade is still what the Relief chip switches on. */
type ShadeKind = 'globe' | 'terrain';

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
 * conventional 45° sun. The globe is a whole hemisphere at roughly 20 km per
 * pixel — the same resolution as the three.js relief look — where the same
 * settings produce a globe with a suggestion of mountains on it. Same layer,
 * same source, two genuinely different jobs.
 *
 * The globe row was settled by shipping a ladder of five strengths and letting
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
  globe: {
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
/* track geometry                                                              */
/* -------------------------------------------------------------------------- */

/* The GPX parser lived here until 7 Sep 2026, along with a haversine and the
   3 m ascent threshold that kept GPS altitude noise from turning a flat walk
   into a thousand metres of climbing. All three went with the drop target: the
   built-in routes carry their figures in the manifest, measured off the FULL
   recording at build time by scripts/build-trails.mjs, so nothing in the
   browser has to compute a distance any more. */

function boundsOf(coords: number[][]): LngLatBounds {
  const b = new LngLatBounds(
    coords[0] as [number, number],
    coords[0] as [number, number],
  );
  for (const c of coords) b.extend(c as [number, number]);
  return b;
}

/**
 * Web Mercator, normalised to the unit square — the space MapLibre's zoom is
 * defined in. One unit is the whole world, so the pixel distance between two
 * points at zoom z is `separation × 512 × 2 ** z` and nothing else.
 *
 * Doing this arithmetic here rather than through `map.project` is what lets the
 * overview be grouped before the camera has ever been near it: projecting needs
 * a camera, and the camera is chosen from the groups.
 */
function mercator([lon, lat]: [number, number]): [number, number] {
  const s = Math.sin((lat * Math.PI) / 180);
  return [(lon + 180) / 360, 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)];
}

/** MapLibre draws 512px tiles, so this is the world's width in pixels. */
const worldPx = (zoom: number): number => 512 * 2 ** zoom;

const separation = (a: [number, number], b: [number, number]): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);

/**
 * Group points that are within `threshold` of each other, single-linkage.
 *
 * Single-linkage — a chain of near neighbours is one group — rather than
 * "everything within one radius of a centre", because the shape being grouped
 * here is a scatter of routes across a region rather than a ring around a
 * town. Six routes strung 20 km apart across 76 km of Johor are one place to
 * anyone reading the map, and a radius rule splits them at whichever end it
 * happens to start from.
 *
 * Returns indices into `at`, in input order within each group.
 */
function cluster(at: [number, number][], threshold: number): number[][] {
  const parent = at.map((_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root]!;
    while (parent[i] !== root) [i, parent[i]] = [parent[i]!, root];
    return root;
  };

  for (let i = 0; i < at.length; i++) {
    for (let j = i + 1; j < at.length; j++) {
      if (separation(at[i]!, at[j]!) <= threshold) parent[find(i)] = find(j);
    }
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < at.length; i++) {
    const root = find(i);
    const group = groups.get(root);
    if (group) group.push(i);
    else groups.set(root, [i]);
  }
  return [...groups.values()];
}

/**
 * What to call a group of routes, taken from what its members say about
 * themselves rather than from a table.
 *
 * `place` is "Johor, Malaysia" or "Changping Valley, Chuanxi, China", so the
 * first segment is the area. Most common wins, and a tie goes to the shorter —
 * which is what puts five routes in "Johor" and one in "Johor Bahru" under
 * "Johor" rather than the other way round. A table of area names would be a
 * second source of truth that a new route could silently fall outside of.
 */
function areaName(places: string[]): string {
  const counts = new Map<string, number>();
  for (const place of places) {
    const head = place.split(',')[0]!.trim();
    counts.set(head, (counts.get(head) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0]![0];
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

/**
 * The visited footprints. Drawn in every globe mode and in neither half of
 * terrain — not optional, they are what the page is about, but they are about
 * the TRIPS and terrain mode is about the routes. Two accent marks answering
 * two different questions on one map is one too many.
 */
const TRIP_LAYERS = ['region-fill', 'region-line'] as const;

/**
 * The coastline, which is the base map anywhere the reader can see a coast.
 * On its own rather than with the footprints above, because the trails
 * overview wants it and the focused view does not: at 20 m per pixel the
 * relief carries the ground, and a stroked coastline over it reads as a line
 * drawn on a photograph.
 */
const COAST_LAYERS = ['coast'] as const;

/** Every route at once, and a dot on each start. The trails overview. */
const OVERVIEW_LAYERS = ['trails-line', 'trail-start'] as const;

/** The one recorded route and its two ends. Only a focused terrain view. */
const TRACK_LAYERS = ['track-casing', 'track', 'track-end', 'track-probe'] as const;

/** Which label kind belongs to which filter. Trips answer to no filter. */
/* `water` is deliberately absent: rivers and lakes are geometry only. They were
   named for one round (3 Sep 2026) and the names came back off at the author's
   request — see the note on `loadWater`. A layer with no labels simply never
   appears here, and `retier` reads this map to decide which filter a label
   answers to. */
const LABEL_LAYER: Record<AtlasKind, MapLayer> = {
  country: 'countries',
  city: 'cities',
  peak: 'peaks',
};

/** The three ranks the atlas layers draw, and the only ones a filter reaches. */
type AtlasKind = 'country' | 'city' | 'peak';

/**
 * Everything that can carry a name on this map.
 *
 * `trip` is a visited city on the globe; `trail` is one recorded route and
 * `cluster` a group of them, both on the trails overview. The three atlas ranks
 * are the only ones a filter chip switches, which is what `LABEL_LAYER` above
 * is a total function over — a kind missing from it is a kind no filter owns,
 * and that is checked rather than assumed. See `isAtlasKind`.
 */
type LabelKind = 'trip' | 'trail' | 'cluster' | AtlasKind;

const isAtlasKind = (kind: LabelKind): kind is AtlasKind => kind in LABEL_LAYER;

/* `explore` is now the only mode with optional layers at all, so there is one
   set here rather than two. ATLAS_SET — the frozen countries + cities + relief
   that defined the `atlas` mode — went with that mode on 7 Sep 2026. */
const NO_LAYERS: ReadonlySet<MapLayer> = new Set();

/**
 * Everything the engine needs from the page.
 *
 * An options object rather than a parameter list, since 9 Sep 2026. It was
 * seven positional arguments by then, three of them arrays of very similar
 * things and two nullable, and `createMapGlobe(stage, labels, trips, mode,
 * layers, trails, trail)` is a line nobody can check by reading. Every one of
 * these is required: a default here would be a second place that decides what
 * the map opens as, and index.ts is the only place that should.
 */
export interface MapGlobeOptions {
  host: HTMLElement;
  labelLayer: HTMLElement;
  trips: MapTrip[];
  /** Every recorded route, exactly as src/data/trails.json carries them. The
      overview draws all of these; the picker below the map lists the same. */
  trails: MapTrail[];
  mode: MapMode;
  layers: MapLayer[];
  /** Which of the trips and the trails the `combined` mode draws. */
  content: MapContent[];
  /** The angle `combined` opens at. Every other mode has its own and ignores it. */
  view: MapView;
  /** The route to open terrain mode ON, if the reader left inside one. Null is
      the ordinary case and means the overview of all of them. */
  trail: MapTrail | null;
  /**
   * Which recorded routes were walked on each trip, keyed by trip id.
   *
   * Derived at build time from date containment — see `walkedOn` in
   * src/lib/content.ts — and handed over rather than worked out here, because
   * the trips arrive without their dates and the derivation is a fact about
   * the content collection rather than about the map.
   *
   * The engine reads it for exactly one thing: what a trip's terrain view has
   * to frame. Chengdu's three walks are 100 km from the city footprint, so
   * fitting the footprint alone would put the reader on a plain with the
   * mountains they came for off the edge of the frame.
   */
  walkedOn: Record<string, string[]>;
  /**
   * Told which route is on the map as a single track, or null when none is —
   * the overview, a trip, or any flat globe view, where the track layers are
   * hidden. The page uses it to show and fill the detail card (16 Sep 2026).
   *
   * A callback rather than a getter, because the engine decides this in more
   * places than the page can see: `openTerrainView` picks a route of its own
   * when the reader arrives with none, `showPlace` clears it, and leaving for
   * a flat view hides it without forgetting it. It fires from `applyLayers`,
   * which every one of those paths already ends in, and only when the answer
   * has changed.
   */
  onSubject?: (trail: MapTrail | null) => void;
}

export async function createMapGlobe({
  host,
  labelLayer,
  trips,
  trails,
  mode,
  layers,
  content: openContent,
  view: openView,
  trail,
  walkedOn,
  onSubject,
}: MapGlobeOptions): Promise<MapGlobe> {
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
    ...GLOBE_HOME,
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

  /** Which of the trips and the trails `combined` draws. Every other mode has
      its own answer to that and ignores this. */
  let content: ReadonlySet<MapContent> = new Set(openContent);

  /** The angle `combined` looks from. Every other mode has its own and ignores
      it — `explore` is always flat, `terrain` is always pitched. */
  let view: MapView = openView;

  /**
   * Whether the `All` tab's Terrain view is up — ONE predicate, and THE ONE
   * PLACE THE VIEW ID IS TESTED BY NAME.
   *
   * There were four of these while there were four views: `meshView`,
   * `tiltView`, `surveyView` and `leaning`, because the interesting question
   * was never which position the pill was in but which capability was in play —
   * is the camera leaning, is the mesh attached, is this the scale that draws
   * the other routes. With one terrain view left those are all the same
   * question, and asking it once is the point: `view === 'survey'` spelled at
   * each of the dozen sites that branch on it is how one of them ends up
   * disagreeing with the rest, which is exactly what the cut version was
   * written to prevent.
   */
  function terrainView(): boolean {
    return current === 'combined' && view === TERRAIN_VIEW;
  }

  /**
   * The angle a globe mode's camera sits at.
   *
   * Flat is the default and the only option `explore` has. Terrain takes
   * terrain MODE's own angle, because it is looking at the same kind of thing —
   * one route on real ground — and a second set of numbers for that would be
   * two tilts for one idea.
   */
  function viewAngle(): { pitch: number; bearing: number } {
    return terrainView() ? { ...TRAILS_VIEW } : { pitch: 0, bearing: 0 };
  }

  /**
   * A box grown about its own centre, for the Terrain view and for the widened Trails
   * fit.
   *
   * Latitude is clamped to the Web Mercator limit rather than to +/-90: a fit
   * that asks for a pole in mercator has nowhere to put it. None of these
   * routes is near one, so the clamp never fires — it is here so that a route
   * added at a high latitude degrades to a wide view instead of a broken fit.
   */
  function grow(box: LngLatBounds, factor: number): LngLatBounds {
    const west = box.getWest();
    const east = box.getEast();
    const south = box.getSouth();
    const north = box.getNorth();
    const lng = ((east - west) * (factor - 1)) / 2;
    const lat = ((north - south) * (factor - 1)) / 2;
    return new LngLatBounds(
      [west - lng, Math.max(-85, south - lat)],
      [east + lng, Math.min(85, north + lat)],
    );
  }

  /** The optional layers the CURRENT mode actually draws — the five filter
      chips, shared by the two globe modes.
      Terrain has none: at one ridge, boundaries and country names name nothing
      the reader can see, and its own hillshade is not the `relief` layer. */
  function activeLayers(): ReadonlySet<MapLayer> {
    return current === 'terrain' ? NO_LAYERS : chosen;
  }

  /**
   * Whether the visited footprints and their cards are drawn, and whether the
   * routes and theirs are.
   *
   * Two functions rather than a flag each in `applyLayers`, because `retier`
   * has to answer exactly the same question about the labels that `applyLayers`
   * answers about the geometry. Split, they drift: a chip that draws a route
   * and no name, or a name over a route nobody drew.
   */
  function showsTrips(): boolean {
    return current === 'explore' || (current === 'combined' && content.has('trips'));
  }

  function showsTrails(): boolean {
    // In terrain mode the overview IS the routes, so no chip gates them; a
    // focused route draws its own track instead, which is not this.
    if (current === 'terrain') return !focused;
    return current === 'combined' && content.has('trails');
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

  /**
   * What a card contributes to a merged card, and nothing else on the map has
   * one — the atlas ranks are names of places rather than things the page is
   * about, and "China & Chengdu" is not a label anybody wants.
   *
   * `extent` is what a merged card fits when it is clicked. A trip's is the
   * degenerate box at its own point, which is correct: the union of two of them
   * is a real box, and the union of a point and an area is the area plus that
   * point. Nothing here has to special-case a card that stands for one place.
   */
  interface StackPart {
    /** The name this card is listed under inside a merged one. */
    name: string;
    /** What it stands for, for the merged card's count line. An area card
        stands for all of its routes, so these are not always 1. */
    trips: number;
    routes: number;
    extent: LngLatBounds;
  }

  interface Label {
    marker: Marker;
    el: HTMLElement;
    /** [lon, lat]. */
    at: [number, number];
    kind: LabelKind;
    /** The source's own min zoom for this name. See scripts/build-atlas.mjs. */
    minZoom: number;
    /** And the zoom it stops at, which only a cluster label has — it is
        replaced by its own members at exactly this zoom, so the two share one
        number and there is no gap or overlap between them. Infinity for
        everything else. */
    maxZoom: number;
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
    /** Set on the cards, null on the atlas ranks. See `merge`. */
    stack: StackPart | null;
    /** The stack offset currently written to the element, so the write can be
        skipped when nothing moved. See `setNudge`. */
    ny: number;
  }

  interface LabelSpec {
    el: HTMLElement;
    at: [number, number];
    anchor: 'bottom' | 'center' | 'left';
    kind: LabelKind;
    minZoom: number;
    maxZoom?: number;
    priority: number;
    /** Pixels right of the anchor point. A city name has to clear the dot drawn
        under it; a peak's own ▲ glyph IS its mark, so it sits on the point. */
    dx?: number;
    stack?: StackPart;
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
      ny: 0,
      minZoom: spec.minZoom,
      maxZoom: spec.maxZoom ?? Infinity,
      priority: spec.priority,
      ax: spec.anchor === 'left' ? 0 : 0.5,
      ay: spec.anchor === 'bottom' ? 1 : 0.5,
      dx,
      w: 0,
      h: 0,
      on: false,
      stack: spec.stack ?? null,
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

  /**
   * The other kind of label: a two-line card, for the things the page is
   * actually about — a visited city on the globe, an area or a route on the
   * trails overview.
   *
   * A card rather than the halo the atlas ranks wear, and the count is the
   * reason: eight boxed cards is a map, sixty is a pin board. These are also
   * the only labels that are CONTROLS — a trip card opens its trip page, an
   * area card zooms into that area, a route card flies to that route — so they
   * have to read as pressable, and the atlas names have to read as not.
   */
  function fillCard(el: HTMLElement, name: string, sub: string): void {
    /* `classList.add`, NOT `className =`, and the difference is a bug that has
       already been paid for. A merged card is refilled in place whenever its
       membership changes, by which time MapLibre has added its own
       `maplibregl-marker` class to the element — which is what carries
       `position: absolute`. Assigning `className` wiped it, the card dropped
       into normal flow, and the merged cards stacked down the frame one card
       height apart from wherever the first one landed.

       The children are cleared for the same reason: refilling appends. */
    el.classList.add('mapglobe__label');
    el.replaceChildren();

    const nameEl = document.createElement('span');
    nameEl.className = 'mapglobe__label-name';
    nameEl.textContent = name;

    const subEl = document.createElement('span');
    subEl.className = 'mapglobe__label-when';
    subEl.textContent = sub;

    el.append(nameEl, subEl);
  }

  function cardLink(href: string, name: string, sub: string): HTMLElement {
    const el = document.createElement('a');
    el.href = href;
    fillCard(el, name, sub);
    return el;
  }

  /* `type="button"`, which is not decoration: these live inside the page and a
     bare <button> defaults to `submit`. */
  function cardButton(name: string, sub: string): HTMLButtonElement {
    const el = document.createElement('button');
    el.type = 'button';
    fillCard(el, name, sub);
    return el;
  }

  /* ---- the trips --------------------------------------------------------- */
  for (const trip of shown) {
    const [lat, lon] = visited[trip.id]!.at;
    addLabel({
      el: cardLink(trip.href, trip.label, trip.when),
      at: [lon, lat],
      anchor: 'bottom',
      kind: 'trip',
      minZoom: 0,
      priority: 0,
      stack: { name: trip.label, trips: 1, routes: 0, extent: new LngLatBounds([lon, lat], [lon, lat]) },
    });
  }

  // Markers are appended to the map container by MapLibre. Moving them into the
  // page's own label layer would fight its positioning, so instead the layer is
  // used only as the visibility switch the component styles.
  void labelLayer;

  /* ---- the optional data, fetched one layer at a time -------------------- */
  /* The same deferral the whole engine gets from its IntersectionObserver, one
     level down and per filter. Nothing is requested until a layer is switched
     on, and switching it off again never re-requests it.

     This is what carries the "no third-party byte" property now that the mode
     which guaranteed it by drawing nothing is gone: `explore` opens on two
     local files, and the reader chooses when that stops being true.

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
    const zoom = map.getZoom();

    /* The two cards the page is about, each asked for by the same function
       `applyLayers` asks about their geometry. A focused route answers no to
       both: the readout under the frame names it, and a card floating over one
       ridge would sit on the only thing in the frame worth looking at. */
    if (showsTrips()) {
      for (const label of labels) if (label.kind === 'trip') wanted.add(label);
    }

    /* An area card below its break zoom, that area's routes above it. The two
       share the number, so there is neither a gap where nothing is named nor a
       zoom where a group and its members are both on the map. */
    if (showsTrails()) {
      for (const label of labels) {
        if (label.kind !== 'trail' && label.kind !== 'cluster') continue;
        if (label.minZoom > zoom + 0.001) continue;
        if (zoom + 0.001 >= label.maxZoom) continue;
        wanted.add(label);
      }
    }

    /* And which of the route cards is the one the view is aimed at (16 Sep
       2026, the author's request). Marked in the SAME vocabulary a hover uses —
       accent border, accent name — because the two mean the same thing to the
       reader, "this card is the one", and a third treatment for a third state
       would be one more thing to learn about a map that has a dozen already.
       It also puts the map's own mark in step with the index rail, which has
       named the current route in the accent since the rail shipped.

       Here rather than in `addTrailLabel`, because a card outlives any one
       selection: the elements are built when the routes land and this has to
       move every time `focused` does. `retier` is where card presence is
       already decided and it runs at the end of `applyLayers`, so it is reached
       on every path that can change the subject. `toggle` with a second
       argument writes nothing when the answer has not changed. */
    for (const label of labels) {
      if (label.kind !== 'trail') continue;
      label.el.classList.toggle(
        'mapglobe__label--current',
        Boolean(focused) && label.el.dataset.mapglobeTrail === focused?.id,
      );
    }

    const active = activeLayers();

    if (active.size) {
      const bounds = zoom > BOUNDS_CULL_ZOOM ? map.getBounds() : null;

      const candidates = labels.filter((label) => {
        const kind = label.kind;
        if (!isAtlasKind(kind)) return false;
        if (!active.has(LABEL_LAYER[kind])) return false;
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
  /**
   * Boxes inside the frame that a label may not sit under.
   *
   * The control panel floats OVER the map, so a card that lands beneath it is
   * not merely hard to read — it is a button the reader cannot press, sitting
   * under another button they can. `declutter` already has the machinery for
   * "this rectangle is taken"; this hands it the ones that are taken by the
   * page rather than by another label. The attribution comes along for the same
   * reason, and it is a licence notice, so a label over it is worse than a
   * label lost.
   *
   * It is the attribution PILL that is reserved, `.maplibregl-ctrl-attrib`, and
   * not the `.maplibregl-ctrl-bottom-right` container it sits in. The container
   * carries MapLibre's own 10px margins, so reserving it claims 120×45 for a
   * notice that occupies about 110×20 — and at 390px that was enough to lose a
   * card whose corner came within eight pixels of empty margin.
   *
   * Measured per pass rather than cached: the panel changes size with the mode
   * and with the frame, and a stale rectangle would reserve empty space or fail
   * to reserve occupied space. Both reads happen before any style is written,
   * so this costs the one layout flush the pass already pays for.
   */
  /** A rectangle in frame coordinates. Every collision test in here works on
      one, whether it came from a label, a merged card or a control. */
  interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
  }

  function reserved(rect: DOMRect): Box[] {
    const frame = host.parentElement;
    if (!frame) return [];

    const boxes: Box[] = [];
    for (const el of frame.querySelectorAll<HTMLElement>(
      '[data-mapglobe-reserve], .maplibregl-ctrl-attrib',
    )) {
      const box = el.getBoundingClientRect();
      // A panel hidden for the current mode is `display: none` and measures
      // zero, which is exactly the test for "not on screen".
      if (!box.width || !box.height) continue;
      /* AND ONLY WHAT ACTUALLY OVERLAPS THE MAP (16 Sep 2026). This used to
         reserve everything inside the frame, which was the same thing while
         every control floated over the stage. The layout tabs carve a strip
         out of the frame and put controls in it, beside the map rather than
         on it — and a control that covers no part of the map must cost the
         camera nothing and can hide no card, because there is no card under
         it. Identical behaviour for the three original tabs, where every one
         of these boxes is over the stage. */
      if (
        box.right <= rect.left ||
        box.left >= rect.right ||
        box.bottom <= rect.top ||
        box.top >= rect.bottom
      ) {
        continue;
      }
      boxes.push({
        x: box.left - rect.left,
        y: box.top - rect.top,
        w: box.width,
        h: box.height,
      });
    }
    return boxes;
  }

  /* ---- merged cards ------------------------------------------------------- */
  /**
   * One merged card, pooled.
   *
   * When two of the page's own cards would land on top of each other, they are
   * drawn as a single card naming both — "Chengdu & Changping Valley" — rather
   * than one of them winning the space and the other disappearing. That is the
   * difference between a map that says "there are two things here, zoom in" and
   * one that quietly says there is one.
   *
   * It applies to every pair the reader might care about, because every card
   * carries a `stack` part: two trips, two route groups, or — the case this was
   * built for — a trip and a walk taken on it. The atlas ranks are deliberately
   * left out. They are names of places rather than things the page is about,
   * they arrive by the hundred, and "China & Chengdu" is not a label anyone
   * wants; those still lose their space the old way.
   *
   * POOLED, AND REBUILT ONLY WHEN ITS MEMBERSHIP CHANGES. `declutter` runs on
   * every `render`, so rebuilding a card's DOM per frame would put a forced
   * layout in the middle of every frame the map draws. The `key` is the whole
   * identity of the card — its members, winner first — so panning a merged card
   * around the frame writes nothing at all, and only gaining, losing or
   * reordering a member costs a measurement.
   */
  interface Stack {
    marker: Marker;
    el: HTMLButtonElement;
    /** Member names, winner first. Empty while the slot is unused. */
    key: string;
    /** What clicking it fits: the union of its members' own extents. */
    extent: LngLatBounds | null;
    w: number;
    h: number;
    on: boolean;
  }

  const stacks: Stack[] = [];

  function stackSlot(index: number): Stack {
    const existing = stacks[index];
    if (existing) return existing;

    const el = cardButton('', '');
    const slot: Stack = {
      marker: new Marker({ element: el, anchor: 'bottom', opacityWhenCovered: '0' }).setLngLat([
        0, 0,
      ]),
      el,
      key: '',
      extent: null,
      w: 0,
      h: 0,
      on: false,
    };

    /* One listener for the life of the slot, reading whatever the slot happens
       to hold — the content turns over far faster than the pool does.

       Clicking fits the members' combined extent, which is the same thing an
       area card does and for the same reason: a merged card is the map saying
       "several things are here", so the one useful response to it is to
       separate them. Capped, because that extent can be 200 m across. */
    el.addEventListener('click', () => {
      if (!slot.extent) return;
      map.fitBounds(slot.extent, {
        padding: framePadding(),
        ...fitAngle(),
        maxZoom: MERGE_MAX_ZOOM,
        duration: 1400,
        essential: true,
      });
    });

    stacks.push(slot);
    return slot;
  }

  /** Drop every slot past the ones this pass used. */
  function useStacks(count: number): void {
    for (let i = count; i < stacks.length; i++) {
      const slot = stacks[i]!;
      if (!slot.on) continue;
      slot.marker.remove();
      slot.on = false;
      slot.key = '';
    }
  }

  /**
   * What a merged card is called, when it can afford to name everything.
   *
   * "&" joins two names into a pair, which is what the common case is and what
   * it should read as. Four of them in a row join nothing: two of these trips
   * are already pairs — "Guangzhou & Shenzhen", "Taichung & Taipei" — and being
   * the widest cards on the map makes them among the likeliest to merge. So an
   * "&" already inside a name, or a third member, falls the join back to the
   * separator the rest of the page uses.
   */
  function joinNames(names: string[]): string {
    const pair = names.length === 2 && !names.some((name) => name.includes('&'));
    return names.join(pair ? ' & ' : ' · ');
  }

  /** And what it stands for. A merged card of route groups alone reads exactly
      as the area card it replaced — "9 routes" — which is deliberate. */
  function stackSub(trips: number, routes: number): string {
    const parts: string[] = [];
    if (trips) parts.push(`${trips} trip${trips === 1 ? '' : 's'}`);
    if (routes) parts.push(`${routes} route${routes === 1 ? '' : 's'}`);
    return parts.join(' · ');
  }

  /** One label as this pass sees it: where it landed, and the box it wants. */
  interface Spot {
    label: Label;
    x: number;
    y: number;
    d: number;
    box: Box;
    /** How far the card was stacked off its anchor to clear a neighbour, in
        pixels. Zero for everything that won its space outright, which is all
        of the atlas ranks — only cards are ever stacked. */
    dy: number;
  }

  /** One thing competing for space: a label, or a merged card standing for
      several of them. */
  interface Unit {
    el: HTMLElement;
    box: Box;
    priority: number;
    d: number;
    members: Spot[];
  }

  const overlaps = (a: Box, b: Box): boolean =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  /**
   * Try to lift a card clear of the one that owns its space, so that both keep
   * their own name instead of becoming one merged card.
   *
   * Mutates the spot's box on success, because everything downstream — the
   * final placement pass, and the merged card's fallback to its members — reads
   * that box and must see where the card actually is.
   *
   * The step is the box's own height, so two stacked boxes touch and never
   * overlap; and each candidate is tested against everything already placed,
   * controls included, so a stacked card can no more land under the panel than
   * an unstacked one can.
   */
  function stack(spot: Spot, winner: Spot, placed: { box: Box }[]): boolean {
    if (Math.hypot(spot.x - winner.x, spot.y - winner.y) < NUDGE_MIN_APART) return false;

    for (const step of NUDGE_STEPS) {
      const dy = step * spot.box.h;
      const box = { ...spot.box, y: spot.box.y + dy };
      if (placed.some((other) => overlaps(box, other.box))) continue;
      spot.box = box;
      spot.dy = dy;
      return true;
    }
    return false;
  }

  /**
   * Apply a stack offset to the card itself.
   *
   * `translate` and NOT `transform`: MapLibre owns the marker's `transform` and
   * rewrites it on every frame the camera moves, so anything written there is
   * gone by the next render. `translate` is its own property, composes with the
   * transform rather than replacing it, and is left alone by MapLibre. The
   * alternative — `marker.setOffset()` — is the library's own answer and is
   * avoided here for a narrower reason: this runs inside a `render` handler,
   * and that call reaches back into the map.
   *
   * Written only on change. declutter runs on every frame the map draws, and a
   * style write per card per frame is a layout invalidation per card per frame.
   */
  function setNudge(label: Label, dy: number): void {
    if (label.ny === dy) return;
    label.ny = dy;
    label.el.style.translate = dy ? `0 ${dy}px` : '';
  }

  function declutter(): void {
    // A focused route carries no labels; the overview carries as many as the
    // trips do, and needs the same collision pass over them.
    if (current === 'terrain' && focused) {
      useStacks(0);
      return;
    }

    const rect = host.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const spots: Spot[] = [];

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

      spots.push({
        label,
        x: point.x,
        y: point.y,
        d: (point.x - cx) ** 2 + (point.y - cy) ** 2,
        dy: 0,
        // Reconstructed from the marker's anchor rather than measured, so this
        // stays one arithmetic pass with no second forced layout.
        box: {
          x: point.x + label.dx - label.w * label.ax - LABEL_PAD,
          y: point.y - label.h * label.ay - LABEL_PAD,
          w: label.w + LABEL_PAD * 2,
          h: label.h + LABEL_PAD * 2,
        },
      });
    }

    const single = (spot: Spot): Unit => ({
      el: spot.label.el,
      box: spot.box,
      priority: spot.label.priority,
      d: spot.d,
      members: [spot],
    });

    /* The cards merge; everything else goes through as itself. */
    const cards = spots.filter((spot) => spot.label.stack);
    const units: Unit[] = spots.filter((spot) => !spot.label.stack).map(single);

    // The controls go in FIRST, so nothing can win a slot against them however
    // high its priority — a label under the panel is unreachable, and the panel
    // is not going to move out of its way.
    const controls = reserved(rect);

    /* Which card absorbs which, decided by exactly the pass that used to decide
       which card disappeared: best priority, then nearest the middle of the
       frame, and a card that clashes with one already placed is spoken for by
       it. The only change is what "spoken for" does — it used to mean hidden.
       Running it here rather than inferring it later is what keeps the two in
       step, and it is why there is no threshold constant.

       ABSORBED AGAINST THE WINNER'S OWN BOX, never against the group's. Single
       linkage was tried first, on the reasoning that three cards in a row
       should be one card rather than two overlapping ones, and it chained: at
       the home view five of the eight trip cards and a route group are one
       unbroken run of near-touching boxes across Asia, and the map collapsed to
       four cards, two of which read "& 4 more". A card can absorb what IT
       covers and no further — which is a rule the reader can see working, since
       it is the card that was going to win the space anyway.

       A card that clashes with a control rather than with another card is
       hidden outright: it is under the panel, and there is nothing there for it
       to be named on. */
    cards.sort((a, b) => a.label.priority - b.label.priority || a.d - b.d);

    const winners: { box: Box; members: Spot[] | null }[] = controls.map((box) => ({
      box,
      members: null,
    }));

    /* Stacking is tried BEFORE merging, and only where both gates open — see
       NUDGE_MIN_ZOOM, which explains why one of them is a zoom. A card that can
       be lifted clear of its neighbour keeps its own name and its own place;
       one that cannot is absorbed exactly as before. */
    const stacking = map.getZoom() >= NUDGE_MIN_ZOOM;

    for (const spot of cards) {
      const hit = winners.find((winner) => overlaps(spot.box, winner.box));
      if (!hit) {
        winners.push({ box: spot.box, members: [spot] });
        continue;
      }
      /* A control, not a card. There is nothing under the panel for a card to
         be named on, and lifting it out from under one would drop it on the
         map somewhere it does not belong. */
      if (!hit.members) {
        spot.label.el.style.visibility = 'hidden';
        continue;
      }
      if (stacking && stack(spot, hit.members[0]!, winners)) {
        winners.push({ box: spot.box, members: [spot] });
        continue;
      }
      hit.members.push(spot);
    }

    /* Every card carries its offset back to the DOM, including the zero that
       puts one back where it belongs — a card that was stacked last frame and
       won its own space this frame has to come down again. */
    for (const spot of cards) setNudge(spot.label, spot.dy);

    let used = 0;

    for (const winner_ of winners) {
      const members = winner_.members;
      if (!members) continue;
      if (members.length === 1) {
        units.push(single(members[0]!));
        continue;
      }

      // `cards` was sorted before the pass above, so the card that won the
      // space outright is the first member — the one the merged card is
      // anchored on and named after.
      const winner = members[0]!;
      const parts = members.map((member) => member.label.stack!);
      const names = parts.map((part) => part.name);
      const key = names.join('|');

      const slot = stackSlot(used);
      used++;

      // Added before it is filled, because an element that is not in the
      // document measures 0, and what it is called is decided on a measurement.
      if (!slot.on) {
        slot.marker.addTo(map);
        slot.on = true;
      }

      if (slot.key !== key) {
        slot.key = key;

        const sub = stackSub(
          parts.reduce((total, part) => total + part.trips, 0),
          parts.reduce((total, part) => total + part.routes, 0),
        );

        /* Every member named — and then measured, to see whether that was
           affordable. A width budget rather than a cap on the number of names,
           because those are not the same question: "Bangkok · Phuket · Cape
           Krathing" is three names and fits, while "Guangzhou & Shenzhen ·
           Taichung & Taipei" is two names and four cities and does not.
           Measuring is what tells them apart, and it costs nothing extra: the
           card has to be measured for the collision pass regardless, and
           neither branch runs unless the membership actually changed. */
        fillCard(slot.el, joinNames(names), sub);
        slot.w = slot.el.offsetWidth;
        slot.h = slot.el.offsetHeight;

        const short = slot.w > Math.max(MERGE_MIN_WIDTH, host.clientWidth * MERGE_WIDTH);
        if (short) {
          fillCard(slot.el, `${names[0]} +${names.length - 1}`, sub);
          slot.w = slot.el.offsetWidth;
          slot.h = slot.el.offsetHeight;
        }

        // The full list, but only when the card could not print it. A tooltip
        // repeating the label it is attached to is noise.
        slot.el.title = short ? names.join(' · ') : '';

        const extent = new LngLatBounds();
        for (const part of parts) extent.extend(part.extent);
        slot.extent = extent;

        slot.marker.setLngLat(winner.label.at);
      }

      // The members are spoken for. Hidden here rather than below, where the
      // greedy pass only ever sees the merged card.
      for (const member of members) member.label.el.style.visibility = 'hidden';

      units.push({
        el: slot.el,
        box: {
          x: winner.x - slot.w / 2 - LABEL_PAD,
          y: winner.y - slot.h - LABEL_PAD,
          w: slot.w + LABEL_PAD * 2,
          h: slot.h + LABEL_PAD * 2,
        },
        priority: winner.label.priority,
        d: winner.d,
        members,
      });
    }

    useStacks(used);

    units.sort((a, b) => a.priority - b.priority || a.d - b.d);

    /* And now place them for real. A merged card is wider than the card it grew
       out of, so this is not a formality: it can reach a neighbour its winner
       did not, and the atlas ranks have not been placed at all yet. */
    const kept = [...controls];

    for (const unit of units) {
      if (!kept.some((box) => overlaps(unit.box, box))) {
        unit.el.style.visibility = '';
        kept.push(unit.box);
        continue;
      }

      unit.el.style.visibility = 'hidden';

      /* A merged card that cannot be placed falls back to its members, one at a
         time, so merging can never cost the map a name that not merging would
         have kept. They overlap each other by definition, so this normally
         keeps exactly one of them — which is what this pass did before merged
         cards existed. */
      if (unit.members.length < 2) continue;
      for (const member of unit.members) {
        const clash = kept.some((box) => overlaps(member.box, box));
        member.label.el.style.visibility = clash ? 'hidden' : '';
        if (!clash) kept.push(member.box);
      }
    }
  }

  // `render` rather than `move`: the globe keeps drawing after a fly settles,
  // and a label must not be left behind by one frame. It bails early on a
  // focused route, which is the one view with no labels at all.
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
  /* One map object in two configurations, and five filters over one of them,
     which is the entire claim being tested here. Switching is a camera
     animation and a handful of layer toggles — not a second renderer, a second
     canvas or a second download.

     There were four modes until 7 Sep 2026, and three of them were the same
     globe at the same scale. Switching between those deliberately did NOT move
     the camera; with `explore` the only globe left, that behaviour now lives
     entirely in the filter chips, which change what is drawn and never where
     the reader is looking. Only `terrain` is a journey, and only a return from
     it flies home. */

  /**
   * The elevation source `setTerrain` reads, brought in on first entry to
   * terrain mode.
   *
   * This is half of why `explore` touches no third-party server until asked: a
   * MapLibre source is fetched the moment it is added, so the only way not to
   * request Mapterhorn is not to have declared it yet.
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
    map.addLayer(hillshadeLayer(p, SHADE.globe), 'lakes');
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
   * Which of the ten routes is the subject, said in colour (16 Sep 2026, the
   * author's request: three of these walks are legs of one trek up the same
   * valley, and picking one of them changed nothing about how the three were
   * drawn).
   *
   * Every route was `p.visited` — the page's accent, the one colour here that is
   * not derived — whether it was the one you had asked for or one of the nine
   * you had not. The focused route did carry a casing and half a pixel more
   * width, which is a real difference and not one anybody reads as "this one":
   * in the Changping valley it left three near-identical accent lines and no
   * answer to which was selected.
   *
   * So the OTHERS step off the accent and the subject keeps it. That direction
   * matters — the focused track is already the heaviest mark on the map, and
   * making it heavier still would have cost the hillside it is drawn on. It is
   * also the direction the author asked for.
   *
   * `p.coast` is the strongest neutral step on the ramp, at 0.50, and the
   * strongest is the right one: an unselected route is not decoration, it is
   * how the reader reaches the other walks, and that is the whole reason
   * Terrain draws the other nine at all. The rank is carried by hue — derived
   * neutral against the one underived accent — rather than by a fade, which is
   * the same call the atlas label ladder makes and for the same reason. It is
   * reused rather than given a step of its own on the precedent of the city
   * dot, which takes the coastline's colour for want of a strong enough one of
   * its own.
   *
   * NOTHING SINGLES ITSELF OUT WITHOUT A SUBJECT. The trails overview and a
   * trip picked from the index rail both leave `focused` null, and there every
   * route is the accent again, equally — an overview that quietened nine of ten
   * routes would be claiming a selection that had not been made.
   */
  function paintTrails(): void {
    const others = focused ? p.coast : p.visited;
    map.setPaintProperty('trails-line', 'line-color', others);
    map.setPaintProperty('trail-start', 'circle-color', others);
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
    /* Terrain mode is two views, not one, and this is the line that says so:
       every route at once, or the one that was picked. */
    const overview = !globe && !focused;

    const trips = showsTrips();
    const routes = showsTrails();

    for (const id of COAST_LAYERS) {
      map.setLayoutProperty(id, 'visibility', globe || overview ? 'visible' : 'none');
    }
    for (const id of TRIP_LAYERS) {
      map.setLayoutProperty(id, 'visibility', trips ? 'visible' : 'none');
    }
    /* Every route at once, in every globe view including Terrain — which used
       to be the exception written out here, because Terrain 1 and Terrain 2
       hid the other nine as sub-pixel specks in other countries and Terrain 4
       did not. Only Terrain 4 survived (14 Sep 2026), so the condition is gone
       rather than inverted, and the reasoning that earned it is why: this view
       exists to be navigated. At its region scale a neighbouring walk is
       genuinely in frame — three of these routes are legs of one trek up the
       same valley — and the objection it was built for was that reaching
       another route meant zooming out. A line the reader can see beside the one
       they are on is the cheapest possible answer to that, and the routes off
       in other countries are off the edge of the frame, which costs nothing.
       The focused route still draws its own track over the top, so "this one"
       and "the others" stay two different marks. */
    const others = routes;
    for (const id of OVERVIEW_LAYERS) {
      map.setLayoutProperty(id, 'visibility', others ? 'visible' : 'none');
    }
    /* The routes have to BE there before they can be drawn, and in `combined`
       nothing else will have asked for them. Same shape as `ensureData` for the
       atlas layers: cached, so switching the chip off and on again fetches
       nothing, and `buildOverview` re-tiers when it lands. */
    if (routes) void ensureAllTrails();
    /* A single track belongs to a focused route and to nothing else. Left
       visible on the globe, a 14 km walk is a sub-pixel speck of accent
       somewhere in Johor — not wrong exactly, but a mark that answers no
       question the globe is being asked, and it competes with the footprints
       that do. On the overview it would be one route drawn twice. */
    /* AND in the `All` tab's Terrain view, which is the point of it: it frames
       exactly one route on real ground. `routes` gates it as well, so the
       Trails content chip still switches every route off — including this one,
       which then leaves a bare mountainside, and that is the right reading of
       "show me no routes". */
    const oneTrack = focused && ((!globe && !overview) || (terrainView() && routes));
    for (const id of TRACK_LAYERS) {
      map.setLayoutProperty(id, 'visibility', oneTrack ? 'visible' : 'none');
    }
    /* The detail card follows the track, not `focused`: a route the Terrain
       view remembers while the reader is back on the flat globe is not on the
       map, and a card describing it would be describing nothing on screen.
       Only a change is reported — this runs on every layer and content click
       too, and the page rebuilds a card when it hears this. */
    const subject = oneTrack ? focused : null;
    if (subject !== reported) {
      reported = subject;
      onSubject?.(subject);
    }
    /* Here rather than at each call site: every path that can change which
       route is the subject already ends up in this function — loadTrail,
       showPlace, showOverview, setView, setContent and setLayers alike. */
    paintTrails();

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

    /* A focused route shades the one ridge it flew to, hard. The overview
       shades the whole world at the gentle strength the Relief chip uses, and
       it does so unasked: this is the mode that fetches elevation, the reader
       came here for terrain, and the routes are the only marks on the map
       whose surroundings are the point. The globe shades nothing unless the
       chip says otherwise.

       AND THE `All` TAB'S TERRAIN VIEW SHADES UNASKED TOO (10 Sep 2026),
       for the same reason the overview does and one more: a tilt with no
       shading under it is a flat map at an awkward angle, so a control called
       Terrain that only moved the camera would not show any. Note what this
       does NOT do — it does not add `relief` to `chosen`. The reader's own
       filter set is left exactly as they left it and comes back when the view
       goes flat, which is the same two-axes split the site's theme keys use.
       The chip is marked on and disabled while this is up; see markLayers in
       index.ts, and the note there for why disabling beats leaving a control
       that cannot control. */
    if (current === 'terrain') setHillshade(focused ? 'terrain' : 'globe');
    /* The terrain view takes the harder setting terrain mode uses on a single
       ridge, because it is at a single ridge's scale and the gentle one
       disappears there. */
    else if (terrainView()) setHillshade('terrain');
    else setHillshade(active.has('relief') ? 'globe' : null);

    retier();
  }

  /**
   * Switch to mercator and attach the terrain once the camera has stopped,
   * never before. Both halves of that sentence are load-bearing.
   *
   * Terrain has to be OFF while the camera is down at globe zoom. Globe
   * projection plus an attached terrain is the combination MapLibre had to fix
   * once already (issue #4792), and flying from z2.3 to a ridge with terrain
   * already attached drags the camera through exactly that state for two
   * seconds. Attaching on arrival costs nothing — there is no terrain worth
   * seeing at z2 anyway.
   *
   * THE PROJECTION MOVED IN HERE (9 Sep 2026) and that is a real change, not
   * tidying. It used to be set at the top of the terrain branch, which was
   * invisible while terrain mode began with a two-second fly from a globe the
   * reader was barely looking at. The trails overview is a globe the reader IS
   * looking at — a wide view of south-east Asia — and swapping the projection
   * under it before the camera moves pops the whole map flat for the length of
   * the fly. Done here instead, it lands at z12 or deeper, where MapLibre's
   * globe has already handed over to mercator on its own and the swap is
   * invisible. The requirement was only ever "mercator before setTerrain".
   */
  function attachTerrainWhenSettled(): void {
    const attach = (): void => {
      /* A single route only — in terrain mode, or in the `All` tab's Terrain
         view, which is the same picture with the trips and the layer chips
         left on. Terrain mode's OVERVIEW stays on the globe, and so does a
         flat `All`. See the note below. */
      if (!(current === 'terrain' && focused) && !terrainView()) return;
      map.setProjection({ type: 'mercator' });
      /* The source, here rather than only in applyMode. Opening the page
         straight into terrain mode draws its route BEFORE the first applyMode
         runs — that is what puts the camera on the route instead of on the
         placeholder — so this is reached once with no `dem` declared yet, and
         setTerrain throws "there exists no source with ID: dem". Making the
         function that attaches terrain responsible for its own source is the
         fix that cannot come apart again if the order changes. */
      ensureTerrainSource();
      map.setTerrain(TERRAIN);
    };
    if (map.isMoving()) map.once('moveend', attach);
    else attach();
  }

  /**
   * Arrive in the `All` tab's Terrain view.
   *
   * It is the only camera on the page that REQUIRES a route: it exists to put
   * one walk on real ground, and there is nothing to frame without one. So
   * unlike terrain mode — where CLAUDE.md records that picking a default is
   * exactly what the overview exists not to do — a default here is forced, and
   * the order of preference is what makes it defensible: whatever the reader
   * was last looking at, and only then the first in the manifest.
   *
   * A manifest with no routes at all leaves the camera alone. Flying somewhere
   * empty says less than staying put, which is the same call `showOverview`
   * makes for the same reason.
   */
  async function openTerrainView(animate: boolean, target: MapTrail | null = null): Promise<void> {
    /* A route the reader named on their way in — a card or an index row clicked
       on the flat globe, which moves the switch to Terrain rather than
       leaving the tab (14 Sep 2026). That IS the reader choosing a walk, so it
       is the one arrival that drills; `drilled` is left to `loadTrail`, which
       sets it from its own third argument.

       Before the preferences below, not after: a route that was clicked outranks
       the trip, the focused route and the stored id alike, because it is the
       only one of the four the reader asked for in the same gesture. */
    if (target) {
      await loadTrail(target, animate, true).catch((error: unknown) => {
        console.error('mapglobe: the route a terrain view was aimed at could not be drawn', error);
      });
      return;
    }

    /* Terrain arrives at the region, always. Resuming it halfway drilled in
       would make the same control show two different pictures depending on
       where the reader had been, which is the property the view switch exists
       not to have. */
    drilled = false;

    /* A trip the reader picked from the index outlives a trip out to the globe
       and back, exactly as a route does. Checked first because when it is set
       there is no focused route to fall back on — `showPlace` cleared it. */
    if (place) {
      await showPlace(place.id, animate);
      return;
    }

    if (focused) {
      fitTrack(animate);
      return;
    }
    /* The route the page handed over — whatever the reader last looked at,
       under `mapglobe-trail`, which the Trails tab writes too — and only then
       the first in the manifest. One answer to "which route", wherever it was
       given. */
    const opening = trail ?? trails[0];
    if (!opening) return;
    /* `false` is the third argument, and it is what makes Terrain open at the
       region rather than on the walk. Arriving in a view is not the reader
       drilling into anything; only a click on a route is. */
    await loadTrail(opening, animate, false).catch((error: unknown) => {
      console.error('mapglobe: the opening route for a terrain view could not be drawn', error);
    });
  }

  function applyMode(next: MapMode, animate: boolean): void {
    const wasGlobe = current !== 'terrain';
    /* Read BEFORE `current` moves. Leaving `All` while its Terrain view is up
       means leaving a ridge at z11 in mercator with a terrain mesh attached,
       which is a journey home rather than a change of angle — and the test for
       it stops being true the moment `current` is reassigned. */
    const wasMesh = terrainView();
    current = next;

    if (next !== 'terrain') {
      /* The Terrain view is a globe MODE with a mercator camera, so it leaves
         before the three lines below get a chance to put the sphere back. */
      if (terrainView()) {
        applyLayers();
        ensureTerrainSource();
        void openTerrainView(animate);
        return;
      }

      // Detach BEFORE going back to the globe, for the reason above — the order
      // of these three lines is the whole point of them.
      map.setTerrain(null);
      applyLayers();
      map.setProjection({ type: 'globe' });

      // Same globe, same scale: leave the camera where the reader put it. Only
      // arriving back from terrain MODE — or from the Terrain view, which is
      // the same picture with the trips left on — is a journey home.
      if (!wasGlobe || wasMesh) {
        const home = { ...GLOBE_HOME, ...viewAngle() };
        if (animate) map.flyTo({ ...home, duration: 2200, essential: true });
        else map.jumpTo(home);
        return;
      }

      /* Globe to globe keeps its centre and its zoom, and the ANGLE is not
         either of those — it belongs to the tab being entered. `explore` is
         always flat and `combined` is whatever its view switch last said, so
         crossing between them has to tilt or level the camera even though the
         reader has not moved. Skipped when it already matches, so switching
         tabs at the same angle stays the no-op it has always been. */
      const angle = viewAngle();
      if (map.getPitch() !== angle.pitch || map.getBearing() !== angle.bearing) {
        if (animate) map.easeTo({ ...angle, duration: 900, essential: true });
        else map.jumpTo(angle);
      }
      return;
    }

    applyLayers();

    /* THE OVERVIEW, which is where terrain mode now begins (9 Sep 2026). Every
       route at once, each area named, and nothing picked — the reader chooses
       what to look at from the map rather than arriving inside one route with
       no idea what the other nine are.

       It is the same ANGLE as a single route, two scales out — pitched and
       turned by TRAILS_VIEW — and that is where the likeness stops. It stays on
       the globe, with no terrain, and the relief it shows is the hillshade.

       IT WAS MERCATOR WITH THE TERRAIN ATTACHED FOR ONE BUILD, and the reason
       it is not is worth keeping. The swap has to happen somewhere: at the
       start of the fly it flattens a globe the reader is looking at, and at the
       end — which is invisible at z13, where MapLibre's own globe has already
       handed over — it lands at z5 with the camera stationary, and the whole
       frame unwraps from a sphere into a full-bleed map in one frame. Measured
       at 1.69s and 2.05s into the fly: two completely different pictures.
       The terrain mesh was buying nothing there anyway. At 20 km per pixel a
       mountain is under half a pixel of relief; what shows a range at this
       scale is the shaded hillshade, which needs no mesh and no mercator. */
    if (!focused) {
      map.setTerrain(null);
      map.setProjection({ type: 'globe' });
      void showOverview(animate);
      return;
    }

    /* The source before the fly rather than on arrival, so the TileJSON round
       trip happens while the camera is travelling. `attachTerrainWhenSettled`
       asks for it again and owns it — see the note there. */
    ensureTerrainSource();

    /* A drawn track is where a focused view belongs, and TERRAIN_HOME is only
       what to look at when the route that was asked for is not there. Reading
       `trackBounds` here is also what lets a reader go out to the globe and
       come back to the route they were reading rather than to a ridge in
       Taiwan.

       TERRAIN_HOME is now reached exactly one way, and it is a failure rather
       than a choice: a route that would not load. It survived the Clear button
       because of that, and it survives the overview for the same reason — the
       "no route picked" case belongs to the branch above now, not to it. */
    if (trackBounds) {
      fitTrack(animate);
      return;
    }

    const camera = { ...TERRAIN_HOME, pitch: 66, bearing: -22 };
    if (animate) map.flyTo({ ...camera, duration: 2200, essential: true });
    else map.jumpTo(camera);

    attachTerrainWhenSettled();
  }

  /**
   * The angle a camera fit arrives at.
   *
   * Terrain mode's fits carry its pitch and bearing; a globe mode's carry
   * nothing, which leaves the camera's own — flying the globe to a pitched
   * camera would tilt the whole earth. The same group card is clickable in both
   * `terrain` and `combined`, which is why this is a function rather than a
   * constant spread at each call site.
   */
  function fitAngle(): { pitch?: number; bearing?: number } {
    if (current === 'terrain') return TRAILS_VIEW;
    return terrainView() ? viewAngle() : {};
  }

  function setLayers(next: MapLayer[]): void {
    chosen = new Set(next);
    // Both globe modes read the set — the chips are the same chips — so only
    // terrain ignores it, where the change is remembered and costs nothing
    // until the reader switches back.
    if (current !== 'terrain') applyLayers();
  }

  /**
   * Which of the trips and the trails `combined` draws.
   *
   * Stored whatever the mode, applied only in the one that reads it, exactly as
   * the layer filters are. A reader who switches Trips off, goes and looks at a
   * route and comes back should find it still off.
   */
  function setContent(next: MapContent[]): void {
    content = new Set(next);
    if (current === 'combined') applyLayers();
  }

  /**
   * The angle `combined` looks from (10 Sep 2026, author's request).
   *
   * `easeTo` with nothing but a pitch and a bearing, which is the whole point
   * of this control: the centre and the zoom are the reader's and are not
   * touched, so whatever they had spun to and framed is still framed when the
   * camera tilts. A `flyTo` would re-frame it; `jumpTo` would snap. 900ms is
   * short enough not to feel like a journey — this is not the two-second
   * departure a mode change is — and long enough that the horizon arriving
   * reads as the camera leaning rather than as a new picture.
   *
   * `applyLayers` first, so the shading is already on the land the camera is
   * tilting over rather than appearing a second after it settles.
   *
   * Stored whatever the mode, applied only in the one that reads it, exactly as
   * setLayers and setContent are. A reader who puts `All` on Terrain, goes to
   * look at a route and comes back finds it on Terrain; one who does it and
   * switches to `Trips` sees no change at all, because `explore` is always flat.
   *
   * THE `easeTo` AT THE FOOT IS NOW UNREACHABLE-BY-DESIGN, and it is kept
   * deliberately. With four views there were two flat ones, and moving between
   * them was an ease in place — the reader's centre and zoom preserved while
   * the camera leaned. With `tilted` gone every remaining transition is
   * globe↔Terrain, so `wasMesh` or `terrainView()` catches all of them and this
   * line is the flat→flat case of a pill that has one flat position. It costs
   * a line, it is the correct behaviour if a second flat view is ever added
   * back, and deleting it would leave `setView` silently doing nothing at all
   * in that case.
   */
  function setView(next: MapView, target: MapTrail | null = null): void {
    /* Read before `view` moves, for the same reason applyMode reads it before
       `current` does: leaving Terrain is a flight home, and after the
       assignment there is no way to tell which direction this was. With two
       positions left it is the only thing this variable is still for. */
    const wasMesh = terrainView();
    view = next;
    if (current !== 'combined') return;

    applyLayers();

    if (terrainView()) {
      ensureTerrainSource();
      void openTerrainView(true, target);
      return;
    }

    // Back to the sphere. Detach first — the order is the same requirement
    // applyMode documents, and for the same MapLibre reason.
    map.setTerrain(null);
    map.setProjection({ type: 'globe' });

    if (wasMesh) {
      /* From a ridge at z11 the world has to be flown back to. There is nothing
         to preserve: the centre and zoom the reader had on the globe were
         replaced by the route's when they entered the Terrain view. */
      map.flyTo({ ...GLOBE_HOME, ...viewAngle(), duration: 2000, essential: true });
      return;
    }

    /* Flat to flat — see the note above for why this is kept with one flat
       position left. The property it protects is that the centre and the zoom
       are the reader's, so whatever they had spun to is still framed. */
    map.easeTo({ ...viewAngle(), duration: 900, essential: true });
  }


  /* ---- the routes --------------------------------------------------------- */
  /**
   * Which route the reader is looking at, or null for the overview of all of
   * them. This one variable is the whole of terrain mode's shape: `applyMode`,
   * `applyLayers`, `retier` and `declutter` all branch on it, and nothing else
   * has to know which of the two views is up.
   */
  let focused: MapTrail | null = null;

  /** What `onSubject` was last told, so it is only told about changes. */
  let reported: MapTrail | null = null;

  /**
   * The Terrain view only: whether the reader has drilled from the region to
   * the one route inside it.
   *
   * A boolean rather than a second view id, because the two scales are one
   * view's before-and-after rather than two things to choose between. The pill
   * would otherwise need a second Terrain position to say what one click on a
   * route card already says, and the reader would have to know to move it.
   * That is not hypothetical — those two positions EXISTED, as Terrain 1 and
   * Terrain 2, and cutting them to this one boolean is what the author asked
   * for on 14 Sep 2026.
   */
  let drilled = false;

  /**
   * What a terrain view is aimed at when that is a TRIP rather than a route.
   *
   * Mutually exclusive with `focused` by construction: `showPlace` clears the
   * route and empties its track, and `loadTrail` clears the place. Exactly one
   * thing is the subject, so exactly one row of the index rail is marked, and
   * there is never a track drawn for a route the reader is not looking at.
   *
   * It is NOT persisted, unlike the route under `mapglobe-trail`. The stored
   * key answers "which route", and a place is how the reader gets between
   * routes rather than an answer to that question — so a reload comes back to
   * the walk they were reading, which is the thing worth returning to.
   */
  let place: MapTrip | null = null;

  /**
   * Where each drawn route is, by id — filled in by `buildOverview` as the
   * geometry lands.
   *
   * Only `placeBounds` reads it, and only because a trip's ground is its
   * footprint UNION the walks taken there. Deriving it from the geometry rather
   * than carrying an extent in the manifest is the same rule `MapTrail` states:
   * a second copy of where a route is could disagree with the line on the map,
   * and would be believed.
   */
  const routeBounds = new Map<string, LngLatBounds>();

  /**
   * Where the drawn track is, or null when nothing is drawn.
   *
   * This is what makes a focused route remember: leave it for the globe and
   * come back and the camera returns to the route rather than to the
   * placeholder ridge, because `applyMode` reads this before it reaches for
   * TERRAIN_HOME.
   */
  let trackBounds: LngLatBounds | null = null;

  /**
   * Geometry already fetched, keyed by trail id — the promise rather than the
   * result, so two fast clicks on the same chip make one request.
   *
   * Same shape as `loaded` for the atlas layers above, and the same principle:
   * a route is downloaded once and never again. The overview loads all ten at
   * once, which means picking one after that is instant and costs nothing.
   */
  const geometry = new Map<string, Promise<number[][]>>();

  function trailGeometry(trail: MapTrail): Promise<number[][]> {
    const cached = geometry.get(trail.id);
    if (cached) return cached;

    const pending = fetch(`${DATA_BASE}/trails/${trail.id}.json`).then((r) => {
      if (!r.ok) throw new Error(`${r.status} fetching the ${trail.id} route`);
      return r.json() as Promise<number[][]>;
    });
    // Let the next click try again rather than caching the failure. The handler
    // is what keeps this from surfacing as an unhandled rejection; every caller
    // still sees the original.
    pending.catch(() => geometry.delete(trail.id));
    geometry.set(trail.id, pending);
    return pending;
  }

  /* ---- the overview ------------------------------------------------------- */
  /**
   * One route, as the overview holds it.
   *
   * The anchor is the START of the walk, not the middle of its extent, and
   * that is a measured decision rather than a convention. Three of these
   * routes are legs of one trek up the same valley and two of them are the
   * same path walked in both directions: their extents share a centre to
   * within 200 m, so a label on the centre could never be told from its
   * neighbour at any zoom. Their starts are 9 km apart. The start is also
   * already the mark this map draws for "a route begins here", so the label
   * lands on something the reader can see.
   */
  interface Plot {
    trail: MapTrail;
    coords: number[][];
    at: [number, number];
    bounds: LngLatBounds;
  }

  /** A group of routes near enough to share one label until it is zoomed into. */
  interface Area {
    members: Plot[];
    bounds: LngLatBounds;
    /** The zoom the group breaks open at. Its members carry the same number as
        their own minZoom, so there is no gap between the two. */
    breakZoom: number;
  }

  /** Everything drawn, so the camera can frame the whole collection. */
  let overviewBounds: LngLatBounds | null = null;

  /** Built once, on first entry. Null until then. */
  let overviewReady: Promise<void> | null = null;

  function ensureAllTrails(): Promise<void> {
    overviewReady ??= buildOverview();
    return overviewReady;
  }

  /**
   * Fetch every route, draw them all, and work out which of them can share a
   * label.
   *
   * All ten at once, which is a change of shape from what this mode used to do
   * — it fetched exactly the one route it opened on. Ten local files are 46 KB
   * on disk and 11 KB over the wire, they are the whole point of the view being
   * built, and having them all in hand is what makes picking one instant. No
   * third-party byte is involved; the DEM tiles under the relief are.
   */
  async function buildOverview(): Promise<void> {
    const settled = await Promise.all(
      trails.map((trail) =>
        trailGeometry(trail)
          .then((coords) => ({ trail, coords }))
          .catch((error: unknown) => {
            // One route that will not load is nine routes, not a broken mode.
            console.error(`mapglobe: the ${trail.id} route could not be drawn`, error);
            return null;
          }),
      ),
    );

    const plots: Plot[] = [];
    for (const row of settled) {
      if (!row || row.coords.length < 2) continue;
      const bounds = boundsOf(row.coords);
      // What `placeBounds` reads to fold a trip's walks into its own ground.
      routeBounds.set(row.trail.id, bounds);
      plots.push({
        trail: row.trail,
        coords: row.coords,
        at: row.coords[0] as [number, number],
        bounds,
      });
    }

    if (!plots.length) return;

    source('trails').setData({
      type: 'FeatureCollection',
      features: plots.map((plot) => ({
        type: 'Feature',
        properties: { id: plot.trail.id },
        geometry: { type: 'LineString', coordinates: plot.coords },
      })),
    });
    source('trail-starts').setData({
      type: 'FeatureCollection',
      features: plots.map((plot) => ({
        type: 'Feature',
        properties: { id: plot.trail.id },
        geometry: { type: 'Point', coordinates: plot.at },
      })),
    });

    const all = new LngLatBounds();
    for (const plot of plots) all.extend(plot.bounds);
    overviewBounds = all;

    /* Grouped in pixels at the camera the overview is about to use, which is
       why the camera is asked for before anything is grouped. `cameraForBounds`
       measures the real frame, so the same code groups differently on a phone
       and on a desktop — which is correct, because the question is whether two
       labels would land on top of each other HERE. */
    const anchors = plots.map((plot) => mercator(plot.at));
    const zoom = map.cameraForBounds(all, { padding: framePadding() })?.zoom ?? 4;
    const groups = cluster(anchors, Math.min(CLUSTER_PX / worldPx(zoom), CLUSTER_MAX));

    for (const group of groups) {
      const members = group.map((index) => plots[index]!);

      const bounds = new LngLatBounds();
      for (const member of members) bounds.extend(member.bounds);

      /* The group's diameter, and therefore the zoom at which its two furthest
         members are CLUSTER_BREAK_PX apart. Clamped at both ends: a single
         route has nothing to break out of, and two routes starting in the same
         car park would otherwise ask for a zoom no map has. */
      let spread = 0;
      for (const a of group) {
        for (const b of group) spread = Math.max(spread, separation(anchors[a]!, anchors[b]!));
      }
      const breakZoom =
        members.length < 2 || spread === 0
          ? 0
          : Math.min(22, Math.max(0, Math.log2(CLUSTER_BREAK_PX / (spread * 512))));

      const area: Area = { members, bounds, breakZoom };
      for (const member of members) addTrailLabel(member, area);
      if (members.length > 1) addAreaLabel(area);
    }

    /* The same reason `ensureData` ends this way: whoever asked for the routes
       is not necessarily going to move the camera afterwards, and `retier` is
       otherwise only reached by a camera event. Without it, switching the Trails
       chip on in `combined` draws ten lines and not one name until the reader
       happens to pan. */
    retier();
  }

  /**
   * One route's card.
   *
   * It carries `data-mapglobe-trail`, which is the same attribute the picker's
   * chips carry — so the page's own delegated click handler picks the route up
   * without the engine having to know anything about the panel below the map,
   * and the two paths into a route cannot drift apart. See index.ts.
   */
  function addTrailLabel(plot: Plot, area: Area): void {
    const { trail } = plot;
    /* The distance and NOT the date, which the card carried until the view was
       pitched (9 Sep 2026). Under pitch the far half of the frame is compressed,
       and a 149px card is wide enough that two neighbouring routes 12 km apart
       collide and one is dropped: Belumut and Kulai were both lost from a group
       of six that way. "14.5 km" is 85px, which is narrow enough for all six,
       and it is the number that identifies a route at a glance. The date is on
       the tooltip below, in the picker's own chip title, and in the readout the
       moment the route is picked — three places, none of them costing a card. */
    const el = cardButton(trail.label, `${trail.km.toFixed(1)} km`);
    el.dataset.mapglobeTrail = trail.id;
    el.title = `${trail.place} · ${trail.when}`;

    addLabel({
      el,
      at: plot.at,
      anchor: 'bottom',
      kind: 'trail',
      minZoom: area.breakZoom,
      /* Below a group card, which is below a trip card. The route and the group
         collide at exactly one moment — the overview of a small frame, where
         three areas are a hundred pixels apart — and there a card standing for
         six routes says more than one standing for a single route two hundred
         miles away. Both sit under the trips because in `combined` they share a
         map with them, and half these routes were walked ON a trip: the trip is
         the thing the page is about and the route is a detail of it. Between two
         routes it is the usual rule, nearest to the middle of the frame wins. */
      priority: 2,
      stack: { name: trail.label, trips: 0, routes: 1, extent: plot.bounds },
    });
  }

  /**
   * A group's card — "Johor · 6 routes".
   *
   * Clicking it zooms to the group rather than picking anything, which is what
   * makes the overview two steps instead of a pile: six routes inside 76 km are
   * fifteen pixels apart when the whole collection is in frame, and no
   * collision rule can make six labels fit in fifteen pixels. Its own listener
   * rather than a delegated one, because unlike a route card this is not a
   * control the page below the map has any counterpart for.
   */
  function addAreaLabel(area: Area): void {
    const centre = area.bounds.getCenter();
    const name = areaName(area.members.map((member) => member.trail.place));
    const el = cardButton(name, `${area.members.length} routes`);
    el.title = area.members.map((member) => member.trail.label).join(' · ');
    el.addEventListener('click', () => {
      map.fitBounds(area.bounds, {
        padding: framePadding(),
        ...fitAngle(),
        duration: 1400,
        essential: true,
      });
    });

    addLabel({
      el,
      at: [centre.lng, centre.lat],
      anchor: 'bottom',
      kind: 'cluster',
      minZoom: 0,
      maxZoom: area.breakZoom,
      priority: 1,
      stack: { name, trips: 0, routes: area.members.length, extent: area.bounds },
    });
  }

  /**
   * Padding for a fit, scaled to the frame — a flat 80px is most of the width
   * at 390px. The extra at the top is for the label cards, which hang ABOVE
   * their anchor and would otherwise be cropped by the top of the frame.
   *
   * It also steps around the control panel, and that is the half worth
   * explaining. The panel floats over the map, so a fit that centres routes in
   * the frame centres two of them underneath it — `declutter` then hides those
   * two, correctly, and the reader is looking at four cards where six routes
   * are. Padding the fit past the panel instead costs almost nothing on a
   * desktop frame: the overview is constrained by its height, where the panel
   * takes 135px of 880, and a group fit gives up about a fifth of a zoom level.
   *
   * ON A PHONE IT IS NOT WORTH IT, which is what the last test is. At 390px the
   * panel is 324px of a 342px frame and eleven chips deep, so stepping around it
   * leaves a strip 150px wide to fit six routes into — every card ends up in one
   * corner at a zoom low enough that they collide anyway. Landing partly under
   * the panel is the better of the two: the cards that do are hidden rather than
   * unreachable, and every route is a chip in the panel doing the covering.
   *
   * EACH CONTROL IS CLEARED ON ITS CHEAPER AXIS, which is the rule the two
   * special cases below turned out to be (10 Sep 2026). A wide, short box
   * costs less to clear vertically; a tall, narrow one costs less to clear
   * horizontally. So the attribution — 25px tall and a third of the frame wide
   * at 390px — is stepped over rather than around, for ten pixels instead of a
   * third of the map, and the index rail, which is a fifth of the width and the
   * whole height, is stepped around rather than over. Clearing BOTH axes of a
   * full-height rail is what the code did before it existed, and it gives away
   * the entire frame: the fit then fails the test below and falls back, so
   * every card lands under the rail and is decluttered away.
   *
   * THE ATTRIBUTION'S STRIP IS RESERVED WHETHER OR NOT IT MEASURES ANYTHING,
   * and that is not belt and braces — measuring alone does not work here. The
   * pill is EMPTY at the moment this runs: its text is Mapterhorn's, and it
   * arrives with the DEM TileJSON some time after the fit that is being
   * computed. So it measures 0×0, is skipped as "not on screen", and the card
   * that lands in that corner is then hidden by `declutter` a second later when
   * the notice appears underneath it. Its height barely varies, so the strip is
   * a constant and the measured box can only ever make it bigger.
   */
  function framePadding(): { top: number; right: number; bottom: number; left: number } {
    const pad = Math.min(80, host.clientWidth * 0.1);
    const rect = host.getBoundingClientRect();
    const width = rect.width || 1;
    const height = rect.height || 1;

    // Room above for a card, which hangs above its anchor and would otherwise
    // be cropped by the top of the frame.
    let top = pad + 44;
    let left = pad;
    let right = pad;
    let bottom = Math.max(pad, ATTRIBUTION_STRIP);

    for (const box of reserved(rect)) {
      // Wider than it is tall: clear it vertically, from whichever edge it is
      // nearer. Taller than it is wide: clear it horizontally, same rule.
      if (box.w >= box.h) {
        if (box.y > height * 0.5) bottom = Math.max(bottom, height - box.y + 8);
        else top = Math.max(top, box.y + box.h + 8);
        continue;
      }
      if (box.x < width * 0.5) left = Math.max(left, box.x + box.w + 8);
      else right = Math.max(right, width - box.x + 8);
    }

    const fits =
      width - left - right >= width * 0.45 && height - top - bottom >= height * 0.45;

    return fits
      ? { top, right, bottom, left }
      : { top: pad + 44, right: pad, bottom, left: pad };
  }

  async function showOverview(animate: boolean): Promise<void> {
    await ensureAllTrails();
    // The reader can switch modes or pick a route while the geometry is in
    // flight. Whatever they did last wins.
    if (current !== 'terrain' || focused) return;

    if (overviewBounds) {
      map.fitBounds(overviewBounds, {
        padding: framePadding(),
        ...fitAngle(),
        duration: animate ? 1800 : 0,
        essential: true,
      });
    }
    // The camera is left alone when nothing loaded at all — there is nothing to
    // frame, and flying somewhere empty says less than staying put.
    retier();
  }

  /** Both track sources emptied and the extent forgotten — what a place has
      instead of a route. Nothing flies anywhere; the caller does that. */
  function emptyTrack(): void {
    source('track').setData(EMPTY);
    source('track-ends').setData(EMPTY);
    trackBounds = null;
  }

  /**
   * A trip's ground: its built-up footprint, plus every walk taken on it.
   *
   * The union rather than either half, and Chengdu is why. Its footprint is the
   * city; its three recorded walks are legs of one trek 100 km west of it, up
   * the Changping valley. Framing the footprint alone puts the reader on the
   * Sichuan basin with the mountains they came to see off the edge of the
   * frame, and framing the walks alone drops the place the trip is named after.
   *
   * A route whose geometry has not arrived yet is simply left out, which is why
   * `showPlace` waits for it when it is coming. Null when there is nothing to
   * frame at all — a trip with no footprint in `visited.json` and no route —
   * so the caller leaves the camera alone rather than flying to the null island.
   */
  function placeBounds(trip: MapTrip): LngLatBounds | null {
    const ring = visited[trip.id]?.ring;
    const box = ring ? boundsOf(ring) : new LngLatBounds();
    let known = Boolean(ring);

    for (const id of walkedOn[trip.id] ?? []) {
      const route = routeBounds.get(id);
      if (!route) continue;
      box.extend(route);
      known = true;
    }

    return known ? box : null;
  }

  /**
   * Aim a terrain view at a trip — the index rail's other kind of row.
   *
   * The five trips with no recorded route in them are the reason this exists at
   * all: "show me Tokyo" cannot be expressed as "load Tokyo's first route", and
   * a rail that listed eight places and let you click three of them would be
   * worse than one that listed none.
   *
   * The wait is for the routes, not for the map. A trip's walks are part of its
   * ground and they can be a hundred kilometres from its footprint, so a fit
   * computed before they land would frame the city and then never correct
   * itself. `applyLayers` has already asked for them by the time this waits.
   */
  async function showPlace(id: string, animate = true): Promise<void> {
    const trip = trips.find((row) => row.id === id);
    if (!trip) return;

    place = trip;
    focused = null;
    drilled = false;
    emptyTrack();
    applyLayers();

    if (showsTrails()) await ensureAllTrails();
    // The reader can pick something else, or leave, while the geometry is in
    // flight. Whatever they did last wins — same guard as `showOverview`.
    if (place !== trip) return;

    const box = placeBounds(trip);
    if (!box) return;

    map.fitBounds(grow(box, PLACE_GROWTH), {
      padding: framePadding(),
      /* A place is capped for the same reason a route is. None of the eight is
         small enough to reach it today — the tightest is Phuket's footprint
         with one walk folded in — but a trip whose footprint is a village
         would over-zoom exactly as Cape Krathing did. */
      maxZoom: TRACK_MAX_ZOOM,
      ...fitAngle(),
      duration: animate ? 2000 : 0,
      essential: true,
    });
    attachTerrainWhenSettled();
  }

  /** Leave a route for the view of all of them. */
  function showAllTrails(): Promise<void> {
    focused = null;
    // The overview is every route and no place. A place left set here would be
    // where `All` flew to on the way back, which is not what was asked for.
    place = null;
    applyMode('terrain', true);
    return ensureAllTrails();
  }

  function trackEnd(role: 'start' | 'end', at: number[]): GeoJSON.Feature {
    return {
      type: 'Feature',
      properties: { role },
      geometry: { type: 'Point', coordinates: at },
    };
  }

  function drawTrack(coords: number[][]): void {
    (map.getSource('track') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
      ],
    });
    // End first, so that on a loop — where the two coincide — the start is the
    // one drawn on top. See the `track-end` layer.
    (map.getSource('track-ends') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: [trackEnd('end', coords.at(-1)!), trackEnd('start', coords[0]!)],
    });
    trackBounds = boundsOf(coords);
  }

  /**
   * Put the camera on the drawn track.
   *
   * The padding scales with the frame rather than sitting at a fixed 80px: at
   * 390px that would be 160 of the 390 given away to margin, and a 20 km run
   * would be fitted into the strip left over.
   */
  /**
   * Frame the drawn route.
   *
   * `factor` is how much wider than the route's own extent to frame — 1 is the
   * route filling the frame, and the two callers that pass more are the Terrain
   * view on arrival and the Trails tab's own widened fit. It went from a bare
   * `fitBounds` to this on 10 Sep 2026; the padding, pitch and bearing are
   * unchanged.
   *
   * The angle comes from `fitAngle()` rather than the literal 62/-22 that used
   * to be written here. Those were a duplicate of TRAILS_VIEW that happened to
   * agree with it, and the `All` tab's Terrain view needs the same angle from
   * the same place — a third copy is how one of them ends up half a degree off.
   */
  /**
   * How much wider than the route's own extent to frame it, by whoever is
   * asking. One number, three answers, and no call site passes it — a fit that
   * had to be told its own scale is a fit that can be told the wrong one.
   */
  function trackFactor(): number {
    /* The Terrain view's two scales, and the one place the difference between
       them lives. It ARRIVES at the region — the author's spec — and tightens
       to the walk itself once the reader has picked one. `drilled` is reset on
       every arrival in the view, so leaving it and coming back starts wide
       again rather than resuming halfway down. */
    if (terrainView()) return drilled ? 1 : REGION_GROWTH;
    return current === 'terrain' ? TRAIL_GROWTH : 1;
  }

  function fitTrack(animate: boolean): void {
    if (!trackBounds) return;
    const factor = trackFactor();
    map.fitBounds(factor === 1 ? trackBounds : grow(trackBounds, factor), {
      padding: framePadding(),
      /* The cap only ever pulls the camera BACK, so the wide arrival scales are
         untouched by it — the widest REGION_GROWTH fit lands at z9.4, four
         levels away. It binds on the drilled frame of the three smallest
         routes, and on the Trails tab's own single-route fit, which had the
         same problem more mildly. */
      maxZoom: TRACK_MAX_ZOOM,
      ...fitAngle(),
      duration: animate ? 2000 : 0,
      essential: true,
    });
    // fitBounds restarts the camera, so re-arm: an attach queued against the
    // pre-fit view would otherwise fire while the map was still travelling.
    attachTerrainWhenSettled();
  }

  /**
   * `drill` belongs to the `All` tab's Terrain view, and it is what tells "the
   * reader chose this walk" apart from "this view had to open on something".
   * Only the first tightens the frame from the region to the route; see
   * `trackFactor`. The globe and terrain MODE ignore it, and the arrival paths
   * pass false.
   */
  async function loadTrail(trail: MapTrail, animate = true, drill = true): Promise<void> {
    const coords = await trailGeometry(trail);

    focused = trail;
    /* One subject at a time. A route and a place cannot both be what the view
       is aimed at, and leaving a stale place set would mark a row in the index
       for somewhere the camera is not. */
    place = null;
    drilled = drill;
    drawTrack(coords);

    /* Coming from the globe, applyMode does the flying — it reads `trackBounds`
       and fits to what was just drawn. Passing `animate` through rather than
       fitting twice is what makes a route picked from the globe FLY to the
       ridge instead of jumping to it: the second fit used to start from the
       destination the first one had already jumped to, so the animation had
       nowhere to go. */
    /* `!terrainView()` is what keeps a route picked inside the `All` tab IN the
       `All` tab (10 Sep 2026). Without it, choosing a route from a card on a
       Terrain view would fly to the ridge and land the reader in the Trails tab,
       having silently changed their mode, their panel and what is on the map —
       for a click that meant "show me this one, here". */
    if (current !== 'terrain' && !terrainView()) {
      applyMode('terrain', animate);
      return;
    }

    // Already somewhere that frames one route: the overview handing over to
    // one, one handing over to another, or the Terrain view being re-aimed. The
    // layers change, the mode does not.
    applyLayers();
    fitTrack(animate);
  }

  /* A `clearTrack()` here emptied both track sources and flew back to
     TERRAIN_HOME. It went with the Clear button on 7 Sep 2026: it was the undo
     for a dropped GPX, and once the routes were built in its only effect was to
     replace a route with an empty hillside. Exactly one route is on the map at
     any time now, and the way to change it is to pick another. */

  /* Terrain mode's opening view is drawn BEFORE the first applyMode rather
     than after it, whichever of the two it is. applyMode reads `focused` and
     `trackBounds` to decide where the camera goes, so in this order the map
     arrives already framed; the other way round it would frame the Taiwan
     placeholder and then jump once the geometry landed.

     The overview is awaited for the same reason — its camera is the extent of
     ten routes, and that is not known until they are in hand. */
  if (mode === 'terrain') {
    if (trail) {
      await loadTrail(trail, false).catch((error: unknown) => {
        // A route that will not load is the placeholder ridge, not a broken page.
        console.error('mapglobe: the opening route could not be drawn', error);
      });
    } else {
      await ensureAllTrails();
    }
  }

  applyMode(mode, false);

  /* ---- the detail card's two hooks into the map ---------------------------- */
  function setProbe(at: [number, number] | null): void {
    source('probe').setData(
      at
        ? {
            type: 'FeatureCollection',
            features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: at } }],
          }
        : EMPTY,
    );
  }

  /**
   * The series the track is currently coloured by, or null for the flat
   * accent. Kept so `refreshTheme` can re-derive the ramp — the colours in a
   * `line-gradient` expression are literals, and a theme change would
   * otherwise leave a route painted in the old theme's ink.
   */
  let trackSeries: number[] | null = null;

  /** Stops in the gradient. More than this is invisible on a 3px line, and an
      expression with 900 literal colours is one MapLibre has to re-evaluate
      per tile. */
  const GRADIENT_STOPS = 48;

  function paintGradient(): void {
    if (!trackSeries || trackSeries.length < 2) {
      /* `undefined` rather than `null`: MapLibre's `setPaintProperty` treats
         the two the same way — the property is unset and the layer falls back
         to `line-color` — but the typings only admit one of them. */
      map.setPaintProperty('track', 'line-gradient', undefined);
      return;
    }
    const n = Math.min(GRADIENT_STOPS, trackSeries.length);
    const stops: (number | string)[] = [];
    for (let k = 0; k < n; k++) {
      const at = k / (n - 1);
      const v = trackSeries[Math.round(at * (trackSeries.length - 1))]!;
      /* Accent at the bottom of the range, the page's ink at the top. The
         accent is the route's own colour, so the lowest ground on it looks
         exactly as a route looks; everything above steps toward the text
         colour, which is "more ink" in light and in dark alike. */
      stops.push(at, mix(p.visited, p.ink, Math.min(1, Math.max(0, v))));
    }
    map.setPaintProperty('track', 'line-gradient', [
      'interpolate',
      ['linear'],
      ['line-progress'],
      ...stops,
    ]);
  }

  function colourTrack(values: number[] | null): void {
    trackSeries = values;
    paintGradient();
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
    map.setPaintProperty('track-probe', 'circle-color', p.ink);
    map.setPaintProperty('track-probe', 'circle-stroke-color', p.ground);
    // The gradient's colours are literals in an expression — see paintGradient.
    paintGradient();
    /* Through paintTrails, NOT `p.visited` written out again: these two are the
       one pair of paint properties whose value depends on whether a route is
       focused, so a second copy here would repaint the de-emphasised routes
       back to the accent on every theme change. */
    paintTrails();
    map.setPaintProperty('trail-start', 'circle-stroke-color', p.ground);
    map.setPaintProperty('track-end', 'circle-color', [
      'case',
      ['==', ['get', 'role'], 'start'],
      p.visited,
      p.ground,
    ]);
    map.setPaintProperty('track-end', 'circle-stroke-color', [
      'case',
      ['==', ['get', 'role'], 'start'],
      p.ground,
      p.visited,
    ]);
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

    /* THE SETPAINTPROPERTY CALLS ABOVE DO NOT REACH A DRAPED MAP.
       With terrain attached, MapLibre renders the map into a texture per tile
       and drapes those over the mesh, and a paint-property change does not
       invalidate that cache — nor does moving the camera. Measured across a
       light → dark flip, as the mean colour of the canvas:

         explore   230 → 33     repaints
         terrain   178 → 166    does not

       Re-attaching the terrain is what forces the drape to be re-rendered in
       the new colours. It costs nothing on the network — the DEM tiles are
       already decoded and in memory — and it is skipped in every mode that
       does not drape, because getTerrain() is null there.

       IT HAS TO WAIT FOR A RENDER, and that is the whole subtlety. Detaching
       and re-attaching in this same tick is coalesced away and changes nothing:
       measured, the flip then stops at 152 and stays there through eight
       seconds and a camera nudge. The drape can only be rebuilt from a style
       that has actually been drawn once in the new colours, so the swap is
       hung off the next `render`, where it reaches 65 — the same value a full
       manual re-draw settles at. One frame of flat terrain, on a theme change
       only. */
    if (map.getTerrain()) {
      map.once('idle', () => {
        if (!map.getTerrain()) return;
        map.setTerrain(null);
        map.setTerrain(TERRAIN);
      });
      map.triggerRepaint();
    }
  }

  return {
    setMode: (next) => applyMode(next, true),
    setLayers,
    setContent,
    setView,
    /* Wrapped rather than passed straight through: the internal function takes
       a third argument, `drill`, which no caller outside the engine has any
       business setting — a click on a route always means the reader chose it. */
    loadTrail: (next, animate) => loadTrail(next, animate),
    showAllTrails,
    showPlace,
    setProbe,
    colourTrack,
    refreshTheme,
    destroy: () => map.remove(),
  };
}
