/**
 * Turns a folder of recorded GPX files into the two things the MapLibre earth's
 * `terrain` mode reads:
 *
 *   src/data/trails.json                    the manifest — one entry per route
 *   public/globe/trails/<id>.json           one simplified LineString per route
 *   public/globe/trails/<id>.profile.json   the walk sampled every few dozen
 *                                           metres, plus its per-km splits
 *
 *   node scripts/build-trails.mjs [source-dir]
 *
 * Default source is ~/Downloads/gpx, laid out as `hike/` and `run/`. Nested
 * folders are walked, so hike/CcC/… is found too.
 *
 * WHY THIS IS A BUILD STEP AND NOT A RUNTIME PARSE.
 *
 * The ten recordings are 29 MB of XML. They are Strava exports at roughly one
 * sample every two seconds, with a heart rate on every point — 27,533 points
 * for one afternoon on a hill. None of that is drawable: at the zoom a 10 km
 * track fits in, several hundred consecutive samples land on the same pixel.
 * Parsing it in the browser would also mean shipping all 29 MB to do it.
 *
 * TWO DIFFERENT TRACKS, AND THAT IS DELIBERATE. Every figure in the manifest —
 * distance, ascent, elevation range, point count — is computed from the FULL
 * recording, before any simplification. The geometry written out is simplified.
 * So the readout reports what the watch actually recorded while the map draws
 * something a browser can hold, and simplifying harder can never quietly
 * shorten the distance the page claims. Douglas-Peucker on a GPS trace cuts
 * measured distance by a few percent at even a modest tolerance, which is
 * exactly the kind of error nobody ever catches.
 *
 * The geometry is 2D. MapLibre drapes a line layer onto whatever terrain
 * surface is under it, so a per-point elevation would be carried across the
 * network and then ignored. The elevations are read — they are where `ascent`
 * and the range come from — they are just not shipped WITH THE LINE.
 *
 * THE PROFILE IS A THIRD FILE, NOT MORE COLUMNS ON THE LINE (16 Sep 2026).
 * The five route-detail views on the preview page — an elevation profile, the
 * per-kilometre splits, the line coloured by height, and the heart-rate trace —
 * all need the recording as a SERIES rather than as a shape, and a series wants
 * to be sampled by distance rather than by what Douglas-Peucker happened to
 * keep: a 2D simplification drops the top of a climb that lies on a straight
 * path, and a chart drawn from it would miss the summit. So the profile is
 * resampled from the FULL track at a fixed step along it — 25 to 100 m, chosen
 * so every route lands at a few hundred samples — with the elevation and the
 * clock interpolated at each step and the heart rate taken from the nearest
 * fix. It is fetched only when one of those views is opened, so the line the
 * map draws costs exactly what it did before.
 *
 * The profile carries heart rate and, for the runs, power. They are in the
 * recording and the Effort view draws them; whether a public page should is
 * the author's call, and dropping that view is the only edit needed to stop
 * shipping them.
 *
 * The manifest goes in src/data/ rather than public/globe/ because nothing
 * fetches it: MapGlobeStage.astro imports it at build time and renders the
 * picker from it. Only the geometry is fetched, and only for a route someone
 * actually picks.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';

const SOURCE = process.argv[2] ?? join(homedir(), 'Downloads', 'gpx');
const GEOMETRY_DIR = 'public/globe/trails';
const MANIFEST = 'src/data/trails.json';

/**
 * How far a simplified line may stray from the recording, in metres.
 *
 * 4 m is under one GPS fix's own error, so the simplified line stays inside the
 * noise of the thing it is simplifying — there is no real detail left to lose.
 */
const TOLERANCE_M = 4;

/**
 * Coordinate decimals kept. 5 is ~1.1 m at the equator, comfortably finer than
 * the tolerance above, and worth about a third of the file size against the
 * 7 decimals Strava writes.
 */
const PRECISION = 5;

/**
 * How far apart the profile samples are, in metres, chosen per route so the
 * number of samples stays in a band a 300px chart can use: 25 m for a short
 * hill, 75 m for a half marathon.
 */
