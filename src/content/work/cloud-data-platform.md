---
title: Cloud Data Platform
summary: "The data platform behind our building AI agents: 2B+ sensor readings from client buildings, in one common data layer."
role: Software Engineer
stack:
  - Python
  - ClickHouse
  - FalkorDB
  - Brick Schema
  - GCP
  - Terraform
  - Docker
year: 2026
company: Primustech Pte. Ltd
featured: true
current: true
order: 2
draft: false
# The showcase layout (WorkShowcase.astro), with "What I built" in place of
# agents. Written for recruiters and interviewers who know nothing about
# buildings, so they get it at a glance: plain words, where the platform
# fits (it is the data behind the AI agents, which the author wants said),
# then my part as a numbered flow in the author's own order: understand the
# client's data, fetch and store it, convert it to a common data layer, save
# the relationships in a graph, keep it working and safe. No counts of
# buildings or vendors: the author finds them too small to be worth saying.
# Open by default is my own work only; collapsed below is the whole
# two-person platform. Public facts only: no names, nothing about how it is
# built inside. Every example is made up, but each shows something the
# platform really does (checked against the work repo on 24 Nov 2026). The
# made-up building is one building: AHU-02 (air-con unit 2), PM-06 (power
# meter 6), the L2 PLANT RM and Level 2 agree across steps. Notes go in YAML
# comments like this one, which stay out of the built page; an HTML comment
# in the body would ship.
showcase:
  location: Singapore
  tech:
    - group: Languages
      items: [Python, SQL, Cypher]
    - group: Data
      items: [Polars, Parquet, Brick Schema]
    - group: Databases
      items: [ClickHouse, FalkorDB]
    - group: Cloud
      items: [Google Cloud, Cloud Run]
    - group: DevOps
      items: [Docker, Terraform, CI/CD]
    - group: Testing
      items: [pytest]
  built:
    picture:
      - icon: building
        title: Each client's building systems
        text: Air-con, power meters, lifts and sensors. Each vendor names and stores its data in its own way.
      - icon: database
        title: This data platform
        text: Collects 2B+ readings, turns them into one common data layer and maps how everything connects.
        mine: true
      # Names the product the agents belong to (AiBE, aibe.now; 24 Nov 2026).
      # The agent page links back here, and has a button out to aibe.now.
      - icon: sparkles
        title: AiBE's AI agents
        text: Read from it to answer questions about any building, in plain English.
        link: /work/ai-agent-bms
        linkText: See the AI agents
    steps:
      - title: Understand the client's data
        text: Find out what the client's systems can give, and what each piece of data means.
        # Each item opens to a made-up example on example.com. The ids, codes and
        # values agree with the other steps: AHU-02 and PM-06 are the rows
        # stored in step 2, AHU-02, AHU02_RAT and L2 PLANT RM are what step 3
        # turns into one model, and step 4's graph has AHU-02 (air-con unit 2)
        # in that plant room, with PM-06 (power meter 6) measuring it. Field
        # names are generic on purpose, not any vendor's real API.
        show:
          kind: list
          title: What the client can give
          hint: Open one to see an example
          items:
            - name: Equipment list
              text: Every unit, its type and where it is
              url: "https://bms.example.com/api/v1/equipment"
              json: |
                [
                  {
                    "id": "10482",
                    "code": "AHU-02",
                    "type": "AIR HANDLING UNIT",
                    "location": "L2 PLANT RM"
                  },
                  {
                    "id": "10517",
                    "code": "EAF-03",
                    "type": "EAF",
                    "location": "L2 PLANT RM"
                  }
                ]
            - name: Sensor list
              text: What each sensor measures, and in which unit
              url: "https://bms.example.com/api/v1/points"
              json: |
                [
                  {
                    "id": "88213",
                    "equipment": "10482",
                    "tag": "AHU02_RAT",
                    "unit": "°C"
                  },
                  {
                    "id": "88219",
                    "equipment": "10530",
                    "tag": "PM06_KWH",
                    "unit": "KWH"
                  }
                ]
            - name: Live readings
              text: Temperatures, power use, on and off
              url: "https://bms.example.com/api/v1/readings/latest"
              json: |
                [
                  {
                    "point": "88213",
                    "time": "2026-11-24 09:41",
                    "value": 24.1
                  },
                  {
                    "point": "88219",
                    "time": "2026-11-24 09:41",
                    "value": 1204.6
                  }
                ]
            - name: Alarm history
              text: What went wrong, and when
              url: "https://bms.example.com/api/v1/alarms?since=2026-11-24"
              json: |
                [
                  {
                    "equipment": "EAF-03",
                    "message": "TRIP ALARM",
                    "priority": "HIGH",
                    "time": "2026-11-24 08:47"
                  }
                ]
            - name: Floors and rooms
              text: Where everything is
              url: "https://bms.example.com/api/v1/locations"
              json: |
                [
                  {
                    "id": "200",
                    "name": "Level 2",
                    "type": "FLOOR"
                  },
                  {
                    "id": "214",
                    "name": "L2 PLANT RM",
                    "type": "ROOM",
                    "parent": "200"
                  }
                ]
      - title: Fetch it and design the storage
        text: Build jobs that pull the data in automatically, and design how to store it so 2B+ readings stay quick to search.
        # The table design is mine (checked against the work repo, 24 Nov 2026):
        # split by month, sorted by equipment, sensor and time, one copy of a
        # reading loaded twice, values kept as sent. No product or table names.
        show:
          kind: store
          flow:
            - { name: "Client's system", text: Readings and alarms }
            - { name: Raw copy, text: "Files, kept exactly as sent" }
            - { name: Readings table, text: One row per reading }
          columns: [time, equipment, sensor, value]
          rows:
            - ["09:41", AHU-02, AHU02_RAT, "24.1"]
            - ["09:41", PM-06, PM06_KWH, "1204.6"]
          notes:
            - Split by month, so a search over a few days stays fast
            - Sorted by equipment, sensor and time, so one sensor's history is read in one go
            - The same reading loaded twice is kept once
            - Values kept exactly as sent, so nothing is lost before it is checked
          note: 2B+ readings stored
      - title: Convert it into a common data layer
        text: Turn the client's separate lists into one connected model, with a standard type for every part, based on Brick Schema.
        show:
          kind: model
          from:
            - [Location, L2 PLANT RM]
            - [Equipment, "AHU-02 · AIR HANDLING UNIT"]
            - [Sensor, "AHU02_RAT · Return Air Temperature · °C"]
          to:
            - { depth: 0, name: Main building, type: building, code: "rec:Building" }
            - { depth: 1, name: Level 2, type: floor, code: "rec:Level" }
            - { depth: 2, name: L2 PLANT RM, type: room, code: "rec:Zone" }
            - { depth: 3, name: AHU-02, type: "air handling unit · HVAC", code: "brick:AHU" }
            - { depth: 4, name: Return air temperature, type: "sensor · °C", code: "brick:Sensor" }
      - title: Save the asset relationships in a graph
        text: Record where every unit is and what it feeds, serves and measures, in an in-memory graph database the AI agents can follow.
        # The graph I built (checked against the work repo, 24 Nov 2026): one
        # per building, rebuilt in full from the common data layer on every
        # update. It links each unit to the room it is in (from the client's
        # system) and, from the facility team's spreadsheet, to what feeds
        # it, what measures it and the rooms it serves. Drawn in the shape a
        # real building's graph has, with made-up names: an air-con unit in a
        # plant room serving a hall on another floor, fed by a fresh air unit
        # and by the people counter in that hall, and measured by a power
        # meter. Kept small on purpose: two floors and eight units were too
        # much for the author.
        show:
          kind: graph
          rows:
            - - name: L2 riser
                units:
                  - { id: pm6, name: Power meter 6 }
              - name: Roof
                units:
                  - { id: fau1, name: Fresh air unit 1 }
            - - name: L2 plant room
                span: 3
                units:
                  - { id: ac2, name: Air-con unit 2, at: 1 }
            - - name: L3 hall
                id: hall
                at: 1
                span: 2
                units:
                  - { id: pc1, name: People counter 1, at: 2 }
          links:
            - [pm6, measures, ac2]
            - [fau1, feeds, ac2]
            - [ac2, serves, hall]
            - [pc1, feeds, ac2]
          notes:
            - Joins the client's equipment list with the facility team's spreadsheet
            - Each unit keeps the same ID as its readings, so the AI agents can fetch them
      - title: Make sure it works and is safe
        text: Check every run and protect the data, so problems show up instead of hiding.
        show:
          kind: checks
          items:
            - Every data job is logged, with when it ran and how it ended
            - A failed run picks up where it stopped, without duplicating data
            - Backups are tested by restoring them
            - 2B+ readings moved to production with none lost
  # "Mine" only for work I wrote all or most of; "Shared" for the deployment
  # set-up, which my colleague and I built between us.
  platform:
    title: The whole platform
    tag: Team of two
    headline: "Data from every vendor, *in one common data layer.*"
    note: Two engineers built it. My colleague designed the core data model.
    groups:
      - name: Connecting buildings
        items:
          - text: One building's equipment, sensors, live readings and alarms
            mine: true
          - text: "The other buildings: equipment lists, sensor readings and maintenance records"
      - name: The standard
        items:
          - text: The core data model, based on Brick Schema
          - text: The knowledge graph of how a building's equipment and rooms connect
            mine: true
      - name: Running it
        items:
          - text: A log of every data job
            mine: true
          - text: Bulk loading of sensor readings
            mine: true
          - text: Backups, tested by restoring them
            mine: true
          - text: Alerts when a job fails
      - name: Deployment
        items:
          - text: Automatic build and release on Google Cloud (CI/CD)
            shared: true
          - text: Infrastructure as code with Terraform
            shared: true
    tech: [Redis, Cloud Monitoring]
highlights:
  - value: "2B+"
    label: sensor readings
---

## What I did

- **Built a building's data pipeline end to end**: live readings, alarms, equipment and sensors.
- **Mapped its equipment and sensors into a common data layer**, so they match the other buildings.
- **Built the knowledge graph** that shows the AI agents how equipment and rooms connect.
- **Moved 2B+ readings to production** with none lost, using backups tested by restoring them.
