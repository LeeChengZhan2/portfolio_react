/**
 * Page wiring for the MapLibre earth on /about/travel-preview.
 *
 * Same shape as src/scripts/globe/index.ts on purpose — the two sections are
 * meant to be compared, so anything that differs between them should be a real
 * difference rather than an accident of how they were wired.
 *
 * Everything expensive is deferred: MapLibre, the style and the same ~1.1 MB of
 * local geometry the three.js globe reads sit behind a dynamic import that does
 * not fire until the stage is a screen away. A visitor who never scrolls past
 * the first earth pays nothing for the second.
 *
 * A delegated listener, not an island.
 */

import type { MapGlobe, MapTrail, MapTrip } from './engine';
// Values come from modes.ts, never from engine.ts — see the note there. A single
// static value import from the engine puts MapLibre in the eager bundle.
import {
  DEFAULT_CONTENT,
  DEFAULT_LAYERS,
  DEFAULT_VIEW,
  MAP_CONTENT,
  MAP_LAYERS,
  MAP_MODES,
  MAP_VIEWS,
  MESH_VIEWS,
  type MapContent,
  type MapLayer,
  type MapMode,
  type MapView,
} from './modes';

const STORAGE_KEY = 'mapglobe-mode';
/* `explore` — the globe — rather than `terrain`, because the globe is what the
   travel section is about and terrain mode is the detour. It is also the cheaper
   of the two on arrival: explore opens on two local files and makes no
   third-party request at all, while terrain reaches straight for DEM tiles.

   A mode stored before 7 Sep 2026 can be `places` or `atlas`, neither of which
   exists now. Nothing special handles that, and nothing needs to: `isMode`
   checks the stored string against MAP_MODES and a miss falls through to here,
   which is the right answer anyway — both of those modes were positions
   `explore` can be put in with its own chips. */
const DEFAULT_MODE: MapMode = 'explore';

/**
 * The filter set lives under its own key, not inside the mode.
 *
 * Same reasoning as the site's two theme keys: a reader who tunes the filters,
 * looks at Trails and comes back should find their filters where they
 * left them. One combined key would have to forget one to remember the other.
 */
const LAYERS_KEY = 'mapglobe-layers';

/**
 * And which of the trips and the trails the `All` tab shows, under a key of its
 * own for the same reason again — four keys now, one per thing the reader can
 * decide, and none of them able to forget another's answer.
 */
const CONTENT_KEY = 'mapglobe-content';

/**
 * And the angle the `All` tab looks from, under a key of its own for the same
 * reason again — five now, one per thing the reader can decide, and none of
 * them able to forget another's answer.
 *
 * A reader who tilts `All`, goes to read a route and comes back should find it
 * tilted. Folding this into the mode key would mean the mode had to remember
 * an angle it does not have — `explore` is always flat and `terrain` is always
 * pitched — and folding it into the layer key would tie the tilt to a filter
 * set, so changing one chip would level the camera.
 */
const VIEW_KEY = 'mapglobe-view';

/**
 * Which route terrain mode is showing, under a third key for the same reason
 * the filters got a second one: a reader who picks a route, goes out to the
 * globe and comes back should find the route they left, and one combined key
 * would have to forget one choice to remember the other.
 *
 * An empty string is a real answer again (9 Sep 2026) and means the overview —
 * every route on the map, none picked. It was a real answer once before, when
 * it meant "Clear was pressed"; that reading was removed with the button, and
 * a stale one left by a visit from before then now lands on the overview,
 * which is where the mode opens anyway.
 */
const TRAIL_KEY = 'mapglobe-trail';

/**
 * And whether the index rail is open — a sixth key, for the sixth thing the
 * reader can decide, and for the same reason as the other five.
 *
 * Its DEFAULT depends on the frame rather than being a constant, which none of
 * the others needs: nineteen rows is a third of a desktop frame and most of a
 * phone one. So it opens where there is room and starts shut where there is
 * not, and a stored answer beats both.
 */
const INDEX_KEY = 'mapglobe-index';

