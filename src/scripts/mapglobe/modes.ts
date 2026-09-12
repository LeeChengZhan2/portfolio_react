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
   freely; leave these two ids alone.

   THREE SINCE 9 SEP 2026. `combined` — the chip says "All" — is the globe with
   both halves of the page on it at once: the visited footprints and the
   recorded routes, each behind its own chip, over the same five layer filters
   `explore` has. It is deliberately a superset: with Trails switched off it is
   `explore`, which is the relationship `explore` already had to the two modes
   cut on 7 Sep. The difference is which way round it runs — this one is the
   general case and `explore` is a position on its dial, so if the tab row ever
   needs shortening again this is the tab that can absorb its neighbour rather
   than the one to cut. */
export const MAP_MODES = ['explore', 'terrain', 'combined'] as const;
export type MapMode = (typeof MAP_MODES)[number];

/**
 * What the `combined` mode draws, as two chips.
 *
 * These ARE called `trips` and `trails`, which the note above says a mode id
 * could not be — and the collision does not bite here because these name the
 * content rather than a view of it. `MapContent` is exactly "a trip or a
 * trail", so a member called `trips` means the trips. A MODE called `trips`
 * would have meant "the view that happens to show them", which is what reads
 * wrong beside a `MapTrip` type and a `trips` variable holding them.
 *
 * Order is the order the chips render in, and it is the order of the page: the
 * trips came first and are what the travel section is about.
 */
export const MAP_CONTENT = ['trips', 'trails'] as const;
export type MapContent = (typeof MAP_CONTENT)[number];

/** Both. A tab whose name is "All" has to open showing all of it. */
export const DEFAULT_CONTENT: readonly MapContent[] = ['trips', 'trails'];

/**
 * How the `All` tab is looking at what it draws — FOUR positions on one pill
 * (10 Sep 2026, author's request, revised the same day).
 *
 * A CAMERA, NOT A MODE, and that distinction is why this is a separate axis
 * rather than four more tabs. A mode changes what is on the map — `terrain`
 * swaps the trips for one route and the filters for a route picker. These
 * change how the same content is looked at.
 *
 * It shipped as two, `globe` and one tilted view, and the tilted one drew the
 * author's real objection: *"can see global but cannot show the terrain."* That
 * is exactly true and it is forced by MapLibre rather than chosen — the 3D
 * terrain MESH needs the mercator projection, and at the globe's 20 km per
 * pixel a mountain is under half a pixel of relief, so a whole-world view can
 * have shading or it can have terrain, never both. The answer is not one
 * compromise but three positions on the trade, which the author asked to
 * compare on the page rather than in the abstract:
 *
 *   globe    flat sphere. No tilt, no mesh; relief only if the chip asks.
 *   route    ONE route, whole route in frame, mercator + real mesh. ~z11.
 *            "Terrain 1". The look of the single-route Trails view.
 *   region   the same route's whole mountain region, mercator + real mesh.
 *            "Terrain 2". Six times the route's own extent, so the walk is
 *            small and the ranges around it are the subject.
 *   tilted   the whole world, leaned over, hillshade and NO mesh. "Terrain 3",
 *            and it is what the two-position version shipped as.
 *   survey   "Terrain 4", and the only one of the four with TWO scales. It
 *            arrives framed like `region` and drills to `route` when the
 *            reader picks a single walk, so the sequence a reader actually
 *            wants — the ranges, then the walk in them — is one view rather
 *            than two positions on a pill they have to know to move. It is
 *            also the view the index rail belongs to: at either scale most of
 *            the collection is off-frame, and zooming out to reach it is the
 *            thing the rail exists to make unnecessary.
 *
 * THE IDS ARE NOT THE LABELS, deliberately, and this is the second place in
 * this file where that is true — see MAP_MODES above. The pill reads Globe,
 * Terrain 1, Terrain 2, Terrain 3, because numbers are how the author will
 * refer to them while choosing between them ("keep terrain 2"). The ids say
 * what each one frames, because that is what the code has to reason about, and
 * `view === 'region'` is readable where `view === 'terrain2'` is not. Renumber
 * the labels freely; leave the ids alone.
 *
 * `route` and `region` are the two that attach the mesh. Nothing else in the
 * engine should test for them by name — use the predicates in engine.ts, which
 * is the one place that mapping lives.
 */
export const MAP_VIEWS = ['globe', 'route', 'region', 'tilted', 'survey'] as const;
export type MapView = (typeof MAP_VIEWS)[number];

/**
 * The views that attach the real 3D terrain mesh, as DATA rather than as a
 * condition spelled out in the engine.
 *
 * It was a predicate reading `view === 'route' || view === 'region'` until
 * Terrain 4 arrived and made it three, at which point two separate files needed
 * the same answer: the engine, to decide the projection and the shading, and
 * index.ts, to decide whether to show the index rail. A list here is one place
 * to add the fourth; two copies of an `||` chain is how they end up disagreeing.
 *
 * Membership means exactly two things and nothing else: mercator instead of the
 * globe, and `setTerrain` attached on arrival. Everything a mesh view does
 * DIFFERENTLY from its neighbours — how wide it frames, whether it draws the
 * other routes — is decided per view in engine.ts.
 */
export const MESH_VIEWS: readonly MapView[] = ['route', 'region', 'survey'];

/**
 * The flat sphere — what `All` has always opened as.
 *
 * The three terrain views are opt-in and remembered, the same way the light
 * themes are: nothing about a first visit changes.
 *
 * A view stored before this revision can be `terrain`, which no longer exists.
 * Nothing special handles that and nothing needs to: `isView` checks the stored
 * string against MAP_VIEWS and a miss falls through to here — the same
 * treatment the dead `places` and `atlas` mode ids get.
 */
export const DEFAULT_VIEW: MapView = 'globe';

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
