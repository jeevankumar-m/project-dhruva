"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ConjunctionItem, DebrisTuple, GroundStationSnapshot, SatelliteSnapshot, TrackPoint } from "@/lib/types";

interface GroundTrackMapProps {
  satellites: SatelliteSnapshot[];
  selectedSatelliteId: string | null;
  onSelectSatellite: (id: string) => void;
  timestamp: string;
  groundStations: GroundStationSnapshot[];
  debrisCloud: DebrisTuple[];
  conjunctions: ConjunctionItem[];
  tracks?: Record<string, TrackPoint[]>;
}

const MU = 398600.4418;
const OMEGA_EARTH = 7.2921150e-5;


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

function propagateStep(r: number[], v: number[], dt: number): [number[], number[]] {
  const accel = (rr: number[]) => {
    const mag3 = Math.pow(rr[0] * rr[0] + rr[1] * rr[1] + rr[2] * rr[2], 1.5);
    const f = -MU / mag3;
    return [f * rr[0], f * rr[1], f * rr[2]];
  };
  const k1a = accel(r);
  const r2 = r.map((x, i) => x + v[i] * dt / 2);
  const v2 = v.map((x, i) => x + k1a[i] * dt / 2);
  const k2a = accel(r2);
  const r3 = r.map((x, i) => x + v2[i] * dt / 2);
  const v3 = v.map((x, i) => x + k2a[i] * dt / 2);
  const k3a = accel(r3);
  const r4 = r.map((x, i) => x + v3[i] * dt);
  const v4 = v.map((x, i) => x + k3a[i] * dt);
  const k4a = accel(r4);
  const newR = r.map((x, i) => x + (dt / 6) * (v[i] + 2 * v2[i] + 2 * v3[i] + v4[i]));
  const newV = v.map((x, i) => x + (dt / 6) * (k1a[i] + 2 * k2a[i] + 2 * k3a[i] + k4a[i]));
  return [newR, newV];
}