const PROFILE_TARGET = 300;
const PROFILE_STEPS = [25, 50, 75, 100];

/**
 * Speed under which a stretch counts as standing still, in m/s. 0.5 m/s is
 * 1.8 km/h — slower than any walk, faster than GPS drift on a stationary
 * watch. A gap over 30 s between fixes is the watch paused and is never
 * moving time, whatever the speed across it works out to.
 */
const MOVING_MPS = 0.5;
const PAUSE_S = 30;

/**
 * A route is an out-and-back when this share of its second half lies within
 * RETRACE_M of its first half; a genuine loop scores far under it. Ends within
 * LOOP_M of each other and no retrace is a loop; everything else is point to
 * point.
 */
const RETRACE_SHARE = 0.6;
const RETRACE_M = 40;
const LOOP_M = 250;

/**
 * Short labels for the picker chips.
 *
 * `nameOf` below derives one from the GPX's own `<name>`, and for the hikes it
 * gets it right — "Belumut, Johor, Malaysia Hike" splits cleanly into a place
 * and a region. The runs do not follow that shape at all ("First Half Marathon
 * Morning Run - Dato Onn"), so those three are named here.
 *
 * Keyed by filename without extension. A file not in this table still builds;
 * it just gets the derived name.
 */
const OVERRIDES = {
  First_Half_Marathon_Morning_Run_Dato_Onn: {
    label: 'Dato Onn',
    place: 'Johor Bahru, Malaysia',
  },
  Iskandar_City_Half_Marathon: { label: 'Iskandar City', place: 'Johor, Malaysia' },
  Kulai_Johor_Half_Marathon_Morning_Run: { label: 'Kulai', place: 'Johor, Malaysia' },
};

/* -------------------------------------------------------------------------- */
/* reading                                                                     */
/* -------------------------------------------------------------------------- */

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.name.toLowerCase().endsWith('.gpx')) yield path;
  }
}

/**
 * A regex rather than an XML parser, which is a real trade rather than
 * laziness: this reads 29 MB of a format whose shape is known exactly, in a
 * script run on demand. `trkpt` and `rtept` are both accepted for the same
 * reason engine.ts accepts both — a planned route arrives as the latter.
 */
function readPoints(xml) {
  const points = [];
  const re =
    /<(?:trkpt|rtept)[^>]*\blat="([-\d.]+)"[^>]*\blon="([-\d.]+)"[^>]*>([\s\S]*?)<\/(?:trkpt|rtept)>/g;

  for (const m of xml.matchAll(re)) {
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const ele = /<ele>([-\d.]+)<\/ele>/.exec(m[3]);
    const time = /<time>([^<]+)<\/time>/.exec(m[3]);
    /* Strava writes a heart rate on every fix and, on the runs, a power
       estimate. Both are read for the profile file and neither reaches the
       line the map draws. */
    const hr = /<gpxtpx:hr>(\d+)<\/gpxtpx:hr>/.exec(m[3]);
    const power = /<power>(\d+)<\/power>/.exec(m[3]);
    points.push({
      lon,
      lat,
      ele: ele ? Number(ele[1]) : null,
      time: time ? time[1] : null,
      hr: hr ? Number(hr[1]) : null,
      power: power ? Number(power[1]) : null,
    });
  }
  return points;
}

const tag = (xml, name) => {
  const m = new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml);
  return m ? m[1].trim() : null;
};

/* -------------------------------------------------------------------------- */
/* measuring                                                                   */
/* -------------------------------------------------------------------------- */

const R_EARTH_KM = 6371;

function haversine(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.sqrt(s));
}

/**
 * Ascent summed off a 3 m threshold — the same rule engine.ts applies to a
 * dropped file, and for the same reason. A barometric altimeter wanders a metre
 * or two per sample, so summing every positive tick turns a flat 21 km road run
 * into several hundred metres of climbing.
 */
function ascentOf(eles) {
  if (eles.length < 2) return null;
  let total = 0;
  let mark = eles[0];
  for (const e of eles) {
    if (e > mark + 3) {
      total += e - mark;
      mark = e;
    } else if (e < mark) {
      mark = e;
    }
  }
  return Math.round(total);
}

