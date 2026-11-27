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
`/about/travel/{seoul-busan,chengdu,tokyo,phuket,taiwan,bali,guangzhou-shenzhen,shanghai,bangkok}`, `/work`,
`/work/{ai-agent-bms,cloud-data-platform,bms-platform,alliance-bank,bank-negara,school-fyp,open-source}`,
`/404`, `/theme-preview`, `/about/travel-preview` — 26 pages. The last two are `noindex` and
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
nine trip files exist with real dates and empty day headings (eight from 20 Aug 2026, Seoul &
Busan from 25 Nov 2026), and filling them
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

**`public/globe/README.md` is not excluded either, and nothing says that was deliberate.** It is
prose the site never renders, and Tailwind scans it: on 24 Nov 2026 an edit to its text alone
moved the shared sheet 10,120 → 10,109 B gz between two otherwise identical builds. Add
`@source not "../../public/globe/README.md";` to `global.css` if that is not wanted.

Two consequences worth keeping in mind:

- **This file can now discuss class names freely.** That is what makes it possible to write
  "do not use this utility" down at all — before the exclusion, saying so shipped it.
- **A section like the one above that quotes a measured byte count for a utility is only true
  while the docs stay excluded.** If those `@source not` lines ever go, every class name in
  this file starts shipping again.

### `@apply` in a scoped block still ships site-wide

**A utility used only inside one component's scoped `<style>` is still emitted into the shared
stylesheet** — `BaseLayout.css`, on all 25 pages — because Tailwind scans the component's source
and finds the class name in the `@apply` line. The rule using it is page-scoped; the utility it
generates is not. Measured on the travel preview's interaction mock-up (10 Sep 2026): six
utilities used by that file alone cost **0.21 KB gz site-wide**, and written as plain CSS
declarations they cost nothing. Removing it and the three.js earth (24 Nov 2026) took the shared
sheet from 10.22 to 10.12 KB gz.

So **a value only one component uses is a plain declaration, not `@apply`.** Utilities the site
already uses elsewhere stay as `@apply`; they cost nothing. Keep comments in those files free of
utility names too — a comment is source text, and a comment alone has leaked a utility into the
shared sheet twice (see the showcase layout under "Content"). `cmp` the built `BaseLayout.*.css`
before and after a change to know for certain.

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
## The travel earth (`/about/travel-preview`)

**The MapLibre earth, twice, since 24 Nov 2026**: the original section (next) and, under it, the
same engine with a redesigned frontend (see "The showcase"). The preview page used to carry two
other sections, and both were removed at the author's call:

- a **three.js earth** in six stylised looks behind a switcher (23 Aug 2026). The MapLibre one was
  built beside it so the two could be judged in the same page, and MapLibre won on what it can do:
  routes draped on real terrain, place names, the route views;
- an **interaction mock-up** — three proposals for navigating the map, drawn as chrome over
  schematic SVGs (10 Sep 2026). Its argument had already been built (the index rail, a route click
  that stays in `All`), and what was left argued against a three-tab row that no longer existed.
  Its two lessons that apply everywhere now live under "Tailwind v4 gotcha" and "Styling".

Gone with them: `GlobeStage.astro`, `src/scripts/globe/{engine,index,looks}.ts`,
`MapUxPreview.astro`, `src/scripts/map-ux-preview.ts`, four data files (see
`public/globe/README.md`), and the `three` and `@types/three` packages. Git history has all of
it. **`src/scripts/globe/palette.ts` stayed where it is** because the MapLibre engine imports it;
it lost the four steps only three.js read (`border`, `graticule`, `dot`, `limb`) and the `city`
step nothing read.

Measured in one session, before and after, against the production build:

| | before | after |
|---|---|---|
| `/about/travel-preview` HTML | 22.00 | **15.07** KB gz |
| its CSS | 8.89 | **5.85** KB gz |
| its eager script | 4.20 | **3.38** KB gz |
| site-wide CSS (`BaseLayout.css`, 25 pages) | 10.22 | **10.12** KB gz |
| three.js engine, on scroll | 141.31 | — |
| `land-mask.webp` + `cities.json`, on scroll | 127 | — |
| MapLibre engine, on scroll | 253.43 | **254.42** KB gz |

The site-wide line is the mock-up's own `@apply` utilities leaving the shared sheet. The MapLibre
engine grew by a kilobyte only because `palette.ts`, which used to be a chunk shared by the two
engines, is now bundled into it — one request fewer, not new code. And `land.json` is now
MapLibre's own download, 257 KB gz, where the three.js earth used to pay for it; "Two land files"
in `public/globe/README.md` says how to drop it.

**The three.js earth did not draw the poles correctly**, which matters because "The MapLibre
earth" below weighed its own Antarctic wedge against that claim. Found in a review the day the
earth was removed: `land-mask.webp` had been rasterised from `land.json`'s antimeridian-wrapping
rings, so four of the six looks — dots, hex, vector and relief — carried a full-width line at
70.9°N with the Arctic fill inverted around it, and no land south of 84.5°S. Only its coastline
strokes were right. Nothing in `scripts/` generated that mask; `public/globe/README.md` says what
to rasterise if one is ever wanted again.

**`/about/travel-preview` is throwaway.** `noindex`, out of the sitemap, reachable only from a
small link in the `/about/travel` header. When the earth is ready: move `MapGlobeStage` onto the
real page, then delete this route and the link.

**The body of both pages is `TravelContent.astro`.** Extracted from `about/travel/index.astro`
so the preview renders the real page rather than a copy of it — two pages claiming to show "all
the travel information" from two sets of markup is a second source of truth that agrees at first
and stops later. The map goes in its `after-timeline` slot; a page that passes nothing renders
nothing there, so `/about/travel` is untouched by the preview's existence.

**Not an island, and it is not close.** The engine is a dynamic `import()` behind an
`IntersectionObserver` with `rootMargin: 600px`. That is the same deferral `client:visible`
gives, without 55.9 KB of React runtime to drive a canvas React never touches. Nothing loads
until the map is a screen away, so a visitor who reads the timeline and leaves pays nothing.

**`maplibre-gl` is in `vite.optimizeDeps.include`, and it has to be.** Same failure as the
carousel, same cause: a dep first reached from a lazy import is discovered mid-session, Vite
re-optimizes, the hash changes, and the in-flight import dies on `504 (Outdated Optimize Dep)`.
Observed on this page in `npm run dev` — with three.js first — not guessed. Production builds
never had it.

### The colour contract

**Nothing about the map's colour is chosen.** `src/scripts/globe/palette.ts` steps a fixed
*perceptual* distance in OKLab from whatever is painted behind the map toward `--color-fg`: sea
0.10, land 0.20, boundary 0.36, coastline 0.50. One table, nine themes, no per-theme values
anywhere — and in dark the ramp inverts on its own, because the colour it walks toward is now the
light one. Measured as the mean colour of an element screenshot, the Terrain view goes 200 → 54 →
200 across a light → dark → light round trip (24 Nov 2026).

The one colour not derived is the highlight: visited cities are `--color-accent` at full
strength, because they are the only thing on the map meant to be looked at first.

**It steps off the *ground*, not the page.** `groundColour()` walks up from the canvas until it
finds something painted. The stage sits in a `bg-band` panel, so the sea steps off the band; drop
the map onto a plain section and it steps off the page instead. Get this wrong and the sea
matches its own frame and the globe reads as a hole.

**A theme change is a handful of `setPaintProperty` calls.** `index.ts` watches `<html>` for
class changes with a `MutationObserver` — the site's theme controls only add and remove classes,
so neither side needs to know about the other. A draped terrain view needs one more step: the
`once('idle')` re-attach under "The route picker".

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

Data, provenance and the regeneration traps live in `public/globe/README.md`. The ids in
`visited.json` are trip ids and must track `src/content/trips/*.md` filenames.

**A trip to two cities far apart has two footprints** (25 Nov 2026). Seoul and Busan are 325 km
apart and share no built-up area, so `seoul-busan` carries Busan's outline under `more`, and
`regionPolygons` draws the pair as one MultiPolygon. Its `at` and `span` cover both outlines, so
the trip's card and the showcase's flight centre between the two cities, and `placeBounds` takes
in both when the index rail frames the trip. New entries come from `scripts/build-footprint.mjs`.

## The MapLibre earth (`/about/travel-preview`, 2 Sep 2026)

The page's one map since 24 Nov 2026. It was built as a **second** earth, directly under the
three.js one, so the two could be judged in the same page and the same theme rather than from
screenshots; "The travel earth" above records how that ended. `MapGlobeStage.astro` plus
`src/scripts/mapglobe/`.

It exists because the three.js relief look could not grow into a trail view, so the question was
never "is three.js good enough" but "what does the thing that *can* do both look like on this
page". **Three modes, one `Map` object** — two from 7 Sep 2026, when
four were cut to two, and a third added on 9 Sep; see "Two tabs, not four" and "The All tab"
below. **In switcher order, `All` first — and it is where the page opens** (14 Sep 2026; see
"All opens the section" below).

- **All** (`combined`) — both of the other two on one globe, each behind its own chip, over the
  same five layer filters, plus a five-position View switch. Added 9 Sep 2026 at the author's
  request; see "The All tab" below.
- **Trips** (`explore`) — the globe with a filter row. It starts at country boundaries and the
  177 country names alone, both local files, so entering it makes no third-party request at all;
  city names and dots, relief, named peaks and rivers and lakes are added a chip at a time, and
  each is fetched only when it is switched on. The eight footprints are on the map whatever the
  filter says. See "The explore mode" below.
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
against `MAP_MODES` and a miss lands on `DEFAULT_MODE`. Verified in Chrome with both dead ids in
`localStorage` — they landed on Trips when this was written and land on **All** since 14 Sep 2026,
which is the point of routing them through the constant rather than naming a mode here.

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
Trails is picked.

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
  not be clickable either. 7 of 8 show at 1400px.
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
- **The wheel is handed back at either zoom limit**, via `data-lenis-prevent`, because
  MapLibre's `preventDefault` stops the browser scrolling but not Lenis.
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
- **The city dot takes the *coastline's* colour, not a step of its own.** The palette's old
  `city` step sat 0.30 off the ground against land's 0.20 — a tenth of the ramp apart, and
  invisible the moment the hillshade started texturing the land under it. `palette.ts` also gained
  one step, `boundary` at 0.36: the existing `border` at 0.15 was *lighter* than land and read as a
  hairline scored into the surface, which was right for the three.js vector look and wrong for a
  boundary drawn over shaded relief. Both `city` and `border` left the palette with the three.js
  earth (24 Nov 2026).
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
the collision rule rather than of these layers.

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
| **All** (`combined`) | the globe | both, behind two chips; the same five layer chips |
| **Trips** (`explore`) | the globe | footprints, always; five layer chips |
| **Trails** (`terrain`) | pitched terrain | every route, then one; eleven route chips |

The row is in that order, and the page opens on the first of them, since 14 Sep 2026 — see
"All opens the section" below.

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
- **A route card in `All` used to hand over to Trails**; a group card zooms where it stands.
  Clicking a group still means "show me these", which the globe does without going anywhere.
  Clicking a route still means "show me this one" — but since 14 Sep 2026 it is answered inside
  `All`, by moving the View switch to Terrain rather than by changing tab. See "All opens the
  section" below for why, and for the desync it fixed on the view that was then Terrain 3.
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

**A caution for the next probe.** `.switch` was not unique on that page until 24 Nov 2026 — the
three.js earth above had its own look switcher with the same class, and a check for "the switcher
is on one line" that forgot to scope to `[data-mapglobe]` measured the OTHER one. It failed for
exactly that reason before it passed. The class is unique now, but scope probes to
`[data-mapglobe]` anyway: it is what keeps them true when the map moves onto `/about/travel`.

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

The fix is a third module holding just the constant — `mapglobe/modes.ts`, and `globe/looks.ts`
until the three.js earth went — imported by both sides. **Types are free** (erased before Rollup sees them), so `import type` from
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
is exactly where a line on a sphere wraps around the back. That was free while the three.js earth
fetched the same file; since it went (24 Nov 2026) it is a download of its own, 257 KB gz — see
"Two land files" in `public/globe/README.md` for how to drop it.

**What is NOT fixed, and cannot be from the data side.** Antarctica renders with a wedge missing
when you spin to the south pole, and it degenerates further as you zoom in there. This is
MapLibre's globe triangulation of a polygon that *encircles* the pole. Established, not assumed:
the same polygon fills correctly under `mercator`; the data was verified (no antimeridian jump
over 5.72°, `minLat -89.99`, 257 distinct vertices on the pole ring); and clamping the pole edge
to -89.99, to the Web Mercator limit -85.05, and to the true -90 all render identically.

**It was weighed against the three.js earth**, which was said to draw the poles correctly. That
held only for its coastline strokes — its filled looks had polar faults of their own, recorded
under "The travel earth" above. It is out of frame in the default Asia-centred view.
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

> **Merging is now the wide-view answer only.** From z10 up, two colliding cards are STACKED
> instead — see "Cards stack instead of merging, once you are close enough" below (16 Sep 2026).
> Everything in this section still describes what happens below that zoom, which is every globe
> view including the home view.

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

Built out of the interaction mock-up (removed 24 Nov 2026), at the author's request: they liked its two-state
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

> **Three of these four were cut on 14 Sep 2026** — see "Four terrain views cut to one" below.
> Only `survey` survives, labelled simply **Terrain**. Everything in this section is still the
> reasoning that produced it and the measurement behind its angle; the table below is history.

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
(One `terrainView()` since 14 Sep 2026, when one view was left to test for.)
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

**`GLOBE_TILT` is 40 degrees / bearing 0, separate from `TRAILS_VIEW`'s 62 / -22.** *(Deleted
14 Sep 2026 with the `tilted` view it belonged to; the measurement below is kept because it is
the answer if a hemisphere ever needs leaning again.)* Reusing the
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

> **Terrain 4 is now just "Terrain"** — the other three positions were cut on 14 Sep 2026 and it
> is the whole of the View switch's second position. Read "Terrain 4" throughout this section as
> "the Terrain view", and `MESH_VIEWS` as `TERRAIN_VIEW`. Everything else here still holds: the
> two scales, `drilled`, the rail, `walkedOn`, `PLACE_GROWTH` and the `framePadding` rule are all
> untouched.

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
*differently* from its neighbours is still decided per view. **It is a single `TERRAIN_VIEW`
constant in the same file since 14 Sep 2026** — a list of one says less than a constant — and the
reason it is still in modes.ts rather than in the engine is unchanged: two files need the answer.

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
surfaced was a merged card that happened to name both. The interaction mock-up (removed 24 Nov
2026) carried a
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
  with nothing to reach for. *(Moot since 14 Sep 2026: Terrain 3 is gone, and the one surviving
  terrain view is the one the rail belongs to.)*
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

The 0.04 KB site-wide is `@apply` utilities the rail uses and nothing else does — the trade
described under "`@apply` in a scoped block still ships site-wide", taken for a throwaway
section's sake: it is going to be deleted.

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

### All opens the section, and a route click stays in it (14 Sep 2026)

Two changes the author asked for together, and they pull the same way: **`All` is the first tab
and the one the page opens on**, and **a route clicked anywhere in `All` is answered inside `All`**
rather than by handing the reader to Trails.

**The order argument is the one the 7 Sep cut already made, run forwards.** `All` with its Trails
chip off *is* `Trips`, which is why `Trips` is the tab that can be absorbed and `All` is not — and
that same relationship says which one should lead the row. A reader who arrives on `All` can take
things off it; one who arrives on `Trips` has to know another tab exists before they can find out
what the page has. The row used to run cheapest-first, which is a real consideration and is now
the second one: `All` opens flat, on the same two local layer files `Trips` opens on, and adds ten
local route files — **11 KB gzipped** — between them. **Arriving still contacts no third party at
all**, verified, which is the property that made cheapest-first worth having. `Trails` stays last:
it reaches straight for DEM tiles and is the only mode that cannot preserve it.

**`DEFAULT_MODE` moved to modes.ts** with the other three defaults. It was a `const` in index.ts
while `MapGlobeStage.astro` shipped its own hardcoded `'explore'` for the tab that renders checked
— two copies of one answer, a file apart, with nothing to make them move together. Changing the
default is exactly the edit that would have caught one and missed the other.

**A route click in `All` never leaves `All`.** From a terrain view it re-aims, which is what it
already did. From a flat one it **moves the View switch onto terrain and drills onto the walk**.
That destination is the two-scale view with the index rail — Terrain 4 of four when this was
written, and simply **Terrain** since the cut later the same day — because the rail is the other
half of the answer: the objection that produced that view was that reaching another route meant
zooming out, and a route arrived at by clicking its card on a world map is exactly where that
bites. What the reader gets for the same click is the same walk on the same 3D mesh,
plus the tab, the trips, the layer chips and the index rail they already had — so the click costs
nothing to undo.

- **It drills, where the pill's own way in deliberately does not.** `loadTrail`'s third argument
  is what tells the two apart and it has said so since that view shipped: arriving in a view is
  not the reader choosing a walk, and a click on a route is. Measured, since the claim is about
  scale and there is no handle on the camera from outside — the shared card sits at **x = 1056**
  drilled and **x = 659** on re-entering the view, the same technique the view's camera
  identities were established with.
- **`setView` takes the route as a second argument** rather than the page setting the view and
  then aiming it. Two calls would fly to whatever route the view opens on and then fly again to
  the one that was clicked; one call is one camera movement. `openMeshView` checks that target
  before its three fallbacks, because it is the only one of the four the reader asked for in the
  same gesture.
- **Terrain 3 counted as flat here, and routing it through the same branch fixed a real bug.** It
  leaned the camera but attached no mesh, so a route card clicked there reached `loadTrail` with
  no terrain view to hold it, and the ENGINE switched itself to terrain mode while index.ts went
  on believing the tab was `All` — the panel, the switcher and the map describing two different
  things. Nothing had ever driven that path. That view was cut hours later, so the bug is now
  unreachable; the rule it established is the one to keep, because **any flat view routed
  anywhere but here has the same hole**.
- **`chooseView()` in index.ts is the one place the view moves**, shared by the pill and by `aim`.
  The pill's handler used to do the marking, the storing and the engine call inline, and `aim`
  needed all three.
- **The predicate in index.ts is named**, not an expression inside the marking function. Two
  things ask it, and it reads its view id from modes.ts, so it and the engine's own copy cannot
  disagree.

**What it costs**, page-scoped:

| | before | after |
|---|---|---|
| eager page script | 3.29 | **3.36** KB gz |
| MapLibre engine chunk | 248.54 | **248.58** KB gz |
| `/about/travel-preview` CSS | 5.89 | **5.89** KB gz — unchanged |
| site-wide CSS and JS | — | unchanged |

**Verified in Chrome against the production build** — :4322, not the dev server — 56 checks, all
passing: three tabs reading All/Trips/Trails in that order with All checked and `data-mode`
`combined` on arrival; the Globe view, both content chips, `countries` alone, the relief chip free,
no rail, no readout, the legend shown; **zero third-party hosts contacted on arrival** and no DEM
tile, with the ten route files fetched locally; opening the Johor group staying on the globe, then
a route card taking it to terrain — still `combined`, view stored as `survey`, the route stored,
the picker radio marked, the overview chip cleared, the rail visible, the relief chip pressed and
disabled with the stored filter set untouched; DEM tiles requested only at that point; out to
Trips and back restoring the terrain view at the region rather than drilled; the same click from
Terrain 3 landing there too, with the switcher and the map agreeing; a rail row still re-aiming
without
leaving; Trails untouched — overview, readout, chips, and a chip picking a route without leaving
the tab; a dead stored mode (`places`) falling back to All and a stored `explore` still opening
Trips; 390px with 0 horizontal overflow, the three tabs on one line and all three hit-testable.
Console clean throughout. The light↔dark round trip on the newly reachable view, measured as the
mean colour of an element screenshot: the flat arrival 233, the drilled terrain view
**190 → 55 → 190**.

