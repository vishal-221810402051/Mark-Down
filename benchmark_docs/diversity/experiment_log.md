Experiment Log – Prototype Thermal Energy Storage Cell  
Lab: Materials & Energy Systems Bench (MES-B2)  
Device ID: TES-Cell-03  
Operator(s): S. Alvarez / L. Chen  
Date range: 12–18 May (year not consistently recorded in raw notes)

Note: These entries combine direct notebook transcriptions with partial digital logs. Some timestamps were reconstructed later.

---

## Initial Setup (Day 0)

Objective: evaluate phase-change material (PCM) behavior inside the TES-Cell-03 module under repeated heating/cooling cycles.

Hardware configuration at start:

| Component | Spec | Notes |
|-----------|------|------|
| PCM core | paraffin-based mix | batch label unclear |
| container | aluminum cylindrical shell | inner diameter ~7 cm |
| heater | resistive plate | controlled via bench supply |
| temp sensors | 3 thermocouples | top / center / base |

Power supply configured to deliver constant heat flux during charging phase.  
Cooling phase was passive (ambient lab air).

Ambient temperature recorded around **22–23°C** during most tests.

---

## Cycle 1 – Charging Test

Start time roughly 09:30.

Procedure followed:

1. apply heater power (approx 60 W)
2. record temperature every 60 seconds
3. observe PCM state transition

Partial temperature readings:

| Time (min) | T_top | T_center | T_base |
|-------------|-------|----------|-------|
| 0 | 23.1 | 22.9 | 23.0 |
| 5 | 35.2 | 33.8 | 31.4 |
| 10 | 47.0 | 44.6 | 39.8 |
| 15 | 55.8 | 52.2 | 46.1 |

At ~17 min the center sensor plateaued briefly, suggesting onset of phase transition.

However the plateau duration seemed shorter than expected.

Possible explanations written in margin:

- PCM mixture ratio off  
- sensor placement not ideal  
- heat distribution uneven

---

## Visual Observations

During heating the top layer appeared to soften first.  
The base region remained solid slightly longer.

Sketch note (not digitized):


Top: semi-liquid
Middle: slushy
Bottom: solid


This gradient might indicate uneven thermal conductivity.

Another observation: slight bubbling noise around minute 12.

Cause unclear — could be trapped air pockets.

---

## Cooling Phase

After heater shutdown the cell was allowed to cool naturally.

Cooling log excerpt:

| Time after power off | Center Temp |
|----------------------|-------------|
| 5 min | 52.3°C |
| 15 min | 47.6°C |
| 30 min | 40.1°C |
| 60 min | 32.8°C |

Cooling was slower than predicted by the simulation model used earlier.

Possible reasons mentioned by operator:

- insufficient airflow  
- higher PCM mass than model assumed

---

## Cycle 2 – Repeated Heating

The second cycle started without fully returning to baseline temperature.

Procedure mostly same as cycle 1 but heater set to ~65 W.

Observations:

- temperature ramp slightly faster
- phase transition point roughly similar (~53–55°C)
- small liquid pocket observed near thermocouple probe

Data log fragment:

| Time (min) | T_center |
|-------------|-----------|
| 0 | 34.2 |
| 5 | 44.8 |
| 10 | 53.4 |
| 12 | 54.0 |

Operator comment:  
“phase change seems consistent but melting region uneven.”

---

## Anomaly – Sensor Spike

At ~minute 8 of the second cycle, the base thermocouple briefly jumped to **67°C**, then returned to normal range.

Suspected causes:

- loose sensor contact
- electrical noise
- data logger glitch

Since other sensors did not show similar spikes, the reading was flagged but not used for analysis.

---

## Material Condition Check

After completing two cycles the cell was opened for inspection.

Notes:

- PCM still visually intact  
- no discoloration detected  
- minor residue on inner wall

Unclear if the residue originated from the PCM mixture or container surface treatment.

Sample removed for later chemical check.

---

## Preliminary Interpretation

General observations:

- PCM does undergo phase transition within expected temperature band  
- heat distribution may be uneven inside the cell  
- cooling time longer than simulation predicted

The uneven melting pattern might reduce effective energy storage efficiency.

But this needs confirmation with more controlled instrumentation.

---

## Next Planned Tests

Proposed adjustments for next iteration:

1. add additional thermocouple near mid-radius
2. increase airflow during cooling
3. verify PCM composition ratio
4. test alternative container materials

One idea mentioned briefly: inserting a copper fin structure to improve heat distribution.

This modification has not yet been implemented.

---

## Miscellaneous Notes

- data logger software froze once during recording (no data lost)  
- lab humidity unusually high during day 2  
- one heating run paused due to power supply limit warning

Some entries in the raw notebook were partially illegible; they may require clarification during the next data review session.

---

End of experiment log excerpt
