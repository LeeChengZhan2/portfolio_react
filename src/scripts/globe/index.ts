/**
 * Page wiring for the globe on /about/travel-preview.
 *
 * Everything expensive is deferred. three.js, the engine and roughly 1.5 MB of
 * geometry are behind a dynamic import that does not fire until the stage
 * scrolls into view — the globe sits below a timeline of eight trips, so on a
 * normal visit that is several screens down, and a visitor who never scrolls
 * that far never pays for any of it. Same deferral `client:visible` gives an
 * island, without the React runtime.
 *
 * A delegated listener rather than an island, for the reasons in CLAUDE.md.
 * The switcher is five buttons and a class; the globe itself is a canvas React
 * would never touch.
 */

import type { Globe, GlobeTrip } from './engine';
// Values come from looks.ts, never from engine.ts — see the note there. A single
// static value import from the engine puts three.js in the eager bundle.
import { LOOKS, type Look } from './looks';

const STORAGE_KEY = 'globe-look';
const DEFAULT_LOOK: Look = 'dots';

const section = document.querySelector<HTMLElement>('[data-globe]');
const stage = document.querySelector<HTMLElement>('[data-globe-stage]');
const labelLayer = document.querySelector<HTMLElement>('[data-globe-labels]');
const status = document.querySelector<HTMLElement>('[data-globe-status]');

/** The trips, handed over by the page as JSON rather than re-fetched. */
function readTrips(): GlobeTrip[] {
  const node = document.querySelector<HTMLScriptElement>('#globe-trips');
  if (!node?.textContent) return [];
  try {
    return JSON.parse(node.textContent) as GlobeTrip[];
  } catch {
    return [];
  }
}

function setStatus(state: string, text: string): void {
  if (!status) return;
  status.dataset.state = state;
  status.textContent = text;
}

function isLook(value: string | null | undefined): value is Look {
  return LOOKS.includes(value as Look);
}

/** The stored choice, checked against the real list before it is trusted. */
function storedLook(): Look {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLook(saved)) return saved;
  } catch {
    // Private browsing can refuse reads. Fall through to the default.
  }
  return DEFAULT_LOOK;
}

function markSelected(look: Look): void {
  for (const button of document.querySelectorAll<HTMLElement>('[data-globe-look]')) {
    button.setAttribute('aria-checked', String(button.dataset.globeLook === look));
  }
}

if (section && stage && labelLayer) {
  let globe: Globe | null = null;
  let look = storedLook();
  let spinning = !matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The markup ships the default as checked, because a static build cannot know
  // what the visitor stored. Correct it before any interaction.
  markSelected(look);

  const spinButton = document.querySelector<HTMLElement>('[data-globe-spin]');
  spinButton?.setAttribute('aria-pressed', String(spinning));

  /* ---- switching, which works before the globe has loaded ---------------- */
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;

    const lookButton = target?.closest<HTMLElement>('[data-globe-look]');
    if (lookButton && isLook(lookButton.dataset.globeLook)) {
      look = lookButton.dataset.globeLook;
      markSelected(look);
      globe?.setLook(look);
      try {
        localStorage.setItem(STORAGE_KEY, look);
      } catch {
        // Works for this page view; just will not be remembered.
      }
      return;
    }

    const spin = target?.closest<HTMLElement>('[data-globe-spin]');
    if (spin) {
      spinning = !spinning;
      globe?.setSpin(spinning);
      spin.setAttribute('aria-pressed', String(spinning));
    }
  });

  /* ---- load on approach --------------------------------------------------- */
  /* rootMargin so the fetch starts a screen early: the data is ~1.5 MB and
     arriving mid-scroll with a blank frame is worse than arriving late. */
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    void start();
  }, { rootMargin: '600px 0px' });

  observer.observe(section);

  async function start(): Promise<void> {
    setStatus('loading', 'Drawing the earth');
    try {
      const { createGlobe } = await import('./engine');
      globe = await createGlobe(stage!, labelLayer!, readTrips(), look);
      globe.setSpin(spinning);
      section!.dataset.state = 'ready';
      setStatus('ready', '');
    } catch (error) {
      // A globe that fails is not a page that fails. The timeline above it is
      // the content; this is an illustration of it.
      section!.dataset.state = 'failed';
      setStatus('failed', 'The earth could not be drawn. The trips above are unaffected.');
      console.error('globe: failed to start', error);
      return;
    }

    /* The site's theme controls only add and remove classes on <html>, so this
       is how the globe hears about a theme change without either side knowing
       about the other. Covers dark/light and all eight light palettes. */
    new MutationObserver(() => globe?.refreshTheme())
      .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }
}