/**
 * Descent, as the mirror of `ascentOf` with its own mark — NOT a change to the
 * ascent rule. The mark here follows every rise immediately and counts a fall
 * once it exceeds 3 m, so a loop that climbs 1,127 m descends about as much,
 * and the printed ascent figures are exactly what they were before this
 * function existed.
 */
function descentOf(eles) {
  if (eles.length < 2) return null;
  let total = 0;
  let mark = eles[0];
  for (const e of eles) {
    if (e < mark - 3) {
      total += mark - e;
      mark = e;
    } else if (e > mark) {
      mark = e;
    }
  }
  return Math.round(total);
}

/**
 * Seconds actually moving. Summed per pair of fixes from the FULL track, the
 * same source every other figure uses.
 */
function movingOf(track) {
  let total = 0;
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1];
    const b = track[i];
    if (!a.time || !b.time) continue;
    const dt = (Date.parse(b.time) - Date.parse(a.time)) / 1000;
    if (dt <= 0 || dt > PAUSE_S) continue;
    if ((haversine(a, b) * 1000) / dt >= MOVING_MPS) total += dt;
  }
  return Math.round(total);
}

/**
 * Loop, out-and-back, or point to point — from the geometry, so the map's
 * start dot and end ring have a word to go with them.
 *
 * The retrace test hashes the first half of the track into a grid of
 * RETRACE_M cells and asks how many second-half fixes fall in a cell with a
 * first-half fix in it or beside it. It is a coarse test and that is enough:
 * the three answers are a long way apart on every route here.
 */
function shapeOf(track) {
  const mid = Math.floor(track.length / 2);
  const mPerDegLat = 111_320;
  const mPerDegLon = mPerDegLat * Math.cos((track[0].lat * Math.PI) / 180);
  const cell = (p) => [
    Math.floor((p.lon * mPerDegLon) / RETRACE_M),
    Math.floor((p.lat * mPerDegLat) / RETRACE_M),
  ];

  const grid = new Set();
  for (let i = 0; i < mid; i++) grid.add(cell(track[i]).join(','));

  let near = 0;
  for (let i = mid; i < track.length; i++) {
    const [cx, cy] = cell(track[i]);
    let hit = false;
    for (let dx = -1; dx <= 1 && !hit; dx++) {
      for (let dy = -1; dy <= 1 && !hit; dy++) hit = grid.has(`${cx + dx},${cy + dy}`);
    }
    if (hit) near++;
  }
  if (near / (track.length - mid) >= RETRACE_SHARE) return 'out-and-back';
  return haversine(track[0], track.at(-1)) * 1000 < LOOP_M ? 'loop' : 'point-to-point';
}

/** Cumulative distance along the track, in metres, one entry per fix. */
function cumulative(track) {
  const cum = new Array(track.length);
  cum[0] = 0;
  for (let i = 1; i < track.length; i++) {
    cum[i] = cum[i - 1] + haversine(track[i - 1], track[i]) * 1000;
  }
  return cum;
}

/**
 * The track resampled every `step` metres — see the header for why this is a
 * separate file. Each sample is [lon, lat, ele, seconds-from-start, hr], with
 * the position, elevation and clock interpolated inside the fix pair the
 * sample lands in and the heart rate taken from the nearer fix. The last fix
 * is always the last sample, so the profile ends where the walk did.
 */
