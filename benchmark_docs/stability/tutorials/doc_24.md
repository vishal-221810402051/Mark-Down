# Tutorial - Building a Raspberry Pi Sensor Node

Overview
This tutorial walks through a practical implementation path for Building a Raspberry Pi Sensor Node.

## Prerequisites
- Linux shell access
- Git installed
- Python 3.11 or later

Steps:
1. Create project workspace
2. Install dependencies
3. Run bootstrap command
4. Validate service health

Workflow:
1. Prepare environment
2. Configure services
3. Execute pipeline
4. Verify outputs

Install dependencies
`ash
mkdir demo-project
cd demo-project
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
`

Run checks
`ash
npm run lint
npm run build
docker compose up --build -d
`

Troubleshooting
- If ports are busy, update compose mapping
- If dependency install fails, clear pip cache

Validation
| Check | Command | Expected |
|---|---|---|
| API health | curl http://localhost:3000/health | status ok |
| Logs stream | docker compose logs -f app | no crash loop |
| Build artifacts | ls dist | files present |
