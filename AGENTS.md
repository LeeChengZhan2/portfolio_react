# Repository Guidelines

## Project Structure & Module Organization
- App code lives in `src/` (entry: `src/index.jsx`, root: `src/App.jsx`).
- UI is organized by feature folders: `src/components/<Name>/<Name>.jsx|.css`.
- Global styles: `src/index.css` (Tailwind directives) and `src/App.css`.
- Static files and SEO assets: `public/` (HTML, manifest, images, docs).
- Tailwind config: `tailwind.config.js` (content scans `src/**/*.{js,jsx}`).

## Build, Test, and Development Commands
- `npm start` — Start CRA dev server with fast refresh.
- `npm run build` — Production build to `build/`.
- `npm test` — Jest in watch mode via `react-scripts`.
- `npm run deploy` — Publish `build/` to GitHub Pages (requires repo access). The `homepage` field in `package.json` controls the deploy path.

## Coding Style & Naming Conventions
- Use React 18 with functional components and hooks.
- Components and files: PascalCase (e.g., `Header.jsx`, `Portfolio.jsx`).
- One component per folder with co-located styles: `components/Header/Header.css`.
- Indentation: 2 spaces; prefer single quotes in JS/JSX.
- Styling: Tailwind utility classes + small scoped CSS files when needed.
- Linting: CRA’s ESLint config (`react-app`). Run via `npm start`/`npm test` to see warnings.

## Testing Guidelines
- Framework: Jest + React Testing Library (installed via `react-scripts`).
- File names: `*.test.jsx` next to the unit under test (e.g., `Header.test.jsx`).
- Favor user-centric queries (RTL) and avoid testing implementation details.
- Aim to include/update tests when changing component logic or utilities.
- Run all tests locally: `npm test` (press `a` to run all).

## Commit & Pull Request Guidelines
- Commits: concise, imperative subject (e.g., "Add header nav animation").
- Scope changes logically; avoid mixing refactors with features.
- PRs should include: summary of changes, screenshots/GIFs for UI, steps to test, and linked issue (if any).
- Ensure `npm run build` and `npm test` pass before requesting review.

## Security & Configuration Tips
- Do not commit secrets; this app is static and uses public assets only.
- When updating deploy URL, keep `package.json:homepage` in sync with GitHub Pages settings.
