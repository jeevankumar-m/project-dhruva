from __future__ import annotations

import datetime as _dt
import re
from typing import Tuple

import numpy as np
from sgp4.api import Satrec

from astropy.coordinates import TEME, GCRS, CartesianRepresentation, CartesianDifferential
from astropy.time import Time
import astropy.units as u


def _normalize_utc_iso(ts: str) -> str:
    """
    Normalize ISO strings for astropy Time parsing.
    astropy's `format='isot'` parsing here works best with a trailing 'Z'.
    """
    ts = ts.strip()
    # Replace '+00:00'/'-00:00' with 'Z'
    ts = ts.replace("+00:00", "Z").replace("-00:00", "Z")
    # Handle '+0000' or '+00' style offsets if present.
    ts = re.sub(r"([+-])0{2}:?0{2}$", r"\\1Z", ts)
    return ts


def _propagate_tle_teme(
    tle_line1: str, tle_line2: str, epoch_iso_utc: str
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Propagate TLE to epoch and return TEME position/velocity in km and km/s.
    """
    sat = Satrec.twoline2rv(tle_line1, tle_line2)

    epoch_iso = _normalize_utc_iso(epoch_iso_utc)
    t = Time(epoch_iso, format="isot", scale="utc")

    jd = t.jd
    jd_int = int(jd)
    fr = jd - jd_int

    err, r, v = sat.sgp4(jd_int, fr)
    if err != 0:
        raise ValueError(f"SGP4 propagation failed with error code {err}")

    r_km = np.array(r, dtype=float)
    v_km_s = np.array(v, dtype=float)
    return r_km, v_km_s


def tle_to_gcrs_state_km_kms(
    tle_line1: str, tle_line2: str, epoch_iso_utc: str
) -> np.ndarray:
    """
    Convert TLE to a state vector in GCRS (ECI-like) frame.

    Returns:
      state = [x, y, z, vx, vy, vz] in km and km/s
    """
    r_km, v_km_s = _propagate_tle_teme(tle_line1, tle_line2, epoch_iso_utc)

    # Construct TEME with a velocity differential and transform to GCRS.
    rep = CartesianRepresentation(r_km[0] * u.km, r_km[1] * u.km, r_km[2] * u.km)
    diff = CartesianDifferential(
        v_km_s[0] * (u.km / u.s), v_km_s[1] * (u.km / u.s), v_km_s[2] * (u.km / u.s)
    )
    teme = TEME(rep.with_differentials(diff), obstime=Time(_normalize_utc_iso(epoch_iso_utc), format="isot", scale="utc"))
    gcrs = teme.transform_to(GCRS(obstime=teme.obstime))

    pos = gcrs.cartesian.xyz.to(u.km).value
    # velocity differential: d_xyz is the standard field name for astropy vectors
    vel = gcrs.velocity.d_xyz.to(u.km / u.s).value
    return np.concatenate([pos, vel]).astype(float)


def parse_tle_epoch_to_datetime_utc(tle_line1: str) -> _dt.datetime:
    """
    Parse TLE epoch (YYDDD.DDDDDDDD) from line 1 into a UTC datetime.
    """
    epoch_str = tle_line1[18:32].strip()
    yy = int(epoch_str[0:2])
    ddd = int(epoch_str[2:5])
    frac_str = epoch_str.split(".")[1]
    frac = float("0." + frac_str)

    year = 2000 + yy if yy < 57 else 1900 + yy
    base = _dt.datetime(year, 1, 1, tzinfo=_dt.timezone.utc) + _dt.timedelta(days=ddd - 1)
    return base + _dt.timedelta(days=frac)

