/**
 * Five stylised earths, one engine.
 *
 * Built for /about/travel-preview, where all five are on screen one at a time
 * behind a switcher. They share a camera, controls, footprint geometry, label
 * layer and palette; the only thing that differs between them is how the land
 * is drawn — see LOOK_RECIPES at the bottom. Switching is showing and hiding
 * layers, so it is instant and nothing is rebuilt.
 *
 * Not a React island, on purpose. There is real state here, so an island would
 * be defensible under the rule in CLAUDE.md — this is a leaf page. It would
 * still be 55.9 KB of React runtime to drive a canvas that React never touches.
 * The page loads this module on scroll instead, which is the same deferral
 * `client:visible` gives without the runtime.
 *
 * Why the data is fetched rather than imported: the coastline alone is 880 KB
 * of JSON. Imported, it would be inlined into a JS chunk that the bundler has
 * to parse; fetched, it is a cacheable file the browser streams in parallel and
 * that no other page ever asks for.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { palette, type Palette } from './palette';

import type { Look } from './looks';

export type { Look };

/**
 * three types an object's material as Material | Material[] unless the generic
 * says otherwise, and every colour write in paint() needs the concrete one.
 */
type ShaderPoints = THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
type BasicMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
type Lines = THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;

/** One visited city, as the page hands it to the globe. */
export interface GlobeTrip {
  id: string;
  label: string;
  when: string;
  href: string;
}

interface VisitedFeature {
  ring: [number, number][];
  at: [number, number];
  span: number;
}

interface GlobeData {
  land: [number, number][][];
  borders: [number, number][][];
  cities: [number, number][];
  visited: Record<string, VisitedFeature>;
}

const RAD = Math.PI / 180;
const R = 1;
const DATA_BASE = '/globe';

/** Which layers each look turns on, and how hard its limb is shaded. */
const LOOK_RECIPES: Record<Look, { mode: 0 | 1 | 2 | 3; layers: string[]; limb: number }> = {
  dots: { mode: 0, layers: ['dots', 'visitedDots'], limb: 0.45 },
  vector: { mode: 1, layers: ['coast', 'borders', 'cities'], limb: 0.5 },
  line: { mode: 0, layers: ['graticule', 'coast', 'cities'], limb: 0.3 },
  relief: { mode: 3, layers: ['coast', 'cities'], limb: 0.42 },
  duotone: { mode: 2, layers: ['coast', 'cities'], limb: 0.5 },
  hex: { mode: 0, layers: ['hexes'], limb: 0.4 },
};

function toVec3(lat: number, lon: number, r = R): THREE.Vector3 {
  const p = (90 - lat) * RAD;
  const t = (lon + 180) * RAD;
  return new THREE.Vector3(
    -r * Math.sin(p) * Math.cos(t),
    r * Math.cos(p),
    r * Math.sin(p) * Math.sin(t),
  );
}

/** A 2D canvas the size asked for, or null if the browser refuses one. */
function canvas2d(w: number, h: number): { el: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  const ctx = el.getContext('2d', { willReadFrequently: true });
  return ctx ? { el, ctx } : null;
}

export interface Globe {
  setLook(look: Look): void;
  setSpin(on: boolean): void;
  refreshTheme(): void;
  flyTo(lat: number, lon: number, distance?: number): void;
  destroy(): void;
}

/**
 * Builds the scene and starts rendering. Resolves once the first frame is up,
 * so the caller can fade the stage in rather than popping it.
 */
