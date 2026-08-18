# Portfolio — Lee Cheng Zhan

Personal portfolio site. Astro 7 static site with React islands, TypeScript, Tailwind v4,
GSAP + Lenis for motion.

> **Status: mid-rebuild on branch `rebuild/astro`.** Phases 1–4 of the rebuild are complete —
> the site builds, type-checks clean, and all 284 internal links resolve. It is **not ready to
> publish**: the content is still placeholder-length and the mobile navigation does not work on
> touch. See [What to do next](#what-to-do-next).
>
> Plan and rationale: [docs/REBUILD.md](docs/REBUILD.md) · Agent guidance:
> [CLAUDE.md](CLAUDE.md)

## Running it

```bash
npm install
npm run dev      # astro dev server
npm run build    # astro check && astro build  → dist/
npm run links    # internal link checker — run AFTER build
npm run preview  # serve dist/ locally
```

**Always run `npm run build && npm run links` before committing.** The link checker exists
because this project shipped seven dead nav anchors and two 404ing download links; it verifies
every internal href and fragment against `dist/`.

## Where things are

```
src/
├── pages/              file path IS the route
├── layouts/            BaseLayout — meta, OG tags, script entry
├── components/
│   ├── astro/          zero JS — the default
│   └── react/          islands ONLY — every file here has a JS cost
├── content/            markdown + zod schema (content.config.ts)
├── scripts/            plain TS: smooth-scroll, reveal, copy, horizontal-loop
└── styles/global.css   Tailwind v4 @theme — no tailwind.config.js
```

`legacy/` is the old Create React App version, kept only so prose and markup can be ported out
of it. It has no build script and nothing imports it. Delete it once the content is written.

Current cost: **49.7 KB gzipped JS per page**, plus 60.9 KB on `/` only, fetched when the
carousel scrolls into view. The CRA original shipped 101.8 KB and it blocked first paint.

---

## What to do next

Ordered. Responsive work comes before content — deliberately, because layout changes reflow
prose, so writing the case studies first would mean rewriting them to fit whatever the mobile
layout turns out to be.

### 1. Mobile navigation — the one real breakage

The header dropdowns are CSS `group-hover` + `group-focus-within`. Mouse and keyboard both
work. **Touch does not**: tapping "About Me" on a phone follows the link instead of opening
the menu, so the sub-pages are unreachable on mobile.

Needs a toggle below the `sm` breakpoint with `aria-expanded` / `aria-controls`, Escape to
close, and focus handling.

> **Constraint:** this must not become a React island. The header renders on all ten pages, so
> one island there would pull the 55.9 KB React runtime onto every page — the same mistake
> already made and reverted with the footer copy buttons. Use a delegated script in
> `src/scripts/`, the way `copy.ts` does.

### 2. Verify the hero parallax on a real phone

It was rewritten in phase 3 and has been type-checked but **never watched scrolling**. The
carousel has since been driven in a real browser and verified; the parallax has not.

While you are there, decide the optional hero `scale: 1.08 → 1` settle
([docs/REBUILD.md §12](docs/REBUILD.md)) — it may be one effect too many.

### 3. Audit every page at 390px

`/about/[slug]` and `/work/[slug]` have never been looked at on a narrow viewport. The legacy
About page used a hard two-column flex at every width with a `70vh` sticky image — on a phone
that was two ~160px columns. Confirm that did not get ported.

### 4. Then: write the content

Every markdown body is currently a 106–212 word stub.

- **BMS drivers and the FYP first** — they carry the most weight. The BMS work (HVAC, lighting,
  hardware protocol integration) is genuinely uncommon material that most developer portfolios
  cannot show.
- Flip `draft: false` on `travel.md` and `investing.md` once they have substance, or fold them
  into `personal.md` and delete them. Nothing in the code hardcodes four sections.
- Replace the CV: `public/assets/documents/` still holds only a March 2023 `.docx`.

### 5. Before publishing

- **Register the domain.** `astro.config.mjs` sets `site: 'https://leechengzhan.com'`, which is
  not registered. Every canonical URL, OG tag, and the sitemap are built from it, so search
  engines would follow canonicals into a dead host.
- **Decide site-wide `noindex` until launch.** `BaseLayout` supports it per page and defaults
  to false.
- Favicon set and `manifest.json` — only `cz.png` exists today.
- Per-project OG images — one shared PNG today.
- Carousel pause control. Reduced motion and keyboard focus are handled, but a visible pause
  button is the letter of WCAG 2.2.2. It adds visible UI, so it waits on design direction.
- Lighthouse ≥95 on mobile.

### Known documentation drift

[AGENTS.md](AGENTS.md) still prescribes Jest and React Testing Library "via `react-scripts`"
in its testing section. That stack was removed in the rebuild and there are no tests — the
decision was TypeScript plus zod content schemas plus the link checker, rather than a
component test suite. Update it when convenient.
