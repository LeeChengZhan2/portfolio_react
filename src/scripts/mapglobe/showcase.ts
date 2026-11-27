/**
 * Bootstrap for the SHOWCASE section — the redesigned MapLibre earth that sits
 * under the original one on /about/travel-preview (24 Nov 2026).
 *
 * Eager and deliberately tiny. It finds the section, waits until it is a screen
 * away, and only then imports the app, which imports the engine. A visitor who
 * reads the timeline and leaves pays for this file and nothing else — the same
 * deferral the original section gets from its own IntersectionObserver, and the
 * same reason neither is a React island.
 *
 * The app and the engine are reached ONLY through dynamic imports. A static
 * value import from either would hoist MapLibre into the page's eager bundle;
 * see "Never statically import a value from a lazily-imported engine" in
 * CLAUDE.md, which this page has paid for once already.
 */
const root = document.querySelector<HTMLElement>('[data-xp]');

if (root) {
  const status = root.querySelector<HTMLElement>('[data-xp-status]');

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      if (status) status.textContent = 'Drawing the map';
      import('./showcase-app')
        .then(({ startShowcase }) => startShowcase(root))
        .catch((error: unknown) => {
          // A map that fails is not a page that fails: the timeline above is
          // the content, and the map is an illustration of it.
          root.dataset.state = 'failed';
          if (status) status.textContent = 'The map could not be drawn. The trips above are unaffected.';
          console.error('showcase: failed to start', error);
        });
    },
    { rootMargin: '600px 0px' },
  );
  observer.observe(root);
}
