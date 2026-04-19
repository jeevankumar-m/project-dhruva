"""
Space-Track.org TLE Ingestion Script — Dhruva CDM

Fetches real satellite and debris TLE data from Space-Track.org (official USAF source)
and ingests it into a running Dhruva CDM backend.

Setup:
    1. Create a free account at https://www.space-track.org
    2. Set your credentials below (ST_USER and ST_PASS)
    3. Make sure Dhruva CDM backend is running
    4. Run: python fetch_celestrak.py

Usage:
    python fetch_celestrak.py                    # load satellites + debris
    python fetch_celestrak.py --satellites-only
    python fetch_celestrak.py --debris-only
    python fetch_celestrak.py --limit 100        # cap per feed (default 100)

Requires: pip install requests
"""

import argparse
from datetime import datetime, timedelta, timezone
import sys

try:
    import requests
except ImportError:
    print("Run: pip install requests")
    sys.exit(1)

# ── CONFIGURE YOUR SPACE-TRACK CREDENTIALS HERE ──────────────────────────────
ST_USER = "jeevankumar06m@gmail.com"
ST_PASS = "LrBT7SHj_3N!Yem"
# ─────────────────────────────────────────────────────────────────────────────

BACKEND_URL = "http://localhost:8000"
TLE_ENDPOINT = f"{BACKEND_URL}/api/telemetry/tle"
ST_BASE = "https://www.space-track.org"
ST_LOGIN = f"{ST_BASE}/ajaxauth/login"
ST_QUERY = f"{ST_BASE}/basicspacedata/query"
BATCH_SIZE = 50

# Space-Track query URLs — TLE format
FEEDS = {
    "satellites": {
        "url": f"{ST_QUERY}/class/gp/MEAN_MOTION/>11.25/ECCENTRICITY/<0.25/OBJECT_TYPE/PAYLOAD/orderby/NORAD_CAT_ID/limit/{{limit}}/format/tle",
        "object_type": "SATELLITE",
        "label": "Active LEO Satellites",
    },
    "cosmos_debris": {
        "url": f"{ST_QUERY}/class/gp/OBJECT_NAME/COSMOS 2251 DEB/OBJECT_TYPE/DEBRIS/orderby/NORAD_CAT_ID/limit/{{limit}}/format/tle",
        "object_type": "DEBRIS",
        "label": "Cosmos 2251 Debris",
    },
    "fengyun_debris": {
        "url": f"{ST_QUERY}/class/gp/OBJECT_NAME/FENGYUN 1C DEB/OBJECT_TYPE/DEBRIS/orderby/NORAD_CAT_ID/limit/{{limit}}/format/tle",
        "object_type": "DEBRIS",
        "label": "Fengyun-1C Debris",
    },
    "iridium_debris": {
        "url": f"{ST_QUERY}/class/gp/OBJECT_NAME/IRIDIUM 33 DEB/OBJECT_TYPE/DEBRIS/orderby/NORAD_CAT_ID/limit/{{limit}}/format/tle",
        "object_type": "DEBRIS",
        "label": "Iridium-33 Debris",
    },
}


def login(session: requests.Session) -> bool:
    if ST_USER == "your_email@example.com":
        print("\nSet ST_USER and ST_PASS in the script first.")
        print("Register free at: https://www.space-track.org")
        return False
    try:
        resp = session.post(ST_LOGIN, data={"identity": ST_USER, "password": ST_PASS}, timeout=15)
        if resp.status_code == 200 and "Login" not in resp.text:
            print(f"Space-Track: Logged in as {ST_USER}")
            return True
        print(f"Space-Track login failed. Check credentials.")
        return False
    except requests.RequestException as e:
        print(f"Space-Track login error: {e}")
        return False