const section = document.querySelector<HTMLElement>('[data-mapglobe]');
const stage = document.querySelector<HTMLElement>('[data-mapglobe-stage]');
const labelLayer = document.querySelector<HTMLElement>('[data-mapglobe-labels]');
const status = document.querySelector<HTMLElement>('[data-mapglobe-status]');
const readout = document.querySelector<HTMLElement>('[data-mapglobe-readout]');

/** Data the page hands over inline rather than making the script fetch it —
    the trips, and the manifest of recorded routes. Neither is large, and both
    are already known at build time. */
function readJson<T>(id: string): T | null {
  const node = document.querySelector<HTMLScriptElement>(`#${id}`);
  if (!node?.textContent) return null;
  try {
    return JSON.parse(node.textContent) as T;
  } catch {
    return null;
  }
}

const trails = readJson<MapTrail[]>('mapglobe-trails') ?? [];

function setStatus(state: string, text: string): void {
  if (!status) return;
  status.dataset.state = state;
  status.textContent = text;
}

function isMode(value: string | null | undefined): value is MapMode {
  return MAP_MODES.includes(value as MapMode);
}

function isLayer(value: string | null | undefined): value is MapLayer {
  return MAP_LAYERS.includes(value as MapLayer);
}

function isContent(value: string | null | undefined): value is MapContent {
  return MAP_CONTENT.includes(value as MapContent);
}

function isView(value: string | null | undefined): value is MapView {
  return MAP_VIEWS.includes(value as MapView);
}

function storedMode(): MapMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isMode(saved)) return saved;
  } catch {
    // Private browsing can refuse reads. Fall through to the default.
  }
  return DEFAULT_MODE;
}

function storedLayers(): MapLayer[] {
  try {
    const saved = localStorage.getItem(LAYERS_KEY);
    // An empty string is a real answer — every filter switched off — so it is
    // told apart from "nothing stored" by the null check rather than by falsiness.
    if (saved !== null) return MAP_LAYERS.filter((layer) => saved.split(',').includes(layer));
  } catch {
    // Private browsing can refuse reads. Fall through to the defaults.
  }
  return [...DEFAULT_LAYERS];
}

/**
 * Which of the trips and the trails the `All` tab opens with. Same shape as
 * `storedLayers`, including the empty string meaning "none of them", which is a
 * real answer: an empty `All` is a bare globe, and the reader asked for it.
 */
function storedContent(): MapContent[] {
  try {
    const saved = localStorage.getItem(CONTENT_KEY);
    if (saved !== null) return MAP_CONTENT.filter((item) => saved.split(',').includes(item));
  } catch {
    // Private browsing can refuse reads. Fall through to the defaults.
  }
  return [...DEFAULT_CONTENT];
}

/**
 * The angle the `All` tab opens at.
 *
 * A single value rather than a list, so unlike the two filter keys there is no
 * empty-string case to tell apart from a missing one: a stored string either
 * names a view or it does not, and anything that does not falls through to
 * flat. That also handles a hand-edited value without a branch of its own.
 */
function storedView(): MapView {
  try {
    const saved = localStorage.getItem(VIEW_KEY);
    if (isView(saved)) return saved;
  } catch {
    // Private browsing can refuse reads. Fall through to the default.
  }
  return DEFAULT_VIEW;
}

/**
 * The route to open on, or null for the overview of all of them.
 *
 * Null is the default (9 Sep 2026): terrain mode opens on every route at once,
 * and a reader arrives at the collection rather than inside one route with no
 * idea what the other nine are. Only somebody who was last looking at a
 * particular route comes back to it.
 *
 * A stored id is checked against the manifest before it is used, so a route
 * deleted since the last visit lands on the overview instead of on an empty
 * map — the same place an empty string and a missing key land.
 */
function storedTrail(): MapTrail | null {
  try {
    const saved = localStorage.getItem(TRAIL_KEY);
    return trails.find((trail) => trail.id === saved) ?? null;
  } catch {
    // Private browsing can refuse reads. Fall through to the overview.
    return null;
  }
}

