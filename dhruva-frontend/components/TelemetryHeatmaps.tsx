"use client";

import { SatelliteSnapshot } from "@/lib/types";

interface TelemetryProps {
  satellites: SatelliteSnapshot[];
  metricsHistory: Array<{ timestamp: number; fleetFuelPct: number; totalDeltaVMps: number; collisionsAvoided: number }>;
}

export default function TelemetryHeatmaps({ satellites, metricsHistory }: TelemetryProps) {
  const latest = metricsHistory[metricsHistory.length - 1];
  const points = metricsHistory.slice(-40);
  const maxDeltaV = Math.max(1, ...points.map((p) => p.totalDeltaVMps));
  const maxAvoided = Math.max(1, ...points.map((p) => p.collisionsAvoided));

  return (
    <div className="h-full border border-slate-800 bg-slate-950 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between shrink-0">
        <h3 className="text-xs font-semibold tracking-wide text-slate-200 uppercase">Telemetry</h3>
        <div className="flex gap-2 text-[9px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-cyan-400 inline-block" />∆v</span>
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-emerald-400 inline-block" />Avoided</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 shrink-0">
        <div className="bg-slate-900/80 border border-slate-800 p-1.5">
          <div className="text-slate-500 text-[9px] uppercase tracking-wide">Fleet Fuel</div>
          <div className="text-base font-bold text-emerald-300">{latest ? latest.fleetFuelPct.toFixed(1) : "--"}%</div>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 p-1.5">
          <div className="text-slate-500 text-[9px] uppercase tracking-wide">Active SATs</div>
          <div className="text-base font-bold text-sky-300">{satellites.length}</div>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 p-1.5">
          <div className="text-slate-500 text-[9px] uppercase tracking-wide">Total ∆v</div>
          <div className="text-sm font-bold text-cyan-300">{(latest?.totalDeltaVMps ?? 0).toFixed(1)} m/s</div>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 p-1.5">
          <div className="text-slate-500 text-[9px] uppercase tracking-wide">Avoided</div>
          <div className="text-sm font-bold text-violet-300">{latest?.collisionsAvoided ?? 0}</div>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-slate-900/60 border border-slate-800 p-1.5">
        <div className="text-[9px] text-slate-400 mb-1 font-semibold">∆v vs Collisions Avoided</div>
        <svg viewBox="0 0 320 80" className="w-full h-full">
          {points.length > 1 && (
            <polyline fill="none" stroke="#22d3ee" strokeWidth="1.5"
              points={points.map((p, i) => `${(i / (points.length - 1)) * 300 + 10},${70 - (p.totalDeltaVMps / maxDeltaV) * 58}`).join(" ")} />
          )}
          {points.length > 1 && (
            <polyline fill="none" stroke="#22c55e" strokeWidth="1.5"
              points={points.map((p, i) => `${(i / (points.length - 1)) * 300 + 10},${70 - (p.collisionsAvoided / maxAvoided) * 58}`).join(" ")} />
          )}
          {points.length === 0 && <text x="160" y="42" textAnchor="middle" fill="#475569" fontSize="10">Collecting...</text>}
        </svg>
      </div>
    </div>
  );
}
