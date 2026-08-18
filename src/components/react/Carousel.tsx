import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { horizontalLoop } from "../../scripts/horizontal-loop";

/**
 * The featured-work carousel — the one React island on the site.
 *
 * It earns the React runtime because it is the only component with real
 * runtime state, and it sits on a leaf page (`/`) rather than in the header or
 * footer, so the cost is paid on one page instead of all of them. See
 * CLAUDE.md § "Revised after measurement" for why the copy buttons are not
 * an island.
 *
 * Behaviour is carried over from the legacy Embla implementation:
 * a seamless loop that eases down to a crawl on hover and back up on exit,
 * never a hard stop.
 */

export interface CarouselItem {
  slug: string;
  title: string;
  summary: string;
  year: number;
  stack: string[];
}

interface Props {
  items: CarouselItem[];
  /** Accessible name for the carousel region. */
  label: string;
}

/** Legacy ran 2.0 px per frame at 60fps — 120 px/s, which is `speed: 1.2`. */
const SPEED = 1.2;

/** Legacy dropped to 0.6 px/frame on hover: 0.3× the base speed. */
const HOVER_TIME_SCALE = 0.3;

/**
 * Legacy eased its speed toward the target with a 0.08-per-frame lerp, which
 * lands within ~5% of the target after roughly 36 frames — 0.6s at 60fps.
 * `power2.out` over 0.6s has the same shape and the same settling time.
 */
const EASE = { duration: 0.6, ease: "power2.out" } as const;

/**
 * Cards rendered once the loop is running. The wrap point has to stay outside
 * the viewport at every width, so there must be comfortably more card than
 * screen: 12 cards at ~22rem is roughly 4200px against a 2560px monitor.
 */
const MIN_CARDS = 12;

/**
 * Fades both edges so cards drift in and out instead of being cut off.
 *
 * The fade has to scale with the viewport: a flat 4rem is a sixth of a 390px
 * phone screen at each end, which washes out most of the single card that fits
 * there. `min(4rem, 8vw)` keeps the desktop look and stays proportionate down
 * to the smallest widths.
 *
 * Written out in full rather than interpolated: Tailwind extracts candidates
 * by scanning raw source text, so a class name assembled at runtime would
 * never be generated.
 */
const EDGE_FADE =
  "[mask-image:linear-gradient(to_right,transparent_0,black_min(4rem,8vw),black_calc(100%_-_min(4rem,8vw)),transparent_100%)]";

const CARD =
  "flex h-full flex-col gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-6 " +
  "transition-all duration-300 hover:-translate-y-1 hover:border-kleinblue/40 hover:shadow-lg";

export default function Carousel({ items, label }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLUListElement>(null);
  const loop = useRef<gsap.core.Timeline | null>(null);
  const hovering = useRef(false);
  const focused = useRef(false);

  /**
   * False on the server and on the first client render, so the pre-hydration
   * HTML holds exactly one set of cards. Duplicates are only meaningful to a
   * running loop — without JS, or under reduced motion, they would be repeated
   * noise in a plain scrollable row.
   */
  const [looping, setLooping] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setLooping(!query.matches);

    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const sets = looping ? Math.max(2, Math.ceil(MIN_CARDS / items.length)) : 1;

  useGSAP(
    () => {
      if (!looping || !track.current) return;

      const cards = Array.from(track.current.children) as HTMLElement[];
      if (cards.length === 0) return;

      // CSS owns the spacing; read it back so the wrap keeps the same rhythm
      // as the gaps between cards rather than duplicating the value here.
      const gap = parseFloat(getComputedStyle(track.current).columnGap) || 0;

      loop.current = horizontalLoop(cards, {
        speed: SPEED,
        repeat: -1,
        paddingRight: gap,
      });
    },
    // `looping` gates the whole effect; `items.length` changes the card count,
    // and the loop measures those cards, so both have to rebuild it.
    { scope: root, dependencies: [looping, items.length] },
  );

  /**
   * Tween the timeline's `timeScale` rather than setting it. This is the whole
   * reason GSAP replaced Embla: the speed change is itself an animation, so
   * hover eases in instead of snapping.
   */
  function settle(): void {
    const timeline = loop.current;
    if (!timeline) return;

    const target = focused.current ? 0 : hovering.current ? HOVER_TIME_SCALE : 1;
    gsap.to(timeline, { timeScale: target, overwrite: true, ...EASE });
  }

  function handlePointerEnter(event: PointerEvent<HTMLDivElement>): void {
    // Touch fires pointerenter on tap and never a matching pointerleave, which
    // would strand the carousel at the slow speed. Hover is a mouse idea.
    if (event.pointerType !== "mouse") return;
    hovering.current = true;
    settle();
  }

  function handlePointerLeave(event: PointerEvent<HTMLDivElement>): void {
    if (event.pointerType !== "mouse") return;
    hovering.current = false;
    settle();
  }

  // A keyboard user cannot follow a card that is sliding away from them, so
  // focus stops the loop outright instead of merely slowing it. React's
  // onFocus/onBlur delegate to focusin/focusout, so these fire for the links.
  function handleFocus(): void {
    focused.current = true;
    settle();
  }

  function handleBlur(): void {
    focused.current = false;
    settle();
  }

  return (
    <div
      ref={root}
      role="region"
      aria-label={label}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      // Before the loop starts — no JS, reduced motion, or pre-hydration — the
      // row stays natively scrollable so every card is still reachable.
      // `py-4` keeps the cards' hover shadow out of the clip.
      className={`relative w-full py-4 ${
        looping ? `overflow-hidden ${EDGE_FADE}` : "overflow-x-auto"
      }`}
    >
      <ul className="m-0 flex list-none items-stretch gap-5 p-0" ref={track}>
        {Array.from({ length: sets }, (_, set) => set).flatMap((set) =>
          items.map((item) => {
            // Copies exist only to fill the loop. Hiding them from assistive
            // tech keeps the list readable as three projects, not twelve.
            const isCopy = set > 0;

            return (
              <li
                key={`${set}-${item.slug}`}
                className="w-[clamp(16rem,80vw,22rem)] flex-none"
                aria-hidden={isCopy || undefined}
              >
                <a href={`/work/${item.slug}`} className={CARD} tabIndex={isCopy ? -1 : undefined}>
                  <p className="font-mono text-xs text-gray-500">{item.year}</p>
                  <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-600">{item.summary}</p>

                  {item.stack.length > 0 && (
                    <ul className="mt-auto flex list-none flex-wrap gap-1.5 p-0 pt-3">
                      {item.stack.map((tech) => (
                        <li
                          key={tech}
                          className="rounded bg-gray-100 px-2 py-0.5 font-mono text-[0.7rem] text-gray-600"
                        >
                          {tech}
                        </li>
                      ))}
                    </ul>
                  )}
                </a>
              </li>
            );
          }),
        )}
      </ul>
    </div>
  );
}
