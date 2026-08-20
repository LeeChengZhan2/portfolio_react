import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * A date at whatever precision is actually known: `2024`, `2024-10`, or
 * `2024-10-15`.
 *
 * Partial dates are the point. "Shanghai, October 2024" is a true thing to say
 * before the exact days have been dug out of an inbox, and a schema that only
 * accepts full dates forces the choice between inventing days and leaving the
 * trip undated. Precision is read back off the string and rendered as given,
 * so a month-precision trip never displays a day it does not have.
 *
 * Kept as a string rather than coerced to a Date for two reasons: a Date is UTC
 * midnight and formats a day early anywhere west of Greenwich, and it cannot
 * represent "October 2024" at all. Strings also sort correctly once padded.
 *
 * Quote them in frontmatter — `start: '2023-11-03'`. YAML reads a bare
 * yyyy-mm-dd as a timestamp and hands zod a Date, which fails here with
 * "expected string, received object".
 */
const partialDate = z
  .string()
  .regex(
    /^\d{4}(-\d{2}(-\d{2})?)?$/,
    "use '2024', '2024-10' or '2024-10-15' — as much as you actually know",
  );

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

/**
 * Trips. One markdown file per destination, rendered as a card on
 * /about/travel and a page of its own at /about/travel/<id>.
 *
 * Dates are optional on purpose: several trips are on the list before their
 * dates have been dug out of a boarding pass. A trip with no dates still gets
 * a card and a page — it just renders "Dates to confirm" where the range goes.
 * Everything else that varies (cover photo, gallery, highlights) is optional
 * for the same reason, so a trip can go up the day it is remembered and grow
 * afterwards.
 */
const trips = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/trips' }),
  schema: ({ image }) =>
    z
      .object({
        /**
         * The place, as you would say it out loud: "Bangkok", "Taichung &
         * Taipei". Two cities in one trip go in one title rather than two
         * entries — the timeline plots trips, not stops.
         */
        title: z.string(),
        /** Sub-line on the card. Omit when it would just repeat the title. */
        country: z.string().optional(),
        /**
         * Card copy and meta description. Optional because a trip is worth
         * listing before it is worth describing; the card falls back to the
         * date range alone.
         */
        summary: z.string().max(180).optional(),
        /**
         * `2024`, `2024-10` or `2024-10-15` — see `partialDate` above. These
         * also order the page: the timeline sorts on them, newest first, so
         * there is deliberately no `order` field to disagree with the dates
         * printed beside each entry. A trip with no `start` sorts to the end.
         */
        start: partialDate.optional(),
        end: partialDate.optional(),
        /** Short labels rendered as chips. Places, not sentences. */
        highlights: z.array(z.string()).default([]),
        /** Lives in src/assets/travel/<id>/ so Astro can optimise it. */
        cover: image().optional(),
        coverAlt: z.string().optional(),
        gallery: z
          .array(z.object({ src: image(), alt: z.string() }))
          .default([]),
        draft: z.boolean().default(false),
      })
      .refine((trip) => trip.start !== undefined || trip.end === undefined, {
        message: 'end without start — add the start date or drop both',
        path: ['end'],
      })
      // String compare is safe here: both sides match the same yyyy[-mm[-dd]]
      // shape, and a shorter prefix never sorts after a longer one that extends
      // it, so '2024-10' < '2024-10-15' as intended.
      .refine((trip) => !trip.end || !trip.start || trip.end >= trip.start, {
        message: 'end must not be earlier than start',
        path: ['end'],
      })
      // Enforced here rather than left to review: a cover photo is the biggest
      // thing on the card, so it is the one image most costly to ship unlabelled.
      .refine((trip) => !trip.cover || Boolean(trip.coverAlt), {
        message: 'cover needs coverAlt — describe the photo for screen readers',
        path: ['coverAlt'],
      }),
});

export const collections = { sections, work, trips };
