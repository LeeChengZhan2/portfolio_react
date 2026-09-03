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

/* Order matters: this is the order the switcher renders in, and it runs from
   the cheapest mode to the most expensive. `places` fetches nothing from a third
   party, `atlas` adds boundaries, names and a global hillshade, `explore` lets
   the reader pick what is drawn, and `terrain` drops to one ridge with a real
   elevation surface under it. */
export const MAP_MODES = ['places', 'atlas', 'explore', 'terrain'] as const;
export type MapMode = (typeof MAP_MODES)[number];

/**
 * The optional layers `explore` mode can switch on and off.
 *
 * Order is the order the filter chips render in, and it is deliberate: the three
 * that make up the fixed atlas come first, then the two extras that only exist
 * in `explore`. It is also the order label priority runs in — see `loadWater`
 * and friends in engine.ts — so a layer added at the end of this list cannot
 * bury the ones before it.
 *
 * `relief` rather than `terrain`, even though the chip says the shading is
 * terrain. There is already a MODE called `terrain` and it is a completely
 * different thing — one ridge with a GPS track on it, not a global hillshade —
 * and one identifier meaning both is how the wrong one gets switched.
 */
export const MAP_LAYERS = ['countries', 'cities', 'relief', 'peaks', 'water'] as const;
export type MapLayer = (typeof MAP_LAYERS)[number];

/**
 * What `atlas` is frozen at. This is the mode's definition, not a default: the
 * switcher's own hint and the page's prose both promise "borders, country and
 * city names, and shaded relief", so this list is what makes that true.
 */
export const ATLAS_LAYERS: readonly MapLayer[] = ['countries', 'cities', 'relief'];

/**
 * What `explore` opens with — boundaries and country names, and nothing else.
 *
 * It used to be the same list as ATLAS_LAYERS, on the reasoning that the two
 * modes should agree until the reader changes something. In practice that made
 * the first thing anyone saw in `explore` identical to the mode beside it, and
 * busy: the point of a filter row is to start from a quiet map and add to it,
 * not to start full and subtract. Countries alone is the least that still says
 * where you are looking.
 *
 * The trips are not in this list because they are not optional. Footprints and
 * trip labels are drawn in every globe mode; they are the point of the page.
 */
export const DEFAULT_LAYERS: readonly MapLayer[] = ['countries'];
