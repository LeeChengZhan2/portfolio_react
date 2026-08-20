---
title: Alliance Bank Web Applications
summary: Java web applications for a Malaysian commercial bank, delivered as a client project — including direct client contact and production deployment support.
role: Software Developer
stack:
  - Java
  - Vert.x
  - Hibernate
  - Db2
  - OpenShift
  - Docker
year: 2023
company: AceAtt Sdn. Bhd
featured: true
order: 4
draft: false
---

My first job, at AceAtt Sdn. Bhd. in Kuala Lumpur, from January 2022 to May
2023. A software house whose customers are banks, which means the work arrives as
client projects and the deadlines belong to someone else's release calendar.
Alliance Bank was the larger of the two I worked on, and the later.

## The work

Developing and maintaining Java web applications, delivering features alongside
cross-functional teams. Java and Vert.x with Hibernate, running in Docker on
OpenShift against Db2 — a stack I would not have chosen and learned a great deal
from precisely because of that.

## The part that wasn't the stack

What shaped how I work was sitting directly with the client to pin down what a
requirement actually meant. Requirements arrive confident and underspecified;
half the job is finding the question nobody asked before someone builds the wrong
thing.

The rest of it was delivery. Progress updates that had to be honest to be useful,
then supporting UAT and production deployments and resolving what surfaced there.
A production issue in a bank is not a ticket you triage next sprint, and knowing
that a deployment will be watched changes how you write the code that goes into
it.

## What carried forward

Reading is most of the job on a long-lived codebase. Almost every task began as
an hour of understanding something I hadn't written — a habit that transferred
directly to inheriting a Building Management System in a different country a
month later.

The other habit is verifying output against a specification rather than against
what looks right. That one came mostly from the
[reporting module](/work/bank-negara) I built for the central bank, and it is the
reason I now instrument systems before I trust them.

<!-- Split out of the old combined `java-finance` entry on 19 Aug 2026, so that
AceAtt's two client projects each get a page — the same treatment the three
Primustech projects get. Note the CV lists no per-project dates, so both AceAtt
entries carry 2023, the year the engagement ended. Correct them if the two
projects ran at genuinely different times.

The earlier version of this page said Spring Boot, Hibernate and Kafka. Per the
CV, Spring Boot belongs to the BMS work in Singapore and Kafka appears nowhere.
Do not reintroduce it.

Worth adding:

  - What these applications actually did. "A Java web application" tells a reader
    almost nothing, and naming the domain costs nothing.
  - The hardest bug you fixed there.
  - How big was the team, and what was yours to own?
-->
