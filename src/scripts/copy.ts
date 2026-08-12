/**
 * Clipboard buttons.
 *
 * This began as a React island (CopyButton.tsx) and was converted after
 * measuring it: the footer is on every page, so hydrating one island there
 * pulled the React runtime — ~55 KB gzipped — onto every single page for
 * three buttons. The whole feature is DOM work, so React bought nothing.
 *
 * The carousel remains a React island: real state, one page only.
 * See docs/REBUILD.md §8.2.
 *
 * Fixes three faults in the legacy Footer.jsx version:
 *   - it was an <img onClick>, so neither focusable nor keyboard-operable
 *   - navigator.clipboard was called unguarded, and "Copied!" appeared even
 *     when the write threw (it is undefined on insecure origins)
 *   - the reset timeout was never cleared
 *
 * One delegated listener handles every button, so adding buttons costs nothing.
 */

const RESET_MS = 1800;
const timers = new WeakMap<HTMLElement, number>();

function setStatus(button: HTMLElement, text: string, tone: "ok" | "warn" | "idle"): void {
  const status = button.parentElement?.querySelector<HTMLElement>("[data-copy-status]");
  if (!status) return;

  status.textContent = text;
  if (tone === "idle") {
    delete status.dataset.tone;
  } else {
    status.dataset.tone = tone;
  }

  window.clearTimeout(timers.get(button));
  if (tone !== "idle") {
    timers.set(
      button,
      window.setTimeout(() => setStatus(button, "", "idle"), RESET_MS),
    );
  }
}

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement | null;
  const button = target?.closest<HTMLElement>("[data-copy]");
  if (!button) return;

  const value = button.dataset.copy;
  if (!value) return;

  void (async () => {
    try {
      if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(value);
      setStatus(button, "Copied", "ok");
    } catch {
      // Insecure origin, denied permission, or an unsupported browser.
      setStatus(button, "Press Ctrl+C", "warn");
    }
  })();
});
