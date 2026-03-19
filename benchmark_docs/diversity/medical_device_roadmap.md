MEDICAL DEVICE DEVELOPMENT ROADMAP  
Project: Portable Vein Imaging and IV Guidance Unit  
Program Name: VisiLine Assist  
Document Status: Working roadmap for internal planning  
Planning horizon: 18 months (subject to funding and test outcomes)

This roadmap is intended to coordinate engineering, regulatory, clinical, and manufacturing workstreams for the first functional version of the VisiLine Assist device. Dates below are target windows, not guaranteed deadlines.

---

# Phase 0 — Problem Framing / Clinical Need Lock

Objective: confirm that the device solves a real clinical workflow problem and that the initial product scope is narrow enough to build safely.

Primary use case:
- assist nurses and emergency staff in locating superficial veins
- reduce failed cannulation attempts
- improve first-stick success in difficult-access patients

Outputs expected from this phase:
- clinical use statement
- target environment definition
- first risk assumptions
- stakeholder interview summary

### Work items

1. Interview 8–12 clinicians across:
   - emergency care
   - outpatient infusion
   - ambulance / field medicine
2. Record common failure scenarios
3. Define minimum success criteria
4. Document competing device limitations

### Deliverables

| Deliverable | Owner | Exit condition |
|------------|------|----------------|
| Clinical needs brief | Product lead | approved by advisory clinician |
| Initial product scope | Systems engineer | features reduced to MVP |
| User environment summary | Research team | reviewed internally |

Potential ambiguity: pediatric use came up in early discussions, but this may be deferred from V1.

---

# Phase 1 — Concept Architecture and Feasibility

Goal: determine whether a compact near-infrared vein visualization unit with onboard image enhancement is technically feasible within power and cost limits.

## 1.1 Subsystem Definition

Candidate subsystems:

- NIR illumination array
- imaging sensor module
- embedded compute board
- display/output module
- battery + power regulation
- enclosure / sterilizable touch surfaces

A rough block diagram at this stage:

