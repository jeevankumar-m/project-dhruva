"use client";

import AppShell from "@/components/AppShell";
import { useSnapshotContext } from "@/components/SnapshotProvider";

export default function AlertsPage() {
  const { snapshot } = useSnapshotContext();
  const conjunctions = snapshot?.conjunctions ?? [];

  return (
    <AppShell>
      <div className="h-full flex flex-col gap-2">
        <div className="border border-slate-800 bg-slate-950 p-3">
          <h2 className="text-sm font-semibold">CDM Alerts</h2>
          <p className="text-[11px] text-slate-400">Current conjunction warnings sorted by miss distance and time to closest approach.</p>
        </div>

        <div className="flex-1 min-h-0 border border-slate-800 bg-slate-950 overflow-auto p-3">
          {conjunctions.length === 0 ? (
            <div className="text-xs text-slate-500">No active conjunction alerts.</div>
          ) : (
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800">
                  <th className="text-left py-1.5 px-1 font-medium">Satellite</th>
                  <th className="text-left py-1.5 px-1 font-medium">Debris</th>
                  <th className="text-right py-1.5 px-1 font-medium">TCA (s)</th>
                  <th className="text-right py-1.5 px-1 font-medium">Miss (km)</th>
                  <th className="text-right py-1.5 px-1 font-medium">Rel Angle (deg)</th>
                  <th className="text-center py-1.5 px-1 font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {conjunctions.map((cdm, idx) => (
                  <tr key={`${cdm.satellite_id}-${cdm.debris_id}-${idx}`} className="border-b border-slate-800/50 hover:bg-slate-900/50">
                    <td className="py-1.5 px-1 text-slate-300">{cdm.satellite_id}</td>
                    <td className="py-1.5 px-1 text-slate-400">{cdm.debris_id}</td>
                    <td className="py-1.5 px-1 text-right font-mono text-slate-300">{cdm.tca_seconds.toFixed(1)}</td>
                    <td className="py-1.5 px-1 text-right font-mono text-cyan-300">{cdm.miss_distance_km.toFixed(3)}</td>
                    <td className="py-1.5 px-1 text-right font-mono text-slate-400">{cdm.relative_angle_deg.toFixed(2)}</td>
                    <td className="py-1.5 px-1 text-center">
                      <span
                        className={
                          cdm.risk_level === "CRITICAL"
                            ? "text-red-400"
                            : cdm.risk_level === "WARNING"
                              ? "text-amber-400"
                              : "text-emerald-400"
                        }
                      >
                        {cdm.risk_level}
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
