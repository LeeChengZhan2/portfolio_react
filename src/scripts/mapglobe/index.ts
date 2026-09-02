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

import type { MapGlobe, MapTrip, TrackStats } from './engine';
// Values come from modes.ts, never from engine.ts — see the note there. A single
// static value import from the engine puts MapLibre in the eager bundle.
import { MAP_MODES, type MapMode } from './modes';

const STORAGE_KEY = 'mapglobe-mode';
const DEFAULT_MODE: MapMode = 'places';

const section = document.querySelector<HTMLElement>('[data-mapglobe]');
const stage = document.querySelector<HTMLElement>('[data-mapglobe-stage]');
const labelLayer = document.querySelector<HTMLElement>('[data-mapglobe-labels]');
const status = document.querySelector<HTMLElement>('[data-mapglobe-status]');
const readout = document.querySelector<HTMLElement>('[data-mapglobe-readout]');
const fileInput = document.querySelector<HTMLInputElement>('[data-mapglobe-file]');

/** The trips, handed over by the page as JSON rather than re-fetched. */
function readTrips(): MapTrip[] {
  const node = document.querySelector<HTMLScriptElement>('#mapglobe-trips');
  if (!node?.textContent) return [];
  try {
    return JSON.parse(node.textContent) as MapTrip[];
  } catch {
    return [];
  }
}

function setStatus(state: string, text: string): void {
  if (!status) return;
  status.dataset.state = state;
  status.textContent = text;
}

function isMode(value: string | null | undefined): value is MapMode {
  return MAP_MODES.includes(value as MapMode);
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

function markSelected(mode: MapMode): void {
  for (const button of document.querySelectorAll<HTMLElement>('[data-mapglobe-mode]')) {
    button.setAttribute('aria-checked', String(button.dataset.mapglobeMode === mode));
  }
}

/**
 * The track readout. Every figure here is computed from the visitor's own file
 * — nothing is estimated and nothing is filled in, which is why a track with no
 * elevation data reports no ascent rather than reporting zero.
 */
function showStats(stats: TrackStats): void {
  if (!readout) return;
  const parts = [
    `${stats.km.toFixed(1)} km`,
    stats.ascent === null ? null : `${stats.ascent.toLocaleString()} m ascent`,
    stats.low === null || stats.high === null
      ? null
      : `${stats.low.toLocaleString()}–${stats.high.toLocaleString()} m`,
    `${stats.points.toLocaleString()} points`,
  ].filter(Boolean);

  readout.dataset.state = 'loaded';
  readout.innerHTML = '';

  const name = document.createElement('strong');
  name.textContent = stats.name;
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

  // The markup ships the default as checked, because a static build cannot know
  // what the visitor stored. Correct it before any interaction.
  markSelected(mode);

  /* ---- switching, which works before the map has loaded ------------------- */
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;

    const modeButton = target?.closest<HTMLElement>('[data-mapglobe-mode]');
    if (modeButton && isMode(modeButton.dataset.mapglobeMode)) {
      mode = modeButton.dataset.mapglobeMode;
      markSelected(mode);
      globe?.setMode(mode);
      section.dataset.mode = mode;
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        // Works for this page view; just will not be remembered.
      }
      return;
    }

    if (target?.closest('[data-mapglobe-clear]')) {
      globe?.clearTrack();
      if (readout) {
        readout.dataset.state = 'empty';
        readout.textContent = 'No track loaded.';
      }
    }
  });

  section.dataset.mode = mode;

  /* ---- a GPX file, read in the browser and never uploaded ----------------- */
  async function take(file: File | undefined): Promise<void> {
    if (!file || !globe) return;
    try {
      showStats(await globe.loadGpx(file));
      mode = 'terrain';
      markSelected(mode);
      section!.dataset.mode = mode;
    } catch (error) {
      showTrackError(error instanceof Error ? error.message : 'That file could not be read.');
    }
  }

  fileInput?.addEventListener('change', () => {
    void take(fileInput.files?.[0]);
    // Reset so re-picking the same file fires `change` again.
    fileInput.value = '';
  });

  // Dropping onto the stage is the fast path, but the file input above is the
  // one that works from a keyboard, so both exist.
  for (const type of ['dragenter', 'dragover'] as const) {
    stage.addEventListener(type, (event) => {
      event.preventDefault();
      stage.dataset.drop = '';
    });
  }
  for (const type of ['dragleave', 'drop'] as const) {
    stage.addEventListener(type, () => delete stage.dataset.drop);
  }
  stage.addEventListener('drop', (event) => {
    event.preventDefault();
    void take(event.dataTransfer?.files?.[0]);
  });

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
      globe = await createMapGlobe(stage!, labelLayer!, readTrips(), mode);
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