```text
NIR LEDs
   ↓
Patient Tissue
   ↓
Imaging Sensor
   ↓
Image Processing Board
   ↓
Display Overlay / Guidance Screen
1.2 Feasibility Questions

Questions to answer:

Can vein contrast remain stable across skin tones?

Is heat generation acceptable during 5–10 minute use periods?

Can the compute unit perform enhancement in near real time?

Is handheld operation realistic, or should the first version use a small stand?

Exit criteria
Item	Target
Image enhancement latency	< 200 ms
Surface temperature	within safe handheld range
Basic vein visualization	visible in controlled test setup
Estimated BOM	within preliminary cost band
Phase 2 — Breadboard Prototype (P1)

Purpose: assemble a non-clinical laboratory prototype to validate optics, illumination geometry, and image processing assumptions.

P1 build contents

off-the-shelf NIR LEDs

camera sensor with suitable filter characteristics

development board

temporary acrylic or printed housing

laptop-assisted processing if needed

Activities

bench test illumination angle

compare camera exposure modes

evaluate image noise

check whether veins remain distinguishable under ambient light changes

Notes:
At this phase, industrial design does not matter much.
Cable clutter is acceptable.
Battery operation may be simulated with external supply if faster.

2.1 Test Matrix
Test	Description	Pass signal
T-01	dark room imaging	veins visible
T-02	clinic-like ambient lighting	acceptable contrast
T-03	movement tolerance	limited blur
T-04	continuous operation 20 min	no thermal failure
2.2 Early Risks

false contrast from skin texture

inconsistent visibility on dehydrated patients

unstable focus when handheld

overexposure from reflective surfaces

Phase 3 — Algorithm and Image Guidance Layer

Objective: move from raw visualization to a more usable assistance system.

Instead of only showing grayscale contrast, the system should help operators interpret what they see.

Planned capabilities

adaptive contrast enhancement

vessel candidate highlighting

suppression of glare regions

optional centerline overlay

confidence band (not diagnosis)

Important distinction:
This system is not intended to diagnose vascular disease. It is a procedural guidance aid.

Model / logic options under review
Approach	Advantage	Drawback
classical image processing	deterministic, easier to validate	weaker on hard cases
lightweight ML segmentation	potentially better vessel detection	more validation burden
hybrid pipeline	balanced	more engineering complexity

Subsection — decision note
Current preference is hybrid, but regulatory simplicity may push the team back toward mostly deterministic enhancement in V1.

Phase 4 — Integrated Engineering Prototype (P2)

This is the first device-like build.

Expected characteristics:

self-contained power

integrated display

enclosed electronics

safer thermal behavior

simplified user controls

P2 hardware targets
Parameter	Target
total weight	< 1.4 kg
battery runtime	2 hours intermittent use
boot time	< 20 sec
display visibility	readable in bright room
enclosure cleanability	basic wipe-down compatible
User interaction concept

power button

mode toggle

brightness control

freeze frame capture

battery indicator

At this stage there may be two parallel mechanical directions:

handheld scanner form

small articulated stand form

Both should not continue beyond this phase unless extra funding appears.

Phase 5 — Risk Management + Design Controls

Purpose: formalize engineering work into medical-device-compatible documentation.

This phase becomes documentation-heavy.

Required artifacts:

intended use statement

design inputs

design outputs

hazard analysis

traceability mapping

verification planning

5.1 Risk Categories

Examples:

thermal discomfort

electrical fault

inaccurate visual guidance

overreliance by user

cross-contamination due to poor cleaning

battery swelling / charging error

5.2 Preliminary Hazard Log
Hazard	Cause	Mitigation concept
misleading vessel display	poor algorithm output	confidence display + labeling
hot surface	LED heat buildup	thermal control + duty cycle limits
contamination	improper cleaning	smooth enclosure, cleaning IFU
power failure during use	battery issue	charge indicator + safe shutdown

Ambiguous point still open:
Should the overlay ever suggest a “best insertion point”? Regulatory implications may be higher if yes.

Phase 6 — Verification and Bench Validation

Goal: prove that the engineered device meets its stated design inputs.

Verification buckets

optical performance

image latency

battery endurance

environmental robustness

drop resistance

basic EMC pre-checks

cleaning compatibility

Bench validation examples

Measure vein contrast ratio on tissue phantoms

Test under multiple ambient lux conditions

Record response time from power-on to image-ready

Repeat 50+ run cycles for stability

Perform charger safety checks

Evidence structure
Evidence Type	Example
test report	optical contrast validation
measurement record	temperature log
image archive	before/after enhancement samples
defect log	failed module observations
Phase 7 — Human Factors and Workflow Evaluation

Now the question changes from “Does it work?” to “Can people use it correctly?”

Users to involve:

nurses

emergency technicians

infusion staff

clinical educators

Human factors topics

where users naturally hold the device

whether the screen is readable while cannulating

confusion between enhancement modes

interpretation of highlighted vessel paths

cleaning steps after patient contact

7.1 Simulated-use Study

Possible setup:

mannequin arm

training phantoms

timed IV attempt scenarios

observation of use errors

Metrics that may be tracked:

time to first usable image

misinterpretation events

accidental button presses

average confidence rating by user

Phase 8 — Clinical Pilot Preparation

This phase does not yet mean broad deployment. It means controlled limited evaluation readiness.

Prerequisites:

locked pilot hardware batch

stable firmware revision

approved test protocol

labeling draft

operator training sheet

Clinical pilot questions

Does the device reduce failed first attempts?

In which patient groups is benefit strongest?

Does it improve confidence, speed, or both?

Are there unexpected workflow interruptions?

Pilot constraints
Constraint	Likely approach
site count	1–2 hospitals
sample size	small pilot
user training	structured before use
data collected	procedure success + feedback
Phase 9 — Regulatory Readiness and Manufacturing Prep

Main purpose: transition from engineering project to productization path.

This phase includes parallel workstreams.

9.1 Regulatory Preparation

Expected work:

device classification assessment

technical documentation structure

labeling and IFU drafting

software documentation package

safety and performance summary

9.2 Manufacturing Readiness

Expected work:

supplier shortlist

assembly process outline

inspection criteria

calibration process

packaging concept

Manufacturing checkpoints
Checkpoint	Meaning
BOM freeze	controlled part list
supplier review	component continuity understood
assembly pilot	first small build run complete
QC specification	measurable acceptance criteria defined
Phase 10 — Launch Readiness Decision

This is a gate, not a guarantee.

Decision options:

proceed to limited launch

extend validation

narrow indication / scope

pause due to cost or regulatory risk

Launch decision inputs

verification completion status

pilot results

defect severity trends

unit economics

reimbursement or procurement feedback

Final readiness summary template
Area	Status
engineering stability	pending / ready
usability evidence	pending / ready
documentation	pending / ready
manufacturing setup	pending / ready
regulatory package	pending / ready
Cross-Phase Dependencies

Some work does not fit neatly into one phase.

Always-on threads:

clinical advisor engagement

IP review

supplier discovery

cost tracking

user feedback consolidation

Dependency note:
Thermal design decisions made in Phase 2 may affect enclosure design, battery size, and cleaning claims later. Those choices should not be treated as isolated hardware details.

Rough Timeline Snapshot
Phase	Duration Estimate	Comments
0	3 weeks	fast, interview-driven
1	4–6 weeks	architecture and tradeoffs
2	6 weeks	bench prototype
3	5 weeks	image pipeline maturity
4	8 weeks	integrated prototype
5	4 weeks	design controls baseline
6	6–8 weeks	verification heavy
7	4 weeks	usability focus
8	6+ weeks	depends on site access
9	8 weeks	regulatory + manufacturing
10	2 weeks	go / no-go review

Real schedule may slip if optical performance or usability issues remain unresolved.

Open Questions (not yet closed)

handheld vs stand-assisted form factor

deterministic enhancement vs ML-assisted overlay

reusable device only, or disposable interface component?

single-mode visualization or multi-mode depth cues?

should the first version support image capture export?

Some of these look minor on paper but will strongly affect risk classification, documentation burden, and cost.

End of roadmap
