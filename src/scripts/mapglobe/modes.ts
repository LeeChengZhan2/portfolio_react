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

/* Order matters: this is the order the switcher renders in.

   `combined` IS FIRST AND IS THE DEFAULT (14 Sep 2026, author's request), and
   the reason is the relationship recorded at the foot of this comment: it is
   the general case and `explore` is a position on its dial. A reader arriving
   on the tab that shows everything can take things off it; one arriving on
   `explore` has to know that another tab exists before they can find out what
   the page has. The row used to run cheapest-first instead, which is a real
   consideration and is now the second one — and it costs less than it looks
   like it should: `combined` opens flat, on the same two local layer files
   `explore` does, and adds ten local route files of 11 KB gzipped between them.
   The property that matters is intact, and it is the one the note at the foot
   of MapGlobeStage.astro claims: arriving on this page still contacts no third
   party at all. `terrain` stays last — it reaches straight for DEM tiles and is
   the only mode that cannot preserve that.

   `explore` is a globe with a filter row over it — it opens on boundaries and
   country names, both local files, and makes no third-party request at all
   until the Relief chip is pressed. `terrain` drops to one recorded route on a
   real elevation surface, which cannot avoid DEM tiles and is the reason it is
   a separate mode.

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
/* SIX LAYOUT TABS SINCE 16 SEP 2026, and five of them are the same map.

   The author's note was that the `All` tab puts too much over the earth — the
   filters panel, the index rail, the route card and the map's own cards, all
   floating on the one frame — and that they want the information KEPT and
   arranged better, proposed as tabs to review rather than applied to `All`:
   *"Do not directly do at all Tab. Create 5 new tab after all tab."*

   So `all-1` … `all-5` draw exactly what `combined` draws, from the same
   state, and differ ONLY in where the chrome sits and how big it is. They are
   mode ids because the author asked for tabs; they are not modes to the
   engine, which never sees one — see `baseMode`.

   Throwaway like the rest of this page, and more so: when one layout wins,
   it replaces `combined`'s CSS and the other five tabs are deleted. */
export const MAP_MODES = [
  'combined',
  'all-1',
  'all-2',
  'all-3',
  'all-4',
  'all-5',
  'all-6',
  'explore',
  'terrain',
] as const;
export type MapMode = (typeof MAP_MODES)[number];

/**
 * The five layout proposals, in tab order. A subset of MAP_MODES rather than
 * a list of its own, so a tab cannot exist in one and not the other.
 */
export const MAP_LAYOUTS = ['all-1', 'all-2', 'all-3', 'all-4', 'all-5', 'all-6'] as const;
export type MapLayout = (typeof MAP_LAYOUTS)[number];

/**
 * What a tab MEANS to the map, as opposed to what it means to the page.
 *
 * The five layout tabs are `combined` in every respect the engine cares about
 * — same content chips, same layer filters, same view switch, same camera —
 * so the engine is handed `combined` and told nothing about the layout. That
 * is the whole reason five extra tabs cost the engine nothing: `applyMode`,
 * `applyLayers`, `terrainView` and every `current === …` test in engine.ts are
 * untouched, and there is no sixth branch anywhere to keep in step.
 *
 * The page keeps the distinction: `data-mode` on the section is the base, so
 * every existing rule gating a panel on `[data-mode='combined']` covers all
 * six tabs for free, and `data-layout` carries the variant for the handful of
 * rules that move things around.
 */
export const baseMode = (mode: MapMode): MapMode =>
  (MAP_LAYOUTS as readonly string[]).includes(mode) ? 'combined' : mode;

/**
 * The tab the page opens on — `combined`, the one that shows everything
 * (14 Sep 2026, author's request; it was `explore` before that).
 *
 * HERE RATHER THAN IN index.ts, where it lived until the value changed. The
 * markup has to ship one tab already marked, because a static build cannot know
 * what the visitor stored, and MapGlobeStage.astro was doing that from a
 * hardcoded `'explore'` of its own — two copies of one answer, a file apart,
 * with nothing to make them move together. Every other default on this section
 * is already in this file for exactly that reason.
 *
 * A mode stored before 7 Sep 2026 can be `places` or `atlas`, neither of which
 * exists now. Nothing special handles that and nothing needs to: `isMode` in
 * index.ts checks the stored string against MAP_MODES and a miss falls through
 * to here — the same treatment a retired view id gets from DEFAULT_VIEW.
 */
