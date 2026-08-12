# CLAUDE.md

Guidance for Claude Code when working in this repository.

> **Mid-rebuild on branch `rebuild/astro`.** The Astro site in `src/` is the live project.
> The old CRA app is parked in `legacy/` as porting reference only — it has no build script
> and is wired into nothing. Full plan and rationale: [docs/REBUILD.md](docs/REBUILD.md).

## Build state

Phases 1–3 are done on branch `rebuild/astro`. The Astro site builds, type-checks clean, and
all 284 internal links resolve. Legacy CRA source is parked in `legacy/` for reference during
the port — delete it once phase 5 content is written.

```bash
npm run dev      # astro dev
npm run build    # astro check && astro build  → dist/
npm run links    # post-build internal link checker (run after build)
npm run preview  # serve dist/ locally
```

Measured: **49.2 KB gzipped JS per page** (GSAP + ScrollTrigger + Lenis in one deferred
chunk), plus a 3.2 KB lazy SplitText chunk on pages with split reveals. Legacy CRA shipped
101.8 KB gz and it blocked first paint. `_astro/client.*.js` is emitted but referenced by no
page — that is the React runtime waiting for the phase-4 carousel island; it is never
downloaded until an island exists.

Routes live: `/`, `/about`, `/about/personal`, `/about/photography`, `/work`,
`/work/{bms-drivers,java-finance,school-fyp,open-source}`, `/404`.
`/about/travel` and `/about/investing` exist as `draft: true` and so build in dev only —
they have no content yet.

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

Tailwind for layout and spacing; scoped styles for component detail. The custom palette
(`kleinblue #002FA7`, `schenbrunnyellow #F7E14D`, `tiffanyblue`, `prusianblue`, `bluenova`,
`lavendarblue`) moves from `tailwind.config.js` into a CSS `@theme` block under v4. Check it
before adding raw hex values.

## Content

Projects are a content collection (`src/content/work/*.md`) with a zod schema. Adding a project
means adding a markdown file. **Do not hardcode project cards in markup** — that is what the
rebuild is replacing, and it is why two cards currently say "Coming soon."

## Additional guidelines

See [AGENTS.md](AGENTS.md) for coding style, naming, and commit/PR conventions. Note that its
testing section describes a setup that does not exist (no tests, no `setupTests.js`) — treat
that as aspirational until §12 of the rebuild plan is decided.
