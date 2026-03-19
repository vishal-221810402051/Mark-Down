# Autonomous Warehouse Sorting Robot  
### System Architecture Document

Document Version: 0.9 (Draft)  
Prepared by: Robotics Systems Engineering Team  
Target Deployment: Medium-scale fulfillment centers  
Last Updated: March 2026

---

# 1. Overview

The Autonomous Warehouse Sorting Robot (AWSR) is a mobile robotic platform designed to transport, classify, and stage packages inside fulfillment centers without human intervention.

Unlike traditional conveyor-based sorting systems, AWSR operates as a **distributed robotic fleet**, capable of dynamically adapting to layout changes, temporary blockages, and fluctuating package volumes.

The system integrates:

- mobile robotic platforms
- centralized coordination services
- real-time perception
- task allocation engine
- warehouse mapping and navigation layers

The architecture emphasizes **fault tolerance, decentralized execution, and scalable fleet management**.

---

# 2. System Architecture

The architecture consists of three primary layers:

1. Robot Hardware Layer  
2. Edge Control Layer  
3. Fleet Management Cloud Layer  

          +-------------------------------+
          |     Fleet Management Cloud    |
          |-------------------------------|
          | Task Scheduler                |
          | Global Map Service            |
          | Analytics & Monitoring        |
          +---------------+---------------+
                          |
                          |
            +-------------+-------------+
            |     Edge Coordination     |
            |---------------------------|
            | Local Task Dispatcher     |
            | Obstacle Broadcast Bus    |
            | Robot Health Monitor      |
            +-------------+-------------+
                          |
             WiFi / Industrial Network
                          |
   +-----------+-----------+-----------+-----------+
   |           |           |           |           |

Robot-01 Robot-02 Robot-03 Robot-04 Robot-N


---

# 3. Robot Hardware Architecture

Each robot unit contains sensing, computation, and mobility subsystems designed for autonomous operation.

## 3.1 Mechanical Subsystem

Components include:

- Differential drive chassis
- Brushless DC wheel motors
- Passive suspension module
- Package holding tray with load sensor

Typical dimensions:

| Parameter | Value |
|--------|--------|
| Length | 72 cm |
| Width | 54 cm |
| Height | 38 cm |
| Max Payload | 30 kg |
| Max Speed | 1.8 m/s |

---

## 3.2 Sensor Stack

The robot relies on multiple sensors for localization and obstacle detection.

| Sensor Type | Purpose | Update Rate |
|-------------|--------|-------------|
| LiDAR (360°) | SLAM mapping | 10 Hz |
| Depth Camera | Object detection | 30 Hz |
| IMU | Orientation estimation | 200 Hz |
| Wheel Encoders | Odometry | 100 Hz |
| Ultrasonic Sensors | Close obstacle detection | 20 Hz |

Sensor fusion is handled by the onboard **localization module**.

---

# 4. Software Architecture

The system software runs on a ROS-based modular architecture.

Core modules communicate through a publish-subscribe messaging system.

## 4.1 Core Runtime Modules

| Module | Function |
|------|----------|
| Navigation Engine | Path planning and trajectory control |
| Perception Node | Object detection and classification |
| Localization Node | SLAM + sensor fusion |
| Task Executor | Executes assigned transport tasks |
| Diagnostics Agent | Reports system health |

---

## 4.2 Data Flow


Sensors
↓
Perception Pipeline
↓
Localization + Mapping
↓
Navigation Planner
↓
Motor Control Interface


Each stage publishes state updates through the internal robot message bus.

---

# 5. Fleet Coordination Layer

Individual robots operate semi-autonomously but receive task assignments from a **Fleet Coordinator Service**.

Responsibilities include:

- task scheduling
- traffic conflict resolution
- battery-aware dispatching
- workload balancing across robots

The coordinator maintains a **live occupancy grid** representing robot positions and known obstacles.

---

## 5.1 Task Allocation Strategy

Task assignments use a weighted scoring model:


score =
(distance_to_task * w1) +
(battery_penalty * w2) +
(robot_load_factor * w3)


The robot with the lowest computed score receives the task.

Weights are configurable depending on operational priorities.

---

# 6. Communication Architecture

Robots communicate with the edge server through industrial WiFi using a lightweight messaging protocol.

Primary message channels:

| Channel | Data |
|-------|------|
| robot/status | robot health, battery |
| robot/pose | position updates |
| robot/events | obstacle alerts |
| dispatch/task | task assignments |

Message serialization uses **Protocol Buffers** to reduce bandwidth overhead.

---

# 7. Failure Handling

Robustness is achieved through layered safety mechanisms.

### Local Robot Safeguards

- emergency stop trigger
- obstacle avoidance override
- fallback localization

### Fleet-level Safeguards

- task reassignment
- robot isolation mode
- automatic recovery attempts

If a robot stops responding for > 30 seconds, the coordinator marks it **inactive** and redistributes its tasks.

---

# 8. Deployment Architecture

Warehouse deployments typically follow a **hub-based network topology**.

         Cloud Monitoring
                |
          Edge Server
       /        |        \
    AP-1      AP-2      AP-3
   / | \      / | \      / | \
Robots Robots Robots Robots Robots

Each access point manages ~20 robots under normal operating conditions.

---

# 9. Operational Workflow

Typical package sorting cycle:

1. Package enters warehouse intake station
2. Vision system identifies destination zone
3. Fleet coordinator assigns robot
4. Robot navigates to pickup location
5. Robot transports package
6. Package dropped at staging zone

The entire cycle typically completes within **60-120 seconds** depending on distance.

---

# 10. Known Limitations

The current architecture has several constraints:

- high WiFi congestion can delay task messages
- LiDAR reflections in metallic environments affect SLAM accuracy
- battery swaps currently require manual intervention

Future revisions may introduce **edge AI inference nodes** for improved perception reliability.

---

# 11. Appendix - Example Robot Telemetry Payload

```json
{
  "robot_id": "R17",
  "battery": 78,
  "pose": {
    "x": 12.43,
    "y": 8.17,
    "theta": 1.57
  },
  "task_state": "delivering",
  "payload_weight": 12.4,
  "health": "nominal"
}
```
