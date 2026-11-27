# Trip photos

## The photo in the panel beside the globe

Put one photo in the trip's folder and call it `cover.jpg`. That is all: there is
nothing to edit, and it shows after the next build.

```
src/assets/travel/tokyo/cover.jpg
```

`.jpg`, `.jpeg`, `.png`, `.webp` and `.avif` work. An iPhone's `.heic` does not, so
export it as JPG first. Any shape works: the photo fills its frame and is cropped
from the middle. Use the original, not a resized copy.

The folder has to be named after the trip's markdown file in `src/content/trips/`:
`tokyo.md`, so `tokyo`. A folder that names no trip fails the build, and the error
lists the names it could have had. A folder with photos but no `cover` gets a warning
in the build's output.

The build publishes resized copies with the photo's location data removed, never the
original. The original is still in the repository, location data included.

## The travel timeline and the trip's own page

These need a description of the photo as well, so they read it from the trip's
frontmatter. One folder per trip, named after the markdown file in
`src/content/trips/`:

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

A `cover` set here is also the one the panel shows. The schema fails the build on a
cover with no `coverAlt`, and on a gallery entry with no `alt`. Upload the originals — do not pre-resize; that is what the build
is for.
