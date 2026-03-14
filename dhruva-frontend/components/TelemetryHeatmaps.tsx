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
    <div className="h-full border border-slate-800 bg-slate-950 p-3 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold">Telemetry & Resources</h3>
        <p className="text-[11px] text-slate-400">Fleet fuel and efficiency (Fuel Consumed vs Collisions Avoided)</p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-900 border border-slate-800 p-2">
          <div className="text-slate-400">Fleet fuel % (planned)</div>
          <div className="text-lg font-semibold text-emerald-300">{latest ? latest.fleetFuelPct.toFixed(1) : "--"}%</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-2">
          <div className="text-slate-400">Active satellites</div>
          <div className="text-lg font-semibold text-sky-300">{satellites.length}</div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-2 flex-1 min-h-20">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] text-slate-300 font-semibold">Delta-v vs Collisions Avoided</div>
          <div className="flex gap-2 text-[9px]">
            <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-cyan-400 inline-block" /> Delta-v (m/s)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-emerald-400 inline-block" /> Avoided</span>
          </div>
        </div>
        <svg viewBox="0 0 360 90" className="w-full h-16">
          {points.length > 1 && (
            <polyline
              fill="none"
              stroke="#22d3ee"
              strokeWidth="2"
              points={points
                .map((p, i) => `${(i / (points.length - 1)) * 340 + 10},${80 - (p.totalDeltaVMps / maxDeltaV) * 70}`)
                .join(" ")}
            />
          )}
          {points.length > 1 && (
            <polyline
              fill="none"
              stroke="#22c55e"
              strokeWidth="2"
              points={points
                .map((p, i) => `${(i / (points.length - 1)) * 340 + 10},${80 - (p.collisionsAvoided / maxAvoided) * 70}`)
                .join(" ")}
            />
          )}
        </svg>
      </div>
    </div>
  );
}
