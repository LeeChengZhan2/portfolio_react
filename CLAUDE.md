# CLAUDE.md

Guidance for Claude Code when working in this repository.

> **Mid-rebuild on branch `rebuild/astro`.** The Astro site in `src/` is the live project.
> The old CRA app is parked in `legacy/` as porting reference only — it has no build script
> and is wired into nothing. Full plan and rationale: [docs/REBUILD.md](docs/REBUILD.md).

## Build state

> **Checkpoint — 18 Aug 2026.** Phases 1–4 complete, plus a dark theme on top. Stopping point
> chosen deliberately: **responsive/mobile work happens next, before phase 5 content.** That
> inverts the order in docs/REBUILD.md §10, and it is the right call — layout changes reflow
> prose, so writing the case studies first would mean rewriting them to fit whatever the mobile
> layout turns out to be. Content is the long pole but it is not the blocker; the phone
> experience is.
>
> The dark theme (18 Aug) was not in the plan for this slot. It landed early because it needed
> a semantic-token layer that did not exist, and every day of new markup written against
> literal `gray-*` shades made that refactor bigger. See "Theming contract".

Phases 1–4 are done on branch `rebuild/astro`. The Astro site builds, type-checks clean, and
all 518 internal links resolve. Legacy CRA source is parked in `legacy/` for reference during
the port — delete it once phase 5 content is written.

```bash
npm run dev      # astro dev
npm run build    # astro check && astro build  → dist/
npm run links    # post-build internal link checker (run after build)
npm run preview  # serve dist/ locally
```

Measured, gzipped, after the dark theme landed:

| | every page | `/` only |
|---|---|---|
| Eager JS (blocks nothing, `type="module"`) | **49.8 KB** | 49.8 KB |
| CSS | **7.6 KB** | 9.7 KB |
| Astro island bootstrap (inline) | 0.1 KB | 1.9 KB |
| Island, fetched on scroll into view | — | **58.1 KB** |
| Lazy SplitText, on pages with split reveals | 3.2 KB | 3.2 KB |

Eager JS rose 49.7 → 49.8 KB: `theme.ts` joined the bundled module script, and 0.1 KB is the
whole cost of the theme toggle. It is a delegated listener, not an island — see below. CSS is
newly tracked here; the theme layer is ~0.4 KB of it.

The travel section (20 Aug 2026) costs **0.36 KB gz of JavaScript, on `/about/travel` alone** —
the layout toggle, and nothing else. The trip pages and the timeline itself ship none.

Measured by walking the emitted module graph, not by scraping `<script src>` out of the HTML:
GSAP is reached through static imports between chunks, so an HTML-only count misses most of it
and reports a number that moves when Rolldown re-chunks. Site-wide eager JS went 50.0 → 50.3 KB
gz, and the 0.3 KB is re-chunking, not code: `trips-view.ts` is a third importer of
ScrollTrigger, so Rolldown hoisted it out of the BaseLayout entry into its own chunk, and two
chunks compress slightly worse than one. Exactly the effect already documented above for GSAP.

| | before | after |
|---|---|---|
| `gsap.*.js` | 26.41 | 26.41 |
| `ScrollTrigger.*.js` | — | 17.01 |
| BaseLayout entry | 23.59 | 6.88 |
| travel toggle (`/about/travel` only) | — | 0.36 |

Shared CSS moved 7.73 → 8.01 KB gz. The travel timeline carries 2.7 KB of page-scoped CSS —
high because it holds two complete layouts — and a trip page 1.7 KB, against 1.4 KB for a plain
About section.

**Seven light themes and the picker (22 Aug 2026)** moved shared CSS 8.01 → 9.66 KB gz and
site-wide eager JS 50.3 → 50.9 KB gz. The CSS is seven complete sixteen-token blocks plus the
picker's styles; the JS is the picker's open/close, selection and persistence joining the
existing `theme.ts` in the BaseLayout entry chunk. **No island, on a component that is on every
page** — that is what the 0.6 KB buys instead of 55.9 KB of React runtime everywhere.

The eager figure rose 49.2 → 49.7 KB on *all fifteen pages* because GSAP now has two importers
(the BaseLayout script and the island), so Rolldown hoists it into a shared
`_astro/gsap.*.js`. Two chunks compress slightly worse than one — that 0.5 KB is the entire
site-wide cost, and in exchange the island does not re-download GSAP.

The 60.9 KB island figure is React itself (55.9 KB runtime + 2.8 KB renderer shim) plus
2.2 KB of carousel. **It is only requested when the carousel scrolls into view, only on `/`,
and never blocks paint.** Worth being straight about the trade: as a plain script the same
behaviour would cost ~2 KB. The island is a deliberate learning-goal decision
(docs/REBUILD.md §2), not the cheap option — see "Islands" below.

Legacy CRA shipped 101.8 KB gz and it blocked first paint.

Routes live: `/`, `/about`, `/about/{personal,travel,photography,investing}`,
`/about/travel/{chengdu,tokyo,phuket,taiwan,bali,guangzhou-shenzhen,shanghai,bangkok}`, `/work`,
`/work/{ai-agent-bms,cloud-data-platform,bms-platform,alliance-bank,bank-negara,school-fyp,open-source}`,
`/404`, `/theme-preview`, `/about/travel-preview` — 25 pages. The last two are `noindex` and
excluded from the sitemap. `/theme-preview` is the eight light themes side by side, reachable
from the picker in the header; `/about/travel-preview` is the travel page with a 3D earth under
the timeline, reachable from a small link on `/about/travel`. Both are throwaway.

**Content was rewritten against the author's CV on 19 Aug 2026**, which moved the site's
whole story. It used to say "BMS driver development"; the CV says the current work is
production AI agents and the cloud data platform under them, so `/work` gained
`ai-agent-bms` and `cloud-data-platform`, and `bms-drivers` became `bms-platform` (renamed,
because the entry is no longer about drivers). `school-fyp` is now the real project,
*Game Theory in Baseball*, pulled from the report PDF in `public/assets/documents/`.

**One entry per project, not per employer.** The AceAtt work was briefly a single
`java-finance` entry holding both client projects, which was inconsistent with splitting
Primustech's three items into three entries — the CV structures both employers the same way.
It is now `alliance-bank` and `bank-negara`. The old entry also claimed Spring Boot and
Kafka; per the CV, Spring Boot belongs to the Singapore BMS work and Kafka appears nowhere,
so do not reintroduce either.

Every rewritten body carries a comment at the foot naming what came from the CV and what
still needs the author's own material. They are drafts with the right shape and true facts,
not finished prose. `/about/travel` and `/about/investing` additionally carry the older
`DRAFT` markers from 18 Aug 2026.

### Next up (resume here) — responsive, then content

**Now: make the site work on a phone.** In priority order.

1. **Mobile nav.** The only genuine breakage. `Header.astro` dropdowns are `group-hover` +
   `group-focus-within`, so keyboard works and touch does not — tapping "About Me" on a phone
   follows the link instead of opening the menu. Needs a real toggle below `sm`, with
   `aria-expanded`/`aria-controls`, Escape to close, and focus handling.
   **Must not become a React island** — the header is on all fifteen pages, and one island there
   pulls the 55.9 KB React runtime onto every one of them. Use a delegated script in
   `src/scripts/`, the way `copy.ts` and `theme.ts` do.
   `ThemeToggle.astro` now sits in `.nav-container` alongside the links, so the mobile layout
   has to place it deliberately — it should stay reachable when the nav is collapsed, not get
   swept inside the drawer. `theme.ts` is delegated on `document`, so it keeps working wherever
   the button ends up.
   **`ThemePicker.astro` is the model to copy** (22 Aug 2026): click-driven, delegated from
   `theme.ts`, `aria-expanded`/`aria-controls`, Escape with focus returned, outside-click and
   focus-out dismissal, and it hides itself behind `html.js`. Its menu is centred on the
   `.navbar` rather than on its own button — the picker sets no `position`, so the sticky header
   is the containing block — which is why a 30rem panel cannot overflow a 390px screen.
   One piece is already done (22 Aug 2026): the dropdowns are anchored `right-0` below `sm` and
   only centred from `sm` up. A centred `w-60` panel hung past the right edge of a 390px
   viewport, and because it stays in layout while invisible that was 48px of sideways scroll on
   every page with nothing on screen to explain it. Right-anchoring cannot overhang. Keep that
   split when the drawer replaces this.
2. **Verify the hero parallax on a real phone.** Rewritten, type-checked, never watched
   scrolling. The carousel *has* been driven in a browser (see "Carousel" below); this has not.
   Decide the optional `scale: 1.08 → 1` (docs/REBUILD.md §12) at the same time — it may be
   one effect too many.