function computeForwardTrack(
  eci: { x: number; y: number; z: number; vx: number; vy: number; vz: number },
  timestamp: string,
  durationMinutes: number = 90,
  stepSeconds: number = 120,
): Array<{ lat: number; lon: number }> {
  let r = [eci.x, eci.y, eci.z];
  let v = [eci.vx, eci.vy, eci.vz];
  const gmst0 = gmstRad(timestamp);
  const pts: Array<{ lat: number; lon: number }> = [];
  const totalSteps = Math.floor((durationMinutes * 60) / stepSeconds);
  for (let i = 0; i <= totalSteps; i++) {
    const t = i * stepSeconds;
    const gmst = gmst0 + OMEGA_EARTH * t;
    const cosG = Math.cos(gmst);
    const sinG = Math.sin(gmst);
    const xe = r[0] * cosG + r[1] * sinG;
    const ye = -r[0] * sinG + r[1] * cosG;
    const ze = r[2];
    const rr = Math.sqrt(xe * xe + ye * ye + ze * ze);
    pts.push({
      lat: Math.asin(Math.max(-1, Math.min(1, ze / rr))) * 180 / Math.PI,
      lon: Math.atan2(ye, xe) * 180 / Math.PI,
    });
    if (i < totalSteps) [r, v] = propagateStep(r, v, stepSeconds);
  }
  return pts;
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
  tracks,
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

    // Compute accurate sub-solar point accounting for solar declination
    {
      const jd = julianDate(new Date(timestamp));
      const T = (jd - 2451545.0) / 36525.0;
      const M_rad = (((357.52911 + 35999.05029 * T) % 360 + 360) % 360) * Math.PI / 180;
      const L0 = ((280.46646 + 36000.76983 * T) % 360 + 360) % 360;
      const C = 1.9146 * Math.sin(M_rad) + 0.020 * Math.sin(2 * M_rad);
      const sunEclLon = ((L0 + C) % 360 + 360) % 360 * Math.PI / 180;
      const obliq = (23.4393 - 0.013 * T) * Math.PI / 180;
      const sunDecl = Math.asin(Math.sin(obliq) * Math.sin(sunEclLon));
      const sunRA = Math.atan2(Math.cos(obliq) * Math.sin(sunEclLon), Math.cos(sunEclLon));
      let sunLonRad = sunRA - gmstRad(timestamp);
      sunLonRad = ((sunLonRad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      if (sunLonRad > Math.PI) sunLonRad -= 2 * Math.PI;
      const sunLonDeg = sunLonRad * 180 / Math.PI;

      // Draw terminator: fill night region using lat-varying terminator
      ctx.globalAlpha = 0.38;
      ctx.fillStyle = "#0a1628";
      for (let side = -1; side <= 1; side += 2) {
        const pts: Array<[number, number]> = [];
        for (let latDeg = 89 * side; Math.abs(latDeg) >= 1; latDeg -= side) {
          const latRad = latDeg * Math.PI / 180;
          const cosH = -Math.tan(latRad) * Math.tan(sunDecl);
          let lonT = cosH <= -1 ? sunLonDeg + side * 180 : cosH >= 1 ? sunLonDeg : sunLonDeg + side * Math.acos(cosH) * 180 / Math.PI;
          lonT = ((lonT + 180) % 360 + 360) % 360 - 180;
          const p = mercatorXY(latDeg, lonT, width, height);
          pts.push([p.x, p.y]);
        }
        if (pts.length < 2) continue;
        const edgeX = side > 0 ? width : 0;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.lineTo(edgeX, pts[pts.length - 1][1]);
        ctx.lineTo(edgeX, pts[0][1]);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;
    }

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

      // Historical 90-min trail (solid)
      const trail = tracks?.[selectedSatelliteId];
      if (trail && trail.length > 1) {
        ctx.strokeStyle = "rgba(34,211,238,0.55)";
        ctx.lineWidth = 1.5 / z;
        ctx.setLineDash([]);
        ctx.beginPath();
        let penDown = false;
        for (let i = 0; i < trail.length; i++) {
          const pt = mercatorXY(trail[i].lat, trail[i].lon, width, height);
          const wrapBreak = i > 0 && Math.abs(trail[i].lon - trail[i - 1].lon) > 180;
          if (!penDown || wrapBreak) { ctx.moveTo(pt.x, pt.y); penDown = true; }
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }

      // Predicted 90-min trajectory (dashed)
      if (selSat?.eci) {
        const predictedPts = computeForwardTrack(selSat.eci, timestamp, 90, 120);
        if (predictedPts.length > 1) {
          ctx.strokeStyle = "#22d3ee";
          ctx.lineWidth = 1.5 / z;
          ctx.setLineDash([6 / z, 5 / z]);
          ctx.beginPath();
          let penDown = false;
          for (let i = 0; i < predictedPts.length; i++) {
            const pt = mercatorXY(predictedPts[i].lat, predictedPts[i].lon, width, height);
            const wrapBreak = i > 0 && Math.abs(predictedPts[i].lon - predictedPts[i - 1].lon) > 180;
            if (!penDown || wrapBreak) { ctx.moveTo(pt.x, pt.y); penDown = true; }
            else ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();
          ctx.setLineDash([]);
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
  }, [satellites, selectedSatelliteId, timestamp, groundStations, debrisCloud, conjunctions, tracks]);

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
      <div className="absolute top-3 left-3 z-10 flex items-center gap-3">
        <span className="text-xs font-semibold text-slate-200 tracking-wide">GROUND TRACK — MERCATOR</span>
        <span className="flex items-center gap-1 text-[10px] text-cyan-400/70"><span className="w-4 h-px bg-cyan-400/60 inline-block" />90m trail</span>
        <span className="flex items-center gap-1 text-[10px] text-cyan-300"><span className="w-4 h-px border-t border-dashed border-cyan-300 inline-block" />90m predicted</span>
      </div>

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
      <div className="absolute bottom-3 right-3 flex items-center gap-2 text-[10px] text-slate-400 bg-slate-900/80 px-2 py-1 border border-slate-700/60">
        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> GS
        <span className="w-2 h-2 rounded-full bg-blue-400 inline-block ml-1" /> SAT
        <span className="w-2 h-2 rounded-full bg-red-500 inline-block ml-1" /> DEBRIS
      </div>
    </div>
  );
}
