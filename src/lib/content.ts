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

export async function getWork(): Promise<CollectionEntry<'work'>[]> {
  const entries = publishable(await getCollection('work'));
  return entries.sort((a, b) => b.data.year - a.data.year || a.data.order - b.data.order);
}

export async function getFeaturedWork(): Promise<CollectionEntry<'work'>[]> {
  return (await getWork()).filter((entry) => entry.data.featured);
}
