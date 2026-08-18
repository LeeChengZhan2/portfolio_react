import gsap from "gsap";

/**
 * Seamless horizontal loop, ported from the official GreenSock helper
 * (https://codepen.io/GreenSock/pen/PojYwPp).
 *
 * Every item gets its own `xPercent` tween on a shared timeline: it travels
 * left until it clears the left edge, then jumps to the far right and travels
 * back to where it started. Because every item covers the same total distance,
 * the timeline duration is identical for all of them and `repeat: -1` produces
 * a loop with no seam — no cloning, no scroll position to reset.
 *
 * The reason this replaces Embla: a timeline's `timeScale()` can be tweened, so
 * "slow down smoothly on hover" is one `gsap.to()` instead of swapping Embla's
 * private `internalEngine().scrollBody`. See docs/REBUILD.md §8.2.
 *
 * ## Deliberately trimmed
 *
 * The upstream helper also carries `center`, `snap`-to-index navigation
 * (`toIndex`/`closestIndex`/`next`/`previous`), `onChange`, `reversed`, and a
 * `draggable: true` branch. None of that is used here, and the draggable branch
 * would pull Draggable + InertiaPlugin (~15 KB gz) into the island for a feature
 * this carousel does not offer. The looping algorithm itself is unchanged —
 * restore any of those from the CodePen above if they are ever needed.
 */

export interface HorizontalLoopConfig {
  /** Speed multiplier. `1` ≈ 100 px/s, so `1.2` ≈ 120 px/s. */
  speed?: number;
  /** Timeline repeat count. `-1` loops forever. */
  repeat?: number;
  paused?: boolean;
  /** Gap held after the last item before the first wraps back in. */
  paddingRight?: number;
  /**
   * Increment that `xPercent` values are snapped to, which keeps items off
   * sub-pixel positions where text renders blurry. `false` disables snapping.
   */
  snap?: number | false;
}

/** Reads a GSAP property as a number. `getProperty` is typed `string | number`. */
function num(target: Element, property: string, unit?: string): number {
  return parseFloat(String(gsap.getProperty(target, property, unit)));
}

export function horizontalLoop(
  targets: gsap.DOMTarget,
  config: HorizontalLoopConfig = {},
): gsap.core.Timeline {
  const items = gsap.utils.toArray<HTMLElement>(targets);
  if (items.length === 0) return gsap.timeline({ paused: true });

  const {
    speed = 1,
    repeat = -1,
    paused = false,
    paddingRight = 0,
    snap: increment = 1,
  } = config;

  const snap = increment === false ? (value: number) => value : gsap.utils.snap(increment);
  const pixelsPerSecond = speed * 100;
  const container = items[0].parentNode as HTMLElement;
  const last = items.length - 1;

  // Measured in `measure()`, consumed by `build()`.
  const widths: number[] = [];
  const xPercents: number[] = [];
  let startX = 0;
  let spaceBefore = 0;
  let totalWidth = 0;

  let timeline!: gsap.core.Timeline;

  // A nested gsap.context attaches itself to any enclosing context — which is
  // what useGSAP() creates. That is how the resize listener below gets torn
  // down when the island unmounts, without the caller having to do anything.
  gsap.context(() => {
    const tl = gsap.timeline({
      repeat,
      paused,
      defaults: { ease: "none" },
      // Scrubbing backwards past zero would otherwise stall at the loop start.
      onReverseComplete: () => {
        tl.totalTime(tl.rawTime() + tl.duration() * 100);
      },
    });

    function measure(): void {
      const containerLeft = container.getBoundingClientRect().left;
      startX = items[0].offsetLeft;

      items.forEach((el, i) => {
        widths[i] = num(el, "width", "px");
        // Fold any existing `x` translation into `xPercent` so a single
        // property describes the whole horizontal offset from here on.
        xPercents[i] = snap(
          (num(el, "x", "px") / widths[i]) * 100 + Number(gsap.getProperty(el, "xPercent")),
        );
      });

      // Only the leading gap matters: it is the offset the wrap must preserve
      // so the first item reappears with the same spacing it started with.
      spaceBefore = items[0].getBoundingClientRect().left - containerLeft;

      gsap.set(items, { xPercent: (i: number) => xPercents[i] });

      totalWidth =
        items[last].offsetLeft +
        (xPercents[last] / 100) * widths[last] -
        startX +
        spaceBefore +
        items[last].offsetWidth * Number(gsap.getProperty(items[last], "scaleX")) +
        paddingRight;
    }

    function build(): void {
      tl.clear();

      items.forEach((item, i) => {
        const currentX = (xPercents[i] / 100) * widths[i];
        const distanceToStart = item.offsetLeft + currentX - startX + spaceBefore;
        const distanceToLoop =
          distanceToStart + widths[i] * Number(gsap.getProperty(item, "scaleX"));

        tl.to(
          item,
          {
            xPercent: snap(((currentX - distanceToLoop) / widths[i]) * 100),
            duration: distanceToLoop / pixelsPerSecond,
          },
          0,
        ).fromTo(
          item,
          { xPercent: snap(((currentX - distanceToLoop + totalWidth) / widths[i]) * 100) },
          {
            xPercent: xPercents[i],
            duration: (totalWidth - distanceToLoop) / pixelsPerSecond,
            immediateRender: false,
          },
          distanceToLoop / pixelsPerSecond,
        );
      });
    }

    gsap.set(items, { x: 0 });
    measure();
    build();

    let lastWidth = container.offsetWidth;
    const onResize = (): void => {
      // Mobile browsers fire resize when the URL bar shows or hides, where
      // nothing horizontal has changed. Rebuilding the timeline there is wasted
      // work and visible as a hitch, so only react to real width changes.
      if (container.offsetWidth === lastWidth) return;
      lastWidth = container.offsetWidth;

      const progress = tl.progress();
      tl.progress(0, true);
      measure();
      build();
      tl.progress(progress, true);
    };

    window.addEventListener("resize", onResize);

    // Pre-render both ends so the first lap does not hitch while GSAP builds
    // its property caches.
    tl.progress(1, true).progress(0, true);

    timeline = tl;
    return () => window.removeEventListener("resize", onResize);
  });

  return timeline;
}
