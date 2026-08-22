/**
 * Theme controls: the dark toggle, and the light-theme picker beside it.
 *
 * Two independent axes, stored separately.
 *
 *   `theme`       "dark" | "light"  — which axis the site is on
 *   `light-theme` a LIGHT_THEMES id — which light palette to use when it is light
 *
 * Keeping them apart is what lets a light choice survive a trip through dark
 * and come back when dark is switched off. A single "current theme" key would
 * have to forget one to remember the other.
 *
 * The OS is deliberately not consulted on either axis. Light is the default,
 * Classic is the default light theme, and both change only when a control is
 * pressed.
 *
 * The initial paint is NOT decided here. BaseLayout's inline head script
 * applies both stored choices before first paint, because anything
 * module-loaded runs after paint and would flash the wrong theme. This file
 * handles interaction, and corrects the ARIA state the static markup could not
 * know at build time.
 *
 * Delegated listeners rather than a React island, for the same reason copy.ts
 * is one: these live in the header, the header is on every page, and a single
 * island there would pull the ~55 KB React runtime onto all of them.
 * See CLAUDE.md § Islands.
 */

import { DEFAULT_THEME_ID, THEME_IDS } from "../lib/themes";

const THEME_KEY = "theme";
const LIGHT_THEME_KEY = "light-theme";

const root = document.documentElement;

/** localStorage throws outright in some privacy modes. Nothing here is
 *  important enough to take the page down with it. */
function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The control still works for this page view; it just is not remembered.
  }
}

/* -------------------------------------------------------------------------
 * Dark axis
 * ------------------------------------------------------------------------- */

/** `.dark` is the only dark class — see the comment in global.css. */
function isDark(): boolean {
  return root.classList.contains("dark");
}

/** Announces the current theme on every toggle button. */
function syncToggles(dark: boolean): void {
  for (const button of document.querySelectorAll<HTMLElement>("[data-theme-toggle]")) {
    button.setAttribute("aria-pressed", String(dark));
    button.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  }
}

/**
 * The browser-chrome colour, read back off the resolved page rather than kept
 * in a lookup table. There are nine palettes now; a table of their backgrounds
 * here would be a second copy of values that live in global.css, and it would
 * be wrong the first time a hex changed there.
 */
function syncThemeColor(): void {
  const bg = getComputedStyle(root).getPropertyValue("--color-bg").trim();
  if (bg) document.getElementById("theme-color")?.setAttribute("content", bg);
}

function applyDark(dark: boolean): void {
  root.classList.toggle("dark", dark);
  syncToggles(dark);
  syncThemeColor();
}

/* -------------------------------------------------------------------------
 * Light axis
 * ------------------------------------------------------------------------- */

function currentLightTheme(): string {
  for (const id of THEME_IDS) {
    if (id !== DEFAULT_THEME_ID && root.classList.contains(`theme-${id}`)) return id;
  }
  return DEFAULT_THEME_ID;
}

/** Marks the chosen item in every picker. The static markup ships
 *  `aria-checked="false"` throughout, since the build cannot know the choice. */
function syncPickers(id: string): void {
  for (const item of document.querySelectorAll<HTMLElement>("[data-theme-option]")) {
    item.setAttribute("aria-checked", String(item.dataset.theme === id));
  }
}

function applyLightTheme(id: string): void {
  for (const other of THEME_IDS) {
    if (other !== DEFAULT_THEME_ID) root.classList.remove(`theme-${other}`);
  }
  if (id !== DEFAULT_THEME_ID) root.classList.add(`theme-${id}`);

  // Picking a light theme while the site is dark would change nothing you can
  // see, and the picker would look broken. Leave dark, and remember that we
  // did — otherwise the next page load would drop straight back into it.
  if (isDark()) {
    applyDark(false);
    store(THEME_KEY, "light");
  }

  syncPickers(id);
  syncThemeColor();
}

/* -------------------------------------------------------------------------
 * Menu
 * ------------------------------------------------------------------------- */

function closeMenus(): void {
  for (const picker of document.querySelectorAll<HTMLElement>("[data-theme-picker][data-open]")) {
    picker.removeAttribute("data-open");
    picker
      .querySelector("[data-theme-menu-button]")
      ?.setAttribute("aria-expanded", "false");
  }
}

function toggleMenu(picker: HTMLElement): void {
  const open = picker.hasAttribute("data-open");
  closeMenus();
  if (open) return;

  picker.setAttribute("data-open", "");
  picker.querySelector("[data-theme-menu-button]")?.setAttribute("aria-expanded", "true");
}

/* -------------------------------------------------------------------------
 * Wiring
 * ------------------------------------------------------------------------- */

// Announce what the page is already showing. The markup ships the light
// wording and an unchecked picker, so without this a visitor who stored a
// theme would be told the opposite of what they are looking at.
syncToggles(isDark());
syncPickers(currentLightTheme());
syncThemeColor();

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement | null;

  const toggle = target?.closest("[data-theme-toggle]");
  if (toggle) {
    const dark = !isDark();
    applyDark(dark);
    store(THEME_KEY, dark ? "dark" : "light");
    return;
  }

  const option = target?.closest<HTMLElement>("[data-theme-option]");
  if (option) {
    const id = option.dataset.theme;
    // Guard the stored value as well as the class: everything downstream
    // trusts that this string names a real theme.
    if (id && THEME_IDS.includes(id)) {
      applyLightTheme(id);
      store(LIGHT_THEME_KEY, id);
    }
    closeMenus();
    return;
  }

  const button = target?.closest<HTMLElement>("[data-theme-menu-button]");
  if (button) {
    const picker = button.closest<HTMLElement>("[data-theme-picker]");
    if (picker) toggleMenu(picker);
    return;
  }

  // Anywhere else, including inside the menu's padding, dismisses it.
  closeMenus();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;

  const open = document.querySelector<HTMLElement>("[data-theme-picker][data-open]");
  if (!open) return;

  closeMenus();
  // Focus goes back to the control that opened the menu, or it is stranded on
  // an element that is now invisible.
  open.querySelector<HTMLElement>("[data-theme-menu-button]")?.focus();
});

// Tabbing out of the menu closes it, so it cannot sit open behind the page
// while focus is somewhere else entirely.
document.addEventListener("focusin", (event) => {
  const target = event.target as HTMLElement | null;
  if (target?.closest("[data-theme-picker]")) return;
  closeMenus();
});
