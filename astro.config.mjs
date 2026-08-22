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
  integrations: [
    react(),
    // The theme-preview pages are noindex, and a noindex page in the sitemap is
    // a contradiction a crawler reports back at you. Delete this filter when
    // src/pages/theme-preview/ goes — it is throwaway.
    sitemap({ filter: (page) => !new URL(page).pathname.startsWith('/theme-preview') }),
  ],
  build: {
    // Emit /about.html rather than /about/index.html so the site works on
    // any static host without directory-index rewriting.
    format: 'file',
  },
  vite: {
    // Tailwind v4 ships as a Vite plugin — there is no Astro integration
    // and no tailwind.config.js. Theme lives in src/styles/global.css.
    plugins: [tailwindcss()],

    // Dev only, and it fixes a real failure rather than tuning anything.
    // `gsap` and `@gsap/react` are reached from the Carousel island, which is
    // `client:visible` — so Vite does not see them until the carousel scrolls
    // into view, mid-session. Discovering a dep that late forces a re-optimize,
    // which changes the dep hash and turns the island's in-flight import into
    // `504 (Outdated Optimize Dep)`. The island then never hydrates: the
    // carousel renders its three static cards and does not move. Pre-bundling
    // them at server start means there is nothing left to discover.
    // Production builds never had this — they resolve the whole graph up front.
    optimizeDeps: {
      include: ['gsap', 'gsap/ScrollTrigger', '@gsap/react'],
    },
  },
});
