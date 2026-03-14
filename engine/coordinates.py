from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import math

import numpy as np

OMEGA_EARTH = 7.2921150e-5
EARTH_RADIUS_KM = 6378.137


@dataclass
class GeodeticPoint:
    lat_deg: float
    lon_deg: float
    alt_km: float


def _julian_date(timestamp: datetime) -> float:
    ts = timestamp.astimezone(timezone.utc)
    year = ts.year
    month = ts.month
    day = ts.day + (ts.hour + (ts.minute + (ts.second + ts.microsecond / 1e6) / 60.0) / 60.0) / 24.0
    if month <= 2:
        year -= 1
        month += 12
    a = math.floor(year / 100)
    b = 2 - a + math.floor(a / 4)
    return math.floor(365.25 * (year + 4716)) + math.floor(30.6001 * (month + 1)) + day + b - 1524.5


def gmst_radians(timestamp: datetime) -> float:
    jd = _julian_date(timestamp)
    t = (jd - 2451545.0) / 36525.0
    gmst_deg = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t**2 - (t**3) / 38710000.0
    return math.radians(gmst_deg % 360.0)


def eci_to_geodetic(eci_km: np.ndarray, timestamp: datetime) -> GeodeticPoint:
    x, y, z = [float(v) for v in eci_km]
    r = math.sqrt(x * x + y * y + z * z)
    lat = math.degrees(math.asin(max(-1.0, min(1.0, z / r)))) if r > 0 else 0.0
    lon_eci = math.atan2(y, x)
    lon = math.degrees((lon_eci - gmst_radians(timestamp) + math.pi) % (2 * math.pi) - math.pi)
    alt = r - EARTH_RADIUS_KM
    return GeodeticPoint(lat_deg=lat, lon_deg=lon, alt_km=alt)


def geodetic_to_ecef(lat_deg: float, lon_deg: float, alt_km: float = 0.0) -> np.ndarray:
    lat = math.radians(lat_deg)
    lon = math.radians(lon_deg)
    r = EARTH_RADIUS_KM + alt_km
    return np.array([
        r * math.cos(lat) * math.cos(lon),
        r * math.cos(lat) * math.sin(lon),
        r * math.sin(lat),
    ])


def ecef_to_eci(ecef_km: np.ndarray, timestamp: datetime) -> np.ndarray:
    theta = gmst_radians(timestamp)
    c = math.cos(theta)
    s = math.sin(theta)
    rot = np.array([[c, -s, 0.0], [s, c, 0.0], [0.0, 0.0, 1.0]])
    return rot @ ecef_km


def eci_to_ecef(eci_km: np.ndarray, timestamp: datetime) -> np.ndarray:
    theta = gmst_radians(timestamp)
    c = math.cos(theta)
    s = math.sin(theta)
    rot = np.array([[c, s, 0.0], [-s, c, 0.0], [0.0, 0.0, 1.0]])
    return rot @ eci_km