function sampleProfile(track, cum, step) {
  const t0 = Date.parse(track[0].time ?? '') || 0;
  const secs = (p) => (p.time ? Math.round((Date.parse(p.time) - t0) / 1000) : null);
  const total = cum[cum.length - 1];
  const samples = [];
  let i = 1;

  const lerp = (x, y, t) => (x === null || y === null ? null : Math.round(x + (y - x) * t));

  const at = (d) => {
    while (i < cum.length - 1 && cum[i] < d) i++;
    const a = track[i - 1];
    const b = track[i];
    const span = cum[i] - cum[i - 1];
    const t = span > 0 ? Math.min(1, Math.max(0, (d - cum[i - 1]) / span)) : 0;
    const nearer = t < 0.5 ? a : b;
    return [
      Number((a.lon + (b.lon - a.lon) * t).toFixed(PRECISION)),
      Number((a.lat + (b.lat - a.lat) * t).toFixed(PRECISION)),
      lerp(a.ele, b.ele, t),
      lerp(secs(a), secs(b), t),
      nearer.hr,
    ];
  };

  for (let d = 0; d < total; d += step) samples.push(at(d));
  samples.push(at(total));

  /* Interpolating every `step` metres can miss the top of a climb by a metre
     or two, and the card then says "1,016 m" beside a summary that says
     "1,017 m" — measured from the same recording. So the highest and lowest
     fixes are written over the sample nearest each, elevation only; the
     position and clock stay the sample's own, which is within half a step. */
  const pin = (pick) => {
    let best = -1;
    track.forEach((p, i) => {
      if (p.ele !== null && (best === -1 || pick(p.ele, track[best].ele))) best = i;
    });
    if (best === -1) return;
    const slot = Math.min(samples.length - 1, Math.round(cum[best] / step));
    samples[slot][2] = Math.round(track[best].ele);
  };
  pin((a, b) => a > b);
  pin((a, b) => a < b);
  return samples;
}

/**
 * Per-kilometre splits off the full track: [seconds, ascent, descent, metres].
 * The last one is usually short, and its length is carried so the page can
 * scale its pace rather than print a 500 m "kilometre" as a sprint.
 */
function splitsOf(track, cum) {
  const splits = [];
  let from = 0;
  let next = 1000;
  const t0 = Date.parse(track[0].time ?? '') || 0;
  const time = (p) => (p.time ? Date.parse(p.time) : t0);

  const close = (to) => {
    const eles = track.slice(from, to + 1).map((p) => p.ele).filter((e) => e !== null);
    splits.push([
      Math.round((time(track[to]) - time(track[from])) / 1000),
      eles.length > 1 ? ascentOf(eles) : 0,
      eles.length > 1 ? descentOf(eles) : 0,
      Math.round(cum[to] - cum[from]),
    ]);
    from = to;
  };

  for (let i = 1; i < track.length; i++) {
    if (cum[i] >= next) {
      close(i);
      next += 1000;
    }
  }
  if (from < track.length - 1 && cum[cum.length - 1] - cum[from] > 50) close(track.length - 1);
  return splits;
}

/** [mean, max] of a series, or null when the recording has none of it. */
const stats = (values) =>
  values.length
    ? [Math.round(values.reduce((a, b) => a + b, 0) / values.length), Math.max(...values)]
    : null;

/* -------------------------------------------------------------------------- */
/* simplifying                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Douglas-Peucker, iterative.
 *
 * Iterative rather than recursive because the input is 27,000 points and the
 * worst case for this algorithm is one stack frame per point.
 *
 * Distances are computed in a local flat projection — degrees of longitude
 * scaled by cos(latitude), both then scaled to metres — which is exact enough
 * over the few kilometres any one of these tracks spans, and avoids a haversine
 * per candidate point per pass.
 */
