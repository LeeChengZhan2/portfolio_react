/**
 * The SHOWCASE — the redesigned frontend for the MapLibre earth, on
 * /about/travel-preview under the original section it duplicates (24 Nov 2026).
 *
 * Same engine, same data, a different frontend. Where the original asks the
 * reader to understand nine tabs and three floating panels before anything
 * happens, this one leads with three things:
 *
 *   - a TOUR — "Play the journey" flies the globe through the trips in the
 *     order they happened, one flight each, with a caption and pause /
 *     previous / next / end at every step;
 *   - a FLYOVER — any recorded trail flown in 3D: an eased follow camera over
 *     the real terrain while the line draws itself on and the profile's
 *     playhead keeps pace. Pause, speed, scrub and re-centre, after Strava,
 *     AllTrails and Komoot; any gesture on the map pauses it;
 *   - a CHRONOLOGY — one timeline that every trip and every local trail sits
 *     on, kept for the author: out of sight, with nothing on the page that
 *     says it is there, until a mouse reaches the foot of the map. Its play
 *     button is where the tour starts.
 *
 * Two views with a subject each (25 Nov 2026): the Globe is the trips — their
 * photos in the panel, one at a time, and the places on the earth — and the
 * Terrain is the trails — the engine's terrain mode, every route at once until
 * one is picked, and a wall of route outlines in the panel. The photo and the
 * tiles are the way in; the only buttons of the panel's own step and pause the
 * photos.
 *
 * Everything else is progressive: layers behind one button, a breadcrumb as
 * the way back, and the detail of a trip or a trail in one panel.
 *
 * NO DATES AND NO COUNTS where a glance lands (25 Nov 2026, author's request:
 * "no need to mention when and how many place I have been"). The headline,
 * the cards on the globe, the tour's caption and the panel name places and
 * nothing else; only the timeline, opened on purpose, is about when.
 *
 * Reduced motion is honoured throughout. Flights become cuts, the tour waits
 * for Next instead of advancing, and there is no flyover at all — the route is
 * shown framed and fully drawn, which is what the research recommends.
 */
import type { CameraState, MapGlobe, MapTrail, MapTrip } from './engine';
import type { MapContent, MapLayer, MapView } from './modes';
import type { TrailProfile } from './detail';

interface ShowcaseTrip {
  id: string;
  label: string;
  country: string | null;
  when: string;
  /** Read by the timeline's readout alone — the one place dates are shown. */
  dates: string;
  summary: string | null;
  href: string;
  /** Ids of the trails walked on this trip, in manifest order. */
  routes: string[];
}

interface ShowcaseData {
  /** Newest first — the timeline's own order. */
  trips: ShowcaseTrip[];
  /** Trip ids oldest first: the order the tour flies them in. */
  tour: string[];
  trails: MapTrail[];
  walkedOn: Record<string, string[]>;
  /** Each trail's kind — climb, hike or run — decided once in MapShowcase.astro. */
  trailKinds: Record<string, TrailKind>;
}

/** The manifest knows hikes and runs; the showcase tells a climb from a hike
    by how much it gains (25 Nov 2026). */
type TrailKind = 'climb' | 'hike' | 'run';
const KIND_ORDER: TrailKind[] = ['climb', 'hike', 'run'];

/* ---- tuning --------------------------------------------------------------- */
/** How long the tour lingers on each trip once it has arrived. */
const DWELL_MS = 4600;
/** The tour's camera: country scale, leaned back, turning a little each step.
    Each flight is held near 2.5 s — one expressive move per choice. */
const TOUR = { zoom: 4.2, pitch: 40, bearing: 14, duration: 2400 };
/** A trip picked on the globe: a little closer than the tour, leaned back
    less, so the place has its region and its coastline around it. */
const TRIP = { zoom: 4.4, pitch: 30 };
/** The flyover's follow camera. 13.1 is under the 13.5 at which the DEM's
    overzoom starts to look soft — see "The single-route fit is capped". */
const FLY = { zoom: 13.1, pitch: 62, lookAheadKm: 0.45, centreLead: 0.4 };
/** How quickly the camera's centre and heading catch up with the trail, per
    second, and the fastest it may turn. An eased camera, never one locked to
    the line: locked, every GPS wobble and switchback shakes the frame. */
const FOLLOW_RATE = 3.2;
const TURN_RATE = 1.5;
const MAX_TURN_DEG_S = 38;
const SPEEDS = [1, 2, 4];

/** The order the switches list them in, and the order the engine is handed. */
const LAYER_ORDER: MapLayer[] = ['countries', 'cities', 'relief', 'peaks', 'water'];
const CONTENT_ORDER: MapContent[] = ['trips', 'trails'];

