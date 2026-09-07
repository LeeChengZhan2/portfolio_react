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
import { DEFAULT_LAYERS, MAP_LAYERS, MAP_MODES, type MapLayer, type MapMode } from './modes';

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
 * Which route terrain mode is showing, under a third key for the same reason
 * the filters got a second one: a reader who picks a route, goes out to the
 * globe and comes back should find the route they left, and one combined key
 * would have to forget one choice to remember the other.
 */
const TRAIL_KEY = 'mapglobe-trail';

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
 * The route to open on. A stored id is checked against the manifest before it
 * is used, so a route deleted since the last visit falls back to the first one
 * rather than to an empty map.
 *
 * The default is `trails[0]`, and the build script's sort is what decides that
 * — hikes before runs, newest first. There is no separate "default" flag to
 * keep in step with the ordering.
 */
function storedTrail(): MapTrail | null {
  try {
    // An empty string used to be a real answer here — the reader had pressed
    // Clear — and was told apart from "nothing stored" by comparing rather than
    // by falsiness. Clear is gone (7 Sep 2026), so nothing writes one any more
    // and a stale one simply matches no route, which is already handled: an id
    // that matches nothing falls through to the default below.
    const saved = localStorage.getItem(TRAIL_KEY);
    const found = trails.find((trail) => trail.id === saved);
    if (found) return found;
  } catch {
    // Private browsing can refuse reads. Fall through to the default.
  }
  return trails[0] ?? null;
}

function rememberTrail(id: string): void {
  try {
    localStorage.setItem(TRAIL_KEY, id);
  } catch {
    // Works for this page view; just will not be remembered.
  }
}

function markSelected(mode: MapMode): void {
  for (const button of document.querySelectorAll<HTMLElement>('[data-mapglobe-mode]')) {
    button.setAttribute('aria-checked', String(button.dataset.mapglobeMode === mode));
  }
}

/** `null` unchecks every chip. Only reachable with an empty manifest now that
    Clear is gone — one of the ten is always the one being shown otherwise. */
function markTrails(id: string | null): void {
  for (const button of document.querySelectorAll<HTMLElement>('[data-mapglobe-trail]')) {
    button.setAttribute('aria-checked', String(button.dataset.mapglobeTrail === id));
  }
}

function markLayers(active: MapLayer[]): void {
  const on = new Set(active);
  for (const button of document.querySelectorAll<HTMLElement>('[data-mapglobe-layer]')) {
    const layer = button.dataset.mapglobeLayer;
    if (isLayer(layer)) button.setAttribute('aria-pressed', String(on.has(layer)));
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

function showTrackError(message: string): void {
  if (!readout) return;
  readout.dataset.state = 'error';
  readout.textContent = message;
}

if (section && stage && labelLayer) {
  let globe: MapGlobe | null = null;
  let mode = storedMode();
  let active = storedLayers();
  /** The route the picker is showing as chosen. Null only when the manifest is
      empty — otherwise one of the ten is always selected. */
  let trail: MapTrail | null = storedTrail();

  // The markup ships the defaults as selected, because a static build cannot
  // know what the visitor stored. Correct all three before any interaction.
  markSelected(mode);
  markLayers(active);
  markTrails(trail?.id ?? null);

  /* ---- switching, which works before the map has loaded ------------------- */
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;

    const modeButton = target?.closest<HTMLElement>('[data-mapglobe-mode]');
    if (modeButton && isMode(modeButton.dataset.mapglobeMode)) {
      mode = modeButton.dataset.mapglobeMode;
      markSelected(mode);
      section.dataset.mode = mode;
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        // Works for this page view; just will not be remembered.
      }

      /* Arriving in terrain mode with a route chosen but nothing drawn — the
         usual case, since the geometry is only fetched when it is needed —
         goes straight to the route. `pick` switches the mode itself, so
         setMode is the branch for everything else. Once a track IS drawn,
         applyMode fits to it rather than to the placeholder ridge. */
      if (mode === 'terrain' && trail && !drawn) void pick(trail);
      else globe?.setMode(mode);
      return;
    }

    const trailButton = target?.closest<HTMLElement>('[data-mapglobe-trail]');
    if (trailButton) {
      const found = trails.find((item) => item.id === trailButton.dataset.mapglobeTrail);
      if (found) void pick(found);
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
      markLayers(active);
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
  /** Whether anything is drawn on the map, which is not the same question as
      whether a route is selected: a route is chosen from the first paint, and
      its geometry is only fetched when terrain mode actually needs it. */
  let drawn = false;

  async function pick(next: MapTrail): Promise<void> {
    trail = next;
    markTrails(next.id);
    rememberTrail(next.id);

    // The mode follows the click. Picking a route while looking at the globe
    // means "show me this", and leaving the reader on the globe would make the
    // control look broken.
    mode = 'terrain';
    markSelected(mode);
    section!.dataset.mode = mode;

    if (!globe) return;
    try {
      await globe.loadTrail(next);
      drawn = true;
      showTrail(next);
    } catch (error) {
      drawn = false;
      showTrackError('That route could not be loaded.');
      console.error('mapglobe: loading a route failed', error);
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
      /* The route goes in here rather than being loaded afterwards, so that a
         reader who left in terrain mode comes back to the map already framed
         on it. Loading it after the map exists would show the placeholder
         ridge for as long as the geometry took to arrive, and then jump. */
      const opening = mode === 'terrain' ? trail : null;
      globe = await createMapGlobe(
        stage!,
        labelLayer!,
        readJson<MapTrip[]>('mapglobe-trips') ?? [],
        mode,
        active,
        opening,
      );
      if (opening) {
        drawn = true;
        showTrail(opening);
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
