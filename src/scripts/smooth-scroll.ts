import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Smooth scrolling, wired to GSAP.
 *
 * Three things here are deliberate and easy to get wrong — see
 * CLAUDE.md § Animation rules before changing any of them.
 *
 * 1. `lenis.on('scroll', ScrollTrigger.update)` — without this, ScrollTrigger
 *    never learns that Lenis moved the page and every scrubbed animation
 *    silently stops updating.
 *
 * 2. One rAF loop, driven by `gsap.ticker`. The legacy SmoothScroll.jsx ran its
 *    own requestAnimationFrame loop alongside GSAP's, so two loops competed for
 *    the same frame.
 *
 * 3. No second smoothing layer. Lenis interpolates the scroll position; the
 *    ScrollTriggers in reveal.ts then use `scrub: true` and read that value
 *    directly. The legacy code applied an extra `damping = 0.08` lerp on top,
 *    which is what made the hero parallax feel mushy and detached from the wheel.
 */

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

if (!prefersReducedMotion) {
  const lenis = new Lenis({
    lerp: 0.16,
    smoothWheel: true,
    wheelMultiplier: 0.9,

    // Touch is intentionally left native.
    //
    // The legacy code passed `smoothTouch: true`, which is not a real Lenis
    // option and was silently ignored — so the live site has always used native
    // touch scrolling. The modern equivalent is `syncTouch`, but it is flagged
    // experimental and is known to feel worse than native momentum on iOS.
    // Not enabling it preserves today's behaviour. Revisit only with a real
    // device to test on.
  });

  lenis.on("scroll", ScrollTrigger.update);

  gsap.ticker.add((time) => {
    // gsap.ticker reports seconds; Lenis expects milliseconds.
    lenis.raf(time * 1000);
  });

  gsap.ticker.lagSmoothing(0);
}