3. **Audit every page at 390px.** `/about/[slug]` and `/work/[slug]` have never been looked at
   on a narrow viewport. Legacy's `about-flex-container` was a hard two-column flex at every
   width; confirm that did not get ported. `/about/travel` and `/about/travel/[trip]` (20 Aug
   2026) have been driven in Chrome at 390px and 1280px in both themes, including a geometry
   probe confirming the timeline dots centre on the rail at both breakpoints. The parts still
   unwatched there are the ones needing real photos: the cover frame and the gallery grid.

**After responsive, phase 5 — content.** The travel half is now scaffolded rather than written:
eight trip files exist with real dates and empty day headings (20 Aug 2026), and filling them
is the author's job, not Claude's — see "Travel" under Content. No longer stubs: the 19 Aug
2026 CV pass took every work entry to 300–500 words of true, specific material. What is left is the author's own
voice and the details a CV cannot carry — each file's closing comment lists them per page.
The two highest-value ones are a real debugging story on `bms-platform`, and naming the
building-data standard on `cloud-data-platform`.

New PDF CV — `public/assets/documents/` still holds only the Mar 2023 `.docx`, which now
describes a role two jobs out of date, and `Footer.astro` still links it as "Download CV".

**Open decisions, not code.** Site-wide `noindex` until launch (`BaseLayout` supports it per
page, defaults false, and canonicals point at the unregistered `leechengzhan.com`). Carousel
pause control — reduced motion and keyboard focus are handled, but a visible pause button is
still the letter of WCAG 2.2.2; it adds visible UI, so it waits on design direction
(docs/REBUILD.md §12).

**Always run `npm run build && npm run links` before committing.** The link checker is what
stops the dead-anchor bug from coming back.

**Theme changes need a real browser, not just a build.** `astro check` does not validate CSS at
all — a broken `@theme` or an unknown utility in `@apply` passes `check` and only fails in
`astro build`, and neither says anything about whether the page *looks* right. The dark theme
was verified by driving Chrome through Playwright: every route under both OS settings with and
without a stored choice, plus toggle, persistence, live-OS-change-is-ignored, no-JS, and a
frame-by-frame no-flash probe. Two real bugs surfaced there that the build was perfectly happy
with: an invisible footer boundary, and cards reading as recessed instead of raised.

## Legacy app (`legacy/`, reference only)

The CRA 5.0.1 / React 18 original, moved out of `src/` on 12 Aug 2026. Excluded from
`tsconfig.json`, no build script, imported by nothing. It exists so prose and markup can be
ported out of it — delete once phase 5 content is written.

**Bugs it shipped. The rebuild already addresses all of these — do not re-report them:**
- 7 header dropdown anchors (`#about-intro`, `#portfolio-photography`, …) pointed at IDs that
  never existed. They are real routes now.
- Both document links used bare `/assets/documents/…` and 404'd under the `/portfolio_react/`
  base path, while images correctly used `process.env.PUBLIC_URL`. Serving from a domain root
  removes the whole class of bug.
- `smoothTouch` is not a real Lenis option (it is `syncTouch`) and was silently ignored — so
  touch has always been native. `smooth-scroll.ts` keeps it that way deliberately.
- `reportWebVitals()` was called with no argument, so it no-opped.
- 4 dependencies had zero imports: `react-router-dom`, `@headlessui/react`,
  `embla-carousel-auto-scroll`, and one half of the `motion`/`framer-motion` duplicate.

## Target architecture

Astro 7 static site with React islands. Rendering happens at build time; JavaScript ships only
for components marked with a `client:*` directive.

| Layer | Package | Version |
|-------|---------|---------|
| Framework | `astro` | 7.2.0 |
| Build | `vite` (via Astro) | 8.2.1 |
| Islands | `react` / `react-dom` | 19.2.8 |
| Styling | `tailwindcss` + `@tailwindcss/vite` | 4.3.3 |
| Animation | `gsap` + `@gsap/react` | 3.15.0 / 2.1.2 |
| Smooth scroll | `lenis` | 1.3.26 |

**Removed in the rebuild:** `react-scripts`, `react-router-dom`, `@headlessui/react`,
`framer-motion`, `motion`, `embla-carousel-react`, `embla-carousel-auto-scroll`, `web-vitals`.

### Locked decisions — do not re-litigate

1. **TypeScript**, strict.
2. **Multi-page, separate sub-pages** (confirmed 12 Aug 2026): `/`, `/about`,
   `/about/{personal,travel,photography,investing}`, `/work`, `/work/[slug]`. These are their
   own routes, **not anchors on one page** — an earlier draft of this file said anchors and was
   wrong. Merge a section back into `/about` only if it stays too thin to justify a page.
3. **Carousel keeps its behaviour** (seamless loop, smooth slow-on-hover) but is reimplemented
   with GSAP `horizontalLoop()` + tweened `timeScale()`. Embla is dropped. The official
   `embla-carousel-auto-scroll` plugin only offers a hard `stopOnMouseEnter`, which is why it
   is not the answer here.
4. **Animation lives in `src/scripts/reveal.ts`**, driven by `data-reveal="…"` attributes.
   Hero parallax is being rewritten — see below.

### Revised after measurement — copy buttons are NOT an island

An earlier version of this file said the copy buttons should stay a React island for
learning value. **That was wrong and has been reverted.** Measured: the footer is on every
page, so one island there pulled the React runtime (~55 KB gzipped) onto *every* page for
three buttons. Total per-page JS went from 49 KB to ~104 KB — worse than the CRA site it
replaces.

Copy buttons are now `src/components/astro/CopyButton.astro` plus a delegated listener in
`src/scripts/copy.ts`. **The carousel remains the React island** — real state, one page
only — so the island model still gets exercised.

Rule of thumb this established: an island in a site-wide component (header, footer, layout)
costs the framework runtime on every page. Islands belong on leaf pages.

## Carousel (`src/components/react/Carousel.tsx`) — built, verified in a browser

The site's only React island, mounted `client:visible` on `/` alone. `horizontalLoop()` is
ported into `src/scripts/horizontal-loop.ts`; hover tweens the timeline's `timeScale()`.

Numbers matched to the legacy Embla implementation rather than invented:

| | Legacy | Now |
|---|---|---|
| Base speed | 2.0 px/frame @60fps = 120 px/s | `speed: 1.2` → 120 px/s |
| Hover speed | 0.6 px/frame = 36 px/s | `timeScale` 0.3 → 36 px/s |
| Ease to new speed | 0.08/frame lerp, ~0.6s to settle | `power2.out`, `duration: 0.6` |

Measured in Chrome: 120.0 px/s base, 36.2 px/s hovered (0.30×), easing through ~81 px/s
mid-transition — a ramp, not a step, which is the whole point of choosing GSAP over
`embla-carousel-auto-scroll`.

Things that will look like bugs but are deliberate:

- **The card count changes after hydration.** Server-rendered HTML holds one set of 3 cards;
  the island re-renders to 12 once it knows the loop will run. Duplicates are meaningless
  without motion, and 12 repeated cards is the wrong no-JS/reduced-motion experience. Copies
  carry `aria-hidden` + `tabIndex={-1}` so assistive tech still reads three projects.
- **`overflow-x: auto` until the loop starts**, then `overflow: hidden`. That is what keeps
  every card reachable with no JS, before hydration, and under reduced motion.
- **Hover is gated on `pointerType === "mouse"`.** Touch fires `pointerenter` on tap and never
  a matching `pointerleave`, which would strand the carousel at the slow speed forever.
- **Focus stops the loop outright** (`timeScale` 0), not merely slowing it — a keyboard user
  cannot click a link that is sliding away.
- **No drag.** The upstream `horizontalLoop` supports `draggable: true`, but that pulls
  Draggable + InertiaPlugin (~15 KB gz) into the island. Legacy had drag via Embla; this
  does not. Restore it from the CodePen linked in `horizontal-loop.ts` if it is wanted —
  it is a deliberate omission, not an oversight.

When changing any of this, re-verify in a real browser. `astro check` type-checks the file
but proves nothing about whether it moves — that is exactly how the hero parallax ended up
shipped-but-unwatched.

**If the carousel renders but does not move in `npm run dev`, it is not the carousel.** Fixed
22 Aug 2026 with `vite.optimizeDeps.include` in `astro.config.mjs`, and worth knowing because
the symptom points at the wrong file. `gsap` and `@gsap/react` are reached only from this
island, which is `client:visible`, so Vite never saw them until the carousel scrolled into
view — mid-session. Discovering a dependency that late forces a re-optimize, the dep hash
changes, and the island's in-flight import dies on
`504 (Outdated Optimize Dep) /node_modules/.vite/deps/@gsap_react.js`. The island then never
hydrates: three static cards, `overflow-x: auto`, no loop, and nothing in the page that looks
broken. Pre-bundling those three specifiers at server start leaves nothing to discover.
It survived clearing `node_modules/.vite` and restarting, so do not go looking for a stale
cache — late discovery is structural, and it repeats on every load.

**Production builds never had this**, which is the tell: the built site resolves the whole
module graph up front. Measured at 121 px/s in both `npm run preview` and `npm run dev` after
the fix, against the 120 px/s the constants intend.

