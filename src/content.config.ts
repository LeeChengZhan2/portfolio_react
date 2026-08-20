import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Content collections replace hardcoded cards.
 *
 * Adding a page means adding a markdown file. The schema is validated at
 * build time, so a missing field fails the build with a clear message
 * instead of rendering something broken. Same idea as Bean Validation,
 * applied to content.
 *
 * "Coming soon" is no longer expressible: an entry either exists or it
 * doesn't. Use `draft: true` to keep something out of production while
 * you write it.
 */

/** The four About sub-pages: personal, travel, photography, investing. */
const sections = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/sections' }),
  schema: z.object({
    title: z.string(),
    /** Nav label — usually shorter than the title. */
    navLabel: z.string(),
    /** Used for meta description and card copy. Keep it tight. */
    summary: z.string().max(180),
    /** Controls dropdown and index ordering. */
    order: z.number(),
    /** Heroicon name used in the header dropdown. */
    icon: z.enum(['user', 'globe', 'camera', 'chart', 'briefcase', 'heart']),
    /** Hidden from production builds while still being previewable in dev. */
    draft: z.boolean().default(false),
  }),
});

/** Projects and engineering work. */
const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: z.object({
    title: z.string(),
    summary: z.string().max(180),
    role: z.string(),
    /** Technologies, rendered as chips. */
    stack: z.array(z.string()).default([]),
    /** First year of work. Renders alone unless `endYear` is set. */
    year: z.number().int().min(2015).max(2100),
    /** Last year, when the work spanned several. Renders as "2023–2025". */
    endYear: z.number().int().min(2015).max(2100).optional(),
    /**
     * Employer or institution. Shown on `/work` in place of the job title, which
     * repeats down the page and says less than who the work was for. Optional:
     * self-directed work has no company and falls back to `role`.
     */
    company: z.string().optional(),
    /** Featured entries appear in the home-page carousel. */
    featured: z.boolean().default(false),
    /**
     * Work in flight right now, as opposed to something finished and dated.
     * Renders a "Current" badge everywhere the entry appears, because a bare year
     * reads as a completion date and quietly retires work that is still running.
     */
    current: z.boolean().default(false),
    order: z.number().default(0),
    repo: z.url().optional(),
    /** External write-up, e.g. the TARUMT eprints record. */
    external: z.url().optional(),
    /** Downloadable asset under public/, e.g. "/assets/documents/fyp.pdf". */
    doc: z.string().startsWith('/').optional(),
    draft: z.boolean().default(false),
  }).refine((entry) => entry.endYear === undefined || entry.endYear > entry.year, {
    message: 'endYear must be later than year — drop it for single-year work',
    path: ['endYear'],
  }),
});

export const collections = { sections, work };
