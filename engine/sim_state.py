from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

from engine.conjunction import ConjunctionWarning, assess_conjunctions
from engine.coordinates import eci_to_geodetic
from engine.los import GroundStationNetwork
from engine.models import ManeuverCommand, Satellite, SpaceObject
from physics import MU, RE, rk4_step, tsiolkovsky

MAX_BURN_MPS = 15.0
THERMAL_COOLDOWN_SECONDS = 600
MIN_COMMAND_LATENCY_SECONDS = 10
CRITICAL_COLLISION_KM = 0.1


@dataclass
class ExecutionSummary:
    maneuvers_executed: int = 0
    collisions_detected: int = 0


class SimulationState:
    def __init__(self, root_path: Path):
        self.current_time = datetime(2026, 3, 12, 8, 0, 0, tzinfo=timezone.utc)
        self.time_warp_multiplier = 1
        self.satellites: dict[str, Satellite] = {}
        self.debris: dict[str, SpaceObject] = {}
        self.maneuvers: list[ManeuverCommand] = []
        self.conjunctions: list[ConjunctionWarning] = []
        self.total_collisions_avoided = 0
        self._stream_ticks_since_assessment = 0

        gs_csv = root_path / "data" / "ground_stations.csv"
        self.ground_stations = GroundStationNetwork.from_csv(gs_csv)
        self.seed_default_scenario()

    def set_time_warp(self, multiplier: int) -> int:
        allowed = [1, 2, 10, 25, 100]
        if multiplier not in allowed:
            raise ValueError(f"time_warp must be one of {allowed}")
        self.time_warp_multiplier = multiplier
        return self.time_warp_multiplier

    @staticmethod
    def _circular_state(
        radius_km: float,
        phase_rad: float,
        inclination_rad: float,
        raan_rad: float,
    ) -> np.ndarray:
        pos_orb = np.array(
            [
                radius_km * np.cos(phase_rad),
                radius_km * np.sin(phase_rad),
                0.0,
            ],
            dtype=float,
        )
        speed = np.sqrt(MU / radius_km)
        vel_orb = np.array(
            [
                -speed * np.sin(phase_rad),
                speed * np.cos(phase_rad),
                0.0,
            ],
            dtype=float,
        )

        c_raan = np.cos(raan_rad)
        s_raan = np.sin(raan_rad)
        c_inc = np.cos(inclination_rad)
        s_inc = np.sin(inclination_rad)
        rot = np.array(
            [
                [c_raan, -s_raan * c_inc, s_raan * s_inc],
                [s_raan, c_raan * c_inc, -c_raan * s_inc],
                [0.0, s_inc, c_inc],
            ],
            dtype=float,
        )
        pos_eci = rot @ pos_orb
        vel_eci = rot @ vel_orb
        return np.concatenate([pos_eci, vel_eci])

    def seed_default_scenario(
        self,
        satellite_count: int = 50,
        debris_count: int = 20,
    ) -> None:
        self.satellites.clear()
        self.debris.clear()
        self.maneuvers.clear()
        self.conjunctions.clear()
        self.total_collisions_avoided = 0

        for i in range(satellite_count):
            plane = i % 5
            slot = i // 5
            altitude_km = 500.0 + 20.0 * plane
            radius_km = RE + altitude_km
            phase = 2.0 * np.pi * (slot / max(1, satellite_count // 5))
            phase += plane * 0.06
            inclination = np.deg2rad(50.0 + plane * 2.0)
            raan = np.deg2rad((360.0 / 5.0) * plane)

            state = self._circular_state(radius_km, phase, inclination, raan)
            sat_id = f"SAT-Alpha-{i+1:02d}"
            self.satellites[sat_id] = Satellite(
                object_id=sat_id,
                object_type="SATELLITE",
                state=state.copy(),
                nominal_state=state.copy(),
            )

        self._seed_test_debris(debris_count)
        self._seed_test_maneuvers()

        self.conjunctions = assess_conjunctions(
            satellites={k: v.state.copy() for k, v in self.satellites.items()},
            debris={k: v.state.copy() for k, v in self.debris.items()},
        )

    def _seed_test_debris(self, count: int = 20) -> None:
        sat_list = list(self.satellites.values())
        if not sat_list:
            return

        threat_configs: list[dict] = [
            {"anchor_idx": 0, "pos_offset": [0.05, -0.03, 0.02], "vel_offset": [0.0012, -0.0006, 0.0001], "label": "head-on"},
            {"anchor_idx": 0, "pos_offset": [-0.08, 0.04, -0.01], "vel_offset": [-0.0018, 0.0010, -0.0003], "label": "retrograde"},
            {"anchor_idx": 1, "pos_offset": [0.02, 0.06, -0.03], "vel_offset": [0.0008, -0.0015, 0.0005], "label": "crossing"},
            {"anchor_idx": 2, "pos_offset": [0.10, 0.0, 0.0], "vel_offset": [0.0, 0.0020, 0.0], "label": "radial"},
            {"anchor_idx": 3, "pos_offset": [-0.04, -0.04, 0.06], "vel_offset": [0.0005, 0.0005, -0.0012], "label": "normal"},
            {"anchor_idx": 4, "pos_offset": [0.03, -0.02, 0.01], "vel_offset": [-0.0010, 0.0008, -0.0002], "label": "graze"},
            {"anchor_idx": 5, "pos_offset": [0.5, -0.3, 0.2], "vel_offset": [0.0020, -0.0015, 0.0005], "label": "warning-range"},
            {"anchor_idx": 6, "pos_offset": [1.0, 0.5, -0.3], "vel_offset": [-0.0008, 0.0012, 0.0003], "label": "warning-2"},
            {"anchor_idx": 7, "pos_offset": [3.0, -1.5, 1.0], "vel_offset": [0.0015, -0.0008, 0.0002], "label": "safe-approach"},
            {"anchor_idx": 8, "pos_offset": [2.0, 2.0, -1.0], "vel_offset": [-0.0005, -0.0010, 0.0008], "label": "safe-2"},
        ]

        rng = np.random.default_rng(99)

        for i in range(count):
            if i < len(threat_configs):
                cfg = threat_configs[i]
            else:
                cfg = threat_configs[i % len(threat_configs)]

            anchor = sat_list[cfg["anchor_idx"] % len(sat_list)]
            deb_state = anchor.state.copy()

            scale = 1.0 if i < len(threat_configs) else (1.0 + rng.uniform(0.5, 3.0))
            deb_state[:3] += np.array(cfg["pos_offset"], dtype=float) * scale
            deb_state[3:6] += np.array(cfg["vel_offset"], dtype=float) * scale

            if i >= len(threat_configs):
                deb_state[:3] += rng.normal(0.0, 0.5, size=3)
                deb_state[3:6] += rng.normal(0.0, 0.0003, size=3)

            debris_id = f"DEB-{i+1:04d}"
            self.debris[debris_id] = SpaceObject(
                object_id=debris_id,
                object_type="DEBRIS",
                state=deb_state,
            )

    def _seed_test_maneuvers(self) -> None:
        sat_ids = list(self.satellites.keys())[:6]
        base = self.current_time

        test_burns = [
            ("SAT-Alpha-01", "EVASION_01", 600, [0.002, 0.015, -0.001]),
            ("SAT-Alpha-01", "RECOVERY_01", 1800, [-0.0019, -0.014, 0.001]),
            ("SAT-Alpha-02", "EVASION_02", 900, [0.005, -0.010, 0.003]),
            ("SAT-Alpha-02", "RECOVERY_02", 2400, [-0.004, 0.009, -0.002]),
            ("SAT-Alpha-03", "EVASION_03", 1200, [-0.008, 0.012, 0.002]),
            ("SAT-Alpha-03", "RECOVERY_03", 3000, [0.007, -0.011, -0.001]),
            ("SAT-Alpha-04", "EVASION_04", 1500, [0.003, 0.008, -0.005]),
            ("SAT-Alpha-05", "EVASION_05", 2100, [-0.006, 0.004, 0.007]),
            ("SAT-Alpha-06", "EVASION_06", 3600, [0.010, -0.005, 0.002]),
            ("SAT-Alpha-06", "RECOVERY_06", 4800, [-0.009, 0.004, -0.001]),
        ]

        for sat_id, burn_id, dt_sec, dv in test_burns:
            if sat_id not in self.satellites:
                continue
            self.maneuvers.append(
                ManeuverCommand(
                    burn_id=burn_id,
                    satellite_id=sat_id,
                    burn_time=base + timedelta(seconds=dt_sec),
                    delta_v_eci_kmps=np.array(dv, dtype=float),
                )
            )

    def _auto_schedule_evasions(self) -> None:
        existing_burns: set[str] = set()
        for m in self.maneuvers:
            if not m.rejected:
                existing_burns.add(f"{m.satellite_id}:{m.burn_time.isoformat()}")

        for cdm in self.conjunctions:
            if cdm.risk_level not in {"WARNING", "CRITICAL"}:
                continue
            sat = self.satellites.get(cdm.satellite_id)
            if sat is None:
                continue

            burn_time = self.current_time + timedelta(seconds=max(30, cdm.tca_seconds * 0.3))
            key = f"{cdm.satellite_id}:{burn_time.isoformat()}"
            if key in existing_burns:
                continue

            recent_burns = [
                m for m in self.maneuvers
                if m.satellite_id == cdm.satellite_id and not m.rejected
                and abs((m.burn_time - burn_time).total_seconds()) < THERMAL_COOLDOWN_SECONDS
            ]
            if recent_burns:
                continue

            v = sat.state[3:6]
            v_mag = float(np.linalg.norm(v))
            if v_mag < 1e-10:
                continue
            v_unit = v / v_mag
            dv_magnitude = 0.005
            dv = v_unit * dv_magnitude

            candidate_evasion = ManeuverCommand(
                burn_id=f"AUTO-EVA-{cdm.debris_id}",
                satellite_id=cdm.satellite_id,
                burn_time=burn_time,
                delta_v_eci_kmps=dv,
            )
            pending_with_candidate = self._sorted_pending_for_satellite(cdm.satellite_id) + [candidate_evasion]
            fuel_ok, _, _ = self._project_satellite_mass_with_commands(sat, pending_with_candidate)
            if not fuel_ok:
                continue

            self.maneuvers.append(candidate_evasion)
            existing_burns.add(key)

            recovery_time = burn_time + timedelta(seconds=THERMAL_COOLDOWN_SECONDS + 60)
            candidate_recovery = ManeuverCommand(
                burn_id=f"AUTO-REC-{cdm.debris_id}",
                satellite_id=cdm.satellite_id,
                burn_time=recovery_time,
                delta_v_eci_kmps=-dv,
            )
            pending_with_recovery = self._sorted_pending_for_satellite(cdm.satellite_id) + [candidate_recovery]
            fuel_ok_recovery, _, _ = self._project_satellite_mass_with_commands(sat, pending_with_recovery)
            if fuel_ok_recovery:
                self.maneuvers.append(candidate_recovery)

    def _execute_stream_maneuvers(self, prev_time: datetime, new_time: datetime) -> None:
        due = [
            m for m in self.maneuvers
            if not m.executed and not m.rejected
            and m.burn_time <= new_time
            and m.satellite_id in self.satellites
        ]
        due.sort(key=lambda m: m.burn_time)
        for cmd in due:
            sat = self.satellites[cmd.satellite_id]
            if sat.last_burn_time is not None and cmd.burn_time <= sat.last_burn_time:
                cmd.rejected = True
                cmd.conflict = True
                continue
            dv_mps = float(np.linalg.norm(cmd.delta_v_eci_kmps)) * 1000.0
            if dv_mps > MAX_BURN_MPS:
                cmd.rejected = True
                continue
            dm_kg = tsiolkovsky(sat.mass_current_kg, dv_mps)
            if dm_kg > sat.fuel_kg:
                cmd.rejected = True
                continue
            sat.state[3:6] = sat.state[3:6] + cmd.delta_v_eci_kmps
            sat.fuel_kg -= float(dm_kg)
            sat.total_delta_v_mps += dv_mps
            sat.last_burn_time = cmd.burn_time
            cmd.executed = True

    def stream_tick(self, step_seconds: int = 20, reassess_every: int = 1) -> None:
        prev_time = self.current_time
        self._propagate_all(step_seconds)
        self.current_time = self.current_time + timedelta(seconds=step_seconds)
        self._execute_stream_maneuvers(prev_time, self.current_time)
        self._stream_ticks_since_assessment += 1

        if self._stream_ticks_since_assessment >= reassess_every:
            self.conjunctions = assess_conjunctions(
                satellites={k: v.state.copy() for k, v in self.satellites.items()},
                debris={k: v.state.copy() for k, v in self.debris.items()},
            )
            self._auto_schedule_evasions()
            self._stream_ticks_since_assessment = 0

    def ingest_object(self, object_id: str, object_type: str, state: np.ndarray) -> None:
        norm_type = object_type.upper()
        if norm_type == "SATELLITE":
            existing = self.satellites.get(object_id)
            if existing is None:
                self.satellites[object_id] = Satellite(
                    object_id=object_id,
                    object_type="SATELLITE",
                    state=state.copy(),
                    nominal_state=state.copy(),
                )
            else:
                existing.state = state.copy()
        else:
            self.debris[object_id] = SpaceObject(object_id=object_id, object_type="DEBRIS", state=state.copy())

    def projected_mass_after_sequence(self, sat: Satellite, delta_v_kmps_seq: list[np.ndarray]) -> tuple[bool, float]:
        fuel = sat.fuel_kg
        for dv in delta_v_kmps_seq:
            dv_mps = float(np.linalg.norm(dv)) * 1000.0
            if dv_mps > MAX_BURN_MPS:
                return False, sat.dry_mass_kg + fuel
            burn_mass = tsiolkovsky(sat.dry_mass_kg + fuel, dv_mps)
            if burn_mass > fuel + 1e-9:
                return False, sat.dry_mass_kg + fuel
            fuel -= burn_mass
        return True, sat.dry_mass_kg + fuel

    def _sorted_pending_for_satellite(self, sat_id: str) -> list[ManeuverCommand]:
        return sorted(
            [
                m
                for m in self.maneuvers
                if m.satellite_id == sat_id and not m.executed and not m.rejected
            ],
            key=lambda m: m.burn_time,
        )

    def _project_satellite_mass_with_commands(
        self, sat: Satellite, commands: list[ManeuverCommand]
    ) -> tuple[bool, float, float]:
        fuel_remaining = sat.fuel_kg
        mass_current = sat.dry_mass_kg + fuel_remaining
        for cmd in sorted(commands, key=lambda c: c.burn_time):
            dv_mps = float(np.linalg.norm(cmd.delta_v_eci_kmps)) * 1000.0
            if dv_mps > MAX_BURN_MPS:
                return False, sat.dry_mass_kg + fuel_remaining, fuel_remaining
            propellant_kg = float(tsiolkovsky(mass_current, dv_mps))
            if propellant_kg > fuel_remaining + 1e-9:
                return False, sat.dry_mass_kg + fuel_remaining, fuel_remaining
            fuel_remaining -= propellant_kg
            mass_current = sat.dry_mass_kg + fuel_remaining
        return True, mass_current, fuel_remaining

    def project_satellite_planned_mass(self, sat_id: str) -> tuple[float, float]:
        sat = self.satellites[sat_id]
        pending = self._sorted_pending_for_satellite(sat_id)
        if not pending:
            return sat.mass_current_kg, sat.fuel_kg
        ok, projected_mass, projected_fuel = self._project_satellite_mass_with_commands(sat, pending)
        if not ok:
            return sat.mass_current_kg, sat.fuel_kg
        return projected_mass, projected_fuel

    def validate_cooldown(self, sat: Satellite, burn_times: list[datetime]) -> bool:
        all_times = sorted(burn_times)
        if sat.last_burn_time is not None:
            if any((bt - sat.last_burn_time).total_seconds() < THERMAL_COOLDOWN_SECONDS for bt in all_times):
                return False

        for i in range(1, len(all_times)):
            if (all_times[i] - all_times[i - 1]).total_seconds() < THERMAL_COOLDOWN_SECONDS:
                return False

        existing = sorted(
            [m.burn_time for m in self.maneuvers if (m.satellite_id == sat.object_id and not m.executed and not m.rejected)]
        )
        merged = sorted(existing + all_times)
        for i in range(1, len(merged)):
            if (merged[i] - merged[i - 1]).total_seconds() < THERMAL_COOLDOWN_SECONDS:
                return False
        return True

    def schedule_maneuvers(self, sat_id: str, commands: list[ManeuverCommand]) -> tuple[bool, bool, float]:
        sat = self.satellites[sat_id]

        los_ok = all(self.ground_stations.has_line_of_sight(sat.state[:3], cmd.burn_time) for cmd in commands)
        burn_times = [cmd.burn_time for cmd in commands]
        latency_ok = all((bt - self.current_time).total_seconds() >= MIN_COMMAND_LATENCY_SECONDS for bt in burn_times)
        cooldown_ok = self.validate_cooldown(sat, burn_times)

        pending_existing = self._sorted_pending_for_satellite(sat_id)
        merged_plan = pending_existing + commands
        fuel_ok, projected_mass, _ = self._project_satellite_mass_with_commands(sat, merged_plan)

        valid = los_ok and latency_ok and cooldown_ok and fuel_ok
        if valid:
            self.maneuvers.extend(commands)
        else:
            for cmd in commands:
                cmd.rejected = True
        return los_ok and latency_ok, fuel_ok, projected_mass

    def _propagate_all(self, seconds: float, dt_seconds: float = 10.0) -> None:
        if seconds <= 0:
            return

        whole_steps = int(seconds // dt_seconds)
        remainder = seconds - whole_steps * dt_seconds

        for _ in range(whole_steps):
            for sat in self.satellites.values():
                sat.state = rk4_step(sat.state, dt_seconds)
                sat.nominal_state = rk4_step(sat.nominal_state, dt_seconds)
            for deb in self.debris.values():
                deb.state = rk4_step(deb.state, dt_seconds)

        if remainder > 1e-6:
            for sat in self.satellites.values():
                sat.state = rk4_step(sat.state, remainder)
                sat.nominal_state = rk4_step(sat.nominal_state, remainder)
            for deb in self.debris.values():
                deb.state = rk4_step(deb.state, remainder)

    def _execute_due_maneuvers(self, start: datetime, end: datetime) -> int:
        due = [
            m
            for m in self.maneuvers
            if (not m.executed and not m.rejected and m.burn_time <= end and m.satellite_id in self.satellites)
        ]
        due.sort(key=lambda m: m.burn_time)

        executed = 0
        cursor = start

        for cmd in due:
            if cmd.burn_time > cursor:
                self._propagate_all((cmd.burn_time - cursor).total_seconds())
                cursor = cmd.burn_time

            sat = self.satellites[cmd.satellite_id]
            dv_mps = float(np.linalg.norm(cmd.delta_v_eci_kmps)) * 1000.0
            if dv_mps > MAX_BURN_MPS:
                cmd.rejected = True
                continue

            if sat.last_burn_time and (cmd.burn_time - sat.last_burn_time).total_seconds() < THERMAL_COOLDOWN_SECONDS:
                cmd.conflict = True
                cmd.rejected = True
                continue

            if not self.ground_stations.has_line_of_sight(sat.state[:3], cmd.burn_time):
                cmd.blackout_overlap = True
                cmd.rejected = True
                continue

            dm_kg = tsiolkovsky(sat.mass_current_kg, dv_mps)
            if dm_kg > sat.fuel_kg:
                cmd.rejected = True
                continue

            sat.state[3:6] = sat.state[3:6] + cmd.delta_v_eci_kmps
            sat.fuel_kg -= float(dm_kg)
            sat.total_delta_v_mps += dv_mps
            sat.last_burn_time = cmd.burn_time
            cmd.executed = True
            executed += 1

        if cursor < end:
            self._propagate_all((end - cursor).total_seconds())

        return executed

    def step(self, step_seconds: int) -> ExecutionSummary:
        start = self.current_time
        end = self.current_time + timedelta(seconds=step_seconds)

        maneuvers_executed = self._execute_due_maneuvers(start, end)

        self.current_time = end
        self.conjunctions = assess_conjunctions(
            satellites={k: v.state.copy() for k, v in self.satellites.items()},
            debris={k: v.state.copy() for k, v in self.debris.items()},
        )

        collisions = sum(1 for c in self.conjunctions if c.miss_distance_km < CRITICAL_COLLISION_KM)
        avoided = sum(1 for c in self.conjunctions if c.risk_level in {"WARNING", "CRITICAL"})
        self.total_collisions_avoided += avoided

        for sat in self.satellites.values():
            sat.collisions_avoided += avoided

        return ExecutionSummary(maneuvers_executed=maneuvers_executed, collisions_detected=collisions)

    def snapshot(self) -> dict:
        satellites_payload = []
        for sat in self.satellites.values():
            geo = eci_to_geodetic(sat.state[:3], self.current_time)
            nominal_geo = eci_to_geodetic(sat.nominal_state[:3], self.current_time)
            drift = float(np.linalg.norm(sat.state[:3] - sat.nominal_state[:3]))
            planned_mass_kg, planned_fuel_kg = self.project_satellite_planned_mass(sat.object_id)
            satellites_payload.append(
                {
                    "id": sat.object_id,
                    "lat": geo.lat_deg,
                    "lon": geo.lon_deg,
                    "altitude_km": geo.alt_km,
                    "fuel_kg": sat.fuel_kg,
                    "planned_fuel_kg": float(planned_fuel_kg),
                    "planned_mass_kg": float(planned_mass_kg),
                    "status": "NOMINAL" if drift <= 10.0 else "OUT_OF_BOX",
                    "drift_km": drift,
                    "nominal": {
                        "lat": nominal_geo.lat_deg,
                        "lon": nominal_geo.lon_deg,
                        "altitude_km": nominal_geo.alt_km,
                    },
                    "eci": {
                        "x": float(sat.state[0]),
                        "y": float(sat.state[1]),
                        "z": float(sat.state[2]),
                        "vx": float(sat.state[3]),
                        "vy": float(sat.state[4]),
                        "vz": float(sat.state[5]),
                    },
                }
            )

        debris_cloud = []
        for deb in self.debris.values():
            geo = eci_to_geodetic(deb.state[:3], self.current_time)
            debris_cloud.append([deb.object_id, geo.lat_deg, geo.lon_deg, geo.alt_km])

        maneuvers = []
        for m in sorted(self.maneuvers, key=lambda x: x.burn_time):
            maneuvers.append(
                {
                    "burn_id": m.burn_id,
                    "satellite_id": m.satellite_id,
                    "burn_time": m.burn_time.isoformat(),
                    "delta_v_kmps": {
                        "x": float(m.delta_v_eci_kmps[0]),
                        "y": float(m.delta_v_eci_kmps[1]),
                        "z": float(m.delta_v_eci_kmps[2]),
                    },
                    "executed": m.executed,
                    "rejected": m.rejected,
                    "blackout_overlap": m.blackout_overlap,
                    "conflict": m.conflict,
                }
            )

        conjunctions = [
            {
                "satellite_id": c.satellite_id,
                "debris_id": c.debris_id,
                "tca_seconds": c.tca_seconds,
                "miss_distance_km": c.miss_distance_km,
                "relative_angle_deg": c.relative_angle_deg,
                "risk_level": c.risk_level,
            }
            for c in self.conjunctions
        ]

        fleet_fuel = [sat.fuel_kg for sat in self.satellites.values()]
        fleet_planned_fuel = [self.project_satellite_planned_mass(sat.object_id)[1] for sat in self.satellites.values()]
        total_fuel_remaining = float(sum(fleet_fuel))
        total_planned_fuel_remaining = float(sum(fleet_planned_fuel))
        total_fuel_capacity = max(1.0, 50.0 * max(len(fleet_fuel), 1))

        return {
            "timestamp": self.current_time.isoformat(),
            "satellites": satellites_payload,
            "debris_cloud": debris_cloud,
            "conjunctions": conjunctions,
            "maneuvers": maneuvers,
            "metrics": {
                "fleet_fuel_pct": (total_fuel_remaining / total_fuel_capacity) * 100.0,
                "fleet_fuel_planned_pct": (total_planned_fuel_remaining / total_fuel_capacity) * 100.0,
                "collisions_avoided": self.total_collisions_avoided,
                "total_delta_v_mps": float(sum(s.total_delta_v_mps for s in self.satellites.values())),
                "time_warp_x": self.time_warp_multiplier,
            },
            "counts": {
                "satellites": len(self.satellites),
                "debris": len(self.debris),
                "conjunction_warnings": len(self.conjunctions),
            },
            "ground_stations": self.ground_stations.to_snapshot(),
            "burn_logs": [
                {
                    "burn_id": m.burn_id,
                    "satellite_id": m.satellite_id,
                    "burn_time": m.burn_time.isoformat(),
                    "delta_v_mps": float(np.linalg.norm(m.delta_v_eci_kmps)) * 1000.0,
                    "executed": m.executed,
                    "rejected": m.rejected,
                }
                for m in sorted(self.maneuvers, key=lambda x: x.burn_time)
                if m.executed or m.rejected
            ],
        }