/** `null` for the overview, which is stored as an empty string. */
function rememberTrail(id: string | null): void {
  try {
    localStorage.setItem(TRAIL_KEY, id ?? '');
  } catch {
    // Works for this page view; just will not be remembered.
  }
}

/**
 * Whether the index rail opens.
 *
 * Read once, at load, rather than watched: a reader who rotates a phone has
 * their own answer by then, and re-deciding it under them would throw that
 * away. 640px is the same breakpoint the frame changes shape at.
 */
function storedIndex(): boolean {
  try {
    const saved = localStorage.getItem(INDEX_KEY);
    if (saved === 'open') return true;
    if (saved === 'shut') return false;
  } catch {
    // Private browsing can refuse reads. Fall through to the frame's answer.
  }
  return window.innerWidth >= 640;
}

function markSelected(mode: MapMode): void {
  for (const button of document.querySelectorAll<HTMLElement>('[data-mapglobe-mode]')) {
    button.setAttribute('aria-checked', String(button.dataset.mapglobeMode === mode));
  }
}

/**
 * Mark the picker, where `null` means the overview chip rather than nothing.
 *
 * Scoped to `[role='radio']`, and that is not belt and braces. The route cards
 * ON the map carry the same `data-mapglobe-trail` attribute — deliberately, so
 * one delegated handler serves both — and they are buttons, not radios in this
 * group. Writing `aria-checked` on them would tell a screen reader that a card
 * floating over a mountain is one option in the picker below the frame.
 */
function markTrails(id: string | null): void {
  for (const button of document.querySelectorAll<HTMLElement>(
    "[role='radio'][data-mapglobe-trail]",
  )) {
    button.setAttribute('aria-checked', String(button.dataset.mapglobeTrail === id));
  }
  for (const button of document.querySelectorAll<HTMLElement>('[data-mapglobe-overview]')) {
    button.setAttribute('aria-checked', String(id === null));
  }
  /* The rail follows the route, and picking a route is what un-picks a place.
     Choosing a place does NOT come through here — see `goPlace`, which marks
     the rail directly and leaves the stored route alone. */
  markIndex(null, id);
}

/**
 * Mark the index rail — which trip or which route the camera is on.
 *
 * `aria-current` rather than `aria-checked`, and the distinction is real: the
 * picker below the frame is a radiogroup where exactly one of eleven options is
 * true, and this is a list of places where one is where you are. A screen
 * reader saying "selected" of a row in an index describes a control that does
 * not exist.
 *
 * Scoped to the rail's own container rather than to a class, because the route
 * rows share `data-mapglobe-trail` with the picker chips and the cards on the
 * map — one attribute, one delegated handler, three ways in — and only these
 * ones take `aria-current`.
 *
 * At most one of the two arguments is ever non-null. A place and a route cannot
 * both be the subject; see `place` in engine.ts, which clears one to set the
 * other.
 */
function markIndex(place: string | null, route: string | null): void {
  const rail = document.querySelector<HTMLElement>('[data-mapglobe-index]');
  if (!rail) return;
  let current: HTMLElement | null = null;
  for (const row of rail.querySelectorAll<HTMLElement>('[data-mapglobe-place]')) {
    const on = row.dataset.mapglobePlace === place;
    row.setAttribute('aria-current', String(on));
    if (on) current = row;
  }
  for (const row of rail.querySelectorAll<HTMLElement>('[data-mapglobe-trail]')) {
    const on = row.dataset.mapglobeTrail === route;
    row.setAttribute('aria-current', String(on));
    if (on) current = row;
  }

  /* And bring it into view, because the rail is not always where the click
     came from: a route picked from its CARD on the map marks a row that can be
     nineteen rows down a scrolling list, and a mark nobody can see is not a
     mark. `nearest` so a row already on screen does not move — scrolling the
     list under the reader every time they click the map would be worse than
     not scrolling it at all. */
  current?.scrollIntoView({ block: 'nearest' });
}

