"use client";

import AppShell from "@/components/AppShell";
import { useSnapshotContext } from "@/components/SnapshotProvider";

const INITIAL_FUEL_KG = 50.0;

function fuelColor(pct: number) {
  if (pct > 40) return "bg-emerald-500";
  if (pct > 20) return "bg-amber-500";
  return "bg-red-500";
}

function fuelTextColor(pct: number) {
  if (pct > 40) return "text-emerald-400";
  if (pct > 20) return "text-amber-400";
  return "text-red-400";
}

export default function FuelPage() {
  const { snapshot, metricsHistory } = useSnapshotContext();
  const satellites = snapshot?.satellites ?? [];
  const metrics = snapshot?.metrics;

  const points = metricsHistory.slice(-80);
  const maxDeltaV = Math.max(1, ...points.map((p) => p.totalDeltaVMps));
  const maxAvoided = Math.max(1, ...points.map((p) => p.collisionsAvoided));

  const fleetFuelPct = metrics?.fleet_fuel_planned_pct ?? metrics?.fleet_fuel_pct ?? 0;
  const totalDeltaV = metrics?.total_delta_v_mps ?? 0;
  const collisionsAvoided = metrics?.collisions_avoided ?? 0;
  const avoidancePerDV = metrics?.avoidance_per_delta_v ?? 0;

  const sortedSats = [...satellites].sort((a, b) => {
    const pctA = ((a.planned_fuel_kg ?? a.fuel_kg) / INITIAL_FUEL_KG) * 100;
    const pctB = ((b.planned_fuel_kg ?? b.fuel_kg) / INITIAL_FUEL_KG) * 100;
    return pctA - pctB;
  });

  return (
    <AppShell>
      <div className="h-full flex flex-col gap-2 min-h-0">
        <div className="shrink-0 border border-slate-800 bg-slate-950 px-3 py-2">
          <h2 className="text-xs font-semibold tracking-widest uppercase text-slate-200">Fleet Fuel &amp; ∆v Analysis</h2>
          <p className="text-[10px] text-slate-500 mt-0.5">Per-satellite propellant budget · Fuel consumed vs collisions avoided</p>
        </div>

        <div className="grid grid-cols-4 gap-2 shrink-0">
          {[
            { label: "Fleet Fuel (planned)", value: `${fleetFuelPct.toFixed(1)}%`, color: "text-emerald-300" },
            { label: "Total ∆v (m/s)", value: totalDeltaV.toFixed(2), color: "text-cyan-300" },
            { label: "Collisions Avoided", value: String(collisionsAvoided), color: "text-violet-300" },
            { label: "Avoided per ∆v", value: avoidancePerDV.toFixed(4), color: "text-amber-300" },
          ].map(({ label, value, color }) => (
            <div key={label} className="border border-slate-800 bg-slate-950/80 p-2">
              <div className="text-[9px] text-slate-500 uppercase tracking-wide">{label}</div>
              <div className={`text-lg font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 flex-1 min-h-0">
          {/* Per-satellite fuel gauges */}
          <div className="w-80 shrink-0 border border-slate-800 bg-slate-950 p-3 flex flex-col gap-2 min-h-0">
            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide shrink-0">
              Per-Satellite Propellant Budget ({satellites.length} satellites)
            </div>
            <div className="flex-1 overflow-auto space-y-1.5">
              {sortedSats.map((sat) => {
                const fuelKg = sat.planned_fuel_kg ?? sat.fuel_kg;
                const pct = Math.max(0, Math.min(100, (fuelKg / INITIAL_FUEL_KG) * 100));
                return (
                  <div key={sat.id} className="flex items-center gap-2">
                    <div className="w-20 shrink-0 text-[10px] font-mono text-slate-400 truncate" title={sat.id}>
                      {sat.id.replace("SAT-Alpha-", "A-")}
                    </div>
                    <div className="flex-1 h-2 bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${sat.in_graveyard_orbit ? "bg-slate-600" : fuelColor(pct)}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className={`w-12 text-right text-[10px] font-mono shrink-0 ${sat.in_graveyard_orbit ? "text-slate-600" : fuelTextColor(pct)}`}>
                      {fuelKg.toFixed(1)} kg
                    </div>
                    <div className={`w-8 text-right text-[9px] shrink-0 ${sat.in_graveyard_orbit ? "text-slate-600" : fuelTextColor(pct)}`}>
                      {pct.toFixed(0)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Efficiency chart */}
          <div className="flex-1 border border-slate-800 bg-slate-950 p-3 flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between shrink-0">
              <div className="text-[10px] text-slate-300 font-semibold uppercase tracking-wide">∆v Consumed vs Collisions Avoided (rolling history)</div>
              <div className="flex gap-3 text-[9px] text-slate-500">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-cyan-400 inline-block" />∆v (m/s)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-400 inline-block" />Collisions Avoided</span>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <svg viewBox="0 0 600 200" className="w-full h-full" preserveAspectRatio="none">
                <line x1="10" y1="180" x2="590" y2="180" stroke="#1e293b" strokeWidth="1" />
                <line x1="10" y1="10" x2="10" y2="180" stroke="#1e293b" strokeWidth="1" />
                {points.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="2"
                    points={points.map((p, i) => `${(i / (points.length - 1)) * 570 + 10},${170 - (p.totalDeltaVMps / maxDeltaV) * 155}`).join(" ")}
                  />
                )}
                {points.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="2"
                    points={points.map((p, i) => `${(i / (points.length - 1)) * 570 + 10},${170 - (p.collisionsAvoided / maxAvoided) * 155}`).join(" ")}
                  />
                )}
                {points.length === 0 && (
                  <text x="300" y="100" textAnchor="middle" fill="#475569" fontSize="12">Collecting data...</text>
                )}
              </svg>
            </div>

            <div className="grid grid-cols-3 gap-2 shrink-0">
              {[
                { label: "Uptime %", value: `${(metrics?.uptime_pct ?? 100).toFixed(2)}%`, color: "text-emerald-300" },
                { label: "Uptime Score", value: (metrics?.uptime_score ?? 100).toFixed(2), color: "text-cyan-300" },
                { label: "Outage Sat-sec", value: (metrics?.outage_sat_seconds ?? 0).toFixed(0), color: "text-amber-300" },
              ].map(({ label, value, color }) => (
                <div key={label} className="border border-slate-800 bg-slate-900/60 p-2">
                  <div className="text-[9px] text-slate-500 uppercase tracking-wide">{label}</div>
                  <div className={`text-base font-bold ${color}`}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
