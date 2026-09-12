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

**Open decisions, not code.** Which of the three navigation models the MapLibre earth should
use — see "The interaction mock-up" below, which is on `/about/travel-preview` and is where that
question now lives rather than in this file. Site-wide `noindex` until launch (`BaseLayout` supports it per
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

**And verify against `npm run build && npm run preview`, NOT against a long-running `astro dev`.**
This has cost real time three separate days (3 Sep 2026). A running dev server picks up markup
changes in an `.astro` file by HMR but can go on serving the **previous component's scoped
stylesheet**, so the page renders new markup with old CSS and the symptom looks like a code bug
rather than a stale asset. Both times it was diagnosed by comparing the same probe on both ports:

| | dev :4321 | build :4322 |
|---|---|---|
| atlas label `text-transform` | `none` | `uppercase` |
| control panel `position` | `static` | `absolute` |

The second one presented as "the buttons do nothing" — unpositioned, the panel fell behind the
absolutely-positioned MapLibre canvas, which then swallowed every click. `document.elementFromPoint`
at each control is the one-line test that tells a stale stylesheet from a real z-index bug: on the
build all 11 chips returned themselves, on dev all 11 returned `maplibregl-canvas`. **Restart the
dev server after changing a component's `<style>` block**, or check the built site.

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

### This file is a build input (10 Sep 2026)

**Tailwind v4 has no content array — it detects sources automatically and scans every
non-ignored file in the project, markdown included. So a Tailwind class name written in
CLAUDE.md is extracted as a real candidate and its definition is emitted into the shared
stylesheet all 25 pages load.**

Found the hard way, and the way it surfaced is the whole point. Six utilities were rewritten as
plain declarations to stop a throwaway preview section costing the site 0.21 KB gz — and every
one of them came straight back on the next build, because the write-up documenting the change
named them. The evidence was unambiguous once it was looked at properly: all six were absent
from `src/` and present in the built sheet, appearing exactly once each, in this file. A first
attempt at a fix removed one of them from a *code comment* and changed nothing, which is what
finally pointed at the prose.

`src/styles/global.css` now excludes the prose docs:

```css
@source not "../../CLAUDE.md";
@source not "../../AGENTS.md";
@source not "../../README.md";
@source not "../../docs";
```

**`src/content/` is deliberately NOT excluded.** It is prose too, but it is prose the site
renders, so a class a content author legitimately used would be silently dropped.

Two consequences worth keeping in mind:

- **This file can now discuss class names freely.** That is what makes it possible to write
  "do not use this utility" down at all — before the exclusion, saying so shipped it.
- **A section like the one above that quotes a measured byte count for a utility is only true
  while the docs stay excluded.** If those `@source not` lines ever go, every class name in
  this file starts shipping again.

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
do both look like on this page". **Three modes, one `Map` object** — two from 7 Sep 2026, when
four were cut to two, and a third added on 9 Sep; see "Two tabs, not four" and "The All tab"
below.

- **Trips** (`explore`) — the globe with a filter row. It starts at country boundaries and the
  177 country names alone, both local files, so entering it makes no third-party request at all;
  city names and dots, relief, named peaks and rivers and lakes are added a chip at a time, and
  each is fetched only when it is switched on. The eight footprints are on the map whatever the
  filter says. See "The explore mode" below.
- **All** (`combined`) — both of the above on one globe, each behind its own chip, over the same
  five layer filters. Added 9 Sep 2026 at the author's request; see "The All tab" below.
- **Trails** (`terrain`) — **two views, not one** (9 Sep 2026). It opens on a pitched *overview* of all
  ten recorded routes, grouped into the three places they were walked and named on cards the way
  the trips are; clicking a card drops to that single route on real elevation with a hillshade.
  Seven hikes and three half marathons, all the author's own. Added 4 Sep 2026 at the author's
  request; see "The route picker" and "The trails overview" below. Dropping a `.gpx` on the frame
  was removed on 7 Sep 2026, along with the parser behind it — see "Dropping a GPX was removed".

### Two tabs, not four (7 Sep 2026)

`places` — the bare stylised globe — and `atlas` — the same globe frozen at boundaries, names and
relief — were removed at the author's request, and the two survivors were renamed on the chips.
**Nothing was lost with them**, which is why it was the right cut: `explore` opens on what `atlas`
drew minus its relief, and switching its two default chips off leaves exactly what `places` drew.
They were two fixed positions on a dial sitting in the row next to the dial. "The atlas layers"
below still describes what those layers do and is still accurate — it is the mode wrapper around
them that is gone.

**`ATLAS_LAYERS` and `ATLAS_SET` went with `atlas`**, `PLACES_HOME` was renamed `GLOBE_HOME`
(it is named for the projection now, not for a mode that could outlive it), and the `ShadeKind`
`'atlas'` became `'globe'` — the whole-hemisphere hillshade setting is still what the Relief chip
switches on. `DEFAULT_LAYERS` is unchanged at `['countries']` and is now the only layer set in
modes.ts.

**The chip labels are "Trips" and "Trails"; the ids are still `explore` and `terrain`.** That
mismatch is deliberate and is written down in modes.ts, because it is exactly the kind of thing a
later reader "fixes": both label words are already taken in that neighbourhood by narrower types —
a `MapTrip` is one visited city, a `MapTrail` is one recorded route, and `trips` and `trails` are
live variables in engine.ts holding those. A mode id colliding with them would read worse than one
that does not echo its own chip. The names themselves are the author's, chosen over a dozen
alternatives on the grounds that both are already true of the data behind them — `visited.json`
holds trips, `trails.json` holds trails — so neither label can drift from what its tab shows. They
are also short enough that the switcher stays on **one line at 390px**, which "Places visited" and
"Trail terrain" did not manage between them.

**One piece of markup went with the modes.** `.mapglobe__legend-extra` was a span hiding the
peaks-and-water sentence outside `explore`, because `atlas` could not draw either layer. With one
globe mode left that span had one side, so it is plain text again and its two CSS rules are gone.
The legend still names layers that may be switched off — as it always did in `explore`, since it
describes what the chips can draw rather than what is drawn.

**Verified in Chrome against the production build** (not the dev server — and there was a live
`astro dev` on :4321 during this session, which is exactly the trap; :4322 was the build). 32
checks: two chips reading Trips/Trails with `explore` selected and `data-mode="explore"` on
arrival; **zero third-party hosts contacted** on arrival, with MapLibre fetching exactly
`land-polygons.json`, `borders.json` and `atlas-countries.json` and no optional-layer file; five
filter chips, and the Peaks chip fetching only `atlas-peaks.json`; legend shown in Trips and
hidden in Trails; switching to Trails loading exactly one route file, reading back
"Belumut · Johor, Malaysia · 25 Jul 2026 · 14.5 km · 1,127 m ascent" and reaching
`tiles.mapterhorn.com` only then (**that pair changed on 9 Sep 2026** — Trails opens on the
overview now, so it loads all ten and reads back "All routes"; this records what was verified at
the time); ten route chips; the globe returning intact; both dead stored
ids (`places`, `atlas`) falling back to Trips; 390px with 0 horizontal overflow, the switcher on
one line and both chips clickable; the light↔dark round trip repainting both modes (233→34→233 and
180→62→180); prose containing none of the three old names and no glued words from the Astro
whitespace trap; console clean throughout.

**What it costs, or rather returns.** With the GPX loader and the Clear button removed below in
the same session, the MapLibre engine chunk went 246.25 → **244.86 KB gz** and the eager page
script 2.29 → **2.07 KB gz** — a tenth of the page's own script, gone. The three.js engine is
untouched at 138.57, and site-wide CSS and JS are unchanged: this is all page-scoped.

### The GPX loader and Clear were removed (7 Sep 2026)

The frame used to accept a `.gpx` dropped on it, or chosen through a "Load a .gpx" file input
beside Clear, parsed in the browser with `DOMParser` and never uploaded. **All of it is gone** at
the author's request, on the grounds that the ten routes are built in now and a visitor's own file
answers a question this page stopped asking.

What went, so nobody looks for it: `parseGpx` and its `haversine`/`R_EARTH` helpers and the 3 m
ascent threshold; `loadGpx` on the engine and its `MapGlobe` interface member; the exported
`TrackStats` type; `showStats` and `take` in index.ts; the `change` listener, the four
drag/drop listeners and the `data-drop` attribute; `.mapglobe__drop` and its sibling-combinator
rule; `.mapglobe__action input` and the `:focus-within` half of the action's focus ring, which
only existed because a `<label>` cannot take focus itself. Git history has all of it if a "bring
your own track" mode is ever wanted.

**`boundsOf` stayed** — it frames the camera on whatever is drawn, and the built-in routes need it
just as much. The section header above it is now "track geometry" rather than "GPX".

**The ascent threshold is not lost, it moved** — `scripts/build-trails.mjs` does that arithmetic
now, off the FULL recording rather than the simplified line. That split is the reason the readout
can be trusted and it predates this change; what is new is that it is the only path left, so
nothing in the browser computes a distance any more.

**Clear went too, in the same session.** It was flagged as probably vestigial and then removed
when the author asked why it was still there — the reasoning that killed the GPX loader kills it
as well. Clear was that file's undo; with the routes built in, its only remaining effect was to
replace a route with an empty hillside, and there was no way to get a route back except to pick
one, which is what the picker is for. `clearTrack()` and its interface member are gone, the
`data-mapglobe-clear` branch with them, and `.mapglobe__actions` / `.mapglobe__action` with the
whole row. `.mapglobe__foot` went from a `justify-between` flex row to a plain margin, since it
holds one child now.

**`TERRAIN_HOME` survived, and is worth understanding.** It is no longer a destination anyone can
choose; it is reached only two ways, both failures rather than choices — an empty manifest, or an
opening route that will not load. Do not delete it as dead code: `applyMode` falls back to it
whenever `trackBounds` is null.

**An empty string under `mapglobe-trail` is no longer a valid stored value**, but a returning
visitor can still have one from before this change. `storedTrail` used to compare against `''`
explicitly to tell "Clear was pressed" from "nothing stored"; that branch is gone, and a stale
`''` now matches no route and falls through to the default. Verified in Chrome by planting one:
it opens on Belumut with its chip checked, rather than on an empty map.

**Verified in Chrome against the production build**, 17 + 16 checks plus a re-run of the 31 above,
all passing: no `input[type=file]`, no `data-mapglobe-file`, no `.mapglobe__drop`, no
`[data-mapglobe-clear]`, no `.mapglobe__action` and no button reading "Clear" anywhere in the DOM;
no mention of `.gpx` left in the rendered prose; synthetic `dragenter`/`dragover`/`drop` events on
the stage setting no `data-drop` and throwing nothing; terrain opening on Belumut in the `loaded`
readout state; ten chips with exactly one checked, before and after picking a different route; a
planted stale `''` falling back to a route; the globe half untouched at five filter chips; 0
horizontal overflow at 390px; console clean throughout.

**A mode stored before this change falls back on its own.** `isMode` checks the stored string
against `MAP_MODES` and a miss lands on `DEFAULT_MODE`, which is now `explore`. Verified in
Chrome with both dead ids in `localStorage`.

**The comparison is deliberately narrow, and that is what makes it worth anything.** Both earths
read the same `public/globe/land.json` and the same `visited.json`, and both derive every colour
through the same `src/scripts/globe/palette.ts`. Feeding two renderers identical data and
identical colours is what isolates the only question being asked, which is whether it *looks*
like it belongs. Do not "improve" one side's data without doing the same to the other.

**Arriving in `explore` makes no third-party request, and that took work.** A MapLibre source is
fetched the moment it is *added*, not when a layer using it becomes visible — so declaring the
`raster-dem` up front would have put a Mapterhorn request on every page load while the hillshade
sat hidden. `ensureHillshade()` and `ensureTerrainSource()` add them on first use instead. That is
the only reason `public/globe/README.md`'s "nothing is fetched from a third party at runtime" still
holds for the globe half. It used to be `places` mode that carried this property by drawing
nothing; since 7 Sep 2026 it is carried by `DEFAULT_LAYERS` being two local files with Relief off.
Verified in Chrome against the production build: with the map loaded and left as it arrives, the
set of third-party hosts contacted is empty, and MapLibre has fetched exactly `land-polygons.json`,
`borders.json` and `atlas-countries.json`. It becomes `tiles.mapterhorn.com` the moment Relief or
Trails is picked. (`cities.json` is fetched on that page by the **three.js** earth above and is
not MapLibre's — an easy thing to misread in a request log.)

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
- **Labels are decluttered greedily on `render` and again whenever the label set changes**, and
  hidden rather than faded. MapLibre declutters `symbol` layers but does nothing for HTML markers,
  and six of the eight cities sit inside one 2,000 km square — the default view stacked five cards
  on top of each other. Nearest to frame centre wins its space. A label that cannot be read must
  not be clickable either. Same rule the three.js engine follows; 7 of 8 show at 1400px.
  **Since 10 Sep 2026 this is the losing half of the story for the atlas ranks only.** A CARD that
  loses its space is now drawn on the winner instead of being dropped — see "Cards merge instead
  of disappearing" below, which is the same pass and the same boxes.
- **The atlas labels' halo is `--color-bg`, not `--color-band`** (3 Sep 2026). The frame is
  painted in `band`, which is the ground palette.ts steps every one of the globe's own colours off
  — sea 0.10 toward `fg`, land 0.20 — so a band-coloured halo is a tenth of the ramp away from
  whatever is behind the text and barely separates from it. `bg` is on the far side of the ground
  from `fg` in every theme *by construction*, light and dark alike, so it is always the furthest
  thing from the map under it: 1.77:1 against the land colour in Classic and in dark, against
  band's 1.61:1, and a full step better against the text in all nine themes.
- **`fg-faint` never appears on an atlas label, and `fg-meta` only ever behind the halo**
  (3 Sep 2026, author's request to improve legibility). Measured on bare land, `fg-meta` is 2.74:1
  in Classic, 3.03 in Paper, 3.11 in Sepia — under the 3:1 floor a UI mark needs, and it was once
  the colour of city names, peak heights and the ▲ glyph alike. City and country names are on it
  again *because of the six-deep `--color-bg` halo*, which at a 10px glyph is what the eye actually
  measures against: 4.83:1 at worst. `fg-faint` clears neither test and is out entirely. The ▲ is
  subordinate by SIZE (0.72em) rather than by fade — ranking a glyph by fading it only works while
  the fade is still legible. Dark was never the bad case: the same `fg-meta` measures 3.65:1 on
  land and 6.46 on the halo there. See the rank ladder below for what each rank ended up on.
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

### The atlas layers (3 Sep 2026)

**The MODE this describes was removed on 7 Sep 2026; its layers were not, and everything below
still applies to them.** They are what the Countries and Cities chips draw in `explore`, and this
is still the only account of how the labels are built, tiered, decluttered and coloured. Read
"mode" here as "the Countries + Cities + Relief layer set".

The author's complaint about the `places` globe was that it is beautiful and says nothing: no way
to tell which country you are looking at, and no terrain. The answer shipped at the time was **a
third mode rather than a change to the second** — `places` was untouched, down to the byte it
fetched. Both of those modes are now gone and the layers are chips.

What it adds, and where each part comes from:

| | Source | Layer |
|---|---|---|
| Country boundaries | `public/globe/borders.json`, already on disk | `borders`, dashed line |
| Country names | `atlas-countries.json`, 177 anchors | HTML markers |
| City names | `atlas-cities.json`, 243 anchors | HTML markers |
| City dots | the same file | `city-dot`, circle |
| Relief | Mapterhorn DEM, the one terrain mode uses | `hillshade` |

**It keeps the trips.** The footprints and the eight trip cards are visible in atlas mode too —
the point is the places in context, not a second map that forgot what the page is about. The
**accent footprints are the only thing on this globe that is about this site** rather than about
the world, and they are the whole answer to "where has this person been".

A country containing a trip also drew its NAME in the accent at weight 600 for two days. That came
off on 3 Sep 2026 at the author's request — *"no need to highlight country name, just the area that
I visit is enough"* — and it was the right call: two accent marks for one fact, and the louder of
the two was the one that mattered less. Its priority boost (5, ahead of every other country) went
with the colour rather than surviving it; a label that quietly outranks its neighbours for a reason
the reader cannot see is worse than one that does not. `MapTrip.country` and the build-time check
that guarded the name match went too, so `mapTrips` is now just `globeTrips`.

Things that look like bugs or shortcuts and are not:

- **Gaining or losing names never moves the camera.** Same globe, same scale: the reader stays
  where they spun to and the world gains or loses its names underneath them. Only `terrain` is a
  journey, and only a return from it flies home. This was written about switching `places` ↔
  `atlas`, verified by projecting the Tokyo marker across both switches and finding it identical
  to within a pixel; with one globe mode left it is the **filter chips** that must hold the
  property, and they do, because they change layer visibility and never touch the camera.
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
  apart by their setting rather than by a legend is the oldest convention on any map — and it is
  what carries the third rank `explore` adds, a peak with its ▲ and its height. **Setting is now
  the only thing separating a country from a city**, since the two share `fg-meta` and one weight;
  the peak is the single rank that also steps up in contrast. See the ladder below. Labels carry a
  `text-shadow` halo rather than a chip: eight boxed cards is a map, sixty is a pin board. The
  halo is `--color-bg` and inverts with the theme on its own — see the note in the list above for
  why it is `bg` and not the `band` the frame is painted in.
- **Two contrasts across three ranks, one weight** (settled 3 Sep 2026, author's spec — the
  ASSIGNMENT is theirs, not derived). Stated in dark mode, because that is where the author reads
  it and because "darker" and "lighter" swap meaning between the two themes. The semantic tokens
  swap with them, so one statement covers both and it must never be re-specified per theme:

  | | size | weight | colour | dark | light | halo / land, Classic |
  |---|---|---|---|---|---|---|
  | Trip card | 12px | **600** | `fg` + box | `#f2f2f3` | `#111827` | 17.74 / 10.04 |
  | Peak, its ▲ and height | 10.2px | 400 | **`fg-body`** | `#c3c3c9` | `#374151` | 10.31 / 5.83 |
  | Country | 9.9px | 400 | `fg-meta` | `#94949e` | `#6b7280` | 4.83 / 2.74 |
  | City | 10.2px | 400 | `fg-meta` | `#94949e` | `#6b7280` | 4.83 / 2.74 |

  **The country and the city share a colour, and that is the decision** — not a shortcut and not
  the absence of one. Their setting has separated them since the atlas shipped, so a second signal
  saying the same thing bought a step of contrast that had to come from somewhere, and where it
  came from was the trip cards' share of the reader's attention. What is on the globe now is one
  quiet ground of names, the peaks lifted a token out of it, and the eight accent footprints above
  both. Ramp positions: peak **0.79–0.82** along ground→`fg`, country and city **0.57–0.68**.

  **The peak is the only rank that has moved**, and it has now been four things — `fg-meta` as
  shipped, `fg`, a `color-mix` step between `fg` and `fg-body`, and `fg-body`. The last two were
  both reaching for separation from the trip cards; `fg-body` gets it more cheaply, because the
  card is 12px at weight 600 inside a bordered box while the peak is 10.2px at 400 with nothing
  around it. **The `color-mix` is gone** — it existed to sit between `fg` and `fg-body`, and once
  the country came down to `fg-meta` there was nothing left for it to sit between. Do not
  reintroduce it without a fourth rank that needs the rung.

  **`fg-faint` is off the table**, and the reason is narrower than it looks: it sits at **0.36**
  along Classic's ground→fg ramp where every other theme puts it near 0.52, and that one outlier
  drags it to 2.54:1 against the halo — under the 3:1 floor a UI mark needs. (In the other light
  themes it is 3.42–3.70, and in dark 4.77.) It is a known fault in the original palette, left
  alone so Classic stays what shipped. It is why there is no usable token below `fg-meta`, and so
  why every extra step this ladder has ever needed had to come off the top rather than the bottom.

  **`fg-meta` on the city and the country is safe for a reason that does not generalise, so do not
  copy it elsewhere.** Every atlas label carries a six-deep halo in `--color-bg`, and at a 10px
  glyph the 1px ring covers a letter's whole immediate surround — so the contrast that decides
  legibility is text-against-halo, not text-against-land: 4.83:1 at worst (Classic), 5.22–5.59
  across the other light themes, 6.46 in dark. Against bare land the same colour is 2.74:1. **The
  halo is load-bearing**, not decoration — weaken that `text-shadow` and both label ranks go with
  it.

  **Classic is the constraint, not dark.** Every tier's worst light-theme figure is Classic's,
  because a pure-white page pushes the derived land furthest from the text; dark is the most
  forgiving theme at every single tier. Check a change against Classic first. A live reference with
  all nine themes, every token and the continuous ramp under them:
  https://claude.ai/code/artifact/ee4ab1ad-9917-4092-a3eb-a805477571ea

  Nine passes to get here, and the two failures are worth more than the result:

  | | city | country | peak |
  |---|---|---|---|
  | 1. as it shipped | `fg-meta` | `fg-body` | `fg-meta` |
  | 2. contrast pass — **wrong** | `fg-body` 500 | `fg` 500 | `fg-body` 500 |
  | 3. country back down | `fg-body` 500 | `fg-body` | `fg-body` 500 |
  | 4. everything down a grade | `fg-body` | `fg-meta` | `fg-body` |
  | 5. one colour for all | `fg-meta` | `fg-meta` | `fg-meta` |
  | 6. three contrasts — **wrong way round** | `fg` | `fg-body` | `fg-meta` |
  | 7. order corrected | `fg-meta` | `fg-body` | `fg` |
  | 8. peak off the card's colour | `fg-meta` | `fg-body` | `fg` 50% + `fg-body` |
  | 9. **shipped** — country joins the city | `fg-meta` | `fg-meta` | `fg-body` |

  **Step 2**: "two ranks must stay a step apart" is true, and it does not follow that the step
  should be taken by raising the BACKGROUND rank. Country names are three times as numerous as
  city names and set in wide caps across every landmass; at `fg` and weight 500 they buried the
  trip cards the page exists for — *"the countries name is just to make the earth don't too
  blank."*

  **Step 6**: "darker" and "lighter" are unusable words on a two-theme site and I read both of them
  backwards. Settle a question like this in one theme's hex values, not in adjectives — that is
  what finally resolved it, and it took one question instead of a fourth guess. Sizes were
  confirmed separately at the same time: 0.64rem for city and peak, up from the 0.6rem this
  shipped with, kept deliberately because small type over shaded relief needs it.

  **Steps 5 and 9 are not the same answer.** Five put every name including the peak on one colour;
  nine keeps the peak a token above. The difference is what `explore` added in between — a rank
  whose labels are the longest strings on the map and the only ones carrying a number, which is
  worth one step and the countries are not.
- **`pointer-events: none` on every atlas label, and `display: block`.** A marker element swallows
  the drag that starts on it, and these are not links. `block` is load-bearing too — MapLibre
  positions a marker with `transform`, which does not apply to a non-replaced inline element, so a
  bare `<span>` sits in the corner of the frame.
- **The city dot takes the *coastline's* colour, not `p.city`.** `city` steps 0.30 off the ground
  against land's 0.20 — a tenth of the ramp apart, and invisible the moment the hillshade started
  texturing the land under it. `palette.ts` also gained one step, `boundary` at 0.36: the existing
  `border` at 0.15 is *lighter* than land and reads as a hairline scored into the surface, which is
  right for the three.js vector look and wrong for a boundary drawn over shaded relief.
- **Relief is one strength, and it is `faint`** (settled 3 Sep 2026). The author's first note was
  that the relief showed height but not obviously; the replacement came back as *too* obvious; the
  third answer was a `RELIEF_LEVELS` ladder of five and a row of chips, the same conclusion the
  light themes reached — when the right amount is a matter of screen, room and eyes, the page can
  let the reader say. They said `faint`: a 45° sun, `standard` method, shadow 0.26 / highlight
  0.20, exaggeration 0.90 — which is exactly what the atlas originally shipped with, reached the
  long way round. **The ladder, the chips and the `mapglobe-relief` key are all gone**; `SHADE` is
  back to two rows — `globe` and `terrain`, the first of which was called `atlas` until that mode
  was removed on 7 Sep 2026.

  What the ladder established, and what the surviving numbers encode:

  - **The sun angle is the control that matters, and it is not obvious why.** MapLibre shades by
    *slope*, and at ~20 km per pixel even the Himalaya is a gentle slope from one pixel to the
    next, so a high sun lights the whole range almost flatly while `hillshade-exaggeration` —
    capped at 1 — runs out of room long before the relief reads.
  - **`hillshade-method: multidirectional` is the bigger visible step of the two**, because it
    lights ridges that run parallel to a single sun.
  - And **neither is what was wanted here.** A 45° sun and `standard` is the gentlest rung, and it
    is the one that leaves the landmass light enough for a page of typography to sit beside.

  Rejected, so do not reach for them again: shadow 0.42 at a 28° sun with exaggeration 1 (shipped
  for one round, came back as too obvious), and shadow 0.52 at 20°, which darkens the whole
  landmass until the globe reads as a satellite render — the one thing this page is trying not to
  look like.

  Relief is **off by default**, which has a side effect worth knowing: entering `explore` makes no
  third-party request at all until the Relief chip is pressed. That was one mode's behaviour out
  of two when it was written; since 7 Sep 2026 it is simply what arriving on the page does.
  Trails mode keeps its own separate setting and always did. Both still anchor to black and white
  rather than to `fg`, for the reason in the section above — verified in dark.

**Mapterhorn is a sparse pyramid, and the console said so.** A tile containing no land does not
exist: measured, `0/0/0`, `2/3/1` and `6/53/26` return 200 while `3/0/0` and `6/54/28` return 404.
Over a whole hemisphere that is a handful of expected 404s per view, which is exactly enough to
bury the errors worth reading, so `map.on('error')` now filters a 404 on a DEM source and logs
everything else. MapLibre draws nothing where a tile is missing, which is the right answer for open
ocean. The browser still prints its own "failed to load resource" line per tile; that one belongs
to the network stack and no handler can remove it.

**What it costs.** The MapLibre engine chunk went 242.9 → 244.5 KB gz — 1.6 KB for the whole atlas,
because the expensive parts are data, and the data is fetched when its chip is switched on: the
two label files are 9 KB gz together and `borders.json` is 82 KB. The eager page script is
**unchanged at 1.8 KB**, and site-wide CSS and JS are untouched. (Written when `atlas` was a mode
and the data arrived on first entry to it; the files and the sizes are the same, the trigger is
now the chip.)

**Verified in Chrome against the production build**, not the dev server — which matters here,
because the first pass ran against a long-running `astro dev` that was serving stale scoped CSS and
showed every label unstyled. Both themes, Sepia, 1400px and 390px (0 horizontal overflow), the
camera-continuity check above, terrain still reached and left correctly, and a clean console.

**Not yet decided, and left alone deliberately:** at the home view the trip cards sit on top of the
country labels for China, Japan and Thailand, so those names lose their space. That is the
declutter working as designed — a card naming the city says more than the country name under it.
It used to matter, because it hid the accent treatment; with that gone it is simply a country name
covered by something more specific. And `GLOBE_HOME` at zoom 2.3 is tuned for the desktop frame;
in a 390px-wide frame it crops to Asia rather than showing the globe. Both predate this work, and
both survived the 7 Sep 2026 cut to two modes. (`GLOBE_HOME` was `PLACES_HOME` until then.)

### The explore mode (3 Sep 2026)

The brief was "more information on the earth, but do not make it messy" — so the answer is not
more layers on the atlas, it is a **mode with a filter row**. `MAP_LAYERS` is five filters and
`DEFAULT_LAYERS` is what `explore` opens with. It was the fourth of four modes when it shipped;
since 7 Sep 2026 it is one of two, and it is the chip labelled **Trips**.

**`DEFAULT_LAYERS` is `['countries']` alone** (revised 3 Sep 2026, author's request). It used to
be the same list as `ATLAS_LAYERS`, on the reasoning that the two modes should agree until the
reader changes something — which made the first thing anyone saw in `explore` identical to the
mode beside it, and busy. A filter row is for starting quiet and adding, not starting full and
subtracting. **`ATLAS_LAYERS` is gone** (7 Sep 2026), along with the `atlas` mode it defined; this
is now the only layer set in modes.ts. That the two lists were deliberately different is the
reason removing `atlas` cost nothing — `explore` already opened on less than it drew, and its
chips reach everything it drew and more.

| Filter | Default | Draws | Data |
|---|---|---|---|
| Countries | on | boundaries + 177 names | `borders.json` + `atlas-countries.json` |
| Cities | on | dots + 243 names | `atlas-cities.json` |
| Relief | off | global hillshade, one strength (see below) | Mapterhorn DEM tiles |
| Peaks | off | 632 named mountains, ▲ + height | `atlas-peaks.json` |
| Rivers & lakes | off | 552 rivers, 411 lakes, unnamed | `atlas-rivers.json` + `atlas-lakes.json` |

**The trips are not in that table and that is the point.** Footprints and trip cards are drawn
in every globe mode and answer to no filter. The panel used to say so in a line of small print
under the chips; that came off on 3 Sep 2026 at the author's request, and the claim now lives in
the page's own prose above the frame, where it is a sentence rather than a caption on a control.

Things that look like bugs or shortcuts and are not:

- **Data is fetched per filter, not per mode.** `ensureData(layer)` keeps a `Map` of in-flight
  promises, so switching a layer on downloads exactly its own files, switching it off downloads
  nothing, and switching it back on re-uses what is already there. Verified in Chrome by watching
  the request log across nine toggles: entering `explore` fetched borders, countries, cities and
  DEM and nothing else; each later chip fetched only its own file; every toggle after that fetched
  nothing at all.
- **Layer visibility is set in one full pass, never diffed.** `setLayoutProperty` to a value a
  layer already has is a no-op inside MapLibre, so a diff would be state to keep correct in
  exchange for nothing.
- **▲ is text, not an icon layer.** A MapLibre icon needs a sprite sheet — a second network
  request and a build step — and the glyph is already in every system font. Three ranks of name
  then tell themselves apart by setting and mark with no legend, no sprite and no glyph server:
  countries in letterspaced mono caps, cities in mixed-case sans, and peaks with ▲ and a height.
  The mark is `aria-hidden`: "black up-pointing triangle Everest" is a worse thing for a screen
  reader to say than "Everest".
- **Rivers and lakes are geometry only, and were named for exactly one round** (3 Sep 2026). The
  names were built the way the rest of the atlas is — a fourth label rank in italic, anchored off
  a third file, `atlas-water.json`, holding 494 anchors: the point half way *along* each river
  rather than its bbox centre, and the area centroid of a lake's largest ring. It worked, and it
  was the wrong answer to the brief: at globe zoom that was 91 candidates in the most crowded part
  of the map, and this mode exists to add information *without* making a mess. The author took
  them off the same day. **The file, its build step and the `water` entry in `LABEL_LAYER` are all
  gone rather than left switched off** — a `node scripts/build-atlas.mjs` run that still emitted
  an orphan would be worse than the churn. Git history has all of it; if the answer changes again,
  the cheap version is a far bigger `WATER_ZOOM_SHIFT` so only a dozen of the biggest names ever
  reach the globe view.
- **The river line is wider than it looks like it should be**, 0.9px at globe zoom against the
  0.5px it shipped with. The sea steps 0.10 off the ground and the land 0.20, so a river on land
  is a tenth of the ramp apart from it — 1.24:1, which reads perfectly well as an ocean and not at
  all as a hairline. The naming round is what surfaced it, and the width is kept now the names are
  gone: a river at 0.5px was invisible with or without a word on top of it.
- **A peak's label has a real space before its height, as well as the CSS margin.** The margin
  separates them on screen; without the space the accessible name and anything copied out of the
  page read "Mount Everest8,848 m".
- **Optional layers can never bury the base map.** Declutter priority runs trips 0, visited
  countries 5, countries 10–17, cities 24–29, peaks 32–38 — the same order as `MAP_LAYERS`, so a
  layer added at the end of that list cannot cost the ones before it their space. Within peaks the
  file order (zoom band, then height) carries into a collision. Water draws no labels at all, so
  it claims no priority.
- **`retier()` ends by calling `declutter()`**, and that is not tidiness (3 Sep 2026). `declutter`
  is wired to `render`, and MapLibre only renders when something changes — so switching a layer on
  while the camera was still added its labels and then left every one of them visible, stacked,
  until the map happened to repaint. With four optional layers on that was twenty peak names piled
  over the Himalaya, and it read as a broken collision test rather than an un-run one. Measured
  before and after at the home view: 26 visible peak labels with overlaps, against 9 with none. A
  just-added marker has no occlusion opacity yet, so a far-side label can claim a slot for exactly
  one pass and the next real render corrects it — the right way round, because a label that
  appears and then goes beats a screenful that never resolves.
- **Rivers and lakes take the SEA's colour**, not one of their own. A lake is the same substance
  as the ocean and the palette already says what that looks like in nine themes. The hillshade is
  inserted beneath them, so relief shows through land and not through water.
- **`relief`, not `terrain`, as the layer id.** There is already a MODE called `terrain` and it is
  a completely different thing — one ridge with a GPS track on it, not a global hillshade. One
  identifier meaning both is how the wrong one gets switched. The chip still reads "Relief".
- **A second storage key, `mapglobe-layers`.** Same reasoning as the site's two theme keys: a
  reader who tunes the filters, looks at Trails and comes back should find their filters
  where they left them, and one combined key would have to forget one to remember the other. An
  empty stored string is a real answer — every filter off — so it is told apart from "nothing
  stored" by a null check rather than by falsiness. There is no third key any more; it belonged to
  the relief ladder.
- **`LAYER_COPY` is a `Record<MapLayer, …>`.** Adding a layer to `MAP_LAYERS` and forgetting its
  chip is then a build error rather than a filter nobody can reach.
- **The controls sit INSIDE the frame, over the map** (3 Sep 2026, author's request), and three
  things follow from that. The panel is a *sibling* of the stage rather than a child of the map
  container, so MapLibre never sees a pointer event that starts on it — drag and wheel over the
  panel do nothing to the camera, and drag and wheel anywhere else are untouched. It is positioned
  rather than laid out, so it costs the frame no height: at 390px the frame is 26rem and a control
  row above it was eating an eighth of the map. And it is hidden until `data-state="ready"`, so it
  never floats over the "Drawing the map" message. Verified both ways in Chrome — a drag started
  on the panel leaves the globe still, a drag started beside it moves it.
- **The panel is one grid and its group is `display: contents`.** Labels land in the first
  column, chip rows in the second, so any two rows of chips start at the same x — wrap each row in
  a real box instead and the second is pushed right by the width of its own label, which is what
  it looked like when there were two rows. There is one row now that the relief ladder has gone;
  the structure is kept because the next group added would hit the same bug. Below 640px the label
  column collapses and labels sit above their rows: 45px of fixed width is worth more as a chip
  than as the word "Layers" when the frame is 390px wide.

**What it costs.** The MapLibre engine chunk is 245.2 KB gz and the eager page script 2.0 KB —
the whole filter mechanism is under a kilobyte, because everything expensive is data and no data
is fetched until a chip is pressed. Dropping Heritage took 146 KB (45 KB gz) of JSON off the
repo and one live Wikidata query out of the build, and dropping the water names took another
23 KB (8 KB gz). Site-wide CSS and JS are untouched.

**Verified in Chrome against the production build** (3 Sep 2026, when there were still four tabs;
re-verified for two on 7 Sep). Four tabs and five chips render; `explore`
opens with Countries alone and fetches exactly `atlas-countries.json` + `borders.json` and nothing
else — not even a DEM tile, since Relief is off by default; each later chip fetches only its
own files and re-toggling fetches nothing at all; `atlas` was provably unaffected by the filter
set; no relief ladder, no water label and no note in the DOM; country and city names read back at
`fg-meta` and peaks at `fg-body`, with a `bg` halo, in both themes; labels at 1400px show **0 pairwise overlaps**,
including immediately after a toggle with the camera still; 390px gives 5/5 clickable chips and
0 horizontal overflow; console clean.

**Known and left alone:** at globe zoom the trip cards still cover the country labels for China,
Japan and Thailand — declutter working as designed, since a card naming the city says more than
the country name under it. And a cluster of peaks loses most of its names to itself: the Himalaya
carries a dozen candidates in one degree and greedy decluttering keeps two. That is a property of
the collision rule rather than of these layers, and it is the same rule the three.js earth uses.

### The route picker (4 Sep 2026)

Terrain mode used to be a ridge in Taiwan nobody walked, waiting for a file to be dropped on it.
It now carries ten real routes, picked from a panel in the corner of the frame: seven hikes and
three half marathons, all the author's own. (It opened *inside* one of them until 9 Sep 2026;
it now opens on the overview of all ten and the panel is no longer the only way in. See "The
trails overview" below — everything in this section still describes the single-route view the
picker leads to.)

| | | |
|---|---|---|
| Belumut | Johor, Malaysia · 25 Jul 2026 | 14.5 km · 1,127 m · 66–1,017 m |
| Muluozi – Lamasi | Changping Valley, Chuanxi · 30 Jun 2026 | 10.6 km · 94 m · 3,407–3,667 m |
| Muluozi – Wuguishi | Changping Valley, Chuanxi · 29 Jun 2026 | 11.1 km · 201 m · 3,664–3,754 m |
| Lamasi – Muluozi | Changping Valley, Chuanxi · 28 Jun 2026 | 11.5 km · 316 m · 3,412–3,675 m |
| Cape Krathing | Phuket, Thailand · 17 Nov 2025 | 3.8 km · 203 m · 1–136 m |
| Lambak | Johor, Malaysia · 31 Aug 2025 | 5.4 km · 529 m · 63–518 m |
| Pulai | Johor, Malaysia · 9 Aug 2025 | 10.2 km · 557 m · 41–622 m |
| Iskandar City | Johor, Malaysia · 25 Apr 2026 | 20.7 km |
| Kulai | Johor, Malaysia · 21 Dec 2025 | 21.3 km |
| Dato Onn | Johor Bahru, Malaysia · 21 Sep 2025 | 21.2 km |

The three Changping Valley walks are legs of one trek and fall inside the Chengdu trip
(26 Jun – 1 Jul 2026); Cape Krathing falls inside Phuket (14–18 Nov 2025). Nothing links them in
code — that is an observation, not a feature, and a trip page showing its own routes is the
obvious next step if this earth wins.

**It is a build step, and it has to be.** The ten GPX exports are 31 MB of XML: Strava samples
every two seconds and writes a heart rate on every point, so one afternoon on a hill is 27,533 of
them. `scripts/build-trails.mjs` simplifies at 4 m with Douglas–Peucker — under one GPS fix's own
error, so there is no real detail left to lose — and 124,219 points become 2,341. That is 46 KB
on disk and 11 KB gzipped across ten files. The GPX originals stay outside the repo; the script
reads them from `~/Downloads/gpx` by default, laid out as `hike/` and `run/`, walking nested
folders.

**The figures and the geometry are measured on different tracks, deliberately.** Distance, ascent,
elevation range and point count come from the FULL recording; only the drawn line is simplified.
Simplifying a GPS trace cuts its measured length by a few percent, so measuring the simplified
line would quietly shorten every distance the page prints, and nobody would ever catch it. The two
never touch, so tightening the tolerance cannot move a printed number. It was cross-checked once
against a completely separate code path — dropping `Lambak_Johor_Malaysia_Morning_Hike.gpx` on the
frame, which parsed in the browser, read back the same 5.4 km and 63–518 m as the built-in route.
**That second path no longer exists** (7 Sep 2026), so the build script is now the only thing that
measures a route, and a regression in it has nothing to disagree with. If these figures ever need
checking again, do it in `scripts/build-trails.mjs` against a known GPX rather than looking for a
drop target in the page.

Things that look like shortcuts and are not:

- **The manifest is in `src/data/`, the geometry in `public/globe/trails/`, and that split is the
  whole design.** `MapGlobeStage.astro` imports the manifest at build time and renders the ten
  chips as static markup, so nothing is fetched to draw the picker; the same 2.1 KB goes inline as
  JSON for the readout's figures. Only geometry crosses the network, only for a route someone
  picks, and only once — `loadTrail` caches the in-flight promise, the way `ensureData` does for
  the atlas layers. Measured: entering terrain mode fetches exactly one file, and re-picking two
  already-seen routes fetches nothing at all.
- **Arriving on the page still contacts nobody.** Verified again after this landed — the set of
  third-party hosts is empty with the map loaded and left as it arrives. The routes are local
  files, so picking one is a request to this site and to nowhere else. (Written of `places` mode;
  since 7 Sep 2026 the property is carried by `explore`'s two local default layers.)
- **There is no bounding box in the manifest.** The camera is framed from the geometry it just
  drew. An extent carried alongside would be a second source of truth for where a route is: one
  that could disagree with the line on the map, and would be believed.
- **A third storage key, `mapglobe-trail`.** Same reasoning as the layers key. **An empty string
  is a real answer again (9 Sep 2026) and means the overview** — every route on the map, none
  picked. It meant something else once, "Clear was pressed", and that reading died with the
  button on 7 Sep 2026; for two days nothing wrote one at all. Nothing had to be added to handle
  a stale one: an id that matches no route falls through to the same place, which is now the
  overview rather than the first route. Verified in Chrome by planting both.
- **There is no default route any more.** `trails[0]` was it until 9 Sep 2026, and picking a
  default is exactly what the overview exists not to do. The build script's sort — hikes before
  runs, newest first — is now only the order the picker reads down.
- **The opening route is drawn BEFORE the first `applyMode`, not after.** `applyMode` reads
  `trackBounds` to decide where the camera goes, so in this order the map arrives already framed
  on the route; the other way round it frames the Taiwan placeholder and jumps once the geometry
  lands. It also means `attachTerrainWhenSettled` is now reached once with no `dem` source declared
  yet — hence `ensureTerrainSource()` moved inside it, so the function that attaches terrain owns
  its source and the order cannot come apart again. That bug shipped for one build and said so out
  loud: *cannot load terrain, because there exists no source with ID: dem*.
- **Terrain mode remembers.** Going out to the globe and back returns to whichever of its two
  views was up — the route, or the overview — because `applyMode` reads `focused` first and then
  `trackBounds`. TERRAIN_HOME is reached on a failure and nothing else: a route that was asked
  for and would not load. It is not dead code; it is the null-`trackBounds` fallback, and since
  9 Sep 2026 "no route picked" is a view of its own rather than a fall through to it.
- **Track layers are hidden in every globe mode.** A 14 km walk at globe zoom is a sub-pixel speck
  of accent somewhere in Johor. It answers no question the globe is being asked, and it competes
  with the footprints that do.
- **A filled dot at the start and a ring at the end, as their own source.** A circle layer over a
  LineString draws a circle at every vertex, so the ends cannot be marked off the `track` source.
  Without them a loop and a point-to-point walk are the same picture, and three of these routes are
  one half of an out-and-back. On a real loop the two coincide, and the end is pushed first so the
  start wins the overlap.
- **The picker shares its CSS with the explore filters** — one `.panel` grammar, two panels, each
  gated on its own mode. A chip is a chip, and a picker appearing in a different corner at a
  different size would read as a different kind of control. It is also exactly the two-group case
  the `display: contents` structure was kept for: labels land in the first column and chip rows in
  the second, so the `Hikes` and `Runs` rows start at the same x. The routes panel adds a
  `max-height` and a scroll, because ten chips in two rows is taller than five in one and the frame
  is 26rem on a phone.
- **One radiogroup across both rows.** Exactly one route is on the map at a time, so two
  independent groups would misdescribe the control; the `Hikes` / `Runs` legends are plain text
  inside it. Radio rather than the `aria-pressed` toggles next door, because those five layers are
  independent and these ten are one choice.
- **The date is shifted by longitude before it is formatted.** GPX times are UTC and three of the
  ten start before 04:00 local, so printed as UTC they would be dated the previous day — and a GPX
  file carries no timezone at all. 15° per hour is an hour out for Sichuan and cannot move any of
  these dates, since every one starts at least five hours from midnight. A recording that starts
  near local midnight is the case to distrust.
- **Three run names are a hand-written table in the build script.** The derived name works for the
  hikes, where Strava writes `<where>, <region…> <activity>` and the first comma is the split. The
  runs do not follow that shape at all ("First Half Marathon Morning Run - Dato Onn"). A file not
  in the table still builds; it just gets the rougher name.

**The theme bug this surfaced, which was there all along.** `refreshTheme`'s `setPaintProperty`
calls do not reach a draped map: with terrain attached MapLibre renders each tile into a texture
and drapes it, and a paint change does not invalidate that cache — nor does moving the camera, nor
does waiting. Measured as the mean colour of the canvas across a light → dark flip:

| | light | dark |
|---|---|---|
| `places` (removed) | 231 | 32 |
| `atlas` (removed) | 230 | 33 |
| `explore`, re-measured 7 Sep | 233 | **34** |
| `terrain`, before | 178 | **166** |
| `terrain`, now | 178 | **60** |
| `terrain`, re-measured 7 Sep | 180 | **62** |

The 7 Sep rows are the same check after the cut to two modes, and they are two points of noise
away from the originals — which is the result worth having, since it says the removal changed
nothing about how either surviving mode repaints. Measure the canvas with an **element
screenshot**, not `drawImage` on the live canvas: MapLibre runs without `preserveDrawingBuffer`,
so reading its canvas from a separate task returns a black frame and every row above comes out 0.

Nothing in the route work caused it — terrain mode simply never had content worth looking at
before, so nobody saw it. The fix is to detach and re-attach the terrain, **and it has to wait for
a render.** Doing it in the same tick as the paint changes is coalesced away and stops at 152;
hanging it off the next `render` event still only reaches 141, and leaves the map a theme behind in
*both* directions. It has to be `once('idle')` — the drape can only be rebuilt from a style that
has actually finished drawing in the new colours. One frame of flat terrain, on a theme change
only. Round trip verified: 178 → 60 → 178.

**Astro drops the whitespace between a text node and an inline tag that opens the next line.**
Three of these were live on this page — "underneath.Explore", "on or off.Trail terrain",
"colour.The places" — and they are invisible in the source and in a passing build. They showed up
at 390px, where the wrap put them mid-line. Keep an opening `<strong>` or `<code>` on the same line
as the words before it, even where that leaves a long line.

**What it costs.** Page-scoped, entirely:

| | before | after |
|---|---|---|
| eager page script | 1.97 | **2.29** KB gz |
| MapLibre engine chunk | 245.83 | **246.25** KB gz |
| `/about/travel-preview` CSS | 3.21 | **3.29** KB gz |
| site-wide CSS and JS | — | unchanged |

**Verified in Chrome against the production build.** (4 Sep 2026, when terrain opened inside a
route. The overview replaced that opening on 9 Sep; everything below still holds of the picker
itself, which is unchanged apart from the "All routes" chip at the top of its group.) Ten chips in
two rows; terrain opens on Belumut having fetched exactly one route file; picking another swaps
the line and the readout;
re-picking two already-seen routes fetches nothing; mode and route both survive a reload; a dropped
GPX still draws and unchecks the picker, and Clear empties the map and persists as "no route"
(**both removed 7 Sep 2026** — this records what was verified at the time, not what the page does
now); the picker is keyboard-reachable as one `radiogroup` and Enter selects; the light↔dark round trip
repaints the draped terrain; 390px gives 10/10 clickable chips, 0 horizontal overflow, and a panel
inside the frame at 29% of its height. Console clean apart from transient
`ERR_CONNECTION_RESET`s on Mapterhorn tiles, which the engine's error handler reports correctly.

**Known and left alone.** Over flat coastal ground — the three runs — the global hillshade shows a
hard diagonal seam at a DEM tile boundary, rotated to match the -22° bearing. It is a
discontinuity in Mapterhorn's data at that zoom rather than a rendering bug, it survives twelve
seconds of settling, and it is invisible on the seven hikes. The unselected chips are `fg-faint`,
already recorded above as 2.31:1 in Classic and a known fault in the original palette; that strains
harder here, where the chips are ten proper names rather than five common words, but the style is
shared with the explore filters and changing it is a design decision rather than a fix.

### The trails overview (9 Sep 2026)

The author's complaint was that Trails is a single-route view: it opened *inside* one walk, and
the only sign that there were nine others was a row of chips. The trips half puts its collection
on the map and lets you click into one, and this half did not. So terrain mode is now **two
views** — an overview of everything, and the single route it always had — and `focused` in
engine.ts is the one variable that says which. `applyMode`, `applyLayers`, `retier` and
`declutter` all branch on it and nothing else has to know.

**The overview draws every route and names them in three groups.** Six of the ten are inside one
corner of Johor, three are legs of one trek up the Changping valley, and one is in Phuket — so a
card per route is not a thing the map can show at the zoom that holds all ten. The cards read
"Johor · 6 routes", "Changping Valley · 3 routes", "Cape Krathing · 3.8 km". Click a
group and the camera zooms into it, where the group is replaced by its members; click a route and
it flies down to the ridge. A group of one is just the route, so Phuket is one click, not two.

**The grouping is measured in pixels, not kilometres, and the reason is the frame.** The question
is not whether two routes are near each other but whether their two cards would be the same mark
on this screen, and that depends on how big the map is: `cameraForBounds` is asked for the
overview camera first, and the routes are clustered at that zoom. A kilometre threshold got it
wrong in both directions — 40 km split Johor into a northern pair and a southern four, two marks
seven pixels apart. Single-linkage rather than a radius, because six routes strung 20 km apart
across 76 km of Johor are one place to anyone reading the map.

**A group breaks open at the zoom where its two FURTHEST members are 150px apart**, and its
members carry that same number as their `minZoom`, so there is no zoom at which both a group and
its routes are on the map, and none where neither is. Measured on the tightest pair instead, it
would never open at all: two of the Changping routes start 370 m apart and one pair is the same
path walked in both directions. Those pairs still collide after the break — since 10 Sep 2026
they are drawn as one card naming both rather than one of them being dropped —
and the picker below the frame is what guarantees every route is reachable.

**With one cap: 120 km, whatever the pixels say.** At 390px the whole collection sits at a zoom
where Phuket is eighty pixels from Johor, so the two grouped and the card read **"Johor · 7
routes"** over a group spanning two countries — a group is named after a place, so it has to be
one. The name itself is taken from the members' own `place` field, most common first and ties to
the shorter, which is what puts "Johor" and "Johor Bahru" under "Johor" without a table of area
names that a new route could fall outside of.

**The label anchor is the START of each walk, not the middle of its extent.** Muluozi–Lamasi and
Lamasi–Muluozi are the same path in opposite directions: their extents share a centre to within
200 m, and their starts are 9 km apart. The start is also already the mark this map draws for
"a route begins here", so the card lands on something the reader can see.

**All ten geometries are fetched on entering the mode**, where it used to fetch exactly one. They
are local files — 46 KB on disk, 11 KB over the wire — the overview is what they are for, and
having them in hand makes picking a route instant. A route that will not load is nine routes, not
a broken mode. Everything else about the fetching is unchanged: `loadTrail` still caches per id,
so nothing is ever downloaded twice, and arriving on the page still contacts nobody.

**The overview shades relief unasked**, at the same gentle strength the Relief chip uses on the
globe. This is the mode that fetches elevation and the reader came here for terrain; the routes
are the only marks on this map whose surroundings are the point.

Things that look like shortcuts and are not:

- **A route card carries `data-mapglobe-trail`, the same attribute the picker's chips carry.**
  The page's delegated click handler picks it up without the engine knowing anything about the
  panel, so the two ways into a route cannot drift apart. `markTrails` is therefore scoped to
  `[role='radio']` — writing `aria-checked` onto a card floating over a mountain would tell a
  screen reader it is one option in the picker below the frame.
- **"All routes" is a member of the picker's radiogroup, not a button beside it.** "Show me all
  of them" is one of the answers to "which route", and a radiogroup with nothing checked would
  describe a map that is showing something less well than one where the overview is checked.
- **The projection swap moved to the END of the fly** (`attachTerrainWhenSettled`). It used to be
  set at the top of the terrain branch, which was invisible while the mode began with a fly from
  a globe nobody was looking at. The overview *is* a globe the reader is looking at, and swapping
  the projection under it pops the whole map flat for the length of the fly. Set on arrival at
  z12+, where MapLibre's globe has already handed over to mercator on its own, it is invisible.
  The requirement was only ever "mercator before `setTerrain`".
- **`declutter` now reserves the control panel and the attribution before it places anything.**
  The panel floats over the map, so a card that lands under it is not merely hard to read — it is
  a button the reader cannot press, sitting under a button they can. This fixes the same
  pre-existing bug on the globe half.
- **And `framePadding` flies the camera clear of the panel**, which is the other half of that: a
  fit that centres six routes centres two of them under the panel, and hiding them is correct but
  leaves four cards where six routes are. It costs a fifth of a zoom level on a desktop frame.
  **It is skipped when it would leave less than 45% of the frame** — at 390px the panel is 324px
  of a 342px map, and fitting into the strip beside it is worse than landing partly under it.
- **The attribution's strip is reserved as a constant, not measured.** The pill is EMPTY when the
  fit is computed: its text is Mapterhorn's and arrives with the DEM TileJSON a second later. So
  it measures 0×0, is skipped as "not on screen", and the card in that corner is then decluttered
  away when the notice appears beneath it. That cost a card at 390px until the strip became a
  constant. Only its HEIGHT is padded around — clearing it vertically clears it whatever its
  width, which is a third of the frame on a phone.
- **A group card outranks a route card in a collision** (priority 0 against 1). They meet at
  exactly one moment — the overview of a small frame — and there a card standing for six routes
  says more than one standing for a single route two hundred miles away.

**What it costs**, page-scoped entirely:

| | before | after |
|---|---|---|
| eager page script | 2.07 | **2.24** KB gz |
| MapLibre engine chunk | 244.86 | **246.27** KB gz |
| `/about/travel-preview` CSS | 3.11 | **3.13** KB gz |
| site-wide CSS and JS | — | unchanged |

**Verified in Chrome against the production build**, 34 checks plus 11 more on the interaction
paths, all passing: Trips arrives unchanged and still contacts no third party and fetches no
route file; Trails opens on three cards with the overview chip checked and no route radio checked;
all ten routes fetched, and opening a group or picking a route fetches nothing more; the Johor
group opens into its six routes with nothing under the controls; a card takes focus; the readouts;
storage round-trips including a planted dead id and a planted empty string, both landing on the
overview; a route chip pressed while the globe is up switches the mode and flies; route→route;
out to Trips and back returns to whichever view was up; 390px gives two cards, 11/11 clickable
chips and 0 horizontal overflow; console clean throughout.

The light↔dark round trip was measured as the mean canvas colour, the same way the table under
"The route picker" was — an element screenshot, never `drawImage` on the live canvas:

| | light | dark | back |
|---|---|---|---|
| `explore` | 233 | 33 | 233 |
| `terrain`, overview | 207 | 51 | 207 |
| `terrain`, one route (Cape Krathing) | 201 | 46 | 201 |

The `explore` row is two points from the 233 → 34 recorded on 7 Sep, which is what says the
method is the same one. The overview is not draped, so it repaints like the globe; the focused
route still needs the `once('idle')` re-attach documented under "The route picker".

**A thing that looks like a rendering bug and is not:** for a few seconds after entering the
overview the relief has a hard diagonal edge in a corner, with flat land beyond it. That is the
DEM tiles still arriving, and it settles. Screenshot it before it does and it looks exactly like
the Mapterhorn seam recorded above, which is a different thing.

**Known and left alone.** At 390px the panel is 39% of the frame's height with eleven chips, and
the Changping card sits under it — the phone shows two of the three groups, and the third is a
chip away. And `declutter`'s "nearest to the middle of the frame wins" means which two, exactly,
depends on where the camera settles.

### The All tab, and the angle Trails opens at (9 Sep 2026)

Two changes the same day as the overview above, both the author's, and the second
is a correction to the first.

**A third tab, "All" (`combined`), puts both halves on one globe.** The eight visited footprints
and the ten recorded routes, each behind its own chip, over the same five layer filters `explore`
has. `MAP_CONTENT` is that filter — two members, `trips` and `trails`, both on by default, under a
fourth storage key `mapglobe-content`.

| | | |
|---|---|---|
| **Trips** (`explore`) | the globe | footprints, always; five layer chips |
| **Trails** (`terrain`) | pitched terrain | every route, then one; eleven route chips |
| **All** (`combined`) | the globe | both, behind two chips; the same five layer chips |

- **It is deliberately a superset of `explore`**, which is worth saying out loud because that is
  exactly the redundancy the 7 Sep cut removed: `places` and `atlas` were positions on `explore`'s
  own dial. `All` with Trails off *is* `explore`. The difference is which way round it runs — this
  one is the general case, so if the row ever needs shortening again it is the tab that can absorb
  its neighbour rather than the one to cut.
- **The content chips ride in the SAME panel as the layer chips**, as a `Show` row above `Layers`,
  hidden by CSS outside `combined` rather than living in a third panel. The layer chips are
  literally the same elements in both globe modes, and a second panel would be a second set of
  them to keep in step. This is the two-group `display: contents` case the panel grid was kept for
  — the note in the markup has said so since the relief ladder was removed.
- **A route card in `All` hands over to Trails**; a group card zooms where it stands. Clicking a
  route means "show me this one", which is a pitched terrain view and therefore a mode change;
  clicking a group means "show me these", which the globe can do without going anywhere.
- **`fitAngle()` is why a group card can be in two modes at once.** The same card is clickable in
  `terrain` and in `combined`, and its fit carries terrain mode's pitch and bearing in the first
  and nothing at all in the second — flying a globe to a pitched camera tilts the whole earth.
- **`MAP_CONTENT`'s members are called `trips` and `trails`**, which modes.ts says a MODE id could
  not be. The collision does not bite because these name the content rather than a view of it:
  `MapContent` is exactly "a trip or a trail". A mode called `trips` would have meant "the view
  that happens to show them", beside a `MapTrip` type and a `trips` variable holding them.
- **Trip cards outrank route cards** (priority 0, then a group at 1, a route at 2). They share a
  map only here, and half these routes were walked ON one of these trips — the trip is what the
  page is about and the route is a detail of it. What it decides changed on 10 Sep 2026 and the
  ordering did not: at the home view Changping and Cape Krathing used to lose their cards to
  Chengdu and Bangkok, and now share them — "Chengdu & Changping Valley", "Bangkok · Phuket ·
  Cape Krathing" — because the higher-priority card is the one that absorbs rather than the one
  that wins. Johor, which has no trip near it, keeps its own card either way.

**And Trails now opens pitched.** `TRAILS_VIEW` — pitch 62, bearing -22, the numbers the
single-route view has used since it shipped — is applied to the overview fit and to a group fit.
The overview shipped flat and top-down for a day and the author's note was that the relief no
longer read: a hillshade seen square-on is a pattern, and tilting it is what makes a range look
like a range before you have clicked into anything. The two views are now the same angle at two
scales, and the overview is a tilted globe with the horizon in it.

- **The overview stays on the GLOBE, with no terrain attached**, and it was mercator with terrain
  for one build. The swap has to happen somewhere and there is nowhere good for it at z5: at the
  start of the fly it flattens a globe the reader is looking at, and at the end — which is
  invisible for a route, because z13 is past where MapLibre's own globe hands over — the camera is
  stationary and the whole frame unwraps from a sphere into a full-bleed map in a single frame.
  Screenshotted at 1.69s and 2.05s into the fly: two completely different pictures. So
  `attachTerrainWhenSettled` kept its `!focused` guard, and only a single route is mercator.
- **The terrain mesh was buying nothing at that scale anyway**, which is what makes that a free
  choice rather than a compromise. At 20 km per pixel a mountain is under half a pixel of relief;
  what draws a range at overview zoom is the hillshade, and it needs neither a mesh nor mercator.
  The pitched group view at z10 is indistinguishable with the mesh and without it — the two
  screenshots were compared.
- **The readout is hidden outside Trails.** It names the route on the map, or what the collection
  adds up to, and under the two globe tabs it was a line reading "No track loaded" about a map
  that has no track in it. That was true of `explore` before this and nobody had looked; three
  tabs made it two-thirds of the page. Errors still surface, because every path that writes one
  has already switched the mode to `terrain`.
- **A route card lost its date and kept its distance**, and that is a consequence of the pitch
  rather than a style change. Pitch compresses the far half of the frame; at 149px a card is wide
  enough that two routes 12 km apart collide, and Belumut and Kulai were both dropped from a group
  of six. "14.5 km" is 85px and all six fit. The date is on the card's tooltip, on the picker
  chip's, and in the readout the moment the route is picked.

**What both cost**, page-scoped as ever — the numbers on the left are the overview's, recorded in
the section above:

| | overview | + All tab and the pitch |
|---|---|---|
| eager page script | 2.24 | **2.39** KB gz |
| MapLibre engine chunk | 246.27 | **246.34** KB gz |
| `/about/travel-preview` CSS | 3.13 | **3.18** KB gz |
| site-wide CSS and JS | — | unchanged |

**Verified in Chrome against the production build**, 25 checks on the new tab plus a re-run of the
34 above, all passing: three tabs with Trips selected and the content chips absent outside `All`;
seven chips in `All` with both content chips on; trips and route groups sharing the globe; each
content chip switching its own half off and storing the choice, including both off (a bare globe)
and an empty stored string; a group card zooming without leaving `All`; a route card switching to
Trails and flying; filters surviving a trip to Trails and back; 390px restoring a stored mode and
content, keeping the three-chip switcher on one line, 7/7 chips clickable and 0 horizontal
overflow; the pitched overview and the pitched group view screenshotted in both themes; console
clean throughout. The light↔dark round trip re-measured on the pitched views: overview
226 → 38 → 226, one route 201 → 46 → 201, `explore` unchanged at 233 → 33. The overview's figures moved from the 207 → 52 recorded above when it went back to the globe, and the reason is the frame rather than the map: a sphere with the ground colour around it is lighter in light and darker in dark than a map that fills every pixel.

**A caution for the next probe.** `.switch` is not unique on that page — the three.js earth above
has its own look switcher with the same class, and a check for "the switcher is on one line" that
forgets to scope to `[data-mapglobe]` measures the OTHER one, which has six options and two rows.
It failed for exactly that reason before it passed.

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

### Cards merge instead of disappearing (10 Sep 2026)

The author's note was about the `All` tab: Chengdu and the Changping valley are 120 km apart, so
at the home view their two cards land on top of each other, the trip card wins, and the three
walks up that valley are simply not on the map. *"When 2 trips/trails or trips and trails
collapse, the label will include the trip and trails together."* So they do — the two cards are
now drawn as one reading **"Chengdu & Changping Valley · 1 TRIP · 3 ROUTES"**, and clicking it
zooms until they separate.

**There is no threshold constant, and that is the design.** Two cards merge exactly when the
collision pass would otherwise have hidden the second: same boxes, same `LABEL_PAD`, same test,
decided in the same loop. A number of its own would be a second and slightly different definition
of "too close", and the two would disagree at the margin — which would show up as a card that is
hidden and named nowhere, the exact bug this fixes. Measured at the home view in `All` at 1400px:
**six cards naming eleven things**, against eight cards naming eight before.

Every card carries a `stack` part — a name, what it stands for, and its own extent — so a merge
can be trips with trips, route groups with route groups, or the case this was built for, a trip
with a walk taken on it. **The atlas ranks deliberately have none.** They are names of places
rather than things the page is about, they arrive by the hundred, and "China & Chengdu" is not a
label anyone wants; those still lose their space the old way.

Things that look like shortcuts and are not:

- **Greedy absorption, NOT single linkage — and linkage was tried first.** The reasoning for it
  was that three cards in a row should become one card rather than two overlapping ones, and it
  chained catastrophically: at the home view five of the eight trip cards and a route group are
  one unbroken run of near-touching boxes across Asia, so the map collapsed to four cards, two of
  which read "& 4 more". What ships is that a card absorbs what **it** covers and no further,
  which is a rule the reader can see working, because the absorbing card is the one that was
  going to win the space anyway. It is also why the pass runs in priority-then-distance order —
  the same order that used to decide which card disappeared.
- **Grouped on the members' INDIVIDUAL boxes, never on the merged card's.** A merged card is
  wider than the card it grew out of, so it can reach a neighbour its winner did not, and folding
  that neighbour in as well does not converge — it makes the card narrower ("Chengdu +2" is half
  the width of "Chengdu & Changping Valley"), which un-covers the neighbour, which splits the
  card, which covers it again. That oscillates at every frame. Grouping only on the inputs makes
  it a pure function of where the cards are.
- **A width budget rather than a cap on the number of names**, because they are not the same
  question: "Bangkok · Phuket · Cape Krathing" is three names and fits, while "Guangzhou &
  Shenzhen · Taichung & Taipei" is two names and four cities and only just does. The card is
  built naming everything, measured, and refilled as "Bangkok +2" only if it came out over
  `MERGE_WIDTH` of the frame — with the full list on its tooltip. Measuring costs nothing extra:
  the card has to be measured for the collision pass regardless, and neither branch runs unless
  the membership changed. At 390px the budget is what turns every merged card into "+N".
- **"&" joins a pair, "·" joins anything else.** Two of these trips are already two cities —
  "Guangzhou & Shenzhen", "Taichung & Taipei" — and being the widest cards on the map makes them
  among the likeliest to merge; "Guangzhou & Shenzhen & Taichung & Taipei" is four ampersands
  joining nothing. So an "&" already inside a name, or a third member, falls the join back to the
  separator the rest of the page uses.
- **Clicking a merged card fits its members' combined extent**, capped at `MERGE_MAX_ZOOM`. That
  is the same thing an area card does and for the same reason: the card says "several things are
  here", so the one useful response is to separate them. The cap is because that extent can be
  200 m across — two trailheads would otherwise ask for zoom 18, a street corner on a map whose
  deepest elevation data is z12.
- **The cards are pooled and rebuilt only when their membership changes.** `declutter` runs on
  every `render`, so rebuilding one per frame would put a forced layout in the middle of every
  frame the map draws. The pool key is the whole identity of the card — its members, winner
  first — so panning a merged card around the frame writes nothing at all.
- **A merged card that cannot be placed falls back to its members, one at a time**, so merging
  can never cost the map a name that not merging would have kept. They overlap each other by
  definition, so this normally keeps exactly one of them, which is what the pass did before.
- **`declutter` is also where the control panel gets its reservation**, so a card that clashes
  with the panel rather than with another card is hidden outright rather than absorbed. There is
  nothing under there for it to be named on.

**The bug this surfaced, which is worth knowing about any MapLibre HTML marker.** `fillCard` used
to assign `el.className`, which is fine for an element being built and wrong for one being
refilled: by then MapLibre has added its own `maplibregl-marker` class, and that is what carries
`position: absolute`. Assigning over it dropped every merged card into normal flow, and they
stacked down the frame exactly one card height apart. It presented as "the merged card is
anchored in the wrong place", and the giveaway was that the offset was `index × 38px`.
`classList.add` throughout.

**What it costs.** The MapLibre engine chunk went 246.34 → **247.88 KB gz**. The eager page
script, the page's CSS and everything site-wide are untouched — this is all inside the engine.

**Known and left alone.** In `All` at the home view the widened "Chengdu & Changping Valley" card
takes the slot Shanghai's card used to have, so Shanghai is the one name not on the map; it comes
back on any pan or zoom, and it is the trade the width budget exists to bound. It does not happen
in `Trips`, where nothing widens Chengdu's card.

**Verified in Chrome against the production build**, 22 checks plus a re-run of all 70 above, all
passing: the merged card and its count line; Chengdu not also on the map separately; every one of
the eleven trips and route groups named somewhere; zero pairwise overlaps among visible cards at
1400px and at 390px; clicking a merged card zooming, splitting it and staying in `All`; the
trails overview still three separate groups; a focused route leaving no card of any kind on the
map, merged ones included; 390px giving "+N" cards, all of them clickable and no horizontal
overflow; both themes screenshotted; console clean throughout. The light↔dark round trip is
unmoved — `explore` 233 → 33 → 233, the overview 226 → 38 → 226, one route 201 → 46 → 201.

### The `All` tab's view switch, and the panel's corner (10 Sep 2026)

Built out of the mock-up below, at the author's request: they liked its two-state
`Globe | Terrain` control and asked for it in the real `All` tab, with the filter section left
alone — *"This button should change the view only."* It shipped as two positions, and the tilted
one drew the objection that produced the version described here: **"can see global but cannot
show the terrain."**

**The panel moved to BOTTOM-left.** It used to sit in the top corner, which is where every fit
in this engine aims its subject and where every card hangs — cards are anchored *above* their
point, so the top of the frame is the busy half. Down here it overlaps the foreground, which
under all three pitched views is the near hillside: the one part of the frame with nothing on it
that has to be read. Nothing else needed changing, and that is design rather than luck —
`framePadding` already branched on which half of the frame a reserved box sits in, and
`declutter` reserves the panel by measuring its rect. Both follow the panel wherever it is put.

**Four positions, not two.** The objection is exactly right and it is forced by MapLibre rather
than chosen: **the 3D terrain mesh needs the mercator projection, and at the globe's 20 km per
pixel a mountain is under half a pixel of relief.** A whole-world view can have shading or it
can have terrain, never both. So rather than one compromise there are three positions on the
trade, which the author asked to compare on the page — the same conclusion the light themes and
the relief ladder reached.

| Label | id | What it frames | Mesh |
|---|---|---|---|
| Globe | `globe` | the flat sphere, as it always opened | no |
| Terrain 1 | `route` | ONE route, whole route in frame, ~z11 | **yes** |
| Terrain 2 | `region` | the same route's whole mountain region, 6x its extent, ~z8 | **yes** |
| Terrain 3 | `tilted` | the whole world leaned over, hillshade only | no |

**There is a fifth position now, `survey` / "Terrain 4"** — added later the same day, and it is
Terrain 2 and Terrain 1 as one view that changes scale by itself, with an index rail down the
side. See "Terrain 4, and the index rail" below; everything in this section still describes the
four it shipped with.

**The ids are not the labels**, deliberately, and this is the second place in modes.ts where that
is true. The pill reads in numbers because that is how the author will refer to them while
choosing ("keep terrain 2"); the ids say what each frames, because `view === 'region'` is
readable where `view === 'terrain2'` is not. Renumber the labels freely; leave the ids alone.

**`meshView()`, `tiltView()` and `leaning()` are the only places a view id is tested by name.**
The interesting distinction is not which of the four is selected but which of two capabilities is
in play — is the camera leaning, is the mesh attached — and those are what the projection, the
layers, the shading and the fit all branch on. Spelling `view === 'route' || view === 'region'`
at each of them is how one of them ends up disagreeing with the others.

**A route picked inside `All` stays inside `All`.** `loadTrail`'s `!meshView()` guard is what does
it: without that, clicking a route card on a mesh view would fly to the ridge and land the reader
in the Trails tab, having silently changed their mode, their panel and what is on the map — for a
click that meant "show me this one, here". `aim()` in index.ts is `pick()` minus the mode change,
and it writes the same `mapglobe-trail` key, so **a route chosen in either place is the route the
other one arrives at**. That is also what the mesh views open on: they are the only cameras on
the page that *require* a route, so unlike terrain mode a default is forced, and the order —
last-looked-at, then `trails[0]` — is what makes it defensible.

**All three terrain views shade relief and disable the Relief chip**, the two mesh views at the
harder single-ridge strength. Author's call, put to them as a question: a tilt with no shading is
a flat map at an awkward angle, and a control called Terrain that showed none would be a lie.
The stored filter set is untouched and comes back when the view goes flat — the same two-axes
split as `theme` / `light-theme`. The chip carries a **dashed border rather than a fade**, because
the usual way to show a disabled control is to lower its contrast, which here would make an
active layer look inactive.

**`GLOBE_TILT` is 40 degrees / bearing 0, separate from `TRAILS_VIEW`'s 62 / -22.** Reusing the
constant was tried first, on the reasoning that they are the same picture at two scales. In
Chrome that was wrong, because pitch is not scale-free: `TRAILS_VIEW` is tuned for z5 and z13,
and this leans from z2.3. Measured over four candidates, as the share of the frame's height the
trip cards span:

| | band | cards | |
|---|---|---|---|
| 62, -22 | 29% | 5 | trips crushed under the horizon; Australia, with no trips, owns the foreground |
| 50, -22 | 28% | 5 | Asia collapses into one "+5" card |
| **40, 0** | **36%** | **5** | **shipped** |
| 32, 0 | 40% | 6 | best composition, barely reads as tilted |

Bearing 0 where terrain mode turns -22: a rotation earns its place on a ridge, and on a
hemisphere north-being-up is information. The two mesh views take `TRAILS_VIEW` itself, since
they are at a ridge's scale.

**`REGION_GROWTH` is 6, applied to the BOUNDS and not as a zoom offset**, so the whole thing stays
in the one `fitBounds` idiom every other camera here uses and the padding keeps working. Six is
2^2.6, about two and a half zoom levels out from Terrain 1: a 14 km walk becomes an 84 km box.
`grow()` clamps latitude to the Web Mercator limit rather than 90 — no route is near a pole, so
it never fires, but a high-latitude route added later degrades to a wide view instead of a broken
fit.

**The Trails tab's own single-route fit was widened too** (`TRAIL_GROWTH` 1.6, a little over half
a zoom level), the third of the three changes asked for together. And **`fitTrack` now uses
`framePadding()` instead of a bare `min(80, width * 0.1)`** — it was the only fit in the file not
using it, which meant a route could land under the panel. That is a fix, and it costs
composition: the subject is no longer centred, because the padding steers it clear of an
11-chip panel. `fitAngle()` also replaced a literal pitch/bearing pair written out here, which
was a duplicate of `TRAILS_VIEW` that happened to agree with it.

**What it costs**, page-scoped:

| | before | after |
|---|---|---|
| eager page script | 2.72 | **3.00** KB gz |
| MapLibre engine chunk | 247.89 | **248.29** KB gz |
| `/about/travel-preview` CSS | 5.37 | **5.46** KB gz |
| site-wide CSS | 10.16 | **10.09** KB gz — see the Tailwind note, same session |

**Verified in Chrome against the production build** — :4322, not the dev server — 41 checks, all
passing: the panel in the bottom-left half, on the left, and clear of the attribution in both
panels; four options reading Globe/Terrain 1-3 on one line with Globe checked; **all six pairs of
the four views render distinct frames**; each terrain view disabling the relief chip and Globe
freeing it; Terrain 1 dropping to 3 or fewer visible cards and Terrain 3 bringing the trips back;
re-aiming from a route card staying in `All`, keeping the view and storing the new route; leaving
for `Trips` flying home and freeing the chip, and returning restoring the mesh view; the retired
`terrain` view id falling back to Globe; Trails still opening on its route with 11 chips, no view
switch and its panel bottom-left; dark; and 390px with 0 horizontal overflow, four clickable
options and the panel inside the frame. Console clean throughout.

**Known and left alone.** At 390px the panel is **35% of the frame's height** in `All`, against
13% in `Trips` — inside the range already accepted for the Trails picker at 39%. In the two mesh
views the *neighbouring* routes keep their cards but not their lines: the cards are the way to
re-aim, and ten lines at ridge zoom would be nine sub-pixel specks in other countries. And with
the panel at the bottom of the frame, on a phone it can sit below the fold until the frame is
scrolled to — which is also what made the first 390px hit-test fail, since `elementFromPoint`
returns null outside the viewport.

### Terrain 4, and the index rail (10 Sep 2026)

The author's objection to Terrain 2 was not about the picture, it was about being stuck in it:
*"the view was not big enough to see all trip and route, and if user need to scroll out to see
and select other trip and route is a very bad user experience."* So two things landed together,
and they are two halves of one answer — a view that changes scale by itself, and a list that
makes changing subject free.

**Terrain 4 (`survey`) is one view with two scales.** It arrives framed exactly as Terrain 2
does — the route's whole mountain region, `REGION_GROWTH` — and tightens to exactly Terrain 1's
frame when the reader picks a single walk. It always arrives wide: leaving the view and coming
back starts at the region again rather than resuming halfway in.

**A boolean, not a sixth pill position.** `drilled` in engine.ts is the whole of it, and the
alternative is what makes it obviously right: a fifth and sixth position on the pill would ask
the reader to move a control to say what a click on a route already said. `trackFactor` is the
one place the two scales differ, and it is three lines.

**`MESH_VIEWS` moved into modes.ts** as a list, from an `||` chain inside the engine's
`meshView()`. Terrain 4 made it three, and two separate files now need the same answer — the
engine, for the projection and the shading, and index.ts, for whether to show the rail. Two
copies of that chain is how they end up disagreeing. Membership means exactly two things:
mercator instead of the globe, and `setTerrain` on arrival. Everything a mesh view does
*differently* from its neighbours is still decided per view.

**The rail is down the RIGHT**, where every other control on this map is bottom-left, and that
is deliberate three times over. Two panels on one edge stack into a wall, and on a phone the
lower one gets pushed off the frame. A nineteen-row list cannot share a corner with a grid of
chips. And an index reads as a column, so the column it reads as is the side of the frame.

**It is a disclosure, and its default depends on the frame.** Nineteen rows is a third of a
desktop frame and most of a phone one, so a reader who wants the mountain rather than the list
has to be able to say so — and `storedIndex()` opens it where there is room and starts it shut
below 640px, with a stored answer beating both. That is a **sixth storage key**,
`mapglobe-index`, and it is the first of the six whose default is not a constant.

**The nesting is real, derived, and new to the site.** `walkedOn()` in `src/lib/content.ts`
pairs a route with a trip when the route's date falls inside the trip's range — three walks
inside Chengdu, one inside Phuket. Until now the site knew that nowhere: `src/content/trips/`
and `src/data/trails.json` are two lists that never mention each other, and the only place it
surfaced was a merged card that happened to name both. The interaction mock-up below carried a
hardcoded `WALKED_ON` table of exactly these four pairings **as part of its argument**; this is
that argument taken up.

- **Derived, never declared.** A `trip` field on a route would be a second source of truth for
  something both files already state. Adding a route needs no edit, and correcting a trip's
  dates re-pairs its routes with it.
- **Containment is evaluated at the TRIP's precision**, because that is the only side that can
  be approximate — every route has a day, three trips have only a month. `Oct 2024` covers the
  whole of October rather than one arbitrary day in it.
- **A route inside two trips throws at build time.** Nobody is on two trips at once, so it means
  two trips overlap in the content — real data to fix, against the alternative of a route
  silently nesting under whichever trip sorted first.

**A trip is selectable, not just a heading, and that is why `place` exists.** Five of the eight
trips have no recorded route in them at all, so "show me Tokyo" cannot be expressed as "load
Tokyo's first route" — a rail listing eight places and letting you click three would be worse
than one listing none. `place` is mutually exclusive with `focused` by construction:
`showPlace` clears the route and empties its track, `loadTrail` clears the place. Exactly one
thing is the subject, so exactly one row is marked and there is never a track drawn for a route
the reader is not looking at.

**A place is NOT persisted, where a route is.** The stored `mapglobe-trail` answers "which
route", and a place is how the reader gets *between* routes rather than an answer to that — so
a reload comes back to the walk they were reading, which is the thing worth returning to. It
is the one place in this engine where a reader's choice is deliberately forgotten, and it is
verified: clicking three trip rows leaves the stored route untouched.

**`PLACE_GROWTH` is 1.6 against `REGION_GROWTH`'s 6**, and the difference is what each is
applied to. Six is right for a 14 km walk, which is a line on a mountain and needs the mountain
put around it. A trip's box is already region-sized before anything is added: Tokyo's built-up
footprint is 140 km across, and Chengdu's grows to 130 km once the three Changping walks are
folded in. The same multiplier would frame a thousand kilometres of China to show one valley.

**A trip's ground is its footprint UNION its walks**, and Chengdu is why. Its footprint is the
city; its three routes are legs of one trek 100 km west, up the Changping valley. Framing the
footprint alone puts the reader on the Sichuan basin with the mountains off the edge of the
frame; framing the walks alone drops the place the trip is named after. `showPlace` waits for
the route geometry when it is coming, because a fit computed before it lands frames the city
and never corrects itself.

**Terrain 4 leaves the OTHER routes drawn**, where Terrain 1 and 2 hide them, and that is not an
inconsistency. Those two hide them because at a single ridge nine sub-pixel specks in other
countries answer nothing. This view exists to be navigated: at region scale a neighbouring walk
is genuinely in frame — three of these routes are legs of one trek up the same valley — and a
line the reader can see beside the one they are on is the cheapest possible answer to the
objection it was built for. The routes in other countries are not sub-pixel here, they are off
the edge of the frame, which costs nothing. The focused route still draws its own track over
the top, so "this one" and "the others" stay two different marks.

**`framePadding` had no right-hand branch at all**, which the rail turned into a real bug, and
the fix generalised the two special cases that were already there into one rule: **each control
is cleared on its cheaper axis.** A wide, short box costs less to clear vertically — the
attribution, 25px tall and a third of the frame wide at 390px, is stepped *over* for ten pixels
instead of a third of the map. A tall, narrow one costs less to clear horizontally — the rail,
a fifth of the width and the whole height, is stepped *around*. The old code cleared both axes
of anything in the top half, which for a full-height rail gives away the entire frame: the fit
then fails its own 45% test, falls back to plain padding, and every card lands under the rail
and is decluttered away. Behaviour at 390px is unchanged — the filters panel is wider than it
is tall there and still falls back, exactly as it did.

Things that look like shortcuts and are not:

- **`.index__list[hidden]` is an explicit rule, and the toggle does not work without it.** The
  list is `display: flex`, which beats the `hidden` attribute's UA `display: none`, so the
  collapsed rail renders open. It fails silently — clean build, `astro check` sees nothing.
  Worth knowing for any element that is both a flex container and toggled by `hidden`.
- **The rows carry `aria-current`, not `aria-checked`.** The picker below the frame is a
  radiogroup where one of eleven options is true; this is a list of places where one is where
  you are. A screen reader saying "selected" of a row in an index describes a control that does
  not exist. `markTrails` is already scoped to `[role='radio']` for the same reason, so the
  route rows share `data-mapglobe-trail` with the picker chips and the map's cards — one
  attribute, one delegated handler, three ways into a route — without any of them taking the
  wrong state.
- **Real nested `<ul>`s rather than a flat run of buttons**, because the nesting is the content.
  A screen reader gets "Chengdu, list of 3 items" instead of eleven siblings.
- **The scroll is on the LIST, not on the rail**, so the toggle stays put while the rows move
  under it. A header that scrolls away is a header the reader cannot use to shut the thing.
- **The current row is scrolled into view, at `block: 'nearest'`.** The rail is not always where
  the click came from: a route picked from its CARD on the map marks a row that can be nineteen
  rows down a scrolling list, and a mark nobody can see is not a mark. `nearest` is what stops a
  row already on screen from moving — scrolling the list under the reader on every map click
  would be worse than not scrolling it at all.
- **The trip-less group is named after where it is, not after what it is not.** Six of the ten
  routes fall inside no trip, all within an hour of home, which is exactly why they are not
  trips. `areaName` reads "Johor" off the members' own `place` fields — most common wins, ties
  to the shorter, which is what puts five in "Johor" and one in "Johor Bahru" under "Johor".
  It is a **second copy** of `areaName` in engine.ts, deliberately: that module is only reached
  through a dynamic import, and a static value import from it hoists MapLibre into the eager
  bundle. Frontmatter runs on the server and would probably be exempt, and "probably" is not
  worth finding out for six lines. Keep them in step.
- **`fg-meta` and above throughout the rail, never `fg-faint`.** It is 2.31:1 on a chip in
  Classic, a known fault in the original palette, and it is already straining on the routes
  panel's ten proper nouns; nineteen rows of them is where it would stop being legible.
- **`max-height` rather than a bottom anchor.** A rail stretched to the full height of the frame
  with eight rows in it is mostly empty, and it would reserve that emptiness from the camera fit
  as well.
- **No rail on Terrain 3.** That view keeps every trip in frame — it is the one terrain view
  with nothing to reach for.
- **The view pill wraps BETWEEN options, never inside one.** Five labels do not fit on one line
  at 390px, and left to itself each one broke into "TERRAIN" over "4" — five two-line options,
  no shorter than two rows and much harder to read. `flex-wrap` on the pill and
  `white-space: nowrap` on each option gives "Globe / Terrain 1-3" on one row and "Terrain 4" on
  the next, with every label intact; the shared outline is what still says it is one control.
  One line at every width from 640px up.

**Measuring "Terrain 4's arrival IS Terrain 2's camera" took three attempts, and the two
failures are worth more than the result.** The claim is about scale, and there is no handle on
the map from outside.

1. **DEM tile depth saturates.** A 62-degree pitched terrain view asks for z12 tiles in its near
   field whatever its centre is at, so the deepest z requested is 12 at either scale.
2. **The pixel gap between two route cards does not exist at region scale.** The two Changping
   legs start 9 km apart, which looked ideal — but their group's break zoom is ~10.1, so at
   region scale they are drawn as one area card and there is nothing to measure between.
3. **Where every card lands, relative to the frame.** Two views framing the same ground at the
   same scale put every card they share on the same pixel. That is sharper than any proxy, and
   it is the actual claim.

Read that way the answer is exact: the shared card sits at **x = 479** in Terrain 2, in Terrain
4 on arrival, and in Terrain 4 re-entered — and Terrain 4 drilled matches Terrain 1 at
**x = 434 and 587** for both of its cards.

**What it costs**, page-scoped except for 40 bytes:

| | before | after |
|---|---|---|
| eager page script | 3.00 | **3.29** KB gz |
| MapLibre engine chunk | 248.29 | **248.54** KB gz |
| `/about/travel-preview` CSS | 5.46 | **5.89** KB gz |
| site-wide CSS (`BaseLayout.css`, 25 pages) | 10.09 | **10.13** KB gz |

The 0.04 KB site-wide is `@apply` utilities the rail uses and nothing else does — the trade the
mock-up section records, taken again for the same reason: this section is going to be deleted.

**Verified in Chrome against the production build** — :4322, not the dev server — 74 checks,
all passing, plus a re-run of the 41 on the four-view work and the 77 on the mock-up with no
regression: five options reading Globe/Terrain 1-4 on one line with Globe checked; **all ten
pairs of the five views render distinct frames**; the rail shown in the three mesh views and in
neither flat one, on the right, inside the frame, at a fifth of the width; eight trip rows and
ten route rows with three nested under Chengdu, one under Phuket and six under Johor, and
exactly four routes claimed by a trip; drilling from a rail row staying in `All`, keeping the
view, marking exactly one row and storing the route; a trip row marking itself, un-marking every
route and leaving the stored route alone; a trip with no routes framing anyway; the camera
identities above; re-entering the view and a round trip out to `Trips` both returning to the
region; the disclosure shutting, hiding its list, keeping its own button, storing the choice and
coming back shut; dark, with the rail's ink following the theme; the retired `terrain` view id
still falling back to Globe; Trails untouched at eleven chips with no rail and no view switch;
and 390px with the rail starting shut, opening inside the frame at 44% of the width and 50% of
the height, clear of the filters panel, hit-testable and working. Console clean throughout.

**Known and left alone.** The same view frames **17-61px** differently in the VERTICAL depending
on how it was entered — `fitBounds` at a 62-degree pitch resolves a centre that depends on the
camera it starts from, and the very first fit of all is computed before the panels are
measurable at all. Horizontal position agrees to the pixel across all three entries, which is
what says this is the fit's starting point rather than its scale, and 61px of an 880px frame is
not a picture anyone would call different. It is pre-existing — Terrain 1 and 2 have always had
it — and it is why the camera checks above assert x and report y. Also: at 390px the opened rail
is 44% of the width, which is more than the 20% it takes on a desktop frame and is why it starts
shut there; and the rail sits over the top-right, where cards hang above their anchors, so a
card in that corner is reserved away rather than merged — there is nothing under a control for
it to be named on.

## The interaction mock-up (`/about/travel-preview`, 10 Sep 2026)

A **third** section on the preview page, and the only one that is not an earth. The author's
complaint about the MapLibre section was not about how it looks but about how it is driven —
*"only TRAILS and ALL is needed because ALL have included the trips information"* — so this is
three proposals for the navigation, drawn as chrome over four schematic SVGs.
`MapUxPreview.astro` plus `src/scripts/map-ux-preview.ts`. Throwaway like the rest of the route.

**The diagnosis, which is what the section argues.** Six of the seven faults below are the same
fault wearing different clothes: **the tab row describes an axis the data does not have.** There
is one map and four depths — the world, the routes, an area, a route.

1. **Two of the three tabs are the same map.** `All` with its Trails chip off *is* `Trips` — the
   row asks the reader to choose between a set and a subset, and what separates them is a chip
   inside one of the two. This is the redundancy the author spotted.
2. **Depth is spelled as a mode.** World → area → route is a zoom, driven by a control whose
   whole meaning is "switch to a different thing".
3. **The row and the map disagree about who is steering.** A route card moves the selected tab
   under the reader; a group card does not. Two identical-looking cards do two different things.
4. **The panel changes identity in place** — same corner, same styling, five independent toggles
   in one tab and an eleven-item single choice in another, with nothing marking the swap.
5. **The route picker is an index dressed as a filter** — eleven proper nouns in `fg-faint`,
   already recorded above as 2.31:1 in Classic.
6. **There is no way back.** From a route at z13 the exits are the tab row and a chip in a
   scrolling list. The map itself offers none, and the map is where the reader is looking.
7. **The readout exists in one tab out of three**, so two thirds of the time nothing says what is
   on screen or what was just clicked.

**The three proposals**, one at a time behind a switcher, over the same four schematics:

| | Navigation | Keeps |
|---|---|---|
| **Drill down** (recommended) | no tabs; a breadcrumb `Earth › Johor › Pulai`, and the map is the only control | removes a whole level — the world already shows the three route groups the Trails overview exists to show |
| **Map & index** | a permanent rail: trips newest first, each with the routes walked on it **nested underneath** | the only one that shows a relationship the site records nowhere |
| **Two views** | the author's own instinct tidied: drop `Trips`, keep `All` and `Trails`, make the switch two-state and give Terrain the breadcrumb | the one control that says "the routes, alone" |

**Three changes are worth making whichever model wins**, and they are cheap: the readout under
the frame at every depth, the layer chips behind a button instead of permanently over the map,
and a way back that lives on the map rather than beside it. Between them they answer four of the
seven faults without touching the tab row.

**The nesting in proposal 2 is a real fact the site knows nowhere.** Three walks fall inside the
Chengdu trip and one inside Phuket — visible by putting the dates side by side, and recorded in
no code: `visited.json` and `trails.json` are two flat lists that never mention each other, and
the only place it currently surfaces is a merged card that happens to name both. `WALKED_ON` in
the component is a hardcoded table **on purpose, as part of the argument**.

**That argument was taken up the same day.** `walkedOn()` in `src/lib/content.ts` now derives
the pairing from a route's date falling inside a trip's range, throws at build time if a route
ever falls inside two trips, and the `All` tab's index rail renders it. So the table here is a
mock-up of something that exists — leave it as it is while the section does, since the point it
illustrates is the navigation model rather than the data.

Things that look like shortcuts and are not:

- **It is a diagram, not a fourth map, and the schematics are deliberately abstract.** Three
  working earths to compare three navigation models would take a week and would put the
  rendering back in front of the question the section exists to ask. Nobody should be judging
  the coastline here.
- **The colours are derived exactly as `palette.ts` derives them** — sea 10%, land 20%, coast
  50% of the way from the frame's `band` ground toward `--color-fg`. So there is no dark block
  in the file and there must not be one: the ramp inverts on its own because the colour it walks
  toward is the light one in dark. Verified in Chrome, both themes.
- **`var()` DOES NOT WORK IN AN SVG PRESENTATION ATTRIBUTE**, and this cost a round. A
  presentation attribute is meant to behave as a CSS declaration, but `fill="var(--uxp-sea)"` is
  not substituted in Chrome: the value fails to parse and the shape falls back to the initial
  `fill`, which is **black**. It fails silently — clean build, `astro check` sees nothing, and
  the only symptom is a globe that renders as a black disc in *both* themes, which is the tell.
  Measured: `getComputedStyle(circle).fill` returned `rgb(0, 0, 0)` in light and dark alike.
  Every colour in all four schematics is a real CSS class instead.
- **The schematic and its cards share ONE aspect-locked box**, and which dimension binds it
  flips at 640px — width leads on a phone, height leads on a desktop. Get it the wrong way round
  and the SVG letterboxes inside a box that is no longer its own shape, at which point every
  card, positioned in percentages of the box, slides off the dot it names. It is the same
  problem MapLibre solves with `project()`.
- **Cards sit ON their anchor, not centred over it.** Centred, a card covers the very mark that
  says where the place is.
- **Four of the eight world cards are dropped below 640px.** A card is a fixed pixel width
  whatever the box is, so eight that sit clear on a 682px schematic are a pile on a 358px one —
  the same arithmetic the real engine answers with decluttering. The two merged cards are never
  dropped; they carry the most information per pixel and they are what the section argues about.
- **The breadcrumb separator is a `::before` on each crumb**, not a span between them. Which
  crumbs show depends on the proposal *and* the depth — `drill` never shows "All routes",
  because that level does not exist in it — and a separator that was its own element would
  survive its crumb being hidden and leave a stray chevron at the head of the trail.
- **Route lines are not drawn on the globe.** They were, as two-segment ticks, and at that scale
  they read as stray UI glyphs floating over the Pacific rather than as walks. The footprints
  say where the page has been; lines start at the area depth where they are long enough to be
  lines.

**`@apply` INSIDE A SCOPED ASTRO BLOCK STILL EMITS THE UTILITY INTO THE SHARED SHEET.** Worth
knowing for every component, not just this one: a utility nothing else on the site references
lands in `BaseLayout.css`, which is on all 25 pages, even though the rule using it is
page-scoped. Measured here — six utilities used by this file alone cost **0.21 KB gz
site-wide**; written out as plain CSS declarations they cost nothing. About eighteen cheaper
ones are still left as `@apply`, a deliberate trade, since converting all of them would make
this file stylistically unlike every other component in the repo for a section that is going to
be deleted. **For a permanent component, convert them** — and see the note below before writing
the class name down anywhere.

| | before | after |
|---|---|---|
| eager page script | 2.32 | **2.72** KB gz |
| `/about/travel-preview` CSS | 3.14 | **5.37** KB gz |
| site-wide CSS (`BaseLayout.css`, all 25 pages) | 9.94 | **10.08** KB gz |
| MapLibre and three.js engines | — | unchanged |

**Verified in Chrome against the production build** — :4322, not the dev server — 77 checks, all
passing: the section opens on Drill down at the world with eight cards, one schematic and one
readout; the box holds 4:3 at both widths; clicking a card descends and the breadcrumb grows,
with no chevron before the first crumb and `aria-current` on the last; a crumb flies home; the
Layers sheet opens, holds five chips and closes on Escape; the route sheet lists all ten and a
row navigates; the rail nests three routes under Chengdu and one under Phuket, marks the current
row, and never sits under the map; the twin's two-state switch collapses four depths correctly
and drops below the breadcrumb at depth; zero pairwise card overlaps at 1400px and at 390px; four
of eight cards kept at 390px, all clickable, none outside the frame; the rail becomes a bottom
sheet at 390px; 0 horizontal overflow at both widths; the schematic repaints between themes
(`oklab(0.89…)` → `oklab(0.28…)`); the MapLibre section above still reaches `ready` with its
three tabs on one line; console clean throughout.

**The Astro whitespace trap caught three more**, all in this file's prose and all invisible in
the source and in a passing build — "nowhere.Three", "andTrails", "changes.Risk". Note it bites
in **both** directions: a closing tag ending a line glues to the next line's text just as an
opening tag starting a line glues to the previous line's. They were found by reading the
*rendered* text, not the source, which is the only way to find them.

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
