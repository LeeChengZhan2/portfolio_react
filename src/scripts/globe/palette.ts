/**
 * The globe's colours, derived from the page rather than chosen.
 *
 * Nothing here is a constant. Every element steps a fixed *perceptual* distance
 * from whatever is painted behind the canvas toward the page's text colour, in
 * OKLab. That is what lets one globe sit correctly in all nine themes: on
 * Classic the sea is a light grey, on Sepia a warm tan, in dark a lift off
 * near-black — and in dark the ramp inverts on its own, because the colour it
 * walks toward is now the light one.
 *
 * OKLab and not hex arithmetic: sRGB gamma compresses the bottom of the range,
 * so equal hex steps are not equal visual steps down there. This is the same
 * reasoning behind the dark theme's ramp in global.css.
 */

export interface Palette {
  ground: string;
  sea: string;
  land: string;
  coast: string;
  border: string;
  graticule: string;
  dot: string;
  city: string;
  visited: string;
  visitedEdge: string;
  limb: string;
}

type Rgb = [number, number, number];
type Lab = [number, number, number];

const srgbToLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

const linearToSrgb = (c: number): number =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;

function hexToRgb(hex: string): Rgb {
  const h = hex.trim().replace('#', '');
  const n = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255) as Rgb;
}

function rgbToOklab([r, g, b]: Rgb): Lab {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToRgb([L, a, b]: Lab): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ].map((c) => Math.min(1, Math.max(0, c))) as Rgb;
}

const toHex = (rgb: Rgb): string =>
  '#' + rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('');

/** Mix two colours in OKLab. `t` of 0 is `a`, 1 is `b`. */
export function mix(a: string, b: string, t: number): string {
  const A = rgbToOklab(hexToRgb(a));
  const B = rgbToOklab(hexToRgb(b));
  return toHex(oklabToRgb(A.map((v, i) => v + (B[i]! - v) * t) as Lab));
}

/** Perceptual lightness, 0–100. Used by the contrast probe, not at runtime. */
export const lightness = (hex: string): number => rgbToOklab(hexToRgb(hex))[0] * 100;

/**
 * How far each layer steps from the ground toward the text colour. This table
 * is the entire visual design; every look reads from it.
 */
const STEPS = {
  sea: 0.1,
  land: 0.2,
  coast: 0.5,
  border: 0.15,
  graticule: 0.1,
  dot: 0.34,
  city: 0.3,
} as const;

/** Reads a CSS custom property off an element, resolving to a usable hex. */
function token(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  const raw = styles.getPropertyValue(name).trim();
  if (raw.startsWith('#')) return raw;
  // A token can resolve to rgb() — Tailwind emits either depending on the
  // value's origin — and the mixer only speaks hex.
  const m = /rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(raw);
  if (!m) return fallback;
  return '#' + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('');
}

/**
 * The colour actually painted behind the canvas. The stage is transparent, so
 * this walks up until it finds something painted: a globe inset into a band has
 * to step off the band, not off the page, or its sea merges with its own frame.
 */
export function groundColour(from: HTMLElement): string {
  for (let el: HTMLElement | null = from; el; el = el.parentElement) {
    const c = getComputedStyle(el).backgroundColor;
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(c);
    if (m && (m[4] === undefined || Number(m[4]) > 0.01)) {
      return '#' + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('');
    }
  }
  return '#ffffff';
}

/** Build every colour the globe uses out of the page's current theme. */
export function palette(host: HTMLElement): Palette {
  const root = getComputedStyle(document.documentElement);
  const fg = token(root, '--color-fg', '#111827');
  const accent = token(root, '--color-accent', '#002fa7');
  const ground = groundColour(host);
  const step = (t: number): string => mix(ground, fg, t);

  return {
    ground,
    sea: step(STEPS.sea),
    land: step(STEPS.land),
    coast: step(STEPS.coast),
    border: step(STEPS.border),
    graticule: step(STEPS.graticule),
    dot: step(STEPS.dot),
    city: step(STEPS.city),
    // The one colour that is not derived: the visited cities are the page's own
    // accent, because they are the only thing here meant to be looked at first.
    visited: accent,
    visitedEdge: mix(accent, fg, 0.25),
    limb: step(0.3),
  };
}
