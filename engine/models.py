from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

import numpy as np

ObjectType = Literal["SATELLITE", "DEBRIS"]


@dataclass
class SpaceObject:
    object_id: str
    object_type: ObjectType
    state: np.ndarray


@dataclass
class Satellite(SpaceObject):
    dry_mass_kg: float = 500.0
    fuel_kg: float = 50.0
    nominal_state: np.ndarray = field(default_factory=lambda: np.zeros(6))
    last_burn_time: datetime | None = None
    total_delta_v_mps: float = 0.0
    collisions_avoided: int = 0
    in_graveyard_orbit: bool = False
    graveyard_entry_time: datetime | None = None

    @property
    def mass_current_kg(self) -> float:
        return self.dry_mass_kg + self.fuel_kg


@dataclass
class ManeuverCommand:
    burn_id: str
    satellite_id: str
    burn_time: datetime
    delta_v_eci_kmps: np.ndarray
    blackout_overlap: bool = False
    conflict: bool = False
    executed: bool = False
    rejected: bool = False