export const DEFAULT_MODE: MapMode = 'combined';

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
 * How the `All` tab is looking at what it draws — TWO positions on one pill
 * (14 Sep 2026, author's request; there were four for four days).
 *
 * A CAMERA, NOT A MODE, and that distinction is why this is a separate axis
 * rather than two more tabs. A mode changes what is on the map — `terrain`
 * swaps the trips for one route and the filters for a route picker. These
 * change how the same content is looked at.
 *
 *   globe    flat sphere. No tilt, no mesh; relief only if the chip asks.
 *   survey   "Terrain". Mercator, a real 3D mesh, and TWO SCALES: it arrives
 *            on a route's whole mountain region and drops to the walk itself
 *            when the reader picks one, so the sequence they actually want —
 *            the ranges, then the walk in them — is one view rather than two
 *            positions on a pill they have to know to move. It is also the
 *            view the index rail belongs to: at either scale most of the
 *            collection is off-frame, and zooming out to reach it is the thing
 *            the rail exists to make unnecessary.
 *
 * FOUR TERRAIN POSITIONS WERE CUT TO THIS ONE, and the three that went are not
 * to be restored without a new reason:
 *
 *   route    Terrain 1 — one route, tight. `survey` IS this, drilled in.
 *   region   Terrain 2 — the route's mountain region. `survey` IS this on
 *            arrival. Its objection was being stuck at that scale, which is
 *            what `survey` and the index rail answer.
 *   tilted   Terrain 3 — the whole world leaned over, hillshade and NO mesh.
 *            The one real loss, and it was forced rather than chosen: the mesh
 *            needs mercator, and at the globe's 20 km per pixel a mountain is
 *            under half a pixel of relief, so a whole-world view can have
 *            shading or it can have terrain and never both. The pill shipped
 *            as `globe` + `tilted` for one day and THAT is the pair the author
 *            rejected — *"can see global but cannot show the terrain."* The
 *            surviving pair is not that pair: this Terrain has the mesh.
 *
 * THE ID IS NOT THE LABEL, deliberately, and this is the second place in this
 * file where that is true — see MAP_MODES above. The pill reads "Terrain"; the
 * id says what the view frames, because that is what the code has to reason
 * about. Renaming the label is free and has happened twice. Leave the id alone:
 * `terrain` is a MODE id, and `view === 'terrain'` beside `current === 'terrain'`
 * meaning two different things is how the wrong one gets tested.
 */
export const MAP_VIEWS = ['globe', 'survey'] as const;
export type MapView = (typeof MAP_VIEWS)[number];

/**
 * The one view that leans the camera, attaches the real 3D terrain mesh and
 * shades unasked — as DATA rather than as a condition spelled out twice.
 *
 * Two files need the same answer: the engine, for the projection, the shading
 * and every fit, and index.ts, for the relief chip and the index rail. It was
 * a MESH_VIEWS list while there were three of them; a list of one says less
 * than a constant, and `view !== 'globe'` written in two files is how they end
 * up disagreeing after the next change.
 *
 * Membership means exactly: mercator instead of the globe, `setTerrain` on
 * arrival, and the hillshade on whether or not the chip asks for it.
 */
export const TERRAIN_VIEW: MapView = 'survey';

/**
 * The flat sphere — what `All` has always opened as.
 *
 * The terrain view is opt-in and remembered, the same way the light themes
 * are: nothing about a first visit changes.
 *
 * A view stored before a revision can be `terrain`, `route`, `region` or
 * `tilted`, none of which exists now. Nothing special handles any of them and
 * nothing needs to: `isView` checks the stored string against MAP_VIEWS and a
 * miss falls through to here — the same treatment the dead `places` and `atlas`
 * mode ids get. Note what that means for a reader who left in Terrain 2: they
 * come back to the Globe rather than to the surviving Terrain. Mapping the
 * three dead ids onto `survey` was considered and not done — it is one more
 * branch to carry for the life of a throwaway preview page, and the pill is
 * one click away.
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

/**
 * The five ways of looking at ONE route — the detail views behind the button
 * in the top-left corner of the frame (16 Sep 2026, author's request:
 * *"Create 5 best view you think and a filter button on top left corner so
 * that I can swap between that 5 view"*).
 *
 * Each is a different KIND of fact the GPX recording holds, which is what
 * makes them five rather than one long card:
 *
 *   summary   the numbers — distance, climb, the clock, the shape of the walk
 *   profile   height against distance, with the map's probe riding the chart
 *   splits    each kilometre's time and climb, as bars
 *   colour    the line itself coloured by height, with a legend
 *   effort    heart rate against distance, and power on the runs
 *
 * Only the first is served from the manifest the page already holds. The
 * other four read `public/globe/trails/<id>.profile.json`, which is the
 * recording resampled by distance at build time — see scripts/build-trails.mjs
 * — and is fetched the first time one of them is opened for a route.
 *
 * Order is the order the menu renders in, and it is cheapest-first: the view
 * that costs no request leads, and the one that draws the author's own heart
 * rate is last.
 */
export const MAP_INFO = ['summary', 'profile', 'splits', 'colour', 'effort'] as const;
export type MapInfo = (typeof MAP_INFO)[number];

/** The numbers. The one view that needs nothing fetched. */
export const DEFAULT_INFO: MapInfo = 'summary';
