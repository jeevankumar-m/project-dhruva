from __future__ import annotations

from dataclasses import dataclass
import math

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
    spatial_cell_km: float = 500.0,
    max_initial_range_km: float = 3000.0,
) -> list[ConjunctionWarning]:
    if not satellites or not debris:
        return []

    warnings: list[ConjunctionWarning] = []
    checked_pairs: set[tuple[str, str]] = set()

    # Spatial hash indexing to avoid brute-force O(N^2) pair checks.
    debris_cells: dict[tuple[int, int, int], list[tuple[str, np.ndarray]]] = {}
    for deb_id, deb_state in debris.items():
        pos = deb_state[:3]
        key = (
            int(math.floor(float(pos[0]) / spatial_cell_km)),
            int(math.floor(float(pos[1]) / spatial_cell_km)),
            int(math.floor(float(pos[2]) / spatial_cell_km)),
        )
        debris_cells.setdefault(key, []).append((deb_id, deb_state))

    neighbor_radius = int(math.ceil(max_initial_range_km / spatial_cell_km))

    for sat_id, sat_state in satellites.items():
        sat_pos = sat_state[:3]
        sat_vel = sat_state[3:6]
        sat_key = (
            int(math.floor(float(sat_pos[0]) / spatial_cell_km)),
            int(math.floor(float(sat_pos[1]) / spatial_cell_km)),
            int(math.floor(float(sat_pos[2]) / spatial_cell_km)),
        )

        candidate_debris: list[tuple[str, np.ndarray]] = []
        for dx in range(-neighbor_radius, neighbor_radius + 1):
            for dy in range(-neighbor_radius, neighbor_radius + 1):
                for dz in range(-neighbor_radius, neighbor_radius + 1):
                    candidate_debris.extend(
                        debris_cells.get((sat_key[0] + dx, sat_key[1] + dy, sat_key[2] + dz), [])
                    )

        for deb_id, deb_state in candidate_debris:
            pair_key = (sat_id, deb_id)
            if pair_key in checked_pairs:
                continue
            checked_pairs.add(pair_key)

            deb_pos = deb_state[:3]
            deb_vel = deb_state[3:6]
            rel_pos = deb_pos - sat_pos
            rel_vel = deb_vel - sat_vel
            current_dist = float(np.linalg.norm(rel_pos))
            rel_speed = float(np.linalg.norm(rel_vel))

            if current_dist > max_initial_range_km:
                continue

            # Conservative kinematic filter: if even straight-line closure cannot
            # approach the threshold in horizon, skip expensive propagation.
            max_closure = rel_speed * float(horizon_seconds)
            if current_dist - max_closure > miss_threshold_km:
                continue

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
