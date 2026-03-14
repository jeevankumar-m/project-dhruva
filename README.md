# Dhruva CDM

Autonomous Constellation Manager + Dhruva CDM visualizer for NSH 2026.

## Run backend

```bash
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000
```

## Run frontend

```bash
cd dhruva-frontend
npm install
npm run dev
```

Backend endpoints:
- `POST /api/telemetry`
- `POST /api/maneuver/schedule`
- `POST /api/simulate/step`
- `GET /api/visualization/snapshot`
- `WS /orbit`
