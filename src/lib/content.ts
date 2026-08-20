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
