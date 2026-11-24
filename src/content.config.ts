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

/**
 * One message of a made-up example chat on a showcase work page (see `showcase`
 * below). The same message is drawn in a web and a WhatsApp version.
 */
const chatMessage = z.object({
  from: z.enum(['user', 'agent']),
  text: z.string(),
  rows: z.array(z.tuple([z.string(), z.string()])).min(1).max(8).optional(),
  photo: z.string().max(16).optional(),
  replies: z.array(z.string().max(16)).min(1).max(3).optional(),
});

/**
 * A card's example chats. It shows one at a time; three is the most its
 * styles know (WorkAgentDemo.astro).
 */
const chatExamples = z
  .array(z.object({ messages: z.array(chatMessage).min(2).max(8) }))
  .min(1)
  .max(3);

/**
 * "What I built" on a showcase page for work that is not agents (`built`).
 * Written for a reader who knows nothing about the field: plain words, made-up
 * data, and a picture for every step.
 *
 * `picture` is "Where it fits": a few boxes left to right (top to bottom on a
 * phone), the one with `mine` drawn as this project. `icon` names one of the
 * Heroicons the component carries.
 *
 * `steps` is "My part": the author's work as a numbered flow (WorkSteps.astro).
 * Each step has a title, one line, and one picture in `show`, by `kind`: a
 * `list` of kinds of data, a `store` (how data is kept), a `model` (separate
 * lists into one connected model), `checks`, or a `graph` of a few rooms
 * (WorkGraphDemo.astro). The schemas for each kind follow.
 */
const pictureStep = z.object({
  icon: z.enum(['building', 'database', 'sparkles']),
  title: z.string().max(40),
  text: z.string().max(120),
  mine: z.boolean().default(false),
  link: z.string().startsWith('/').optional(),
  linkText: z.string().max(30).optional(),
});

/**
 * Kinds of data under an optional `title`, each with what it holds. An item
 * with `url` and `json` opens, as a dropdown, to an example request and the
 * JSON that comes back: made up, on example.com, so no reader takes it for a
 * real endpoint. The JSON must parse, or the build fails; it is drawn as
 * written, so keep its lines short for a phone.
 */
const listShow = z.object({
  kind: z.literal('list'),
  title: z.string().max(40).optional(),
  hint: z.string().max(40).optional(),
  items: z
    .array(
      z
        .object({
          name: z.string().max(24),
          text: z.string().max(60),
          url: z
            .string()
            .regex(/^https:\/\/[a-z0-9.-]+\.example\.com\/\S*$/, 'use a made-up https URL on example.com')
            .optional(),
          json: z
            .string()
            .refine(
              (text) => {
                try {
                  JSON.parse(text);
                  return true;
                } catch {
                  return false;
                }
              },
              { message: 'json must be valid JSON' },
            )
            .optional(),
        })
        .refine((item) => Boolean(item.url) === Boolean(item.json), {
          message: 'give an item both url and json, or neither',
        }),
    )
    .min(2)
    .max(6),
});

/**
 * Where fetched data goes and how it is kept: a short `flow` of boxes, a
 * sample of the table (`columns`, one to three `rows`), the design choices
 * behind it (`notes`), and a `note` at its foot. Plain words, no product or
 * table names.
 */
const storeShow = z
  .object({
    kind: z.literal('store'),
    flow: z.array(z.object({ name: z.string().max(20), text: z.string().max(36) })).min(2).max(3),
    columns: z.array(z.string().max(12)).min(2).max(4),
    rows: z.array(z.array(z.string().max(12))).min(1).max(3),
    notes: z.array(z.string().max(80)).min(1).max(5),
    note: z.string().max(40).optional(),
  })
  .refine((store) => store.rows.every((row) => row.length === store.columns.length), {
    message: 'every row needs one value per column',
  });

/**
 * Separate lists in, one connected model out: `from` is the client's records
 * as [list, value]; `to` is the model as a tree, each entry with its `depth`,
 * the plain-word `type` first and the standard's `code` beside it.
 */
const modelShow = z.object({
  kind: z.literal('model'),
  from: z.array(z.tuple([z.string().max(12), z.string().max(48)])).min(1).max(4),
  to: z
    .array(
      z.object({
        depth: z.number().int().min(0).max(4),
        name: z.string().max(26),
        type: z.string().max(28),
        code: z.string().max(20).optional(),
      }),
    )
    .min(2)
    .max(6),
});

/** A short list of things that are always true, each with a tick. */
const checksShow = z.object({
  kind: z.literal('checks'),
  items: z.array(z.string().max(90)).min(2).max(5),
});

