from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from physics import rk4_step


@dataclass
class ConjunctionWarning:
    satellite_id: str
    debris_id: str
    tca_seconds: float
    miss_distance_km: float
    relative_angle_deg: float
    risk_level: str


def _risk_level(miss_distance_km: float) -> str:
    if miss_distance_km < 1.0:
        return "CRITICAL"
    if miss_distance_km < 5.0:
        return "WARNING"
    return "SAFE"


def predict_tca(
    sat_state: np.ndarray,
    debris_state: np.ndarray,
    horizon_seconds: int,
    sample_seconds: int,
) -> tuple[float, float, np.ndarray, np.ndarray]:
    sat = sat_state.copy()
    deb = debris_state.copy()

    best_tca = 0.0
    best_dist = float("inf")
    best_sat = sat[:3].copy()
    best_deb = deb[:3].copy()

    for t in range(sample_seconds, horizon_seconds + sample_seconds, sample_seconds):
        sat = rk4_step(sat, sample_seconds)
        deb = rk4_step(deb, sample_seconds)
        dist = float(np.linalg.norm(sat[:3] - deb[:3]))
        if dist < best_dist:
            best_dist = dist
            best_tca = float(t)
            best_sat = sat[:3].copy()
            best_deb = deb[:3].copy()

    return best_tca, best_dist, best_sat, best_deb


def assess_conjunctions(
    satellites: dict[str, np.ndarray],
    debris: dict[str, np.ndarray],
    horizon_seconds: int = 7200,
    sample_seconds: int = 30,
    miss_threshold_km: float = 50.0,
) -> list[ConjunctionWarning]:
    if not satellites or not debris:
        return []

    warnings: list[ConjunctionWarning] = []

    for sat_id, sat_state in satellites.items():
        for deb_id, deb_state in debris.items():
            tca, miss, sat_pos, deb_pos = predict_tca(
                sat_state, deb_state, horizon_seconds, sample_seconds,
            )

            if miss > miss_threshold_km:
                continue

            rel = deb_pos - sat_pos
            angle = float(np.degrees(np.arctan2(rel[1], rel[0])))
            risk = _risk_level(miss)

            warnings.append(
                ConjunctionWarning(
                    satellite_id=sat_id,
                    debris_id=deb_id,
                    tca_seconds=tca,
                    miss_distance_km=miss,
                    relative_angle_deg=angle,
                    risk_level=risk,
                )
            )

    warnings.sort(key=lambda c: (c.miss_distance_km, c.tca_seconds))
    return warnings[:500]
