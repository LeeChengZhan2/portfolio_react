/**
 * The state machine behind the interaction mock-up on /about/travel-preview.
 *
 * This drives a DIAGRAM, not a map. There is no MapLibre here and no geometry —
 * the section it wires up is three sets of chrome over four schematic SVGs, so
 * that the navigation model can be judged without building three earths to
 * judge it with. See MapUxPreview.astro.
 *
 * Everything is one delegated listener writing three data attributes on the
 * section, and every visual difference is a CSS rule keyed off them. That is
 * deliberate: a mock-up whose states are CSS can be read in the stylesheet in
 * one pass, and whichever proposal wins is then a description of what the real
 * engine has to do rather than code anybody would keep.
 *
 * Not an island, for the reason everything on this page is not an island —
 * see src/scripts/mapglobe/index.ts.
 */

/** The four depths, shallowest first. This IS the argument the section makes:
    they are four positions on one axis, and the tab row on the section above
    spends itself describing the first and the second. */
const LEVELS = ['world', 'routes', 'area', 'route'] as const;
type Level = (typeof LEVELS)[number];

/** Which proposal's chrome is drawn over them. */
const PROPOSALS = ['drill', 'index', 'twin'] as const;
type Proposal = (typeof PROPOSALS)[number];

/**
 * Where each proposal opens.
 *
 * `drill` and `index` open on the world because they have no other opening —
 * there is one map and this is the top of it. `twin` opens there too, but it
 * is the only one of the three that can be somewhere the others cannot: the
 * `routes` level, which is what its second view is FOR. That level is
 * unreachable in the other two, and that is the whole of the difference
 * between them — see the notes under the frame.
 */
const HOME: Record<Proposal, Level> = { drill: 'world', index: 'world', twin: 'world' };

const section = document.querySelector<HTMLElement>('[data-uxp]');

function isLevel(value: string | null | undefined): value is Level {
  return LEVELS.includes(value as Level);
}

function isProposal(value: string | null | undefined): value is Proposal {
  return PROPOSALS.includes(value as Proposal);
}

if (section) {
  let proposal: Proposal = 'drill';
  let level: Level = 'world';

  /**
   * Which floating panel is open, or 'none'.
   *
   * A single value rather than a flag each, because they occupy the same corner
   * and only one can be open — the same reason the site's theme picker closes
   * on an outside click rather than tracking two independent menus.
   */
  let panel = 'none';

  function paint(): void {
    section!.dataset.proposal = proposal;
    section!.dataset.level = level;
    section!.dataset.panel = panel;

    for (const button of section!.querySelectorAll<HTMLElement>('[data-uxp-proposal]')) {
      button.setAttribute('aria-checked', String(button.dataset.uxpProposal === proposal));
    }
    /* The twin's segmented control is a two-state radiogroup over a four-state
       machine: `Globe` is the world and `Terrain` is everything below it. That
       collapse is exactly what the proposal claims — one switch, two views —
       so the marking has to collapse with it rather than leaving both halves
       unchecked at the `area` and `route` depths. */
    for (const button of section!.querySelectorAll<HTMLElement>('[data-uxp-view]')) {
      const on = button.dataset.uxpView === (level === 'world' ? 'globe' : 'terrain');
      button.setAttribute('aria-checked', String(on));
    }
    for (const button of section!.querySelectorAll<HTMLElement>('[data-uxp-panel]')) {
      button.setAttribute('aria-expanded', String(button.dataset.uxpPanel === panel));
    }
    /* The deepest visible crumb is where you ARE, not somewhere you can go, so
       it says so to assistive tech as well as in the styling. CSS can pick it
       out from `data-level` alone — and cannot write `aria-current`, which is
       the half that matters to anybody not looking at it. */
    for (const crumb of section!.querySelectorAll<HTMLElement>('[data-uxp-crumb]')) {
      const here = crumb.dataset.uxpCrumb === level;
      if (here) crumb.setAttribute('aria-current', 'true');
      else crumb.removeAttribute('aria-current');
    }
    /* The index rail marks the row the map is showing. `route` is the only
       depth with a single subject, so it is the only one that marks a row —
       at `area` the rail highlights the group instead, which is the same
       element with a different attribute. */
    for (const row of section!.querySelectorAll<HTMLElement>('[data-uxp-row]')) {
      row.setAttribute('aria-current', String(row.dataset.uxpRow === level));
    }
  }

  function go(next: Level): void {
    level = next;
    panel = 'none';
    paint();
  }

  section.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;

    const proposalButton = target?.closest<HTMLElement>('[data-uxp-proposal]');
    if (proposalButton && isProposal(proposalButton.dataset.uxpProposal)) {
      proposal = proposalButton.dataset.uxpProposal;
      /* Back to the top on a switch. The proposals do not all reach the same
         depths — `routes` exists only in the twin — so carrying a level across
         could land the reader somewhere the new chrome cannot describe. */
      level = HOME[proposal];
      panel = 'none';
      paint();
      return;
    }

    const levelButton = target?.closest<HTMLElement>('[data-uxp-level]');
    if (levelButton && isLevel(levelButton.dataset.uxpLevel)) {
      go(levelButton.dataset.uxpLevel);
      return;
    }

    const panelButton = target?.closest<HTMLElement>('[data-uxp-panel]');
    if (panelButton) {
      const wanted = panelButton.dataset.uxpPanel ?? 'none';
      panel = panel === wanted ? 'none' : wanted;
      paint();
      return;
    }

    /* Anything else inside the section closes an open panel. The panels float
       over the diagram, so a click that lands on the map behind one has to
       dismiss it or the reader has to find the button again. */
    if (panel !== 'none' && !target?.closest('[data-uxp-sheet]')) {
      panel = 'none';
      paint();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || panel === 'none') return;
    panel = 'none';
    paint();
  });

  paint();
}