/**
 * Mark the five filter chips.
 *
 * `impliedRelief` is the `All` tab's pitched view, and it is a PARAMETER rather
 * than something read from a variable because this function is at module scope
 * while the mode and the view are not. It does two things, and the second is
 * the interesting one:
 *
 * The chip reads as on — the relief IS on, so a chip saying otherwise would be
 * lying about the map. And the chip is DISABLED, because a control that cannot
 * control is worse than no control: clicking it would remove `relief` from the
 * stored set while the shading stayed exactly where it was, which reads as a
 * broken toggle. The site has hit this before, on the theme picker, and settled
 * it the same way round — a click has to change something visible.
 *
 * Note what is not touched: the stored filter set. The reader's own answer to
 * "do I want relief" is still in `localStorage` and still in `active`, and it
 * comes back the moment the view goes flat. Same two-axes split as `theme` and
 * `light-theme`.
 */
function markLayers(active: MapLayer[], impliedRelief: boolean): void {
  const on = new Set(active);
  for (const button of document.querySelectorAll<HTMLElement>('[data-mapglobe-layer]')) {
    const layer = button.dataset.mapglobeLayer;
    if (!isLayer(layer)) continue;
    const implied = impliedRelief && layer === 'relief';
    button.setAttribute('aria-pressed', String(implied || on.has(layer)));
    (button as HTMLButtonElement).disabled = implied;
    button.title = implied
      ? 'On while the Terrain view is up — that view always shades the relief.'
      : (button.dataset.mapglobeHint ?? button.title);
  }
}

/** Mark the `All` tab's two-state view switch. */
function markViews(view: MapView): void {
  for (const button of document.querySelectorAll<HTMLElement>('[data-mapglobe-view]')) {
    button.setAttribute('aria-checked', String(button.dataset.mapglobeView === view));
  }
}

function markContent(active: MapContent[]): void {
  const on = new Set(active);
  for (const button of document.querySelectorAll<HTMLElement>('[data-mapglobe-content]')) {
    const item = button.dataset.mapglobeContent;
    if (isContent(item)) button.setAttribute('aria-pressed', String(on.has(item)));
  }
}

/**
 * The route readout.
 *
 * Every figure is read straight off the manifest, which measured it from the
 * full recording at build time — see scripts/build-trails.mjs. Nothing here is
 * derived from the simplified line the map is drawing, which is what lets the
 * geometry be simplified harder without ever shortening a printed distance.
 *
 * There was a second readout beside this one until 7 Sep 2026, `showStats`,
 * which formatted figures computed in the browser from a dropped GPX. It went
 * with the parser.
 */
function showTrail(trail: MapTrail): void {
  if (!readout) return;
  const parts = [
    trail.place,
    trail.when,
    `${trail.km.toFixed(1)} km`,
    trail.ascent === null ? null : `${trail.ascent.toLocaleString()} m ascent`,
    trail.low === null || trail.high === null
      ? null
      : `${trail.low.toLocaleString()}–${trail.high.toLocaleString()} m`,
  ].filter(Boolean);

  readout.dataset.state = 'loaded';
  readout.innerHTML = '';

  const name = document.createElement('strong');
  name.textContent = trail.label;
  readout.append(name, document.createTextNode(` · ${parts.join(' · ')}`));
}

/**
 * The same readout, for the overview: what the collection adds up to.
 *
 * Summed here rather than printed from a constant, so a route added to the
 * manifest changes these figures with it. Same provenance as the single-route
 * line — every kilometre and every metre of ascent was measured off the full
 * recording at build time.
 */
function showAllRoutes(): void {
  if (!readout) return;

  const km = trails.reduce((total, trail) => total + trail.km, 0);
  const ascent = trails.reduce((total, trail) => total + (trail.ascent ?? 0), 0);

  readout.dataset.state = 'loaded';
  readout.innerHTML = '';

  const name = document.createElement('strong');
  name.textContent = 'All routes';
  readout.append(
    name,
    document.createTextNode(
      ` · ${trails.length} recorded · ${km.toFixed(1)} km · ` +
        `${ascent.toLocaleString()} m ascent · pick one on the map to fly to it`,
    ),
  );
}

function showTrackError(message: string): void {
  if (!readout) return;
  readout.dataset.state = 'error';
  readout.textContent = message;
}

