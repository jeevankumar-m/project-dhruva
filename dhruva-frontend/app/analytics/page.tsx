"use client";

import AppShell from "@/components/AppShell";
import { useSnapshotContext } from "@/components/SnapshotProvider";

export default function AnalyticsPage() {
  const { metricsHistory, snapshot } = useSnapshotContext();
  const points = metricsHistory.slice(-80);
  const metrics = snapshot?.metrics;

  const maxDeltaV = Math.max(1, ...points.map((p) => p.totalDeltaVMps));
  const maxAvoided = Math.max(1, ...points.map((p) => p.collisionsAvoided));

  const conjunctions = snapshot?.conjunctions ?? [];

  return (
    <AppShell>
      <div className="h-full flex flex-col gap-2">
        <div className="border border-slate-800 bg-slate-950 p-3">
          <h2 className="text-sm font-semibold">Analytics</h2>
          <p className="text-[11px] text-slate-400">
            Fleet-level trends for fuel usage, delta-v, collisions avoided, and current conjunction distribution.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
          <div className="border border-slate-800 bg-slate-950 p-3 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-slate-200">Delta-v vs Collisions Avoided (history)</div>
              <div className="flex gap-2 text-[9px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-cyan-400 inline-block" /> Δv
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-emerald-400 inline-block" /> Avoided
                </span>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <svg viewBox="0 0 360 120" className="w-full h-full">
                {points.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="2"
                    points={points
                      .map((p, i) => `${(i / (points.length - 1)) * 340 + 10},${100 - (p.totalDeltaVMps / maxDeltaV) * 80}`)
                      .join(" ")}
                  />
                )}
                {points.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="2"
                    points={points
                      .map((p, i) => `${(i / (points.length - 1)) * 340 + 10},${100 - (p.collisionsAvoided / maxAvoided) * 80}`)
                      .join(" ")}
                  />
                )}
              </svg>
            </div>
          </div>

          <div className="border border-slate-800 bg-slate-950 p-3 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-slate-200">Current Conjunctions (CDMs)</div>
              <div className="text-[10px] text-slate-400">
                Total: {conjunctions.length} • Critical:{" "}
                {conjunctions.filter((c) => c.risk_level === "CRITICAL").length} • Warning:{" "}
                {conjunctions.filter((c) => c.risk_level === "WARNING").length}
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              {conjunctions.length === 0 ? (
                <div className="text-xs text-slate-500">No active conjunctions.</div>
              ) : (
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-800">
                      <th className="text-left py-1.5 px-1 font-medium">Sat</th>
                      <th className="text-left py-1.5 px-1 font-medium">Debris</th>
                      <th className="text-right py-1.5 px-1 font-medium">TCA (s)</th>
                      <th className="text-right py-1.5 px-1 font-medium">Miss (km)</th>
                      <th className="text-center py-1.5 px-1 font-medium">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conjunctions.map((c, idx) => (
                      <tr key={`${c.satellite_id}-${c.debris_id}-${idx}`} className="border-b border-slate-800/50 hover:bg-slate-900/50">
                        <td className="py-1.5 px-1 text-slate-300">{c.satellite_id}</td>
                        <td className="py-1.5 px-1 text-slate-400">{c.debris_id}</td>
                        <td className="py-1.5 px-1 text-right font-mono text-slate-300">{c.tca_seconds.toFixed(1)}</td>
                        <td className="py-1.5 px-1 text-right font-mono text-cyan-300">{c.miss_distance_km.toFixed(3)}</td>
                        <td className="py-1.5 px-1 text-center">
                          <span
                            className={
                              c.risk_level === "CRITICAL"
                                ? "text-red-400"
                                : c.risk_level === "WARNING"
                                  ? "text-amber-400"
                                  : "text-emerald-400"
                            }
                          >
                            {c.risk_level}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="border border-slate-800 bg-slate-950 p-2">
            <div className="text-[10px] text-slate-500">Uptime %</div>
            <div className="text-lg font-semibold text-emerald-300">{(metrics?.uptime_pct ?? 100).toFixed(2)}%</div>
          </div>
          <div className="border border-slate-800 bg-slate-950 p-2">
            <div className="text-[10px] text-slate-500">Uptime Score (exp)</div>
            <div className="text-lg font-semibold text-cyan-300">{(metrics?.uptime_score ?? 100).toFixed(2)}</div>
          </div>
          <div className="border border-slate-800 bg-slate-950 p-2">
            <div className="text-[10px] text-slate-500">Outage Sat-Seconds</div>
            <div className="text-lg font-semibold text-amber-300">{(metrics?.outage_sat_seconds ?? 0).toFixed(0)}</div>
          </div>
          <div className="border border-slate-800 bg-slate-950 p-2">
            <div className="text-[10px] text-slate-500">Avoided per Δv</div>
            <div className="text-lg font-semibold text-violet-300">{(metrics?.avoidance_per_delta_v ?? 0).toFixed(4)}</div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