def parse_tles(text: str) -> list[tuple[str, str, str]]:
    """Handles both 2-line (Space-Track) and 3-line (CelesTrak) TLE formats."""
    lines = [l.strip() for l in text.strip().splitlines() if l.strip()]
    tles = []
    i = 0
    while i < len(lines):
        # 3-line format: name, line1, line2
        if i + 2 < len(lines) and lines[i + 1].startswith("1 ") and lines[i + 2].startswith("2 "):
            tles.append((lines[i], lines[i + 1], lines[i + 2]))
            i += 3
        # 2-line format (Space-Track): line1, line2 — derive name from NORAD ID
        elif lines[i].startswith("1 ") and i + 1 < len(lines) and lines[i + 1].startswith("2 "):
            norad_id = lines[i][2:7].strip()
            tles.append((f"OBJECT-{norad_id}", lines[i], lines[i + 1]))
            i += 2
        else:
            i += 1
    return tles


def tle_epoch_to_iso(line1: str) -> str:
    """Extract the TLE epoch from line 1 and return it as an ISO UTC string."""
    epoch_str = line1[18:32].strip()
    yy = int(epoch_str[0:2])
    year = 2000 + yy if yy < 57 else 1900 + yy
    day_frac = float(epoch_str[2:])
    dt = datetime(year, 1, 1, tzinfo=timezone.utc) + timedelta(days=day_frac - 1)
    return dt.isoformat()


def post_batch(objects: list[dict]) -> bool:
    try:
        resp = requests.post(TLE_ENDPOINT, json={"objects": objects}, timeout=30)
        resp.raise_for_status()
        return True
    except requests.RequestException as e:
        print(f"  POST failed: {e}")
        return False


def ingest_feed(session: requests.Session, key: str, limit: int) -> int:
    feed = FEEDS[key]
    url = feed["url"].format(limit=limit)
    print(f"\n[{feed['label']}]")
    print(f"  Querying Space-Track...")

    try:
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"  Fetch failed: {e}")
        return 0

    tles = parse_tles(resp.text)
    if not tles:
        print("  No TLEs returned.")
        return 0

    print(f"  Got {len(tles)} TLE sets")

    total = 0

    for i in range(0, len(tles), BATCH_SIZE):
        batch = tles[i: i + BATCH_SIZE]
        objects = [
            {
                "id": f"{key.upper()}-{name.strip().replace(' ', '-')[:30]}",
                "object_type": feed["object_type"],
                "tle_line1": line1,
                "tle_line2": line2,
                "timestamp": tle_epoch_to_iso(line1),
            }
            for name, line1, line2 in batch
        ]
        if post_batch(objects):
            total += len(objects)
            print(f"  Ingested {total}/{len(tles)}", end="\r")

    print(f"  Done — {total} objects loaded        ")
    return total


def check_backend() -> bool:
    try:
        requests.get(f"{BACKEND_URL}/", timeout=5)
        return True
    except requests.RequestException:
        return False


def main():
    parser = argparse.ArgumentParser(description="Ingest Space-Track TLE data into Dhruva CDM")
    parser.add_argument("--satellites-only", action="store_true")
    parser.add_argument("--debris-only", action="store_true")
    parser.add_argument("--limit", type=int, default=100, help="Max objects per feed (default 100)")
    args = parser.parse_args()

    print("=" * 52)
    print("  Dhruva CDM — Space-Track TLE Ingestion")
    print("=" * 52)

    if not check_backend():
        print(f"\nBackend not reachable at {BACKEND_URL}")
        print("Start Dhruva CDM first, then run this script.")
        sys.exit(1)

    print("Backend: OK")

    session = requests.Session()
    if not login(session):
        sys.exit(1)

    total = 0

    if not args.debris_only:
        total += ingest_feed(session, "satellites", args.limit)

    if not args.satellites_only:
        total += ingest_feed(session, "cosmos_debris", args.limit)
        total += ingest_feed(session, "fengyun_debris", args.limit)
        total += ingest_feed(session, "iridium_debris", args.limit)

    session.get(f"{ST_BASE}/ajaxauth/logout")

    print(f"\nTotal objects ingested: {total}")
    print("Open http://localhost:3000 to see them on the globe.")


if __name__ == "__main__":
    main()
