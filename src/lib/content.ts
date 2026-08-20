import { getCollection, type CollectionEntry } from 'astro:content';

/**
 * Drafts are visible while developing and excluded from production builds,
 * so half-written pages can live in the repo without shipping.
 */
const includeDrafts = import.meta.env.DEV;

function publishable<T extends { data: { draft: boolean } }>(entries: T[]): T[] {
  return includeDrafts ? entries : entries.filter((entry) => !entry.data.draft);
}

export async function getSections(): Promise<CollectionEntry<'sections'>[]> {
  const entries = publishable(await getCollection('sections'));
  return entries.sort((a, b) => a.data.order - b.data.order);
}

/**
 * `order` leads, `year` only breaks ties. The list is curated rather than
 * chronological: sorting by year first pushed "Personal Projects" (never
 * finished, so its year is always this one) above the professional work it
 * should sit under.
 */
export async function getWork(): Promise<CollectionEntry<'work'>[]> {
  const entries = publishable(await getCollection('work'));
  return entries.sort((a, b) => a.data.order - b.data.order || b.data.year - a.data.year);
}

/**
 * "2023" or "2023–2025". En dash, not a hyphen: it is the range dash, and it
 * reads cleanly against the tabular-nums mono the year is set in.
 */
export function formatYears(data: { year: number; endYear?: number }): string {
  return data.endYear ? `${data.year}–${data.endYear}` : String(data.year);
}

export async function getFeaturedWork(): Promise<CollectionEntry<'work'>[]> {
  return (await getWork()).filter((entry) => entry.data.featured);
}

/* ------------------------------------------------------------------------- *
 * Trips
 *
 * Dates arrive at whatever precision is known — '2023-11-03', '2024-10' or
 * '2025' — and everything below reads that precision back off the string
 * rather than assuming days exist. See `partialDate` in src/content.config.ts.
 * ------------------------------------------------------------------------- */

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface TripDates {
  start?: string;
  end?: string;
}

type Precision = 'year' | 'month' | 'day';

interface Parsed {
  y: number;
  /** 0-indexed, absent at year precision. */
  m?: number;
  d?: number;
  precision: Precision;
}

function parse(iso: string): Parsed {
  const [y, m, d] = iso.split('-').map(Number);
  if (d !== undefined) return { y, m: m - 1, d, precision: 'day' };
  if (m !== undefined) return { y, m: m - 1, precision: 'month' };
  return { y, precision: 'year' };
}

/**
 * Pad to a comparable 'yyyy-mm-dd'. Missing parts become '00', which sorts a
 * month-precision trip just before any dated day in that month — arbitrary but
 * consistent, which is all an ordering needs. Undated trips get '0000-00-00'
 * so they land at the end of a newest-first sort rather than the top.
 */
function sortKey(iso?: string): string {
  if (!iso) return '0000-00-00';
  const [y, m = '00', d = '00'] = iso.split('-');
  return `${y}-${m}-${d}`;
}

/**
 * Trips, newest first, ordered by `start` alone.
 *
 * There is no `order` field on purpose. The page draws a timeline with the
 * dates printed next to every entry, so a hand-maintained sequence is a second
 * source of truth that can visibly contradict the first one.
 */
export async function getTrips(): Promise<CollectionEntry<'trips'>[]> {
  const entries = publishable(await getCollection('trips'));
  return entries.sort((a, b) => sortKey(b.data.start).localeCompare(sortKey(a.data.start)));
}

/** The year an entry belongs to on the timeline rail, or null if undated. */
export function tripYear(data: TripDates): string | null {
  return data.start ? data.start.slice(0, 4) : null;
}

/**
 * True only when both ends are known to the day — which is what `tripDays()`
 * needs before it can honestly report a duration. Not exported: the timeline
 * used to render a hollow dot for approximate trips, and that signal is gone
 * now that dots mark years rather than trips.
 */
function hasExactDates(data: TripDates): boolean {
  return (
    parse(data.start ?? '').precision === 'day' &&
    (data.end === undefined || parse(data.end).precision === 'day')
  );
}

function dayMonth(p: Parsed): string {
  return p.precision === 'day' ? `${p.d} ${MONTHS[p.m!]}` : MONTHS[p.m!];
}

/**
 * Renders at the precision it was given and never invents the missing part:
 *
 *   '2023-11-03' + '2023-11-08'  ->  "3–8 Nov 2023"
 *   '2026-06-26' + '2026-07-01'  ->  "26 Jun – 1 Jul 2026"
 *   '2024-10'                    ->  "Oct 2024"
 *   '2025'                       ->  "2025"
 *
 * En dash throughout — it is the range dash. Tight inside a single month where
 * only the number changes, spaced once whole dates sit on either side, which is
 * the usual typesetting rule and stops "1 Jul" reading as part of "26 Jun".
 *
 * Returns null with no start date, so callers render their own placeholder
 * rather than an empty string that collapses the layout.
 */
export function formatTripDates(data: TripDates): string | null {
  if (!data.start) return null;
  const a = parse(data.start);

  if (!data.end || data.end === data.start) {
    if (a.precision === 'year') return String(a.y);
    return `${dayMonth(a)} ${a.y}`;
  }

  const b = parse(data.end);
  if (a.precision === 'year' || b.precision === 'year') {
    return a.y === b.y ? String(a.y) : `${a.y}–${b.y}`;
  }
  if (a.y !== b.y) return `${dayMonth(a)} ${a.y} – ${dayMonth(b)} ${b.y}`;
  if (a.m !== b.m) return `${dayMonth(a)} – ${dayMonth(b)} ${a.y}`;
  // Same month: only the day number changes, so print the month once.
  if (a.precision === 'day' && b.precision === 'day') return `${a.d}–${b.d} ${MONTHS[a.m!]} ${a.y}`;
  return `${MONTHS[a.m!]} ${a.y}`;
}

/**
 * Inclusive day count: 3–8 Nov is six days, not five. That matches how the days
 * are numbered in the body of each trip, and a "Day 6" under a heading that
 * said "5 days" would be an obvious contradiction.
 *
 * Null unless both ends are known to the day — a month-precision trip has no
 * honest answer, and guessing one is how "5 days" ends up next to six headings.
 */
export function tripDays(data: TripDates): number | null {
  if (!data.start || !hasExactDates(data)) return null;
  const a = parse(data.start);
  const b = parse(data.end ?? data.start);
  const ms = Date.UTC(b.y, b.m!, b.d!) - Date.UTC(a.y, a.m!, a.d!);
  return Math.round(ms / 86_400_000) + 1;
}
