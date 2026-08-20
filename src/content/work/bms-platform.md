---
title: Building Management System
summary: The Java platform the rest of it runs on — keeping the BMS reliable as requirements moved, and integrating the third-party APIs that let other systems talk to it.
role: Software Engineer
stack:
  - Java
  - Spring Boot
  - MyBatis
  - MySQL
year: 2023
endYear: 2025
company: Primustech Pte. Ltd
featured: true
order: 3
draft: false
---

The first thing I worked on in Singapore, and still the system everything else
sits on top of. A Building Management System is the software layer between an
operator and the equipment in a building — HVAC, lighting, fans — and it is
judged almost entirely on whether it is boring.

My work on it was maintaining and optimising the codebase for reliability while
requirements kept moving, and integrating third-party APIs so the BMS could
exchange data with external applications. That integration work is what later
turned into the [cloud data platform](/work/cloud-data-platform): once you have
written enough one-off adapters, building the layer that generalises them stops
being optional.

## Integration is mostly archaeology

The recurring problem is never the code you're writing. It's that a platform and
a piece of equipment were designed independently, years apart, by people who
never met, and now have to agree on what a message means. Half the job is
establishing what the other side actually does, as opposed to what its
documentation claims.

I also trained and supported colleagues on the system — which is the fastest way
to find out which parts of a codebase only make sense to the person who last
touched them.

<!-- Rewritten from the CV on 19 Aug 2026. This page used to be framed as
"driver development"; the CV frames it as platform maintenance and third-party
integration, so it now follows the CV. If the driver-level protocol work is a
real and separate part of the job, it deserves saying explicitly — it is the
kind of thing most developer portfolios cannot show at all.

Either way, this page still wants:

  - Which protocols and APIs? BACnet, Modbus, KNX, something proprietary?
  - One debugging story told properly: how it presented, what you suspected,
    how you actually found it. One narrative beats three paragraphs.
  - What "optimising" meant in numbers — what was slow, and what is it now?
  - The test setup: real hardware on a bench, a simulator, both?

Describe the class of problem rather than the customer.
-->
