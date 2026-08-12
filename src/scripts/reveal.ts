import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll animation, in one place.
 *
 * Markup opts in declaratively:
 *
 *   <section data-reveal="fade-up">…</section>
 *   <h1 data-reveal="split-chars">…</h1>
 *
 * Starting styles live in global.css, gated behind `html.js` (set by an inline
 * script in BaseLayout before first paint). Two consequences worth knowing:
 * content is never hidden unless JS is actually running, and it is never
 * revealed with a visible flash.
 *
 * Supported values: fade, fade-up, slide-left, slide-right, split-chars,
 * split-lines. Anything else is ignored and stays visible.
 */

const REVEAL_TWEENS: Record<string, gsap.TweenVars> = {
  fade: { opacity: 1 },
  "fade-up": { opacity: 1, y: 0 },
  "slide-left": { opacity: 1, x: 0 },
  "slide-right": { opacity: 1, x: 0 },
};

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

if (prefersReducedMotion) {
  // Nothing will animate, so release anything global.css hid behind `html.js`.
  // Without this the reduced-motion path would leave elements at opacity 0.
  document.documentElement.classList.add("reveal-off");
} else {
  revealOnScroll();
  void splitTextReveals();
  heroParallax();
}

/** Generic entrance reveals, driven by the data-reveal attribute. */
function revealOnScroll(): void {
  gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
    const tween = REVEAL_TWEENS[el.dataset.reveal ?? ""];
    if (!tween) return; // split-* and unknown values handled elsewhere

    gsap.to(el, {
      ...tween,
      duration: 0.8,
      ease: "power2.out",
      overwrite: "auto",
      // Compositor layers are not free — drop the hint once the tween is done.
      onComplete: () => gsap.set(el, { willChange: "auto" }),
      scrollTrigger: { trigger: el, start: "top 85%", once: true },
    });
  });
}

/**
 * Per-character and per-line text reveals.
 *
 * SplitText is loaded dynamically so its weight is only paid on pages that
 * actually use it. It became free in April 2025 along with the rest of the GSAP
 * plugin suite, so no licence key is involved.
 */
async function splitTextReveals(): Promise<void> {
  const targets = gsap.utils.toArray<HTMLElement>(
    '[data-reveal="split-chars"], [data-reveal="split-lines"]',
  );
  if (targets.length === 0) return;

  try {
    const { SplitText } = await import("gsap/SplitText");
    gsap.registerPlugin(SplitText);

    targets.forEach((el) => {
      const byLine = el.dataset.reveal === "split-lines";
      const split = new SplitText(el, {
        type: byLine ? "lines" : "chars",
        linesClass: "reveal-line",
      });

      // The container becomes visible; the pieces inside are what animate.
      gsap.set(el, { opacity: 1 });

      gsap.from(byLine ? split.lines : split.chars, {
        yPercent: 100,
        opacity: 0,
        duration: byLine ? 0.8 : 0.6,
        ease: "power3.out",
        stagger: byLine ? 0.12 : 0.02,
        scrollTrigger: { trigger: el, start: "top 85%", once: true },
      });
    });
  } catch {
    // If the chunk fails to load, show the text rather than stranding it at
    // opacity 0. Same reasoning as the html.js gate in global.css.
    gsap.set(targets, { opacity: 1, willChange: "auto" });
  }
}

/**
 * Hero parallax.
 *
 * Rewritten from the legacy implementation, which animated `background-position`
 * from a hand-rolled rAF loop. Two separate problems with that approach:
 *
 *   1. background-position is not GPU-composited, so the browser repainted the
 *      element on every scroll frame.
 *   2. It was double-damped — Lenis smoothed the scroll, then the loop applied
 *      its own 0.08 lerp on top. Two lag filters in series is what made it feel
 *      mushy and disconnected from the wheel.
 *
 * The fix: transform a real <img> inside an overflow:hidden frame (composited,
 * no repaint), and let `scrub: true` read Lenis's already-smoothed position with
 * no extra damping.
 *
 * The image drifts DOWN (+12%) while the text lifts UP (-30%). Two layers moving
 * at different rates in opposite directions is what reads as depth — a single
 * layer barely registers, which is why the legacy 80px shift felt like nothing.
 */
function heroParallax(): void {
  const hero = document.querySelector<HTMLElement>("[data-hero]");
  if (!hero) return; // not on this page

  const image = hero.querySelector<HTMLElement>("[data-hero-img]");
  const text = hero.querySelector<HTMLElement>("[data-hero-text]");

  const scrollRange = {
    trigger: hero,
    start: "top top",
    end: "bottom top",
    scrub: true, // Lenis is the only smoothing layer — do not add a second.
  } satisfies ScrollTrigger.Vars;

  if (image) {
    gsap.to(image, { yPercent: 12, ease: "none", scrollTrigger: scrollRange });
  }

  if (text) {
    gsap.to(text, {
      yPercent: -30,
      opacity: 0,
      ease: "none",
      scrollTrigger: scrollRange,
    });
  }
}
