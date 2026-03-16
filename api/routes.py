from __future__ import annotations

from datetime import datetime
from typing import Any

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from engine.models import ManeuverCommand
from engine.sim_state import SimulationState


class VecModel(BaseModel):
    x: float
    y: float
    z: float


class TelemetryObject(BaseModel):
    id: str
    type: str
    r: VecModel
    v: VecModel


class TelemetryRequest(BaseModel):
    timestamp: datetime
    objects: list[TelemetryObject]


class ManeuverItem(BaseModel):
    burn_id: str
    burnTime: datetime
    deltaV_vector: VecModel


class ManeuverRequest(BaseModel):
    satelliteId: str
    maneuver_sequence: list[ManeuverItem]


class StepRequest(BaseModel):
    step_seconds: int = Field(gt=0)


class SeedRequest(BaseModel):
    satellite_count: int = Field(default=50, ge=1, le=200)
    debris_count: int = Field(default=20, ge=1, le=20000)


class TimeWarpRequest(BaseModel):
    multiplier: int


def build_router(state: SimulationState) -> APIRouter:
    router = APIRouter(prefix="/api")

    @router.post("/telemetry")
    async def telemetry(payload: TelemetryRequest) -> dict[str, Any]:
        processed = 0
        for obj in payload.objects:
            obj_type = "SATELLITE" if obj.type.upper() in {"SAT", "SATELLITE"} else "DEBRIS"
            state_vec = np.array([obj.r.x, obj.r.y, obj.r.z, obj.v.x, obj.v.y, obj.v.z], dtype=float)
            state.ingest_object(obj.id, obj_type, state_vec)
            processed += 1

        state.current_time = payload.timestamp
        state.conjunctions = state.conjunctions

        return {
            "status": "ACK",
            "processed_count": processed,
            "active_cdm_warnings": len(state.conjunctions),
        }

    @router.post("/maneuver/schedule", status_code=202)
    async def schedule_maneuver(payload: ManeuverRequest) -> dict[str, Any]:
        sat = state.satellites.get(payload.satelliteId)
        if sat is None:
            raise HTTPException(status_code=404, detail=f"Unknown satellite: {payload.satelliteId}")

        commands = [
            ManeuverCommand(
                burn_id=item.burn_id,
                satellite_id=payload.satelliteId,
                burn_time=item.burnTime,
                delta_v_eci_kmps=np.array([item.deltaV_vector.x, item.deltaV_vector.y, item.deltaV_vector.z], dtype=float),
            )
            for item in payload.maneuver_sequence
        ]

        los_ok, fuel_ok, projected_mass = state.schedule_maneuvers(payload.satelliteId, commands)
        status = "SCHEDULED" if (los_ok and fuel_ok) else "REJECTED"

        return {
            "status": status,
            "validation": {
                "ground_station_los": los_ok,
                "sufficient_fuel": fuel_ok,
                "projected_mass_remaining_kg": projected_mass,
            },
        }

    @router.post("/simulate/step")
    async def simulate_step(payload: StepRequest) -> dict[str, Any]:
        summary = state.step(payload.step_seconds)
        return {
            "status": "STEP_COMPLETE",
            "new_timestamp": state.current_time.isoformat(),
            "collisions_detected": summary.collisions_detected,
            "maneuvers_executed": summary.maneuvers_executed,
        }

    @router.get("/visualization/snapshot")
    async def visualization_snapshot() -> dict[str, Any]:
        # Snapshot should be read-only and fast. Simulation advancement is
        # handled by the stream loop.
        return state.snapshot()

    @router.post("/debug/seed")
    async def debug_seed(payload: SeedRequest) -> dict[str, Any]:
        state.seed_default_scenario(
            satellite_count=payload.satellite_count,
            debris_count=payload.debris_count,
        )
        return {
            "status": "SEEDED",
            "satellites": len(state.satellites),
            "debris": len(state.debris),
            "active_cdm_warnings": len(state.conjunctions),
        }

    @router.get("/sim/timewarp")
    async def get_time_warp() -> dict[str, Any]:
        return {"time_warp_x": state.time_warp_multiplier}

    @router.post("/sim/timewarp")
    async def set_time_warp(payload: TimeWarpRequest) -> dict[str, Any]:
        try:
            current = state.set_time_warp(payload.multiplier)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        return {"status": "UPDATED", "time_warp_x": current}

    return router