**The Astro whitespace trap caught two more** in the rewritten intro — "Allputs" and "toTerrain"
— and they are worth recording because they are the two *different* directions of it: the first
was a CLOSING `</strong>` ending a line and gluing to the next line's text, the second an opening
`<strong>` starting a line and gluing to the previous line's. Found by reading the rendered text
out of `dist/`, which is the only way to find them.

### Four terrain views cut to one (14 Sep 2026)

The author's call, four days after the four shipped: **keep Terrain 4, drop the rest, and call it
Terrain.** `MAP_VIEWS` is `['globe', 'survey']`, the pill reads **Globe | Terrain**, and the four
predicates that existed to tell the four views apart are one.

**Nothing was lost that the survivor does not already do**, which is what makes it the right cut
and is the same argument that removed `places` and `atlas` from the tab row on 7 Sep:

| cut | was | where it went |
|---|---|---|
| Terrain 1 `route` | one route, tight, ~z11 | **is** Terrain drilled in — `trackFactor` returns 1 |
| Terrain 2 `region` | the route's mountain region, ~z8 | **is** Terrain on arrival — `REGION_GROWTH` |
| Terrain 3 `tilted` | the whole world leaned over, hillshade, no mesh | **gone**, and it is the one real loss |

**Terrain 3 is the only casualty, and it was the position the author rejected in the first
place.** The pill shipped on 10 Sep as `globe` + `tilted` and that pair drew the objection that
produced the other three — *"can see global but cannot show the terrain."* Two positions again is
therefore not a return to that: this Terrain has the mesh. What is genuinely gone is the tilted
whole-world picture, and that is forced rather than chosen — the mesh needs mercator, and at the
globe's 20 km per pixel a mountain is under half a pixel of relief, so a whole-world view can have
shading or terrain and never both. The globe keeps the shading, behind the Relief chip, which is
the half of `tilted` that was always reachable from somewhere else.

**`TERRAIN_VIEW` replaces `MESH_VIEWS`.** A list of one says less than a constant. It stays in
modes.ts for the reason the list was there: two files need the same answer, the engine for the
projection, the shading and every fit, and index.ts for the relief chip and the index rail.

**Four predicates became one.** `meshView()`, `tiltView()`, `surveyView()` and `leaning()` existed
because the interesting question was never which position the pill was in but which capability was
in play — is the camera leaning, is the mesh attached, is this the scale that draws the other
routes. With one terrain view those are the same question, and `terrainView()` is it. Three
conditions collapsed to constants as a result, and each is a small piece of behaviour worth
knowing:

- **`others = routes`** in `applyLayers`. The other nine routes are drawn in every globe view now,
  because the one view that hid them was Terrain 1/2 and the one that showed them survived.
- **`setHillshade(active.has('relief') ? 'globe' : null)`** on the flat globe, with no `tiltView()`
  branch in front of it.
- **`trackFactor`** is two lines: the terrain view's two scales, then terrain mode's.

**`GLOBE_TILT` was deleted**, and the four-candidate measurement behind its 40°/0 is left in the
section above, because it is the answer if a hemisphere ever needs leaning again.

**The `easeTo` at the foot of `setView` is now unreachable and is kept on purpose.** It is the
flat→flat transition — the reader's centre and zoom preserved while the camera leans — and with
one flat position left, `terrainView()` or `wasMesh` catches every real transition before it. It
costs a line, it is correct if a second flat view is ever added, and deleting it would leave
`setView` silently doing nothing in that case.

**`data-mesh-view` became `data-terrain-view`**, renamed with the predicate, in index.ts and in
the two CSS rules that gate the index rail.

**The pill's `flex-wrap` + `nowrap` rule is kept although two labels fit at every width.** It was
earned at five, where each label broke into "TERRAIN" over "4"; a label added here is one word
away from needing it again.

**What it costs**, page-scoped — and it is the first change in this section's history that gives
anything back, though barely:

| | before | after |
|---|---|---|
| eager page script | 3.36 | **3.34** KB gz |
| MapLibre engine chunk | 248.58 | **248.52** KB gz |
| `/about/travel-preview` CSS | 5.89 | **5.89** KB gz — unchanged |
| site-wide CSS and JS | — | unchanged |

**80 bytes**, which is worth saying plainly: removing three of four views is a simplification of
the code and not of the download. Comments do not ship, the three cut views were a handful of
branches rather than a subsystem, and the CSS did not move at all — the pill styles the options
it is given, and three fewer buttons is markup rather than rules. If a cut like this ever needs
to pay for itself in bytes, the thing to remove is data or a dependency.

**Verified in Chrome against the production build** — :4322, not the dev server — 57 + 13 checks,
all passing: the pill has two positions reading Globe / Terrain, with Globe checked on arrival and
no rail; all four retired view ids (`route`, `region`, `tilted`, and the older `terrain`) falling
back to the Globe; the pill entering Terrain, bringing the rail, implying and locking the Relief
chip, opening on the stored route with the other routes still drawn, and rendering a different
frame from the Globe (233 vs 197); a route card inside Terrain re-aiming without leaving it; the
pill returning to the Globe with the rail gone, the chip freed and the frame back to 233; a route
card on the flat globe still taking the reader to Terrain, drilled, with everything the 14 Sep
route-click work checks; Trails untouched; 390px with the pill on one line, both positions
hit-testable and 0 horizontal overflow. Console clean throughout. The light↔dark round trip on
Terrain, measured as the mean colour of an element screenshot: **200 → 56 → 200**.

**A returning reader who left in Terrain 2 comes back to the Globe**, because a stored id that is
no longer in `MAP_VIEWS` falls through to `DEFAULT_VIEW` — the same treatment the dead `places`
and `atlas` mode ids get. Mapping the three cut ids onto `survey` was considered and not done: one
more branch to carry for the life of a throwaway preview page, against one click on a pill.

### The single-route fit is capped (14–15 Sep 2026)

The author's note: *"The terrain for single trail view some of it is too near. Use lamasi-muluozi
range as default. for example the cape krathing is too near I cannot see the full route."* So
`fitTrack` and `showPlace` pass **`maxZoom: TRACK_MAX_ZOOM`**. The next day, on the first value:
*"now to far already, make the view between previous and now"* — so the cap is
`DEM_MAX_ZOOM + 1.5`, and **that took two tries is the useful part of this section.**

**The cause is that `fitBounds` frames what it is given, and the ten routes differ in extent by a
factor of six.** Lamasi–Muluozi spans 9.2 km corner to corner; Cape Krathing spans 1.5 km. Fitting
each to its own extent framed them across three and a half zoom levels — measured on a 1182×790
frame, uncapped:

| | extent | fit | line on screen |
|---|---|---|---|
| Lamasi–Muluozi | 9.2 km | z12.00 | 225px, 23% of the frame |
| Kulai | 7.3 km | z12.67 | 314px, 32% |
| Belumut | 4.6 km | z13.47 | 368px, 37% |
| Pulai | 3.6 km | z14.09 | 795px, 81% |
| Lambak | 1.7 km | z15.02 | 575px, 58% |
| Cape Krathing | 1.5 km | **z15.50** | 891px, 91% — and **clipped** |

**Two separate things go wrong at the bottom of that list.** The one the author saw is that the
route stops fitting: at z15.5 Cape Krathing spanned nearly the whole frame, so its far end slid
**under the index rail** and off the edge — measured, the line reached x=997 with the rail's edge
at x=986. `framePadding` was doing its job and `fitBounds` still overshot, because it computes the
frame top-down while this camera is pitched 62° over a terrain mesh: the ground actually shown is
a trapezoid, narrower at the near edge than the box that was fitted. The second is that there is
less and less *to* see — the DEM ends at z12, so past it MapLibre is overzooming the same tiles.

**The first value was `DEM_MAX_ZOOM` itself, and it over-corrected.** Capping at the data's own
depth is the principled answer — past it there is no more terrain, only a bigger version of the
same mesh — and it put every route at z12, which is the author's reference framing exactly. Two
things were wrong with the result, and only the first was visible in a screenshot:

- **A 3.8 km walk became a 77px mark**, 8% of the frame width.
- **It flattened the view's two scales for the two smallest routes.** Six times a 1.5 km extent
  already reaches z12, so arriving in the view and drilling into Cape Krathing were the same
  picture and the click did nothing. That was documented as an acceptable trade at the time; the
  looser cap makes it moot.

**A level and a half of deliberate overzoom answers both.** Measured across the candidates, as the
share of the frame's width the line spans, with every route fully visible in all four:

| cap | smallest | widest | routes capped | drill step | relief |
|---|---|---|---|---|---|
| z12 | 8% | 23% | 8 of 10 | 0.00–2.58 | native |
| z13 | 14% | 38% | 7 of 10 | 0.59–2.59 | soft |
| **z13.5** | **20%** | **53%** | **3 of 10** | **0.59–2.59** | still reads |
| z14 | 29% | 76% | 3 of 10 | 0.59–2.59 | visibly mushy |

So seven of the ten routes are framed by their own extent and only the three smallest are held
back; every route keeps a real drill step; and the spread of scales is a level and a half rather
than three and a half. Past z13.5 the gain is only in size — z14 is no more *visible*, and the DEM
is two levels overzoomed, which shows in the screenshots as soft, smeared hillsides.

**It is on the region fit as well as the drilled one**, which is not belt-and-braces: at z12 it was
what stopped the drill running *backwards*, since 6× a 1.5 km extent asks for z12.9 and capping
only the drilled frame would have had Cape Krathing arrive at z12.9 and zoom out to z12 when it
was picked. At z13.5 no region fit reaches the cap, so it binds on the drilled frame alone — leave
it on both, because that is the guard if the number is ever lowered again.

**The cap decides where the camera LANDS, not how close the reader may get.** Verified with real
wheel events: four notches take a capped frame from z12 to z12.72 with the page pinned
(`data-lenis-prevent` true, `scrollY` unmoved), and the map's own `maxZoom` is untouched at 22.

**Verified in Chrome against the production build**, plus a re-run of the 57 + 13 checks above:
every route's whole line inside the **usable** area — the frame minus every floating panel, which
is the test that matters, since the first version of this check used the bare frame rect and
called Cape Krathing contained while it was running under the rail. One regression check needed
updating rather than fixing: it compared a card's position between the region and drilled frames
and happened to use Cape Krathing, whose two scales coincided under the z12 cap; it names Belumut
instead, which is the right choice either way.

**Two measurement notes, both of which cost a cycle.** The zoom was read through a temporary
`window` handle on the map, added for the measurement and removed before committing — `map` is not
otherwise reachable from the page, and `map.transform` is private in v6, so there is no
terrain-aware projection available from outside either. And **scroll the FRAME into view, not the
section**: this section's heading and prose are taller than the viewport, so `scrollIntoView()` on
the section leaves the map below the fold, where `elementFromPoint` returns null and a real wheel
event goes to the page instead of the map. That is the same trap the 390px hit tests documented,
in a different disguise — it made the wheel look broken when it was not.

### Cards stack instead of merging, once you are close enough (16 Sep 2026)

The author, drilled into Lamasi–Muluozi: the other two Changping walks were reaching that view as
one card reading **"Muluozi – Lamasi & Muluozi – Wuguishi · 2 routes"** — *"when zoom until a
certain view move the tab to let them dont conflict."* So a card that collides with another now
tries to **stack clear of it** before being absorbed, and above z10 it usually can.

**Merging is not replaced, it is bounded.** Below the gate nothing changes: the home view still
draws "Chengdu & Changping Valley" and "Bangkok · Phuket · Cape Krathing", which is the 10 Sep
feature and is right at that scale. Above it a card keeps its own name and its own place.

**The gate is a zoom, and it has to be** — this is the part worth keeping, because a screen-distance
rule was the obvious first answer and it cannot work. Merging and stacking want opposite answers
at the two ends of the map, and not in the order a distance threshold can produce:

