import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// NOTE: `site` must match the final production origin — it is what sitemap
// and canonical URLs are built from. Update this the moment the domain is
// registered. See docs/REBUILD.md §12.
export default defineConfig({
  site: 'https://leechengzhan.com',
  trailingSlash: 'never',
  integrations: [react(), sitemap()],
  build: {
    // Emit /about.html rather than /about/index.html so the site works on
    // any static host without directory-index rewriting.
    format: 'file',
  },
  vite: {
    // Tailwind v4 ships as a Vite plugin — there is no Astro integration
    // and no tailwind.config.js. Theme lives in src/styles/global.css.
    plugins: [tailwindcss()],
  },
});
