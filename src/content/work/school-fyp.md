---
title: Game Theory in Baseball
summary: Final year project — modelling the pitcher-versus-batter duel as a two-player zero-sum game, then simulating how each side should play against the other.
role: Final Year Project
stack:
  - Game theory
  - Python
  - Mathematical modelling
year: 2022
featured: false
order: 6
external: https://eprints.tarc.edu.my/22481/
doc: /assets/documents/leechengzhan-fyp.pdf
draft: false
---

My final year project for the BSc (Hons) Management Mathematics with Computing at
Tunku Abdul Rahman University College in Kuala Lumpur, supervised by Dr. Tey Siew
Kian in the Department of Mathematical and Data Science, academic year 2021/2022.
The full report is in the university's eprints archive and downloadable below.

## The question

Every pitch in baseball is a decision made simultaneously by two people who each
want the other to guess wrong. That is a game in the formal sense, so the project
asked whether game theory can tell a pitcher and a hitter what to actually do.

## The model

A two-player finite game with a deliberately small strategy set. The batter
chooses to swing or not swing; the pitcher chooses to throw a good ball or a bad
one. Four cells, and all the interest lives in the payoffs.

The part I would defend as the real contribution is refusing to make those
payoffs symmetric. Players are classified as strong or weak, and a strong player
facing a weak one earns more from the same cell — so the matrix depends on who is
standing in the box, not only on what the two of them chose.

I then simulated the game in Python, looping so that each player picks a strategy
by guessing the opponent's, and looked at two cases: an opponent committed to a
single pure strategy, and an opponent playing a mixed one.

## What it found, and what it didn't

The pure-strategy case resolves cleanly — against an opponent who always does one
thing, the best response falls out. The mixed case is where it gets interesting,
and where the honest conclusion sits: the results may not match real baseball,
because the payoff matrix for a given pair of players is genuinely hard to pin
down.

I would rather leave that in than dress it up. A model is only as good as the
numbers you put into it, and the project's real finding was that the modelling
was never the hard part — quantifying the payoffs was.

That has aged well. Most of what I build now has to act on quantities nobody
measured directly, and the instinct to ask where a number came from started here.

<!-- Rewritten on 19 Aug 2026 from the report itself (title, supervisor, model,
abstract) plus the CV. The CV writes the degree as "Mathematics with Computing";
the report gives the full award as BSc (Hons) Management Mathematics with
Computing. This page uses the full form and /about uses the CV's short form —
pick one if the inconsistency bothers you.

Still worth adding: the actual payoff numbers you used, and one figure from the
results section. A single table would carry this page.
-->
