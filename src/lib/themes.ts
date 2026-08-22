/**
 * The light themes offered by the picker in the header.
 *
 * This file holds NO colour values, on purpose. Every palette lives in exactly
 * one place — the `.theme-*` blocks in src/styles/global.css — and both the
 * page and the picker's swatches read it from there through the same utilities.
 * A second copy of the hexes here would be a second source of truth, and the
 * swatch that lies about its theme is worse than no swatch.
 *
 * Adding a theme means two edits and only two: a `.theme-<id>` block in
 * global.css, and an entry below whose `id` matches it.
 *
 * Dark is deliberately NOT in this list. It is a separate axis with its own
 * control (the moon in the header): a light choice is remembered underneath
 * dark and comes back when dark is switched off, which is only possible while
 * the two are stored separately.
 */

export interface LightTheme {
  /** Matches the `.theme-<id>` class in global.css. `classic` is the default
   *  and has no class — the base `@theme static` values ARE classic. */
  id: string;
  /** Shown under the swatch. Keep it to one word where possible: the menu is a
   *  horizontal row, and a two-line label sets the height of every item. */
  name: string;
  /** The one-line reason this theme exists, used as the item's title/aria text. */
  hint: string;
}

export const DEFAULT_THEME_ID = 'classic';

/**
 * Ordered by colour, and the order is the whole point of the row: two neutrals
 * first, then a warm-to-cool sweep round the wheel. Read left to right it goes
 * white → gray → rose → ivory → tan → green → blue → violet, so a reader
 * looking for "something warmer" or "something cooler" moves in one direction
 * instead of hunting.
 *
 * Sorted on the PAGE tint, not the accent — the page is almost all of what a
 * swatch shows, and what the complaint was about. Measured OKLCH hue of each
 * `bg`, which is why Clay (34°) precedes Paper (81°) and Sepia (82°) rather
 * than sitting with the other warm neutrals:
 *
 *   classic  C 0.000  (no hue at all)     sage      H 132
 *   soft-gray C 0.003 (neutral)           mist      H 248
 *   clay     H  34                        lavender  H 298
 *   warm-paper H 81
 *   sepia    H  82  (same hue as Paper, three times the chroma)
 *
 * Adding a theme means inserting it at its hue, not appending it.
 */
export const LIGHT_THEMES: LightTheme[] = [
  { id: 'classic', name: 'Classic', hint: 'The original white theme' },
  { id: 'soft-gray', name: 'Soft gray', hint: 'Neutral gray page, near-white cards' },
  { id: 'clay', name: 'Clay', hint: 'Warm rose page, brick accent' },
  { id: 'warm-paper', name: 'Paper', hint: 'Warm ivory, warm-gray ink' },
  { id: 'sepia', name: 'Sepia', hint: 'Tan page, brown ink, rust accent' },
  { id: 'sage', name: 'Sage', hint: 'Green-tinted page, deep green accent' },
  { id: 'mist', name: 'Mist', hint: 'Cool blue-gray page, deep teal accent' },
  { id: 'lavender', name: 'Lavender', hint: 'Violet-tinted page, indigo accent' },
];

export const THEME_IDS = LIGHT_THEMES.map((theme) => theme.id);

/** `theme-sage`; empty for the default, which is the absence of a class. */
export function themeClass(id: string): string {
  return id === DEFAULT_THEME_ID ? '' : `theme-${id}`;
}
