"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ConjunctionItem, DebrisTuple, GroundStationSnapshot, SatelliteSnapshot } from "@/lib/types";

interface GroundTrackMapProps {
  satellites: SatelliteSnapshot[];
  selectedSatelliteId: string | null;
  onSelectSatellite: (id: string) => void;
  timestamp: string;
  groundStations: GroundStationSnapshot[];
  debrisCloud: DebrisTuple[];
  conjunctions: ConjunctionItem[];
}

const MU = 398600.4418;
const OMEGA_EARTH = 7.2921150e-5;

function cross(a: number[], b: number[]): number[] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function vecMag(v: number[]): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function julianDate(date: Date): number {
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth() + 1;
  const day = date.getUTCDate() + (date.getUTCHours() + (date.getUTCMinutes() + (date.getUTCSeconds() + date.getUTCMilliseconds() / 1000) / 60) / 60) / 24;
  if (month <= 2) { year -= 1; month += 12; }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}

function gmstRad(ts: string): number {
  const jd = julianDate(new Date(ts));
  const t = (jd - 2451545.0) / 36525.0;
  const deg = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t * t - (t * t * t) / 38710000.0;
  return ((deg % 360 + 360) % 360) * Math.PI / 180;
}

function computeGroundTrack(
  eci: { x: number; y: number; z: number; vx: number; vy: number; vz: number },
  timestamp: string,
  numPoints: number = 400,
): Array<{ lat: number; lon: number }> {
  const r = [eci.x, eci.y, eci.z];
  const v = [eci.vx, eci.vy, eci.vz];
  const rMag = vecMag(r);
  const vSq = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];

  const energy = vSq / 2 - MU / rMag;
  if (energy >= 0) return [];
  const a = -MU / (2 * energy);

  const h = cross(r, v);
  const hMag = vecMag(h);
  if (hMag < 1e-10) return [];

  const rdotv = r[0] * v[0] + r[1] * v[1] + r[2] * v[2];
  const eVec = [
    (vSq / MU - 1 / rMag) * r[0] - (rdotv / MU) * v[0],
    (vSq / MU - 1 / rMag) * r[1] - (rdotv / MU) * v[1],
    (vSq / MU - 1 / rMag) * r[2] - (rdotv / MU) * v[2],
  ];
  const e = vecMag(eVec);

  let P: number[];
  if (e > 1e-8) {
    P = eVec.map((x) => x / e);
  } else {
    P = r.map((x) => x / rMag);
  }
  const hHat = h.map((x) => x / hMag);
  const Q = cross(hHat, P);

  const orbitalPeriod = 2 * Math.PI * Math.sqrt(a * a * a / MU);
  const gmst0 = gmstRad(timestamp);
  const p = a * (1 - e * e);
  const points: Array<{ lat: number; lon: number }> = [];

  for (let i = 0; i <= numPoints; i++) {
    const theta = (2 * Math.PI * i) / numPoints;
    const radius = p / (1 + e * Math.cos(theta));
    const xPeri = radius * Math.cos(theta);
    const yPeri = radius * Math.sin(theta);

    const xECI = xPeri * P[0] + yPeri * Q[0];
    const yECI = xPeri * P[1] + yPeri * Q[1];
    const zECI = xPeri * P[2] + yPeri * Q[2];

    const fracOrbit = i / numPoints;
    const dt = fracOrbit * orbitalPeriod;
    const gmst = gmst0 + OMEGA_EARTH * dt;
    const cosG = Math.cos(gmst);
    const sinG = Math.sin(gmst);

    const xECEF = xECI * cosG + yECI * sinG;
    const yECEF = -xECI * sinG + yECI * cosG;
    const zECEF = zECI;

    const rr = Math.sqrt(xECEF * xECEF + yECEF * yECEF + zECEF * zECEF);
    const lat = Math.asin(Math.max(-1, Math.min(1, zECEF / rr))) * 180 / Math.PI;
    const lon = Math.atan2(yECEF, xECEF) * 180 / Math.PI;

    points.push({ lat, lon });
  }

  return points;
}

function mercatorXY(lat: number, lon: number, width: number, height: number) {
  const clampedLat = Math.max(-85, Math.min(85, lat));
  const x = ((lon + 180) / 360) * width;
  const latRad = (clampedLat * Math.PI) / 180;
  const mercY = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const y = height / 2 - (height * mercY) / (2 * Math.PI);
  return { x, y };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return a + diff * t;
}

interface SatPos {
  lat: number;
  lon: number;
}

