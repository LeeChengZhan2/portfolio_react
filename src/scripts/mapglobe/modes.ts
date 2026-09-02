/**
 * The mode list, in its own module so that importing it does not drag the
 * engine along with it.
 *
 * This is not tidiness. `index.ts` needs the list at page load to validate a
 * stored choice and to mark the switcher, and it reaches the engine through a
 * dynamic `import()` so MapLibre stays out of the eager bundle. A single
 * *value* imported statically from `engine.ts` defeats that entirely: Rollup
 * cannot split a module that is also statically reachable, so it hoists the
 * whole engine — MapLibre included — into the page entry and the
 * IntersectionObserver ends up deferring nothing.
 *
 * The build says so out loud when it happens:
 *   [INEFFECTIVE_DYNAMIC_IMPORT] … is dynamically imported … but also
 *   statically imported …, dynamic import will not move module into another chunk.
 *
 * Types are free — they are erased before Rollup ever sees them — so
 * `import type` from `engine.ts` is fine. Values are not. Keep it that way.
 */

export const MAP_MODES = ['places', 'terrain'] as const;
export type MapMode = (typeof MAP_MODES)[number];
