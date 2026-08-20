# Trip photos

One folder per trip, named after the markdown file in `src/content/trips/`:

```
src/assets/travel/bangkok/cover.jpg
src/assets/travel/bangkok/01.jpg
```

They live here rather than in `public/` so Astro processes them — width/height
are baked into the markup (no layout shift), the files are hashed, and modern
formats are emitted. `public/` copies bytes through untouched, which is right
for a PDF and wrong for a photo.

Reference them from the trip's frontmatter with a path relative to the markdown
file, and give every one an `alt`:

```yaml
cover: ../../assets/travel/bangkok/cover.jpg
coverAlt: Boats moored along a canal in the late afternoon
gallery:
  - src: ../../assets/travel/bangkok/01.jpg
    alt: A street food stall under strip lighting
```

The schema fails the build on a cover with no `coverAlt`, and on a gallery entry
with no `alt`. Upload the originals — do not pre-resize; that is what the build
is for.