function simplify(points, toleranceM) {
  if (points.length < 3) return points.slice();

  const mPerDegLat = 111_320;
  const mPerDegLon = mPerDegLat * Math.cos((points[0].lat * Math.PI) / 180);
  const x = points.map((p) => p.lon * mPerDegLon);
  const y = points.map((p) => p.lat * mPerDegLat);

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack = [[0, points.length - 1]];
  const tol2 = toleranceM * toleranceM;

  while (stack.length) {
    const [first, last] = stack.pop();
    if (last - first < 2) continue;

    const ax = x[first];
    const ay = y[first];
    const dx = x[last] - ax;
    const dy = y[last] - ay;
    const len2 = dx * dx + dy * dy;

    let worst = 0;
    let at = -1;

    for (let i = first + 1; i < last; i++) {
      const px = x[i] - ax;
      const py = y[i] - ay;
      /* Distance to the SEGMENT, not to the infinite line through the two
         endpoints. A walk that returns to its own trailhead makes those two
         points nearly coincide, and the infinite line through them is then
         meaningless — the classic way this algorithm mangles a loop. */
      let d2;
      if (len2 === 0) {
        d2 = px * px + py * py;
      } else {
        const t = Math.max(0, Math.min(1, (px * dx + py * dy) / len2));
        const ex = px - t * dx;
        const ey = py - t * dy;
        d2 = ex * ex + ey * ey;
      }
      if (d2 > worst) {
        worst = d2;
        at = i;
      }
    }

    if (worst > tol2 && at > 0) {
      keep[at] = 1;
      stack.push([first, at], [at, last]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

/* -------------------------------------------------------------------------- */
/* naming                                                                      */
/* -------------------------------------------------------------------------- */

/** The words Strava appends to the place. Stripped so a chip reads as a place
    rather than as a sentence about an afternoon. */
const ACTIVITY_WORDS =
  /\s+(?:Morning|Afternoon|Evening|Night|Lunch)?\s*(?:Hike|Hiking|Run|Running|Walk|Trail Run)$/i;

/**
 * "Lamasi - Muluozi, Changping Valley, Chuanxi, China Hike"
 *   → label "Lamasi – Muluozi", place "Changping Valley, Chuanxi, China"
 *
 * The first comma is the split, because every Strava name in this set is
 * `<where>, <region…> <activity>`. An en dash replaces the hyphen between the
 * two ends of a point-to-point walk, which is what that hyphen means.
 */
function nameOf(gpxName, file) {
  const override = OVERRIDES[file];
  if (override) return override;

  const cleaned = (gpxName ?? file.replace(/_/g, ' ')).replace(ACTIVITY_WORDS, '').trim();
  const comma = cleaned.indexOf(',');
  const label = (comma === -1 ? cleaned : cleaned.slice(0, comma)).trim();
  const place = comma === -1 ? '' : cleaned.slice(comma + 1).trim();
  return { label: label.replace(/\s+-\s+/g, ' – '), place };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The calendar date the walk happened on, where it happened.
 *
 * GPX times are UTC, and three of these ten start before 04:00 local — printed
 * as UTC they would be dated the previous day. There is no timezone in a GPX
 * file, so the offset is estimated from longitude at 15° per hour. That is an
 * hour out for Sichuan, which sits at 103°E on Beijing time, and it does not
 * matter: every track here starts at least five hours from midnight, so an hour
 * of error cannot move the date. If a future recording starts near midnight,
 * this is the line to distrust.
 */
function localDate(iso, lon) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const at = new Date(t + Math.round(lon / 15) * 3_600_000);
  return {
    iso: at.toISOString().slice(0, 10),
    when: `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear()}`,
    clock: at.toISOString().slice(11, 16),
  };
}

/** The local wall-clock time of a fix, "07:24", by the same longitude rule. */
const localClock = (iso, lon) => localDate(iso, lon)?.clock ?? '';

const slug = (file) =>
  file
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/* -------------------------------------------------------------------------- */
/* the run                                                                     */
/* -------------------------------------------------------------------------- */

const round = (n) => Number(n.toFixed(PRECISION));

const files = [];
for await (const path of walk(SOURCE)) files.push(path);
files.sort();

if (!files.length) {
  console.error(`No .gpx files under ${SOURCE}`);
  process.exit(1);
}

const trails = [];
let rawPoints = 0;
let keptPoints = 0;

for (const path of files) {
  const xml = await readFile(path, 'utf8');
  const base = path.split(/[\\/]/).pop().replace(/\.gpx$/i, '');
  const points = readPoints(xml);

  if (points.length < 2) {
    console.warn(`  skipped ${base} — fewer than two points`);
    continue;
  }

  /* Consecutive duplicates first. A watch left running at a trailhead logs the
     same fix for minutes on end; they contribute nothing to Douglas-Peucker and
     they make its inner loop longer. */
  const track = points.filter(
    (p, i) => i === 0 || p.lon !== points[i - 1].lon || p.lat !== points[i - 1].lat,
  );

  /* Stats off the FULL track — see the header. */
  let km = 0;
  for (let i = 1; i < track.length; i++) km += haversine(track[i - 1], track[i]);
  const eles = track.map((p) => p.ele).filter((e) => e !== null);
  const hasEle = eles.length === track.length;

  const line = simplify(track, TOLERANCE_M);
  rawPoints += points.length;
  keptPoints += line.length;

  /* The profile — see the header. Sampled off the full track, never the line. */
  const cum = cumulative(track);
  const step =
    PROFILE_STEPS.find((s) => cum[cum.length - 1] / s <= PROFILE_TARGET * 1.5) ??
    PROFILE_STEPS.at(-1);
  const profile = {
    step,
    samples: sampleProfile(track, cum, step),
    splits: splitsOf(track, cum),
    hr: stats(track.map((p) => p.hr).filter((v) => v !== null)),
    power: stats(track.map((p) => p.power).filter((v) => v !== null)),
  };

  /* `<type>` is Strava's own word for the activity, so it is preferred over the
     folder the file happens to sit in. The folder is the fallback, which is what
     makes dropping a new file into hike/ or run/ enough. */
  const type = (tag(xml, 'type') ?? '').toLowerCase();
  const folder = relative(SOURCE, path).split(/[\\/]/)[0].toLowerCase();
  const kind = /run/.test(type) || folder === 'run' ? 'run' : 'hike';

  const { label, place } = nameOf(tag(xml, 'name'), base);
  const date = localDate(track[0].time, track[0].lon);
  const id = slug(base);

  await writeFile(
    join(GEOMETRY_DIR, `${id}.json`),
    JSON.stringify(line.map((p) => [round(p.lon), round(p.lat)])),
  );
  await writeFile(join(GEOMETRY_DIR, `${id}.profile.json`), JSON.stringify(profile));

  const last = track.at(-1);
  const elapsed =
    track[0].time && last.time
      ? Math.round((Date.parse(last.time) - Date.parse(track[0].time)) / 1000)
      : null;

  const trail = {
    id,
    label,
    place,
    kind,
    when: date?.when ?? '',
    date: date?.iso ?? '',
    km: Number(km.toFixed(1)),
    ascent: hasEle ? ascentOf(eles) : null,
    descent: hasEle ? descentOf(eles) : null,
    low: hasEle ? Math.round(Math.min(...eles)) : null,
    high: hasEle ? Math.round(Math.max(...eles)) : null,
    /* The clock where the walk was, and the two durations — all off the full
       recording. `moving` is the sum of every interval faster than a
       standstill; see MOVING_MPS. */
    start: localClock(track[0].time, track[0].lon),
    end: localClock(last.time, track[0].lon),
    elapsed,
    moving: elapsed === null ? null : movingOf(track),
    shape: shapeOf(track),
    /* Distinct recorded fixes — consecutive duplicates removed, nothing else.
       Not the point count of the line the map draws, which is two orders of
       magnitude smaller and is a rendering detail rather than a fact about the
       walk.

       There is deliberately no bounding box. The camera is framed from the
       geometry, so an extent here would be a second source of truth for where
       the route is — one that could disagree with the drawn line. */
    points: track.length,
  };
  trails.push(trail);

  console.log(
    `  ${id.slice(0, 44).padEnd(46)}${String(points.length).padStart(6)} → ` +
      `${String(line.length).padStart(5)} pts  ${String(trail.km).padStart(5)} km  ` +
      `${String(trail.ascent ?? '—').padStart(5)} m  ${trail.shape.padEnd(14)} ` +
      `${profile.samples.length} @ ${step} m`,
  );
}

/* Hikes before runs, and newest first inside each — the same "most recent
   first" the travel timeline uses. Terrain mode opens on trails[0], so this
   ordering is also what picks the default route. */
const RANK = { hike: 0, run: 1 };
trails.sort((a, b) => RANK[a.kind] - RANK[b.kind] || b.date.localeCompare(a.date));

await writeFile(MANIFEST, `${JSON.stringify(trails, null, 2)}\n`);

console.log(
  `\n${trails.length} trails · ${rawPoints.toLocaleString()} → ${keptPoints.toLocaleString()} points` +
    ` (${((1 - keptPoints / rawPoints) * 100).toFixed(1)}% dropped)`,
);
