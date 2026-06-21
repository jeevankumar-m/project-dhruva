"use client";

/**
 * OrbitalRecoveryPlot
 *
 * Two-panel SVG visualizer for station-keeping and orbital recovery:
 *
 * Left  — RTN Frame View: satellite at center, 10 km station-keeping box,
 *         nominal slot offset, evasion and recovery burn vectors.
 *
 * Right — Orbital Ring View: cross-section of actual orbit vs nominal orbit,
 *         altitude delta, satellite and nominal slot markers.
 */

import { useMemo } from "react";
import { ManeuverItem, SatelliteSnapshot } from "@/lib/types";

const RE = 6371; // km

interface Props {
  satellite: SatelliteSnapshot;
  evaBurn: ManeuverItem | null;
  recBurn: ManeuverItem | null;
}

function mag3(v: { x: number; y: number; z: number }) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function cross3(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dot3(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function norm3(v: { x: number; y: number; z: number }) {
  const m = mag3(v);
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

/** Project ECI vector onto satellite RTN basis → [R, T, N] in km */
function toRTN(
  vec: { x: number; y: number; z: number },
  r_hat: { x: number; y: number; z: number },
  t_hat: { x: number; y: number; z: number },
  n_hat: { x: number; y: number; z: number }
) {
  return {
    R: dot3(vec, r_hat),
    T: dot3(vec, t_hat),
    N: dot3(vec, n_hat),
  };
}

// Arrow helper for SVG
function Arrow({
  x1, y1, x2, y2, color, label, dashed,
}: {
  x1: number; y1: number; x2: number; y2: number;
  color: string; label?: string; dashed?: boolean;
}) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 2) return null;
  const ux = dx / len;
  const uy = dy / len;
  const hx = x2 - ux * 8;
  const hy = y2 - uy * 8;
  const px = -uy;
  const py = ux;
  return (
    <g>
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color} strokeWidth={1.5}
        strokeDasharray={dashed ? "4,3" : undefined}
        opacity={0.85}
      />
      <polygon
        points={`${x2},${y2} ${hx + px * 4},${hy + py * 4} ${hx - px * 4},${hy - py * 4}`}
        fill={color} opacity={0.85}
      />
      {label && (
        <text x={x2 + ux * 6 + px * 8} y={y2 + uy * 6 + py * 8}
          fill={color} fontSize={9} textAnchor="middle">{label}</text>
      )}
    </g>
  );
}

