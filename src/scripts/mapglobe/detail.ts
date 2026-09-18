/**
 * The route detail card — five views of one recorded route, rendered into the
 * card under the button in the top-left corner of the MapLibre frame
 * (16 Sep 2026, author's request).
 *
 * This module is the CONTENT of the card and nothing else: given a route, a
 * view and the route's profile, it builds the DOM. Which view is up, whether
 * the card is shown at all and what the map does in answer to a hover all
 * live in index.ts, and the map itself is reached only through the two hooks
 * in `DetailHooks`. No MapLibre here, and no value import from the engine —
 * see modes.ts for why that would hoist the whole engine into the eager
 * bundle.
 *
 * WHAT EACH VIEW READS. The Summary view is served entirely from the manifest
 * the page already holds inline; the other four need the profile file, which
 * is the recording resampled by distance at build time (scripts/build-trails.mjs)
 * and fetched once per route, the first time a view that needs it is opened.
 * `loadProfile` caches the promise, the same way the engine caches a route's
 * geometry, so nothing is fetched twice.
 *
 * THE CHARTS ARE INLINE SVG BUILT HERE, not a library. Two series — height and
 * heart rate — against distance, with a cursor. That is a hundred lines, and a
 * charting dependency on a page that already ships two map engines would be
 * one more thing to defer.
 */

import type { MapTrail } from './engine';
import type { MapInfo } from './modes';

/**
 * `public/globe/trails/<id>.profile.json`, exactly as the build script writes
 * it. Samples are `[lon, lat, ele, seconds-from-start, hr]` every `step`
 * metres along the FULL recording, ending on its last fix. Splits are
 * `[seconds, ascent, descent, metres]` per kilometre, the last usually short.
 */
export interface TrailProfile {
  step: number;
  samples: [number, number, number | null, number | null, number | null][];
  splits: [number, number, number, number][];
  /** [mean, max] beats per minute, or null when the recording carried none. */
  hr: [number, number] | null;
  /** [mean, max] watts. The runs have it; the hikes do not. */
  power: [number, number] | null;
}

/** What the card can ask the map to do. Both are answered by the engine. */
export interface DetailHooks {
  /** Put the probe dot at a point on the route, or clear it. */
  probe(at: [number, number] | null): void;
}

const DATA_BASE = '/globe';

const profiles = new Map<string, Promise<TrailProfile>>();

export function loadProfile(id: string): Promise<TrailProfile> {
  const cached = profiles.get(id);
  if (cached) return cached;
  const pending = fetch(`${DATA_BASE}/trails/${id}.profile.json`).then((r) => {
    if (!r.ok) throw new Error(`${r.status} fetching the ${id} profile`);
    return r.json() as Promise<TrailProfile>;
  });
  // A failed fetch is not cached, so the next click tries again.
  pending.catch(() => profiles.delete(id));
  profiles.set(id, pending);
  return pending;
}

/** Whether a view needs the profile file at all. */
export const needsProfile = (view: MapInfo): boolean => view !== 'summary';

/* -------------------------------------------------------------------------- */
/* formatting                                                                  */
/* -------------------------------------------------------------------------- */

const n = (value: number): string => value.toLocaleString('en');

