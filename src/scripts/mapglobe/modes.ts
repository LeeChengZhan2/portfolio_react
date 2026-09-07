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
   the cheapest mode to the most expensive. `explore` is a globe with a filter
   row over it — it opens on boundaries and country names, both local files, and
   makes no third-party request at all until the Relief chip is pressed.
   `terrain` drops to one recorded route on a real elevation surface, which
   cannot avoid DEM tiles and is the reason it is a separate mode.

   TWO MODES, AND THERE WERE FOUR UNTIL 7 SEP 2026. `places` (the bare stylised
   globe, no names) and `atlas` (the same globe fixed at boundaries, names and
   relief) are both gone at the author's request. Nothing was lost with them:
   `explore` opens on what `atlas` drew minus its relief, and switching its two
   default chips off leaves exactly what `places` drew. They were two fixed
   positions on a dial the reader now holds, sitting in the row next to the dial.

   THE IDS DELIBERATELY DO NOT MATCH THE LABELS, which read "Trips" and
   "Trails" — see MODES in MapGlobeStage.astro. That is not drift left behind by
   the rename. Both of those words are already taken in this neighbourhood by
   types that mean something much narrower: a `MapTrip` is one visited city, a
   `MapTrail` is one recorded route, and `trips` and `trails` are live variables
   in engine.ts holding exactly those. A mode id that collided with them would
   read worse than one that simply does not echo its own chip. Rename the labels
   freely; leave these two ids alone. */
export const MAP_MODES = ['explore', 'terrain'] as const;
export type MapMode = (typeof MAP_MODES)[number];

/**
 * The optional layers `explore` mode can switch on and off.
 *
 * Order is the order the filter chips render in, and it is deliberate: the
 * three that carry the map itself come first, then the two extras. It is also
 * the order label priority runs in — see `loadWater` and friends in engine.ts —
 * so a layer added at the end of this list cannot bury the ones before it.
 *
 * `relief` rather than `terrain`, even though the chip says the shading is
 * terrain. There is already a MODE called `terrain` and it is a completely
 * different thing — one ridge with a GPS track on it, not a global hillshade —
 * and one identifier meaning both is how the wrong one gets switched.
 */
export const MAP_LAYERS = ['countries', 'cities', 'relief', 'peaks', 'water'] as const;
export type MapLayer = (typeof MAP_LAYERS)[number];

/**
 * What `explore` opens with — boundaries and country names, and nothing else.
 *
 * This is now the only layer set in the file. It used to sit beside
 * `ATLAS_LAYERS`, the frozen list that defined the `atlas` mode as countries +
 * cities + relief, and the two were deliberately different: a filter row is for
 * starting from a quiet map and adding to it, not for starting full and
 * subtracting. With `atlas` gone that list went with it, and this is what the
 * globe is when the reader has not yet touched a chip.
 *
 * Relief is off here, which has a property worth protecting: entering the mode
 * makes no third-party request at all. Both files behind these two chips are
 * local, so the first byte to leave for Mapterhorn is one the reader asked for.
 *
 * The trips are not in this list because they are not optional. Footprints and
 * trip labels are drawn in both modes; they are the point of the page.
 */
export const DEFAULT_LAYERS: readonly MapLayer[] = ['countries'];
