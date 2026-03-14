from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import csv
import math
from pathlib import Path

import numpy as np

from engine.coordinates import ecef_to_eci, geodetic_to_ecef


@dataclass
class GroundStation:
    station_id: str
    station_name: str
    latitude_deg: float
    longitude_deg: float
    elevation_m: float
    min_elevation_angle_deg: float


class GroundStationNetwork:
    def __init__(self, stations: list[GroundStation]):
        self.stations = stations

    @classmethod
    def from_csv(cls, csv_path: Path) -> "GroundStationNetwork":
        stations: list[GroundStation] = []
        with csv_path.open("r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                stations.append(
                    GroundStation(
                        station_id=row["Station_ID"].strip(),
                        station_name=row["Station_Name"].strip(),
                        latitude_deg=float(row["Latitude"]),
                        longitude_deg=float(row["Longitude"]),
                        elevation_m=float(row["Elevation_m"]),
                        min_elevation_angle_deg=float(row["Min_Elevation_Angle_deg"]),
                    )
                )
        return cls(stations)

    def has_line_of_sight(self, sat_eci_km: np.ndarray, when: datetime) -> bool:
        return any(self._station_has_los(st, sat_eci_km, when) for st in self.stations)

    def to_snapshot(self) -> list[dict]:
        return [
            {
                "id": st.station_id,
                "name": st.station_name,
                "lat": st.latitude_deg,
                "lon": st.longitude_deg,
                "min_elevation_deg": st.min_elevation_angle_deg,
            }
            for st in self.stations
        ]

    def _station_has_los(self, station: GroundStation, sat_eci_km: np.ndarray, when: datetime) -> bool:
        station_ecef = geodetic_to_ecef(station.latitude_deg, station.longitude_deg, station.elevation_m / 1000.0)
        station_eci = ecef_to_eci(station_ecef, when)

        rho_eci = sat_eci_km - station_eci

        lat = math.radians(station.latitude_deg)
        lon = math.radians(station.longitude_deg)
        slat, clat = math.sin(lat), math.cos(lat)
        slon, clon = math.sin(lon), math.cos(lon)

        e_hat = np.array([-slon, clon, 0.0])
        n_hat = np.array([-slat * clon, -slat * slon, clat])
        u_hat = np.array([clat * clon, clat * slon, slat])

        east = float(np.dot(rho_eci, e_hat))
        north = float(np.dot(rho_eci, n_hat))
        up = float(np.dot(rho_eci, u_hat))

        horiz = math.sqrt(east * east + north * north)
        elevation_deg = math.degrees(math.atan2(up, horiz))
        return elevation_deg >= station.min_elevation_angle_deg