/** "8 h 18 min", "49 min", "2 h". */
export function duration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "14:39 /km" from seconds per kilometre. */
function pace(secondsPerKm: number): string {
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

/** "07:24" plus a number of seconds → "09:34". Wraps past midnight. */
function clockAfter(start: string, seconds: number): string {
  const [h, m] = start.split(':').map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h)) return '';
  const total = ((h * 60 + m + Math.round(seconds / 60)) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

const SHAPE_WORDS: Record<MapTrail['shape'], string> = {
  loop: 'Loop',
  'out-and-back': 'Out and back',
  'point-to-point': 'Point to point',
};

/* -------------------------------------------------------------------------- */
/* DOM                                                                         */
/* -------------------------------------------------------------------------- */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

/** The card's first line, the same in every view: the route, where, when. */
function heading(trail: MapTrail): HTMLElement {
  const head = el('p', 'info__head');
  head.append(
    el('strong', 'info__name', trail.label),
    el('span', 'info__where', `${trail.place} · ${trail.when}`),
  );
  return head;
}

function fact(label: string, value: string, sub?: string): HTMLElement {
  const box = el('div', 'info__fact');
  box.append(el('span', 'info__label', label), el('span', 'info__value', value));
  if (sub) box.append(el('span', 'info__sub', sub));
  return box;
}

/* -------------------------------------------------------------------------- */
/* the chart                                                                   */
/* -------------------------------------------------------------------------- */

const CHART_W = 300;
const CHART_H = 110;
/** Room for the axis labels: left for the y range, bottom for the km ticks. */
const PAD = { top: 8, right: 6, bottom: 16, left: 34 };

interface ChartSpec {
  /** One value per sample, in sample order. Nulls break the line. */
  series: (number | null)[];
  /** Distance of each sample from the start, in km. Same length. */
  km: number[];
  /** Fill under the line — the elevation profile is an area, the heart rate a line. */
  area: boolean;
  /** Format a y value for the axis. */
  y: (value: number) => string;
  /** A horizontal reference line, drawn dashed — the mean heart rate. */
  reference?: number;
  /** A point to mark and name — the summit. */
  mark?: { index: number; text: string };
  /** Told the sample under the cursor, or null when it leaves. */
  onCursor(index: number | null): void;
}

interface Chart {
  node: SVGSVGElement;
  /** Move the cursor from outside — a split row hovered, a key pressed. */
  cursor(index: number | null): void;
}

/**
 * A line or area against distance, with a cursor the reader can move by
 * pointer or by arrow key. The scale is the series' own min–max, padded a
 * little so the line never sits on the frame.
 *
 * Coordinates are in the SVG's own units and the element scales to its box,
 * which is what lets the same chart sit in a 19rem card on a desktop and a
 * full-width one on a phone without re-laying anything out. The cursor is
 * found from the pointer's x as a fraction of the box, so it is right at any
 * size.
 */
function chart(spec: ChartSpec): Chart {
  const node = svg('svg', {
    class: 'info__chart',
    viewBox: `0 0 ${CHART_W} ${CHART_H}`,
    role: 'img',
    tabindex: 0,
  });
  const values = spec.series.filter((v): v is number => v !== null);
  if (values.length < 2) return { node, cursor: () => {} };

  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (spec.reference !== undefined) {
    lo = Math.min(lo, spec.reference);
    hi = Math.max(hi, spec.reference);
  }
  const span = Math.max(1, hi - lo);
  lo -= span * 0.05;
  hi += span * 0.08;

  const last = spec.km[spec.km.length - 1] ?? 1;
  const plotW = CHART_W - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;
  const x = (km: number): number => PAD.left + (km / last) * plotW;
  const y = (v: number): number => PAD.top + (1 - (v - lo) / (hi - lo)) * plotH;

  /* Axis: the y range as two labels, and km ticks chosen so there are at most
     six of them whatever the distance — 1 km on a 4 km hill, 5 km on a half
     marathon. */
  const axis = svg('g', { class: 'info__axis' });
  const tick = [1, 2, 5, 10, 20].find((t) => last / t <= 6) ?? 50;
  for (let k = 0; k <= last; k += tick) {
    const label = svg('text', { x: x(k), y: CHART_H - 4, 'text-anchor': k === 0 ? 'start' : 'middle' });
    label.textContent = k === 0 ? '0 km' : String(k);
    axis.append(label);
    axis.append(
      svg('line', { x1: x(k), x2: x(k), y1: PAD.top, y2: PAD.top + plotH, class: 'info__grid' }),
    );
  }
  const top = svg('text', { x: PAD.left - 4, y: PAD.top + 4, 'text-anchor': 'end' });
  top.textContent = spec.y(Math.max(...values));
  const bottom = svg('text', { x: PAD.left - 4, y: PAD.top + plotH, 'text-anchor': 'end' });
  bottom.textContent = spec.y(Math.min(...values));
  axis.append(top, bottom);
  node.append(axis);

  /* The line, broken wherever a sample has no value. */
  let d = '';
  let open = false;
  spec.series.forEach((v, i) => {
    if (v === null) {
      open = false;
      return;
    }
    d += `${open ? 'L' : 'M'}${x(spec.km[i]!).toFixed(1)} ${y(v).toFixed(1)}`;
    open = true;
  });

  if (spec.area) {
    const first = spec.series.findIndex((v) => v !== null);
    const lastIdx = spec.series.length - 1 - [...spec.series].reverse().findIndex((v) => v !== null);
    const fill = `${d}L${x(spec.km[lastIdx]!).toFixed(1)} ${(PAD.top + plotH).toFixed(1)}L${x(
      spec.km[first]!,
    ).toFixed(1)} ${(PAD.top + plotH).toFixed(1)}Z`;
    node.append(svg('path', { d: fill, class: 'info__area' }));
  }
  if (spec.reference !== undefined) {
    node.append(
      svg('line', {
        x1: PAD.left,
        x2: PAD.left + plotW,
        y1: y(spec.reference),
        y2: y(spec.reference),
        class: 'info__ref',
      }),
    );
  }
  node.append(svg('path', { d, class: 'info__line' }));

  if (spec.mark) {
    const v = spec.series[spec.mark.index];
    if (v !== null && v !== undefined) {
      const mx = x(spec.km[spec.mark.index]!);
      const my = y(v);
      node.append(svg('circle', { cx: mx, cy: my, r: 2.5, class: 'info__mark' }));
      const text = svg('text', {
        x: mx + (mx > CHART_W * 0.7 ? -5 : 5),
        y: my - 4,
        'text-anchor': mx > CHART_W * 0.7 ? 'end' : 'start',
        class: 'info__mark-text',
      });
      text.textContent = spec.mark.text;
      node.append(text);
    }
  }

  /* The cursor: a vertical rule and a dot on the line, hidden until there is
     something under it. */
  const rule = svg('line', { y1: PAD.top, y2: PAD.top + plotH, class: 'info__cursor', visibility: 'hidden' });
  const dot = svg('circle', { r: 3, class: 'info__cursor-dot', visibility: 'hidden' });
  node.append(rule, dot);

  let at: number | null = null;
  const cursor = (index: number | null): void => {
    if (index !== null && (index < 0 || index >= spec.series.length)) index = null;
    if (index === at) return;
    at = index;
    const v = index === null ? null : spec.series[index];
    if (index === null || v === null || v === undefined) {
      rule.setAttribute('visibility', 'hidden');
      dot.setAttribute('visibility', 'hidden');
      spec.onCursor(null);
      return;
    }
    const cx = x(spec.km[index]!);
    rule.setAttribute('x1', String(cx));
    rule.setAttribute('x2', String(cx));
    rule.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', String(cx));
    dot.setAttribute('cy', String(y(v)));
    dot.setAttribute('visibility', 'visible');
    spec.onCursor(index);
  };

  const fromPointer = (event: PointerEvent): void => {
    const box = node.getBoundingClientRect();
    if (!box.width) return;
    const fx = ((event.clientX - box.left) / box.width) * CHART_W;
    const km = ((fx - PAD.left) / plotW) * last;
    /* Samples are evenly spaced by distance, so the index is the distance
       fraction — no search. Clamped so a pointer in the axis gutter still
       lands on the nearest end. */
    const index = Math.round((Math.min(last, Math.max(0, km)) / last) * (spec.series.length - 1));
    cursor(index);
  };

  node.addEventListener('pointermove', fromPointer);
  node.addEventListener('pointerdown', fromPointer);
  node.addEventListener('pointerleave', () => cursor(null));
  node.addEventListener('blur', () => cursor(null));
  node.addEventListener('keydown', (event) => {
    const stride = event.shiftKey ? 10 : 1;
    if (event.key === 'ArrowRight') cursor(Math.min(spec.series.length - 1, (at ?? -1) + stride));
    else if (event.key === 'ArrowLeft') cursor(Math.max(0, (at ?? spec.series.length) - stride));
    else if (event.key === 'Home') cursor(0);
    else if (event.key === 'End') cursor(spec.series.length - 1);
    else if (event.key === 'Escape') cursor(null);
    else return;
    event.preventDefault();
  });

  return { node, cursor };
}

/* -------------------------------------------------------------------------- */
/* the views                                                                   */
/* -------------------------------------------------------------------------- */

function summary(trail: MapTrail): HTMLElement[] {
  const facts = el('div', 'info__facts');
  facts.append(fact('Distance', `${trail.km.toFixed(1)} km`));
  if (trail.ascent !== null) {
    facts.append(
      fact(
        'Climb',
        `↑ ${n(trail.ascent)} m`,
        trail.descent === null ? undefined : `↓ ${n(trail.descent)} m`,
      ),
    );
  }
  if (trail.low !== null && trail.high !== null) {
    facts.append(fact('Elevation', `${n(trail.low)}–${n(trail.high)} m`));
  }
  facts.append(fact('Shape', SHAPE_WORDS[trail.shape]));
  if (trail.start) facts.append(fact('Started', trail.start, trail.end ? `finished ${trail.end}` : undefined));
  if (trail.elapsed !== null) {
    facts.append(fact('Elapsed', duration(trail.elapsed)));
  }
  if (trail.moving !== null && trail.elapsed !== null) {
    const stopped = trail.elapsed - trail.moving;
    facts.append(
      fact('Moving', duration(trail.moving), stopped > 60 ? `${duration(stopped)} stopped` : undefined),
    );
    if (trail.km > 0) facts.append(fact('Pace', pace(trail.moving / trail.km), 'while moving'));
  }
  return [facts];
}

/** Distance of each sample from the start, in km — the x axis every chart shares. */
const kms = (profile: TrailProfile): number[] =>
  profile.samples.map((_, i) => (i * profile.step) / 1000);

/** The chart's readout line, written for the sample under the cursor. */
function cursorLine(
  trail: TrailProfile,
  route: MapTrail,
  index: number,
  value: string,
): string {
  const sample = trail.samples[index]!;
  const parts = [`${((index * trail.step) / 1000).toFixed(1)} km`, value];
  if (sample[3] !== null) {
    parts.push(`${duration(sample[3])} in`);
    if (route.start) parts.push(clockAfter(route.start, sample[3]));
  }
  return parts.join(' · ');
}

function profileView(trail: MapTrail, profile: TrailProfile, hooks: DetailHooks): Element[] {
  const eles = profile.samples.map((s) => s[2]);
  const readout = el('p', 'info__readout');

  let summit = -1;
  eles.forEach((e, i) => {
    if (e !== null && (summit === -1 || e > (eles[summit] ?? -Infinity))) summit = i;
  });
  const summitSample = summit === -1 ? null : profile.samples[summit]!;
  const idle =
    summitSample && summitSample[2] !== null
      ? `High point ${n(summitSample[2])} m at ${((summit * profile.step) / 1000).toFixed(1)} km` +
        (summitSample[3] !== null ? `, ${duration(summitSample[3])} in.` : '.')
      : 'Move along the chart to follow the route.';
  readout.textContent = idle;

  const graph = chart({
    series: eles,
    km: kms(profile),
    area: true,
    y: (v) => `${n(Math.round(v))} m`,
    mark:
      summit === -1 || summitSample?.[2] === null || summitSample?.[2] === undefined
        ? undefined
        : { index: summit, text: `${n(summitSample[2])} m` },
    onCursor(index) {
      if (index === null) {
        hooks.probe(null);
        readout.textContent = idle;
        return;
      }
      const s = profile.samples[index]!;
      hooks.probe([s[0], s[1]]);
      readout.textContent = cursorLine(profile, trail, index, s[2] === null ? '—' : `${n(s[2])} m`);
    },
  });
  graph.node.setAttribute('aria-label', `Elevation profile of ${trail.label}`);
  return [graph.node, readout];
}

function splitsView(profile: TrailProfile, hooks: DetailHooks): Element[] {
  const list = el('ol', 'info__splits');
  const paces = profile.splits.map(([s, , , m]) => (m > 0 ? (s / m) * 1000 : 0));
  const slowest = Math.max(...paces, 1);
  const total = profile.splits.reduce((sum, [s]) => sum + s, 0);

  let metres = 0;
  profile.splits.forEach(([seconds, up, down, m], i) => {
    metres += m;
    const row = el('li', 'info__split');
    /* Only the LAST split can be a partial kilometre. An earlier one can also
       come up short — a pause in the recording jumps the distance past a
       boundary, and the next kilometre starts late — but it is still the
       ninth kilometre, and labelling it "9.0" reads as a bug. */
    const partial = i === profile.splits.length - 1 && m < 950;
    const label = partial ? `${(metres / 1000).toFixed(1)}` : String(i + 1);
    row.append(el('span', 'info__km', label));
    const bar = el('span', 'info__bar');
    const fill = el('i');
    fill.style.width = `${Math.max(2, (paces[i]! / slowest) * 100).toFixed(1)}%`;
    bar.append(fill);
    row.append(bar);
    row.append(el('span', 'info__pace', pace(paces[i]!)));
    // "+10 / 0" rather than "+10 / −0": a zero carries no direction.
    const climb = up || down ? `${up ? `+${up}` : '0'} / ${down ? `−${down}` : '0'}` : '';
    row.append(el('span', 'info__climb', climb));
    row.title =
      `${partial ? `${(m / 1000).toFixed(2)} km` : `Kilometre ${i + 1}`} · ${duration(seconds)}` +
      (up || down ? ` · ${up} m up, ${down} m down` : '');
    /* The probe rides the end of the split; the profile samples are evenly
       spaced so the index is just the distance divided by the step. */
    const end = Math.min(profile.samples.length - 1, Math.round(metres / profile.step));
    const point = profile.samples[end]!;
    row.addEventListener('pointerenter', () => hooks.probe([point[0], point[1]]));
    row.addEventListener('pointerleave', () => hooks.probe(null));
    list.append(row);
  });

  const foot = el(
    'p',
    'info__readout',
    `${profile.splits.length} splits · ${duration(total)} · bars are pace, longest is slowest.`,
  );
  return [list, foot];
}

/** The 0–1 series the map colours the line by — height, over the route's own range. */
export function heightSeries(profile: TrailProfile): number[] | null {
  const eles = profile.samples.map((s) => s[2]).filter((e): e is number => e !== null);
  if (eles.length < 2) return null;
  const lo = Math.min(...eles);
  const hi = Math.max(...eles);
  const span = Math.max(1, hi - lo);
  return profile.samples.map((s) => (s[2] === null ? 0 : (s[2] - lo) / span));
}

function colourView(trail: MapTrail, profile: TrailProfile): HTMLElement[] {
  const eles = profile.samples.map((s) => s[2]);
  let lo = -1;
  let hi = -1;
  eles.forEach((e, i) => {
    if (e === null) return;
    if (lo === -1 || e < eles[lo]!) lo = i;
    if (hi === -1 || e > eles[hi]!) hi = i;
  });
  if (lo === -1 || hi === -1) {
    return [el('p', 'info__readout', 'No elevation in this recording.')];
  }

  const legend = el('div', 'info__legend');
  const ramp = el('span', 'info__ramp');
  ramp.setAttribute('aria-hidden', 'true');
  legend.append(
    el('span', 'info__legend-end', `${n(eles[lo]!)} m`),
    ramp,
    el('span', 'info__legend-end', `${n(eles[hi]!)} m`),
  );

  const at = (i: number): string => {
    const t = profile.samples[i]![3];
    return t === null || !trail.start ? '' : ` at ${clockAfter(trail.start, t)}`;
  };
  const text = el(
    'p',
    'info__readout',
    `The line is coloured by height — the stronger the ink, the higher the ground. ` +
      `Lowest ${n(eles[lo]!)} m${at(lo)}, highest ${n(eles[hi]!)} m${at(hi)}.`,
  );
  return [legend, text];
}

function effortView(trail: MapTrail, profile: TrailProfile, hooks: DetailHooks): Element[] {
  if (!profile.hr) {
    return [el('p', 'info__readout', 'No heart rate in this recording.')];
  }
  const hrs = profile.samples.map((s) => s[4]);
  const readout = el('p', 'info__readout');
  const facts = el('div', 'info__facts info__facts--row');
  facts.append(fact('Heart rate', `${profile.hr[0]} bpm`, `max ${profile.hr[1]}`));
  if (profile.power) facts.append(fact('Power', `${profile.power[0]} W`, `max ${profile.power[1]}`));

  const idle = `Average is the dashed line. Move along the chart to follow the route.`;
  readout.textContent = idle;

  const graph = chart({
    series: hrs,
    km: kms(profile),
    area: false,
    y: (v) => `${Math.round(v)}`,
    reference: profile.hr[0],
    onCursor(index) {
      if (index === null) {
        hooks.probe(null);
        readout.textContent = idle;
        return;
      }
      const s = profile.samples[index]!;
      hooks.probe([s[0], s[1]]);
      readout.textContent = cursorLine(profile, trail, index, s[4] === null ? '—' : `${s[4]} bpm`);
    },
  });
  graph.node.setAttribute('aria-label', `Heart rate along ${trail.label}`);
  return [facts, graph.node, readout];
}

/* -------------------------------------------------------------------------- */
/* entry                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Fill the card for one route in one view. `profile` is null for the Summary
 * view, which needs none, and while a profile is still on its way — the card
 * then shows the heading and a one-line wait, and is filled again when it
 * lands. The caller clears the probe; this only ever sets it from a hover.
 */
export function renderDetail(
  card: HTMLElement,
  view: MapInfo,
  trail: MapTrail,
  profile: TrailProfile | null,
  hooks: DetailHooks,
): void {
  card.replaceChildren(heading(trail));
  card.dataset.view = view;

  if (view === 'summary') {
    card.append(...summary(trail));
    return;
  }
  if (!profile) {
    card.append(el('p', 'info__readout', 'Reading the recording…'));
    return;
  }
  switch (view) {
    case 'profile':
      card.append(...profileView(trail, profile, hooks));
      return;
    case 'splits':
      card.append(...splitsView(profile, hooks));
      return;
    case 'colour':
      card.append(...colourView(trail, profile));
      return;
    case 'effort':
      card.append(...effortView(trail, profile, hooks));
      return;
  }
}

/** A failed profile fetch, in the card rather than in the console alone. */
export function renderDetailError(card: HTMLElement, trail: MapTrail): void {
  card.replaceChildren(heading(trail), el('p', 'info__readout info__readout--error', 'The recording could not be read.'));
}
