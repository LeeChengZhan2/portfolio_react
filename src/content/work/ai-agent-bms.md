---
title: AI Agent for Building Management
summary: A multi-agent system that answers plain-English questions about building equipment, energy use, and faults — 500+ queries a month across 10 buildings.
role: Software Engineer
stack:
  - Python
  - FastAPI
  - Agno
  - ClickHouse
  - FalkorDB
  - Milvus
  - Langfuse
year: 2025
company: Primustech Pte. Ltd
featured: true
current: true
order: 1
draft: false
---

A facilities team's question is rarely a query. It's "why is the east wing warm
again" — a sentence that needs three different systems to answer, none of which
speak English. The agent is the layer that closes that gap: ask in plain
language, get an answer drawn from live building data instead of a dashboard
somebody remembered to build.

It runs in production for 8 customer organisations across 10 buildings, handling
500+ natural-language queries a month on equipment topology, energy usage, and
fault detection.

## Reasoning across data that doesn't match

The hard part isn't the model. It's that a single question usually needs the
knowledge graph to know what a piece of equipment *is* and what it feeds, the
time-series store to know what it *did*, and the manuals to know what any of
that is supposed to mean.

So the agents reason over all of it in one workflow — relational and time-series
data in ClickHouse, analytical work in DuckDB, a FalkorDB knowledge graph for how
equipment connects, and RAG over internal documents with Milvus for the vectors
and MongoDB for the source material. A question that would otherwise be three
tickets to three teams becomes one workflow.

## Observability, because the system is non-deterministic

The thing nobody warns you about when you ship an LLM system is that "the agent
gave a wrong answer" is an unfalsifiable bug report. You cannot attach a debugger
to a decision.

End-to-end tracing with Langfuse and OpenTelemetry fixed that, with per-tenant
and per-user filtering so a specific customer's specific bad answer can be pulled
up and read step by step. It cut production debugging time by half — the single
highest-leverage thing I built on this project, and it isn't a feature.

## Shipping it

Deployed and operated on GCP, with CI/CD pipelines automating image builds and
releases. No manual deployment steps survive.

<!-- Written from the CV on 19 Aug 2026 — the shape and the numbers are yours,
the prose is not yet. Worth adding when you edit:

  - One real question a customer asked, and the path the agent took to answer
    it. The examples above are deliberately generic; a real one is worth more
    than the rest of this page.
  - Why Agno rather than the obvious alternatives.
  - What the agents actually are — how many, and how work is divided between
    them. "Multi-agent" is doing a lot of unexamined work in the summary.
  - Something that went wrong. The observability section is close, but the
    honest version names a specific failure it caught.

Keep it at the class-of-problem level rather than naming customers.
-->
