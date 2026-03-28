export const SAMPLES: Record<string, string> = {
  basic: `# Title
## Section
This is a paragraph.

- Bullet 1
- Bullet 2

\`\`\`python
def hello():
    print("Hello")
\`\`\`
`,
  chatgpt: `Title:
My Doc

Section: Installation
pip install fastapi
uvicorn app:main --reload

Notes:
• this bullet uses a dot
1) this numbering uses a bracket

Flow:
A -> B -> C
`,
  tables: `# Data Summary

Name    Age    City
John    21     Paris
Anna    30     Berlin

- Alpha
- Beta
  - Nested 1
  - Nested 2
`,
  tables2: `# Tables v2

Name     Age     City
John     21      Paris
Anna     30      Berlin

Name | Score | Rank
A    | 98    | 1
B    | 87    | 2
`,
  mermaid: `# Architecture

\`\`\`mermaid
graph TD
  A[User] --> B[Web App]
  B --> C[Parser]
  C --> D[HTML Renderer]
  D --> E[PDF Engine]
\`\`\`
`,
  smart_logistics: `# Smart Logistics Monitoring Platform

Document Type: Product demo sample for structure extraction.

## Context
This platform monitors fleet temperature, humidity, and delivery events using distributed nodes and edge intelligence.

## Phase 1 - Planning

Checklist:
- identify shipment categories
- define acceptable temperature ranges
- map warehouse handoff points
- prepare device inventory

## Phase 2 - Prototype Build

Core Components:
Sensor Unit
Edge Controller
Telemetry Buffer
Alert Engine

Workflow:
1. initialize all modules
2. read sensors
3. store measurements
4. evaluate thresholds
5. send alert if anomaly exists

## Phase 3 - Pilot Deployment

Procedure:
1. install devices in 3 vehicles
2. collect 7 days of baseline data
3. compare route-level anomalies
4. tune thresholds for false positives

Validation:
| Checkpoint | Criteria | Owner |
|-----------|----------|-------|
| Connectivity | packet loss < 2% | network team |
| Battery | survives 7 days | hardware team |
| Alerting | anomaly notification works | software team |
`,
};
