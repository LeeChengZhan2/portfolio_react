---
title: Cloud Data Platform
summary: The data layer underneath the agent — equipment inventory and sensor readings from 5 buildings and 4 vendors, unified into one queryable model.
role: Software Engineer
stack:
  - Python
  - ClickHouse
  - FalkorDB
  - GCP
  - Terraform
  - Docker
year: 2026
company: Primustech Pte. Ltd
featured: true
current: true
order: 2
draft: false
---

Every building runs equipment from whichever vendors won the tender, and each
vendor exports its data in its own shape, with its own names for the same
physical thing. Five buildings and four vendors is not five datasets — it's four
dialects and a lot of disagreement about what a "sensor" is.

This platform is the part that makes them agree. It unifies equipment inventory
and sensor data into a single queryable model, which is what everything
downstream — analytics, and the [AI agent](/work/ai-agent-bms) — actually reasons
over.

## Standardising four vendors

A translation layer maps each vendor's raw equipment and sensor data onto one
industry-standard representation. That mapping is where the domain knowledge
lives: recognising that two vendors' differently-named points are the same
measurement, and that a third omits it entirely.

On top of that sits a knowledge graph modelling building layout, equipment, and
the dependencies between systems — what feeds what, and what fails together.
It's the backbone the operations agent reasons over, and it is the reason the
agent can answer a question about a building it was never specifically
programmed for.

## Pipelines that can be re-run

Large-scale sync and historical backfill across 100+ GB, built so that failure is
routine rather than exceptional: automatic recovery, and re-runs that are safe to
repeat rather than something you do carefully at 2am with a rollback plan. Data
quality checks and record matching run over the same path.

Idempotency isn't an elegance argument here. Sensor backfill fails partway
through often enough that a pipeline you're afraid to re-run is a pipeline that
silently stays broken.

## Infrastructure as code

Deployed on GCP with Terraform, plus an automated build-and-release pipeline and
end-to-end logging and monitoring — so the platform can be rebuilt from source
rather than nursed. That mattered because the agent was being developed against
it at the same time: the ground could not be allowed to move without anyone
noticing.

<!-- Written from the CV on 19 Aug 2026 — structure and figures are yours, the
prose needs your pass. Prompts:

  - Name the standard. Brick, Project Haystack, something in-house? "Industry
    standard" is vague in a way a reader in this field will notice immediately.
  - What does the graph schema look like? Even three node types and two edge
    types would make this concrete.
  - The hardest record-matching case you hit — that's the story on this page.
  - Was the 100+ GB figure a one-off backfill or steady state?
-->