/**
 * The knowledge graph (WorkGraphDemo.astro), drawn as a few rooms of one
 * building: `rows` of rooms from the top down, on three columns so it fits a
 * phone. A room starts at column `at` (or after the room before it) and is
 * `span` columns wide (or one per unit); its `units` sit one to a column,
 * from its first or at their own `at`. A room with an `id` is a place links
 * can point to. `links` are [from, label, to], from a unit to a unit or room
 * in the row just above or below: in the same column the line runs straight,
 * otherwise it turns into the side of the unit it points to. `notes` are the
 * choices behind the graph. Kept small on purpose: the author found two
 * floors and eight units too much.
 */
const graphRoom = z.object({
  name: z.string().max(14),
  id: z.string().optional(),
  at: z.number().int().min(0).max(2).optional(),
  span: z.number().int().min(1).max(3).optional(),
  units: z
    .array(z.object({ id: z.string(), name: z.string().max(16), at: z.number().int().min(0).max(2).optional() }))
    .max(3)
    .default([]),
});

const graphShow = z
  .object({
    kind: z.literal('graph'),
    rows: z.array(z.array(graphRoom).min(1).max(3)).min(2).max(4),
    links: z.array(z.tuple([z.string(), z.string().max(10), z.string()])).min(1).max(8),
    notes: z.array(z.string().max(90)).min(1).max(3),
  })
  .superRefine((graph, ctx) => {
    const rowOf = new Map<string, number>();
    const units = new Set<string>();
    graph.rows.forEach((row, r) => {
      let next = 0;
      for (const room of row) {
        const start = room.at ?? next;
        const span = room.span ?? Math.max(1, room.units.length);
        const cols = room.units.map((unit, k) => unit.at ?? start + k);
        if (start < next || start + span > 3) {
          ctx.addIssue({ code: 'custom', message: `row ${r + 1}: "${room.name}" overlaps another room or runs past three columns` });
        }
        if (cols.some((c) => c < start || c >= start + span) || new Set(cols).size < cols.length) {
          ctx.addIssue({ code: 'custom', message: `row ${r + 1}: each unit in "${room.name}" needs a column of its own inside it` });
        }
        next = start + span;
        for (const id of [...(room.id ? [room.id] : []), ...room.units.map((unit) => unit.id)]) {
          if (rowOf.has(id)) ctx.addIssue({ code: 'custom', message: `id "${id}" is used twice` });
          rowOf.set(id, r);
        }
        for (const unit of room.units) units.add(unit.id);
      }
    });
    for (const [from, , to] of graph.links) {
      const a = rowOf.get(from);
      const b = rowOf.get(to);
      if (!units.has(from)) {
        ctx.addIssue({ code: 'custom', message: `a link starts at "${from}", which is not a unit` });
      } else if (b === undefined) {
        ctx.addIssue({ code: 'custom', message: `a link ends at "${to}", which no unit or room has as its id` });
      } else if (a === undefined || Math.abs(a - b) !== 1) {
        ctx.addIssue({ code: 'custom', message: `the link from "${from}" to "${to}" must join neighbouring rows` });
      }
    }
  });

