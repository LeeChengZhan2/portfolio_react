---
title: AI Agent for Building Management
summary: AI agents that answer questions about buildings in plain English and can safely adjust equipment. 1000+ questions a month.
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
site: "https://aibe.now/"
featured: true
current: true
order: 1
draft: false
# The showcase layout (WorkShowcase.astro). Open by default is my own work only:
# the role, what I did, the tools I used, then the six agents I built. Building
# operations has a card per feature; the other agents are collapsed. Every card
# has three example chats and shows one at a time, as web or WhatsApp, `channel`
# first. All chat data is made up, but each chat shows something its agent can
# really do. Collapsed below is the whole team platform. Public facts only, no
# names but the product's own: the platform is AiBE, and `site` draws a "Visit
# aibe.now" button under the role line. That was the author's pick after a link
# at the top right and "AiBE" in the title both looked wrong, so the title stays
# plain. Building operations reads its data from the cloud data platform and
# links there, as that page links here. Notes go in YAML comments like this
# one, which stay out of the built page; an HTML comment in the body would ship.
showcase:
  location: Singapore
  tech:
    - group: Backend
      items: [Python, FastAPI, pandas]
    - group: AI agents
      items: [Agno]
    - group: AI models
      items: [Gemini, OpenRouter]
    - group: Databases
      items: [ClickHouse, FalkorDB, MongoDB]
    - group: Monitoring
      items: [Langfuse, OpenTelemetry]
    - group: Cloud
      items: [Google Cloud, Cloud Run]
  agents:
    - name: Building operations
      text: An assistant for the people who run a building. It reads every sensor, meter and unit from our cloud data platform, answers in plain English, writes the reports and changes settings when asked.
      link: /work/cloud-data-platform
      linkText: See the data platform
      channel: whatsapp
      features:
        - name: Sensor readings
          text: Live readings for any room or unit.
          examples:
            - messages:
                - from: user
                  text: How is the main hall right now?
                - from: agent
                  text: "Main hall, read 2 minutes ago:"
                  rows:
                    - [Temperature, "24.1 °C"]
                    - [Humidity, "58%"]
                    - [CO₂, "640 ppm"]
            - messages:
                - from: user
                  text: How warm did Studio A get yesterday?
                - from: agent
                  text: "Studio A, yesterday:"
                  rows:
                    - [Lowest, "22.6 °C at 6:10 am"]
                    - [Highest, "25.2 °C at 2:40 pm"]
                    - [Average, "23.9 °C"]
            - messages:
                - from: user
                  text: Are all the level 2 sensors reporting?
                - from: agent
                  text: "11 of 12 are. This one stopped:"
                  rows:
                    - [Sensor, "Studio B humidity"]
                    - [Last reading, "3 days ago"]
                    - [Check, "Sensor or network"]
        - name: Daily report
          text: Yesterday's alarms, comfort and energy.
          examples:
            - messages:
                - from: user
                  text: What happened yesterday?
                - from: agent
                  text: Yesterday at a glance
                  rows:
                    - [Cooling, "9 of 11 units ran"]
                    - [Comfort, "Meeting Room 3 ran warm"]
                    - [Energy, "3,910 kWh, 2% below typical"]
                    - [Alarms, "3 during the day"]
            - messages:
                - from: user
                  text: Which alarms went off yesterday?
                - from: agent
                  text: "3, two fewer than the day before:"
                  rows:
                    - ["Air handler 3", "Did not start, twice"]
                    - ["Fan unit 5", "Dirty filter, once"]
            - messages:
                - from: user
                  text: Was any room too warm yesterday?
                - from: agent
                  text: "One of 14 cooled rooms:"
                  rows:
                    - [Room, "Meeting Room 3"]
                    - [Too warm for, "1 h 20 min"]
                    - [Peak, "25.6 °C at 3 pm"]
        - name: Energy consumption
          text: Energy use per meter, never estimated.
          examples:
            - messages:
                - from: user
                  text: Main meters, last 3 months
                - from: agent
                  text: No readings from 31 July to 2 August, so August is not estimated.
                  rows:
                    - [August, "Not measured"]
                    - [September, "112,400 kWh"]
                    - [October, "118,900 kWh"]
            - messages:
                - from: user
                  text: How much did the lifts use last week?
                - from: agent
                  text: "Lifts, Monday to Sunday:"
                  rows:
                    - ["Lift 1", "412 kWh"]
                    - ["Lift 2", "388 kWh"]
                    - [Total, "800 kWh"]
            - messages:
                - from: user
                  text: Was last week's use normal?
                - from: agent
                  text: "Close to it, given the weather:"
                  rows:
                    - [Used, "27,900 kWh"]
                    - [Expected, "27,100 kWh"]
                    - [Difference, "3% more"]
        - name: Cooling efficiency
          text: Spots cooling that runs in empty rooms.
          channel: web
          examples:
            - messages:
                - from: user
                  text: Did we cool any empty rooms yesterday?
                - from: agent
                  text: "Yes, two:"
                  rows:
                    - [Main hall, "2.5 h before people came"]
                    - ["Studio B", "1 h after people left"]
                - from: user
                  text: When was the main hall in use?
                - from: agent
                  text: 10 am to 6:30 pm. Busiest at 2:15 pm, with 64 people.
            - messages:
                - from: user
                  text: Which air handlers are least efficient?
                - from: agent
                  text: "Last month, kW per ton of cooling (lower is better):"
                  rows:
                    - ["Air handler 5", "0.31"]
                    - ["Air handler 2", "0.26"]
                    - ["Air handler 1", "0.22"]
            - messages:
                - from: user
                  text: Did every unit hold its set temperature?
                - from: agent
                  text: "Yesterday, 7 of the 9 that ran did. These ran warm:"
                  rows:
                    - ["Air handler 5", "1.2 °C over, 2 h"]
                    - ["Air handler 2", "0.8 °C over, 1 h"]
        - name: Fault diagnosis
          text: Explains alarms and warm rooms.
          channel: web
          examples:
            - messages:
                - from: user
                  text: Why did air handler 3 raise two alarms?
                - from: agent
                  text: Both times it was told to start but did not run, and that mismatch raises the alarm. Check its power supply first.
                - from: user
                  text: What does it serve?
                - from: agent
                  text: Studios A and B, on level 2.
            - messages:
                - from: user
                  text: Meeting Room 3 is warm. Why?
                - from: agent
                  text: "Its cooling valve has barely opened. Check that first:"
                  rows:
                    - [Room, "26.4 °C, set to 25 °C"]
                    - ["Fan unit 5", "Running"]
                    - [Valve, "20% open since 7 am"]
            - messages:
                - from: user
                  text: Which equipment alarms most often?
                - from: agent
                  text: "This month:"
                  rows:
                    - ["Air handler 3", "7 times"]
                    - ["Fan unit 5", "3 times"]
                    - ["Exhaust fan 2", "2 times"]
        - name: Equipment control
          text: Changes settings after you confirm.
          channel: web
          examples:
            - messages:
                - from: user
                  text: Run fan unit 2 on weekdays, 8 am to 7 pm
                - from: agent
                  text: "Apply this weekly schedule to fan unit 2?"
                  rows:
                    - [Mon–Fri, "08:00–⁠19:00"]
                    - [Sat–Sun, "Off"]
                  replies: [Apply, Cancel]
                - from: user
                  text: Apply
                - from: agent
                  text: Done ✓ Schedule updated and saved under your name.
            - messages:
                - from: user
                  text: Set Meeting Room 3 to 24 °C
                - from: agent
                  text: Meeting Room 3 is set to 25 °C. Change it to 24 °C?
                  replies: [Change, Cancel]
                - from: user
                  text: Change
                - from: agent
                  text: Done ✓ Set to 24 °C and saved under your name.
            - messages:
                - from: user
                  text: Set Meeting Room 3 to 12 °C
                - from: agent
                  text: 12 °C is outside the safe range of 18 to 28 °C, so nothing was sent.
                - from: user
                  text: 23 °C then
                - from: agent
                  text: Change Meeting Room 3 from 25 °C to 23 °C?
                  replies: [Change, Cancel]
    - name: Comfort control
      text: Makes your zone cooler or warmer.
      channel: whatsapp
      examples:
        - messages:
            - from: user
              text: Too warm here
              photo: ZONE 4
            - from: agent
              text: Zone 4 is 25.1 °C now. Make it cooler?
              replies: ["Yes", "No"]
            - from: user
              text: "Yes"
            - from: agent
              text: Done ✓ Zone 4 is set to cooler.
        - messages:
            - from: user
              text: Zone 2 cooler, zone 5 warmer
            - from: agent
              text: Send these two?
              rows:
                - ["Zone 2", "25.1 °C now, cooler"]
                - ["Zone 5", "22.3 °C now, warmer"]
              replies: ["Yes", "No"]
            - from: user
              text: "Yes"
            - from: agent
              text: Done ✓ Both are sent.
        - messages:
            - from: user
              text: Set zone 3 to 24 °C
            - from: agent
              text: Zone 3 is 25.4 °C now. I can't set exactly 24 °C, but I can make it cooler. OK?
              replies: ["Yes", "No"]
            - from: user
              text: "Yes"
            - from: agent
              text: Done ✓ Zone 3 is set to cooler.
    - name: Room booking
      text: Finds and books meeting rooms.
      channel: whatsapp
      examples:
        - messages:
            - from: user
              text: Book Meeting Room 3 for a team meeting, tomorrow 3–⁠5 pm
            - from: agent
              text: Meeting Room 3 is free then. Book it?
              replies: [Book it, Not now]
            - from: user
              text: Book it
            - from: agent
              text: Booked ✓ Meeting Room 3, tomorrow 3–⁠5 pm.
        - messages:
            - from: user
              text: Move tomorrow's 3 pm booking in Meeting Room 3 to 4–⁠6 pm
            - from: agent
              text: Move Meeting Room 3 from 3–⁠5 pm to 4–⁠6 pm?
              replies: [Move it, Cancel]
            - from: user
              text: Move it
            - from: agent
              text: Moved ✓ Meeting Room 3, tomorrow 4–⁠6 pm.
        - messages:
            - from: user
              text: Which rooms for 10 people are free Friday 10–⁠11 am?
            - from: agent
              text: "These two are:"
              rows:
                - ["Meeting Room 5", "12 people"]
                - ["Meeting Room 8", "16 people"]
            - from: user
              text: Book room 5 for a project meeting
            - from: agent
              text: Book Meeting Room 5, Friday 10–⁠11 am?
              replies: [Book it, Not now]
    - name: Maintenance
      text: Work orders for technicians, by chat.
      channel: whatsapp
      examples:
        - messages:
            - from: user
              text: Which work orders are open?
            - from: agent
              text: "3 open:\n1. Leaking tap, level 3\n2. Light fault, level 5\n3. Door closer, level 1"
            - from: user
              text: Details on the first one?
            - from: agent
              text: "Leaking tap, level 3:"
              rows:
                - [Status, Started]
                - [Trade, Plumbing]
        - messages:
            - from: user
              text: Any overdue planned maintenance?
            - from: agent
              text: "Yes, two:"
              rows:
                - ["Lift 2", "Safety check, due Monday"]
                - ["Pump 3", "Service, due Tuesday"]
            - from: user
              text: Start the pump service
            - from: agent
              text: Mark the pump 3 service as started?
              replies: [Start, Cancel]
        - messages:
            - from: user
              text: I finished the leaking tap job
            - from: agent
              text: What caused it, and what did you do?
            - from: user
              text: Worn washer, replaced it
            - from: agent
              text: "Mark it complete? Cause: worn washer. Action: replaced."
              replies: [Complete, Cancel]
    - name: Fault reporting
      text: Report a fault with a photo.
      channel: whatsapp
      examples:
        - messages:
            - from: user
              text: The pantry light keeps flickering
              photo: PANTRY L2
            - from: agent
              text: "Raise a request: flickering light, pantry, level 2, with your photo?"
              replies: [Submit, Cancel]
            - from: user
              text: Submit
            - from: agent
              text: Done ✓ Request WR-1042 is raised.
        - messages:
            - from: user
              text: The aircon is leaking
            - from: agent
              text: Which room is it in?
            - from: user
              text: Meeting Room 2
            - from: agent
              text: "Raise a request: leaking aircon, Meeting Room 2?"
              replies: [Submit, Cancel]
        - messages:
            - from: user
              text: Any update on WR-1042?
            - from: agent
              text: "WR-1042, flickering light:"
              rows:
                - [Status, Started]
                - [Where, "Pantry, level 2"]
                - [Reported, "Yesterday, 9:20 am"]
    - name: Workspace finder
      text: Suggests a comfortable place to sit.
      channel: whatsapp
      examples:
        - messages:
            - from: user
              text: Where should I sit today?
            - from: agent
              text: What's your comfort survey ID?
            - from: user
              text: "27"
            - from: agent
              text: "Try level 3 east. It's 23.4 °C, inside your comfort range of 22 to 25 °C."
        - messages:
            - from: user
              text: How is level 2 north now?
            - from: agent
              text: "Level 2 north now:"
              rows:
                - [Temperature, "26.1 °C"]
                - [CO₂, "780 ppm"]
                - [Humidity, "61%"]
        - messages:
            - from: user
              text: Show me every temperature
            - from: agent
              text: "Coolest first:"
              rows:
                - ["Level 5 south", "21.2 °C"]
                - ["Level 3 east", "23.4 °C"]
                - ["Level 4 west", "24.8 °C"]
                - ["Level 2 north", "26.1 °C"]
  platform:
    title: The whole platform
    tag: Team project
    headline: "Helping 8 organisations run their buildings, *just by asking.*"
    groups:
      - name: Buildings and sensors
        items:
          - text: Building operations on a building management system
            mine: true
          - text: Sensor and meter questions on three more building data platforms
          - text: One chat across a building's sensors and its maintenance
      - name: Comfort and workplace
        items:
          - text: Comfort control, from a photo of the zone sign
            mine: true
          - text: Workspace finder, from each person's comfort range
            mine: true
          - text: Room booking
            mine: true
      - name: Maintenance
        items:
          - text: Work requests, work orders and planned maintenance for technicians
            mine: true
          - text: Fault reporting with a photo, for occupants
            mine: true
          - text: Work-order analytics on another maintenance system (pilot)
          - text: Fault reporting on WhatsApp for an event demo
      - name: Air-conditioning and lifts
        items:
          - text: Air-conditioning analytics, with charts (showcase)
          - text: Lift maintenance analytics (showcase)
      - name: Documents and data
        items:
          - text: Answers from company documents, with their sources
          - text: HR questions, from policies and staff data
          - text: Price look-ups from rate schedules, gathered into a quote
          - text: Questions about uploaded spreadsheets
          - text: Charts and visual summaries made from an answer
      - name: Running the platform
        items:
          - text: Tracing on every AI answer
            mine: true
          - text: Automatic build and release on Google Cloud
          - text: One platform for 8 organisations, each with its own data and access
    channels: [Web, Mobile app, WhatsApp, Telegram]
    tech: [Milvus]
highlights:
  - value: "1000+"
    label: questions a month
---

## What I did

- **Designed and built 6** of the platform's 20+ AI agents, end to end.
- **Connected them to live building systems**: sensors and meters, maintenance requests and room booking.
- **Halved debugging time** with tracing on every AI answer.
- **Deployed on Google Cloud** with automatic releases (CI/CD).
