INTERNAL ENGINEERING DESIGN NOTE  
System: Distributed Cold-Chain Monitoring Node (CCMN)  
Doc Type: Internal architecture + component reasoning  
Author: Embedded Systems Group  
Revision: Working Draft — do not circulate outside engineering

---

Context

The Cold-Chain Monitoring Node (CCMN) is intended to track environmental conditions inside refrigerated transport containers and storage facilities.  
Unlike traditional single-sensor loggers, this system is designed as a **networked sensing node** capable of participating in a distributed telemetry network.

Primary monitored signals include:

- temperature gradients across container zones  
- humidity variations  
- door open/close events  
- shock or vibration events during transport  

The design goal is to provide **continuous condition monitoring** rather than periodic sampling alone.

---

Core Entities (System Components)

The following entities are central to the system architecture.

| Entity | Type | Function |
|------|------|----------|
| TempSensorArray | hardware module | captures distributed temperature readings |
| EnvController | embedded firmware | coordinates sensors and storage |
| DataBuffer | memory structure | stores local measurements |
| CommLink | network interface | transmits summarized telemetry |
| EventDetector | firmware logic | identifies anomalies |

Relationships between these entities determine the overall system behavior.

---

Subsystem Overview

The monitoring node can be divided into four functional subsystems.

1. Sensor acquisition subsystem  
2. Embedded processing subsystem  
3. Data persistence subsystem  
4. Communication subsystem  

A simplified internal structure is shown below.


Sensor Inputs
↓
Sensor Interface Layer
↓
EnvController
↓
EventDetector
↓
DataBuffer
↓
CommLink
↓
External Monitoring Platform


Not all deployments will enable real-time communication; some may operate primarily in logging mode.

---

Sensor Layer

The sensor layer is responsible for capturing environmental signals from the container interior.

Typical configuration:

| Sensor | Quantity | Sampling Rate |
|------|-----------|---------------|
| digital temperature probe | 4 | every 30 seconds |
| humidity sensor | 1 | every 60 seconds |
| accelerometer | 1 | event-based |
| magnetic door sensor | 1 | state-change |

Temperature probes are positioned at different vertical levels to detect uneven cooling patterns.

However, exact sensor placement varies depending on container design.

---

Processing Layer

The EnvController firmware performs three major functions:

• polling sensor interfaces  
• performing threshold analysis  
• scheduling data transmissions

The firmware also maintains an internal clock used to timestamp environmental readings.

Pseudo-logic example:


loop:
read sensors
update DataBuffer
check thresholds
if anomaly:
trigger EventDetector
if transmit_window:
send summary packet


Firmware timing parameters are configurable but constrained by battery usage.

---

Data Structures

Environmental measurements are stored temporarily in a circular memory buffer.

Example structure:

| Field | Type |
|------|------|
| timestamp | uint32 |
| temperature_avg | float |
| humidity | float |
| shock_flag | bool |

The buffer typically stores several hours of readings before transmission.

However, if the CommLink is unavailable the buffer may overwrite older data.

---

Communication Architecture

The system supports two communication modes.

| Mode | Description |
|------|-------------|
| periodic upload | summary data transmitted every hour |
| event transmission | immediate transmission if anomaly detected |

Communication technologies under evaluation:

- LoRaWAN
- LTE-M
- NB-IoT

Choice depends on deployment environment and connectivity availability.

---

Event Detection Logic

The EventDetector module evaluates sensor readings against predefined conditions.

Example anomaly events:

- temperature exceeding safe range  
- prolonged door open state  
- excessive vibration during shipment  

Simplified detection logic:


if temperature > threshold_high:
flag temperature_event

if door_state == open and duration > limit:
flag door_event


Multiple events may be logged simultaneously.

---

Energy Management

Battery lifetime is a critical constraint for the monitoring node.

Power consumption sources include:

- sensor polling
- wireless transmission
- processor activity

To extend operational lifetime, the system spends most of its time in low-power sleep mode.

Typical duty cycle:

| State | Duration |
|------|----------|
| sleep | ~95% |
| active sensing | ~4% |
| transmission | ~1% |

Actual ratios vary depending on anomaly frequency.

---

Observed Engineering Trade-offs

Several design trade-offs emerged during early development.

1. increasing sensor frequency improves resolution but reduces battery life  
2. stronger communication protocols improve reliability but increase power consumption  
3. larger data buffers provide redundancy but require additional memory

At present the design prioritizes **battery longevity and reliability over high-resolution data sampling**.

---

Implementation Questions Still Open

Several engineering questions remain unresolved.

- should the node support firmware updates over the air?  
- should temperature readings be stored individually or as aggregated statistics?  
- what is the acceptable delay before anomaly alerts reach operators?

These questions affect both firmware complexity and communication costs.

---

Closing Note

The Cold-Chain Monitoring Node is currently in prototype development.  
The architecture described above reflects the present design direction but may evolve as field testing reveals operational constraints.

Further testing during refrigerated transport trials will likely refine sensor placement and anomaly detection thresholds.