### Directory convention

Components are split by **rendering cost**, not feature:

- `src/components/astro/` — zero JS. The default. Anything without runtime interactivity.
- `src/components/react/` — islands only. Every file here has a JS cost.

Note the pricing: the React runtime is paid once on the first island, then shared. 0→1 island
is a real jump; 1→3 is nearly free.

## Tailwind v4 gotcha

`@apply` inside an Astro `<style>` block needs `@reference "#styles";` as the first line, or
the build fails with *"Cannot apply unknown utility class"*. `#styles` is a `package.json`
subpath import pointing at `src/styles/global.css`, so the path never breaks when files move.
Every component style block that uses `@apply` already has it — copy an existing one.

## Theming contract

Light and dark, driven by **semantic tokens**. Three things must stay in step.

**1. Markup uses semantic tokens, never literal shades.** `text-gray-700` in a component is a
bug — it will not respond to the theme. The full set lives in the `@theme static` block in
`src/styles/global.css`:

| Role | Token | Light | Dark |
|---|---|---|---|
| Page | `bg` | `#ffffff` | `#0d0d0f` |
| Full-width band stepping off the page | `band` | `#f3f4f6` | `#17171c` |
| Panel raised above page or band | `surface` | `#ffffff` | `#212128` |
| Recessed detail — chips, hovers | `surface-2` | `#f3f4f6` | `#2e2e37` |
| Headings, strong text | `fg` | `#111827` | `#f2f2f3` |
| Body prose | `fg-body` | `#374151` | `#c3c3c9` |
| Summaries | `fg-muted` | `#4b5563` | `#a6a6ae` |
| Eyebrows, years, labels | `fg-meta` | `#6b7280` | `#94949e` |
| Icons | `fg-faint` | `#9ca3af` | `#7d7d88` |
| Hairlines | `line` / `line-strong` | `#e5e7eb` / `#d1d5db` | `#3a3a46` / `#52525f` |
| Links, hovers, focus ring | `accent` | `#002fa7` | `#7aa2ff` |
| Solid buttons | `invert` / `on-invert` | `#111827` / `#ffffff` | `#f2f2f3` / `#0d0d0f` |
| Footer | `footer` / `footer-fg` | `#1f2937` / `#e5e7eb` | = `band` / `#c3c3c9` |

Things that look wrong but are deliberate:

- **`band` and `surface-2` share a light value and diverge in dark.** They were one token until
  the carousel showed why they cannot be: on a light page you recede by going *darker*, on a
  dark page by going *lighter*. One token put cards above the band in light and below it in
  dark. Cards must read as raised in both.
- **`invert`/`on-invert` swap, so `hover:bg-accent` needs no hover text colour.** `on-invert` is
  white in light and near-black in dark, exactly co-varying with `accent`. Both directions clear
  WCAG AA (10.8:1 and 7.8:1).
- **`kleinblue` is still in the palette but is no longer referenced by markup.** It is 10.8:1 on
  white and 1.8:1 on the dark page, so `accent` aliases it in light and replaces it in dark.
- **In dark the footer IS a band** — `--color-footer: var(--color-band)`, aliased rather than
  copied so the two cannot drift apart. It reads as the last alternating band instead of its
  own kind of thing, and it inherits the bg→band step (1.09:1, ΔEok 4.7) against the plain
  `bg` section that ends every page — the same step that separates bands mid-page, so the
  boundary needs no hairline. Light keeps its own `#1f2937`, where the footer is a dark island
  against a white page.
  Three earlier attempts, so they are not retried: `#17171a` matched the old `surface` and read
  as a stray card; `#08080a` sat 1.03:1 under the page and was simply invisible; a blue slate
  `#0f1c36` separated cleanly by hue but looked out of place on an otherwise neutral site.
- **The dark ramp is spaced by perceptual steps, not equal hex steps.** sRGB gamma compresses
  the bottom of the range, so equal hex distances are not equal visual distances down there.
  Measured in OKLab L* (×100): `bg`→`band` is Δ4.7 and `band`→`surface` Δ4.4, roughly double
  the Δ2.8 / Δ1.8 they were. The old `band`→`surface` gap of Δ1.8 (1.04:1) was the bug — cards
  read as flat rectangles rather than raised panels, and alternating sections read as one wall.
  Do not compress these again to make the theme look "sleeker"; that is the failure this fixed.
  `fg-meta` and `fg-faint` moved up with the surfaces beneath them — left alone, `fg-faint`
  would have fallen to 3.1:1 on `surface-2`, under the 3:1 floor for the icons that use it.

**2. Light is the default, and the OS is deliberately not consulted.** There is exactly one dark
block, `:root.dark`, and the only thing that sets that class is the toggle. A visitor on a
dark-themed machine gets the light site until they press the button.

There is intentionally **no `@media (prefers-color-scheme: dark)` block**. Adding one back would
reinstate OS-following, and would also reintroduce a duplicated token block — CSS cannot share
one declaration block between a media query and a class selector, so the dark values would have
to be written twice and kept in sync by hand. An earlier revision did exactly that and needed a
`scripts/check-theme.mjs` build gate to police it; both are gone with the media query.

**3. Do NOT use `@theme inline`, and keep `@theme static`.** `inline` substitutes literal values
into utilities, which defeats the whole override mechanism. `static` stops Tailwind pruning
tokens nothing happens to reference — that is real, not theoretical: `--color-fg-faint` is only
reached through `@apply`, and it silently vanished from `:root`, surviving on the literal
fallback Tailwind bakes into reference-mode output.

**How a theme is chosen.** `.dark` is the only *dark* class — there is no `.light`, because
nothing needs one once no media query has to be overridden. Light itself now has a second
class, `.theme-<id>`, for the palette variants; the two are independent and `:root.dark`
outranks all of them. The `is:inline` head script in `BaseLayout.astro` applies both before
first paint — dark verified with a 242-frame probe that never sampled a light frame, the light
variants with an eight-frame probe after reload that never sampled a Classic frame.
`src/scripts/theme.ts` handles the clicks and nothing else. The controls are
`src/components/astro/ThemeToggle.astro` and `ThemePicker.astro` — delegated listeners,
**not islands**, because the header is on every page. See "Light theme variants" below.

Failure modes, all landing on Classic light: JS disabled (no class is ever added, and both
controls hide themselves behind the `html.js` gate), and `localStorage` throwing in private
mode (the try/catch swallows it; the controls still work for that page view but are not
remembered).

### Light theme variants and the picker (22 Aug 2026)

The author's complaint was glare: the light theme is too bright, worst in the second after
leaving dark. The answer shipped is **eight light themes and a picker in the header**, not one
replacement default — the brightness that is comfortable is a matter of screen, room and eyes,
and the site can just let the reader say.

**Classic is still the default.** Nothing about a first visit changed: no class on `<html>`,
the base `@theme static` values, the white theme exactly as it shipped. The other seven are
opt-in and remembered.

| Theme | Page | Character |
|---|---|---|
| Classic | `#ffffff` · 100 L* | The original. Klein blue. |
| Paper (`warm-paper`) | `#faf7f2` · 97.7 | Warm ivory, warm-gray ink, softer navy |
| Soft gray | `#f4f5f7` · 97.0 | Neutral gray page, near-white cards, Klein blue |
| Sage | `#eef1ec` · 95.4 | Green-tinted, deep green accent |
| Sepia | `#f3ebdd` · 94.3 | Tan page, brown ink, rust accent |
| Mist | `#eef2f6` · 95.9 | Cool blue-gray, deep teal accent |
| Lavender | `#f1eff7` · 95.6 | Violet-tinted, indigo accent |
| Clay | `#f6eeec` · 95.5 | Warm rose, brick accent |

Every one of the seven was measured, not eyeballed: body prose 7.8–8.7:1 (AA needs 4.5),
eyebrow text over 4.5:1 on both page and band, `fg-faint` over the 3:1 UI floor on `surface-2`,
and the band → surface step over ΔL* 3 so a card still reads as raised. **Classic is the only
theme that misses any of that** — its `fg-faint` is 2.31:1 on a chip, and its page and cards
are both `#ffffff` so a card is raised by its hairline alone. Both are real faults in the
original, left alone so Classic stays what shipped.

**Two axes, two keys, and that is the whole design.** `theme` is `dark`/`light`; `light-theme`
is which palette light means. Separate keys are what let a light choice survive a trip through
dark and come back when dark is switched off — a single "current theme" key would have to
forget one to remember the other. Picking a light theme *while dark* leaves dark and stores
`light`, because otherwise the click would change nothing visible and the picker would look
broken.

