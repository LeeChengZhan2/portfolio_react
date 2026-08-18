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
all 371 internal links resolve. Legacy CRA source is parked in `legacy/` for reference during
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

The eager figure rose 49.2 → 49.7 KB on *all ten pages* because GSAP now has two importers
(the BaseLayout script and the island), so Rolldown hoists it into a shared
`_astro/gsap.*.js`. Two chunks compress slightly worse than one — that 0.5 KB is the entire
site-wide cost, and in exchange the island does not re-download GSAP.

The 60.9 KB island figure is React itself (55.9 KB runtime + 2.8 KB renderer shim) plus
2.2 KB of carousel. **It is only requested when the carousel scrolls into view, only on `/`,
and never blocks paint.** Worth being straight about the trade: as a plain script the same
behaviour would cost ~2 KB. The island is a deliberate learning-goal decision
(docs/REBUILD.md §2), not the cheap option — see "Islands" below.

Legacy CRA shipped 101.8 KB gz and it blocked first paint.

Routes live: `/`, `/about`, `/about/{personal,travel,photography,investing}`, `/work`,
`/work/{bms-drivers,java-finance,school-fyp,open-source}`, `/404` — 12 pages.
`/about/travel` and `/about/investing` flipped to `draft: false` on 18 Aug 2026 and now
build in production. Their bodies are **placeholder drafts written by Claude**, marked with a
`DRAFT` comment at the foot of each file; they carry the right shape and are not yet the
author's own material. Rewriting them is part of phase 5.

### Next up (resume here) — responsive, then content

**Now: make the site work on a phone.** In priority order.

1. **Mobile nav.** The only genuine breakage. `Header.astro` dropdowns are `group-hover` +
   `group-focus-within`, so keyboard works and touch does not — tapping "About Me" on a phone
   follows the link instead of opening the menu. Needs a real toggle below `sm`, with
   `aria-expanded`/`aria-controls`, Escape to close, and focus handling.
   **Must not become a React island** — the header is on all ten pages, and one island there
   pulls the 55.9 KB React runtime onto every one of them. Use a delegated script in
   `src/scripts/`, the way `copy.ts` and `theme.ts` do.
   `ThemeToggle.astro` now sits in `.nav-container` alongside the links, so the mobile layout
   has to place it deliberately — it should stay reachable when the nav is collapsed, not get
   swept inside the drawer. `theme.ts` is delegated on `document`, so it keeps working wherever
   the button ends up.
2. **Verify the hero parallax on a real phone.** Rewritten, type-checked, never watched
   scrolling. The carousel *has* been driven in a browser (see "Carousel" below); this has not.
   Decide the optional `scale: 1.08 → 1` (docs/REBUILD.md §12) at the same time — it may be
   one effect too many.
3. **Audit every page at 390px.** `/about/[slug]` and `/work/[slug]` have never been looked at
   on a narrow viewport. Legacy's `about-flex-container` was a hard two-column flex at every
   width; confirm that did not get ported.

**After responsive, phase 5 — content.** Every markdown body is currently a 106–212 word stub.
BMS drivers and FYP carry the most weight; write those first. Travel and investing are live
but placeholder — replace the drafted prose with real material. New PDF CV —
`public/assets/documents/` still holds only the Mar 2023 `.docx`.

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

**How a theme is chosen.** `.dark` is the only theme class — there is no `.light`, because
nothing needs one once no media query has to be overridden. The `is:inline` head script in
`BaseLayout.astro` adds it before first paint when `localStorage.theme === "dark"`, verified
with a 242-frame probe that never sampled a light frame. `src/scripts/theme.ts` handles the
click and nothing else. The toggle is `src/components/astro/ThemeToggle.astro` — a delegated
listener, **not an island**, because the header is on all ten pages.

Failure modes, both of which land on light: JS disabled (no class is ever added, and the toggle
hides itself behind the `html.js` gate), and `localStorage` throwing in private mode (the
try/catch swallows it; the toggle still works for that page view but is not remembered).

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

## Additional guidelines

See [AGENTS.md](AGENTS.md) for coding style, naming, and commit/PR conventions. Note that its
testing section describes a setup that does not exist (no tests, no `setupTests.js`) — treat
that as aspirational until §12 of the rebuild plan is decided.
