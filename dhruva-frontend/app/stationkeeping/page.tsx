"use client";

import AppShell from "@/components/AppShell";
import { useSnapshotContext } from "@/components/SnapshotProvider";

export default function StationKeepingPage() {
  const { snapshot } = useSnapshotContext();
  const satellites = snapshot?.satellites ?? [];
  const maneuvers = snapshot?.maneuvers ?? [];
  const metrics = snapshot?.metrics;

  const outOfBox = satellites.filter((s) => s.status === "OUT_OF_BOX");
  const nominal = satellites.filter((s) => s.status === "NOMINAL");
  const recoveryBurns = maneuvers.filter((m) => m.burn_id?.startsWith("AUTO-REC-"));

  return (
    <AppShell>
      <div className="h-full flex flex-col gap-2">

        {/* Header */}
        <div className="border border-slate-800 bg-slate-950 p-3">
          <h2 className="text-sm font-semibold">Station-Keeping & Orbital Recovery</h2>
          <p className="text-[11px] text-slate-400">
            Tracks satellite drift from nominal orbital slots. Recovery burns are automatically scheduled when drift exceeds 10 km.
          </p>
        </div>

        {/* Fleet Uptime Metrics */}
        <div className="grid grid-cols-4 gap-2">
          <div className="border border-slate-800 bg-slate-950 p-3">
            <div className="text-[10px] text-slate-500 mb-1">Fleet Uptime</div>
            <div className="text-xl font-mono font-bold text-emerald-400">
              {metrics ? metrics.uptime_pct.toFixed(1) : "—"}%
            </div>
          </div>
          <div className="border border-slate-800 bg-slate-950 p-3">
            <div className="text-[10px] text-slate-500 mb-1">Uptime Score</div>
            <div className="text-xl font-mono font-bold text-cyan-400">
              {metrics ? metrics.uptime_score.toFixed(1) : "—"}
            </div>
          </div>
          <div className="border border-slate-800 bg-slate-950 p-3">
            <div className="text-[10px] text-slate-500 mb-1">Nominal</div>
            <div className="text-xl font-mono font-bold text-emerald-300">{nominal.length}</div>
          </div>
          <div className="border border-slate-800 bg-slate-950 p-3">
            <div className="text-[10px] text-slate-500 mb-1">Out of Box</div>
            <div className={`text-xl font-mono font-bold ${outOfBox.length > 0 ? "text-amber-400" : "text-slate-500"}`}>
              {outOfBox.length}
            </div>
          </div>
        </div>

        {/* Satellite Drift Table */}
        <div className="flex-1 min-h-0 border border-slate-800 bg-slate-950 overflow-auto p-3">
          <div className="text-[10px] text-slate-500 mb-2 font-medium uppercase tracking-wider">
            Satellite Drift from Nominal Slot
          </div>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800">
                <th className="text-left py-1.5 px-1 font-medium">Satellite</th>
                <th className="text-right py-1.5 px-1 font-medium">Drift (km)</th>
                <th className="text-right py-1.5 px-1 font-medium">Actual Alt (km)</th>
                <th className="text-right py-1.5 px-1 font-medium">Nominal Alt (km)</th>
                <th className="text-right py-1.5 px-1 font-medium">Actual Lat</th>
                <th className="text-right py-1.5 px-1 font-medium">Nominal Lat</th>
                <th className="text-center py-1.5 px-1 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {satellites
                .filter((s) => s.status !== "GRAVEYARD")
                .sort((a, b) => b.drift_km - a.drift_km)
                .map((sat) => (
                  <tr key={sat.id} className="border-b border-slate-800/50 hover:bg-slate-900/50">
                    <td className="py-1.5 px-1 text-slate-300">{sat.id}</td>
                    <td className={`py-1.5 px-1 text-right font-mono ${
                      sat.drift_km > 10 ? "text-amber-400" : "text-emerald-400"
                    }`}>
                      {sat.drift_km.toFixed(2)}
                    </td>
                    <td className="py-1.5 px-1 text-right font-mono text-sky-300">
                      {sat.altitude_km.toFixed(1)}
                    </td>
                    <td className="py-1.5 px-1 text-right font-mono text-slate-400">
                      {sat.nominal?.altitude_km?.toFixed(1) ?? "—"}
                    </td>
                    <td className="py-1.5 px-1 text-right font-mono text-slate-300">
                      {sat.lat.toFixed(2)}°
                    </td>
                    <td className="py-1.5 px-1 text-right font-mono text-slate-400">
                      {sat.nominal?.lat?.toFixed(2) ?? "—"}°
                    </td>
                    <td className="py-1.5 px-1 text-center">
                      <span className={
                        sat.status === "OUT_OF_BOX"
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }>
                        {sat.status}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Recovery Burns */}
        <div className="border border-slate-800 bg-slate-950 p-3 max-h-44 overflow-auto">
          <div className="text-[10px] text-slate-500 mb-2 font-medium uppercase tracking-wider">
            Auto-Scheduled Recovery Burns
          </div>
          {recoveryBurns.length === 0 ? (
            <div className="text-xs text-slate-600">No recovery burns scheduled — all satellites within nominal slots.</div>
          ) : (
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800">
                  <th className="text-left py-1 px-1 font-medium">Burn ID</th>
                  <th className="text-left py-1 px-1 font-medium">Satellite</th>
                  <th className="text-right py-1 px-1 font-medium">Time (UTC)</th>
                  <th className="text-right py-1 px-1 font-medium">ΔV (m/s)</th>
                  <th className="text-center py-1 px-1 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recoveryBurns.map((m, idx) => (
                  <tr key={`${m.burn_id}-${idx}`} className="border-b border-slate-800/50 hover:bg-slate-900/50">
                    <td className="py-1 px-1 font-mono text-slate-400">{m.burn_id}</td>
                    <td className="py-1 px-1 text-slate-300">{m.satellite_id}</td>
                    <td className="py-1 px-1 text-right font-mono text-slate-400">
                      {new Date(m.burn_time).toUTCString()}
                    </td>
                    <td className="py-1 px-1 text-right font-mono text-cyan-300">
                      {(Math.sqrt(
                        m.delta_v_kmps.x ** 2 +
                        m.delta_v_kmps.y ** 2 +
                        m.delta_v_kmps.z ** 2
                      ) * 1000).toFixed(2)}
                    </td>
                    <td className="py-1 px-1 text-center">
                      <span className={
                        m.executed
                          ? "text-emerald-400"
                          : m.rejected
                            ? "text-red-400"
                            : "text-amber-300"
                      }>
                        {m.executed ? "Executed" : m.rejected ? "Rejected" : "Pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </AppShell>
  );
}
