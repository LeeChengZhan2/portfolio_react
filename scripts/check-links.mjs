#!/usr/bin/env node
/**
 * Post-build link checker.
 *
 * You asked for tests only where they earn their place. A component test suite
 * on a static content site mostly re-asserts that Astro renders HTML. The bug
 * class that actually bit this project was dead links: seven header dropdown
 * anchors pointing at IDs that never existed, and two download links 404ing in
 * production because they missed the base path.
 *
 * TypeScript and the zod content schemas already cover shape errors at build
 * time. This covers the rest: every internal href in dist/ resolves to a real
 * file, a real fragment, or a real asset.
 *
 * Run: npm run links   (after npm run build)
 */

import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const DIST = 'dist';
const PUBLIC = 'public';

/** @param {string} dir */
async function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

if (!existsSync(DIST)) {
  console.error(`✗ ${DIST}/ not found — run \`npm run build\` first.`);
  process.exit(1);
}

const files = await walk(DIST);
const htmlFiles = files.filter((f) => extname(f) === '.html');

/** Every path this build can actually serve. */
const served = new Set();
for (const file of files) {
  const rel = relative(DIST, file).split('\\').join('/');
  served.add(`/${rel}`);
  if (rel.endsWith('.html')) {
    served.add(`/${rel.slice(0, -'.html'.length)}`);
    if (rel.endsWith('/index.html')) served.add(`/${rel.slice(0, -'index.html'.length)}`);
  }
}
served.add('/');

/** @type {{file: string, href: string, reason: string}[]} */
const broken = [];
let checked = 0;

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const pageRel = `/${relative(DIST, file).split('\\').join('/')}`;

  // Collect ids present on this page, for fragment checks.
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

  for (const match of html.matchAll(/(?:href|src)="([^"]*)"/g)) {
    const raw = match[1];
    if (!raw) continue;

    // Skip anything not an internal path.
    if (/^(?:https?:|mailto:|tel:|data:|blob:|#\s*$|\/\/)/.test(raw)) continue;
    if (!raw.startsWith('/') && !raw.startsWith('#')) continue;

    checked++;

    // Same-page fragment.
    if (raw.startsWith('#')) {
      const id = decodeURIComponent(raw.slice(1));
      if (id && !ids.has(id)) {
        broken.push({ file: pageRel, href: raw, reason: 'no element with that id on this page' });
      }
      continue;
    }

    const [pathPart, fragment] = raw.split('#');
    const clean = decodeURIComponent((pathPart || '/').split('?')[0]);

    const resolves =
      served.has(clean) ||
      served.has(`${clean}.html`) ||
      served.has(`${clean}/index.html`) ||
      existsSync(join(PUBLIC, clean));

    if (!resolves) {
      broken.push({ file: pageRel, href: raw, reason: 'target not found in dist/ or public/' });
      continue;
    }

    // Cross-page fragment: verify the id exists in the target document.
    if (fragment) {
      const candidates = [
        join(DIST, clean),
        join(DIST, `${clean}.html`),
        join(DIST, clean, 'index.html'),
      ];
      const target = candidates.find((c) => existsSync(c) && extname(c) === '.html');
      if (target) {
        const targetHtml = await readFile(target, 'utf8');
        if (!new RegExp(`\\sid="${fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(targetHtml)) {
          broken.push({ file: pageRel, href: raw, reason: `#${fragment} not found in target page` });
        }
      }
    }
  }
}

console.log(`Checked ${checked} internal links across ${htmlFiles.length} pages.`);

if (broken.length === 0) {
  console.log('✓ All internal links resolve.');
  process.exit(0);
}

console.error(`\n✗ ${broken.length} broken link${broken.length === 1 ? '' : 's'}:\n`);
for (const { file, href, reason } of broken) {
  console.error(`  ${file}\n    → ${href}\n      ${reason}\n`);
}
process.exit(1);
