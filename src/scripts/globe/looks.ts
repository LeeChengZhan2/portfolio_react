/**
 * The look list, in its own module so that importing it does not drag the
 * engine along with it.
 *
 * This is not tidiness. `index.ts` needs the list at page load to validate a
 * stored choice and to mark the switcher, and it reaches the engine through a
 * dynamic `import()` so three.js stays out of the eager bundle. A single
 * *value* imported statically from `engine.ts` defeats that entirely: Rollup
 * cannot split a module that is also statically reachable, so it hoists the
 * whole engine — three.js included — into the page entry and the
 * IntersectionObserver ends up deferring nothing.
 *
 * That is not hypothetical: it was how this file shipped. The preview page's
 * eager script measured 140 KB gz with the engine hoisted into it, against
 * 7 KB once the split works, and the build had been saying so the whole time:
 *   [INEFFECTIVE_DYNAMIC_IMPORT] … is dynamically imported … but also
 *   statically imported …, dynamic import will not move module into another chunk.
 *
 * Types are free — they are erased before Rollup ever sees them — so
 * `import type` from `engine.ts` is fine. Values are not. Keep it that way.
 */

export const LOOKS = ['dots', 'vector', 'line', 'relief', 'duotone', 'hex'] as const;
export type Look = (typeof LOOKS)[number];