| | apart on screen | wanted |
|---|---|---|
| Bangkok and Phuket, home view z2.3 | 50px | **merge** (author's ask, 10 Sep) |
| the two Muluozi starts, drilled z12 | 14px | **stack** (author's ask, 16 Sep) |

The pair that must merge is *further* apart than the pair that must stack, so any single px
threshold gets one of them wrong. What separates the cases is scale: at collection scale a card
stands for a place, and two an hour apart are one story; at a single ridge two trailheads 370 m
apart are two walks and telling them apart is why the reader is there. `NUDGE_MIN_ZOOM` is 10,
about where the frame stops holding a country and starts holding one mountain region.

**`NUDGE_MIN_APART` is 9px, and that is the start dot's own diameter** — `trail-start` is radius
4.5 at z12 — so the second gate reads exactly "the two dots do not overlap". A stacked card still
points at its place by sitting over it, so if the two places are one mark on screen, two cards
pointing at it say less than one card naming both. Two routes starting in the same car park still
merge, at any zoom.

**That constant was wrong on its first build, and the reason is worth knowing.** It was set to 16
on the arithmetic that 370 m is 23px at z12 — which is true on a flat map and false in this frame,
where those two anchors sit in the far half of a 62° pitched view and measure **14px**. The gate
was shut in exactly the view it was written for, and the symptom was simply that nothing happened.
**Any pixel threshold here has to be checked against `map.project`, not against metres.**

Things that look like shortcuts and are not:

- **Vertical steps only, in multiples of the card's own box height.** These cards are wide and
  short, so a sideways step is most of a card width — 150px and up — which puts the name a long
  way from the thing it names. A step of one box height is under 40px and leaves the card still
  centred on its own anchor, so two cards 14px apart horizontally and a box height apart
  vertically each visibly sit over their own dot. The ladder is `[-1, 1, -2, 2]`, up first: cards
  hang above their anchors here, and in a pitched frame the space above a point is the far
  distance, which is the emptier half.
- **The step is the box height exactly**, so two stacked boxes touch and never overlap — `overlaps`
  is a strict test, so touching is free.
- **Each candidate is tested against everything already placed, controls included**, so a stacked
  card can no more land under the index rail than an unstacked one can. A card that collides with
  a *control* is still hidden outright and never stacked: there is nothing under the panel for it
  to be named on, and lifting it out from under one would drop it somewhere it does not belong.
- **`spot.box` is mutated on success**, because the final placement pass and the merged card's
  fallback-to-members both read that box and must see where the card actually is.
- **The offset is written to `translate`, not to `transform`.** MapLibre owns a marker's
  `transform` and rewrites it on every frame the camera moves, so anything written there is gone
  by the next render. `translate` is its own property, composes with the transform rather than
  replacing it, and MapLibre leaves it alone. `marker.setOffset()` is the library's own answer and
  is avoided for a narrower reason: this runs inside a `render` handler and that call reaches back
  into the map.
- **Written only on change**, tracked on the label as `ny`. `declutter` runs on every frame the map
  draws, and a style write per card per frame is a layout invalidation per card per frame.
- **Every card carries its offset back each frame, including the zero.** A card that was stacked
  last frame and wins its own space this frame has to come back down.
- **Area cards are untouched.** At the region scale the three Changping walks are one
  "Changping Valley · 3 routes" card — that is the cluster mechanism, which breaks open by zoom
  (`breakZoom`) and is a different thing from both merging and stacking.

**What it costs.** The MapLibre engine chunk went 248.52 → **248.71 KB gz**. The eager page script,
the page's CSS and everything site-wide are untouched — this is all inside the engine.

**Verified in Chrome against the production build**, 14 checks plus a re-run of the 57 + 13 above,
all passing: drilled into Lamasi–Muluozi, no merged card, both Muluozi routes carrying their own
card with exactly one of them stacked (`translate: 0 -42px`), the focused route's own card still
there, and **zero pairwise overlaps** among visible cards; the home view still merging both of its
groups with nothing stacked anywhere on the globe; the region arrival still showing one Changping
Valley area card; 390px with zero overlaps and no horizontal overflow. Console clean throughout.

### The selected route is the one the map points at (16 Sep 2026)

The author: *"my chengdu trails have 3 trails but in different day. So I wish when a single route
been select in the side menu or click by user. It will highlight the single route or dishighlight
the other route."* Both halves shipped — **the subject's card takes the accent, and the other
routes step off it** — and the two answer different parts of the same complaint.

**Nothing on the MAP said which route was selected.** The index rail has named the current route in
the accent since it shipped, and the readout names it under the frame in the Trails tab, but in
`All`'s Terrain view the three Changping legs drew three identical cards over three identical accent
lines. The 16 Sep stacking work had just stopped two of those cards being merged into one, which
made the question sharper rather than answering it: three cards, all the same, one of them yours.

| | before | now |
|---|---|---|
| the subject's card | `fg` name, `line-strong` border | **accent name, accent border** |
| the other routes' lines and start dots | `p.visited` — the accent | **`p.coast`** — the strongest neutral step |
| the subject's own track | accent, 3.2px, ground casing | unchanged |

**The card's mark is the same pair of properties a HOVER sets**, and that is the whole reason it is
those two: both mean "this card is the one", so a hover reads as a preview of picking rather than as
a competing signal, and the map's mark is in step with the rail's. A third treatment for a third
state is one more thing to learn about a map that already asks a lot.

**The accent is the right colour for it by the rule that has governed this earth from the start.**
It is the one colour here that is NOT derived — `palette.ts` steps every other mark a fixed
perceptual distance off the ground — and it is reserved for the thing meant to be looked at first.
A selected route is exactly that.

**The others step DOWN rather than the subject stepping up**, which is a choice and not a
convenience: the focused track is already the heaviest mark in the frame, at 3.2px over a 7px
ground casing, and making it heavier still would have cost the hillside it is drawn on — which is
the one thing in a terrain view the reader came for. It is also the direction the author asked for.

**`p.coast` at 0.50, and the STRONGEST neutral is the point.** An unselected route is not
decoration: it is how the reader reaches the other walks, and it is the whole reason Terrain draws
the other nine at all (see "Terrain 4, and the index rail"). Measured in the frame that matters — the
northern Changping leg focused, its neighbour running down the same valley — the neutral line and
its start dot read clearly as "another walk starts here and goes that way" in both themes, while
never competing with the accent. The rank is carried by **hue**, derived neutral against the one
underived accent, rather than by a fade: the same call the atlas label ladder makes, and for the
same reason. It is reused rather than given a step of its own on the precedent of the city dot,
which takes the coastline's colour for want of a strong enough one of its own.

Things that look like shortcuts and are not:

- **`paintTrails()` owns those two paint properties and `refreshTheme` goes through it.** It used to
  write `p.visited` into both directly, which would have repainted every de-emphasised route back to
  the accent on the next theme change — a bug that only appears if you flip the theme while a route
  is selected, which is exactly the kind of thing that ships. Verified in Chrome across a
  light → dark → light round trip with a route focused.
- **The card class is toggled in `retier()`, not set in `addTrailLabel`.** A card element outlives
  any one selection — the ten are built when the geometry lands — so the mark has to move every time
  `focused` does. `retier` already decides which cards are on the map and runs at the end of
  `applyLayers`, which is the one function every path that can change the subject passes through.
  `classList.toggle` with a second argument writes nothing when the answer has not changed, which
  matters because `retier` also runs on `moveend`.
- **NOTHING IS SINGLED OUT WITHOUT A SUBJECT.** The trails overview and a trip picked from the index
  rail both leave `focused` null, and there every route is the accent again, equally. An overview
  that quietened nine of ten routes would be claiming a selection the reader had not made. Both are
  verified, including that picking the Chengdu row un-marks the route that was marked.
- **Trails mode's single-route view is untouched**, and it needs nothing: `showsTrails()` returns
  `!focused` there, so the other nine are not drawn at all. The de-emphasis only has anything to do
  in `All`'s Terrain view, which is where the author hit it.

**What it costs**, page-scoped, and the site-wide row is the one worth checking:

| | before | after |
|---|---|---|
| MapLibre engine chunk | 247.89 | **247.94** KB gz |
| `/about/travel-preview` CSS | 5.93 | **5.95** KB gz |
| site-wide CSS (`BaseLayout.css`, 25 pages) | 10.10 | **10.10** — unchanged |
| eager page script, three.js engine | — | unchanged |

Site-wide CSS does not move because `border-accent` and `text-accent` were already used in this
component, so the two new rules emit no utility the shared sheet did not already carry — which is
the trap recorded under "Tailwind v4 gotcha", checked rather than assumed.

**Measure these two figures in ONE session, before and after, by swapping the files.** The absolute
chunk sizes are not comparable across sessions — the baseline measured 247.89 here against the
248.71 recorded a section above, on the same files — so a delta taken against a number written down
on another day is worthless. Build the index version, measure, restore, build, measure.

**Verified in Chrome against the production build** — 15 checks, plus a re-run of the 14 + 57 + 13
above with no regression: the other routes' line and start dots reading back a neutral rather than
the accent, with the focused route's card the only one carrying the modifier and its name resolving
to the accent; the light↔dark↔light round trip keeping both; the Trails overview drawing every route
in the accent and marking none; a trip row clearing the mark and restoring the accent; and 390px
with the de-emphasis intact and 0 horizontal overflow. Console clean throughout. Both themes
screenshotted at 2× on the frame where an unselected leg runs beside the selected one, which is the
only frame that shows whether "quieter" has become "gone".

### The route arrives before its ground does (16 Sep 2026) — diagnosed, NOT fixed

The author: *"When I want to view lamasi-muluozi from globe … it lead to terrrain view this is
correct. but the view is not correct. I cannot see the route correctly. For example if I at the
terrain view directly select the lamasi-muluozi is correct view."* And then, which is the fact that
cracked it: *"the route been block view is only happen like 1 second after that it will jump to the
correct view."*

**A FIT IS FLAT AND A ROUTE IS NOT.** `cameraForBounds` ignores the terrain exactly as it ignores
the pitch — measured, and it is the load-bearing fact here: re-running the identical fit with the
mesh attached returns the identical camera, z11.749 either way. So every camera in this engine is
framed on the route's extent at **sea level**, the line is then draped onto ground 3,400–3,700 m
up, and `attachTerrainWhenSettled` does not attach that ground until the camera has stopped.

**Either end of the load is fine; the half-loaded mesh is the only wrong picture.** Measured on
Lamasi–Muluozi in a 1182×702 frame, with `map.project`, which is terrain-aware and is therefore the
right instrument:

| mesh | line | route's start | in frame |
|---|---|---|---|
| none yet (flat) | 193×**227** | y 483 | 279/279 |
| fully draped | 189×**248** | y 523 | 279/279 |
| **half** — no tile over the first 2 km | 167×**444** | y **719** | **262/279** |

The frame is 702px tall, so in the third row the walk's first two kilometres are drawn *below the
bottom edge*. Sampling the mesh along the route says exactly why — those points are still at sea
level while the rest are at their real height:

```
            route start ->                              <- route end
real ground   4641  4643  4745  4747  4765  4785  4815  4866  4964
half-loaded      0     0  4745  4747  4765  4785  4815  4866  4964
```

**That is also why the two ways in behave differently.** From the globe the DEM over the
destination cannot be asked for until the camera is there, so the mesh fills in underneath a camera
that has already committed. From the index rail the reader is already in the view at the region
scale — six times the route's extent, over the same valley — so the elevation is in hand before the
fit runs and there is no window at all.

**It is a race, so it is latency-shaped, which is why it did not reproduce.** Measured by delaying
`tiles.mapterhorn.com` and polling at 50ms, as the width of the window in which any part of the
route is outside the frame:

| tile latency | window | trials affected |
|---|---|---|
| warm cache | 50–85ms | 3 of 4 |
| 800ms | 95–195ms | 4 of 5 |
| 1500ms | 586–694ms | 3 of 3 |
| 3000ms | ~2s | 3 of 3 |

An earlier session eliminated the starting camera, Relief, `framePadding`, the `flyTo` arc, a
6-second DEM delay and `cameraForBounds`' pitch sensitivity, and concluded the defect was not
reproducible — because every one of those probes measured the **settled** camera, which is
identical on both paths. The transient was the whole of it.

**Three fixes were tried and all three are worse than the bug. Do not re-attempt them without
reading what each measured.**

1. **Attach the terrain at the start of the fly** instead of at `moveend`, giving the DEM the
   two seconds of the flight. It closes the window completely — 0 off-frame samples in 7 runs,
   including at 2.5s per tile — and it **moves the camera**: with terrain already on, the landing
   altitude includes the ground's own 5,400 m, and the same route settles at y 38..213 with a
   **175px** span, pushed up into the frame's top padding, against the y 275..523 and 248px the
   author called correct. The re-base only happens if the attach lands while the camera is
   *moving*; a fit issued with the terrain already on and the camera still is correct.
2. **Wait for the map to be quiet before attaching** — `moveend`, then `map.loaded()` or
   `idle`, capped. It cannot work, and the reason generalises: the `dem` source requests no tiles
   at all until `setTerrain` is called, so no amount of waiting beforehand pre-loads the mesh. It
   moved the window later and shrank it at high latency (640 → 140ms at 1500ms per tile) and never
   closed it.
3. **Prime the mesh over the group view before flying** — mercator plus `setTerrain` at the
   stationary camera the reader clicked from, wait, then fit. This is the one with the right idea:
   a point reads sea level only when **no** tile covers it at **any** zoom, because MapLibre falls
   back to a resident parent, so one coarse tile over the valley kills every hole. It closes the
   window on a warm cache (0 off-frame in 3 runs, settled span 242px). It is still rejected,
   because the wait cannot be made both short and sufficient: waiting for `map.loaded()` or for
   `isSourceLoaded('dem')` blows any tolerable cap at 800ms per tile, and waiting for merely the
   first tile lets the fit run on an incomplete mesh, which re-bases the camera — one run in three
   settled at the **175px** framing of fix 1. **A permanent mis-framing is worse than a
   sub-second transient**, and that is the whole argument for leaving this alone.

**What would actually fix it** is not a wait but arithmetic: compute the fit in terrain-aware space
instead of handing bounds to `fitBounds` — frame the route's extent *at its own altitude* — which
is a camera of this engine's own rather than MapLibre's. That is a real piece of work on a page
that is going to be deleted, and it would move framing the author has already tuned twice (14 and
15 Sep), so it waits on this earth winning the comparison.

**Two notes on the instruments, both of which cost time.** Playwright's `ctx.route` handler delays
*every* matching request including ones the browser would serve from its own cache, which destroys
the tile sharing between `dem` and `dem-hillshade` that fix 3 depends on — so it understates that
fix and cannot be used to size it. And **element screenshots are useless for a transient**: each
one costs 100–300ms, so a 27-frame film of a 2-second fly began after the fly had finished. Poll
`map.project` on an interval and screenshot only the states worth looking at.

**And `npm run preview` is a daemon in Astro 7.** It reports *"Preview server already running at
http://localhost:4321"* and refuses a second one, which is why `--port 4322` silently did nothing
and only 4321 answered. It serves `dist/` from disk, so a rebuild is picked up without restarting
it; `astro preview stop` is how to move it.

### Five views of one route, behind a button in the corner (16 Sep 2026)

The author: *"Since my all trails route is a gpx file can it show something when the route is been
selected? … Create 5 best view you think and a filter button on top left corner so that I can swap
between that 5 view."* So a card in the top-left of the frame, a menu on it, and five ways of
reading the walk that is on the map.

**What the GPX files actually hold, measured rather than assumed.** All ten are Strava exports
carrying `lat`, `lon`, `ele`, `time` and `gpxtpx:hr` on **every** fix, one every 1–3 seconds, and
the three runs add `power`. No cadence, no temperature, no waypoints, no laps, and no device name —
`creator="StravaGPX"` is all the header says. Everything below is derived from those five columns.

| View | Shows | Reads |
|---|---|---|
| **Summary** | distance, climb **and descent**, elevation range, the shape, start and finish clock, elapsed vs moving, pace | the manifest alone |
| **Profile** | height against distance, high point marked, cursor | the profile file |
| **Splits** | each kilometre: pace as a bar, metres up and down | the profile file |
| **Colour** | the route on the map coloured by height, with a legend | the profile file |
| **Effort** | heart rate against distance, mean marked; power on the runs | the profile file |

**The manifest gained seven fields and they are all free**, in the sense that the build script was
already reading every byte they come from: `descent`, `start`, `end`, `elapsed`, `moving` and
`shape`. The two that are worth more than they look are `moving` and `start` — Belumut is 8 h 19 min
elapsed against **2 h 53 min moving**, and two of the half marathons started at 03:02, which is a
fact about the walk that no distance can carry.

**`shape` is derived from the geometry, not declared.** The second half of the track is hashed into
a grid of 40 m cells and asked how much of it lands on the first half: over 60% is an out-and-back,
otherwise ends within 250 m are a loop and anything else is point to point. It gets all ten right,
and it matters because the map already draws a filled dot and a ring at the ends — this is the word
that goes with them. Belumut and Pulai both read "out and back" where a naive ends-are-close test
called one a loop and the other point to point.

#### The profile is a third file, and that is the whole design

`public/globe/trails/<id>.profile.json`, beside the line the map draws. **The line is simplified by
shape and the profile is sampled by distance, and neither can stand in for the other.**
Douglas–Peucker at 4 m keeps 445 of Belumut's 27,533 fixes, and it keeps them where the path
*turns* — so the top of a climb that lies on a straight stretch is dropped, and a chart drawn off
the line would miss the summit. The profile resamples the FULL recording every 25–100 m, chosen per
route so each lands at 150–450 samples, with position, elevation and clock interpolated and the
heart rate taken from the nearer fix.

- **The recording's true top and bottom are pinned into the nearest sample.** Interpolating every
  50 m missed Belumut's summit by a metre, and the card then read "1,016 m" beside a Summary saying
  "1,017 m" — two figures from one recording, disagreeing on screen. Only the elevation is
  overwritten; the position and clock stay the sample's own, which is within half a step.
- **It is fetched per route, on first use, and cached** — `loadProfile` keeps the promise exactly as
  the engine keeps a route's geometry. 1.7–4.3 KB gzipped each. Summary needs none at all, which is
  why it is the default view: arriving on a route costs nothing new.
- **Every printed figure still comes off the full recording.** That was already the contract for
  distance and ascent; the splits and the durations join it. Nothing the page prints is measured
  from anything the page draws.

#### Things that look like shortcuts and are not

- **`detail.ts` is reached through a dynamic import and NONE of its values is imported statically.**
  This is the INEFFECTIVE_DYNAMIC_IMPORT rule that already cost this page 138 KB once, in the other
  direction — and it bit again here. As a static import the five views, their charts and their
  formatting put the eager page script at **7.22 KB gz**, which every visitor to the route downloads
  whether or not they scroll as far as the map. Deferred it is 4.02. Nothing is lost by waiting: the
  card cannot appear until a route is drawn as a single track, which cannot happen until the 248 KB
  engine has loaded and flown somewhere, and this chunk is 3.61 KB asked for at the same moment.
- **The card follows the DRAWN TRACK, not the remembered route.** `onSubject` fires from
  `applyLayers`, which is the one function every path that can change the subject already ends in —
  `loadTrail`, `showPlace`, `showOverview`, `setView`, `setContent`, `setLayers`. So the card is
  shown exactly when `TRACK_LAYERS` are, and a reader back on the flat globe sees no card about a
  walk that is not on the map, although `mapglobe-trail` still remembers it. A getter could not have
  done this: the engine picks a route of its own in `openTerrainView` when the reader arrives with
  none, and the page has no way to know.
- **A seventh storage key, `mapglobe-info`, and it outlives the route.** Same reasoning as the other
  six. A reader who prefers the elevation profile gets the profile of every route they pick, because
  "which view" is a way of looking rather than a thing looked at.
- **The chart cursor and the map probe are one gesture.** Hovering the chart moves a dot along the
  route on the ground, through `setProbe` — its own source and its own layer, in `TRACK_LAYERS` so
  it can never show without the route it sits on. It takes the page's ink inside a ground-coloured
  ring: a third mark, neither the accent start dot nor the ground-filled end ring, and the
  strongest thing on the line because it is the one the reader is moving.
- **The splits rows drive the probe too**, from the end of each kilometre. Samples are evenly spaced
  by distance, so the index is the distance divided by the step — no search, on a `pointerenter`.
- **The chart is keyboard-operable and inline SVG, not a library.** Arrow keys step, Shift steps ten,
  Home/End jump, Escape clears. Two series against distance with a cursor is a hundred lines; a
  charting dependency on a page that already ships two map engines would be one more thing to defer.
- **`var()` works in these charts because every colour is a CSS class**, never a presentation
  attribute — the trap recorded under "Styling", which renders a black shape in both themes and
  passes every build.
- **The Colour view paints the line through `line-gradient`, which needs `lineMetrics: true` on the
  track source.** MapLibre only computes the along-line progress a gradient keys on when the source
  asks for it. The ramp runs accent → `--color-fg`, so the lowest ground on the route looks exactly
  as a route looks and everything above steps toward the text colour — "more ink is higher" in both
  themes, with no dark block anywhere.
- **The series is kept on the engine so `refreshTheme` can re-derive it.** The colours inside a
  `line-gradient` expression are literals, so a theme change would otherwise leave a route painted
  in the old theme's ink. Verified across a light→dark→light round trip with the Colour view up.
- **The legend's ramp is the same two tokens as the line's**, in a CSS `linear-gradient`, so the key
  and the thing it describes cannot disagree in any of the nine themes.
- **Only the LAST split can be labelled as a partial.** A pause in the recording jumps the distance
  past a kilometre boundary, so an earlier split can also come up short — it is still the ninth
  kilometre, and labelling it "9.0" reads as a bug. And a zero carries no direction, so the climb
  column prints "+13 / 0" rather than "+13 / −0".
- **The menu is the theme picker's grammar**, for the third time on this site: `aria-haspopup`,
  `aria-expanded`, `menuitemradio` items, Escape with focus returned, outside-click and focus-out
  dismissal, all delegated. The button is also the current view's NAME, so the reader can see which
  view is up without opening it.
- **The card is top-left, where the filters panel used to be before it moved to the bottom.** That
  move was because cards hang above their anchors and the top of the frame is the busy half — which
  is handled here rather than avoided: `framePadding` already clears the whole strip above a wide,
  short reserved box, and `declutter` already reserves anything carrying `data-mapglobe-reserve`.
  Both follow this card as they followed the panel. The index rail is top-RIGHT, so the two share an
  edge and never a corner: measured, the card ends at x=425 and the rail starts at x=1095.
- **At 390px the card is full width and drops a row while the rail is up.** The rail's toggle is
  top-right and the card is now the frame's whole width, so without that they share the header line
  and the rail's button sits over the card's chevron. Trails mode has no rail, so the card keeps the
  corner there.

**Heart rate is the author's own physiological data, and shipping it is a decision rather than an
oversight.** It is on every fix in all ten recordings and the Effort view draws it. Dropping that
one view from `MAP_INFO` and its entry in `INFO_COPY` is the whole edit needed to stop shipping it;
the build script would still need its `hr`/`power` lines removed to stop writing it.

**What it costs**, page-scoped, measured before and after **in one session by swapping the files** —
the absolute chunk figures are not comparable across sessions, so a delta against a number written
down on another day is worthless:

| | before | after |
|---|---|---|
| eager page script | 3.41 | **4.02** KB gz |
| detail views, on the first card shown | — | **3.61** KB gz |
| MapLibre engine chunk | 247.94 | **248.21** KB gz |
| `/about/travel-preview` CSS | 5.95 | **7.10** KB gz |
| site-wide CSS (`BaseLayout.css`, 25 pages) | 10.10 | **10.10** — unchanged |
| three.js engine | 138.57 | 138.57 — unchanged |
| one route's profile, on first use | — | 1.7–4.3 KB gz |

Site-wide CSS does not move because the card's styles are written as plain declarations wherever
the utility was not already used in this file — the `@apply`-emits-into-the-shared-sheet trap
recorded under "Tailwind v4 gotcha", checked rather than assumed.

**Verified in Chrome against the production build** — driven with `playwright-core` against the
installed Chrome, since Playwright's own browsers are not installed on this machine — 54 checks,
all passing: arriving on `All` with no card and no profile fetched; the Terrain view showing the
card with eight facts read off the manifest and still fetching nothing; the card top-left inside the
frame and clear of the rail; the menu's five `menuitemradio` items with exactly one checked, Escape
returning focus, outside-click dismissing; each of the four profile views drawing, and the profile
file fetched **exactly once** across all four; the cursor line written on hover and restored on
leave; arrow keys moving it; the splits bars proportional with the longest at 100%; the legend ramp
reading back as accent→fg and changing with the theme; the choice stored; a rail row changing the
subject while keeping the view and fetching that route's profile once; a trip row and the Globe view
each hiding the card and Terrain restoring it; the Trails overview hiding it and a picked route
showing it; and 390px with the card inside the frame at 46% of its height, below the rail toggle,
clear of the filters panel, hit-testable, its menu inside the frame, and 0 horizontal overflow.
Console clean throughout, both themes screenshotted.

**Known and left alone.** The Colour view's ramp is derived from the route's own elevation range, so
a 3.8 km coastal walk and a 3,400 m valley use the same ink for very different heights — the legend
is what says so, and a shared scale across ten routes would make eight of them one flat colour. And
`PROFILE_STEPS` tops out at 100 m, so a route much longer than a half marathon would sample past
450 points; nothing here is close.

### Six layout tabs, because too much floats over the earth (16–17 Sep 2026)

The author, on the `All` tab: *"For me too much information in the 3d earth frame. But I still want
those information. You try to improve the uiux by modified the layout and size of those
information. Do not directly do at all Tab. Create 5 new tab after all tab (all-1, all-2,
all-3, ……) for different view to let me review."*

So `all-1` … `all-6` sit between `All` and `Trips`. Each draws **exactly** what `All` draws, from
the same state, and differs only in where the chrome sits and how big it is. `All` itself is
untouched, which is the point of the exercise: the six are there to be compared against it.

**The right measure is CLEAR MAP — the stage's area less whatever is drawn on top of it** — and
finding that is most of the value here. "How big is the frame" flatters `All`, which keeps the
whole frame and then covers a quarter of it; "how much is covered" flatters the carved layouts,
which cover nothing and are smaller. Only the product answers the author's actual complaint, which
was that they cannot see the earth.

At 1920×1080, Terrain view, a route up:

| tab | | stage | covered | clear map | vs `All` |
|---|---|---|---|---|---|
| `All` | as it is | 1182×894 | 22% | 824,232 | — |
| `all-1` | **Sidebar** — one column right | 1294×894 | 0 | 1,156,836 | **+40%** |
| `all-2` | **Dock** — a strip under the map | 1598×654 | 0 | 1,045,092 | +27% |
| `all-3` | **Stack** — one floating column, bottom left | 1182×894 | 19% | 855,933 | +4% |
| `all-4` | **Flush** — the same corners, minimum weight | 1182×894 | 19% | 855,933 | +4% |
| `all-5` | **Columns** — controls left, index right | 1174×894 | 0 | 1,049,556 | +27% |
| `all-6` | **Wide** — controls outside the map card | 1407×896 | 0 | 1,260,672 | **+53%** |

**Every one of them beats `All`, which was not obvious before it was measured** — a layout that
gives a fifth of the frame away still shows more earth than one that keeps all of it and puts
three panels on it.

The same table at 1400×900, where the window is the constraint rather than the caps, is much
tighter: `all-1` +17%, the rest between +3% and +5%. **The layouts are a wide-screen answer.** At
1400 the choice between them is very nearly a wash and should be made on how they read, not on the
numbers.

**A globe is round, which is the argument for the column layouts.** The corners of a wide frame
hold nothing at the home view — the sphere is inscribed in the frame's height — so `all-1`, `all-5`
and `all-6` give away pixels that were empty anyway. That stops being true the moment the reader
zooms into a ridge, where the map is a full-bleed rectangle and every pixel is ground.

#### How it is built, and why the engine grew by nothing

**The five are mode ids, and the engine never sees one.** `baseMode()` in modes.ts maps `all-*` to
`combined`, and that is the whole mechanism. The section carries both: `data-mode` is the base, so
every existing rule gating a panel on `[data-mode='combined']` covers all six tabs for free, and
`data-layout` carries the variant for the rules that move things. `applyMode`, `applyLayers`,
`terrainView` and every `current === …` test in engine.ts are untouched, and there is no sixth
branch anywhere to keep in step.

**Two mechanisms, and which one a layout uses IS the proposal it is making.**

- **Carve** (`all-1`, `all-2`, `all-5`, `all-6`): the frame becomes a grid, the stage stops being
  `inset-0` and takes a cell, and the panels take the others. The map is smaller and nothing is
  over it.
- **Float** (`all-3`, `all-4`): as `All` does, but arranged differently — one corner instead of
  three, or the same three at minimum weight.

#### The frame did not have to stay 74rem wide (17 Sep 2026)

The author's follow-up: *"Can the filter not mandatory in the earth frame can it be left and right?
or make the frame larger?"* Both, and the second is the one that pays.

**There were already 160 unused pixels either side of the frame at 1400px, and 659 at 1920.** The
frame is `min(96vw, 74rem)`, so above a ~1233px window the rem cap binds and the rest of the screen
is margin. A layout that carves a column out of the map should be allowed to take that back, so
`all-1`, `all-2` and `all-5` now use `min(96vw, 100rem)` and `all-6` uses `min(96vw, 120rem)`.
`All`, `Trips`, `Trails`, `all-3` and `all-4` keep the standard frame — the last two deliberately,
because they are the proposals that do NOT carve, and widening them as well would leave nothing to
compare a carved layout against.

**ONLY THE WIDTH CHANGES, and the height is left alone for two reasons that are not caution.** The
site header is sticky, so a frame taller than the viewport less the header slides under the nav
when it is scrolled to; and the tab row sits above the frame, so a frame that fills what is left
pushes the ROW under the nav — which on this page is the control being used to compare the layouts.
90vh and 92vh were both tried and did exactly that, measured as `frameTop < navBottom`. At the
standard height every layout reports `frameTop` 92 against a `navBottom` of 65, the same as `All`.

**96vw stays 96vw.** The gutter is what keeps a scrollbar from overflowing the page, and that
reasoning does not change because the rem cap went up. Verified at 1280, 1400, 1920 and 2560: 0
horizontal overflow at every one.

**`all-6` is the "left and right" question answered literally.** The map becomes a card and the
controls stand outside it: the frame gives up its own border, background and clipping, and the
STAGE takes them instead, so the bordered box on screen is the map and nothing else. **The panels
are still children of the frame in the DOM and did not need to move** — what makes a control read
as "inside the frame" is the border drawn around all of them together, and that border is now drawn
around the map alone. On a 1920px screen `all-6`'s map is 1407px wide, which is wider than `All`'s
entire frame.

**The tab row follows the frame it belongs to.** A widened frame would otherwise leave the row
floating short of it, aligned to a different edge, which reads as a mistake rather than as a wider
map. The legend and the note below the frame deliberately do NOT follow — they are prose, and prose
does not want to be 1,843px wide.

**MapLibre resizes itself, so carving needs no engine call.** v6 keeps a `ResizeObserver` on its
container (throttled 50ms) — verified rather than assumed, by reading the bundle and then by
measuring: the canvas comes back 878, 1182 and 758 px wide against stage widths of 878, 1182 and
758.

**`reserved()` now skips a box that does not overlap the map**, which is the one engine change and
is a strict improvement. It used to reserve everything inside the frame, which was the same thing
while every control floated over the stage. A control beside the map must cost the camera no
padding and can hide no card, because there is no card under it. Identical behaviour for the three
original tabs, where every box is over the stage — confirmed by the 54 checks on those tabs passing
unchanged.

**Switching between two layout tabs must not move the camera**, and `applyMode` would have: the
engine is only told when the BASE changed, so `all-1` → `all-3` is a CSS change and nothing else.
Verified by projecting a card across the switch — it holds its ground to within the difference in
stage width.

#### Things that look like shortcuts and are not

- **Every layout sets `position` and `inset` explicitly** rather than relying on what it inherits.
  The base rule each is overriding is `absolute` with two edges pinned, and a layout that set only
  `grid-column` would be a grid item still pinned to a corner.
- **The carved panels drop their border, wash and blur.** Those exist to separate a floating box
  from the map under it; off the map there is nothing to separate from, and the hairline becomes a
  box drawn around a thing that is not a box. The column's own edge does that job once.
- **The sidebar's ground is a pseudo-element**, because there is no wrapper to paint — and it is
  `position: absolute`, so it is not a grid item and takes no cell.
- **`all-2`'s chart takes a HEIGHT and derives its width**, which is the opposite of everywhere
  else and is forced by how SVG scales. With `width: 100%` and `height: auto` it is a flex item
  that can be *shrunk* vertically, and a shrunk SVG does not crop — it letterboxes. The chart came
  out half size and centred in a column of white space. Given a definite height and `width: auto`
  the viewBox ratio supplies the width instead.
- **And `all-2`'s card wraps.** The chart takes a fixed width off its own ratio and the heading
  takes one too, so on a narrow dock there can be nothing left — a `flex: 1` readout collapsed to
  zero and vanished. It wraps to a second line, which a 15rem strip has room for.
- **`all-2`'s index goes into two CSS columns**, with a group forbidden from breaking across them
  so a trip is never split from the walks nested under it. A dock is the opposite shape from a
  19-row index, and this is the layout that fights its content hardest.
- **`all-4` keeps the legends.** Dropping them was tried first, on the reasoning that five chips
  reading COUNTRIES, CITIES, RELIEF, PEAKS, RIVERS & LAKES do not need a word saying "Layers" —
  and it made the panel three unlabelled rows in which `Show` and `Layers` are the same kind of
  chip drawn the same way. The brief was to keep the information; that row of words is information.
- **At 390px all six fall back to the floating layout `All` uses.** A phone frame has no column to
  give away and no dock to spare, so the layouts are a desktop question and on a phone they are all
  the same answer. Reviewing them at 390px is not the point; not breaking them there is.
- **The tab row takes the frame's breakout.** Nine tabs wrapped to two lines at the reading
  column's width. It now lines up with the frame's left edge, the same breakout
  `.mapglobe__foot`, `.mapglobe__legend` and `.mapglobe__note` already take. **This is the one
  thing the three original tabs also see** — and it is the tab ROW rather than anything inside the
  map, so `All` draws exactly what it drew.

#### Known, and part of what is being reviewed

- **`all-1`, `all-5` and `all-6` have empty columns on the flat globe.** There is no index rail and
  no route card outside the Terrain view, so the column holds the filter chips and then stops.
  `all-5` and `all-6` show it twice. Collapsing the column when it empties would resize the map on
  every view change, which is worse; this is the honest cost of reserving space for something that
  is not always there.
- **At 1400px `all-6` is the weakest of the carved layouts, at +3%.** Its two columns cost 436px of
  a 1344px window, and the 120rem cap it exists for does not bind until about 1800px. It is built
  for a wide screen and says so.
- **`all-3`'s column runs most of the frame's height** with all three boxes up. It is one place to
  look rather than three, which is the proposal — but it is not less ink.
- **`all-2`'s index scrolls** even in two columns. 19 rows do not fit a 15rem strip.

**What it costs**, page-scoped, measured before and after in one session:

| | before | after |
|---|---|---|
| eager page script | 4.02 | **4.11** KB gz |
| MapLibre engine chunk | 248.21 | **248.24** KB gz |
| `/about/travel-preview` CSS | 7.10 | **8.81** KB gz |
| site-wide CSS (`BaseLayout.css`, 25 pages) | 10.10 | **10.10** — unchanged |

The 1.7 KB of CSS is six complete layouts and is the whole cost of the exercise; five of them are
deleted when one wins. Site-wide CSS does not move because every rule is written as plain
declarations rather than `@apply` — the trap recorded under "Tailwind v4 gotcha".

**Verified in Chrome against the production build**, 42 checks on the layout tabs plus a re-run of
the 54 on `All`, `Trips` and `Trails` with no regression: nine tabs in the right order with one
checked and `All` carrying no `data-layout`; the row on one line at 1400px and aligned to the left
edge of whichever frame its tab uses, at 1280, 1400, 1920 and 2560; switching layout tabs
not flying the camera; each layout reporting `data-mode=combined` with its own `data-layout`, all
three panels inside the frame, the canvas matching the stage to the pixel, and the view switch and
rail intact; a layer chip, the detail menu and an index row all still working from inside a carved
layout; a layout tab surviving a reload; leaving for Trails and back; every frame clearing the
sticky header; 0 horizontal overflow at four screen widths; and 390px falling back to the floating
layout with all nine tabs hit-testable. Console clean throughout, both views screenshotted for all
seven tabs at 1400 and 1920.

**The `.switch` trap caught me, exactly as the note below it says it would.** A check for "the tab
row is on one line" reported two rows for a row that was on one — it had measured the three.js
earth's own look switcher, which shares the class and has six options over two rows. Scope every
selector on this page to `[data-mapglobe]`.

## The showcase — the MapLibre earth, redesigned (`/about/travel-preview`, 24 Nov 2026)

The author asked for the MapLibre section to be duplicated under itself and its frontend redesigned
as "an impressive version", with proper research at the design stage. The duplicate is
`MapShowcase.astro`, `src/scripts/mapglobe/showcase.ts` (the eager bootstrap, an
IntersectionObserver and nothing else) and `showcase-app.ts` (the app, imported on approach). Same
engine, same data, same colour contract; the original section above is untouched apart from one
guard, recorded below. Both are on the page so they can be compared.

### The research, and what it decided

Gathered by a research subagent from primary sources: Strava, AllTrails and Komoot help pages, the
MapLibre docs, Apple's HIG (maps, sheets, materials), the WCAG 2.2 understanding docs, WAI-ARIA
APG, and the Stripe, GitHub and Mapbox engineering write-ups. What it decided, decision by decision:

- **One map, no tabs.** World, then a place, then a trail, entered from the map or the timeline,
  with a breadcrumb (`Earth › Chengdu › Lamasi – Muluozi`) as the way back. Layers behind one
  button. Tabs that only show subsets of the same data were the first anti-pattern it named.
- **A headline instead of an essay.** One sentence, three figures, two buttons. The figures were
  replaced by a photo wall on 25 Nov 2026 — see "A photo wall, and no dates or counts" below.
- **Solid panels for text, glass only for small controls** (Apple HIG materials, NN/g on
  glassmorphism). Text never floats on hillshade. The desktop panel docks to the right; a phone
  gets a bottom sheet with peek, half and full, and the map stays usable behind all three.
- **Replay only when asked, with real controls.** Pause, speed (1×, 2×, 4×), scrub (on the HUD's
  bar and on the elevation profile), Re-centre, and any gesture on the map pauses it — the union of
  Strava's, AllTrails' and Komoot's flyovers. An eased follow camera, never one locked to raw GPS
  points (Mapbox's cinematic route write-up). The line draws on with a `step` on `line-progress`;
  MapLibre has no `line-trim-offset`.
- **Flights:** MapLibre's default curve of 1.42, which is what van Wijk's 2003 study found people
  preferred, about 2.4 s each, and NOT `essential`, so MapLibre's own reduced-motion handling
  turns them into cuts.
- **A first frame before any map:** a theme-coloured sphere that the live globe crossfades over,
  after GitHub's globe.
- **The timeline as the keyboard route:** one tab stop, arrows along it (APG); aria-live
  announcements; the panel focuses its heading and Escape hands focus back.
- **Proportional digits for large still figures, equal-width digits for numbers that change** —
  only the flyover's readouts use `tabular-nums`.
- **Reduced motion:** no flyover at all, so the trail stays framed and fully drawn, and the tour
  waits for Next instead of advancing (WCAG 2.2.2, 2.3.3).

### What is on the stage

- **Panel on the left** of the map on a desktop and above it on a phone, with one face per view and
  no title. Each face has one handwritten line: right above the photo on the Globe, at the top on
  the Terrain. On the Globe: the trips' photos one at a time, taking turns, with previous, pause
  and next at the end of the bar under the photo, then the country and the place's name. On the
  Terrain: a tile per route drawn as
  its outline, in a row per kind (climbs, hikes, runs) under its sign. Pointing at a tile or the photo lights the place's card on the map, and
  pointing at a trip's card brings its photo up. See "One photo at a time, and no title" below.
  (Until 25 Nov 2026: an eyebrow, "Eight trips. Ten trails.", three counted-up figures and *Play the
  journey* / *Fly a trail in 3D*; then a two-line slogan per face; then the titles "Trips" and
  "Trails" over the same line; then, briefly, a sheet with no words at all; then, for a day, a
  collage that filled the column.)
- **Controls**, one glass pill: a Globe | Terrain radiogroup (arrows move between them), one
  popover button (on the Globe the layers: trips, trails, the five layers; on the Terrain the
  trails filter: climbs, hikes, runs), Home, Full screen. A column down the right edge on a phone,
  so the breadcrumb gets the frame's width.
- **Chronology**, the author's own and out of sight until a mouse reaches the foot of the map:
  every trip as an accent dot and every trail that belongs to no trip as a triangle (hike) or a
  diamond (run). Shape, not colour, tells them apart. Years sit above the axis, trips on it and
  trails below it, so nothing overprints at any width. A readout beside it names whatever is under
  the pointer. Its play button starts the tour.
- **Panel:** a trip has its summary, the trails walked there and a link to its page. A trail has
  four figures, an elevation profile whose cursor moves the probe on the map, *Fly this trail in
  3D*, and *Part of <trip>* where there is one.
- **Tour:** the trips oldest first, one `flyToTrip` each (zoom 4.2, pitch 40, the bearing turning
  ±14° step to step), with a caption (country, place, summary), a dwell bar, and previous /
  pause / next / end. *End* leaves the reader at that trip with its panel open.
- **Flyover:** a HUD with live distance, elevation and the recording's own local clock. The path
  still ahead is painted on the casing as a faint accent.

### The engine grew; the original section uses none of it

`tripCards: 'button'` builds trip cards as buttons with `data-mapglobe-trip`, so a click can open a
panel instead of leaving the page. `reserveRoot` sets where the reserved controls are looked for.
The new methods are `flyToTrip`, `home(animate, zoom, padding)`, `clearPadding`, `revealTrack`,
`camera`, `jumpTo`, `easeTo`, `settled`, `hasTerrain` and `setQuiet`. All are additive, and the
original section never calls them. `showAllTrails` gained an optional `animate` (25 Nov 2026),
which the original section never passes.

Things that look wrong and are not:

- **On a globe, `offset` turns the earth; only `padding` moves the sphere.** Measured: a home
  camera with an offset put 99.1°E at the centre instead of 110°E and left the sphere exactly
  where it was. So the home view uses PADDING — the headline's width plus 24px — to centre the
  globe in the space to its right, and the placeholder sphere is laid out by the same rule in
  CSS. Padding persists on the camera, and MapLibre's `fitBounds` frames inside it as well as
  inside its own padding, so it is cleared before every engine fit. `flyToTrip` animates it to
  zero as it flies, and every way into Terrain calls `clearPadding` first (`unpad()` in the app).
  `offset` is still right for a trip beside the open panel, because there the earth should turn.
- **The original section's click handler now ignores clicks outside its own section.** Both maps
  build route cards with `data-mapglobe-trail`, and without that one guard a click on a showcase
  card re-aimed the original map. It is the only change to the original section.
- **Elements built in script need `:global`**, scoped under `.xp`: the breadcrumb, the panel's
  buttons and their icons. Astro's scope attribute is only ever on the file's own markup. The first
  build rendered the breadcrumb as bare stacked text and the Fly button as a 120px play triangle.
- **`.xp [hidden] { display: none !important }`.** Any element here that sets `display` beats the
  attribute's UA rule — the trap recorded for the index rail, settled once for the section.
- **No `@apply` anywhere in MapShowcase.astro.** Every rule is a plain declaration on the tokens,
  and the shared `BaseLayout.*.css` was byte-identical (`cmp`) across every build of this work.

### Relief is on when the showcase opens (24 Nov 2026)

The author asked for Relief on by default in this section. The Relief switch in the layers popover
ships `checked`, and the app reads its starting layers and content off the switches
(`LAYER_ORDER` and `CONTENT_ORDER` in showcase-app.ts), so the markup is the only place a default
is written. The original section is untouched: its Relief chip still starts off.

- **This section now contacts a third party on arrival, on purpose.** The hillshade reads
  Mapterhorn's DEM tiles as soon as the map starts. The map starts about a screen before the
  section scrolls into view, so the top of the page still contacts nobody. Measured: 11 requests
  and 783 KB on a 1440px desktop, 5 and 411 KB at 390px. The original section alone still
  contacts nobody, verified with the showcase's script blocked. With Mapterhorn blocked, the land
  is drawn flat and nothing else breaks.
- **The credit has to stay readable**, now from the first view. Below 52rem the bottom-right
  credit was covered by the sheet at half and full height, by the tour caption and by the
  flyover's readout. There it now sits top-left, under the breadcrumb. Its "i" button is drawn
  from the tokens: MapLibre's own is a black disc, invisible in the dark theme, and once the map
  has been dragged that disc is all that is left of the credit. Checked with `elementFromPoint`
  on the credit: uncovered at home, peek, half, full and during the tour.
- The switch and the map agree: a screenshot's texture (standard deviation) reads 7.8 with the
  switch on and 2.58 with it off, unchanged after toggling and after a reload.

### Why the flyover takes every label off the map (24 Nov 2026)

Found while measuring the relief default, and nothing to do with relief. The flyover moves the
camera with one `jumpTo` per frame, and every `jumpTo` fires `moveend`. MapLibre answers each
`moveend` by testing every HTML marker against the terrain with `terrain.depthAtPoint`, which is a
`gl.readPixels`. With 18 labels on the map that was **67 GPU readbacks per frame**, each one a
stall, and the engine's own `retier` ran on every one of those `moveend`s too.

`setQuiet(true)` takes every label off the map for the flight and makes `retier` and `declutter`
return at once. `setQuiet(false)` on the way out puts them back. Nothing is lost: the flyover
follows one line at z13, and no card is there to read. Measured on a real GPU (Intel Arc, mains
power): **12.5 → 42.5 fps, 0 readbacks**.

Two more attempts measured as nothing, so neither shipped. Do not retry them without a better
instrument:

- redrawing the line's reveal only every 30 m and the profile's playhead in 400 steps;
- capping the probe's source at `maxzoom: 12`, so its per-frame `setData` rebuilds fewer tiles.

Three traps in measuring this:

- **SwiftShader makes relief look expensive. On a GPU it is free**: the home view ran at 56 fps
  with relief on and off. Launch Chrome with
  `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist --headless=new`.
- **On battery, every case read exactly 30.3 fps**, while a blank page ran at 55. Uncap with
  `--disable-frame-rate-limit --disable-gpu-vsync` and read the main-thread task time per frame
  from CDP's `Performance.getMetrics`.
- **Repeat every case in the same session.** Identical runs on battery ranged from 81 to 119 fps.
  The single run that first made the `maxzoom` cap look like a fifth faster was one of those.

### A photo wall, and no dates or counts (25 Nov 2026)

> **Its title went the same day, a tile never shows a footprint any more, and the photos are smaller
> now** — see "One photo at a time, and no title" below. The reasons here still hold.

The author's request: *"I just want to show the trip and image in a glance no need to mention when
and how many place I have been. No recruiter and interviewer care about this. I just want to show I
like to travel at a glance with the earth view."* With it: fold the timeline away until it is
hovered, drop the counts from the headline, keep something there, and drop the "Field atlas" eyebrow
and its years.

**The headline is a photo wall, and nothing else.** A title, one line ("Pick a trip to fly there,
or spin the globe."), then a tile per trip, newest first — three across since the panel was
reworked the same day, see "The panel titles" below. A tile is a button that selects its trip,
which the existing `[data-xp-trip]` click handler already did.

*Play the journey* and *Fly a trail in 3D* came off the panel the same day, at the author's call:
*"a bit stupid to show, no one will see."* The tour now starts only from the timeline's play
button, and the flyover from each trail's own panel. The `[data-xp-fly-best]` handler and the
reduced-motion `[data-xp-motion]` rule went with them.

- **A tile is the trip's own `cover`**, the field the travel timeline draws, so a photo is added
  once (`src/assets/travel/<id>/` plus `cover` and `coverAlt` in the trip's frontmatter; see the
  README there) and appears in both places. No trip has one yet, so every tile shows the trip's
  footprint instead; a trip with no footprint would show the travel timeline's hatched "photo to
  come".
- **A test photo on Bangkok proved the image branch**: a 200w/400w webp pair at `sizes="6rem"`
  (`7rem` since the wall went three across),
  cropped to the square, the name on top, and the same photo in the timeline above. The photo and
  the trip file were then restored, byte for byte against a copy.
- **The photo's alt is empty.** It is decoration inside a button its visible name already labels;
  `coverAlt` stays the photo's description where the photo is the content.
- **The name sits on a fade of `--color-surface`**, so it reads over a photo and over the ruling
  alike, and flips with the theme.

**No dates and no counts where a glance lands.** Only the timeline, opened on purpose, says when.

| | before | now |
|---|---|---|
| headline | eyebrow "Field atlas · 2023–2026", "Eight trips. Ten trails.", three figures | title, one line, photos |
| card on the globe | "Tokyo 2026", "Johor 6 routes", "2 trips · 3 routes" | the name alone |
| tour caption | "01 / 08", the place, country and dates | country, place, summary |
| trip panel | country and year, dates and length of stay, "3 trails walked here" | country, place, "Trails walked here" |
| trail panel | the date and the shape | the shape |

- **The card's second line is hidden in this section's CSS**, `.mapglobe__label-when` set to
  `display: none`, not removed in the engine: the original section above still shows it.
  `display: none` also takes it out of the card's accessible name.
- **A merged card can still read "Bangkok +2" at 390px.** That is the width budget naming what
  else is in the card, not a tally of trips, and it is left alone.
- **A screen reader still hears "1 of 8" in the tour.** On screen nothing counts the trips, but
  the position is how a listener knows where a slideshow has got to (APG carousel).
- **The trail panel keeps its four figures and the timeline keeps its years.** Distance and climb
  describe a walk rather than count places, and the timeline is the "when" view by definition.

**The timeline is the author's own, and nothing on the page says it is there.** *"I want to
remain this for me only so show only when hover to bottom is ok. user no need to know about the
timeline."* It shipped for a few hours with a "Timeline" tab at the foot of the map; the tab is
gone. A mouse within 24px of the frame's bottom edge slides it up, it stays while the mouse is on
it, and it folds 280ms after the mouse leaves. `data-chrono` on the section carries the state.

- **The reveal is decided in script from the pointer**, a `pointermove` on the stage, not by an
  invisible strip in CSS. A strip would sit over the foot of the map catching the clicks and
  drags meant for it, and over the map's credit in the corner. Checked: with the timeline folded,
  `elementFromPoint` at the foot returns the map canvas and at the credit returns the credit.
- **Mouse only, idle only, never mid-drag.** `pointerType` must be `mouse`, no button may be held
  (a drag that ends at the foot leaves it folded) and no tour or flight may be running.
- **It slides up flush with the frame's bottom edge, under the pointer**, which is why there is no
  gap below it. A pointer resting at the foot ends up over the arriving timeline, so it holds. With
  a gap the pointer would be left on the map and it would fold again.
- **Folded, it is `visibility: hidden` as well as out of frame**, so its marks take no focus and
  are out of the accessibility tree. The visibility change waits for the slide, so the drawer is
  seen to close.
- **The keyboard and touch never reach it, by the author's intent.** They lose nothing: every trip
  and every trail is a tile in the panel and a card on the map. The tour is the one thing only the
  timeline starts.
- **On a phone it is not there at all** (`display: none` below 52rem).
- **It is no longer `data-mapglobe-reserve`.** It is a passing overlay now, and a reservation would
  keep cards off the foot of the globe for a bar that is not there.
- **It is `display: none` during a tour or a flyover.** Both have their own panel along the foot,
  and that is what let the caption and the HUD drop from `bottom: 7rem` to `1.5rem`.
- **The credit sits in the corner and rides up with the timeline**, through `[data-chrono='open']`,
  desktop only.

### Two views, two subjects (25 Nov 2026)

The author, the same day: *"this only make sense when at globe tab if in terrain this not make
sense the left handside should become the terrain already. and dont jump to a specific trail when
switch to terrain, I want a global view when switch to terrain and the earth only show the trails
and left panel change to the trails instead of trips."*

| | Globe | Terrain |
|---|---|---|
| engine mode | `combined`, flat | `terrain` — what the original section's Trails tab uses |
| on the earth | the trips, and the trails | the trails, and nothing else |
| on arrival | the whole globe | every route at once, grouped by area, pitched, with relief |
| the panel | one line, and a photo per trip | one line, and an outline per route, in a row per kind |
| Home | the whole globe | all the trails the filter shows |
| layers button | the Globe's layers | the trails filter — see the next section |

- **It used to be `combined`'s own Terrain view**, which needs a route to stand on. So it opened
  on one the reader never picked: the stored route, or the first. Terrain MODE opens on its
  overview, and `showAllTrails()` is the way into it from the globe.
- **A trail is only ever open on the terrain.** Picked anywhere — its tile, a card on the map, a
  trip's trail row, the timeline — it lands in terrain mode with that route drawn. `loadTrail`
  does that from the globe by itself. The breadcrumb reads "All trails › area › trail".
- **A trip is only ever open on the globe.** A trail's "Part of <trip>" button, or a trip on the
  timeline, switches back first.
- **The view switches before the panel is built**, in `selectTrail`. Built first, a trail picked
  from a trip on the globe was crumbed "Earth › …": a bug found by the desktop suite.
- **The outlines are drawn at build time** in MapShowcase.astro. Each is read off the same
  geometry file the map fetches, with longitude scaled by the cosine of the latitude so a walk is
  not stretched east to west. It is fitted to a 100-unit square and thinned with
  Ramer–Douglas–Peucker, and nothing is fetched for it at runtime. An outline keeps to the top
  half of its tile: a name runs to two lines, and measured on every tile at 1440 and 390 the
  closest name sits 4.9px below its line. (The triangle and diamond each tile first carried
  were replaced by a sign per kind; see the next section.)
- **The panel has two faces in the markup, swapped by CSS** off `data-view`. With no script the
  globe's face shows.
- **`showAllTrails()` gained an optional `animate`**, so the overview is a cut under reduced motion
  like every other flight here. The original section never passes it.

Verified in Chrome against the production build, all passing: 28 checks for this round, and the
two earlier suites updated for it at 18 of 18 and 17 of 17. The 28 cover:

- the panel's lack of buttons and of a tab;
- the foot of the map staying the map;
- the timeline waking at the foot, holding, folding, and ignoring a drag;
- Terrain arriving with nothing picked and no trip cards, its panel of ten outlines, the layers
  button hidden, and Home meaning all trails;
- a tile flying down to its trail;
- Home returning to the overview;
- the flyover from a trail panel;
- "Part of Phuket" back to the globe;
- a trip's trail row drilling straight in;
- the tour from the timeline's play button;
- reduced motion;
- the phone.

The original section is unchanged, Trails tab included: 12 of 13, with the same Colour-view
threshold failure on the same pixel counts. The shared stylesheet is byte-identical and every link
resolves.

### The Terrain filter, and a sign for each kind of walk (25 Nov 2026)

The author: *"why terrain dont have the filter function and I want to clarify climb hike and run
with more clear sign."* The layers button had been hidden on the terrain, because none of the
Globe's switches reach terrain mode; nothing had replaced it.

**Three kinds where the manifest has two.** `trails.json` knows `hike` and `run`. A hike that gains
**400 m or more is a climb** (`CLIMB_ASCENT_M` in MapShowcase.astro). The routes split cleanly on
it:

| kind | trails | ascent |
|---|---|---|
| Climbs | Belumut, Pulai, Lambak | 529–1,127 m |
| Hikes | the three Changping Valley legs, Cape Krathing | 94–316 m |
| Runs | Iskandar City, Kulai, Dato Onn | — |

The split is decided once in the frontmatter and handed on: to the app as `trailKinds` in the
payload, and through the app to the engine. The original section and the manifest still know two
kinds. Change the threshold, or the rule, in that one place.

**A sign per kind**: a summit flag on a peak for a climb, a walker with a pole for a hike, a runner
for a run. Each is drawn once, as 16-unit strokes, in `KIND_ICON`.

- **They are painted as CSS masks filled with their kind's colour** (see the next section), from
  custom properties the frontmatter writes on the section (`--xp-icon-climb` and the rest, each a
  data-URI SVG). One mechanism draws all of them: the filter's switches, the panel's row headings,
  the trail panel's eyebrow, a trip's trail rows, the timeline's trail marks and the route cards
  on the map. The trail panel and the trip rows are built in script and the cards by the engine,
  so no inline SVG in this file could reach them. Under forced colours they paint in `CanvasText`,
  because forced colours repaint backgrounds and a mask is painted with one.
- **The engine took a `trailKind` option** and writes its answer on each route card as
  `data-mapglobe-kind`. It defaults to the manifest's `hike` / `run`, so the original section's
  cards now carry the attribute too, and nothing there styles it. An area card stands for several
  kinds and carries no sign.
- **The trail panel's eyebrow leads with the sign**: "Climb · Johor, Malaysia", and a half
  marathon by name ("Half marathon · Johor, Malaysia"), as before.
- **The panel's outlines sit in a row per kind**, each under its sign and its name.

**The filter is the layers button again, as "Filter trails"**, and its popover shows Climbs, Hikes
and Runs with their signs where the Globe's switches would be. CSS swaps the two sets off
`data-view`.

- **It filters the map and the panel together.** The panel hides the row of a kind that is off.
  The engine gained `setTrailFilter(ids)`, which re-lays out the overview from the routes already
  fetched: lines, start dots, cards, the areas they group into, and the extent Home frames. Hiding
  the runs therefore re-groups Johor rather than leaving its card standing for routes that are not
  drawn. `buildOverview` was split into the fetch and `layoutOverview()` for this. Nothing outside
  the `labels` registry holds a route or area card, so dropping them from it is the whole teardown.
- **The engine never moves the camera for a filter; the page decides.** In the showcase, with no
  trail open, a switch the reader moved re-frames the overview to what is shown, so "Climbs only"
  closes in on Johor and turning the rest back on brings the whole collection back. With a trail
  open, the camera stays on it. This was found by the suite: without the re-frame, coming back to
  Terrain on climbs alone framed Johor, and switching everything back on left Changping Valley and
  Cape Krathing on the map but out of frame.
- **The filter belongs to the terrain.** Leaving for the globe hands the engine every route back,
  because the globe is about trips and shows all trails, and the Globe popover has no kind
  switches to explain a gap. Coming back re-applies the filter.
- **The last kind left on is locked**, so the filter cannot empty the map: an empty map reads as
  broken, not as a choice.

**The popover's key hint no longer names the timeline.** It read "← → move along the timeline ·
Esc stops a tour or a flight", which told every visitor about the author's hidden timeline. It now
reads "Esc closes a panel or stops a flyover".

Verified in Chrome against the production build: 24 new checks, all passing, plus every earlier
suite updated for the button's return (28 of 28, 18 of 18, 17 of 17). The original section is
unchanged at 12 of 13, with the same Colour-view threshold failure. The 24 checks cover:

- the button's two labels and two sets of switches;
- every sign drawing its picture, in the filter, the panel and on a map card;
- the panel's three rows holding the right trails;
- Runs off removing its row and leaving only climbs on the cards when zoomed into Johor;
- the last switch locking;
- the valley and the coast leaving the map;
- the globe showing every trail whatever the filter, with the filter holding on the way back;
- all three back on returning every area;
- the eyebrows for a climb and a half marathon, and a trip's trail rows carrying their signs;
- 390px.

The shared stylesheet is byte-identical, and every link resolves.

### A colour for each kind of walk (25 Nov 2026)

The author, on the signs: *"Maybe use different color also?"* So each kind wears a colour beside
its sign, never instead of it. The shape still tells them apart, and that is why the colours could
be chosen for contrast and harmony rather than for colour-blind separation alone.

| kind | light (all eight light themes) | dark |
|---|---|---|
| Climbs | `#ad390a` burnt orange | `#fb923c` |
| Hikes | `#166534` forest green | `#4ade80` |
| Runs | `#7e22ce` purple | `#c084fc` |

**Measured against every theme, not eyeballed**, and the first try failed. The tokens were read
off each theme and the map's land and sea derived the way `palette.ts` derives them: the stage's
ground stepped 0.20 and 0.10 toward `--color-fg` in OKLab. The lighter orange and green first
picked (`#c2410c`, `#15803d`) cleared 4.5:1 on a panel but fell to 2.5:1 on the land of every
light theme, under the 3:1 a mark needs; the shades shipped clear 3:1 on the land and 4.5:1 on a
panel in all eight. The dark set's worst figure is 4.15:1, on the land.

**One accent collision is accepted.** In three themes a kind sits near the accent: climbs near
Sepia's rust and Clay's brick, hikes near Sage's deep green (ΔE 3–5). In the terrain view the
accent marks only the selected route, and a selected route's neighbours are not drawn, so the two
never meet on screen.

- **They live under the engine's name, `--mapglobe-kind-<kind>`**, on `.xp`, with the dark set on
  `:root.dark .xp`. The engine reads them in `kindPaint()`, a `match` on the `kind` property that
  `layoutOverview` now writes on every line and start dot. `paintTrails` goes through it, and
  `refreshTheme` goes through `paintTrails`, so a live theme switch repaints the lines in the dark
  shades; verified by counting pixels before and after. A page that sets no `--mapglobe-kind-*`
  keeps the accent, which is the original section, unchanged to the pixel.
- **Anything carrying a kind takes `--xp-kind-colour`**, set by the same rules that set the
  sign's drawing: a sign, a trail's tile (outline, start dot and hover border), a filter switch's
  track when on, a route card's sign, and the timeline's trail marks. Those marks were grey
  triangles and diamonds and are now the signs, so the hidden timeline marks Belumut, Pulai and
  Lambak as climbs too.
- **The selected route keeps the accent.** Its card is drawn on the accent, so its sign takes the
  card's text colour there; a kind colour on the accent would fight it. Its drawn track is the
  accent as before.
- **They are scoped to the showcase**, like the WhatsApp palette on the agent page, and not added
  to the site's tokens. The shared stylesheet is byte-identical.

**Counting a map's pixels needs its overlays hidden.** An element screenshot of the map captures
whatever floats over it, and the panel's green hike outlines were counted as hike pixels on a map
with no hikes in frame. The check hides the panel, the controls, the breadcrumb, the timeline and
the sheet for the one screenshot.

Verified in Chrome against the production build: 17 checks, all passing, plus every earlier suite
re-run (24, 28, 18 and 17, all passing). They cover:

- each kind's colour in the panel heading, the filter's sign and switch, the tile's outline and
  start dot, and the timeline, in light and in dark;
- every route card's sign;
- Johor's lines drawn in the climb and run colours with no hike pixels (107 and 210 pixels light,
  96 and 137 dark);
- a live switch to dark repainting both the lines and the signs.

The original section is unchanged at 12 of 13, with the same pixel counts. Every link resolves.

### The panel titles, and a drawing in every tile (25 Nov 2026)

> **The titles came off later the same day, and so did the footprint drawings** — see "One photo
> at a time, and no title" below. The line under each title stayed, and so did the simplifier fix,
> which a walk that ends where it began still needs.

Two rounds on one day, both the author's.

**The slogans went.** On the two-line slogans that headed the panel — "Places I've been. / Paths
I've walked." on the Globe and "Paths I've walked. / Peaks to roads." on the Terrain: *"This
looks stupid for me."* The titles are now **"Trips"** and **"Trails"**, and the instruction line
under each stayed, by request.

- **The words are the author's, not new copy.** They are the names of the original section's two
  tabs, chosen over a dozen alternatives because both are already true of the data behind them
  (see "Two tabs, not four"). The rest of this panel already used them: "Filter trails", "All
  trails", "Back to all trails".
- **A title names what is listed, and nothing more.** The slogans tried to say something about
  the author, which is the photos' job. The Globe's also promised "Paths I've walked" over a wall
  of trips, and "walked" was never true of the three half marathons.
- **The section is named "Trips and trails"**, with `aria-label`. It used to take the Globe face's
  slogan through `aria-labelledby`, which named the whole showcase after one of its two views.

**Then the panel was "too empty."** The titles had first been set at the trip panel's 1.75rem, so
the corner held a small name over nine ruled squares. Four changes followed, none of them new
copy:

- **The title is back at the slogans' display size**, 2.1–3.4rem, and 2.15rem on a phone. It is
  the anchor of the corner, and at 1.75rem it could not hold the wall under it.
- **The trips go three across, larger.** Nine tiles make a square, where four across left Bangkok
  alone on a third row. A tenth trip starts a fourth. The trails stay four across, a row per kind.
- **A trip without a photo shows its footprint**: the built-up area the globe lights up for it,
  read at build time from `visited.json` and drawn the way a trail's tile draws its route. It is
  filled, because it is an area, in the accent at a fifth of its strength with a full-strength
  edge, as the globe draws it. Seoul & Busan is two shapes at their true distance apart. A cover
  photo replaces the drawing, and a trip with no footprint keeps the ruled placeholder.
- **"Pick a photo" became "Pick a trip"**, because no tile has a photo yet. It pairs with the
  Terrain's "Pick a trail to fly down to it."

**No list of countries**, though it is the obvious true thing to fill the corner with. The figures
the author took off the panel included a count of countries, and a list says the same thing.

**The simplifier had a bug only the footprints reached.** Tokyo's and Bangkok's rings repeat their
first point several times at the end (see `public/globe/README.md`), so a span of the
Ramer–Douglas–Peucker pass began and ended on one point. Measured against a line of no length,
every point scored zero, and both cities came out as a dot. `thin` now measures to the point when
a span has no length. The trail outlines are byte-identical before and after, so no trail had
reached that case.

| panel height, px | slogans | small title | now |
|---|---|---|---|
| Globe, 1440 | 462 | 391 | 500 |
| Terrain, 1440 | 559 | 488 | 507 |
| Globe, 390 | 399 | 342 | 449 |
| Terrain, 390 | 496 | 439 | 454 |

The nine drawings add 3.5 KB gz to the page's HTML: 817 points, thinned at twice the trails'
tolerance, which is still about half a pixel on a tile.

Verified against the production build by screenshot at 1440 and 390, both views, light and dark,
and the five showcase suites re-run: 28 of 28, 18 of 18, 17 of 17, 24 of 24 and 17 of 17. The shared stylesheet is byte-identical and
every link resolves.

### One photo at a time, and no title (25–27 Nov 2026)

Fourteen rounds on the left panel, in the author's words:

1. *"I do not like the trips because everyone know this is the trip. I dont want words to mention
   what this for. This section is to show my memory only no need to tell anything."*
2. On the wordless sheet built for that: *"But now ugly eh still can put the desc la just dont but
   trips word because everyone know this is trips."*
3. *"No dont show the trips area It should display the photo just I have put the photo in."*
4. On the collage built for that: *"I think the ratio not nice. This will give user have more
   attention at left hand side."*
5. On the answer to that, small equal photos **and the globe moved to the middle**: *"nonono Why
   cahgne the earth to mid revert it."*
6. On the small squares, with the globe back: *"I do statisfied with my terrain left and right
   ratio but for globe the ratio on left and right a bit weird."*
7. On those squares made the column's width: *"Still weird. Maybe is not only the ratio problem the
   content and layout make it weird also. I no need to show all trips and photo at a glance. maybe
   can put other content or show only 1 or few frame at 1 time and use animation to swap it. Show
   the picture in so small frame also weird."* What answered it is under "The reel" below.
8. On the reel: *"All good now just this Pick a trip to fly there, or spin the globe. word is weird
   maybe you change a place to put it or make it smaller."* It moved under the place's name, and
   was made 0.8rem in `fg-muted` as well.
9. On that: *"I think the size can remain just put it down."* Back to 0.95rem in `fg-body`, the
   Terrain line's own size and colour, in the new place.
10. On that: *"Still weird. Maybe just remove the word or put other thing. you decide."* Removed.
11. On that: *"ermmm THis looks empty again. Do you have other idea?"* Seven ideas were mocked on the
    live build and put on a page to compare. One had been built straight into the page first, and
    came back out: *"I think you list out you idea to let me decide dont change directly."*
12. On that page: *"use back the word like Pick a trail to fly down to it. but make sure the desc is
    same as terrain and the font size ratio make sense and both need to be same."* Two places for
    the line were mocked.
13. On the one that moved the photo up under the line: *"no dont change the photo location just
    change the words location and size."* That shipped, and stood for a day.
14. Then: *"I want more different words front size front type and position."* Given a mixer of
    eight wordings, five sizes, six typefaces and four places, the author pasted back its settings:
    *"Words 4 (“Pick a memory to fly there.”) · size S · Handwritten · right above the photo"*.
    That is what shipped.

- **No "Trips" and no "Trails".** Both stay as headings for a screen reader, hidden with `xp-sr`.
  **Each face has one line, handwritten, and the two are set alike** (fourteenth round): "Pick a
  memory to fly there." on the Globe and "Pick a trail to fly down to it." on the Terrain, both in
  Caveat Medium at 1.23rem, line height 1.15, in `fg`. Caveat's letters are small for their size:
  1.23rem is the mixer's S, 0.85rem, scaled by 1.45 so it reads about as large as the sans would.
  The Globe line stands right above the photo, the gap under it the same 1.1rem the Terrain face
  leaves between its line and the trails. It hangs off the Globe face's top edge (the face is
  `position: relative`, the line `bottom: calc(100% + 1.1rem)`), out of the flow, so the photo did
  not move for it. The Terrain line keeps its place at the top of the column; the trails under it
  moved up 0.15px, the difference between the two line boxes. On a phone, where the panel is in the
  page's flow, the Globe line leads the face as the Terrain one does, which puts it right above the
  photo there too. The line had been weird everywhere else: "Pick a trip to fly there, or spin the
  globe." over the photo, where it read as a title, then under the place's name, smaller and then
  at full size, then gone for a round, which left the face looking empty, then "Pick a trip to fly
  there." in the site's sans at the top of the column. Before that, four places had been mocked
  against sample photos: smaller in the same place, under the name, under the name after a
  hairline, and pinned at the foot of the column (cut off from the panel, and under the author's
  timeline when it slides up).
- **Photos, never the area.** The footprint drawings that filled a tile without a photo are gone,
  and so is the code that read `visited.json` for them. A trip with no photo holds its frame with
  the travel timeline's hatching and "Photo to come". The globe still draws the footprints.
- **The earth stays where it was.** Nobody asked for it to move. It is centred in the space to the
  right of the panel's column, so the column's width, `min(25rem, 32%)`, is what places it: a wider
  or narrower panel moves the earth. The photo fills it, as the trails do. At 1440 × 900, light and
  dark, none of the map's 763,752 pixels differ from before any of this; after the sixth round and
  again after the seventh, none differ at 1920 × 1080, 1440 × 900 or 1280 × 720 in either theme.
- **The column's whole width** (sixth round). The photos used to be sized off the stage's height
  (`clamp(15.5rem, 36%, 19rem)`), which kept one proportion to the globe but stopped them short of
  the column the globe is centred beside: the space between photos and earth came out at up to
  twice the globe's margin on its far side (257px against 141 at 1440 × 900), while the Terrain
  face, which fills that column, was the one the author found right. Filled, the space is the far
  margin plus 48px at every size, and both faces end at 401px. The seventh round kept this.
- **Level with the middle of the globe, not in the top corner.** The trails stay at the top, where
  they stand over the sky.
- **Trips with a photo come round first**, newest first among themselves, and the frames still
  waiting after them.
- **Above the map on a phone the photo is 16:9** and at most 34rem wide, so the map is in view
  sooner: the panel is 310px tall at 390 wide, where the wall was 309 and the collage 441.

**The handwriting is the site's only web font**, Caveat Medium, and only this page loads it: its
`@font-face` is in MapShowcase.astro's styles, so it lands in the page's own stylesheet and the
shared one is byte-identical. The file is `src/assets/fonts/caveat-500.woff2`, emitted hashed into
`_astro/`.

- **Served from this site, not from Google Fonts**, so the top of the page still contacts no third
  party (see "Relief is on when the showcase opens").
- **44,520 B, and that is the floor, not a slip.** Caveat carries an alternate shape for most
  letters, so a repeated letter does not look stamped: 226 glyphs for 104 characters. Google's
  Latin cut is 50,904 B; this one is cut to English letters and punctuation, the `unicode-range`
  in the rule. Hinting is not the weight: Google's Mac file is the same size. An accented letter
  falls back to the next face in the stack, one letter at a time. The mixer had quoted "about
  30 KB" from memory; measured, it is 44.5.
- **To cut it again**, ask the Google Fonts CSS2 API for `family=Caveat:wght@500` with `text=` set
  to printable ASCII plus the no-break space, `·`, `–`, `—`, `‘`, `’`, `“`, `”` and `…`, sending a
  browser's User-Agent so it answers in woff2, and download the file the answer names.
- **No preload, on purpose.** The line is laid out at load like the rest of the page, so its font
  is requested then: measured, it had arrived 323 ms after navigation with the page never scrolled
  and the stage 7,362px down. A preload would compete with the first paint for a line seven
  screens away. `font-display: swap` only shows on a connection slower than the reader's
  scrolling.
- **Chrome reports the family as "Caveat Medium"**, the name inside the file, in CDP's
  `CSS.getPlatformFontsForNode`. A check for "Caveat" alone fails; it cost a run.
- **The licence is the SIL Open Font License 1.1.** The copyright notice and the licence's URL are
  in the file's name table, and repeated in the comment over the rule. No licence text file sits in
  `src/`: Tailwind scans every text file there (see "This file is a build input").

#### The reel (seventh round)

**One frame the column's width, 4:3, and the photos take turns in it.** The photo showing drifts a
little closer (a 6% zoom over 9 s) and, after 6.5 s, cross-fades to the next. Under it a thin bar
fills over that dwell, with previous, pause and next at its end; under that, the country as the
eyebrow and the place's name. The face is 345px tall at 1440 × 900, level with the globe's middle,
where the Terrain face is 403.

**The globe is the index and the panel is the picture.** Pointing at a trip's card on the globe
brings its photo up and holds it there while pointed at; a merged card brings up the first of its
trips. Pointing at the photo lights its card, as the tiles did. A click on either opens the trip,
and the photo showing afterwards is that trip's.

**No summaries.** Every trip's `summary` is about when — "Bangkok in early November", "a month after
Shanghai" — and the author keeps that off anything a glance lands on. The caption is the place and
its country.

Things that look wrong and are not:

- **The timing is CSS, and there is no timer in the script.** Each slide's bar is an animation the
  length of the dwell, and its `animationend` turns the reel. Bar and drift are set on every slide,
  paused, and run only on the slide showing while `data-playing` is on the reel, so one attribute
  stops both where they are and a photo fading out keeps its scale instead of snapping back.
  Turning to a slide rewinds its two animations with `getAnimations()`.
- **It stops for a set of reasons, not a flag.** `holds` in showcase-app.ts: the reader's pause, a
  mouse or pen on it, keyboard focus in it (`:focus-visible` only, or a mouse click on a button would
  leave it stopped after the pointer had gone), a trip's panel open, the Terrain view, the stage off
  screen, a hidden tab, and a card on the globe pointed at. It plays only when the set is empty.
- **WCAG 2.2.2.** It starts by itself and runs past five seconds, so it has a pause button as well as
  stopping for hover and focus. Under reduced motion it never moves on its own; the arrows step it,
  and the bar keeps its line so they do not move.
- **The showing slide's visibility is `inherit`, never `visible`.** The panel is put away with
  `visibility: hidden` while a trip is open, and a slide that said `visible` stayed clickable and
  focusable inside it at opacity 0. Found by the map-only pixel check, which hides the panel the same
  way and suddenly differed by 95,000 pixels.
- **A card turns the reel only while the reel is out.** With a trip open the globe flies, cards
  slide under a pointer that never moved, and each was turning the hidden reel. That made the photo
  that had opened the trip inert, and Escape could not hand focus back to it.
- **The controls are placed by a padding percentage.** The photo is three quarters of the reel's
  width tall (nine sixteenths below 52rem), and padding percentages are shares of the width, so
  `padding-top` puts the buttons on the bar's line at every width without knowing how tall any
  caption is. They sat on the caption's line first, and dropped below a one-line caption at 1280,
  where "Guangzhou & Shenzhen" wraps and makes every slide as tall as itself.
- **Slides are one grid cell**, so the reel is as tall as its tallest caption and nothing under it
  moves when a long name comes round. Inactive slides are `inert`.
- **The captions trade places faster than the photos.** The old one is gone in 0.25 s and the new one
  rises after it, so two names are never seen over each other during the 0.9 s cross-fade.

**The placeholder sphere was in the wrong place, and already was before this work began.** It is
an SVG pinned with `left` and `right`, and an SVG's automatic width is its own shape's, not the
space between two edges, so it sat at the left and the globe came up somewhere else. It takes an
explicit width now, and at eight screen sizes it lands within 1px of where `homeCamera()` puts the
globe. The formula itself draws the globe about 2% larger than MapLibre does; that was there before
and is left alone.

**A photo gets in by being dropped in.** `tripPhotos()` in `lib/content.ts` takes the `cover` a
trip's frontmatter names, or failing that `src/assets/travel/<id>/cover.*`, with nothing to edit.
Nine empty folders wait for them on the author's machine; git does not track an empty folder.

- **Only `cover.*` is matched, and widening it would leak.** An `import.meta.glob` puts every file
  it matches in the build. Tested with sample photos carrying GPS data: a matched photo that is
  drawn is re-encoded, its data stripped and its original not published, but a matched photo that
  is not drawn was published whole. The same is why two covers in one folder is an error.
- **A folder that names no trip fails the build** and lists the ids it could have had. A folder with
  photos but no cover only warns, because they may be for a gallery.
- **The reel only.** A dropped photo has no `coverAlt`, so the timeline and the trip pages, where the
  photo is the content, still read `cover` from the frontmatter.
- **The originals are in the repository with their GPS data**, whatever the build strips.
- Works in `npm run dev` too, where a photo dropped in appears without a restart.

**One place, two marks.** Pointing at a tile or the photo lights its card on the map (accent edge
and name) and fades the other cards; pointing at a card lights its tile, or brings its photo up in
the reel. It is `spot()` in showcase-app.ts, for a
mouse, a pen or keyboard focus. Not touch, where a tap is a click and would only flash it. It is
cleared whenever the panel is put away, because a panel hidden under a still pointer gets no
`pointerout`. The tile of the trip that is open carries `aria-current`, which shows on a phone,
where the panel stays up.

Things that look wrong and are not:

- **Area and merged cards carry `data-mapglobe-members`**, a space-separated list of trip and route
  ids. It is how Tokyo finds "Seoul & Busan · Tokyo" and Belumut finds "Johor". Additive: the
  original section never reads it, and its link-style trip cards carry no id, so its merged cards
  list only routes.
- **The panel's box is a full-height column, whatever is in it.** `framePadding` clears a reserved
  box by its shape: taller than wide sideways, anything else vertically. Sized to its content, the
  Trails face stops being taller than wide once the filter hides a row, and by the engine's
  arithmetic the overview fit then fails its 45% test at 1440. The column never does. Checked with
  the hikes switched off: every card still lands right of it. It passes pointer events through, so
  the map below the trails can still be dragged.
- **Faded cards use `filter`, never `opacity`.** MapLibre writes each marker's opacity inline to hide
  the ones behind the globe, and inline beats the stylesheet.
- **A card the engine has hidden is never lit**: merged away, decluttered or behind the globe. If
  none is visible, none fades either. Dimming everything to point at nothing says nothing.

**Tried and dropped, so not retried:**

- One sheet of pictures parted by hairlines, names hidden until hovered, the rest greyed out on
  hover, and the kinds of walk told by their signs alone. "Ugly."
- A collage led by one large photo, two medium, then threes, filling the column. "More attention at
  left hand side." Mixed sizes are half of that: the large one is what pulls the eye.
- The globe centred in the whole stage, moved right only as far as it needed to clear the photos.
  Reverted at once.
- Four quieter shapes, mocked up against sample photos before this one was chosen: a slim film strip
  down the edge (22% of the disc, but a strip of nine needs a second column on a laptop's short
  window), a list of small photos with names beside them (10%, reads as a menu), the collage at
  half size (26%), and two columns (24%).
- In the sixth round, before 4:3: squares at the column's width (113px frames, 34% of the disc at
  1440 × 900 and 58% at 1280 × 720, heading back to the collage), and four across in the trails'
  own 82px frames (Bangkok alone on a third row).
- Nine tiles at the column's width, 4:3 above 71rem and square below (the sixth round's answer).
  "Still weird": a grid of nine reads as an index squeezed beside the earth at any size, and every
  photo in it is small.
