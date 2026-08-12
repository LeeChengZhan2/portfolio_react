# Repository Guidelines

> ⚠️ **Out of date as of 12 Aug 2026.** Everything below describes the pre-rebuild Create
> React App setup. That code now lives in `legacy/` and none of these commands exist
> (`npm start`, `npm test`, and `npm run deploy` were all removed with `react-scripts`).
> For current structure, commands, and conventions see [CLAUDE.md](CLAUDE.md).
> This file is rewritten in phase 6 — see [docs/REBUILD.md](docs/REBUILD.md) §10.

## Project Structure & Module Organization
Application code lives in `src/`. The React entry point is `src/index.jsx`, with app-level wiring in `src/App.jsx` and shared styles in `src/index.css` and `src/App.css`. Feature UI is organized by component folder under `src/components/`, for example `src/components/Header/Header.jsx` with its paired `Header.css`. Static assets, the HTML shell, manifest, and downloadable files live in `public/`, mainly under `public/assets/`.

## Build, Test, and Development Commands
- `npm start` starts the Create React App dev server with fast refresh.
- `npm run build` creates the production bundle in `build/`.
- `npm test` runs Jest through `react-scripts`; press `a` in watch mode to run all tests.
- `npm run deploy` publishes `build/` to GitHub Pages using `gh-pages`. The deploy target is controlled by `package.json` `homepage`.

## Coding Style & Naming Conventions
Use React 18 functional components and hooks. Keep indentation to 2 spaces and prefer single quotes in JS and JSX. Name components and component files in PascalCase, such as `Portfolio.jsx`, and keep one component per folder with co-located CSS. Use Tailwind utilities for layout and spacing, then add small scoped CSS files when component-specific styling is clearer. CRA ESLint rules are active through `react-scripts`.

## Testing Guidelines
Testing uses Jest and React Testing Library via `react-scripts`. Place tests next to the unit under test using `*.test.jsx`, for example `src/components/Header/Header.test.jsx`. Prefer user-facing queries and avoid coupling tests to implementation details. When changing component behavior, add or update tests before merging.

## Commit & Pull Request Guidelines
Recent commits follow short, imperative subjects such as `improve the scrolling effect` and `add icon in tab`. Keep commits focused on one logical change. Pull requests should include a brief summary, screenshots or GIFs for UI updates, steps to verify locally, and any linked issue or context needed by reviewers.

## Security & Configuration Tips
Do not commit secrets; this is a static frontend and should rely on public assets only. If GitHub Pages settings change, keep `package.json` `homepage` aligned with the published repository path.
