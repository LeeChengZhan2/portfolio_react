/**
 * Theme toggle.
 *
 * Light is the default. The OS is deliberately not consulted — a visitor on a
 * dark-themed machine still gets the light site until they press the toggle.
 * Dark is opt-in, it persists in localStorage, and that is the only way in.
 *
 * The initial paint is NOT decided here. BaseLayout's inline head script adds
 * `.dark` before first paint when localStorage says to, because anything
 * module-loaded runs after paint and would flash light first. This file only
 * handles the click.
 *
 * A delegated listener rather than a React island, for the same reason copy.ts
 * is one: the toggle lives in the header, the header is on all ten pages, and a
 * single island there would pull the ~55 KB React runtime onto every one of
 * them. See CLAUDE.md § Islands.
 *
 * Two-state on purpose. There is no "follow my OS" option, so there is no third
 * state to cycle through and no ambiguity about what the button does.
 */

const STORAGE_KEY = "theme";

const COLORS = { dark: "#0d0d0f", light: "#ffffff" } as const;

const root = document.documentElement;

/** `.dark` is the only theme class — see the comment in global.css. */
function isDark(): boolean {
  return root.classList.contains("dark");
}

/** Announces the current theme on every toggle button. */
function syncButtons(dark: boolean): void {
  for (const button of document.querySelectorAll<HTMLElement>("[data-theme-toggle]")) {
    button.setAttribute("aria-pressed", String(dark));
    button.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  }
}

function apply(dark: boolean): void {
  root.classList.toggle("dark", dark);

  document
    .getElementById("theme-color")
    ?.setAttribute("content", dark ? COLORS.dark : COLORS.light);

  syncButtons(dark);
}

// Announce the theme the page is already showing. The markup ships the light
// wording, so without this a visitor who stored dark would hear the toggle
// offer to switch to dark when it would actually switch to light.
syncButtons(isDark());

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement | null;
  if (!target?.closest("[data-theme-toggle]")) return;

  const dark = !isDark();
  apply(dark);

  try {
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  } catch {
    // Private browsing can refuse writes. The toggle still works for this page
    // view; it just will not be remembered on the next one.
  }
});