- In the eleventh round, seven things under the place's name, mocked and not chosen: the trip's
  highlights as white chips, as one line and as a list; a square photo with the chips; two prints
  peeking out behind the photo; the place's name in its own script; and a line in the author's own
  words per trip. The chips were built into the page before the author had chosen, and came out.
- In the twelfth, the whole face moved to the top so the line sat where the Terrain one does. It
  moved the photo: "dont change the photo location". The other place mocked that round, just above
  the photo with the photo where it was, is where the line went in the fourteenth.
- In the thirteenth, the line in the site's sans at 0.95rem in `fg-body`, at the top of the column,
  set exactly like the Terrain line. The author named nothing wrong with it; they asked for more
  words, sizes, typefaces and places to choose from, and chose another.

| | before | now |
|---|---|---|
| `/about/travel-preview` HTML | 27.16 | **23.70** KB gz (24.00 with nine photos) |
| its CSS | 12.04 | **12.30** KB gz |
| showcase app, on approach | 9.00 | **9.31** KB gz |
| MapLibre engine, on approach | 255.31 | **255.39** KB gz |
| shared CSS, all 25 pages | 10.14 | **10.14**, byte-identical |

Verified in Chrome, 34 checks against each of two builds, all passing: the real one, which has no
photos yet, and a copy of the project with nine made-up sample photos (JPG, an upper-case `.JPG`,
PNG and WebP, landscape, portrait and square). They cover:

