/**
 * Layout toggle for the /about/travel timeline.
 *
 * Two views over identical markup: `gallery` (default — one wide photo per
 * trip, caption underneath) and `compact` (thumbnail left, text right, a
 * hairline between entries). Nothing is re-rendered; the only thing that
 * changes is a class on <html>, and CSS does the rest. That is why this file
 * is ~40 lines rather than a component that knows how to draw a trip twice.
 *
 * The class goes on <html>, not on the list, so the inline head script on the
 * travel page can set it before first paint. A stored `compact` preference
 * applied after paint would show the gallery and then collapse it.
 *
 * A delegated listener rather than a React island — same reasoning as theme.ts
 * and copy.ts. This one is on a single leaf page, so an island would be
 * *allowed* by the rule in CLAUDE.md; it would still be 55.9 KB of React to
 * toggle one class. See CLAUDE.md § Islands.
 */

import { ScrollTrigger } from "gsap/ScrollTrigger";

const STORAGE_KEY = "trips-view";
const CLASS = "trips-compact";

const root = document.documentElement;

function isCompact(): boolean {
  return root.classList.contains(CLASS);
}

/** Marks the button for the view currently showing. */
function syncButtons(compact: boolean): void {
  const current = compact ? "compact" : "gallery";
  for (const button of document.querySelectorAll<HTMLElement>("[data-trips-view]")) {
    button.setAttribute("aria-pressed", String(button.dataset.tripsView === current));
  }
}

// The markup ships gallery as the pressed one, because a static build cannot
// know what the visitor stored. Correct it before any interaction.
syncButtons(isCompact());

document.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-trips-view]");
  if (!button) return;

  const compact = button.dataset.tripsView === "compact";
  root.classList.toggle(CLASS, compact);
  syncButtons(compact);

  // Not optional. Switching views changes the page height by thousands of
  // pixels (6657px → 3878px, measured), and every ScrollTrigger from reveal.ts
  // is still holding the start position it computed against the old layout.
  // Without this, entries below the fold are stranded at opacity 0 — and the
  // last one never appears at all, because its trigger now sits past the bottom
  // of the shortened page.
  //
  // rAF first so the browser has applied the new layout before ScrollTrigger
  // measures it. Triggers that already fired are `once: true` and have killed
  // themselves, so refreshing cannot re-hide anything.
  requestAnimationFrame(() => ScrollTrigger.refresh());

  try {
    localStorage.setItem(STORAGE_KEY, compact ? "compact" : "gallery");
  } catch {
    // Private browsing can refuse writes. The toggle still works for this page
    // view; it just will not be remembered on the next one.
  }
});
