from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from api.routes import build_router
from engine.sim_state import SimulationState

app = FastAPI(title="Dhruva CDM", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
state = SimulationState(Path(__file__).resolve().parent)
app.include_router(build_router(state))


@app.get("/")
async def health() -> dict:
    return {"status": "ok", "service": "dhruva-cdm"}


@app.websocket("/orbit")
async def orbit_stream(ws: WebSocket) -> None:
    await ws.accept()
    try:
        while True:
            warp = max(1, state.time_warp_multiplier)
            step_seconds = 2.0 * warp
            state.stream_tick(step_seconds=step_seconds, reassess_every=20)
            await ws.send_json(state.snapshot())
            await asyncio.sleep(0.10)
    except WebSocketDisconnect:
        return
    except (AssertionError, Exception):
        return