- no title on either face, the line leading it, and the names on the tiles;
- nine equal squares, the globe where it was and clear of them, photos where there are photos, empty
  frames where there are none, and no area drawing anywhere;
- a tile lighting its card and a card its tile, a merged card lighting both of its trips, Belumut
  lighting "Johor", and moving off clearing all of it;
- Tab, Enter and Escape, with no light left behind and focus back on the tile;
- the kind rows, the filter, and cards clear of the panel with a row hidden;
- dark, and a tap at 390px, with no overflow at any width and a clean console.

The ten trail outlines are byte-identical, and every link resolves. The original section was only
checked for its three tabs switching without errors; its own suite is no longer on disk.

The sixth round was checked in Chrome against the production build, 23 checks with 22 passing:
the photos ending at the column's edge, the same 352px as the trails' wall; still level with the
globe's middle; a frame lighting its card and a card its frame; Enter, Escape and a click; Terrain
showing its own face; no overflow; a clean console; and the caption contrast above, whose 860px
failure is the one recorded there. Around it: the map with the panel hidden is pixel-identical to
before (globe at three sizes in both themes; the Terrain map differs only by the run-to-run noise
that two runs of one build show, in a 60 × 40px box around the Johor card), the phone panel is
pixel-identical at 390, 700 and 832px, the page's CSS went 12,297 → 12,263 B gz, and the shared
stylesheet is byte-identical.