const still = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;
const nf = (value: number, digits = 0): string =>
  value.toLocaleString('en', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const SVG = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

function html<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** "2h 53m", "49m". Compact, because it sits in a large figure cell. */
function hm(seconds: number | null): string {
  if (seconds === null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

/** The route's local clock at a point: its start time plus seconds walked. */
function clockAt(start: string, seconds: number | null): string {
  const [h, m] = start.split(':').map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || seconds === null) return start;
  const minutes = h * 60 + m + Math.floor(seconds / 60);
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** What the trail panel calls a walk: its kind, or a half marathon by name. */
const KIND_ONE: Record<TrailKind, string> = { climb: 'Climb', hike: 'Hike', run: 'Run' };
const kindLabel = (kind: TrailKind, trail: MapTrail): string =>
  kind === 'run' && trail.km >= 20 && trail.km <= 22 ? 'Half marathon' : KIND_ONE[kind];
const SHAPE: Record<MapTrail['shape'], string> = {
  loop: 'Loop',
  'out-and-back': 'Out and back',
  'point-to-point': 'Point to point',
};
/** "Johor" out of "Johor, Malaysia": the place a trail with no trip belongs to. */
const areaOf = (trail: MapTrail): string => trail.place.split(',')[0]!.trim();
/** "Chengdu, China" — what is announced when a trip is chosen. */
const placeOf = (trip: ShowcaseTrip): string => (trip.country ? `${trip.label}, ${trip.country}` : trip.label);

/* ---- geometry for the follow camera --------------------------------------- */
interface Sample {
  lon: number;
  lat: number;
  ele: number | null;
  secs: number | null;
}

const RAD = Math.PI / 180;

function bearingBetween(a: Sample, b: Sample): number {
  const y = Math.sin((b.lon - a.lon) * RAD) * Math.cos(b.lat * RAD);
  const x =
    Math.cos(a.lat * RAD) * Math.sin(b.lat * RAD) -
    Math.sin(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos((b.lon - a.lon) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** The shortest signed turn from one heading to another, in degrees. */
const turn = (from: number, to: number): number => ((to - from + 540) % 360) - 180;

/** A point a fraction of the way along the route. The profile is resampled
    evenly BY DISTANCE at build time, so a fraction of the samples is a fraction
    of the distance — no search, no cumulative sums. */
function pointAt(samples: Sample[], f: number): Sample {
  const x = clamp(f, 0, 1) * (samples.length - 1);
  const i = Math.floor(x);
  const a = samples[i]!;
  const b = samples[Math.min(samples.length - 1, i + 1)]!;
  const k = x - i;
  const mixN = (p: number | null, q: number | null): number | null =>
    p === null || q === null ? (p ?? q) : p + (q - p) * k;
  return {
    lon: a.lon + (b.lon - a.lon) * k,
    lat: a.lat + (b.lat - a.lat) * k,
    ele: mixN(a.ele, b.ele),
    secs: mixN(a.secs, b.secs),
  };
}

/* ========================================================================== */

export async function startShowcase(root: HTMLElement): Promise<void> {
  const q = <T extends Element = HTMLElement>(selector: string): T | null => root.querySelector<T>(selector);
  const qa = <T extends Element = HTMLElement>(selector: string): T[] => [...root.querySelectorAll<T>(selector)];

  const dataNode = q<HTMLScriptElement>('script[data-xp-data]');
  if (!dataNode?.textContent) throw new Error('showcase: no data');
  const data = JSON.parse(dataNode.textContent) as ShowcaseData;

  const stage = q('[data-xp-stage]')!;
  const host = q('[data-xp-map]')!;
  const labels = q('[data-xp-labels]')!;
  const status = q('[data-xp-status]');
  const hero = q('[data-xp-hero]');
  const crumbs = q('[data-xp-crumbs]');
  const sheet = q('[data-xp-sheet]')!;
  const sheetBody = q('[data-xp-sheet-body]')!;
  const grabber = q('[data-xp-grabber]');
  const caption = q('[data-xp-caption]')!;
  const hud = q('[data-xp-hud]')!;
  const live = q('[data-xp-live]');
  const progress = q('[data-xp-progress]');
  const layersPanel = q('[data-xp-layers]')!;
  const layersToggle = q<HTMLButtonElement>('[data-xp-layers-toggle]')!;
  const fullscreen = q<HTMLButtonElement>('[data-xp-fullscreen]');
  const readoutLabel = q('[data-xp-readout-label]');
  const readoutSub = q('[data-xp-readout-sub]');
  const readoutDefault = { label: readoutLabel?.textContent ?? '', sub: readoutSub?.textContent ?? '' };

  const tripById = new Map(data.trips.map((trip) => [trip.id, trip]));
  const trailById = new Map(data.trails.map((trail) => [trail.id, trail]));
  const tripOfTrail = new Map<string, ShowcaseTrip>();
  for (const trip of data.trips) for (const id of trip.routes) tripOfTrail.set(id, trip);
  const tourTrips = data.tour.map((id) => tripById.get(id)).filter((t): t is ShowcaseTrip => Boolean(t));

  /** Climb, hike or run — the build's answer, with the manifest's as a fallback. */
  const kindOf = (trail: MapTrail): TrailKind => data.trailKinds[trail.id] ?? (trail.kind === 'run' ? 'run' : 'hike');
  /** A kind's sign, as the markup draws it: CSS paints the drawing from the
      kind in `data-kind`. */
  const kindIcon = (kind: TrailKind): HTMLElement => {
    const el = html('span', 'xp-kind');
    el.dataset.kind = kind;
    el.setAttribute('aria-hidden', 'true');
    return el;
  };

  /* ---- state ------------------------------------------------------------- */
  let view: MapView = 'globe';
  /* What the map opens with is what the switches say, and MapShowcase.astro is
     the only place that says it. A list here as well would be a second answer
     to disagree with the first — and it would, on any reload where the browser
     restores a switch the reader had moved.

     RELIEF SHIPS ON (24 Nov 2026, author's request), where the original section
     opens with it off. It is the one default on this page that reaches a third
     party: the shading is drawn from Mapterhorn's elevation tiles, so they are
     asked for as soon as this map starts. */
  let layers: MapLayer[] = LAYER_ORDER.filter((id) => q<HTMLInputElement>(`[data-xp-layer="${id}"]`)?.checked);
  let content: MapContent[] = CONTENT_ORDER.filter((id) => q<HTMLInputElement>(`[data-xp-content="${id}"]`)?.checked);
  type Selection = { kind: 'trip'; trip: ShowcaseTrip } | { kind: 'trail'; trail: MapTrail } | null;
  let selection: Selection = null;
  /** The route the engine is drawing as a single track, as it reports it. */
  let subject: MapTrail | null = null;
  let activity: 'idle' | 'tour' | 'fly' = 'idle';
  /** The control that opened the panel, so closing it can hand focus back. */
  let opener: HTMLElement | null = null;
  let ready = false;

  const setActivity = (next: typeof activity): void => {
    activity = next;
    root.dataset.activity = next;
  };

  const announce = (text: string): void => {
    if (!live) return;
    live.textContent = '';
    // Emptied first so the same message twice is still read out.
    requestAnimationFrame(() => (live.textContent = text));
  };

  /* ---- the engine ---------------------------------------------------------- */
  const { createMapGlobe } = await import('./engine');
  const trips: MapTrip[] = data.trips.map(({ id, label, when, href }) => ({ id, label, when, href }));

  const map: MapGlobe = await createMapGlobe({
    host,
    labelLayer: labels,
    trips,
    trails: data.trails,
    mode: 'combined',
    layers,
    content,
    view,
    trail: null,
    walkedOn: data.walkedOn,
    tripCards: 'button',
    reserveRoot: stage,
    trailKind: kindOf,
    onSubject(next) {
      subject = next;
      if (ready) onSubject(next);
    },
  });

  /** The globe's size and place follow the stage. Calibrated against the
      engine's own home, where zoom 2.3 draws a globe about 644px across. On a
      desktop the headline floats over the left of the frame, so the sphere is
      centred in the space to its right — with PADDING, because on a globe only
      padding moves the sphere; an offset just turns the earth (see `home` in
      engine.ts). On a phone the headline sits above the map and nothing moves. */
  function homeCamera(): { zoom: number; padding: { left: number } } {
    const box = host.getBoundingClientRect();
    let left = 0;
    const heroBox = hero?.getBoundingClientRect();
    if (
      heroBox?.width &&
      root.dataset.hero !== 'hidden' &&
      heroBox.right > box.left &&
      heroBox.bottom > box.top + 40 &&
      heroBox.top < box.bottom - 40
    ) {
      left = clamp(heroBox.right - box.left + 24, 0, box.width * 0.5);
    }
    const diameter = Math.min(box.width - left, box.height) * 0.86;
    return { zoom: clamp(2.3 + Math.log2(diameter / 644), 0.4, 2.6), padding: { left } };
  }

  /** Whether the camera is carrying the home view's padding right now. */
  let padded = false;

  function goHomeCamera(animate: boolean): Promise<void> {
    const { zoom, padding } = homeCamera();
    padded = padding.left > 0;
    return map.home(animate && !still(), zoom, padding);
  }

  /** Padding off before the engine fits anything — a fit would otherwise
      frame its subject inside the padding as well as its own margins. */
  async function unpad(): Promise<void> {
    if (!padded) return;
    padded = false;
    await map.clearPadding(still() ? 0 : 450);
  }

  await goHomeCamera(false);
  ready = true;
  root.dataset.state = 'ready';
  if (status) status.textContent = '';
  arrive();

  new MutationObserver(() => map.refreshTheme()).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });

  /** The trip cards arrive one after another as the globe fades in — opacity
      and scale only, and not at all under reduced motion. */
  function arrive(): void {
    if (still()) return;
    qa('[data-mapglobe-trip]').forEach((el, i) => (el.style.animationDelay = `${0.35 + i * 0.09}s`));
    host.classList.add('xp-arriving');
    setTimeout(() => host.classList.remove('xp-arriving'), 2600);
  }

  /* ---- the reel ------------------------------------------------------------ */
  /* The Globe view's panel shows the trips' photos one at a time (26 Nov 2026,
     author's request: "show only 1 or few frame at 1 time and use animation
     to swap it"). The photo showing drifts slowly closer and gives way to the
     next on its own, and pointing at a trip's card on the globe brings that
     trip's photo up (in spot(), below).

     The timing is CSS. Each slide carries a thin bar whose animation is the
     dwell, and its `animationend` is what turns to the next photo, so there
     is no timer here to fall out of step with what is drawn. Playing is one
     attribute: without `data-playing` the bar and the drift both stop where
     they are, and pick up from there.

     Everything that stops it is a reason in `holds`, and it plays only while
     there is none: the reader's own pause, a pointer on it, keyboard focus in
     it, a trip's panel open, the Terrain view, the stage off screen, a hidden
     tab, or a card on the globe being pointed at.

     WCAG 2.2.2: it starts by itself and runs longer than five seconds, so it
     has a pause button as well as stopping for hover and focus. Under reduced
     motion it never moves on its own; the arrows step it. */
  const reel = q('[data-xp-reel]');
  const slides = qa<HTMLElement>('[data-xp-slide]');
  const reelPause = q<HTMLButtonElement>('[data-xp-reel-pause]');
  type Hold = 'reader' | 'pointer' | 'focus' | 'hero' | 'view' | 'screen' | 'tab' | 'card';
  const holds = new Set<Hold>();
  let slideAt = Math.max(
    0,
    slides.findIndex((slide) => slide.hasAttribute('data-active')),
  );

  function markReel(): void {
    if (!reel) return;
    reel.toggleAttribute('data-playing', holds.size === 0 && slides.length > 1 && !still());
    const paused = holds.has('reader');
    reel.toggleAttribute('data-reader-paused', paused);
    reelPause?.setAttribute('aria-pressed', String(paused));
    reelPause?.setAttribute('aria-label', paused ? 'Play the photos' : 'Pause the photos');
  }

  function hold(reason: Hold, on: boolean): void {
    if (on === holds.has(reason)) return;
    if (on) holds.add(reason);
    else holds.delete(reason);
    markReel();
  }

  /** Turn to a slide, and start its dwell and its drift from the beginning. */
  function showSlide(index: number): void {
    if (!slides.length) return;
    slideAt = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      slide.toggleAttribute('data-active', i === slideAt);
      slide.inert = i !== slideAt;
    });
    for (const animation of slides[slideAt]!.getAnimations({ subtree: true })) {
      if (animation instanceof CSSAnimation && animation.animationName.startsWith('xp-reel-')) {
        animation.currentTime = 0;
      }
    }
  }

  /** The slide for the first of these trips that has one. */
  const slideOf = (ids: Iterable<string>): number => {
    const wanted = new Set(ids);
    return slides.findIndex((slide) => wanted.has(slide.dataset.xpSlide ?? ''));
  };

  if (reel) {
    reel.addEventListener('animationend', (event) => {
      if (event.animationName === 'xp-reel-dwell' && slides[slideAt]?.contains(event.target as Node)) {
        showSlide(slideAt + 1);
      }
    });
    reel.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const step = target.closest<HTMLElement>('[data-xp-reel-step]');
      if (step) {
        showSlide(slideAt + Number(step.dataset.xpReelStep));
        const trip = tripById.get(slides[slideAt]?.dataset.xpSlide ?? '');
        if (trip) announce(placeOf(trip));
        return;
      }
      if (target.closest('[data-xp-reel-pause]')) hold('reader', !holds.has('reader'));
    });
    // A mouse or a pen resting on it. A tap is a click, and over at once.
    reel.addEventListener('pointerenter', (event) => hold('pointer', event.pointerType !== 'touch'));
    reel.addEventListener('pointerleave', () => hold('pointer', false));
    // Keyboard focus, and only that: a mouse click leaves focus on a button,
    // and the reel would otherwise stay stopped after the pointer had gone.
    reel.addEventListener('focusin', (event) => hold('focus', (event.target as HTMLElement).matches(':focus-visible')));
    reel.addEventListener('focusout', (event) => {
      if (!reel.contains(event.relatedTarget as Node | null)) hold('focus', false);
    });
    document.addEventListener('visibilitychange', () => hold('tab', document.hidden));
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', markReel);
  }

  /* ---- hero and breadcrumb -------------------------------------------------- */
  function setHero(visible: boolean): void {
    if (!hero) return;
    root.dataset.hero = visible ? 'shown' : 'hidden';
    hold('hero', !visible);
    // The engine keeps cards and camera fits clear of reserved boxes, and a
    // hidden headline must stop costing the map its corner.
    hero.toggleAttribute('data-mapglobe-reserve', visible);
    // A panel put away under the pointer gets no pointerout until the mouse
    // next moves, and the card it lit would stay lit through the flight.
    spot(null);
    renderCrumbs();
  }

  /* ---- one place, two marks ------------------------------------------------- */
  /* A tile and the place's card on the map are the same trip or trail, so
     each lights the other (25 Nov 2026). Pointing at a tile lights its card
     and lets the other cards fall back, which says where it is on the globe
     without reading a card; pointing at a card lights its tile. CSS draws all
     of it from the `xp-lit` class, and `xp-spotting` on the map for the
     fallback.

     A card names what it stands for by id: its own `data-mapglobe-trip` or
     `-trail`, or, for an area or merged card, `data-mapglobe-members`. */
  const memories = qa<HTMLElement>('[data-xp-hero] [data-xp-trip], [data-xp-hero] [data-xp-trail]');
  const memoryIds = (el: HTMLElement): string[] => {
    const own = el.dataset.xpTrip ?? el.dataset.xpTrail ?? el.dataset.mapglobeTrip ?? el.dataset.mapglobeTrail;
    return own ? [own] : (el.dataset.mapglobeMembers ?? '').split(' ').filter(Boolean);
  };
  const memoryAt = (target: EventTarget | null): HTMLElement | null =>
    target instanceof Element
      ? target.closest<HTMLElement>(
          '[data-xp-hero] [data-xp-trip], [data-xp-hero] [data-xp-trail], [data-xp-map] .mapglobe__label',
        )
      : null;

  let lit: HTMLElement[] = [];
  let litFrom: HTMLElement | null = null;
  function spot(from: HTMLElement | null): void {
    if (from === litFrom) return;
    litFrom = from;
    for (const el of lit) el.classList.remove('xp-lit');
    host.classList.remove('xp-spotting');
    lit = [];
    if (!from || hero?.contains(from)) hold('card', false);
    if (!from) return;
    const ids = new Set(memoryIds(from));
    const hit = (el: HTMLElement): boolean => memoryIds(el).some((id) => ids.has(id));
    if (hero?.contains(from)) {
      // Only a card the reader can see. One the engine has hidden — merged
      // into another, decluttered, or round the back of the globe — lit while
      // every other card falls back would point at nothing.
      lit = [...host.querySelectorAll<HTMLElement>('.mapglobe__label')].filter(
        (card) => card.style.visibility !== 'hidden' && card.style.opacity !== '0' && hit(card),
      );
      if (lit.length) host.classList.add('xp-spotting');
    } else {
      // A trip's card brings its photo up in the reel and holds it there for
      // as long as it is pointed at. A trail's card has no photo, and the reel
      // carries on. Only while the reel is out, though: with a trip's panel
      // open the globe flies, cards slide under a pointer that never moved,
      // and each would turn the hidden reel — taking the photo that opened the
      // panel, where Escape hands focus back, out from under the focus.
      const at = root.dataset.hero === 'hidden' ? -1 : slideOf(ids);
      if (at >= 0 && at !== slideAt) showSlide(at);
      hold('card', at >= 0);
      lit = memories.filter(hit);
    }
    for (const el of lit) el.classList.add('xp-lit');
  }

  // A mouse or a pen. A tap is a click, which selects; lit on pointerover and
  // cleared on the pointerout that follows every tap, it would only flash.
  root.addEventListener('pointerover', (event) => {
    if (event.pointerType !== 'touch') spot(memoryAt(event.target));
  });
  root.addEventListener('pointerout', (event) => {
    if (!memoryAt(event.relatedTarget)) spot(null);
  });
  root.addEventListener('focusin', (event) => spot(memoryAt(event.target)));
  root.addEventListener('focusout', (event) => {
    if (!memoryAt(event.relatedTarget)) spot(null);
  });

  /** "Earth › Chengdu" on the globe, "All trails › Changping Valley ›
      Lamasi – Muluozi" on the terrain. The first crumb is the way back to the
      view's own overview — built from the same attribute the Home button uses,
      so the one click handler below serves both. */
  function renderCrumbs(): void {
    if (!crumbs) return;
    if (!selection || activity === 'tour') {
      crumbs.hidden = true;
      return;
    }
    const list = html('ol');
    const add = (label: string, attrs: Record<string, string> | null, current = false): void => {
      const li = html('li');
      const el = attrs ? html('button', 'xp-crumb', label) : html('span', 'xp-crumb', label);
      if (attrs) {
        (el as HTMLButtonElement).type = 'button';
        for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      }
      if (current) el.setAttribute('aria-current', 'location');
      li.append(el);
      list.append(li);
    };
    add(view === 'survey' ? 'All trails' : 'Earth', { 'data-xp-home': '' });
    if (selection.kind === 'trip') {
      add(selection.trip.label, null, true);
    } else {
      // Trails are only ever open on the terrain, which knows them by area;
      // the trip a walk belongs to is the panel's "Part of" button.
      add(areaOf(selection.trail), null);
      add(selection.trail.label, null, true);
    }
    crumbs.replaceChildren(list);
    crumbs.hidden = false;
  }

  /* ---- chronology ---------------------------------------------------------- */
  const ticks = qa<HTMLButtonElement>('[data-xp-tick]');
  const dock = q('[data-xp-dock]');

  /* The timeline is the author's own index, not a control for visitors
     (25 Nov 2026): nothing on screen says it is there. A mouse at the foot of
     the map wakes it and it folds when the mouse leaves it; touch and the
     keyboard never meet it, and lose nothing, since every trip is also a card
     on the map and a photo in the panel, and every trail a card and a tile.

     Decided here from the pointer rather than by an invisible strip in CSS, so
     nothing sits over the foot of the map catching the clicks and drags meant
     for it, or over the map's credit in the corner. */
  const FOOT_PX = 24;
  let foldTimer = 0;
  function showChrono(open: boolean): void {
    window.clearTimeout(foldTimer);
    if (open) {
      root.dataset.chrono = 'open';
      return;
    }
    if (root.dataset.chrono !== 'open') return;
    // A beat before folding, so a pointer that slips off the edge for a
    // moment does not snap it shut.
    foldTimer = window.setTimeout(() => (root.dataset.chrono = 'closed'), 280);
  }
  stage.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    // Not mid-drag, and not while a tour or a flight has the foot of the map.
    if (event.buttons || activity !== 'idle') return showChrono(false);
    const onDock = Boolean(dock?.contains(event.target as Node));
    showChrono(onDock || event.clientY >= stage.getBoundingClientRect().bottom - FOOT_PX);
  });
  stage.addEventListener('pointerleave', () => showChrono(false));

  /** One tab stop for the whole timeline; arrows move along it. */
  function focusTick(index: number): void {
    const next = ticks[clamp(index, 0, ticks.length - 1)];
    if (!next) return;
    for (const tick of ticks) tick.tabIndex = tick === next ? 0 : -1;
    next.focus();
    next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function markTick(id: string | null): void {
    for (const tick of ticks) {
      const on = id !== null && (tick.dataset.xpTrip === id || tick.dataset.xpTrail === id);
      if (on) {
        tick.setAttribute('aria-current', 'true');
        for (const other of ticks) other.tabIndex = other === tick ? 0 : -1;
      } else {
        tick.removeAttribute('aria-current');
      }
    }
    // Its tile or photo too: put away on a desktop while a panel is open, but
    // on a phone the panel stays above the map and should say which.
    for (const memory of memories) {
      if (id !== null && memoryIds(memory)[0] === id) memory.setAttribute('aria-current', 'true');
      else memory.removeAttribute('aria-current');
    }
    restoreReadout();
  }

  /** The tour's progress, drawn as the accent filling the axis up to a trip. */
  function setProgress(id: string | null): void {
    if (!progress) return;
    const tick = id ? ticks.find((t) => t.dataset.xpTrip === id) : null;
    progress.style.setProperty('--xp-progress', tick ? `${tick.dataset.pct}%` : '0%');
  }

  /* The readout: a fixed line beside the timeline that names whatever is
     under the pointer or the focus, and otherwise what is selected. A fixed
     note rather than a tooltip, so it works on a phone, which has no hover. */
  function setReadout(label: string, sub: string): void {
    if (readoutLabel) readoutLabel.textContent = label;
    if (readoutSub) readoutSub.textContent = sub;
  }

  function restoreReadout(): void {
    if (activity === 'tour') {
      const trip = tourTrips[tourIndex];
      if (trip) return setReadout(trip.label, trip.dates);
    }
    if (selection?.kind === 'trip') return setReadout(selection.trip.label, selection.trip.dates);
    if (selection?.kind === 'trail') {
      return setReadout(selection.trail.label, `${selection.trail.when} · ${nf(selection.trail.km, 1)} km`);
    }
    setReadout(readoutDefault.label, readoutDefault.sub);
  }

  const tickOf = (event: Event): HTMLButtonElement | null =>
    (event.target as HTMLElement).closest<HTMLButtonElement>('[data-xp-tick]');
  const showTick = (tick: HTMLButtonElement | null): void => {
    if (tick) setReadout(tick.dataset.label ?? '', tick.dataset.sub ?? '');
  };
  root.addEventListener('pointerover', (event) => showTick(tickOf(event)));
  root.addEventListener('focusin', (event) => showTick(tickOf(event)));
  root.addEventListener('pointerout', (event) => {
    const tick = tickOf(event);
    if (tick && !tick.contains(event.relatedTarget as Node | null)) restoreReadout();
  });
  root.addEventListener('focusout', (event) => {
    if (tickOf(event)) restoreReadout();
  });

  /* ---- the panel ----------------------------------------------------------- */
  const DETENTS = ['peek', 'half', 'full'] as const;
  function setDetent(detent: (typeof DETENTS)[number]): void {
    sheet.dataset.detent = detent;
    grabber?.setAttribute('aria-label', detent === 'full' ? 'Show less of the panel' : 'Show more of the panel');
  }

  function openSheet(focus: boolean): void {
    if (sheet.hidden) setDetent('peek');
    sheet.hidden = false;
    root.dataset.sheet = 'open';
    setHero(false);
    if (focus) sheet.querySelector<HTMLElement>('[data-xp-sheet-title]')?.focus();
  }

  function closeSheet(restoreFocus = false): void {
    if (activity === 'fly') stopFlight(false);
    sheet.hidden = true;
    root.dataset.sheet = 'closed';
    selection = null;
    chart = null;
    markTick(null);
    map.setProbe(null);
    if (activity === 'idle') setHero(true);
    else renderCrumbs();
    if (restoreFocus) opener?.focus();
    opener = null;
  }

  /** Where an open panel or caption covers the frame, the offset that puts a
      place beside it instead: left of a panel docked on the right, above one
      along the bottom. Apple's rule — keep the place visible when a card opens. */
  function clearOf(el: HTMLElement): [number, number] {
    if (el.hidden) return [0, 0];
    const box = el.getBoundingClientRect();
    const frame = host.getBoundingClientRect();
    if (!box.width || !box.height) return [0, 0];
    if (box.height > box.width) return [-Math.min(box.width, frame.width / 2) / 2, 0];
    return [0, -Math.min(box.height, frame.height / 2) / 2];
  }

  /** An empty eyebrow or meta line is left out rather than drawn as a gap. */
  function sheetHead(eyebrow: string, title: string, meta = ''): HTMLElement[] {
    const heading = html('h3', 'xp-sheet__title', title);
    heading.id = 'xp-sheet-title';
    heading.tabIndex = -1;
    heading.dataset.xpSheetTitle = '';
    return [
      ...(eyebrow ? [html('p', 'xp-sheet__eyebrow', eyebrow)] : []),
      heading,
      ...(meta ? [html('p', 'xp-sheet__meta', meta)] : []),
    ];
  }

  function trailRow(trail: MapTrail): HTMLLIElement {
    const li = html('li');
    const button = html('button', 'xp-route');
    button.type = 'button';
    button.dataset.xpTrail = trail.id;
    const meta = [`${nf(trail.km, 1)} km`, trail.ascent === null ? null : `↑ ${nf(trail.ascent)} m`]
      .filter(Boolean)
      .join(' · ');
    const arrow = html('span', 'xp-route__go', '→');
    arrow.setAttribute('aria-hidden', 'true');
    const name = html('span', 'xp-route__name', trail.label);
    name.prepend(kindIcon(kindOf(trail)));
    button.append(name, html('span', 'xp-route__meta', meta), arrow);
    li.append(button);
    return li;
  }

  /* The place, what it was like, and the walks taken there — no dates, no
     length of stay and no tally (25 Nov 2026, author's request). */
  function renderTrip(trip: ShowcaseTrip): void {
    const nodes: Node[] = sheetHead(trip.country ?? '', trip.label);
    if (trip.summary) nodes.push(html('p', 'xp-sheet__text', trip.summary));

    const walked = trip.routes.map((id) => trailById.get(id)).filter((t): t is MapTrail => Boolean(t));
    if (walked.length) {
      const block = html('div', 'xp-sheet__block');
      const label = walked.length === 1 ? 'Trail walked here' : 'Trails walked here';
      const list = html('ul', 'xp-routes');
      list.append(...walked.map(trailRow));
      block.append(html('p', 'xp-sheet__label', label), list);
      nodes.push(block);
    }

    const actions = html('div', 'xp-sheet__actions');
    const link = html('a', 'xp-btn xp-btn--ghost', 'Read the trip');
    link.href = trip.href;
    const arrow = html('span', 'xp-btn__arrow', '→');
    arrow.setAttribute('aria-hidden', 'true');
    link.append(arrow);
    actions.append(link);
    nodes.push(actions);
    sheetBody.replaceChildren(...nodes);
  }

  function renderTrail(trail: MapTrail): void {
    const trip = tripOfTrail.get(trail.id);
    const kind = kindOf(trail);
    const head = sheetHead(`${kindLabel(kind, trail)} · ${trail.place}`, trail.label, SHAPE[trail.shape]);
    head[0]!.prepend(kindIcon(kind));
    const nodes: Node[] = head;

    const list = html('dl', 'xp-figures');
    const add = (label: string, value: string, unit = ''): void => {
      const cell = html('div', 'xp-figures__cell');
      const dd = html('dd', '', value);
      if (unit) dd.append(html('span', 'xp-figures__unit', unit));
      cell.append(html('dt', '', label), dd);
      list.append(cell);
    };
    add('Distance', nf(trail.km, 1), 'km');
    add('Climb', trail.ascent === null ? '—' : nf(trail.ascent), trail.ascent === null ? '' : 'm');
    add('High point', trail.high === null ? '—' : nf(trail.high), trail.high === null ? '' : 'm');
    add('Moving', hm(trail.moving));
    nodes.push(list);

    const plot = html('div', 'xp-plot');
    plot.dataset.xpPlot = '';
    plot.append(html('p', 'xp-plot__wait', 'Reading the elevation profile…'));
    nodes.push(plot);

    const actions = html('div', 'xp-sheet__actions');
    if (!still()) {
      const fly = html('button', 'xp-btn xp-btn--primary');
      fly.type = 'button';
      fly.dataset.xpFly = trail.id;
      fly.append(icon('play'), html('span', '', 'Fly this trail in 3D'));
      actions.append(fly);
    }
    if (trip) {
      const back = html('button', 'xp-btn xp-btn--ghost', `Part of ${trip.label}`);
      back.type = 'button';
      back.dataset.xpTrip = trip.id;
      actions.append(back);
    }
    nodes.push(actions);
    if (still()) {
      nodes.push(html('p', 'xp-sheet__note', 'The 3D flyover is off because your device asks for reduced motion.'));
    }
    sheetBody.replaceChildren(...nodes);
  }

  function icon(name: 'play' | 'pause'): SVGSVGElement {
    const el = svg('svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true', class: 'xp-icon' });
    el.append(
      svg('path', {
        d: name === 'play' ? 'M4.5 2.8v10.4L13 8 4.5 2.8Z' : 'M4.5 3h2.6v10H4.5zM8.9 3h2.6v10H8.9z',
        class: 'xp-icon__fill',
      }),
    );
    return el;
  }

  /* ---- the elevation profile ----------------------------------------------- */
  interface Chart {
    trail: MapTrail;
    setPlayhead(f: number | null): void;
  }
  let chart: Chart | null = null;

  const profileCache = new Map<string, Promise<Sample[] | null>>();
  function samplesFor(trail: MapTrail): Promise<Sample[] | null> {
    let pending = profileCache.get(trail.id);
    if (!pending) {
      pending = import('./detail')
        .then(({ loadProfile }) => loadProfile(trail.id))
        .then((profile: TrailProfile) => {
          let lastEle: number | null = null;
          return profile.samples.map(([lon, lat, ele, secs]) => {
            lastEle = ele ?? lastEle;
            return { lon, lat, ele: lastEle, secs };
          });
        })
        .catch((error: unknown) => {
          console.error('showcase: reading a profile failed', error);
          profileCache.delete(trail.id);
          return null;
        });
      profileCache.set(trail.id, pending);
    }
    return pending;
  }

  async function drawChart(trail: MapTrail): Promise<void> {
    const samples = await samplesFor(trail);
    const plot = sheet.querySelector<HTMLElement>('[data-xp-plot]');
    if (!plot || selection?.kind !== 'trail' || selection.trail.id !== trail.id) return;
    if (!samples || samples.length < 2) {
      plot.replaceChildren(html('p', 'xp-plot__wait', 'The profile could not be read.'));
      return;
    }

    const W = 320;
    const H = 96;
    const eles = samples.map((s) => s.ele ?? 0);
    const top = Math.max(...eles);
    let lo = Math.min(...eles);
    let hi = top;
    const pad = Math.max(8, (hi - lo) * 0.12);
    lo -= pad;
    hi += pad;
    const x = (i: number): number => (i / (samples.length - 1)) * W;
    const y = (e: number): number => H - ((e - lo) / (hi - lo)) * H;
    const line = samples.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(s.ele ?? lo).toFixed(1)}`).join('');
    const area = `${line}L${W} ${H}L0 ${H}Z`;

    const box = html('div', 'xp-plot__box');
    const chartSvg = svg('svg', {
      viewBox: `0 0 ${W} ${H}`,
      preserveAspectRatio: 'none',
      class: 'xp-plot__svg',
      'aria-hidden': 'true',
    });
    // Colours are CSS classes, never presentation attributes: var() in an SVG
    // attribute fails to parse and paints black (see "Styling" in CLAUDE.md).
    const gradientId = `xp-grad-${trail.id}`;
    const clipId = `xp-clip-${trail.id}`;
    const defs = svg('defs');
    const gradient = svg('linearGradient', { id: gradientId, x1: 0, y1: 0, x2: 0, y2: 1 });
    gradient.append(
      svg('stop', { offset: '0', class: 'xp-plot__stop-top' }),
      svg('stop', { offset: '1', class: 'xp-plot__stop-bottom' }),
    );
    const clip = svg('clipPath', { id: clipId });
    const clipRect = svg('rect', { x: 0, y: 0, width: 0, height: H });
    clip.append(clipRect);
    defs.append(gradient, clip);
    chartSvg.append(
      defs,
      svg('path', { d: area, class: 'xp-plot__area', fill: `url(#${gradientId})` }),
      svg('path', { d: area, class: 'xp-plot__done', 'clip-path': `url(#${clipId})` }),
      svg('path', { d: line, class: 'xp-plot__line' }),
    );

    // HTML for everything that must keep its shape while the viewBox stretches.
    const peak = eles.indexOf(top);
    const peakMark = html('span', 'xp-plot__peak');
    peakMark.style.left = `${(peak / (samples.length - 1)) * 100}%`;
    peakMark.style.top = `${(y(top) / H) * 100}%`;
    const cursor = html('span', 'xp-plot__cursor');
    const dot = html('span', 'xp-plot__dot');
    const tip = html('span', 'xp-plot__tip');
    box.append(chartSvg, peakMark, cursor, dot, tip);

    const axis = html('div', 'xp-plot__axis');
    axis.append(html('span', '', '0 km'), html('span', '', `High ${nf(top)} m`), html('span', '', `${nf(trail.km, 1)} km`));

    box.tabIndex = 0;
    box.setAttribute('role', 'slider');
    box.setAttribute('aria-label', `Elevation profile of ${trail.label}`);
    box.setAttribute('aria-valuemin', '0');
    box.setAttribute('aria-valuemax', String(trail.km));
    plot.replaceChildren(box, axis);

    const place = (f: number | null): void => {
      for (const node of [cursor, dot, tip]) node.style.visibility = f === null ? 'hidden' : 'visible';
      if (f === null) return;
      const p = pointAt(samples, f);
      const left = `${f * 100}%`;
      cursor.style.left = left;
      dot.style.left = left;
      dot.style.top = `${(y(p.ele ?? lo) / H) * 100}%`;
      tip.style.left = left;
      tip.textContent = `${nf(f * trail.km, 1)} km · ${p.ele === null ? '—' : nf(p.ele)} m`;
    };

    let cursorAt: number | null = null;
    const setCursor = (f: number | null): void => {
      cursorAt = f;
      place(f);
      if (f !== null) {
        box.setAttribute('aria-valuenow', (f * trail.km).toFixed(1));
        box.setAttribute('aria-valuetext', tip.textContent ?? '');
      }
      const p = f === null ? null : pointAt(samples, f);
      if (activity !== 'fly') map.setProbe(p ? [p.lon, p.lat] : null);
    };

    const fraction = (event: PointerEvent): number => {
      const r = box.getBoundingClientRect();
      return clamp((event.clientX - r.left) / r.width, 0, 1);
    };
    box.addEventListener('pointermove', (event) => {
      if (activity !== 'fly') setCursor(fraction(event));
    });
    box.addEventListener('pointerleave', () => {
      if (activity !== 'fly') setCursor(null);
    });
    // During a flyover the profile is a scrubber as well as a readout.
    box.addEventListener('pointerdown', (event) => {
      if (activity === 'fly' && flight) flight.seek(fraction(event));
    });
    box.addEventListener('keydown', (event) => {
      const step = event.shiftKey ? 0.1 : 0.01;
      const at = cursorAt ?? 0;
      const next: Record<string, number> = {
        ArrowRight: at + step,
        ArrowUp: at + step,
        ArrowLeft: at - step,
        ArrowDown: at - step,
        Home: 0,
        End: 1,
      };
      if (!(event.key in next)) return;
      event.preventDefault();
      setCursor(clamp(next[event.key]!, 0, 1));
    });
    box.addEventListener('blur', () => {
      if (activity !== 'fly') setCursor(null);
    });

    chart = {
      trail,
      setPlayhead(f) {
        clipRect.setAttribute('width', String((f ?? 0) * W));
        place(f);
      },
    };
  }

  /* ---- selecting things ---------------------------------------------------- */
  function interrupt(): void {
    if (activity === 'tour') endTour(false);
    if (activity === 'fly') stopFlight(false);
  }

  function selectTrip(trip: ShowcaseTrip, keyboard: boolean): void {
    interrupt();
    // Trips live on the globe. Chosen from the terrain — a trail's "Part of"
    // button, or the timeline — the view goes back to it first.
    if (view !== 'globe') toGlobe(false);
    selection = { kind: 'trip', trip };
    renderTrip(trip);
    openSheet(keyboard);
    markTick(trip.id);
    // Its photo, for when the panel is put away again — and on a phone at
    // once, where the reel stays above the map.
    const at = slideOf([trip.id]);
    if (at >= 0 && at !== slideAt) showSlide(at);
    renderCrumbs();
    map.setProbe(null);
    announce(placeOf(trip));
    padded = false; // flyToTrip clears the padding as it flies
    void map.flyToTrip(trip.id, {
      zoom: TRIP.zoom,
      pitch: still() ? 0 : TRIP.pitch,
      offset: clearOf(sheet),
      duration: still() ? 0 : 2200,
    });
  }

  function selectTrail(trail: MapTrail, keyboard: boolean): void {
    interrupt();
    // The view first, so the panel and its breadcrumb are built for the
    // terrain the trail is about to be shown on — built before, a trail picked
    // from a trip on the globe was crumbed "Earth › …".
    const arriving = view !== 'survey';
    if (arriving) toTerrain(trail);
    selection = { kind: 'trail', trail };
    renderTrail(trail);
    openSheet(keyboard);
    markTick(trail.id);
    renderCrumbs();
    announce(`${trail.label}, ${kindLabel(kindOf(trail), trail).toLowerCase()}, ${nf(trail.km, 1)} km`);
    void drawChart(trail);
    if (!arriving && subject?.id !== trail.id) void map.loadTrail(trail, !still());
  }

  /** The panel follows what the engine draws. It no longer picks a route by
      itself — the terrain opens on all of them — so this is a guard now. */
  function onSubject(next: MapTrail | null): void {
    if (activity === 'fly') return;
    if (next && !(selection?.kind === 'trail' && selection.trail.id === next.id)) {
      selection = { kind: 'trail', trail: next };
      renderTrail(next);
      openSheet(false);
      markTick(next.id);
      renderCrumbs();
      void drawChart(next);
    }
  }

  /* ---- view and layers ----------------------------------------------------- */
  /* `data-view` on the section is what swaps the panel's two faces and hides
     the layers button on the terrain, where nothing it governs is drawn. */
  function markView(): void {
    for (const button of qa('[data-xp-view]')) {
      button.setAttribute('aria-checked', String(button.dataset.xpView === view));
      button.tabIndex = button.dataset.xpView === view ? 0 : -1;
    }
    root.dataset.view = view;
    // The trips' photos are the Globe's face; on the Terrain they are put away.
    hold('view', view !== 'globe');
    const home = q('.xp-controls [data-xp-home]');
    const label = view === 'survey' ? 'Back to all trails' : 'Back to the whole globe';
    home?.setAttribute('aria-label', label);
    home?.setAttribute('title', label);
    // One button, two popovers: the Globe's layers, or the Terrain's filter.
    const filter = view === 'survey' ? 'Filter trails' : 'Map layers';
    layersToggle.setAttribute('aria-label', filter);
    layersToggle.setAttribute('title', filter);
  }

  /* TWO VIEWS, TWO SUBJECTS (25 Nov 2026, author's request). The Globe view is
     the engine's `combined` mode on its flat globe — the trips. The Terrain
     view is its terrain MODE — the trails and nothing else, every one of them
     on arrival: "dont jump to a specific trail when switch to terrain, I want
     a global view". It used to be `combined`'s own Terrain view, which needs a
     route to stand on and so opened on one the reader never picked. */

  /** Back to the trips. `home` flies to this stage's own globe home; callers
      that fly somewhere themselves — a trip, the tour — pass false. */
  function toGlobe(home: boolean): void {
    view = 'globe';
    markView();
    setLayersOpen(false);
    // The globe shows every route; the filter is the terrain's.
    map.setTrailFilter(null);
    map.setMode('combined');
    // The engine flies to its own desktop home; this replaces that flight
    // with one sized for the stage the reader actually has.
    if (home) void goHomeCamera(true);
  }

  /** On to the trails: all of them, or straight down onto one when the reader
      picked it — never onto one they did not pick. */
  function toTerrain(trail?: MapTrail): void {
    view = 'survey';
    markView();
    setLayersOpen(false);
    map.setTrailFilter(shownTrails());
    void unpad().then(() => (trail ? map.loadTrail(trail, !still()) : map.showAllTrails(!still())));
  }

  function chooseView(next: MapView): void {
    if (next === view) return;
    interrupt();
    // A panel belongs to the view it was opened in; the other view starts at
    // its own overview.
    if (selection) closeSheet();
    setHero(true);
    if (next === 'globe') toGlobe(true);
    else toTerrain();
  }

  /* THE TERRAIN FILTER (25 Nov 2026, author's request). Which kinds of walk are
     on the terrain: the same switches decide the routes on the map — through
     the engine, which re-groups what is left — and the rows of the panel. It
     belongs to the terrain alone: the globe is about the trips, so leaving for
     it hands the engine every route back, and coming back re-applies it. */
  const kindInputs = qa<HTMLInputElement>('input[data-xp-kind]');
  const kinds = new Set<TrailKind>(
    KIND_ORDER.filter((kind) => kindInputs.find((input) => input.dataset.xpKind === kind)?.checked ?? true),
  );
  const shownTrails = (): string[] => data.trails.filter((trail) => kinds.has(kindOf(trail))).map((trail) => trail.id);

  /** `reframe` is for a switch the reader moved: on the overview, the camera
      then frames what is shown, so "climbs only" closes in on them and
      switching the rest back on brings the whole collection back into frame.
      With a trail open the camera is the trail's, and stays. */
  function applyKinds(reframe = false): void {
    for (const group of qa('[data-xp-kind-group]')) group.hidden = !kinds.has(group.dataset.xpKindGroup as TrailKind);
    // The last kind left on cannot be switched off: an empty map reads as a
    // broken one, not as a choice.
    for (const input of kindInputs) input.disabled = input.checked && kinds.size === 1;
    if (view !== 'survey') return;
    map.setTrailFilter(shownTrails());
    if (reframe && !selection && activity === 'idle') void map.showAllTrails(!still());
  }

  function setLayersOpen(open: boolean, focus = false): void {
    layersPanel.hidden = !open;
    layersToggle.setAttribute('aria-expanded', String(open));
    if (open && focus) layersPanel.querySelector<HTMLElement>('input')?.focus();
    if (!open && focus) layersToggle.focus();
  }

  root.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    if (input.dataset.xpLayer) {
      const set = new Set(layers);
      if (input.checked) set.add(input.dataset.xpLayer as MapLayer);
      else set.delete(input.dataset.xpLayer as MapLayer);
      layers = LAYER_ORDER.filter((id) => set.has(id));
      map.setLayers(layers);
    } else if (input.dataset.xpKind) {
      const kind = input.dataset.xpKind as TrailKind;
      if (input.checked) kinds.add(kind);
      else kinds.delete(kind);
      applyKinds(true);
    } else if (input.dataset.xpContent) {
      const set = new Set(content);
      if (input.checked) set.add(input.dataset.xpContent as MapContent);
      else set.delete(input.dataset.xpContent as MapContent);
      content = CONTENT_ORDER.filter((id) => set.has(id));
      map.setContent(content);
    }
  });

  /** Home is the current view's own overview: the whole globe, or all the
      trails. Changing view is the switch's job. */
  function goHome(): void {
    interrupt();
    if (selection) closeSheet();
    setHero(true);
    if (view === 'survey') void unpad().then(() => map.showAllTrails(!still()));
    else void goHomeCamera(true);
  }

  /* ---- the tour ------------------------------------------------------------ */
  let tourToken = 0;
  let tourIndex = 0;
  let tourPaused = false;
  const captionPlace = q('[data-xp-caption-place]');
  const captionTitle = q('[data-xp-caption-title]');
  const captionText = q('[data-xp-caption-text]');
  const captionBar = q('[data-xp-caption-bar]');

  function markPaused(): void {
    for (const button of qa('[data-xp-tour-pause]')) {
      button.setAttribute('aria-pressed', String(tourPaused));
      button.setAttribute('aria-label', tourPaused ? 'Resume the journey' : 'Pause the journey');
    }
    for (const button of qa('.xp-play')) {
      button.setAttribute(
        'aria-label',
        activity !== 'tour' ? 'Play the journey' : tourPaused ? 'Resume the journey' : 'Pause the journey',
      );
    }
    root.dataset.paused = String(tourPaused);
  }

  /** The place and a line about it: no step count and no dates. */
  function renderCaption(trip: ShowcaseTrip): void {
    if (captionPlace) captionPlace.textContent = trip.country ?? '';
    if (captionTitle) captionTitle.textContent = trip.label;
    if (captionText) captionText.textContent = trip.summary ?? '';
    captionBar?.style.setProperty('--xp-dwell', '0');
  }

  /** Linger on a trip, honouring pause and a hidden tab. Resolves false when
      the tour moved on without it — Next, Previous, End or a new tour. */
  function dwell(ms: number, token: number): Promise<boolean> {
    return new Promise((resolve) => {
      let left = ms;
      let last = performance.now();
      const tick = (now: number): void => {
        if (token !== tourToken) return resolve(false);
        if (!tourPaused && !document.hidden) left -= now - last;
        last = now;
        if (Number.isFinite(ms)) captionBar?.style.setProperty('--xp-dwell', String(clamp(1 - left / ms, 0, 1)));
        if (left <= 0) return resolve(true);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  async function runTour(start: number): Promise<void> {
    const token = ++tourToken;
    if (activity === 'fly') stopFlight(false);
    if (selection) {
      sheet.hidden = true;
      root.dataset.sheet = 'closed';
      selection = null;
    }
    setActivity('tour');
    markPaused();
    setHero(false);
    caption.hidden = false;
    setLayersOpen(false);
    if (!content.includes('trips')) {
      content = ['trips', ...content];
      map.setContent(content);
      const box = q<HTMLInputElement>('[data-xp-content="trips"]');
      if (box) box.checked = true;
    }
    if (view !== 'globe') toGlobe(false);

    for (let i = start; i < tourTrips.length; i++) {
      if (token !== tourToken) return;
      tourIndex = i;
      const trip = tourTrips[i]!;
      renderCaption(trip);
      markTick(trip.id);
      setProgress(trip.id);
      // The position stays in what a screen reader hears — it is how a
      // listener knows where a slideshow has got to — but nothing on screen
      // counts the trips.
      announce(`${i + 1} of ${tourTrips.length}: ${placeOf(trip)}`);
      padded = false; // flyToTrip clears the padding as it flies
      await map.flyToTrip(trip.id, {
        zoom: TOUR.zoom,
        pitch: still() ? 0 : TOUR.pitch,
        bearing: still() ? 0 : i % 2 ? TOUR.bearing : -TOUR.bearing,
        duration: still() ? 0 : TOUR.duration,
        offset: clearOf(caption),
      });
      if (token !== tourToken) return;
      // Reduced motion: never advance on a timer — the reader steps with Next.
      if (!(await dwell(still() ? Infinity : DWELL_MS, token))) return;
    }
    finishTour(token);
  }

  function finishTour(token: number): void {
    if (token !== tourToken) return;
    tourToken++;
    setActivity('idle');
    caption.hidden = true;
    tourPaused = false;
    markPaused();
    markTick(null);
    setProgress(null);
    setHero(true);
    void goHomeCamera(true);
    announce('That is the journey so far. Pick any trip or trail on the timeline.');
  }

  /** Stop the tour. `keep` leaves the reader at the trip it stopped on, with
      that trip's panel open — the natural thing to want after "that one". */
  function endTour(keep: boolean): void {
    if (activity !== 'tour') return;
    tourToken++;
    setActivity('idle');
    caption.hidden = true;
    tourPaused = false;
    markPaused();
    setProgress(null);
    const trip = tourTrips[tourIndex];
    if (keep && trip) {
      selection = { kind: 'trip', trip };
      renderTrip(trip);
      openSheet(false);
      markTick(trip.id);
      renderCrumbs();
    } else {
      markTick(null);
      setHero(true);
    }
  }

  function toggleTour(): void {
    if (activity === 'tour') {
      tourPaused = !tourPaused;
      markPaused();
      return;
    }
    tourPaused = false;
    void runTour(0);
  }

  /* ---- the flyover --------------------------------------------------------- */
  interface Flight {
    paused: boolean;
    /** The reader has taken the camera; the flight waits for Re-centre. */
    detached: boolean;
    recentring: boolean;
    speed: number;
    saved: CameraState;
    seek(f: number): void;
    resume(): Promise<void>;
  }
  let flyToken = 0;
  let flight: Flight | null = null;
  const hudName = q('[data-xp-hud-name]');
  const hudClock = q('[data-xp-hud-clock]');
  const hudKm = q('[data-xp-hud-km]');
  const hudTotal = q('[data-xp-hud-total]');
  const hudEle = q('[data-xp-hud-ele]');
  const hudBar = q('[data-xp-hud-bar]');
  const hudPause = q('[data-xp-hud-pause]');
  const hudSpeed = q('[data-xp-hud-speed]');
  const hudRecentre = q('[data-xp-hud-recentre]');

  function markFlight(): void {
    if (!flight) return;
    root.dataset.flyPaused = String(flight.paused);
    hudPause?.setAttribute('aria-label', flight.paused ? 'Resume the flyover' : 'Pause the flyover');
    if (hudSpeed) {
      hudSpeed.textContent = `${flight.speed}×`;
      hudSpeed.setAttribute('aria-label', `Flyover speed: ${flight.speed}×`);
    }
    if (hudRecentre) hudRecentre.hidden = !flight.detached;
  }

  async function waitForTerrain(token: number): Promise<boolean> {
    const t0 = performance.now();
    while (!map.hasTerrain() && performance.now() - t0 < 9000) {
      await new Promise((r) => setTimeout(r, 120));
      if (token !== flyToken) return false;
    }
    await map.settled();
    return token === flyToken;
  }

  async function fly(trail: MapTrail): Promise<void> {
    if (still()) return;
    const token = ++flyToken;
    if (activity === 'tour') endTour(false);
    const samples = await samplesFor(trail);
    if (!samples || samples.length < 2 || token !== flyToken) return;

    if (view !== 'survey' || subject?.id !== trail.id || selection?.kind !== 'trail' || selection.trail.id !== trail.id) {
      selectTrail(trail, false);
    }
    if (!(await waitForTerrain(token))) return;

    const duration = clamp(trail.km * 1400, 14000, 30000);
    const lookAhead = clamp(FLY.lookAheadKm / Math.max(trail.km, 0.5), 0.01, 0.2);
    const target = (f: number): [number, number] => {
      const here = pointAt(samples, f);
      const ahead = pointAt(samples, Math.min(1, f + lookAhead));
      return [here.lon + (ahead.lon - here.lon) * FLY.centreLead, here.lat + (ahead.lat - here.lat) * FLY.centreLead];
    };
    const headingAt = (f: number): number =>
      bearingBetween(pointAt(samples, f), pointAt(samples, Math.min(1, f + lookAhead)));
    const cameraAt = (f: number, bearing: number, centre = target(f)): CameraState => ({
      center: centre,
      zoom: FLY.zoom,
      pitch: FLY.pitch,
      bearing,
    });

    let at = 0;
    let heading = headingAt(0);
    let centre = target(0);
    const state: Flight = {
      paused: false,
      detached: false,
      recentring: false,
      speed: 1,
      saved: map.camera(),
      seek(f: number) {
        at = clamp(f, 0, 1);
        heading = headingAt(at);
        centre = target(at);
        if (!state.detached) map.jumpTo(cameraAt(at, heading, centre));
        paint();
      },
      async resume() {
        if (state.detached) {
          state.recentring = true;
          heading = headingAt(at);
          centre = target(at);
          await map.easeTo(cameraAt(at, heading, centre), 900);
          state.recentring = false;
          state.detached = false;
        }
        state.paused = false;
        markFlight();
      },
    };
    flight = state;

    setActivity('fly');
    hud.hidden = false;
    if (hudName) hudName.textContent = trail.label;
    if (hudTotal) hudTotal.textContent = `/ ${nf(trail.km, 1)} km`;
    markFlight();
    announce(`Flying ${trail.label}. Press Escape to stop.`);

    /** Everything that says how far along the flight is, the line included. */
    let lastPercent = -1;
    function paint(): void {
      const here = pointAt(samples!, at);
      map.revealTrack(at);
      map.setProbe([here.lon, here.lat]);
      chart?.setPlayhead(at);
      if (hudKm) hudKm.textContent = nf(at * trail.km, 1);
      if (hudEle) hudEle.textContent = here.ele === null ? '—' : nf(here.ele);
      if (hudClock) hudClock.textContent = clockAt(trail.start, here.secs);
      hudBar?.style.setProperty('--xp-fly', String(at));
      const percent = Math.round(at * 100);
      if (percent === lastPercent || !hudBar) return;
      lastPercent = percent;
      hudBar.setAttribute('aria-valuenow', String(percent));
      hudBar.setAttribute('aria-valuetext', `${nf(at * trail.km, 1)} of ${nf(trail.km, 1)} km`);
    }

    map.setQuiet(true);
    paint();
    await map.easeTo(cameraAt(0, heading, centre), 1800);
    if (token !== flyToken) return;

    let last = performance.now();
    await new Promise<void>((resolve) => {
      const frame = (now: number): void => {
        if (token !== flyToken) return resolve();
        const dt = Math.min(64, now - last);
        last = now;
        // Paused is paused: nothing moves, so nothing is redrawn.
        if (state.paused || state.recentring || document.hidden) {
          requestAnimationFrame(frame);
          return;
        }
        at = Math.min(1, at + (dt / duration) * state.speed);

        if (!state.detached) {
          const k = 1 - Math.exp((-dt / 1000) * FOLLOW_RATE);
          const goal = target(at);
          centre = [centre[0] + (goal[0] - centre[0]) * k, centre[1] + (goal[1] - centre[1]) * k];
          const wanted = turn(heading, headingAt(at)) * (1 - Math.exp((-dt / 1000) * TURN_RATE));
          const cap = (MAX_TURN_DEG_S * dt) / 1000;
          heading = (heading + clamp(wanted, -cap, cap) + 360) % 360;
          map.jumpTo(cameraAt(at, heading, centre));
        }

        paint();
        if (at >= 1) return resolve();
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });

    if (token !== flyToken) return;
    // Arrived: the whole line drawn, and the camera handed back where it was.
    await finishFlight(state.saved, true);
    announce(`${trail.label}: done.`);
  }

  async function finishFlight(back: CameraState | null, animate: boolean): Promise<void> {
    flight = null;
    setActivity('idle');
    hud.hidden = true;
    delete root.dataset.flyPaused;
    map.revealTrack(null);
    map.setProbe(null);
    map.setQuiet(false);
    chart?.setPlayhead(null);
    if (back) await map.easeTo(back, animate ? 2000 : 0);
  }

  /** `restore` flies back to the framing the flyover started from — what
      Escape and Stop mean. Interrupting with another choice does not, because
      that choice is about to move the camera itself. */
  function stopFlight(restore: boolean): void {
    if (activity !== 'fly') return;
    const back = restore ? (flight?.saved ?? null) : null;
    flyToken++;
    void finishFlight(back, true);
    announce('Flyover stopped.');
  }

  // A gesture on the map pauses a flyover and lets the reader look around,
  // with Re-centre to carry on — Strava's rule. It pauses a tour too.
  const takeOver = (): void => {
    if (activity === 'fly' && flight && !flight.recentring) {
      flight.paused = true;
      flight.detached = true;
      markFlight();
    } else if (activity === 'tour' && !tourPaused) {
      tourPaused = true;
      markPaused();
    }
  };
  host.addEventListener('pointerdown', takeOver, { capture: true });
  host.addEventListener('wheel', takeOver, { capture: true, passive: true });

  // The HUD's bar scrubs, by pointer and by key.
  if (hudBar) {
    const seekFrom = (event: PointerEvent): void => {
      const r = hudBar.getBoundingClientRect();
      flight?.seek(clamp((event.clientX - r.left) / r.width, 0, 1));
    };
    hudBar.addEventListener('pointerdown', (event) => {
      if (!flight) return;
      hudBar.setPointerCapture(event.pointerId);
      seekFrom(event);
    });
    hudBar.addEventListener('pointermove', (event) => {
      if (flight && hudBar.hasPointerCapture(event.pointerId)) seekFrom(event);
    });
    hudBar.addEventListener('keydown', (event) => {
      if (!flight) return;
      const now = Number(hudBar.getAttribute('aria-valuenow') ?? 0) / 100;
      const step = event.shiftKey ? 0.1 : 0.02;
      const next: Record<string, number> = { ArrowRight: now + step, ArrowLeft: now - step, Home: 0, End: 1 };
      if (!(event.key in next)) return;
      event.preventDefault();
      flight.seek(clamp(next[event.key]!, 0, 1));
    });
  }

  /* ---- clicks -------------------------------------------------------------- */
  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const keyboard = (event as PointerEvent).detail === 0;

    if (!target.closest('[data-xp-layers], [data-xp-layers-toggle]')) setLayersOpen(false);

    const trip = target.closest<HTMLElement>('[data-mapglobe-trip], [data-xp-trip]');
    if (trip) {
      const found = tripById.get(trip.dataset.mapglobeTrip ?? trip.dataset.xpTrip ?? '');
      if (found) {
        opener = trip;
        selectTrip(found, keyboard);
      }
      return;
    }

    const flyButton = target.closest<HTMLElement>('[data-xp-fly]');
    if (flyButton) {
      const found = trailById.get(flyButton.dataset.xpFly ?? '');
      if (found) void fly(found);
      return;
    }

    const trail = target.closest<HTMLElement>('[data-mapglobe-trail], [data-xp-trail]');
    if (trail) {
      const found = trailById.get(trail.dataset.mapglobeTrail ?? trail.dataset.xpTrail ?? '');
      if (found) {
        opener = trail;
        selectTrail(found, keyboard);
      }
      return;
    }

    const viewButton = target.closest<HTMLElement>('[data-xp-view]');
    if (viewButton) return chooseView(viewButton.dataset.xpView === 'survey' ? 'survey' : 'globe');

    if (target.closest('[data-xp-layers-toggle]')) return setLayersOpen(layersPanel.hidden, keyboard);
    if (target.closest('[data-xp-home]')) return goHome();
    if (target.closest('[data-xp-close]')) return closeSheet(keyboard);
    if (target.closest('[data-xp-grabber]')) {
      const at = DETENTS.indexOf((sheet.dataset.detent ?? 'peek') as (typeof DETENTS)[number]);
      return setDetent(DETENTS[(at + 1) % DETENTS.length]!);
    }

    if (target.closest('[data-xp-tour-start]')) return toggleTour();
    if (target.closest('[data-xp-tour-pause]')) {
      tourPaused = !tourPaused;
      return markPaused();
    }
    if (target.closest('[data-xp-tour-next]')) return void runTour(Math.min(tourTrips.length - 1, tourIndex + 1));
    if (target.closest('[data-xp-tour-prev]')) return void runTour(Math.max(0, tourIndex - 1));
    if (target.closest('[data-xp-tour-end]')) return endTour(true);

    if (target.closest('[data-xp-hud-pause]') && flight) {
      if (flight.paused) void flight.resume();
      else {
        flight.paused = true;
        markFlight();
      }
      return;
    }
    if (target.closest('[data-xp-hud-recentre]') && flight) return void flight.resume();
    if (target.closest('[data-xp-hud-speed]') && flight) {
      flight.speed = SPEEDS[(SPEEDS.indexOf(flight.speed) + 1) % SPEEDS.length]!;
      return markFlight();
    }
    if (target.closest('[data-xp-hud-stop]')) return stopFlight(true);
  });

  /* ---- keys ---------------------------------------------------------------- */
  root.addEventListener('keydown', (event) => {
    const el = event.target as HTMLElement;

    const tick = el.closest<HTMLButtonElement>('[data-xp-tick]');
    if (tick) {
      const at = ticks.indexOf(tick);
      const moves: Record<string, number> = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: ticks.length - 1 };
      if (event.key in moves) {
        event.preventDefault();
        focusTick(moves[event.key]!);
      }
      return;
    }

    // The view switch is a two-option radiogroup, so arrows move between them.
    if (el.closest('[data-xp-view]') && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const next = view === 'globe' ? 'survey' : 'globe';
      chooseView(next);
      q<HTMLElement>(`[data-xp-view="${next}"]`)?.focus();
    }
  });

  /* Escape unwinds one layer at a time, from the most transient thing. */
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (activity === 'fly') return stopFlight(true);
    if (activity === 'tour') return endTour(true);
    if (!root.contains(document.activeElement)) return;
    if (!layersPanel.hidden) return setLayersOpen(false, true);
    if (selection) return closeSheet(true);
  });

  /* ---- full screen --------------------------------------------------------- */
  if (fullscreen) {
    if (!document.fullscreenEnabled) fullscreen.hidden = true;
    fullscreen.addEventListener('click', () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void stage.requestFullscreen?.();
    });
    document.addEventListener('fullscreenchange', () => {
      const on = document.fullscreenElement === stage;
      root.dataset.fullscreen = String(on);
      fullscreen.setAttribute('aria-pressed', String(on));
      fullscreen.setAttribute('aria-label', on ? 'Leave full screen' : 'Full screen');
    });
  }

  // Off screen, nothing keeps moving on the reader's behalf.
  new IntersectionObserver((entries) => {
    const latest = entries[entries.length - 1];
    if (latest) hold('screen', !latest.isIntersecting);
    if (entries.some((entry) => entry.isIntersecting)) return;
    if (activity === 'tour' && !tourPaused) {
      tourPaused = true;
      markPaused();
    }
    if (activity === 'fly' && flight && !flight.paused) {
      flight.paused = true;
      markFlight();
    }
  }).observe(stage);

  setActivity('idle');
  markView();
  markPaused();
  setHero(true);
  // A browser that restored a filter switch on reload is honoured from the start.
  applyKinds();
  // The reel's controls appear, and it starts turning if nothing holds it.
  reel?.setAttribute('data-live', '');
  markReel();
}