export default function OrbitalRecoveryPlot({ satellite, evaBurn, recBurn }: Props) {
  const eci = satellite.eci;

  const rtn = useMemo(() => {
    if (!eci) return null;
    const r = { x: eci.x, y: eci.y, z: eci.z };
    const v = { x: eci.vx, y: eci.vy, z: eci.vz };
    const r_hat = norm3(r);
    const h = cross3(r, v);
    const n_hat = norm3(h);
    const t_cross = cross3(n_hat, r_hat);
    const t_hat = norm3(t_cross);
    return { r_hat, t_hat, n_hat };
  }, [eci]);

  // ── RTN panel constants ──────────────────────────────────────────────────
  const RTN_W = 260;
  const RTN_H = 260;
  const RTN_CX = RTN_W / 2;
  const RTN_CY = RTN_H / 2;
  const RTN_SCALE = 10; // px per km  (shows ±13 km)
  const BOX_KM = 10;
  const BOX_PX = BOX_KM * RTN_SCALE;

  // Nominal slot offset in RTN: mostly tangential (T), small radial (R)
  const altDelta = satellite.altitude_km - (satellite.nominal?.altitude_km ?? satellite.altitude_km);
  const tangentialDrift = Math.sqrt(Math.max(0, satellite.drift_km ** 2 - altDelta ** 2));
  const nomR = -altDelta;        // radial offset (positive = higher orbit)
  const nomT = -tangentialDrift; // tangential offset (behind in orbit)

  // Burn vectors projected to RT plane (magnified for visibility)
  const EVA_SCALE = 600; // km/s → km for display
  const evaRT = evaBurn && rtn
    ? toRTN(evaBurn.delta_v_kmps, rtn.r_hat, rtn.t_hat, rtn.n_hat)
    : null;
  const recRT = recBurn && rtn
    ? toRTN(recBurn.delta_v_kmps, rtn.r_hat, rtn.t_hat, rtn.n_hat)
    : null;

  // ── Orbital ring panel constants ─────────────────────────────────────────
  const ORB_W = 260;
  const ORB_H = 260;
  const ORB_CX = ORB_W / 2;
  const ORB_CY = ORB_H / 2 + 30; // push center down so orbit arc is visible

  const actualRadius = RE + satellite.altitude_km;
  const nominalRadius = RE + (satellite.nominal?.altitude_km ?? satellite.altitude_km);

  // Scale: fit both orbits in the panel — show from 0.88*RE to 1.12*RE
  const VIEW_KM = 0.12 * RE; // km from Earth surface we show
  const ORB_SCALE = (ORB_H * 0.42) / VIEW_KM; // px / km

  // In this view: distance from panel-bottom-center to Earth surface
  const EARTH_PX = ORB_CY; // Earth center is ORB_CY px below top of panel

  function orbitY(radius_km: number) {
    return ORB_CY - (radius_km - RE) * ORB_SCALE;
  }

  // Arc radius in pixels for the orbit ring (horizontal arc at top of panel)
  const actualArcR = actualRadius * ORB_SCALE;
  const nominalArcR = nominalRadius * ORB_SCALE;

  // Satellite position on the arc: at the top (angle = -π/2 from center)
  const satArcX = ORB_CX;
  const satArcY = ORB_CY - actualArcR;
  const nomArcX = ORB_CX;
  const nomArcY = ORB_CY - nominalArcR;

  return (
    <div className="flex gap-3 bg-slate-950 border border-slate-800 p-3">

      {/* ── LEFT: RTN Frame View ─────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-1">
        <div className="text-[9px] text-slate-500 font-medium uppercase tracking-wider">
          RTN Frame — Station-Keeping Box
        </div>
        <svg width={RTN_W} height={RTN_H} className="bg-slate-900 border border-slate-800">
          {/* Grid lines */}
          {[-10, -5, 0, 5, 10].map((km) => (
            <g key={km}>
              <line
                x1={RTN_CX + km * RTN_SCALE} y1={0}
                x2={RTN_CX + km * RTN_SCALE} y2={RTN_H}
                stroke="#1e293b" strokeWidth={1}
              />
              <line
                x1={0} y1={RTN_CY + km * RTN_SCALE}
                x2={RTN_W} y2={RTN_CY + km * RTN_SCALE}
                stroke="#1e293b" strokeWidth={1}
              />
            </g>
          ))}

          {/* 10 km station-keeping box */}
          <rect
            x={RTN_CX - BOX_PX} y={RTN_CY - BOX_PX}
            width={BOX_PX * 2} height={BOX_PX * 2}
            fill="none" stroke="#0ea5e9" strokeWidth={1}
            strokeDasharray="5,3" opacity={0.5}
          />
          <text x={RTN_CX + BOX_PX + 3} y={RTN_CY - BOX_PX + 10}
            fill="#0ea5e9" fontSize={8} opacity={0.6}>10 km box</text>

          {/* Axes */}
          <line x1={RTN_CX} y1={10} x2={RTN_CX} y2={RTN_H - 10}
            stroke="#334155" strokeWidth={1} />
          <line x1={10} y1={RTN_CY} x2={RTN_W - 10} y2={RTN_CY}
            stroke="#334155" strokeWidth={1} />
          <text x={RTN_CX + 4} y={14} fill="#475569" fontSize={8}>R↑</text>
          <text x={RTN_W - 18} y={RTN_CY - 4} fill="#475569" fontSize={8}>T→</text>

          {/* Nominal slot */}
          {(() => {
            const nx = RTN_CX + nomT * RTN_SCALE;
            const ny = RTN_CY - nomR * RTN_SCALE;
            const inBounds =
              Math.abs(nx - RTN_CX) < RTN_W / 2 - 5 &&
              Math.abs(ny - RTN_CY) < RTN_H / 2 - 5;
            if (!inBounds) return null;
            return (
              <g>
                {/* Drift line */}
                <line x1={RTN_CX} y1={RTN_CY} x2={nx} y2={ny}
                  stroke="#f59e0b" strokeWidth={1} strokeDasharray="4,3" opacity={0.7} />
                {/* Nominal slot diamond */}
                <polygon
                  points={`${nx},${ny - 7} ${nx + 6},${ny} ${nx},${ny + 7} ${nx - 6},${ny}`}
                  fill="none" stroke="#22c55e" strokeWidth={1.5} opacity={0.8}
                />
                <text x={nx + 9} y={ny + 3} fill="#22c55e" fontSize={8}>Nominal</text>
                {/* Drift label */}
                <text
                  x={(RTN_CX + nx) / 2 + 5}
                  y={(RTN_CY + ny) / 2 - 4}
                  fill="#f59e0b" fontSize={8}
                >
                  {satellite.drift_km.toFixed(1)} km
                </text>
              </g>
            );
          })()}

          {/* EVA burn vector */}
          {evaRT && (
            <Arrow
              x1={RTN_CX} y1={RTN_CY}
              x2={RTN_CX + evaRT.T * EVA_SCALE * RTN_SCALE}
              y2={RTN_CY - evaRT.R * EVA_SCALE * RTN_SCALE}
              color="#f87171" label="EVA"
            />
          )}

          {/* REC burn vector */}
          {recRT && (
            <Arrow
              x1={RTN_CX} y1={RTN_CY}
              x2={RTN_CX + recRT.T * EVA_SCALE * RTN_SCALE}
              y2={RTN_CY - recRT.R * EVA_SCALE * RTN_SCALE}
              color="#4ade80" label="REC"
            />
          )}

          {/* Satellite dot */}
          <circle cx={RTN_CX} cy={RTN_CY} r={5} fill="#22d3ee" />
          <text x={RTN_CX + 8} y={RTN_CY - 6} fill="#22d3ee" fontSize={8}>
            {satellite.id}
          </text>

          {/* Status badge */}
          <rect x={4} y={RTN_H - 18} width={70} height={14} fill="#0f172a" rx={2} />
          <text x={8} y={RTN_H - 7}
            fill={satellite.status === "OUT_OF_BOX" ? "#fbbf24" : "#4ade80"}
            fontSize={9} fontWeight="bold">
            {satellite.status}
          </text>
        </svg>

        {/* Legend */}
        <div className="flex gap-3 text-[8px] text-slate-500">
          <span><span style={{ color: "#22d3ee" }}>●</span> Satellite</span>
          <span><span style={{ color: "#22c55e" }}>◆</span> Nominal Slot</span>
          <span><span style={{ color: "#f87171" }}>→</span> EVA Burn</span>
          <span><span style={{ color: "#4ade80" }}>→</span> REC Burn</span>
        </div>
      </div>

      {/* ── RIGHT: Orbital Ring View ─────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-1 flex-1">
        <div className="text-[9px] text-slate-500 font-medium uppercase tracking-wider">
          Orbital Cross-Section — Actual vs Nominal
        </div>
        <svg width={ORB_W} height={ORB_H} className="bg-slate-900 border border-slate-800">
          {/* Earth arc at bottom */}
          <path
            d={`M 0 ${ORB_CY} A ${ORB_CY} ${ORB_CY} 0 0 1 ${ORB_W} ${ORB_CY}`}
            fill="#1e3a5f" stroke="#1d4ed8" strokeWidth={1}
          />
          <text x={ORB_CX - 10} y={ORB_CY - 6} fill="#3b82f6" fontSize={8}>Earth</text>

          {/* Nominal orbit arc (dashed) */}
          <path
            d={`M ${ORB_CX - nominalArcR} ${ORB_CY}
                A ${nominalArcR} ${nominalArcR} 0 0 1 ${ORB_CX + nominalArcR} ${ORB_CY}`}
            fill="none" stroke="#22c55e" strokeWidth={1.5}
            strokeDasharray="6,4" opacity={0.7}
          />
          <text x={ORB_W - 4} y={nomArcY + 3}
            fill="#22c55e" fontSize={8} textAnchor="end">Nominal</text>

          {/* Actual orbit arc (solid) */}
          <path
            d={`M ${ORB_CX - actualArcR} ${ORB_CY}
                A ${actualArcR} ${actualArcR} 0 0 1 ${ORB_CX + actualArcR} ${ORB_CY}`}
            fill="none" stroke="#22d3ee" strokeWidth={1.5} opacity={0.85}
          />
          <text x={ORB_W - 4} y={satArcY + 3}
            fill="#22d3ee" fontSize={8} textAnchor="end">Actual</text>

          {/* Altitude delta line */}
          {Math.abs(altDelta) > 0.1 && (
            <g>
              <line
                x1={ORB_CX + 20} y1={satArcY}
                x2={ORB_CX + 20} y2={nomArcY}
                stroke="#f59e0b" strokeWidth={1} strokeDasharray="3,2"
              />
              <text
                x={ORB_CX + 24}
                y={(satArcY + nomArcY) / 2 + 3}
                fill="#f59e0b" fontSize={8}
              >
                {Math.abs(altDelta).toFixed(1)} km
              </text>
            </g>
          )}

          {/* Nominal slot marker */}
          <polygon
            points={`${nomArcX},${nomArcY - 7} ${nomArcX + 6},${nomArcY} ${nomArcX},${nomArcY + 7} ${nomArcX - 6},${nomArcY}`}
            fill="none" stroke="#22c55e" strokeWidth={1.5}
          />

          {/* Satellite marker */}
          <circle cx={satArcX} cy={satArcY} r={5} fill="#22d3ee" />

          {/* EVA burn arrow on orbital view */}
          {evaRT && (
            <Arrow
              x1={satArcX} y1={satArcY}
              x2={satArcX}
              y2={satArcY - Math.abs(evaRT.R) * EVA_SCALE * ORB_SCALE * 0.01 - 20}
              color="#f87171" label="EVA"
            />
          )}

          {/* REC burn arrow on orbital view */}
          {recRT && (
            <Arrow
              x1={satArcX} y1={satArcY}
              x2={satArcX}
              y2={satArcY + Math.abs(recRT.R) * EVA_SCALE * ORB_SCALE * 0.01 + 15}
              color="#4ade80" label="REC"
            />
          )}

          {/* Altitude labels */}
          <text x={6} y={satArcY + 3} fill="#22d3ee" fontSize={8}>
            {satellite.altitude_km.toFixed(0)} km
          </text>
          <text x={6} y={nomArcY + 3} fill="#22c55e" fontSize={8}>
            {(satellite.nominal?.altitude_km ?? satellite.altitude_km).toFixed(0)} km
          </text>
        </svg>

        {/* Burn status summary */}
        <div className="flex gap-4 text-[8px] text-slate-500 mt-1">
          {evaBurn && (
            <span>
              EVA:{" "}
              <span className={evaBurn.executed ? "text-emerald-400" : evaBurn.rejected ? "text-red-400" : "text-amber-300"}>
                {evaBurn.executed ? "Executed" : evaBurn.rejected ? "Rejected" : "Pending"}
              </span>
              {" · "}{(mag3(evaBurn.delta_v_kmps) * 1000).toFixed(2)} m/s
            </span>
          )}
          {recBurn && (
            <span>
              REC:{" "}
              <span className={recBurn.executed ? "text-emerald-400" : recBurn.rejected ? "text-red-400" : "text-amber-300"}>
                {recBurn.executed ? "Executed" : recBurn.rejected ? "Rejected" : "Pending"}
              </span>
              {" · "}{(mag3(recBurn.delta_v_kmps) * 1000).toFixed(2)} m/s
            </span>
          )}
          {!evaBurn && !recBurn && (
            <span className="text-emerald-500">No active maneuvers — satellite in nominal slot</span>
          )}
        </div>
      </div>
    </div>
  );
}