The seventh round was checked in Chrome against the production build, 38 checks, all passing:

- it plays on arrival and turns by itself, and stops for a pointer, keyboard focus, its pause button
  (which says so, and holds after the pointer has gone), a trip open, the Terrain view, and the stage
  scrolled away; next and previous step it; only the photo showing can take focus;
- pointing at the photo lights its card, and pointing at a card (Bali, and a merged one) brings up
  its photo, lit, and holds it;
- Enter on the photo opens its trip; while it is open the put-away photo can be neither clicked nor
  focused; Escape returns focus to the photo; a trip opened from its card is the photo after;
- under reduced motion it never plays, has no pause button, and the arrows step it;
- the controls centred on the bar and clear of every caption at 1280, 1440 and 1920, every name on
  one line at 1440, and the photo exactly the column's width;
- 390 and 700px: no overflow, a tap on the photo opens its trip, consoles clean.

Around it: the globe is pixel-identical to before at three sizes in both themes, the Terrain panel's
column too (6 stray pixels at 1440, where the moving map shows at its foot), and the shared
stylesheet is byte-identical. The page's CSS went 12,263 → 12,703 B gz; the showcase app is
9,897 B gz and the page's HTML 23,936 B gz after it.

The thirteenth round was checked in Chrome against the production build, 34 checks with 33 passing:

- the Globe line at the Terrain line's place, size, weight and colour at 1280, 1440 and 1920 and in
  dark: (49, 47) in the stage, 15.2px;
- the photo in the same place with the line and with the line taken out of the layout, and nothing
  but the line's box differing between the two;
- against the page before the line, at 1440 with and without photos, only the line's box differs;
- the Terrain line unchanged;
- at 390 and 700px the line leads the face, 17.6px above the photo, with no overflow.

The one failure is two Mapterhorn 404s at 1920 after switching to Terrain, for tiles 3/7/0 and
3/0/0 over the Arctic: the sparse pyramid recorded under "The atlas layers". Around it: the 38 reel
checks pass, the Terrain panel's column and the globe are pixel-identical (the Terrain map differs
by the run-to-run noise around the Johor card), and the shared stylesheet is byte-identical. The
page's CSS is 12,769 B gz and its HTML 23,923 B gz after it.

The fourteenth round was checked in Chrome against the production build, 68 checks, all passing:

- both lines drawn in Caveat Medium and nothing else, read from Chrome's own report of the fonts it
  used, at 1280, 1440 and 1920, in dark, and at 390 and 700px;
- 19.68px, weight 500, line height 22.63px, in `fg`, in both themes;
- the Globe line ending 17.6px above the photo at all four desktop sizes, on one line, from the
  photo's left edge;
- the photo in the same place with the line and with it taken out of the layout, and at 1440 where
  it always was, (49, 220.92) and 352 × 264; against the page before any line, only the new line's
  box differs, with photos and without;
- the Terrain line at (49, 47.4), the trails 17.6px under it;
- the font fetched once, from this site, with nothing from Google, and fetched at load with the
  page never scrolled;
- at 390 and 700px both lines leading their faces, 17.6px above the photo and the trails, with no
  overflow; consoles clean apart from the same two Mapterhorn 404s at 1920.

Around it: the 38 reel checks pass, the shared stylesheet is byte-identical, and every link
resolves. The page's CSS went 12,769 → 12,913 B gz and its HTML 23,923 → 23,929 B gz; the font is
44,520 B more, fetched once.

### What it costs

| | before | after |
|---|---|---|
| `/about/travel-preview` HTML | 15.07 | **18.72** KB gz |
| its CSS | 5.85 | **11.37** KB gz |
| its eager script | 3.38 | **3.52** KB gz |
| showcase app, on approach | — | **8.71** KB gz |
| MapLibre engine, on approach | 254.42 | **254.94** KB gz |
| shared CSS, all 25 pages | 10.11 | **10.11** — byte-identical |

The second map also costs a second WebGL context, and a second fetch of the geometry, which the
browser cache serves after the first. Since relief went on by default, arriving also costs
Mapterhorn's hillshade tiles, measured above. The table predates that change and was not
re-measured: chunk sizes are only comparable within one session.

### Verified

35 checks in Chrome against the production build, all passing. Re-run on 25 Nov 2026 after
relief went on by default, again after the photo wall, and again after the two views and the
hidden timeline:

- **Desktop:** the top of the page contacts no third party; the showcase, once ready, contacts
  Mapterhorn and nobody else; the Relief switch ships on; trip cards are buttons. A trip opens its
  panel and breadcrumb. A trail opens Terrain with the profile chart, crumbed from "All trails".
  The flyover runs with live readouts. A drag pauses it and offers Re-centre (the distance holds),
  Re-centre resumes, speed cycles, and Escape stops it and restores the framing. The tour, started
  from the timeline's play button, begins on the oldest trip, Next advances, and End keeps the
  reader at that trip. The layers popover opens and closes. The original section is unaffected.
  No console errors, no overflow.
- **390px:** the hero is above the map. The panel opens as a peek (27% of the map), the grabber
  steps to half, a trail opens Terrain with its breadcrumb, the controls are hit-testable, and
  there is no tour or timeline control.
- **Keyboard:** the photo tiles are in the tab order and the folded timeline takes no focus. Enter
  opens the panel with its heading focused; Escape closes it and returns focus to the tile.
- **Dark theme:** the flyover runs, and the page has no errors.
- **Reduced motion:** the trail panel has no fly button and a note says why, and the tour waits
  for Next.
- **The original section**, 13 checks. It alone still contacts no third party on arrival, its
  Relief chip starts off, and its trip cards are still links. Its three tabs, a route drilled
  from the index, the theme round trip and the detail views all work. The 13th check, the Colour
  view, fails on its own threshold, not on the map: accent pixels go 1132 → 1033 → 1132, a real
  repaint and an exact restore. A height ramp that starts at the accent changes fewer pixels
  than that threshold assumed.

### Known and left alone

- **The route-to-route mis-framing the review found applies here too.** Switching from one trail
  to another inside Terrain frames the second about 285px high, because the engine's fit
  starts from a drilled camera. The fix belongs in the engine and would move both sections at once.
- The tour stays on the globe and never drops into Terrain. With relief on, it still fetches
  hillshade tiles for each place it stops at.
- Heart rate is not shown here; the Effort view stays in the original section.

## Reveal animation contract

Two halves that must stay in sync:

- `src/styles/global.css` sets hidden starting states, **gated behind `html.js`** (added by an
  inline head script in `BaseLayout.astro`). The gate means a JS failure degrades to "no
  animation", never "no visible content".
- `src/scripts/reveal.ts` animates to the resting state.

Adding a new `data-reveal` value means adding it to **both**. A value present in the CSS but
not in `reveal.ts` leaves elements permanently invisible — that is the failure mode to watch
for. Supported: `fade`, `fade-up`, `slide-left`, `slide-right`, `split-chars`, `split-lines`.

**Never put a link or a button inside a `split-*` element** (found 24 Nov 2026). SplitText
rebuilds the text inside pieces marked `aria-hidden="true"` and copies a nested element into
them, so a link in a split heading came out twice: an empty copy, still a focusable link, and
the real one inside the hidden pieces, out of a screen reader's reach while it still takes
focus. Seen in Chrome with GSAP 3.15, at 1280 and 390. Give such an element `fade-up` instead.
Found when the AiBE work page's title briefly linked the product's name; that link is now a
button under the role line. The "Current" badge is kept out of the h1 for a related reason
(see "Content").

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

**Text is set in the system's own faces** (`--font-sans`, `--font-mono`), with one exception: the
travel showcase's handwritten line, which loads Caveat on that page alone. See "One photo at a
time, and no title" for why it is served from this site and what it costs.

`src/styles/global.css` holds two `@theme` blocks. The first is the raw palette
(`kleinblue #002FA7`, `schenbrunnyellow #F7E14D`, `tiffanyblue`, `prusianblue`, `bluenova`,
`lavendarblue`), carried over from `tailwind.config.js`; five of its six entries are still
unreferenced, pending the design direction docs/REBUILD.md §12 leaves open. The second is
`@theme static` and holds the semantic tokens everything actually uses.

**Colour in markup goes through a semantic token, never a raw hex and never a literal shade
like `gray-700`.** See "Theming contract" above for the full set and why. Reaching for a raw
palette entry is usually also wrong — `kleinblue` is unreadable on the dark background, which
is exactly what `accent` exists to solve.

**`var()` does not work in an SVG presentation attribute.** `fill="var(--color-band)"` reads like
a CSS declaration and is not one: Chrome fails to parse it and the shape falls back to the
initial `fill`, which is **black** — in both themes, with a clean build and nothing from
`astro check`. Found on the travel preview's interaction mock-up (10 Sep 2026), where a globe
rendered as a black disc and `getComputedStyle(circle).fill` read `rgb(0, 0, 0)` in light and dark
alike. Give the shape a class and colour it in CSS — which is why the MapLibre route charts colour
every mark by class.

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

### Case-study visuals on a work page (18 Nov 2026)

Work pages are written for recruiters and interviewers who skim, so a work entry can carry
four optional frontmatter fields that `work/[slug].astro` renders around the markdown body.
An entry without them renders exactly as before; grep `src/content/work` for which use them.

| Field | Component | Where it renders |
|---|---|---|
| `highlights` (≤4 `{value, label}`) | `WorkHighlights.astro` — stat tiles | between the header and the body |
| `chat` (`{label?, messages: 2–8 {from: user\|agent, text}}`) | `WorkChat.astro` — example conversation | after the highlights |
| `flow` (`{steps: 2–4 {title, text, tech?}, note?}`) | `WorkFlow.astro` — "How it works" diagram | after the body |
| `challenges` (`{title, problem, fix, result}`) | `WorkChallenges.astro` — "Problems I solved" cards | after the flow |

**A work page is public, so it carries common-level facts only.** What the product does, the
author's part, results and the tech list are fine. A confidential project's internal design,
data flow, architecture or incident details are not: not in `flow`, not in `challenges`, not
in the body, and not in the HTML comment at the foot either (it ships in the built page). On
18 Nov 2026 the author had the "How it works" diagram and the problem cards removed from
`ai-agent-bms` for exactly this reason, and found the detailed stories too long for anyone to
read anyway. `chat` is user-level by design: what someone types and what comes back, with
made-up numbers labelled as such, never how the answer is produced.

Why frontmatter and not HTML pasted into the markdown: the fields are validated by zod like
everything else in the entry, and the components own the markup, so no prose file carries
layout. The two headings ("How it works", "Problems I solved") belong to the components,
which is why an entry that uses them must not also write those sections in its body.

Things that look like shortcuts and are not:

- **`highlights[].value` is a string.** "500+" and "50%" must render exactly as written.
  Quote a bare number in YAML (`value: "10"`), or zod receives a number and fails the build.
- **Stat values use proportional figures, not `tabular-nums`.** Equal-width digits make a
  lone "10" look loose at `text-3xl`; tabular figures are for columns of numbers.
- **The diagram is an `<ol>` of real text, not an SVG.** It wraps at any width, follows the
  theme tokens, and reads in order to a screen reader. Below `md` the steps stack with `↓`
  connectors; from `md` up they sit in one row with `→`, one column per step
  (`grid-auto-flow: column` + `auto-cols-fr`), so a 2- or 3-step flow fills the row
  instead of leaving the empty columns a fixed `md:grid-cols-4` did. The arrows are CSS `::after`, so they
  are never announced. They use `fg-meta`, not the icon token `fg-faint`, which is about
  2.5:1 on the light page — too faint for the one mark that says "this leads to that".
- **Keep step text to about eight words and `tech` to one name.** From `md` up each card is
  ~140px wide in the 42rem column. "ClickHouse · Python" broke over two lines there.
- **Only `p`, `h2`, `ul` and links are styled inside `.page__body`.** A numbered list, an
  `h3` or a table in a work entry's markdown renders unstyled; Tailwind's preflight strips
  `ol` markers.
- **Chat bubbles: user is `bg-accent` + `text-on-invert`, agent is `surface-2` on a
  `surface` card.** The first is the pair the theming contract documents as AA in both
  themes; the second recedes the right way in both (darker in light, lighter in dark).
  Hidden "User:"/"Agent:" prefixes carry who said what, so it never rests on position or
  colour. Quote a bare `"Yes"` in YAML, or it may parse as a boolean and fail zod.
- **Values only one of these components uses are plain declarations, not `@apply`.** The
  "build input" problem above applies to `.astro` files too: Tailwind scans the component
  source, so every token in an `@apply` line is also emitted as a utility into the shared
  BaseLayout stylesheet that all 25 pages load. Written as utilities, the 25 component-only
  values (`size-6`, `max-w-[85%]`, the `md:` flow grid and so on) cost every page ~207 B gz:
  the shared sheet measured 10,460 B gz with them and 10,253 B gz without (python gzip -9).
  Utilities the site already uses stay as `@apply`; they cost nothing. Keep comments in these
  files free of utility names too, for the same reason.

**Cost: no JavaScript, and nothing in the shared stylesheet.** The components' CSS lives in
the work-page stylesheet (`_slug_.*.css` linked by `/work/*`, 2,551 B gz whole). It loads on
all seven work pages, not just the ones using the fields, because Astro bundles an imported
component's CSS for the route whether or not an entry renders it.

Verified 18 Nov 2026, light and dark, at 1280px and at a true 390px (a headless browser
cannot make a window that narrow, so the phone view is a 390px iframe on a same-origin
helper page that sets `localStorage.theme`). The switch to plain declarations was checked
by pixel-diffing before/after screenshots of every page using the components: identical.
Use headless Chrome for this. Headless Edge silently does nothing while Edge's Startup boost
process (`msedge.exe --no-startup-window`) is running: the launcher hands off to it and
returns at once, with no log and no file.

### Showcase layout — opt-in, used by `ai-agent-bms` (20–24 Nov 2026)

An entry with a `showcase` object renders through `WorkShowcase.astro` instead of the
standard article. `[slug].astro` branches on that one field, so every other entry renders
exactly as before. The order is the author's: **open by default is only their own work**;
the whole team project is collapsed below.

1. First view: the title, the entry's `summary` (the same line its cards show), the role
   line, "What I did" (the markdown body, four points; its `ul` becomes numbered rows)
   beside "Stack" (`showcase.tech`, grouped under plain-English labels).
2. "Agents I built", in `WorkAgentDemo.astro` cards. An agent with `features` (building
   operations, where the author spent most of their time) gets a block of its own: its name,
   one line, then a card per feature. The rest sit under "More agents I built", a `<details>`
   closed by default with their names on its header (the author's ask, 24 Nov 2026). This
   section alone runs wider (80rem) so the cards sit three to a row from 80rem, two from
   48rem. No row ends in a hole: cards left over from a row of three sit two to a row, half
   each (`half`), so five cards are 3 + 2; a lone last card of two takes its row (`whole`).
   **Every card holds up to three example chats, each as a web chat and as WhatsApp, and
   shows one at a time**: a switch on the heading line picks the version, a pager under the
   screen picks the example.
3. A `<details>` for the team platform: `highlights` on its header; inside,
   `platform.headline`, the areas (`groups`) with the author's items badged "Mine", the
   channels and the team's extra tools.

| Field | Used for |
|---|---|
| `showcase.location` | Follows `company` on the role line |
| `showcase.tech` | `{group, items}` rows ("Databases": ClickHouse, FalkorDB); falls back to `stack`, so a card keeps its seven chips either way |
| `showcase.agents` | `{name, text, link?, linkText?, channel: whatsapp\|web}` plus either `examples` (one card) or `features: [{name, text?, channel?, examples}]` (a card per feature), checked by zod. `examples` is one to three `{messages}`. `channel` is the version shown first; a feature may set its own (the author wants the second row of building operations on web, everything else on WhatsApp). A message may carry `rows` (label/value pairs under its text: a table on the web, bold-label lines on WhatsApp), `photo` (a label drawn on a made-up photo) and `replies` (quick-reply buttons, web version only; quote `"Yes"` / `"No"`), and its `text` keeps `\n` line breaks. `link` and `linkText` put a link under the line of an agent with `features`, as on a picture step (building operations → `/work/cloud-data-platform`); zod refuses `link` on a one-card agent, which has nowhere to draw it |
| `showcase.platform` | `{title, tag?, headline, groups: [{name, items: [{text, mine}]}], channels?, tech?}`; `*phrase*` in the headline is set in `accent`; `mine: true` only for work the author wrote all or most of; `tech` is only the tools the team used and the author did not |
| `site` (top level, not under `showcase`) | The product's public site, as a URL. A showcase page draws it as a "Visit aibe.now ↗" button under the role line, named by its host and styled as the outside links at the page's foot, opening in a new tab like them. zod refuses `site` on an entry without `showcase` |

Things that look like shortcuts and are not:

- **Claims in the open part and "Mine" badges are checked against the work repo's history
  before they go in.** The evidence stays out of this repo on purpose: no commit counts, no
  remarks about colleagues, nothing about how the product is built. Being the top committer
  on something is not "most of it". Re-check before adding a claim, a badge or a tool.
- **Every example chat shows something its agent can really do, with made-up data.** All 33
  were checked against the agents' own tools and prompts on 24 Nov 2026, and 20 changed (16
  showed something the agent does not do, 4 disagreed with another card): a plausible chat
  is not evidence. Check the tools before writing one: which
  fields a list shows, what an action needs first (a booking needs a purpose, completing a
  job needs its cause), what the agent always asks for (the comfort survey ID), and which
  equipment a feature covers. The made-up building is one building: the 11 units, yesterday's
  3 alarms, Meeting Room 3 and fan unit 5 agree across cards. The buttons in the web version
  and the WhatsApp version of building operations are a drawing choice.
- **Workspace finder is a plain card.** A comfort-range chart beside its chat was tried and
  dropped (24 Nov 2026): the author wanted two equal cards in that row.
- **Recruiters do not know the tool names, so the stack is grouped, not explained.** The
  labels (Backend, AI agents, AI models, Databases, Monitoring, Cloud) say what each tool is
  for in a word, which was the author's ask: "dont introduce the tech stack just make sure
  recuitter can know that in a glance". Small libraries and product names that would hint at
  a client are left out.
- **The first view holds everything on a 1280 x 800 screen**: "What I did" ends at 737px and
  the stack at 711px. On a 390 x 844 phone "What I did" ends at 763px and the stack follows
  it, ending at 1031px. The phone spacing and chip size are tighter than the desktop ones for
  that reason; re-measure after changing anything above. (676 / 650 and 706 / 974 before the
  aibe.now button went in, 24 Nov 2026.)
- **One figure only.** The author wants "1000+ questions a month" and no counts beside it
  (24 Nov 2026), in `summary` and in `highlights`. The figure is theirs. It also shows on the
  cards on `/` and `/work`.
- **WhatsApp chats have no quick-reply buttons**: the agents' WhatsApp channel cannot send
  them, so the user types the reply, and a message that relied on a button asks its own
  question instead ("Apply this weekly schedule to fan unit 2?").
