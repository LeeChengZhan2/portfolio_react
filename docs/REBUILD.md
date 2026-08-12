# Portfolio Rebuild — Architecture & Plan

**Status:** Phases 1–3 built on `rebuild/astro` · **Written:** 12 Aug 2026 · **Target ship:** ~22 Sep 2026

> **Build log — 12 Aug 2026.** Scaffold, static port, and content model are done. Three things
> came out differently from this plan and the plan has been corrected below, not papered over:
>
> 1. **Copy buttons are no longer a React island** (§2 decision 3, §8.2). Measured cost of
>    keeping them: the React runtime on every page, because the footer is site-wide. Per-page
>    JS was 104 KB gz — worse than the CRA site. Now 49.2 KB gz. The carousel is still the
>    React island.
> 2. **`/about` sub-pages are separate routes**, per your decision — `/about/personal`,
>    `/about/travel`, `/about/photography`, `/about/investing` — not anchors on one page.
> 3. **Tailwind v4 needs `@reference`** in every scoped `<style>` block using `@apply`.
>    Not in the original plan; it is a hard build error, not a warning.

The long-form reference. For the short agent-facing summary see [`../CLAUDE.md`](../CLAUDE.md).

---

## 1. Why rebuild

The current site is a draft built on Create React App. Everything in it still *works*, but
the scaffold underneath it is dead: the React team [formally deprecated CRA on 14 Feb
2025](https://react.dev/blog/2025/02/14/sunsetting-create-react-app) and it has no active
maintainers. The production build prints the deprecation notice itself.

Secondary drivers:

- The site is five static sections and ships ~102 KB of JavaScript to render text.
- Seven header dropdown links point at anchors that were never built (`#about-intro`,
  `#portfolio-photography`, …). Those were aspirational — this rebuild makes them real routes.
- Project content is hardcoded as 364 lines of copy-pasted JSX, two cards of which say
  "Coming soon."

**Non-goal:** this is not a visual redesign brief. It is the structural foundation that a
redesign sits on.

---

## 2. Decisions locked

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Language | **TypeScript** | Astro tooling assumes it; content-collection schemas are near-useless without it. Static typing is familiar territory from Java. |
| 2 | Page model | **Multi-page** — home + `/about` + `/work/[slug]` | Detail pages for photography, investing, personal, etc. Resurrects the dead dropdown. Each project gets a shareable URL. |
| 3 | Carousel | **Keep the behaviour, replace the implementation** — GSAP `horizontalLoop()` instead of Embla | Same seamless loop and same smooth slow-on-hover, in ~20 lines instead of 115. Drops two dependencies. See §7.2. |
| 4 | Animation | **One `reveal.ts`, data-attribute driven** + rebuilt hero parallax | Sections stay declarative; animation logic stays in one file. Hero parallax is being rewritten — see §7.1. |

### Learning goal

A stated purpose of this project is learning frontend architecture outside of work.
That shapes two calls that a pure-efficiency read would make differently:

- The carousel stays a **React island** rather than a plain script, so the hydration model
  gets exercised on something real.
- The copy-to-clipboard buttons also stay React, though a `<script>` would be cheaper.

Both are knowing trades, recorded here so they don't get "optimised away" later by mistake.

---

## 3. Target stack

| Layer | Package | Version | Why this |
|-------|---------|---------|----------|
| Framework | `astro` | 7.2.0 | Zero JS by default; the site is ~85% static. Released 22 Jun 2026 with a Rust compiler and Vite 8. |
| Build | `vite` | 8.2.1 | Comes with Astro. Rolldown (Rust) replaced the old esbuild+Rollup split — one consistent pipeline, much faster builds. |
| Islands | `react` + `react-dom` | 19.2.8 | Already known, and React 19's compiler auto-memoises so the carousel gets simpler. |
| Integration | `@astrojs/react` | 6.0.2 | Wires React into Astro. |
| Styling | `tailwindcss` + `@tailwindcss/vite` | 4.3.3 | CSS-first `@theme` config, Oxide engine. Keeps the custom palette. |
| Animation | `gsap` | 3.15.0 | **100% free since Apr 2025**, all plugins. ScrollTrigger + SplitText + Draggable. |
| Animation (React) | `@gsap/react` | 2.1.2 | `useGSAP()` — handles cleanup correctly inside islands. |
| Smooth scroll | `lenis` | 1.3.26 | Still the standard. Already in use and working. |
| SEO | `@astrojs/sitemap` | 3.7.3 | Sitemap generation. Cheap win the current site lacks. |

### Why Astro and not the alternatives

**Not Next.js 16** — it is a full-stack framework. Server runtime, route handlers, middleware,
caching layers: none of which a static portfolio uses. Static export is its second-class path.
Revisit only if a CMS-backed blog or contact form appears.

**Not plain Vite + React** — the lowest-effort migration (hours, not days) and a legitimate
choice, but it stays a client-rendered SPA. No pre-rendered HTML means the SEO and
social-preview story stays as weak as it is today, and a portfolio is a document people link to.

**Astro** wins because the workload is content, not application. It also keeps the existing
React components usable as islands, so nothing already written is thrown away.

---

## 4. Dependency changes

### Remove

| Package | Reason |
|---------|--------|
| `react-scripts` | Dead. The reason for the rebuild. |
| `react-router-dom` | Zero imports. Astro routes by file path. |
| `@headlessui/react` | Zero imports, despite a comment in `Header.css` claiming otherwise. |
| `framer-motion` | Duplicate of `motion`; both installed. GSAP takes over anyway. |
| `motion` | Superseded by GSAP for this project. |
| `embla-carousel-react` | Replaced by GSAP `horizontalLoop()`. |
| `embla-carousel-auto-scroll` | Was installed and never imported. |
| `web-vitals` + `reportWebVitals.js` | `reportWebVitals()` is called with no argument, so it no-ops. Dead code. |
| `gh-pages` | Only needed if staying on GitHub Pages — see §9. |

### Add

`astro`, `@astrojs/react`, `@astrojs/sitemap`, `@tailwindcss/vite`, `gsap`, `@gsap/react`,
`typescript`, `@types/react`, `@types/react-dom`

### Keep

`react`, `react-dom` (upgrade to 19.2.8), `lenis` (upgrade to 1.3.26), `tailwindcss`
(upgrade to 4.3.3)

**Net: 9 removed, 3 kept, 9 added.** Bundle shipped to the visitor drops sharply because
most of what remains runs at build time only.

---

## 5. Architecture

### The model

Astro renders everything to static HTML **at build time, on your machine**. Components marked
with a `client:*` directive additionally ship a small JS bundle and "hydrate" in the browser —
these are *islands*. Everything else ships zero JavaScript.

```
Build (your machine)              Browser (visitor)
─────────────────────             ──────────────────────────────
run .astro frontmatter      →     complete HTML arrives → paints immediately
render React → HTML strings           ╰┈┈> island JS loads on scroll → carousel live
emit island chunks                         (non-blocking)
```

The practical consequence: **first paint no longer waits on JavaScript.**

### Component mapping

| Today | Needs runtime JS? | Becomes | Directive |
|-------|-------------------|---------|-----------|
| `Header.jsx` | No | `Header.astro` | — |
| `Home.jsx` | No | `Hero.astro` | — |
| `About.jsx` | No | `AboutSection.astro` | — |
| `Portfolio.jsx` | **Yes** | `Carousel.tsx` | `client:visible` |
| `Footer.jsx` (copy buttons) | **Yes** | `CopyButton.tsx` | `client:visible` |
| `Footer.jsx` (rest) | No | `Footer.astro` | — |
| `SmoothScroll.jsx` | Yes, but page-wide | `scripts/smooth-scroll.ts` | — |

Four of seven ship no JavaScript at all. The header dropdowns in particular are pure CSS
`group-hover` — they are already static, just written as React.

### Directive reference

| Directive | Hydrates when | Use for |
|-----------|---------------|---------|
| `client:load` | Immediately | Above-the-fold controls |
| `client:idle` | On `requestIdleCallback` | Visible but not urgent |
| `client:visible` | On scroll into viewport | **Default here** — both islands are below the fold |
| `client:media` | When a media query matches | Future mobile drawer nav |
| `client:only` | Client only, no build render | Components that need `window` at render |

---

## 6. Directory structure

Components are split by **rendering cost**, not by feature, so the JavaScript budget is
visible in the file tree. Adding a component means choosing a folder, which forces the
question "does this need JS?" every time.

```
portfolio/
├── astro.config.mjs
├── tsconfig.json
├── package.json
│
├── public/                        # copied verbatim, never processed
│   ├── favicon.svg
│   ├── images/
│   └── documents/
│       └── lee-cheng-zhan-cv.pdf  # replaces the 2023 .docx
│
└── src/
    ├── pages/                     # REQUIRED — file path IS the route
    │   ├── index.astro            #  →  /
    │   ├── about.astro            #  →  /about        (+ #intro #work #hobby #travel)
    │   └── work/
    │       ├── index.astro        #  →  /work
    │       └── [slug].astro       #  →  /work/school-fyp
    │
    ├── layouts/
    │   └── BaseLayout.astro       # html shell, meta/OG tags, Lenis + GSAP init
    │
    ├── components/
    │   ├── astro/                 # zero JS — the default
    │   │   ├── Header.astro
    │   │   ├── Hero.astro
    │   │   ├── AboutSection.astro
    │   │   ├── WorkCard.astro
    │   │   └── Footer.astro
    │   └── react/                 # islands ONLY — every file here costs
    │       ├── Carousel.tsx
    │       └── CopyButton.tsx
    │
    ├── content/
    │   ├── config.ts              # zod schemas
    │   └── work/
    │       ├── school-fyp.md
    │       ├── bms-drivers.md
    │       ├── investing.md
    │       ├── photography.md
    │       └── personal.md
    │
    ├── scripts/                   # plain TS, no framework
    │   ├── smooth-scroll.ts       # Lenis + ScrollTrigger wiring
    │   └── reveal.ts              # data-attribute scroll animations
    │
    └── styles/
        └── global.css             # Tailwind v4 @theme block
```

---

## 7. Routes and content model

### Routes

| Route | Source | Notes |
|-------|--------|-------|
| `/` | `pages/index.astro` | Hero, about summary, featured work carousel, contact |
| `/about` | `pages/about.astro` | Anchors `#intro`, `#work`, `#hobby`, `#travel` — makes the About dropdown work |
| `/work` | `pages/work/index.astro` | Grid of everything in the `work` collection |
| `/work/[slug]` | `pages/work/[slug].astro` | One page per project, generated from markdown |

This resolves the dead dropdown two ways: About sub-items become real anchors on one page;
Portfolio sub-items become real pages.

### Content schema

```ts
// src/content/config.ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: z.object({
    title:    z.string(),
    summary:  z.string().max(180),
    category: z.enum(['school', 'investing', 'photography', 'personal', 'engineering']),
    role:     z.string(),
    stack:    z.array(z.string()).default([]),
    year:     z.number(),
    featured: z.boolean().default(false),   // controls carousel inclusion
    repo:     z.string().url().optional(),
    doc:      z.string().optional(),        // e.g. the FYP PDF
  }),
});

export const collections = { work };
```

Adding a project becomes writing a markdown file. The schema validates at build time — omit
`year` and the build fails with a clear error rather than rendering a broken card. Same idea
as Bean Validation, applied to content.

**"Coming soon" stops being possible: a project either has a file or it doesn't exist.**

---

## 8. Animation architecture

### 8.1 Hero parallax — the rewrite

**What's wrong now.** `Home.css` animates `background-position` on `.content-container`,
driven by a `requestAnimationFrame` loop in `SmoothScroll.jsx` writing a CSS variable.
Two independent problems:

1. **`background-position` is not GPU-composited.** The browser repaints the element on
   every scroll frame. [Chrome's guidance is explicit](https://developer.chrome.com/blog/performant-parallaxing):
   use transforms, don't animate background position from scroll events.
2. **The motion is double-damped.** Lenis smooths the scroll, and then `SmoothScroll.jsx`
   applies its own `damping = 0.08` lerp on top. Two lag filters in series is what makes it
   feel mushy and disconnected from the wheel.

**The fix.** Move the image into a real element and transform it, with a single smoothing layer.

```astro
<!-- components/astro/Hero.astro -->
<section class="hero" data-hero>
  <div class="hero__frame">
    <img
      src="/images/home-landscape.webp"
      alt=""
      class="hero__img"
      data-hero-img
      fetchpriority="high"
    />
  </div>
  <div class="hero__text" data-hero-text>
    <p class="occupation">Software Engineer</p>
    <h1>Hi, I'm Lee Cheng Zhan from Malaysia</h1>
  </div>
</section>

<style>
  .hero        { position: relative; height: 100svh; }
  .hero__frame { position: absolute; inset: 0; overflow: hidden; border-radius: 0.75rem; }
  .hero__img   {
    position: absolute; inset: -12% 0;      /* overscan so the shift never reveals an edge */
    width: 100%; height: 124%;
    object-fit: cover;
    will-change: transform;
  }
</style>
```

```ts
// scripts/reveal.ts (hero section)
gsap.to('[data-hero-img]', {
  yPercent: 12,                    // image drifts down as you scroll past
  ease: 'none',
  scrollTrigger: {
    trigger: '[data-hero]',
    start: 'top top',
    end: 'bottom top',
    scrub: true,                   // ← Lenis already smooths; do NOT add more
  },
});

// Text moves faster than the image — this is what sells depth
gsap.to('[data-hero-text]', {
  yPercent: -30,
  opacity: 0,
  ease: 'none',
  scrollTrigger: { trigger: '[data-hero]', start: 'top top', end: 'bottom top', scrub: true },
});
```

Three changes worth understanding:

- **`transform` instead of `background-position`** — GPU-composited, no repaint.
- **`scrub: true`, not extra damping** — Lenis is the only smoothing layer. If it still feels
  too tight, use `scrub: 0.5`; do not reintroduce a second lerp.
- **Two layers at different rates** — the image at `+12%` and text at `-30%` moving in
  opposite directions is what reads as parallax. One layer alone barely registers, which is
  part of why the current 80px shift feels like nothing.

Optional additions once the base works: a `scale: 1.08 → 1` on load, and a SplitText
character reveal on the `<h1>`.

### 8.2 Carousel — same animation, 20 lines

The current implementation swaps Embla's private `internalEngine().scrollBody` to get
smooth speed easing on hover. It works, but it depends on an API Embla documents as unstable.

The official `embla-carousel-auto-scroll` plugin **cannot replace it directly** — it offers
`stopOnMouseEnter` (a hard stop), not a smooth slow-down. That nuance is worth keeping.

GSAP's `horizontalLoop()` helper gives exactly the current behaviour, because a timeline's
`timeScale()` can be tweened:

```tsx
// components/react/Carousel.tsx
import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { horizontalLoop } from '../../scripts/horizontal-loop';

export default function Carousel({ items }: { items: WorkItem[] }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const loop = horizontalLoop('.card', { repeat: -1, speed: 1, paddingRight: 20 });
    const slow = (to: number) => gsap.to(loop, { timeScale: to, duration: 0.6, ease: 'power2.out' });

    root.current!.addEventListener('mouseenter', () => slow(0.3));
    root.current!.addEventListener('mouseleave', () => slow(1));
  }, { scope: root });

  return (
    <div ref={root} className="carousel">
      {items.map((item) => <article key={item.slug} className="card">…</article>)}
    </div>
  );
}
```

`horizontalLoop` is an official GSAP helper — copy it into `scripts/horizontal-loop.ts` from
the [GreenSock CodePen](https://codepen.io/GreenSock/pen/PojYwPp). It supports `draggable: true`
via GSAP Draggable, which is also free now.

Net: 115 lines → ~20, two dependencies dropped, no private APIs, identical feel.

### 8.3 Scroll reveals — one file, data attributes

```html
<section data-reveal="fade-up">…</section>
<h2 data-reveal="split-chars">Career Journey</h2>
```

`reveal.ts` queries `[data-reveal]` on load and attaches the matching ScrollTrigger.
Sections stay declarative; all animation logic lives in one file.

### 8.4 Lenis + ScrollTrigger wiring

Non-obvious and easy to get wrong — ScrollTrigger must be told when Lenis scrolls:

```ts
// scripts/smooth-scroll.ts
const lenis = new Lenis({ lerp: 0.16, syncTouch: true });   // NOT smoothTouch — that option
                                                            // doesn't exist and is ignored
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
```

One rAF loop for both, instead of the two competing loops in the current code.

### 8.5 Reduced motion

Currently only the Lenis parallax checks `prefers-reduced-motion`; every Framer Motion
entrance and the auto-scrolling carousel ignore it. A continuously moving element with no
pause control is a WCAG 2.2.2 failure. In the rebuild, `reveal.ts` and the carousel both
check it and no-op.

---

## 9. Hosting

Move to **Cloudflare Pages**. Unlimited bandwidth on the free tier (against Vercel's 100 GB),
faster CDN, no non-commercial restriction.

The practical benefit beyond speed: GitHub Pages serves from `/portfolio_react/`, which is
what broke the two download links (they use bare `/assets/documents/…` while every image
correctly uses `process.env.PUBLIC_URL`). Serving from a domain root removes that whole class
of bug. If you keep a custom domain later, this is where it goes.

---

## 10. Schedule

Assumes ~2 weekday evenings plus one weekend session per week. **Content writing is the long
pole** — it runs in parallel from week 2 and is the most likely thing to slip.

| Phase | Window | Work | Done when |
|-------|--------|------|-----------|
| **0 · Triage** | 12–13 Aug | Fix the two 404 download links and the default `<title>`/meta on the live site. Skip the dropdowns — they become real routes. | Live site has no broken links |
| **1 · Scaffold** | 14–18 Aug | `npm create astro`, TypeScript strict, `astro add react`, Tailwind v4 via `@tailwindcss/vite`, port the palette into `@theme`. Deploy an empty site to Cloudflare. | CI green, blank site live |
| **2 · Static port** | 19–25 Aug | `Header`, `Hero`, `AboutSection`, `Footer` → `.astro`. No animation yet. Verify zero JS in the network tab. | Home page renders, 0 KB JS |
| **3 · Content model** | 26 Aug–1 Sep | `content/config.ts` schema, migrate 5 projects to markdown, build `/work` and `/work/[slug]`, wire `/about` anchors. | All dropdown links resolve |
| **4 · Animation** | 2–8 Sep | Lenis + ScrollTrigger wiring, hero parallax rewrite (§8.1), `reveal.ts`, carousel island (§8.2). | Parallax feels right on a real phone |
| **5 · Content** | 2–15 Sep | Write the actual case studies. BMS drivers and FYP first — those carry the most weight. New PDF CV. | No placeholder text anywhere |
| **6 · Polish** | 16–22 Sep | Real meta/OG tags, favicon set, sitemap, `prefers-reduced-motion`, keyboard nav, Lighthouse pass, mobile nav. | Lighthouse ≥95 on mobile |

**Ship target: 22 Sep 2026.** Phase 5 is allowed to slip; phases 0–4 are not, because they
block each other.

---

## 11. Also worth adding

Ordered by value per hour, not by difficulty.

**High value**

- **Real meta and OG tags.** Currently `<title>React App</title>` and
  `"Web site created using create-react-app"` — that is what Google and every link preview
  show. A generated OG image per project page is a genuine differentiator.
- **Fix the manifest and icons.** `manifest.json` still says "Create React App Sample" and
  references `favicon.ico`, `logo192.png`, `logo512.png` — none of which exist in `public/`.
- **A real mobile nav.** `Header.css` has zero breakpoints and the dropdowns are hover-only.
  On a phone there is no hover; tapping the parent just navigates away.
- **Fix About's responsive layout.** `about-flex-container` is a hard two-column flex at every
  width with a `70vh` sticky image. On a phone that is two ~160px columns.

**Medium value**

- **Accessible copy buttons.** Currently three `<img onClick>` — not focusable, not keyboard
  operable. `CopyButton.tsx` should be a real `<button>`, and should handle the case where
  `navigator.clipboard` is unavailable (insecure origin) instead of showing "Copied!" regardless.
- **Heading hierarchy.** Two `<h1>`s today (`Home` and `About`), and sibling portfolio cards
  mix `h2`/`h3` arbitrarily. Content collections fix this by construction.
- **Derive the age.** `About.jsx` hardcodes "currently 25 years old" next to "born in 2000."
  The footer already computes the year dynamically; do the same here.

**Nice to have**

- **One WebGL moment.** 29 of 47 Awwwards Site-of-the-Day winners in Q1 2026 used Three.js.
  React Three Fiber 9.7 makes it approachable. Pick *one* set-piece, not a WebGL site — a heavy
  3D scene on a mid-range Android undoes everything Astro bought.
- **View Transitions** between `/work` and `/work/[slug]`. Astro supports this natively.
- **A short case-study template.** Problem → constraints → approach → what you'd change.
  The BMS driver work (HVAC, lighting, hardware protocol integration) is genuinely uncommon
  material that most developer portfolios cannot show. It is the strongest asset here.

---

## 12. Still open

- **Design direction.** Still open, deliberately. This document is structural; typography,
  colour, and layout are unresolved. The existing palette (`kleinblue #002FA7`,
  `schenbrunnyellow #F7E14D`, `tiffanyblue`, `prusianblue`, `bluenova`, `lavendarblue`) is
  carried forward in `src/styles/global.css` **as a default, not a decision**. Currently only
  `kleinblue` is actually used — the other five are defined and unreferenced, waiting on this.

- **Domain: `leechengzhan` — TLD not chosen, domain not registered.** `astro.config.mjs` sets
  `site: 'https://leechengzhan.com'`, which canonical and OG tags are built from, so it must be
  correct before any public deploy or search engines will follow canonicals into a dead host.
  Two actions on you:
  1. Check availability and pick a TLD. `.com` is the safe default; `.dev` reads well for an
     engineer and is usually available. Register it.
  2. Tell me the final domain and I will update `site` — it is a one-line change.

- **`/about` split — provisional by your own framing.** Four separate routes now exist
  (`personal`, `travel`, `photography`, `investing`). `travel` and `investing` are `draft: true`
  and build in dev only, because neither has content. If they stay thin, merging is cheap:
  delete the markdown file and fold its prose into `personal.md`. Nothing in the code hardcodes
  four — the nav, the home cards, and the routes all derive from whatever files exist.

- **Testing — resolved: no framework.** Per your call, tests only where they earn their place.
  TypeScript plus the zod content schemas cover shape errors at build time, and
  `scripts/check-links.mjs` (`npm run links`) covers the bug class that actually bit this
  project: 284 internal links, every href and fragment verified against `dist/`. A component
  test suite would mostly re-assert that Astro renders HTML. **`AGENTS.md` still prescribes
  Jest and React Testing Library and needs updating** — it now describes a stack that is gone.

- **Hero `scale` on load.** The plan (§8.1) included a `scale: 1.08 → 1` settle alongside the
  parallax. It is not in `reveal.ts` — worth trying once you see the current version on a real
  phone, since it may be one effect too many.
