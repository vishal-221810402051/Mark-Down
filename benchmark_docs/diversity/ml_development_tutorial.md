# Machine Learning Deployment Tutorial  
### Deploying a Real-Time Fraud Detection Model

Audience: data engineers / ML engineers  
Environment assumptions: Linux server or cloud VM  
Estimated setup time: ~45-60 minutes

This tutorial walks through deploying a simple fraud detection model using a Python API service.  
The workflow assumes the model has already been trained.

---

## 1. Overview

Goal: expose a trained ML model through a REST API so external systems can send transaction data and receive fraud predictions.

Deployment components:

| Component | Purpose |
|----------|---------|
| Model file | trained fraud classifier |
| API service | receives requests and returns predictions |
| Container | packages runtime environment |
| Monitoring | basic logging of predictions |

Architecture summary:


Client App
↓
HTTP Request
↓
Prediction API
↓
ML Model
↓
Prediction Response


---

## 2. Environment Setup

First create a working directory.

```bash
mkdir fraud-ml-service
cd fraud-ml-service

Create a Python virtual environment.

python3 -m venv venv
source venv/bin/activate

Install required dependencies.

pip install fastapi uvicorn scikit-learn pandas joblib
3. Model Loading

Assume the trained model is stored as:

models/fraud_model.joblib

Example Python code to load the model.

import joblib

model = joblib.load("models/fraud_model.joblib")

Typical model inputs may include:

Feature	Description
amount	transaction value
location_score	geo anomaly score
device_risk	device trust indicator
time_delta	time since last transaction
4. Building the Prediction API

Create a file called:

app.py

Example implementation:

from fastapi import FastAPI
import joblib
import pandas as pd

app = FastAPI()

model = joblib.load("models/fraud_model.joblib")

@app.get("/")
def root():
    return {"status": "fraud-model-online"}

@app.post("/predict")
def predict(data: dict):
    df = pd.DataFrame([data])
    prediction = model.predict(df)[0]
    return {"fraud_prediction": int(prediction)}

This API exposes a /predict endpoint.

5. Running the Service

Start the API locally.

uvicorn app:app --host 0.0.0.0 --port 8000

Expected console output:

INFO: Uvicorn running on http://0.0.0.0:8000

Test using curl.

curl -X POST http://localhost:8000/predict \
-H "Content-Type: application/json" \
-d '{"amount":1200,"location_score":0.8,"device_risk":0.3,"time_delta":2}'

Example response:

{"fraud_prediction":1}
6. Containerizing the Service

Create a Dockerfile.

FROM python:3.10

WORKDIR /app

COPY . /app

RUN pip install fastapi uvicorn scikit-learn pandas joblib

CMD ["uvicorn","app:app","--host","0.0.0.0","--port","8000"]

Build the container.

docker build -t fraud-api .

Run the container.

docker run -p 8000:8000 fraud-api
7. Logging Predictions

Basic logging can be added to track model usage.

Modify the API slightly.

import logging

logging.basicConfig(level=logging.INFO)

@app.post("/predict")
def predict(data: dict):
    logging.info(f"Prediction request: {data}")
    df = pd.DataFrame([data])
    prediction = model.predict(df)[0]
    return {"fraud_prediction": int(prediction)}

Logs will appear in the service console.

8. Monitoring Suggestions

For production deployments consider adding:

request latency metrics

prediction drift monitoring

error tracking

model version tracking

Example monitoring stack:

Tool	Purpose
Prometheus	metrics
Grafana	visualization
ELK stack	log analysis
9. Basic Deployment Topology

Typical cloud deployment structure:

Internet
   ↓
Load Balancer
   ↓
Prediction API Container
   ↓
Model Runtime

For scaling, multiple containers can run behind the load balancer.

10. Common Issues
Issue	Cause	Fix
API fails to start	dependency mismatch	reinstall packages
slow prediction	model too large	optimize model
JSON errors	wrong request format	validate inputs
11. Next Steps

Possible improvements:

batch prediction endpoint

GPU acceleration

feature store integration

model retraining pipeline

More advanced deployments may integrate the model service with message queues or event streams for large-scale transaction processing.