- **Card headings are two words at most** (the author's rule) and say what the chat shows
  ("Sensor readings", "Fault diagnosis"), with one short line under each. Not "Fault
  reporting" for the diagnosis card: that is the name of the separate agent occupants use to
  report a fault.
- **Both controls are radio inputs and `:has()`, no script.** Each group needs a page-unique
  name, so `WorkShowcase` passes `uid` (`f0-3`, `a2`). The radios stay in the page, visually
  hidden, so Tab, the arrow keys and screen readers work. A pager arrow is one `<label>` per
  example pointing at its neighbour's radio, and only the label for the example on show is
  displayed, so it wraps around. Three examples is the most the rules know. Without `:has()`
  the first chat of each card shows and both controls go away (checked by rewriting the two
  `@supports` conditions in a copy of the build).
- **All the chats of a card share one grid cell and the others are `visibility: hidden`, not
  `display: none`.** The card is then always as tall as its tallest chat, so flipping never
  moves the page: heights are identical in all six states at 1280, 900 and 390. Hidden chats
  are still out of the tab order and the accessibility tree.
- **Two kinds of motion on the messages, on purpose.** The chat shown first carries the
  site's `fade-up` reveal on each message, so they arrive as it scrolls into view. Every chat
  also has a short CSS entrance staggered by `--i`. `visibility` does not restart an
  animation the way `display` does, so the entrance's *name* is what changes: a screen and a
  chat set `--ag-anim` to `ag-arrive` while shown and `none` otherwise, and a message reads
  it. Use the animation longhands there: the minifier turned a shorthand without a name into
  `animation: none`, and the entrance silently stopped. Reduced motion turns it off; the
  global rule alone shortens durations but not delays.
- **Nothing inside either `<details>` carries a reveal.** Content in a closed `<details>` has
  no layout, so a ScrollTrigger measured there fires at the wrong place or never, and the
  element would stay at opacity 0 after opening. The cards in "More agents I built" get
  `reveal={false}`; `details:not([open])` holds their CSS entrance back, so it plays on
  opening (without that rule it had already run, unseen, at page load).
- **Each chat version has its own set of `--chat-*` colours**, at the foot of
  `WorkAgentDemo.astro`. The web version maps them to the theme tokens, so it shows in the
  site's accent across all nine themes. The WhatsApp version is drawn in WhatsApp's own
  colours, the one exception to the token rule on the site, because the author asked for it
  to look like the real app: teal bar, beige doodle wallpaper, light-green outgoing bubbles,
  blue read ticks; light palette under all eight light themes, dark palette under the site's
  dark theme. The author tried the web version in WhatsApp's colours too and went back to the
  accent. The doodle tile is an inline SVG, one per palette, since a data URI cannot read a
  CSS variable.
- **The labels on the band are `fg-muted`, not `fg-meta`**: in Classic, `fg-meta` on `band`
  is 4.39:1. Every other new text pair is at least 4.5:1 and every mark at least 3:1 in all
  nine themes.
- **WhatsApp times sit over an inline spacer, not in a flex row.** A box that wraps keeps its
  full width instead of fitting its longest line, so a flex row pushed short messages to the
  right, and a spacer wider than the time pushed them onto two lines. The spacer is the
  measured width of the time: 1.625rem, 2.75rem with the ticks. After `rows` it follows the
  last row, so the time shares that line. It is WhatsApp-only: even at zero width, one after
  a web table opened an empty line under it. The times are generated (two a minute, ending on
  9:41), so an example must not mention a later hour of "today".
- **Example data is made up and says so** ("Example chats · made-up data"), with generic
  names: Zone 4, Meeting Room 3, level 3. Real zone, room and office names from the work
  repo look just as generic and are not used. Numbers inside a message are joined with
  no-break spaces (`level 3`), or a narrow bubble strands the "3", and a range like 3–5 has
  a word joiner (U+2060) after its dash, or it breaks there.
- **All the component CSS is plain declarations**, per "This file is a build input". Writing
  it leaked twice, both times from a comment: one containing the word `invert` added the
  filter utility to the shared sheet, and one containing `shrink` added `flex-shrink`.
  `cmp` the shared `BaseLayout.*.css` before and after any change to these files.
- **Notes about an entry go in YAML comments in its frontmatter**, which never reach the page.
  An HTML comment at the foot of the body ships in the built HTML.

Checked 24 Nov 2026 by building a copy of the tree with the change reverted: 22 of 25 pages
identical (once the work-page CSS file name and the carousel's per-build island `uid` are set
aside), `/` and `/work` different only in this entry's `summary` on its card, and the other
six work pages pixel-identical at 1280 and 390 in light and dark. Mouse, Tab and arrow keys
were driven through a real browser at 1280 and 390, in all the states above.

Cost: no JavaScript, and the shared sheet is unchanged. The work-page stylesheet, which all
seven work pages load, went from 2,580 to 6,960 B gz (python gzip -9). This page's HTML is
15.1 kB gz for 33 chats drawn twice.

**The product's site, and the data platform linked both ways** (24 Nov 2026). The author gave
the product's site, https://aibe.now/ ("AiBE by Primustech"), and asked for building
operations to mention the cloud data platform, which is the agents' database.

- **"Visit aibe.now ↗" is a button under the role line** (`site`), styled as the outside
  links at the page's foot. The author picked it from four mock-ups (in the role line, a
  button, a link in "What I did", the foot of the page) after three tries the same day looked
  wrong in the page, so none of them comes back:
  - the title renamed "AiBE: AI Agent for Building Management": "AiBE" in the title did not
    look right, so the title stays as it was;
  - "aibe.now ↗" at the right end of the kicker: "the place is bad";
  - "AiBE" in the title as the link itself, which also turned up the SplitText bug written
    up under "Reveal animation contract".
- **The two pages point at each other.** Building operations now says it reads every sensor,
  meter and unit "from our cloud data platform", with "See the data platform →" under it; the
  data platform's third picture box is titled "AiBE's AI agents" and keeps "See the AI agents
  →". Fitting the 200-character cap on an agent's `text` is why "piece of equipment" became
  "unit", the word both pages already use.

Checked against a build from before the change: the shared stylesheet byte-identical, 23 of 25
pages identical, and the two entry pages different only as above. With motion on and off,
light and dark, at 1280 and 390: the button is 143 x 41px, clickable and reachable by Tab,
its text at least 11.88:1 at rest and 5.72:1 hovered in all nine themes; the data platform
link is at least 5.09:1; no horizontal overflow. The new rules cost 65 B gz in the work-page
stylesheet; no JavaScript.

### "What I built" — the showcase for work that is not agents, used by `cloud-data-platform` (24 Nov 2026)

`cloud-data-platform` uses the showcase layout with `showcase.built` in place of `agents`.
The first view and the collapsed team section are the same components as `ai-agent-bms`;
the band between them is "What I built". `agents` is now optional, and zod fails the build
for a showcase with neither.

**It is written for a reader who knows nothing about buildings** (the author's brief, 24 Nov
2026: recruiters and interviewers must get it at a glance). Several rounds on the same day,
so none of these is retried:

- One card per kind of data, a vendor's raw record above the standard one, mirroring the
  agent page: turned down. JSON, codes like `CHWP` and Brick class names mean nothing to
  that reader.
- A card per part of the work in plain words, with the building and vendor counts in the
  summary: turned down. The counts are too small to be worth saying, and "My part" should
  read as the author's process, in their order.
- In the flow, a live feed of readings for "fetch and store", a code → name dictionary for
  "convert", and one graph with three questions: turned down. Each picture has to show what
  the author really did in the work repo: the storage they designed, the model the client's
  lists become, and the graph they built.
- The graph as four small drawings, one per kind of link: a misreading. "It should be 4
  section" meant **step 4** of the flow, not four sections. The author wanted it moved there
  and redrawn as the graph they built, with more equipment.
- The graph as a whole building, two floors with eight units, a caption under it and four
  ticks: "too long and too many things". Then a few rooms with a chiller feeding two air-con
  units: "still not good". The author wanted a people counter in it, and the shape of a real
  building's graph with made-up names. Now one air-con unit and what links to it (below),
  three rows, two ticks, 398px tall at 1280 (the whole building was 635).
- No "Examples · made-up data" note on this page's band (the author's ask, 24 Nov 2026). The
  agent page keeps its own note.
- What is live now, top to bottom:

1. **The summary names the consumer**: "The data platform behind our building AI agents", and
   2B+ sensor readings, the one figure kept. The author asked for the agent to be mentioned,
   because this is its database, so "never refer to another work entry" no longer holds here,
   nor on the agent page, which links back (24 Nov 2026).
2. **"Where it fits"** (`WorkPicture.astro`): three boxes, building systems → this platform →
   the AI agents, with the platform's box marked "This project" and the last box, "AiBE's AI
   agents" (the product they belong to), linking to `/work/ai-agent-bms`. What goes in and who
   uses what comes out, never the steps inside.
3. **"My part"** (`WorkSteps.astro`): the author's five steps as a numbered flow, in their
   words: understand the client's data; fetch it and design the storage; convert it into a
   common data layer; save the asset relationships in a graph; make sure it works and is
   safe. Each step is a title, one line and a picture of it (`WorkShow.astro`, which draws the
   graph with `WorkGraphDemo.astro`). The titles down the left are the story in five lines.

| `built` field | Renders as |
|---|---|
| `picture` (2–4 `{icon, title, text, mine?, link?, linkText?}`) | `WorkPicture`: one row from 48rem with arrows between, stacked with down arrows below |
| `steps[]` (`{title, text, show}`) | `WorkSteps`: from 64rem text left, picture right, a rule joining the numbers; below, the picture follows its text |
| `show` `kind: list` (`title?`, `hint?`, `items: {name, text, url?, json?}`) | `WorkShow`: the kinds of data a client's system can give; an item with `url` and `json` is a dropdown that opens to an example request and the JSON that comes back |
| `show` `kind: store` (`flow`, `columns`, `rows`, `notes`, `note?`) | `WorkShow`: where fetched data goes as a row of boxes, a sample of the table, and the design choices behind it |
| `show` `kind: model` (`from: [list, value]`, `to: {depth, name, type, code?}`) | `WorkShow`: the client's separate records, an arrow, and the one connected model they become, as an indented tree |
| `show` `kind: checks` (`items`) | `WorkShow`: things that are always true, each with a tick |
| `show` `kind: graph` (`rows: [{name, id?, at?, span?, units: [{id, name, at?}]}]`, `links`, `notes`) | `WorkShow` + `WorkGraphDemo`: the graph drawn as a few rooms of one building (rooms as boxes, each unit in its room, a labelled arrow per link), then the choices behind it, ticked as in the store |

`platform` gained two fields this page uses and the agent page does not: `note` (one line
under the headline, for who built what: this is a team of two) and `shared: true` on an item
(an outlined "Shared" badge, for work done with a colleague, beside "Mine").

Things that look like shortcuts and are not:

- **Every example is made up, but each shows something the platform really does**, checked
  against the work repo on 24 Nov 2026; the evidence stays out of this repo, as for the agent
  page. Check that the platform gives an output today, not that code for it exists, before a
  step shows it. The made-up building is one building: AHU-02 (air-con unit 2), EAF-03
  (exhaust fan 3), PM-06 (power meter 6), the L2 PLANT RM and Level 2 agree across steps.
- **The graph picture is the graph the author built**, in the shape a real building's graph
  has, with made-up names (no real asset or room): one air-con unit in a plant room, serving
  a hall on another floor, fed by a fresh air unit and by the people counter in that hall,
  and measured by a power meter. Each unit sits in the room it is in; the arrows are the
  links that come from the facility team's spreadsheet (feeds, measures, serves). The real
  graph also has the building and its floors, and links each unit to its system and the
  kinds of reading it gives; the drawing leaves those out to stay short. Add to it only by
  taking something else away.
- **The step 1 examples are on example.com** (zod enforces it), with generic field names, so
  no reader takes them for a real endpoint or a vendor's real API. Their JSON must parse, or
  the build fails; it is drawn as written and coloured at build time, keys in the accent.
  The dropdowns are native `<details>` sharing a `name`, so one opens at a time with no
  script, and Tab, Enter and Space work.
- **The storage picture names no product and no table**: plain boxes, a two-row sample and
  the design choices the author made (split by month, sorted by equipment, sensor and time,
  one copy of a reading loaded twice, values kept as sent).
- **No counts of buildings or vendors anywhere**, including `highlights`, which keeps only
  2B+ (the author, 24 Nov 2026: "small value").
- **Everyday words over trade words in the graph**: "Air-con unit", "Fresh air unit" (no
  hyphen: a phone broke the line at it), "People counter", "feeds", "serves", "measures". The
  model tree is the one place for the standard's own codes (`brick:AHU`, `rec:Zone`), small
  and after the plain words.
- **The rule joining the numbers is decoration** (`line-strong`, under 3:1 on the band): the
  numbers and the ordered list carry the order, to the eye and to a screen reader.
- **The graph drawing is laid out at build time** (`WorkGraphDemo`), three columns at every
  width, so the YAML order is the drawing and it fits a 360px phone. Heights are fixed in rem
  and only the spread across is in %, so a line, label or box sits at a known height. Units,
  rooms and labels are HTML, so text stays readable; the links are one SVG stretched to the
  rooms' box (`preserveAspectRatio="none"`, non-scaling strokes). Each link joins
  neighbouring rows (zod enforces it) and leaves its unit straight up or down: in the same
  column it runs straight into its target; otherwise it turns at the target's height and
  comes in from the side. Either way it meets an outline square on, which is why its
  arrowhead can be a CSS triangle on the target, pointing straight, which a stretched SVG
  could not draw undistorted. Top and bottom arrowheads are the unit's or room's own
  pseudo-elements, left and right ones its name's, so a unit can take a line on all four
  sides; the build fails if two lines would meet at one side. Every link label sits
  halfway across its gap, on the straight part. A room a line points to is named in its
  body, right under the arrowhead, and is only as wide as it needs to be: a wide box with
  the name on its outline made the air-con look as if it served an empty box (the author,
  24 Nov 2026). Any other room's name sits on its outline at the
  first corner no line crosses at the narrowest width (15.5rem of rooms). Lines only move
  away from a name as the drawing widens, so clear there is clear everywhere. A long unit
  name breaks onto two balanced lines on a phone.
- **Re-check the graph for collisions after changing it**: a probe that tests every pair of
  units, labels and rooms for overlap, and samples every line for crossing a name or a unit
  it does not join, found none at 1280, 1024, 768, 390 and 360.
- **Media queries, not size queries on the panel.** The CSS at-rule for a size query has the
  same name as a Tailwind utility, so writing one in a component put that utility in the
  shared stylesheet (found by `cmp` on 24 Nov 2026). The breakpoints (36rem for the storage
  flow, 40rem for the graph's larger text) are where the panel is wide enough at every
  layout. Do not name the at-rule in a comment either.
- **Each step's text and its picture carry the site's fade-up reveal, and nothing inside
  them does**, so nothing animates twice. A CSS entrance played at load would run unseen
  below the fold.
- **The first view holds "What I did" on a 1280 x 800 screen**: four rows, ending at 727px. A
  fifth pushed it to 810px. On a 390 x 844 phone they end at 698px.
- **Keyboard changes to a `:has()`-driven radio show on the next frame.** A probe that reads
  computed style straight after a key press sees the old state, on the agent cards; wait a
  frame before reading.
- **Content in a closed `<details>` keeps the previous theme's colours in `getComputedStyle`**
  until it opens (Chrome does not restyle what it hides). A contrast probe that switches
  themes must skip it, or it reports a false failure; opened, it is right.
- **`highlights` labels are lower case** ("sensor readings"): on a showcase page they render
  inline on the team section's header, not as tiles.
- **A pixel diff of the agent page with its sections open is not deterministic.** Two
  screenshots of the same build can differ in "More agents I built", from animation timing.
  When it flags, compare computed styles instead: every element and pseudo-element, the
  properties sorted (custom properties come back in no fixed order), animation, transition,
  opacity and transform left out, and the server's port taken out of resolved URLs.

Checked 24 Nov 2026 against a build from before the change: 22 of 25 pages identical, `/` and
`/work` different only in this entry's `summary`, the carousel card the same size, and the
agent page's 7,329 elements and pseudo-elements identical in computed style with its sections
open, light and dark. `bms-platform` and `alliance-bank` are pixel-identical at 1280 and 390
in both themes. Contrast was measured in all nine themes: text at least 5.09:1, marks
(lines and arrowheads against the sheet and a room) at least 5.09:1. With motion on, a full
scroll leaves nothing hidden. Re-checked after the graph moved to step 4 and was cut down.

Cost: no JavaScript, and the shared sheet is unchanged. The work-page stylesheet went from
6,960 to 9,496 B gz; this page's HTML is 11.3 kB gz.

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

**Two cities in one trip go in one entry** (20 Aug 2026): `Taichung & Taipei, Taiwan`,
`Guangzhou & Shenzhen, China`, and since 25 Nov 2026 `Seoul & Busan, South Korea`. The timeline
plots trips, not stops — splitting them would put
two marks on the rail for one flight out and back, and both halves would carry the same dates.

The two slugs are asymmetric on purpose. `taiwan.md` keeps its name because the country is the
natural handle for a trip that stayed inside one; `guangzhou-shenzhen.md` was renamed from
`guangzhou` because `china` is not available as a handle — three separate trips went there.
Renaming was free before launch and will not be after. `seoul-busan.md` (25 Nov 2026) is named
for its cities rather than `south-korea` for the same reason: a country is a handle only until a
second trip goes there, which is exactly what took `china` away.

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
composed while nine trips wait for their photos.

`src/content/sections/travel.md` is now the essay **under** the timeline, not the page. Its
first heading ("Why the list looks like this") only makes sense in that position.

**All nine trips are Claude-scaffolded drafts and say so at the foot of each file** — eight
from 20 Aug 2026, Seoul & Busan from 25 Nov 2026. Everything in them is calendar arithmetic off
the destination and the dates — nothing about the trips themselves has been invented, which is
why the day headings have no text under them. The one real finding worth keeping: five of the
six trips whose exact days are known start on a Friday, and the sixth, Seoul & Busan, on a
Thursday. It was five out of five until that trip arrived. The essay's second paragraph is built
on that, so re-check it when the three month-precision trips get their days.

### Adding a trip (25 Nov 2026)

Done once so far, for Seoul & Busan. Three edits and no code:

1. **`src/content/trips/<id>.md`.** Copy a sibling. Quote the dates, and generate the day
   headings from them.
2. **Its footprint:** `node scripts/build-footprint.mjs <urban-areas.geojson> <id> <lon,lat> …`,
   one point per city, as `public/globe/README.md` describes. Without it the trip is on the
   timeline and on neither earth — the engine skips a trip it has no footprint for.
3. **`src/content/sections/travel.md`.** Its summary counts the trips ("Nine trips since
   2023"), and the essay's Friday paragraph counts their weekdays. Both are written by hand.

And its photo, when there is one: `src/assets/travel/<id>/cover.jpg`, with nothing to edit. The
README there says the rest.

Nothing else a visitor reads counts the trips. The original earth's intro and legend stopped
saying "eight" the same day, and the showcase's photos, tour and timeline read the
collection. Where this file or a code comment says eight trips, it was true when written.

Verified in Chrome against the production build, 12 checks: the trip page, its dates and country
and its six day headings, Thu 5 Nov to Tue 10 Nov; first on the timeline; the essay's "five of
the six"; a card on the original earth, whose intro no longer counts; nine tiles on the
showcase with its own first, opening its panel; the accent footprint in two places; the tour
ending on it; the About summary; a clean console. The showcase suites were re-run with no
regression (28 of 28, 18 of 18), and the original section is unchanged at 12 of 13, the same
Colour-view threshold failure as before.

## Additional guidelines

See [AGENTS.md](AGENTS.md) for coding style, naming, and commit/PR conventions. Note that its
testing section describes a setup that does not exist (no tests, no `setupTests.js`) — treat
that as aspirational until §12 of the rebuild plan is decided.
