---
title: Bank Negara Reporting Module
summary: A regulatory reporting module for Malaysia's central bank — data retrieved through Elasticsearch REST APIs, submission documents generated with JasperReports.
role: Software Developer
stack:
  - Java
  - Liferay
  - JSP
  - Elasticsearch
  - JasperReports
  - MySQL
year: 2022
company: AceAtt Sdn. Bhd
featured: true
order: 5
draft: false
---

The earlier of the two client projects I worked on at AceAtt Sdn. Bhd. in Kuala
Lumpur, alongside the [Alliance Bank applications](/work/alliance-bank). Bank
Negara Malaysia is the country's central bank, and this was the module that
produced its regulatory submissions.

## What it did

Built a reporting module for regulatory reporting: integrating Elasticsearch REST
APIs to retrieve the underlying data, then generating the output documents with
JasperReports, on a Liferay and JSP front end.

## Why the format is the feature

Regulatory reporting is unforgiving in a specific way. The output is not judged
on whether it looks right — it is judged on whether it matches a specification
written by people who will never review your pull request and will not accept a
near miss. A report that is correct in substance and wrong in layout is simply a
wrong report.

That inverts the usual instinct. Most of the time you optimise for the reader;
here the reader is a validator, and the only thing that counts is conformance to
a document you were handed. It is the earliest version of a lesson I keep
relearning: find out precisely what "correct" means before writing anything that
claims to be it.

<!-- Split out of the old combined `java-finance` entry on 19 Aug 2026, so that
AceAtt's two client projects each get a page — matching how the three Primustech
projects are handled. Both AceAtt entries carry year 2023, the year the
engagement ended, because the CV gives no per-project dates.

Worth adding:

  - Which regulatory return this produced, if that is publishable. Naming it
    turns this from a generic reporting module into a specific, checkable thing.
  - Why Elasticsearch was the source of record rather than a relational store.
  - What the data volumes were, and whether generation was batch or on demand.
-->