if (section && stage && labelLayer) {
  let globe: MapGlobe | null = null;
  let mode = storedMode();
  let active = storedLayers();
  /** Which of the trips and the trails the `All` tab is showing. */
  let shown = storedContent();
  /** The angle the `All` tab is looking from. */
  let view = storedView();
  /** The route being shown, or null for the overview of all of them — which is
      where terrain mode opens unless the reader left inside a route. */
  let trail: MapTrail | null = storedTrail();

  /** Whether the index rail is open. */
  let railOpen = storedIndex();

  /** Whether the `All` tab is in any of its four terrain views. */
  function terrainView(): boolean {
    return mode === 'combined' && view !== 'globe';
  }

  /**
   * And whether it is in one of the three that attach the 3D mesh, which is
   * what the index rail is gated on in CSS.
   *
   * Written as an attribute rather than switched in JS because everything about
   * the rail's appearance is a style — the same way `data-mode` gates the two
   * panels and the readout. MESH_VIEWS comes from modes.ts so this and the
   * engine's own `meshView()` cannot disagree.
   */
  function markMesh(): void {
    section!.dataset.meshView = String(mode === 'combined' && MESH_VIEWS.includes(view));
  }

  /* The relief chip is marked from the mode AND the view, which is why this is
     a function rather than a `markLayers(active)` call repeated at each site.
     Three things move it: a layer click, a view click, and a mode change —
     because leaving `All` for `Trips` levels the camera and hands the chip back
     to the reader even though neither the filters nor the view was touched.

     All three terrain views shade relief, not just the tilted one — the two
     mesh views shade it harder, and neither can be asked not to. */
  function refreshLayers(): void {
    markLayers(active, terrainView());
  }

  /**
   * Open or shut the rail.
   *
   * `hidden` on the list rather than on the whole rail, so the toggle stays
   * reachable — a disclosure that hides its own control is a one-way door.
   * Note the CSS: `.index__list` is a flex column, and `display: flex` beats
   * the `hidden` attribute's UA rule, so there is an explicit
   * `.index__list[hidden]` in MapGlobeStage.astro doing the actual hiding.
   */
  function markIndexOpen(open: boolean): void {
    for (const toggle of document.querySelectorAll<HTMLElement>(
      '[data-mapglobe-index-toggle]',
    )) {
      toggle.setAttribute('aria-expanded', String(open));
    }
    const list = document.querySelector<HTMLElement>('#mapglobe-index-list');
    if (list) list.hidden = !open;
  }

  // The markup ships the defaults as selected, because a static build cannot
  // know what the visitor stored. Correct all of them before any interaction.
  markSelected(mode);
  refreshLayers();
  markContent(shown);
  markViews(view);
  markTrails(trail?.id ?? null);
  markIndexOpen(railOpen);
  markMesh();

  /* ---- switching, which works before the map has loaded ------------------- */
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;

    const modeButton = target?.closest<HTMLElement>('[data-mapglobe-mode]');
    if (modeButton && isMode(modeButton.dataset.mapglobeMode)) {
      mode = modeButton.dataset.mapglobeMode;
      markSelected(mode);
      markMesh();
      // `explore` is always flat, so leaving `All` hands the relief chip back
      // to the reader's own filter set — and returning to it takes it away
      // again if the view is still tilted.
      refreshLayers();
      section.dataset.mode = mode;
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        // Works for this page view; just will not be remembered.
      }

      /* Terrain mode is two views, and which one this is has already been
         decided — by what the reader last looked at, or by the default, which
         is the overview. `pick` and `showAll` both switch the mode themselves,
         so `setMode` is only for the way back to the globe. */
      if (mode === 'terrain') void (trail ? pick(trail) : showAll());
      else globe?.setMode(mode);
      return;
    }

    /* Both the chips under the frame and the route cards on the map, which is
       why the engine puts this attribute on the cards it builds: one path into
       a route, so the two cannot drift apart. */
    const trailButton = target?.closest<HTMLElement>('[data-mapglobe-trail]');
    if (trailButton) {
      const found = trails.find((item) => item.id === trailButton.dataset.mapglobeTrail);
      if (found) void (terrainView() ? aim(found) : pick(found));
      return;
    }

    if (target?.closest('[data-mapglobe-overview]')) {
      void showAll();
      return;
    }

    /* A trip row in the index rail. Only the rail has these — a trip's card on
       the map is a LINK to its page, which is a different and older answer to
       "tell me about this place" and stays what it is. */
    const placeButton = target?.closest<HTMLElement>('[data-mapglobe-place]');
    if (placeButton?.dataset.mapglobePlace) {
      void goPlace(placeButton.dataset.mapglobePlace);
      return;
    }

    if (target?.closest('[data-mapglobe-index-toggle]')) {
      railOpen = !railOpen;
      markIndexOpen(railOpen);
      try {
        localStorage.setItem(INDEX_KEY, railOpen ? 'open' : 'shut');
      } catch {
        // Works for this page view; just will not be remembered.
      }
      return;
    }

    const contentButton = target?.closest<HTMLElement>('[data-mapglobe-content]');
    if (contentButton && isContent(contentButton.dataset.mapglobeContent)) {
      const item = contentButton.dataset.mapglobeContent;
      const next = new Set(shown);
      if (next.has(item)) next.delete(item);
      else next.add(item);

      // In MAP_CONTENT order rather than click order, so the stored string is
      // stable and comparable between visits. Same as the layer chips.
      shown = MAP_CONTENT.filter((id) => next.has(id));
      markContent(shown);
      globe?.setContent(shown);
      try {
        localStorage.setItem(CONTENT_KEY, shown.join(','));
      } catch {
        // Works for this page view; just will not be remembered.
      }
      return;
    }

    const viewButton = target?.closest<HTMLElement>('[data-mapglobe-view]');
    if (viewButton && isView(viewButton.dataset.mapglobeView)) {
      view = viewButton.dataset.mapglobeView;
      markViews(view);
      markMesh();
      // The pitched view implies relief, so the chip changes with the camera.
      refreshLayers();
      globe?.setView(view);
      try {
        localStorage.setItem(VIEW_KEY, view);
      } catch {
        // Works for this page view; just will not be remembered.
      }
      return;
    }

    const layerButton = target?.closest<HTMLElement>('[data-mapglobe-layer]');
    if (layerButton && isLayer(layerButton.dataset.mapglobeLayer)) {
      const layer = layerButton.dataset.mapglobeLayer;
      const next = new Set(active);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);

      // Rebuilt in MAP_LAYERS order rather than in click order, so the stored
      // string is stable and a filter set is comparable between visits.
      active = MAP_LAYERS.filter((id) => next.has(id));
      refreshLayers();
      globe?.setLayers(active);
      try {
        localStorage.setItem(LAYERS_KEY, active.join(','));
      } catch {
        // Works for this page view; just will not be remembered.
      }
      return;
    }

  });

  section.dataset.mode = mode;

  /* ---- routes -------------------------------------------------------------- */
  /**
   * Enter terrain mode, one way or the other.
   *
   * The mode follows the click in both cases. Picking a route while looking at
   * the globe means "show me this", and leaving the reader on the globe would
   * make the control look broken.
   */
  function enterTerrain(next: MapTrail | null): void {
    trail = next;
    markTrails(next?.id ?? null);
    rememberTrail(next?.id ?? null);

    mode = 'terrain';
    markSelected(mode);
    section!.dataset.mode = mode;
  }

  /**
   * Re-aim one of the `All` tab's terrain views at a different route, WITHOUT
   * leaving the tab.
   *
   * The difference from `pick` is only the mode: this does not call
   * `enterTerrain`, so the tab, the panel and the filters all stay where they
   * are. It writes the same `mapglobe-trail` key and marks the same picker,
   * which is what makes a route chosen here the route the Trails tab opens on —
   * one answer to "which route", wherever it was given.
   *
   * The readout stays hidden, because it belongs to the Trails tab. `All` has
   * the route's own card on the map, which is what was just clicked.
   */
  async function aim(next: MapTrail): Promise<void> {
    trail = next;
    markTrails(next.id);
    rememberTrail(next.id);
    if (!globe) return;
    try {
      await globe.loadTrail(next);
    } catch (error) {
      console.error('mapglobe: aiming a terrain view at a route failed', error);
    }
  }

  /**
   * Aim a terrain view at a TRIP — the index rail's other kind of row.
   *
   * Sibling of `aim`, and the differences are the point. It marks the rail
   * itself rather than going through `markTrails`, because a place is not an
   * answer to "which route": the stored `mapglobe-trail` is left exactly as it
   * was, so a reader who wanders through three places and reloads comes back to
   * the walk they were reading. And it never changes the mode, for the same
   * reason `aim` does not — the click meant "show me here, here".
   *
   * Five of the eight trips have no recorded route in them, which is the whole
   * reason this is not just "load that trip's first route".
   */
  async function goPlace(id: string): Promise<void> {
    markIndex(id, null);
    if (!globe) return;
    try {
      await globe.showPlace(id);
    } catch (error) {
      console.error('mapglobe: framing a trip failed', error);
    }
  }

  async function pick(next: MapTrail): Promise<void> {
    enterTerrain(next);
    if (!globe) return;
    try {
      await globe.loadTrail(next);
      showTrail(next);
    } catch (error) {
      showTrackError('That route could not be loaded.');
      console.error('mapglobe: loading a route failed', error);
    }
  }

  async function showAll(): Promise<void> {
    enterTerrain(null);
    // The summary goes up before the geometry lands rather than after: every
    // figure in it comes from the manifest the page already has, so waiting
    // would only mean showing the previous route's line for a moment longer.
    showAllRoutes();
    if (!globe) return;
    try {
      await globe.showAllTrails();
    } catch (error) {
      showTrackError('The routes could not be loaded.');
      console.error('mapglobe: loading the routes failed', error);
    }
  }

  /* A `take()` here read a GPX dropped on the stage or chosen from a file
     input, parsed it in the browser and drew it — removed 7 Sep 2026 along with
     the drop target, the input and the parser in engine.ts. The ten built-in
     routes are what terrain mode is for now, and every one of them is measured
     at build time rather than in the visitor's browser. */

  /* ---- load on approach --------------------------------------------------- */
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    void start();
  }, { rootMargin: '600px 0px' });

  observer.observe(section);

  async function start(): Promise<void> {
    setStatus('loading', 'Drawing the map');
    try {
      const { createMapGlobe } = await import('./engine');
      /* The opening view goes in here rather than being arranged afterwards, so
         that a reader who left in terrain mode comes back to the map already
         framed. Doing it after the map exists would show the placeholder ridge
         for as long as the geometry took to arrive, and then jump.

         The manifest goes in whole, not just the route being opened: the
         overview draws all ten, and the engine cannot ask the page for them. */
      /* Terrain mode opens ON a route if the reader left inside one. So do the
         `All` tab's two mesh views, which cannot open on anything else — the
         same stored id, so a route chosen in either place is the route the
         other one arrives at. The flat views are handed it and ignore it. */
      const opening = mode === 'terrain' || terrainView() ? trail : null;
      globe = await createMapGlobe({
        host: stage!,
        labelLayer: labelLayer!,
        trips: readJson<MapTrip[]>('mapglobe-trips') ?? [],
        trails,
        mode,
        layers: active,
        content: shown,
        view,
        trail: opening,
        walkedOn: readJson<Record<string, string[]>>('mapglobe-walked-on') ?? {},
      });
      if (mode === 'terrain') {
        if (opening) showTrail(opening);
        else showAllRoutes();
      }
      section!.dataset.state = 'ready';
      setStatus('ready', '');
    } catch (error) {
      // A map that fails is not a page that fails. The timeline above it is the
      // content; both earths are illustrations of it.
      section!.dataset.state = 'failed';
      setStatus('failed', 'The map could not be drawn. The trips above are unaffected.');
      console.error('mapglobe: failed to start', error);
      return;
    }

    new MutationObserver(() => globe?.refreshTheme())
      .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }
}