**The palettes live in CSS and nowhere else.** `src/lib/themes.ts` holds ids, names and hints —
**no hex values**. Each palette is one `.theme-<id>` block in `global.css`, written as a bare
class rather than `:root.theme-<id>` so it works in two places: on `<html>` it themes the page,
and on any element it themes that subtree, because custom properties inherit from the nearest
ancestor that declares them. That second half is what draws the picker's swatches — real
`bg-bg` / `bg-band` / `bg-accent` utilities inside a tagged `<span>` — with no second copy of
the hexes to fall out of sync, and it is why the swatches stay correct even in dark mode.
`/theme-preview` renders all eight side by side on the same mechanism.

Adding a theme is exactly two edits: a `.theme-<id>` block in `global.css`, and an entry in
`LIGHT_THEMES` whose `id` matches. Nothing else — not the picker, not the bootstrap script,
not the selected-state CSS. **Insert it at its hue, not at the end** — see below.

**The row is ordered by colour** (22 Aug 2026, author's request): two neutrals, then a
warm-to-cool sweep — white, gray, rose, ivory, tan, green, blue, violet. Sorted on measured
OKLCH hue of each theme's **page tint**, not its accent, because the page is almost all of what
a swatch shows and it is what the complaint was about. That is why Clay (34°) comes before
Paper (81°) and Sepia (82°) instead of sitting with the other warm neutrals, and it is why the
accent dots do not run in order — they are the smallest thing in the swatch. Someone looking
for "warmer" or "cooler" moves in one direction instead of hunting.

**`ThemePicker.astro` is click-driven, not `group-hover`** like the nav dropdowns, because
these are controls and a hover menu cannot be operated by touch. It has `aria-expanded`,
`role="menuitemradio"` items, Escape-to-close with focus returned, outside-click and focus-out
dismissal — and it is a delegated listener in `src/scripts/theme.ts`, **not an island**: it
sits in the header, on every page. It is the working model for the mobile nav drawer.

Two things that look like shortcuts and are not:

- **`aria-checked` ships `false` on every item** and `theme.ts` corrects them on load. A static
  build cannot know the stored choice. Safe here, unlike the theme class itself, because the
  menu is closed on first paint and only the script that fixes those values can open it. That
  is also why the selected state is styled off `[aria-checked='true']` rather than off eight
  `html.theme-x` selectors — the picker never needs editing when a theme is added.
- **The browser-chrome `theme-color` is read back off the resolved page** with
  `getComputedStyle`, not from a lookup table of nine backgrounds. A table here would be a
  second copy of values that live in global.css, wrong the first time one changed.

Failure modes, all landing on Classic light: JS disabled (no class is added, and the picker
hides itself behind the `html.js` gate), `localStorage` throwing in private mode (the try/catch
swallows it; the choice works for that page view but is not remembered), and a hand-edited
stored id, which is checked against `THEME_IDS` before it is ever pasted into a class name.

Verified in Chrome, not just built: all seven applied and read back off `getComputedStyle`,
persistence across navigation, the dark round-trip (dark → pick → light → dark → light returns
the same palette), Escape and outside-click, an eight-frame probe after reload that never
sampled a Classic frame, and 390px where the menu sits fully inside the viewport and scrolls
its row.

**Dim slate was cut** (22 Aug 2026, author's call) — a 94.9 L* cool slate that was the darkest
of the original three candidates. Sepia now sits lowest at 94.3, so "too dark" was not the
objection; do not reintroduce it under another name.
## The 3D earth (`/about/travel-preview`, 23 Aug 2026)

Six stylised globes on one three.js engine, one at a time behind a switcher. It exists to
settle a choice: the author rejected five earlier library studies **on appearance** —
a satellite globe reads as an embedded widget in a typographic page, whatever library draws
it — so round 2 compares looks rather than libraries.

**`/about/travel-preview` is throwaway.** `noindex`, out of the sitemap, reachable only from
a small link in the `/about/travel` header. When a look is chosen: move `GlobeStage` onto the
real page, delete the switcher, this route, and the link.

**The body of both pages is `TravelContent.astro`.** Extracted from `about/travel/index.astro`
so the preview renders the real page rather than a copy of it — two pages claiming to show "all
the travel information" from two sets of markup is a second source of truth that agrees at first
and stops later. The globe goes in its `after-timeline` slot; a page that passes nothing renders
nothing there, so `/about/travel` is untouched by the preview's existence.

**Not an island, and it is not close.** The engine is a dynamic `import()` behind an
`IntersectionObserver` with `rootMargin: 600px`. That is the same deferral `client:visible`
gives, without 55.9 KB of React runtime to drive a canvas React never touches. Nothing loads
until the globe is a screen away, so a visitor who reads the timeline and leaves pays nothing.

**`three` is in `vite.optimizeDeps.include`, and it has to be.** Same failure as the carousel,
same cause: a dep first reached from a lazy import is discovered mid-session, Vite re-optimizes,
the hash changes, and the in-flight import dies on `504 (Outdated Optimize Dep)`. Observed on
this page in `npm run dev`, not guessed. Production builds never had it.

### The colour contract

**Nothing about the globe's colour is chosen.** `src/scripts/globe/palette.ts` steps a fixed
*perceptual* distance in OKLab from whatever is painted behind the canvas toward
`--color-fg`: sea 0.10, land 0.20, coastline 0.50, dots 0.34. One table, nine themes, no
per-theme values anywhere — and in dark the ramp inverts on its own, because the colour it walks
toward is now the light one. Verified in Chrome: mean canvas colour `rgb(226,227,231)` in
Classic, `rgb(36,36,41)` in dark, on the same globe.

The one colour not derived is the highlight: visited cities are `--color-accent` at full
strength, because they are the only thing on the globe meant to be looked at first.

**It steps off the *ground*, not the page.** `groundColour()` walks up from the canvas until it
finds something painted. The stage sits in a `bg-band` panel, so the sea steps off the band; drop
the globe onto a plain section and it steps off the page instead. Get this wrong and the sea
matches its own frame and the globe reads as a hole.

**A theme change is two uniform writes.** `index.ts` watches `<html>` for class changes with a
`MutationObserver` — the site's theme controls only add and remove classes, so neither side needs
to know about the other. Nothing is redrawn, because the land mask carries no colour.

### Things that look like bugs and are not

- **The land mask is black and white, never themed.** Where the land is is a fact about the
  planet; what colour it is drawn in is a fact about the page. An earlier revision rasterised it
  in the theme's own colours and asked "is this pixel land?" by colour distance — on first paint
  the engine had the dark tokens while the page had not yet applied its variables, land and sea
  came out one unit apart, **every dot and hex lattice was silently empty in dark**, and the
  cached result survived every later theme change.
- **Every custom shader ends with `#include <colorspace_fragment>`.** three.js appends its
  output transform to its own materials only. A `ShaderMaterial` that assigns `gl_FragColor`
  gets none, the linear value lands in an sRGB buffer, and the whole globe renders far too dark —
  in dark theme it collapsed to under 1 L* of separation. Measured off the canvas, invisible in
  a screenshot.
- **`resize()` widens the vertical field of view for portrait frames.** `fov` is the vertical
  angle, so as the frame narrows the horizontal view narrows with it and a globe that fits the
  height spills out of the width. At 390px that clipped Asia off both sides.
- **A `ResizeObserver`, not a window resize listener.** The stage is sized by CSS that can change
  after the script runs; measuring once at boot is how the camera ends up with a 1280:1 aspect and
  the earth renders as a vertical line. It did.
- **Every city carries a marker as well as its footprint.** Phuket's built-up area is 76 km²,
  which is under half a pixel across when the whole earth is in frame. The marker never falls
  below eleven pixels and dissolves once the real footprint grows past it, so the two never both
  claim to be the city.
- **The globe owns the wheel while it can still zoom, and hands it back when it cannot.**
  OrbitControls calls `preventDefault` on the wheel, which stops the *browser* scrolling — but
  this site scrolls with Lenis, which has its own window listener that `preventDefault` does
  nothing about, so the page moved while the globe zoomed. Lenis honours `data-lenis-prevent` on
  an ancestor of the event target; the engine sets it per event, and **removes it at either zoom
  limit** so the page is never trapped under the cursor. Verified: scrollY pinned across eight
  wheel events in both directions, then released at distance 6.
- **The relief look shades from an elevation-derived normal map, lit from the north-west.**
  That is the cartographic convention and not a preference: lit from below, the eye reads ridges
  as valleys. The ocean is deliberately left flat — the normal map carries bathymetry, and
  shading the sea floor is noise here.
- **The frame breaks out of the reading column, and uses `left/transform`, not
  `margin-inline: calc(50% - 50vw)`.** 100vw includes the scrollbar, so the usual full-bleed
  trick overflows by its width and puts a horizontal scrollbar on the page. `min(96vw, 74rem)`
  keeps a gutter wider than any scrollbar. Measured 0 overflow at 1920, 1440, 1280, 834 and 390.
- **Labels are decluttered greedily, and hidden rather than faded.** Six of the eight cities sit
  inside one 2,000 km square. The one most squarely facing the camera keeps its space; a link
  that cannot be read must not be clickable either. Eight labels at 1280px, four at 390px.

### The highlights are built-up areas, and that is why they do not match Google

Measured, so the gap is not a matter of opinion: the Tokyo polygon is **2,821 points and
18,816 km²**, with roughly **600 m between vertices**. Tokyo Metropolis — the dotted boundary
Google draws — is 2,194 km². The highlight is therefore about **8.6× the size** of the
administrative city, because Natural Earth's "urban areas" are the continuous built-up
conurbation: Tokyo plus Yokohama, Kawasaki, Saitama and Chiba, which do not stop at any line.

Two separate causes, both in the source rather than the renderer:

1. **A different kind of area.** Built-up extent, not a legal boundary. Nothing about the
   rendering can make one into the other.
2. **A generalised outline.** Natural Earth 10m is drawn for world maps; ~600 m between vertices
   is invisible at globe scale and coarse at city zoom.

Three ways to close it, and they mean different things — pick before swapping the data:
administrative boundaries from OpenStreetMap admin relations (matches Google's dotted line, and
excludes the neighbouring cities you probably did visit); a higher-resolution built-up layer
(same meaning, sharper edge); or the actual places visited as a track or a set of points, which
is the only one that is true to "where I went" rather than "which city".

### Terrain, and what the relief look does not do

The relief look shows real topography at **global** scale — the Himalaya, the Tibetan plateau and
the Japanese ranges all read clearly. It is a 2048×1024 normal map, which is about **20 km per
pixel**.

Planning a hike needs something like **10 m per pixel**, three orders of magnitude finer, and
absolute heights rather than a shading vector. That is not a bigger texture on this globe; it is
a different component — a per-trip terrain view over a real DEM for one mountain, with a GPX
track and an elevation profile beside it. Do not try to grow the globe into it.

Data, provenance and the regeneration traps live in `public/globe/README.md`. The ids in
`visited.json` are trip ids and must track `src/content/trips/*.md` filenames.

## The MapLibre earth (`/about/travel-preview`, 2 Sep 2026)

A **second** earth, directly under the three.js one on the same preview page, so the two can be
judged in the same page and the same theme rather than from screenshots. `MapGlobeStage.astro`
plus `src/scripts/mapglobe/`. Both sections are throwaway: when one wins, delete the loser, this
route and the link to it.

It exists because of the section immediately above this one. The relief look cannot grow into a
trail view, so the question is not "is three.js good enough" but "what does the thing that *can*
do both look like on this page". Three modes, one `Map` object:

- **Places visited** — globe projection, the same eight footprints, no imagery and no labels.
- **World atlas** — the same globe, told what it is looking at: country boundaries, 177 country
  and 243 city names, city dots, and a global hillshade. Added 3 Sep 2026 at the author's
  request; see "The atlas mode" below.
- **Trail terrain** — real elevation with a hillshade, and **drop a `.gpx` on the frame** to draw
  a recorded track on it. Parsed with `DOMParser` in the page; the file never leaves the browser.

**The comparison is deliberately narrow, and that is what makes it worth anything.** Both earths
read the same `public/globe/land.json` and the same `visited.json`, and both derive every colour
through the same `src/scripts/globe/palette.ts`. Feeding two renderers identical data and
identical colours is what isolates the only question being asked, which is whether it *looks*
like it belongs. Do not "improve" one side's data without doing the same to the other.

**`places` mode makes no third-party request, and that took work.** A MapLibre source is fetched
the moment it is *added*, not when a layer using it becomes visible — so declaring the `raster-dem`
up front would have put a Mapterhorn request on every page load while the hillshade sat hidden.
`ensureHillshade()` and `ensureTerrainSource()` add them on first entry to a mode that needs them
instead. That is the only reason `public/globe/README.md`'s "nothing is fetched from a third party
at runtime" still holds for the globe half. Verified in Chrome: with the map loaded and left in
`places`, the set of third-party hosts contacted is empty; it becomes exactly
`tiles.mapterhorn.com` the moment atlas or terrain is picked.

Things that look like shortcuts and are not:

- **There is no `glyphs` key in the style, and it must be OMITTED rather than set to
  `undefined`.** This was the bug that blocked everything for a whole session. MapLibre validates
  on the key's *presence*, so `glyphs: undefined` fails with `glyphs: string expected, undefined
  found`, `_load` throws, and **the `load` event never fires and never rejects** — leaving a live
  canvas, no layers, no markers, a status stuck on "Drawing the map", and nothing in the console.
  It presented as a hang, so three unrelated things were "fixed" before the real cause surfaced.
  Two defences are now in place: `map.on('error')` is wired to the console (MapLibre reports
  style/source/tile failures as events, not throws), and the `load` await is raced against a
  15 s timeout so a rejected style becomes a visible failure instead of a permanent spinner.
- **Named imports from `maplibre-gl`, never a default.** v6 removed the default export.
- **`setWorkerUrl()` is called at module scope, and it is not optional.** MapLibre v6 finds its
  worker with `new URL('./maplibre-gl-worker.mjs', import.meta.url)`, which resolves against
  wherever the *bundled* module landed — never next to the worker. Dev pointed into
  `node_modules/.vite/deps/` and said so out loud (`The file does not exist at
  ".../maplibre-gl-worker.mjs" which is in the optimize deps directory`); **production failed the
  same way and silently**, resolving beside the hashed chunk in `_astro/` where no worker asset
  was emitted at all. The import must be `?worker&url` and **not plain `?url`** — the shipped
  worker imports a sibling, `maplibre-gl-shared.mjs`, and `?url` copies the file verbatim without
  following it, so the worker dies on its first line in a production build. Verified by grepping
  the emitted worker for bare imports: there are none, which is what says the sibling got bundled
  in.
- **No `glyphs` and no symbol layer anywhere.** A symbol layer needs a glyph server, which is a
  third-party font fetch on every load for eight words. City names are HTML `Marker`s, which are
  also themeable from the component's CSS for free.
- **`sky`, `horizon` and `fog` all take the ground colour, and `atmosphere-blend` is 0.** The
  space around the globe is then the band the frame is painted in, so the sphere sits on the page
  instead of floating in a rendering of space. A blue halo is the "embedded widget" tell.
- **Each mode sets its projection explicitly, and terrain attaches only on arrival.** The globe
  does hand over to mercator on its own near z12, and relying on that was a bug: flying from z1.6
  to a ridge with terrain already attached drags the camera through two seconds of
  *globe projection with terrain on*, which is the combination MapLibre had to fix once already
  (issue #4792). Terrain mode now sets mercator up front and calls `setTerrain` on `moveend`;
  places mode calls `setTerrain(null)` **before** switching back to globe. The order of those
  lines is the whole point of them. `fitBounds` after a GPX load re-arms the same wait, because
  it restarts the camera the first one was waiting on.
- **The DEM source declares its own `tileSize` and `encoding` — never override them.** Mapterhorn's
  TileJSON says `"tileSize": 512, "encoding": "terrarium"`. A hardcoded `tileSize: 256` on the
  source wins over the TileJSON and decodes 512px tiles at half size: the elevation comes out as
  noise and takes the terrain mesh with it. That shipped once. `map.addSource('dem', { type:
  'raster-dem', url: DEM_URL })` and nothing else.
- **Hillshade colours anchor to black and white, not to the theme's `fg`.** The one place the
  "everything derives from the page" rule bends, and it has to: a shadow being darker than the
  surface is physics, not palette. Deriving the shadow from `p.coast` — which steps *toward* `fg`,
  and `fg` is LIGHT in dark theme — made shadows lighter than highlights, so the relief rendered
  as a negative: a near-white mountain range on a dark page that read as "the theme did not
  apply". `mix(p.land, '#000000' | '#ffffff', k)` inverts correctly on its own, because the land
  colour it starts from is already themed.
- **Labels are decluttered greedily on `render`, and hidden rather than faded.** MapLibre
  declutters `symbol` layers but does nothing for HTML markers, and six of the eight cities sit
  inside one 2,000 km square — the default view stacked five cards on top of each other. Nearest
  to frame centre wins its space. A label that cannot be read must not be clickable either. Same
  rule the three.js engine follows; 7 of 8 show at 1400px.
- **`map.on('error')` is wired to the console.** MapLibre reports tile, source and style failures
  as events rather than by throwing, so a 404ing DEM tile or a rejected paint property is
  otherwise a map that silently does nothing.
- **The wheel is handed back at either zoom limit**, via `data-lenis-prevent`, exactly as the
  three.js globe does it and for exactly the same reason — MapLibre's `preventDefault` stops the
  browser scrolling but not Lenis.
- **Ascent is summed off a 3 m threshold.** GPS altitude noise is a couple of metres per sample;
  summing raw positive deltas turns a flat walk into a thousand metres of climbing.
- **`land.json` rings fill as polygons with no hole handling.** The source carries no outer/inner
  distinction, so a lake that is an inner ring fills as land. Invisible at globe zoom; it would
  matter only if this became the real basemap, and the fix then is a proper polygon source.

### The atlas mode (3 Sep 2026)

The author's complaint about the `places` globe was that it is beautiful and says nothing: no way
to tell which country you are looking at, and no terrain. The answer shipped is **a third mode
rather than a change to the second** — `places` is untouched, down to the byte it fetches.

What it adds, and where each part comes from:

| | Source | Layer |
|---|---|---|
| Country boundaries | `public/globe/borders.json`, already on disk | `borders`, dashed line |
| Country names | `atlas-countries.json`, 177 anchors | HTML markers |
| City names | `atlas-cities.json`, 243 anchors | HTML markers |
| City dots | the same file | `city-dot`, circle |
| Relief | Mapterhorn DEM, the one terrain mode uses | `hillshade` |

**It keeps the trips.** The footprints and the eight trip cards are visible in atlas mode too —
the point is the places in context, not a second map that forgot what the page is about. Visited
countries additionally read in the page's **accent**, which is the one thing on this globe that is
about this site rather than about the world, and it keeps "where has this person been" legible at
the zoom where a footprint is half a pixel.

Things that look like bugs or shortcuts and are not:

- **Switching `places` ↔ `atlas` deliberately does not move the camera.** Same globe, same scale:
  the reader stays where they spun to and the world gains or loses its names underneath them.
  Only `terrain` is a journey, and only a return from it flies home. Verified — after a drag, the
  projected position of the Tokyo marker is identical across both switches to within a pixel.
- **Still no `glyphs` key and no symbol layer.** That rule was cheap at eight names and is not at
  420, and it is now paid for in two functions. `retier()` decides which labels are on the map at
  all; `declutter()` decides which of those can be read. MapLibre does both for `symbol` layers and
  neither for HTML markers. What it buys is that every name is a themeable DOM node — a country
  label follows the theme picker for free, which a glyph-server symbol layer could not.
- **A label below its zoom is removed from the map, not hidden.** MapLibre reprojects every marker
  it holds on every frame, so an invisible marker costs a projection and a style write sixty times
  a second while an absent one costs nothing. The tiering runs on `moveend`, never per frame.
- **The zoom that tiers each name is Natural Earth's, not one invented here.** `MIN_LABEL` and
  `min_zoom` are a cartographer's decision about when a name should appear, and `LABELRANK` is the
  same judgement expressed as a collision priority. Measured at the home view: 57 of 420 labels are
  on the map and 19 survive decluttering.
- **`opacityWhenCovered: '0'`, overriding MapLibre's default of `'0.2'`.** This fixed a real bug
  that predates the atlas. `declutter` has always skipped markers at opacity `'0'` — a test that
  never fired while the covered value was `'0.2'`, so every occluded label still claimed a slot in
  the greedy pass and could hide a label the reader could actually see, and an occluded trip label
  stayed clickable at 20% opacity. Eight trips hid the symptom; twenty country names did not.
  Visible labels at the home view went 30 → 19 when this landed, and all 19 are on the near side.
- **Countries in letterspaced mono caps, cities in mixed-case sans.** Telling two ranks of name
  apart by their setting rather than by a legend is the oldest convention on any map. Labels carry
  a `text-shadow` halo in `--color-band` rather than a chip: eight boxed cards is a map, sixty is a
  pin board. The halo inverts with the theme on its own.
- **`pointer-events: none` on every atlas label, and `display: block`.** A marker element swallows
  the drag that starts on it, and these are not links. `block` is load-bearing too — MapLibre
  positions a marker with `transform`, which does not apply to a non-replaced inline element, so a
  bare `<span>` sits in the corner of the frame.
- **The city dot takes the *coastline's* colour, not `p.city`.** `city` steps 0.30 off the ground
  against land's 0.20 — a tenth of the ramp apart, and invisible the moment the hillshade started
  texturing the land under it. `palette.ts` also gained one step, `boundary` at 0.36: the existing
  `border` at 0.15 is *lighter* than land and reads as a hairline scored into the surface, which is
  right for the three.js vector look and wrong for a boundary drawn over shaded relief.
- **The hillshade is one layer at two strengths.** `SHADE.atlas` is much gentler than
  `SHADE.terrain` — a whole hemisphere at ~20 km per pixel takes the numbers tuned for a single
  ridge and turns every mountain range into a bruise. Both still anchor to black and white rather
  than to `fg`, for the reason in the section above.

**Mapterhorn is a sparse pyramid, and the console said so.** A tile containing no land does not
exist: measured, `0/0/0`, `2/3/1` and `6/53/26` return 200 while `3/0/0` and `6/54/28` return 404.
Over a whole hemisphere that is a handful of expected 404s per view, which is exactly enough to
bury the errors worth reading, so `map.on('error')` now filters a 404 on a DEM source and logs
everything else. MapLibre draws nothing where a tile is missing, which is the right answer for open
ocean. The browser still prints its own "failed to load resource" line per tile; that one belongs
to the network stack and no handler can remove it.

**What it costs.** The MapLibre engine chunk went 242.9 → 244.5 KB gz — 1.6 KB for the whole atlas,
because the expensive parts are data, and the data is fetched on first entry to the mode: the two
label files are 9 KB gz together and `borders.json` is 82 KB, none of it requested by a reader who
stays in `places`. The eager page script is **unchanged at 1.8 KB**, and site-wide CSS and JS are
untouched.

**Verified in Chrome against the production build**, not the dev server — which matters here,
because the first pass ran against a long-running `astro dev` that was serving stale scoped CSS and
showed every label unstyled. Both themes, Sepia, 1400px and 390px (0 horizontal overflow), the
camera-continuity check above, terrain still reached and left correctly, and a clean console.

**Not yet decided, and left alone deliberately:** at the home view the trip cards sit on top of the
country labels for China, Japan and Thailand, so those names lose their space. That is the
declutter working as designed — a card naming the city says more than the country name under it —
but it does mean the accent treatment only shows one or two countries until you zoom. And
`PLACES_HOME` at zoom 2.3 is tuned for the desktop frame; in a 390px-wide frame it crops to Asia
rather than showing the globe. Both of those are true of `places` mode too and predate this work.

### Never statically import a value from a lazily-imported engine

Found while building the above, and it was **already broken for the three.js globe** — the claim
in that section that the engine "does not fire until the stage scrolls into view" was not true as
shipped.

`index.ts` imported `LOOKS` — one value — from `engine.ts`, which it otherwise reached only
through a dynamic `import()`. Rollup cannot split a module that is also statically reachable, so
it hoisted the entire engine, three.js included, into the page entry. The `IntersectionObserver`
was deferring nothing. The build had been saying so the whole time and it reads like a style note:

```
[INEFFECTIVE_DYNAMIC_IMPORT] src/scripts/globe/engine.ts is dynamically imported by
src/scripts/globe/index.ts but also statically imported by …, dynamic import will not
move module into another chunk.
```

The fix is a third module holding just the constant — `globe/looks.ts` and `mapglobe/modes.ts` —
imported by both sides. **Types are free** (erased before Rollup sees them), so `import type` from
an engine is fine. Values are not.

Measured on `/about/travel-preview`, gzipped:

| | before | after |
|---|---|---|
| Eager page script | 140.2 KB | **1.8 KB** |
| three.js engine, on scroll | — | 138.6 KB |
| MapLibre engine, on scroll | — | 242.9 KB |
| MapLibre CSS, **eager, render-blocking** | — | 10.3 KB |
| MapLibre worker, on first map | — | 128.4 KB |

Neither engine is fetched until its stage is a screen away, and the MapLibre one is not fetched at
all by a visitor who stops at the first earth. Site-wide eager JS is unchanged — this is all
page-scoped. The MapLibre engine chunk is 244.5 KB gz since the atlas landed (3 Sep 2026).

**The CSS row is the exception, and the table used to say otherwise.** `maplibre-gl.css` is
imported by `engine.ts`, and Astro hoists CSS from anywhere in a page's module graph into a
`<link rel="stylesheet">` in the head — so it is render-blocking on `/about/travel-preview`
whether or not either earth is ever scrolled to. Four stylesheets on that page against two on
`/about`. It is page-scoped, so it costs the other 24 routes nothing, and it is the only part of
MapLibre that is not deferred. Measured, not assumed: grep the built HTML for `rel="stylesheet"`.

**Count the worker when comparing the two.** MapLibre's real cost at the moment a map appears is
the engine *plus* its worker — 371 KB gz against three.js's 139 KB, not 243 against 139. The
worker is a separate asset on a separate request, so it is easy to read the chunk list and
undercount by a third.

**Verified in Chrome, not just built.** Driven through Playwright against the dev server: both
modes render, 8 city markers place correctly, a GPX drop parses and draws (2.1 km / 267 m ascent /
3,150–3,417 m read back off the file), the dark round-trip repaints both modes, decluttering keeps
7 of 8 labels at 1400px, and the console is clean of errors and 404s. That session is what found
the `glyphs` bug, the DEM `maxzoom` 404s and the inverted hillshade — none of which `astro check`
can see, which is the same lesson as the top of "Theming contract".

**The polar lines are fixed** (3 Sep 2026). They came from reusing `land.json` — coastline rings
meant to be drawn as *lines on a sphere*, where a jump from longitude +179.87 to -180 wraps
invisibly around the back. Three rings do that (Antarctica, Eurasia at Chukotka, one near 71°N),
and MapLibre reads rings in Mercator, so each one drew a line straight across the globe. The hole
in Antarctica was the same cause: that ring spans latitude -85.19 to -63.23 and never closes over
the pole. `scripts/build-land.mjs` now emits `land-polygons.json` from Natural Earth's published
polygons — antimeridian-split, closed to the pole, holes preserved — and validates both properties
before writing. Verified in Chrome: both bands gone, Antarctica solid.

**Fill and coastline come from different files, and that is the fix for the polar ring.** The
polygon file closes Antarctica with a synthetic edge along the pole — necessary to fill the
continent, and wrong to stroke: as a line that edge is a circle of latitude, and it drew a visible
ring around the south pole. The `coast` layer is therefore built from `land.json` instead, whose
Antarctic ring is pure coast (-85.19 to -63.23) with no closure, by `coastLines()` in the engine —
which splits a ring wherever consecutive points jump more than 180° of longitude, since that jump
is exactly where a line on a sphere wraps around the back. No extra download on the preview page:
the other earth already fetches that file.

**What is NOT fixed, and cannot be from the data side.** Antarctica renders with a wedge missing
when you spin to the south pole, and it degenerates further as you zoom in there. This is
MapLibre's globe triangulation of a polygon that *encircles* the pole. Established, not assumed:
the same polygon fills correctly under `mercator`; the data was verified (no antimeridian jump
over 5.72°, `minLat -89.99`, 257 distinct vertices on the pole ring); and clamping the pole edge
to -89.99, to the Web Mercator limit -85.05, and to the true -90 all render identically.

**This is a real result for the comparison, not just a defect.** The three.js earth draws the
poles correctly and MapLibre does not — worth weighing alongside the capability gap, since the
preview page exists to decide between them. It is out of frame in the default Asia-centred view.
If it ever needs to go, the move is to drop Antarctica from the *fill* and leave it as coastline
only, which removes the pole-enclosing polygon entirely; that is an appearance decision, so it
has not been taken unilaterally.

The page has also not been driven at **390px**.

## Reveal animation contract

Two halves that must stay in sync:

- `src/styles/global.css` sets hidden starting states, **gated behind `html.js`** (added by an
  inline head script in `BaseLayout.astro`). The gate means a JS failure degrades to "no
  animation", never "no visible content".
- `src/scripts/reveal.ts` animates to the resting state.

Adding a new `data-reveal` value means adding it to **both**. A value present in the CSS but
not in `reveal.ts` leaves elements permanently invisible — that is the failure mode to watch
for. Supported: `fade`, `fade-up`, `slide-left`, `slide-right`, `split-chars`, `split-lines`.

## Animation rules

- **Never animate `background-position` from scroll.** It repaints every frame. Use
  `transform` on a real element inside an `overflow:hidden` frame.
- **One smoothing layer only.** Lenis already smooths scroll; use ScrollTrigger `scrub: true`.
  The legacy code stacks a second `0.08` lerp on top of Lenis, which is why the current hero
  parallax feels mushy. Do not reintroduce it.
- **Wire Lenis to ScrollTrigger explicitly** — `lenis.on('scroll', ScrollTrigger.update)` plus
  a single `gsap.ticker` loop, not two competing rAF loops.
- **Parallax needs two layers at different rates** to read as depth (hero image `+12%`, hero
  text `-30%`). A single layer barely registers.
- **Check `prefers-reduced-motion`** in `reveal.ts` and the carousel. Legacy code only checks
  it for the Lenis parallax.
- GSAP is fully free as of Apr 2025 — ScrollTrigger, SplitText, Draggable, MorphSVG all
  available, no licence key.

## Styling

Tailwind for layout and spacing; scoped styles for component detail.

`src/styles/global.css` holds two `@theme` blocks. The first is the raw palette
(`kleinblue #002FA7`, `schenbrunnyellow #F7E14D`, `tiffanyblue`, `prusianblue`, `bluenova`,
`lavendarblue`), carried over from `tailwind.config.js`; five of its six entries are still
unreferenced, pending the design direction docs/REBUILD.md §12 leaves open. The second is
`@theme static` and holds the semantic tokens everything actually uses.

**Colour in markup goes through a semantic token, never a raw hex and never a literal shade
like `gray-700`.** See "Theming contract" above for the full set and why. Reaching for a raw
palette entry is usually also wrong — `kleinblue` is unreadable on the dark background, which
is exactly what `accent` exists to solve.

## Content

Projects are a content collection (`src/content/work/*.md`) with a zod schema. Adding a project
means adding a markdown file. **Do not hardcode project cards in markup** — that is what the
rebuild is replacing, and it is why two cards currently say "Coming soon."

`getWork()` sorts on **`order` first, `year` only as a tiebreaker** (changed 19 Aug 2026).
Year-first put "Personal Projects" second on `/work`: it is ongoing, so its year is always the
current one, and it outranked the professional work it should sit under. The list is curated,
not chronological — `order` is the field to change to reorder it, and it drives the home-page
carousel too, since `getFeaturedWork()` filters `getWork()`.

**Years and company** (19 Aug 2026). `year` is the first year; add `endYear` for work that
spanned several and it renders as an en-dash range, `2023–2025`. Formatting lives in one
place, `formatYears()` in `src/lib/content.ts`, because the year appears on `/work`, on the
detail page and on the carousel card, and three copies of the logic would eventually disagree.
A zod `.refine()` fails the build if `endYear` is not later than `year`.

`/work` shows **`company` where the job title used to be** — the title repeated down the page
and said less than who the work was for. `company` is optional and falls back to `role`, which
is what `open-source` relies on: self-directed work has no employer. `role` still shows on the
detail page, which now also carries a Company fact.

Note the years are the author's own, supplied 19 Aug 2026, and they reordered the story: the
cloud data platform (2026) does **not** predate the AI agent (2025–2026), and `bank-negara`
(2022) came *before* `alliance-bank` (2023). Three sentences claiming otherwise were corrected
at the same time. Check the prose again if these dates change.

`current: true` marks work that is still in flight (added 19 Aug 2026). A bare year reads as
a completion date, which quietly retired work that is still running. Set on the two Primustech
projects, `ai-agent-bms` and `cloud-data-platform`. It drives two different treatments:

- **`/work` groups by it** — "Currently building" then "Previously". This replaced a per-row
  badge, which the author found too easy to skim past; a heading you have to read past is the
  whole point. Empty groups drop out, so clearing the last `current: true` leaves a plain list
  rather than a heading over nothing. `order` still sets the sequence inside each group.
- **The detail page and carousel card keep the badge**, plus an accent border on the card.
  Neither has sections to group by, so the pill is the only handle available there.

Rows live in `src/components/astro/WorkRow.astro` rather than inline, so both groups render
identical markup. Its heading is an `h3`: the page `h1` is the title and each group heading is
an `h2`. Note the last-row border sits on the `<li>` in `work/index.astro`, not on `.row` —
the row is a separate component with its own style scope, so a descendant selector from the
page would not reach it.

The field is named for the word on the badge on purpose. An earlier revision called it
`ongoing` while rendering "Current", which invites the next reader to wonder whether they are
two different states. Rename both together or neither. "Ongoing" was dropped as the label
because it hints at unfinished work, and both of these run in production for real customers;
"Live" and "In production" were rejected for the opposite reason — `bms-platform` is also in
production but is *not* current work, so those words blur the exact line the badge draws.

Two placement constraints, both deliberate:

- On the **detail page** the badge sits in `.page__kicker` beside the back link, *outside*
  the `<h1>`. The h1 carries `data-reveal="split-lines"`, and SplitText would treat a nested
  badge as text to slice into lines.
- In the **carousel** the two card variants are written as two complete literal strings
  (`CARD` / `CARD_ONGOING`) rather than one string plus a conditional fragment. Tailwind
  scans source text for class names; a class assembled at runtime is one it never sees and
  never generates.

Keep `summary` well under the zod cap of 180 characters. It is rendered on a carousel card
roughly 22rem wide, and every `stack` entry becomes a chip on that same card — past about
seven chips the cards visibly grow, and they all stretch to match the tallest.

### Travel — a second collection under one section (20 Aug 2026)

`/about/travel` is the only About section that indexes a collection of its own. Trips live in
`src/content/trips/*.md`, one file per destination, and render twice: as an entry on the
`/about/travel` timeline and as a page at `/about/travel/<id>`.

**Why it is not one long page.** Eight trips, each with a day-by-day account and a gallery, is
somewhere north of 5,000 words and a hundred photographs on a single route. Splitting gives
every trip a URL worth sending someone, and keeps a phone from downloading Chengdu to read
about Bangkok. It is the `/work` + `/work/[slug]` shape, which this repo already proves.

**A timeline, not a grid.** Chosen by the author over a year-grouped grid, an index list and
full-width feature bands, on the grounds that the sequence is the most important thing about
the section. A 2-up grid reads left-right-left-right and buries chronology; a vertical spine
draws it. The rail is one `::before` on the `<ol>` rather than a border per entry, which is
what keeps it unbroken through the year labels — grouping the markup by year would cut the line
at every boundary, so the year label is instead handed to the first entry of each run and
positioned into the gutter.

**Two views over one markup tree** (20 Aug 2026). `gallery` is the default — one 16:9 photo per
trip with the caption underneath. `compact` collapses to a thumbnail on the left and text on the
right, with a hairline between entries. The author picked the gallery as the default and asked
for the collapse; both were mocked up first at `/layout-preview`, a throwaway page since deleted.

Nothing is re-rendered. `TripEntry.astro` emits one DOM and the compact rules are overrides
keyed off `html.trips-compact`, written as overrides rather than a second complete rule set so
the two views cannot drift on the properties they agree about. The one thing that costs
anything: the title precedes the date in the DOM because that is the sensible reading order,
and compact wants the date *above* the title, so `.cap` flips to `flex-col-reverse` there rather
than the markup forking.

The class goes on `<html>`, not on the list, so the `is:inline` head script on the travel page
can restore a stored choice before first paint — the same pattern and the same try/catch as the
theme. That script rides a **`<slot name="head" />` added to BaseLayout** for the purpose;
pages that pass nothing render nothing, and the cost stays off the other fourteen routes.
`TripsViewToggle.astro` hides itself behind `html.js`, and its selected state is driven by the
html class rather than `aria-pressed` so it is right on the first painted frame.

**`trips-view.ts` must call `ScrollTrigger.refresh()` after switching.** This is not defensive
tidying — without it the page is visibly broken. Toggling changes the page height by thousands
of pixels (6657 → 3878, measured), every reveal trigger is still holding the start position it
computed against the old layout, and entries below the fold are stranded at `opacity: 0`. The
last one never appears *at all*, because its trigger now sits past the bottom of the shortened
page; scrolling to the end does not rescue it. Verified before and after in Chrome, and across
four toggles in a row. The refresh is wrapped in `requestAnimationFrame` so the browser has
applied the new layout before ScrollTrigger measures it, and the triggers are `once: true`, so
refreshing cannot re-hide anything already revealed.

**The placeholder is hatched, not flat.** In gallery view an empty frame is the biggest thing on
the page, and a plain grey rectangle reads as a failed image load. An 8px diagonal rule reads as
a space being held. It disappears the moment a `cover` is set.

**`highlights` are seeded and are guesses** (20 Aug 2026). Every trip carries 3–4 chips — Panda
Base, Shibuya, Wat Arun — added at the author's request to judge the layout with something in
them. They are the obvious landmarks per destination, **not a record of where the author went**,
and every file says so at the field and again at the foot. They are the reason the entries stopped
looking empty, so do not clear them without replacing them.

**A dot marks a year, not a trip** (changed 20 Aug 2026, at the author's request). Eight
identical beads down the line gave the rail no landmarks — every entry looked equally
significant and the years did not stand out. There are now four marks, one per year, each
sitting on its label's midline. `TripEntry.astro` draws the dot only when it is handed a
`yearLabel`, which is the same condition that renders the label itself, so the two cannot
appear apart.

All the spine geometry (`--rail`, `--dot-radius`, `--dot-top`) is declared on `.timeline` in
`about/travel/index.astro` and inherited by `TripEntry.astro`. **Keep it that way** — the dots
and the line they sit on are drawn in two different files, and hard-coding the offsets in both
is how they end up three pixels apart with nobody noticing. `--dot-top` needs no breakpoint
variant now that the dot tracks the year label, whose midline does not move when the label
leaves the flow for the gutter at `sm`. Verified in Chrome: dot centres land exactly on the
rail at 390px and 1280px.

**There is no `order` field, deliberately.** The timeline sorts on `start` alone, newest first.
An earlier revision had a curated `order`, which was right while three trips were undated —
but every trip now carries at least a month, and a hand-maintained sequence sitting next to
printed dates is a second source of truth that can visibly contradict the first. Undated trips
sort to the end.

**Dates carry their own precision: `2024`, `2024-10` or `2024-10-15`.** Shanghai, the
Guangzhou/Shenzhen trip and the Taiwan one are month-precision — the author knows the month and has not yet checked the days. The
schema accepts all three shapes and `formatTripDates()` renders exactly what it was given
(`"Oct 2024"`, never an invented day). `tripDays()` returns null below day precision rather
than guessing, so the trip page shows no Length for one. The date itself is the only signal an
entry is approximate — `Jul 2025` against `14–18 Nov 2025` — and that is enough. Two other
signals have been tried and removed: a hollow rail dot (gone when dots became year marks, since
a *year* is never approximate) and a day count on the timeline card (removed 20 Aug 2026 at the
author's request; it doubled the meta line to restate what the range already showed).
`tripDays()` is now used on the trip page alone, where a fact list is the right home for it.

**A trip `summary` must not open with a duration.** Five of them started "Six days in Chengdu…"
and were trimmed when the day count came off the card — a summary printed directly under the
date range should not restate it. The essay below the timeline still talks about trips being
"four to seven days each"; that is a claim about the shape of the whole list, not a duration
printed against a single trip, and it stays.

**Two cities in one trip go in one entry** (20 Aug 2026): `Taichung & Taipei, Taiwan` and
`Guangzhou & Shenzhen, China`. The timeline plots trips, not stops — splitting them would put
two marks on the rail for one flight out and back, and both halves would carry the same dates.

The two slugs are asymmetric on purpose. `taiwan.md` keeps its name because the country is the
natural handle for a trip that stayed inside one; `guangzhou-shenzhen.md` was renamed from
`guangzhou` because `china` is not available as a handle — three separate trips went there.
Renaming was free before launch and will not be after.

**Quote the dates.** `start: '2023-11-03'`, not `start: 2023-11-03` — YAML reads a bare
`yyyy-mm-dd` as a timestamp and hands zod a `Date`, which fails the schema. They are stored as
strings on purpose: a `Date` is UTC midnight and formats a day early anywhere west of
Greenwich, and it cannot represent "October 2024" at all.

`formatTripDates()` and `tripDays()` in `src/lib/content.ts` are the single source for both,
because the range appears on the timeline, on the detail page and in the meta description. The
range dash is tight inside one month (`3–8 Nov 2023`) and spaced when whole dates sit either
side (`26 Jun – 1 Jul 2026`), so "1 Jul" cannot read as part of "26 Jun". Day counts are
inclusive — 3–8 Nov is six days, matching the "Day 6" heading in the body.

**`src/pages/about/[slug].astro` explicitly skips `travel`.** Both it and
`about/travel/index.astro` emit `about/travel.html`, and Astro's static-beats-dynamic rule
would pick a winner without saying so. The filter is in `getStaticPaths` only — `travel` stays
in the list the prev/next pager reads from, which is why those are two separate variables.

**Day headings are generated, then pasted into the markdown.** `### Day 3 — Sun 5 Nov` is
plain markdown so the prose under it stays easy to write, which means it can drift from the
frontmatter. Each file says so at the point of use: correct the dates, correct the headings.
They are set in mono with a rule above them on the detail page, so a run of six reads as a
list of days rather than six prose subheadings.

**Photos go in `src/assets/travel/<id>/`, never `public/`** — see the README there. The schema
fails the build on a `cover` with no `coverAlt`, and every gallery entry needs an `alt`, which
doubles as the visible caption: one description per photo, written once. Until a cover exists
the frame renders a "Photo to come" placeholder, which is deliberate — the timeline has to look
composed while eight trips wait for their photos.

`src/content/sections/travel.md` is now the essay **under** the timeline, not the page. Its
first heading ("Why the list looks like this") only makes sense in that position.

**All eight trips are Claude-scaffolded drafts (20 Aug 2026) and say so at the foot of each
file.** Everything in them is calendar arithmetic off the destination and the dates — nothing
about the trips themselves has been invented, which is why the day headings have no text under
them. The one real finding worth keeping: every trip whose exact days are known starts on a
Friday, five out of five. The essay's second paragraph is built on that, so re-check it when
the three month-precision trips get their days.

## Additional guidelines

See [AGENTS.md](AGENTS.md) for coding style, naming, and commit/PR conventions. Note that its
testing section describes a setup that does not exist (no tests, no `setupTests.js`) — treat
that as aspirational until §12 of the rebuild plan is decided.