/** One step of "My part": a title, one line, and its picture. */
const builtStep = z.object({
  title: z.string().max(50),
  text: z.string().max(180),
  show: z.discriminatedUnion('kind', [listShow, storeShow, modelShow, checksShow, graphShow]),
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
    /**
     * The product's own public website, when the work shipped as one, e.g.
     * "https://aibe.now/". A showcase page draws it as a "Visit aibe.now"
     * button under the role line, named by its host and opening in a new tab
     * like the other outside links. zod refuses it on an entry without
     * `showcase`, whose layout has no place for it.
     */
    site: z.url().optional(),
    /**
     * Optional case-study visuals, for readers who skim (recruiters, interviewers).
     * Each renders only when present, so an entry without them is unchanged.
     *
     * `highlights` — headline numbers as stat tiles under the header. A string
     * value, so "500+" and "50%" render exactly as written; quote bare numbers
     * in YAML ("10"), or zod sees a number. Four at most: that is one row on a
     * desktop and two on a phone.
     */
    highlights: z
      .array(z.object({ value: z.string().max(8), label: z.string().max(40) }))
      .max(4)
      .default([]),
    /**
     * `chat` — a short made-up conversation showing the product as a user sees
     * it, rendered between the highlights and the body. User-level only: what
     * someone types and what comes back, never how it works inside. Label made-up
     * numbers as such. Quote a bare "Yes" in YAML, or it may parse as a boolean.
     */
    chat: z
      .object({
        label: z.string().optional(),
        messages: z
          .array(z.object({ from: z.enum(['user', 'agent']), text: z.string() }))
          .min(2)
          .max(8),
      })
      .optional(),
    /**
     * `showcase` — opt-in product layout for a work page (WorkShowcase.astro).
     * Entries without it keep the standard layout, unchanged.
     *
     * Open by default is the author's own work: the title, role, the markdown
     * body (what they did) and the tech, then `agents`, the agents they built.
     * An agent with `features` gets a section of its own, one card per feature;
     * an agent with `examples` is one card, and those cards sit together in a
     * collapsed section. Every card holds one to three `examples` (short chats)
     * and shows one at a time, as a web chat or as WhatsApp; `channel` is the
     * version shown first, and a feature may set its own. An agent with
     * features may also carry `link` and `linkText`, a link under its line to
     * another page: building operations links to the data platform it reads
     * from, which links back. Below, `platform` is a
     * collapsed section about the whole team project, with the `highlights`
     * numbers on its header.
     *
     * Work that is not agents uses `built` instead ("What I built"): a
     * `picture` of where the project fits, then the author's `steps` as a
     * numbered flow, each with its picture (see the schemas above). A page has
     * `agents`, `built` or both.
     *
     * `location` follows the company on the role line. `tech` groups the tools
     * under plain-English labels ("Databases": ClickHouse, ...), so a reader who
     * does not know a name still sees what it is for; without it the page shows
     * `stack`, and a card keeps its seven chips either way. In a message, `text`
     * keeps its line breaks, `rows` adds label/value pairs under it (a table on
     * the web, bold-label lines on WhatsApp), `photo` draws a made-up photo
     * labelled with it, and `replies` are quick-reply buttons: quote "Yes" and
     * "No", or YAML may read a boolean. `platform.headline` may wrap one phrase
     * in *asterisks* to set it in the accent colour; a platform item with
     * `mine: true` is badged as the author's, and one with `shared: true` as
     * work they did with someone else. `platform.note` is one line under the
     * headline, for who built what.
     */
    showcase: z
      .object({
        location: z.string().optional(),
        tech: z
          .array(z.object({ group: z.string().max(16), items: z.array(z.string()).min(1).max(6) }))
          .max(6)
          .optional(),
        agents: z
          .array(
            z
              .object({
                name: z.string().max(40),
                text: z.string().max(200),
                /** A page `text` points to, linked under it, as on a picture step. */
                link: z.string().startsWith('/').optional(),
                linkText: z.string().max(30).optional(),
                channel: z.enum(['whatsapp', 'web']),
                examples: chatExamples.optional(),
                features: z
                  .array(
                    z.object({
                      name: z.string().max(30),
                      text: z.string().max(160).optional(),
                      /** Shown first on this card; the agent's `channel` when left out. */
                      channel: z.enum(['whatsapp', 'web']).optional(),
                      examples: chatExamples,
                    }),
                  )
                  .min(2)
                  .max(8)
                  .optional(),
              })
              .refine((agent) => Boolean(agent.examples) !== Boolean(agent.features), {
                message: 'give an agent either examples (one card) or features (a card per feature)',
              })
              .refine((agent) => !agent.link || Boolean(agent.features), {
                message: 'a link is drawn under an agent with features; a one-card agent has no place for it',
              }),
          )
          .min(1)
          .max(8)
          .optional(),
        built: z
          .object({
            picture: z.array(pictureStep).min(2).max(4),
            steps: z.array(builtStep).min(2).max(6),
          })
          .optional(),
        platform: z
          .object({
            title: z.string().max(60),
            tag: z.string().max(30).optional(),
            headline: z.string().max(100),
            note: z.string().max(160).optional(),
            groups: z
              .array(
                z.object({
                  name: z.string().max(40),
                  items: z
                    .array(
                      z
                        .object({
                          text: z.string().max(140),
                          mine: z.boolean().default(false),
                          shared: z.boolean().default(false),
                        })
                        .refine((item) => !(item.mine && item.shared), {
                          message: 'an item is mine or shared, not both',
                        }),
                    )
                    .min(1)
                    .max(8),
                }),
              )
              .min(2)
              .max(8),
            channels: z.array(z.string()).max(8).optional(),
            /** Tools the team used that the author's own work did not. */
            tech: z.array(z.string()).max(12).optional(),
          })
          .optional(),
      })
      .refine((showcase) => Boolean(showcase.agents?.length || showcase.built), {
        message: 'a showcase needs agents, built or both',
      })
      .optional(),
    /**
     * `flow` — "How it works" as a left-to-right diagram after the body: a few
     * words per step, plus an optional tech label and a closing note.
     */
    flow: z
      .object({
        steps: z
          .array(z.object({ title: z.string(), text: z.string(), tech: z.string().optional() }))
          .min(2)
          .max(4),
        note: z.string().optional(),
      })
      .optional(),
    /** `challenges` — problem → fix → result stories, as cards after the flow. */
    challenges: z
      .array(
        z.object({
          title: z.string(),
          problem: z.string(),
          fix: z.string(),
          result: z.string(),
        }),
      )
      .default([]),
    draft: z.boolean().default(false),
  }).refine((entry) => entry.endYear === undefined || entry.endYear > entry.year, {
    message: 'endYear must be later than year — drop it for single-year work',
    path: ['endYear'],
  }).refine((entry) => !entry.site || Boolean(entry.showcase), {
    message: 'site is drawn by the showcase layout only: add showcase, or drop site',
    path: ['site'],
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