export async function createGlobe(
  host: HTMLElement,
  labelLayer: HTMLElement,
  trips: GlobeTrip[],
  initialLook: Look,
): Promise<Globe> {
  const [land, borders, cities, visited] = await Promise.all([
    fetch(`${DATA_BASE}/land.json`).then((r) => r.json() as Promise<GlobeData['land']>),
    fetch(`${DATA_BASE}/borders.json`).then((r) => r.json() as Promise<GlobeData['borders']>),
    fetch(`${DATA_BASE}/cities.json`).then((r) => r.json() as Promise<GlobeData['cities']>),
    fetch(`${DATA_BASE}/visited.json`).then((r) => r.json() as Promise<GlobeData['visited']>),
  ]);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  // The vertical field of view in a landscape frame. resize() widens it for
  // portrait ones so the globe fits the narrower dimension.
  const BASE_FOV = 32;
  const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.01, 100);
  camera.position.copy(toVec3(14, 112, 3.8));

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.rotateSpeed = 0.42;
  controls.enablePan = false;
  controls.minDistance = 1.06;
  controls.maxDistance = 6;
  controls.zoomSpeed = 0.7;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = 0.28;

  /* ---- the globe body --------------------------------------------------- */
  /* One shader covers three of the five looks: flat sea, the land mask, or a
     photograph pushed through a two-colour ramp. The limb term is shared and is
     the only lighting in the scene — enough for the disc to read as a sphere,
     not so much that it looks lit by a sun that is not in the page. */
  const uniforms = {
    uMap: { value: null as THREE.Texture | null },
    uNormal: { value: null as THREE.Texture | null },
    uMode: { value: 0 },
    uSea: { value: new THREE.Color() },
    uLand: { value: new THREE.Color() },
    uLimb: { value: new THREE.Color() },
    uLimbAmount: { value: 0.5 },
  };

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(R, 128, 96),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main() {
          vUv = uv;
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 world = modelMatrix * vec4(position, 1.0);
          vV = normalize(cameraPosition - world.xyz);
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: `
        uniform sampler2D uMap; uniform sampler2D uNormal; uniform int uMode;
        uniform vec3 uSea, uLand, uLimb; uniform float uLimbAmount;
        varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main() {
          vec3 base = uSea;
          if (uMode == 1) {
            base = mix(uLand, uSea, texture2D(uMap, vUv).r);
          } else if (uMode == 2) {
            vec3 t = texture2D(uMap, vUv).rgb;
            float l = dot(t, vec3(0.2126, 0.7152, 0.0722));
            base = mix(uSea, uLand, smoothstep(0.05, 0.40, l));
          } else if (uMode == 3) {
            // Relief. The land/sea split is the same one-bit mask every other
            // look uses; the topography on top of it is a hillshade computed
            // from an elevation-derived normal map. A fixed light from the
            // north-west, which is the cartographic convention — lit from
            // anywhere below and the eye reads ridges as valleys.
            float landMask = 1.0 - texture2D(uMap, vUv).r;
            vec3 n = normalize(texture2D(uNormal, vUv).rgb * 2.0 - 1.0);
            float shade = clamp(dot(n, normalize(vec3(-0.6, 0.7, 0.55))), 0.0, 1.0);
            // Ocean stays flat: the normal map carries bathymetry, and shading
            // the sea floor on a page about hiking is noise.
            float relief = mix(0.5, shade, landMask);
            vec3 land = mix(uLand, mix(uSea, uLand, 1.6), 0.0);
            base = mix(uSea, land, landMask);
            base = mix(base, mix(base, uLimb, 0.85), (0.5 - relief) * 1.15 * landMask);
            base = mix(base, base + (relief - 0.5) * 0.55, landMask);
          }
          float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 2.4);
          gl_FragColor = vec4(mix(base, uLimb, f * uLimbAmount), 1.0);
          // three.js appends its output transform to its own materials only. A
          // ShaderMaterial that writes gl_FragColor itself gets none, and the
          // linear value lands in an sRGB buffer — every colour far too dark,
          // and in the dark theme the whole globe collapses to under 1 L* of
          // separation. Measured, not theoretical.
          #include <colorspace_fragment>
        }`,
    }),
  );
  scene.add(body);

  const layers = new Map<string, THREE.Object3D>();
  function addLayer<T extends THREE.Object3D>(name: string, object: T): T {
    object.visible = false;
    layers.set(name, object);
    scene.add(object);
    return object;
  }

  /* ---- lines ------------------------------------------------------------ */
  /* Geometry, not texture. This is why a stylised globe can be zoomed into at
     all: a line stays one pixel wide at any distance, so the mask being 20 km
     per pixel costs sharpness only on the fill, which has no detail to lose. */
  function ringGeometry(ringList: [number, number][][], radius: number): THREE.BufferGeometry {
    const points: number[] = [];
    for (const ring of ringList) {
      for (let i = 0; i < ring.length - 1; i++) {
        const a = toVec3(ring[i]![1], ring[i]![0], radius);
        const b = toVec3(ring[i + 1]![1], ring[i + 1]![0], radius);
        points.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points), 3));
    return geometry;
  }

  const lineMaterial = (opacity: number): THREE.LineBasicMaterial =>
    new THREE.LineBasicMaterial({ transparent: true, opacity, depthWrite: false });

  const coast: Lines = addLayer('coast', new THREE.LineSegments(
    ringGeometry(land, R * 1.0012), lineMaterial(0.95)));
  const borderLines: Lines = addLayer('borders', new THREE.LineSegments(
    ringGeometry(borders, R * 1.001), lineMaterial(0.5)));

  const graticule: Lines = addLayer('graticule', (() => {
    const points: number[] = [];
    const push = (a: THREE.Vector3, b: THREE.Vector3): void => {
      points.push(a.x, a.y, a.z, b.x, b.y, b.z);
    };
    for (let lat = -75; lat <= 75; lat += 15) {
      for (let lon = -180; lon < 180; lon += 3) {
        push(toVec3(lat, lon, R * 1.0005), toVec3(lat, lon + 3, R * 1.0005));
      }
    }
    for (let lon = -180; lon < 180; lon += 15) {
      for (let lat = -87; lat < 87; lat += 3) {
        push(toVec3(lat, lon, R * 1.0005), toVec3(lat + 3, lon, R * 1.0005));
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points), 3));
    return new THREE.LineSegments(geometry, lineMaterial(0.5));
  })());

  /* ---- the visited footprints ------------------------------------------- */
  /* Flat areas on the sphere: not a pin, not a circle around a coordinate, the
     actual built-up outline. Triangulated in the lon/lat plane and lifted onto
     the sphere — at city scale the error is far under a pixel. */
  const shown = trips.filter((trip) => visited[trip.id]);

  const visitedMaterial = new THREE.MeshBasicMaterial({
    transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide,
  });
  scene.add(new THREE.Mesh((() => {
    const points: number[] = [];
    for (const trip of shown) {
      const ring = visited[trip.id]!.ring.map(([x, y]) => new THREE.Vector2(x, y));
      for (const tri of THREE.ShapeUtils.triangulateShape(ring, [])) {
        for (const index of tri) {
          const v = toVec3(ring[index]!.y, ring[index]!.x, R * 1.0018);
          points.push(v.x, v.y, v.z);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points), 3));
    return geometry;
  })(), visitedMaterial));

  const visitedEdgeMaterial = lineMaterial(1);
  scene.add(new THREE.LineSegments(
    ringGeometry(shown.map((trip) => visited[trip.id]!.ring), R * 1.0022),
    visitedEdgeMaterial,
  ));

  /* ---- markers ----------------------------------------------------------- */
  /* Phuket's built-up area is 76 km²: at a distance where the whole earth is in
     frame it is under half a pixel across, so the footprint that is the entire
     point of the page is invisible exactly when the globe is most useful. Every
     city therefore also carries a marker that never falls below eleven pixels
     and dissolves once the real footprint grows past it, so the two never both
     claim to be the city. */
  const markers: ShaderPoints = addLayer('markers', (() => {
    const position = new Float32Array(shown.length * 3);
    const span = new Float32Array(shown.length);
    shown.forEach((trip, i) => {
      const feature = visited[trip.id]!;
      const v = toVec3(feature.at[0], feature.at[1], R * 1.003);
      position[i * 3] = v.x;
      position[i * 3 + 1] = v.y;
      position[i * 3 + 2] = v.z;
      span[i] = feature.span * RAD;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setAttribute('aSpan', new THREE.BufferAttribute(span, 1));
    return new THREE.Points(geometry, new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color() },
        uRing: { value: new THREE.Color() },
        uDpr: { value: Math.min(devicePixelRatio, 2) },
        uPxPerUnit: { value: 300 },
        uMinPx: { value: 11 },
      },
      vertexShader: `
        attribute float aSpan;
        uniform float uDpr, uPxPerUnit, uMinPx;
        varying float vFade;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float footprintPx = aSpan * uPxPerUnit / max(-mv.z, 0.001);
          vFade = 1.0 - smoothstep(uMinPx * 0.8, uMinPx * 2.2, footprintPx);
          gl_PointSize = uMinPx * uDpr;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor, uRing; varying float vFade;
        void main(){
          float d = length(gl_PointCoord - 0.5) * 2.0;
          if (d > 1.0) discard;
          float core = 1.0 - smoothstep(0.52, 0.68, d);
          float ring = smoothstep(0.68, 0.78, d) * (1.0 - smoothstep(0.9, 1.0, d));
          gl_FragColor = vec4(mix(uRing, uColor, core), vFade * max(core, ring * 0.85));
          #include <colorspace_fragment>
        }`,
    }));
  })());

  /* ---- world cities ------------------------------------------------------ */
  const cityDots: ShaderPoints = addLayer('cities', (() => {
    const position = new Float32Array(cities.length * 3);
    cities.forEach(([lat, lon], i) => {
      const v = toVec3(lat, lon, R * 1.0014);
      position[i * 3] = v.x;
      position[i * 3 + 1] = v.y;
      position[i * 3 + 2] = v.z;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    return new THREE.Points(geometry, new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color() },
        uDpr: { value: Math.min(devicePixelRatio, 2) },
      },
      vertexShader: `
        uniform float uDpr;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(1.7 * (2.2 / -mv.z) * uDpr, 1.0, 7.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          gl_FragColor = vec4(uColor, 0.7 * smoothstep(0.5, 0.2, d));
          #include <colorspace_fragment>
        }`,
    }));
  })());

  /* ---- lattices ---------------------------------------------------------- */
  const dotMaterialFor = (size: number): THREE.ShaderMaterial =>
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uColor: { value: new THREE.Color() },
        uDpr: { value: Math.min(devicePixelRatio, 2) },
        uSize: { value: size },
      },
      vertexShader: `
        uniform float uDpr, uSize;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(uSize * (2.6 / -mv.z) * uDpr, 1.0, 30.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          gl_FragColor = vec4(uColor, smoothstep(0.5, 0.32, d));
          #include <colorspace_fragment>
        }`,
    });

  function pointsFrom(cells: [number, number][], radius: number, size: number): ShaderPoints {
    const position = new Float32Array(cells.length * 3);
    cells.forEach(([lat, lon], i) => {
      const v = toVec3(lat, lon, radius);
      position[i * 3] = v.x;
      position[i * 3 + 1] = v.y;
      position[i * 3 + 2] = v.z;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    return new THREE.Points(geometry, dotMaterialFor(size));
  }

  /* Hexagons are real geometry on the sphere's tangent plane, not screen-facing
     sprites: a sprite keeps its rotation as the globe turns, and the illusion
     of tiles lying on a surface breaks at the limb, which is where a sphere
     most needs it. */
  function hexMesh(cells: [number, number][], radius: number, size: number): BasicMesh {
    const points: number[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    const n = new THREE.Vector3();
    const e = new THREE.Vector3();
    const f = new THREE.Vector3();
    const centre = new THREE.Vector3();
    for (const [lat, lon] of cells) {
      centre.copy(toVec3(lat, lon, radius));
      n.copy(centre).normalize();
      e.crossVectors(up, n).normalize();
      f.crossVectors(n, e).normalize();
      const corners: THREE.Vector3[] = [];
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
        corners.push(new THREE.Vector3().copy(centre)
          .addScaledVector(e, Math.cos(a) * size)
          .addScaledVector(f, Math.sin(a) * size));
      }
      for (let k = 1; k < 5; k++) {
        for (const v of [corners[0]!, corners[k]!, corners[k + 1]!]) points.push(v.x, v.y, v.z);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points), 3));
    return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide,
    }));
  }

  /* ---- the land mask ----------------------------------------------------- */
  /* One black-on-white image, baked at build time. Land is black, sea is white,
     and no palette colour appears in it — which is why a theme change costs two
     uniform writes and no redraw, and why the lattices below cannot be thrown
     off by a palette that is momentarily wrong. */
  const maskTexture = new THREE.Texture();
  const maskImage = await new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = `${DATA_BASE}/land-mask.webp`;
  });

  let isLand: (lon: number, lat: number) => boolean = () => false;
  if (maskImage) {
    maskTexture.image = maskImage;
    maskTexture.colorSpace = THREE.NoColorSpace;   // a data channel, not a picture
    maskTexture.needsUpdate = true;

    const sampler = canvas2d(1024, 512);
    if (sampler) {
      sampler.ctx.drawImage(maskImage, 0, 0, 1024, 512);
      const pixels = sampler.ctx.getImageData(0, 0, 1024, 512).data;
      isLand = (lon, lat) => {
        const x = Math.min(1023, Math.max(0, Math.round(((lon + 180) / 360) * 1024)));
        const y = Math.min(511, Math.max(0, Math.round(((90 - lat) / 180) * 512)));
        // Land is black. A midpoint threshold rather than a colour distance:
        // the downscale has blurred the coast, and a half-covered pixel should
        // fall on whichever side it is mostly on.
        return pixels[(y * 1024 + x) * 4]! < 128;
      };
    }
  }

  /* An equal-area lattice: cells per row fall away with the cosine, so spacing
     on the sphere stays even instead of bunching at the poles. */
  function lattice(rows: number): [number, number][] {
    const cells: [number, number][] = [];
    for (let r = 0; r < rows; r++) {
      const lat = -90 + (r + 0.5) * (180 / rows);
      const n = Math.max(1, Math.round(rows * 2 * Math.cos(lat * RAD)));
      for (let i = 0; i < n; i++) {
        const lon = -180 + (i + 0.5) * (360 / n);
        if (isLand(lon, lat)) cells.push([lat, lon]);
      }
    }
    return cells;
  }

  const dots: ShaderPoints = addLayer('dots', pointsFrom(lattice(260), R * 1.0016, 2.7));
  const hexes: BasicMesh = addLayer('hexes', hexMesh(lattice(88), R * 1.0016, 0.0235));

  /* The city clusters are rasterised, not tested point by point. A global
     lattice fine enough for Phuket would be millions of point-in-polygon tests
     over open ocean; drawing each footprint into its own small canvas at 0.02°
     is 3.6 ms for all eight, against 429 ms for the tests. */
  const visitedDots: ShaderPoints = addLayer('visitedDots', (() => {
    const cells: [number, number][] = [];
    const STEP = 0.02;
    for (const trip of shown) {
      const ring = visited[trip.id]!.ring;
      let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
      for (const [x, y] of ring) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      const w = Math.max(2, Math.ceil((x1 - x0) / STEP));
      const h = Math.max(2, Math.ceil((y1 - y0) / STEP));
      const patch = canvas2d(w, h);
      if (!patch) continue;
      patch.ctx.fillStyle = '#000000';
      patch.ctx.beginPath();
      ring.forEach(([lon, lat], i) => {
        const x = ((lon - x0) / (x1 - x0)) * w;
        const y = ((y1 - lat) / (y1 - y0)) * h;
        if (i) patch.ctx.lineTo(x, y); else patch.ctx.moveTo(x, y);
      });
      patch.ctx.closePath();
      patch.ctx.fill();
      const pixels = patch.ctx.getImageData(0, 0, w, h).data;
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          // Alpha, not colour: the canvas starts transparent, so anything the
          // fill touched is inside the footprint.
          if (pixels[(py * w + px) * 4 + 3]! > 127) {
            cells.push([y1 - ((py + 0.5) / h) * (y1 - y0), x0 + ((px + 0.5) / w) * (x1 - x0)]);
          }
        }
      }
    }
    return pointsFrom(cells, R * 1.0026, 1.5);
  })());

  /* ---- the earth photograph, for the duotone look ------------------------ */
  /* Loaded lazily and only when that look is asked for: it is 301 KB that four
     of the five looks have no use for. */
  let earthTexture: THREE.Texture | null = null;
  let normalTexture: THREE.Texture | null = null;
  const pending = new Map<string, Promise<void>>();

  /** Fetches one optional texture, once, and hands it to the shader if the look
      that wants it is still the one showing. */
  function loadTexture(file: string, colorSpace: THREE.ColorSpace, apply: (t: THREE.Texture) => void): Promise<void> {
    const existing = pending.get(file);
    if (existing) return existing;
    const job = new Promise<void>((resolve) => {
      new THREE.TextureLoader().load(`${DATA_BASE}/${file}`, (texture) => {
        texture.colorSpace = colorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        apply(texture);
        resolve();
      }, undefined, () => resolve());
    });
    pending.set(file, job);
    return job;
  }

  const loadEarth = (): Promise<void> =>
    loadTexture('earth-gray.webp', THREE.SRGBColorSpace, (t) => {
      earthTexture = t;
      if (current === 'duotone') uniforms.uMap.value = t;
    });

  /* The normal map is elevation data, not a picture: no sRGB decode, or every
     slope is shaded from the wrong vector. */
  const loadNormal = (): Promise<void> =>
    loadTexture('earth-normal.webp', THREE.NoColorSpace, (t) => {
      normalTexture = t;
      uniforms.uNormal.value = t;
    });

  /* ---- labels ------------------------------------------------------------ */
  /* Plain DOM anchors over the canvas, so they are real links: keyboard
     reachable, readable by a screen reader, and styled by the page's own
     stylesheet rather than drawn into the GL scene. */
  interface Label { el: HTMLAnchorElement; v: THREE.Vector3; w: number; h: number }
  const labels: Label[] = shown.map((trip) => {
    const a = document.createElement('a');
    a.className = 'globe__label';
    a.href = trip.href;
    const name = document.createElement('span');
    name.className = 'globe__label-name';
    name.textContent = trip.label;
    const when = document.createElement('span');
    when.className = 'globe__label-when';
    when.textContent = trip.when;
    a.append(name, when);
    labelLayer.append(a);
    const feature = visited[trip.id]!;
    return { el: a, v: toVec3(feature.at[0], feature.at[1], R * 1.004), w: 0, h: 0 };
  });

  const projected = new THREE.Vector3();
  const placedBoxes: { x0: number; x1: number; y0: number; y1: number }[] = [];

  function placeLabels(width: number, height: number): void {
    const camDir = camera.position.clone().normalize();
    const wanted = labels.map((label) => {
      projected.copy(label.v);
      const facing = projected.clone().normalize().dot(camDir);
      projected.project(camera);
      return {
        label,
        facing,
        x: (projected.x * 0.5 + 0.5) * width,
        y: (-projected.y * 0.5 + 0.5) * height,
      };
    });

    // Six of the eight cities sit inside one 2,000 km square, so at globe scale
    // their labels land on top of each other. Greedy declutter: the one most
    // squarely facing the camera keeps its space and anything overlapping it is
    // hidden — hidden rather than faded, because a link that cannot be read
    // must not be clickable either.
    wanted.sort((a, b) => b.facing - a.facing);
    placedBoxes.length = 0;
    for (const { label, facing, x, y } of wanted) {
      if (facing <= 0.12) {
        label.el.style.visibility = 'hidden';
        continue;
      }
      if (!label.w) {
        label.w = label.el.offsetWidth;
        label.h = label.el.offsetHeight;
      }
      const box = { x0: x - label.w / 2, x1: x + label.w / 2, y0: y - label.h * 1.4, y1: y - label.h * 0.4 };
      const clash = placedBoxes.some((p) =>
        box.x0 < p.x1 + 4 && box.x1 > p.x0 - 4 && box.y0 < p.y1 + 3 && box.y1 > p.y0 - 3);
      label.el.style.visibility = clash ? 'hidden' : 'visible';
      if (clash) continue;
      placedBoxes.push(box);
      label.el.style.opacity = String(Math.min(1, (facing - 0.12) * 5));
      label.el.style.transform =
        `translate(-50%,-140%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
    }
  }

  /* ---- theme ------------------------------------------------------------- */
  let pal: Palette = palette(host);

  function paint(): void {
    pal = palette(host);
    uniforms.uSea.value.set(pal.sea);
    uniforms.uLand.value.set(pal.land);
    uniforms.uLimb.value.set(pal.limb);
    coast.material.color.set(pal.coast);
    borderLines.material.color.set(pal.border);
    graticule.material.color.set(pal.graticule);
    cityDots.material.uniforms.uColor!.value.set(pal.city);
    markers.material.uniforms.uColor!.value.set(pal.visited);
    markers.material.uniforms.uRing!.value.set(pal.ground);
    dots.material.uniforms.uColor!.value.set(pal.dot);
    visitedDots.material.uniforms.uColor!.value.set(pal.visited);
    hexes.material.color.set(pal.dot);
    visitedMaterial.color.set(pal.visited);
    visitedEdgeMaterial.color.set(pal.visitedEdge);
  }

  /* ---- look -------------------------------------------------------------- */
  let current: Look = initialLook;

  function applyLook(look: Look): void {
    current = look;
    const recipe = LOOK_RECIPES[look];
    uniforms.uMode.value = recipe.mode;
    uniforms.uMap.value = recipe.mode === 2 ? earthTexture : maskTexture;
    uniforms.uNormal.value = normalTexture;
    uniforms.uLimbAmount.value = recipe.limb;
    const on = new Set([...recipe.layers, 'markers']);
    for (const [name, object] of layers) object.visible = on.has(name);
    // In the dot look the footprint fill would sit under a dot cluster saying
    // the same thing twice; the outline plus a hint of fill is cleaner.
    visitedMaterial.opacity = look === 'dots' ? 0.28 : 0.92;
    if (look === 'duotone') void loadEarth();
    if (look === 'relief') void loadNormal();
  }

  /* ---- resize and tick ---------------------------------------------------- */
  let width = 0;
  let height = 0;

  function resize(): void {
    const rect = host.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;

    // A perspective camera's `fov` is the *vertical* angle, so as the frame
    // narrows the horizontal view narrows with it and a globe that fits the
    // height spills out of the width. At 390px that clipped Asia off both
    // sides. Widening the vertical angle by the aspect keeps the horizontal
    // angle fixed instead, so the sphere fits whichever dimension is smaller.
    const fit = Math.min(1, camera.aspect);

    // A portrait frame gets a little more room than a landscape one. In
    // landscape the globe is limited by height and there is spare width for a
    // label near the limb to sit in; in portrait there is none, and the disc
    // would graze the sides.
    const pad = camera.aspect < 1 ? 1.04 : 1;
    camera.fov = 2 * Math.atan((Math.tan((BASE_FOV / 2) * RAD) * pad) / fit) / RAD;
    camera.updateProjectionMatrix();

    markers.material.uniforms.uPxPerUnit!.value = (height / 2) / Math.tan((camera.fov / 2) * RAD);
  }

  // Observing the element, not the window. The stage is sized by CSS that can
  // change after this runs, and measuring once at boot is how the camera ends
  // up with a 1280:1 aspect and the earth renders as a vertical line.
  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(host);

  /* ---- who gets the wheel ------------------------------------------------- */
  /* OrbitControls calls preventDefault on the wheel, which stops the *browser*
     scrolling — but the site scrolls with Lenis, and Lenis has its own window
     listener that preventDefault does nothing about. So the page moved while
     the globe zoomed. Lenis honours data-lenis-prevent on an ancestor of the
     event target, and this sets it.
   *
   * It is set conditionally, not once in the markup, because a region that
   * eats the wheel forever is the classic embedded-map trap: reach the end of
   * the zoom and the page is stuck under your cursor. At either limit the
   * attribute comes off and the next wheel event scrolls the page normally. */
  const EPS = 0.02;
  function updateWheelOwner(deltaY: number): void {
    const distance = camera.position.length();
    const zoomingOut = deltaY > 0;
    const canZoom = zoomingOut
      ? distance < controls.maxDistance - EPS
      : distance > controls.minDistance + EPS;
    if (canZoom) host.dataset.lenisPrevent = '';
    else delete host.dataset.lenisPrevent;
  }

  renderer.domElement.addEventListener('wheel', (event) => updateWheelOwner(event.deltaY), {
    capture: true,
    passive: true,
  });

  // Leaving with the attribute set would keep the page's own wheel suppressed
  // over an element the pointer is no longer on.
  renderer.domElement.addEventListener('pointerleave', () => {
    delete host.dataset.lenisPrevent;
  });

  let fly: { from: THREE.Vector3; to: THREE.Vector3; t: number } | null = null;
  // THREE.Clock is deprecated in r18x, and a timestamp is what it wrapped.
  let lastFrame = performance.now();

  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    if (fly) {
      fly.t = Math.min(1, fly.t + dt * 1.1);
      camera.position.lerpVectors(fly.from, fly.to, 1 - (1 - fly.t) ** 3);
      if (fly.t >= 1) fly = null;
    }
    controls.update();
    // Exposed for the wheel-ownership test in the harness; harmless otherwise.
    (window as unknown as { __globeDistance: number }).__globeDistance =
      Math.round(camera.position.length() * 100) / 100;
    renderer.render(scene, camera);
    placeLabels(width, height);
  });

  resize();
  paint();
  applyLook(initialLook);
  renderer.render(scene, camera);

  return {
    setLook: applyLook,
    setSpin(on) { controls.autoRotate = on; },
    refreshTheme: paint,
    flyTo(lat, lon, distance = 1.6) {
      fly = { from: camera.position.clone(), to: toVec3(lat, lon, distance), t: 0 };
    },
    destroy() {
      resizeObserver.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      for (const label of labels) label.el.remove();
    },
  };
}