export default function GroundTrackMap({
  satellites,
  selectedSatelliteId,
  onSelectSatellite,
  timestamp,
  groundStations,
  debrisCloud,
  conjunctions,
}: GroundTrackMapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapImageRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef<number>(0);

  const prevPositionsRef = useRef<Record<string, SatPos>>({});
  const currPositionsRef = useRef<Record<string, SatPos>>({});
  const snapshotTimeRef = useRef(0);

  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  const zoomRef = useRef(zoom);
  const panXRef = useRef(panX);
  const panYRef = useRef(panY);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panXRef.current = panX; }, [panX]);
  useEffect(() => { panYRef.current = panY; }, [panY]);

  const satById = useMemo(() => new Map(satellites.map((s) => [s.id, s])), [satellites]);

  useEffect(() => {
    const prev: Record<string, SatPos> = {};
    const curr: Record<string, SatPos> = {};
    for (const sat of satellites) {
      const old = currPositionsRef.current[sat.id];
      prev[sat.id] = old ?? { lat: sat.lat, lon: sat.lon };
      curr[sat.id] = { lat: sat.lat, lon: sat.lon };
    }
    prevPositionsRef.current = prev;
    currPositionsRef.current = curr;
    snapshotTimeRef.current = performance.now();
  }, [satellites]);

  useEffect(() => {
    const img = new Image();
    img.src = "/assets/world-map-mercator.png";
    img.onload = () => {
      mapImageRef.current = img;
    };
  }, []);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const z = zoomRef.current;
    const ox = panXRef.current;
    const oy = panYRef.current;

    const elapsed = performance.now() - snapshotTimeRef.current;
    const t = Math.min(1, elapsed / 1000);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(z, z);
    ctx.translate(-width / 2 + ox, -height / 2 + oy);

    const mapImage = mapImageRef.current;
    if (mapImage) {
      ctx.drawImage(mapImage, 0, 0, width, height);
    }

    ctx.strokeStyle = "#0f1d3d";
    ctx.lineWidth = 1 / z;
    for (let lon = -180; lon <= 180; lon += 30) {
      const x = ((lon + 180) / 360) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const { y } = mercatorXY(lat, 0, width, height);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const dt = new Date(timestamp);
    const utcHours = dt.getUTCHours() + dt.getUTCMinutes() / 60;
    const sunLon = (utcHours / 24) * 360 - 180;
    const nightCenter = (((sunLon + 180 + 180) % 360) + 360) % 360 - 180;
    const nx = ((nightCenter + 180) / 360) * width;
    const grd = ctx.createLinearGradient(nx - width / 2, 0, nx + width / 2, 0);
    grd.addColorStop(0, "rgba(15,23,42,0.15)");
    grd.addColorStop(0.5, "rgba(15,23,42,0.45)");
    grd.addColorStop(1, "rgba(15,23,42,0.15)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, width, height);

    for (const gs of groundStations) {
      const p = mercatorXY(gs.lat, gs.lon, width, height);
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4 / z, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fde68a";
      ctx.font = `${Math.max(8, 10 / z)}px sans-serif`;
      ctx.fillText(gs.name.replace(/_/g, " "), p.x + 6 / z, p.y - 6 / z);
    }

    const warningDebrisIds = new Set(
      conjunctions
        .filter((c) => c.risk_level === "CRITICAL" || c.risk_level === "WARNING")
        .map((c) => c.debris_id)
    );

    for (const deb of debrisCloud) {
      const [debId, debLat, debLon] = deb;
      const dp = mercatorXY(debLat, debLon, width, height);
      const isWarning = warningDebrisIds.has(debId);
      ctx.fillStyle = isWarning ? "#ef4444" : "#f87171";
      ctx.globalAlpha = isWarning ? 1.0 : 0.5;
      ctx.beginPath();
      ctx.arc(dp.x, dp.y, (isWarning ? 4 : 2) / z, 0, Math.PI * 2);
      ctx.fill();
      if (isWarning) {
        ctx.strokeStyle = "#fca5a5";
        ctx.lineWidth = 1 / z;
        ctx.beginPath();
        ctx.arc(dp.x, dp.y, 8 / z, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#fca5a5";
        ctx.font = `${Math.max(7, 9 / z)}px sans-serif`;
        ctx.fillText(debId, dp.x + 6 / z, dp.y - 6 / z);
      }
      ctx.globalAlpha = 1.0;
    }

    if (selectedSatelliteId) {
      const selSat = satellites.find((s) => s.id === selectedSatelliteId);
      if (selSat?.eci) {
        const orbitPts = computeGroundTrack(selSat.eci, timestamp, 400);
        if (orbitPts.length > 1) {
          ctx.strokeStyle = "#22d3ee";
          ctx.lineWidth = 1.5 / z;
          ctx.beginPath();
          let penDown = false;
          for (let i = 0; i < orbitPts.length; i++) {
            const pt = mercatorXY(orbitPts[i].lat, orbitPts[i].lon, width, height);
            const wrapBreak = i > 0 && Math.abs(orbitPts[i].lon - orbitPts[i - 1].lon) > 180;
            if (!penDown || wrapBreak) {
              ctx.moveTo(pt.x, pt.y);
              penDown = true;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          }
          ctx.stroke();
        }
      }
    }

    for (const sat of satellites) {
      const prev = prevPositionsRef.current[sat.id];
      const curr = currPositionsRef.current[sat.id];
      const interpLat = prev && curr ? lerp(prev.lat, curr.lat, t) : sat.lat;
      const interpLon = prev && curr ? lerpAngle(prev.lon, curr.lon, t) : sat.lon;

      const { x, y } = mercatorXY(interpLat, interpLon, width, height);
      const isSelected = sat.id === selectedSatelliteId;
      const r = (isSelected ? 5 : 2) / z;
      ctx.fillStyle = isSelected ? "#34d399" : "#60a5fa";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      if (isSelected) {
        ctx.fillStyle = "#d1fae5";
        ctx.font = `${Math.max(8, 10 / z)}px sans-serif`;
        ctx.fillText(sat.id, x + 7 / z, y - 7 / z);
      }
    }

    ctx.restore();
  }, [satellites, selectedSatelliteId, timestamp, groundStations, debrisCloud, conjunctions]);

  const drawFrameRef = useRef(drawFrame);
  useEffect(() => {
    drawFrameRef.current = drawFrame;
  }, [drawFrame]);

  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      drawFrameRef.current();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleWheel = useCallback((evt: React.WheelEvent) => {
    // Avoid calling preventDefault on a passive wheel listener, which
    // causes noisy console warnings in modern browsers.
    setZoom((prev) => Math.max(1, Math.min(12, prev * (evt.deltaY < 0 ? 1.15 : 0.87))));
  }, []);

  const handleMouseDown = useCallback((evt: React.MouseEvent) => {
    if (evt.button === 2 || evt.ctrlKey || evt.shiftKey) {
      isDraggingRef.current = true;
      dragStartRef.current = { x: evt.clientX, y: evt.clientY };
      panStartRef.current = { x: panXRef.current, y: panYRef.current };
      evt.preventDefault();
    }
  }, []);

  const handleMouseMove = useCallback((evt: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const dx = (evt.clientX - dragStartRef.current.x) * scaleX / zoomRef.current;
    const dy = (evt.clientY - dragStartRef.current.y) * scaleY / zoomRef.current;
    setPanX(panStartRef.current.x + dx);
    setPanY(panStartRef.current.y + dy);
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleClick = useCallback((evt: React.MouseEvent) => {
    if (isDraggingRef.current) return;
    const target = evt.currentTarget as HTMLCanvasElement;
    const rect = target.getBoundingClientRect();
    const rawX = ((evt.clientX - rect.left) / rect.width) * target.width;
    const rawY = ((evt.clientY - rect.top) / rect.height) * target.height;

    const z = zoomRef.current;
    const ox = panXRef.current;
    const oy = panYRef.current;
    const canvasX = (rawX - target.width / 2) / z + target.width / 2 - ox;
    const canvasY = (rawY - target.height / 2) / z + target.height / 2 - oy;

    let bestId: string | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const sat of satellites) {
      const pt = mercatorXY(sat.lat, sat.lon, target.width, target.height);
      const d = Math.hypot(pt.x - canvasX, pt.y - canvasY);
      if (d < best) {
        best = d;
        bestId = sat.id;
      }
    }

    if (bestId && best < 20 / z && satById.has(bestId)) {
      onSelectSatellite(bestId);
    }
  }, [satellites, satById, onSelectSatellite]);

  return (
    <div className="relative h-full border border-slate-800 bg-slate-950 overflow-hidden">
      <div className="absolute top-3 left-3 z-10 text-xs text-slate-300">Track Live - Ground Track (Mercator)</div>

      <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
        <button
          className="h-7 w-7 rounded bg-slate-900 border border-slate-700 text-xs text-slate-200 hover:bg-slate-800"
          onClick={() => setZoom((p) => Math.min(12, p * 1.4))}
        >+</button>
        <button
          className="h-7 w-7 rounded bg-slate-900 border border-slate-700 text-xs text-slate-200 hover:bg-slate-800"
          onClick={() => { setZoom((p) => Math.max(1, p * 0.7)); if (zoomRef.current <= 1.1) { setPanX(0); setPanY(0); } }}
        >-</button>
        <button
          className="h-7 px-2 rounded bg-slate-900 border border-slate-700 text-[10px] text-slate-200 hover:bg-slate-800"
          onClick={() => { setZoom(1); setPanX(0); setPanY(0); }}
        >Reset</button>
        <span className="text-[10px] text-slate-400 ml-1">{zoom.toFixed(1)}x</span>
      </div>

      <canvas
        ref={canvasRef}
        width={1000}
        height={430}
        className="h-full w-full"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onContextMenu={(e) => e.preventDefault()}
      />

      <div className="absolute bottom-3 left-3 z-10 text-[10px] text-slate-400">
        Scroll to zoom | Right-click + drag to pan
      </div>
      <div className="absolute bottom-3 right-3 text-xs text-slate-300 bg-slate-900/80 rounded-full px-3 py-1 border border-slate-700">
        2D - 90m trail
      </div>
    </div>
  );
}
