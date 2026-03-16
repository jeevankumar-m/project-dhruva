"use client";

import AppShell from "@/components/AppShell";
import { useSnapshotContext } from "@/components/SnapshotProvider";

export default function GraveyardPage() {
  const { snapshot } = useSnapshotContext();
  const satellites = snapshot?.satellites ?? [];

  const inGraveyard = satellites
    .filter((s) => s.in_graveyard_orbit || s.status === "GRAVEYARD")
    .sort((a, b) => {
      const at = a.graveyard_entry_time ? new Date(a.graveyard_entry_time).getTime() : Number.POSITIVE_INFINITY;
      const bt = b.graveyard_entry_time ? new Date(b.graveyard_entry_time).getTime() : Number.POSITIVE_INFINITY;
      return at - bt;
    });

  return (
    <AppShell>
      <div className="h-full flex flex-col gap-2">
        <div className="border border-slate-800 bg-slate-950 p-3">
          <h2 className="text-sm font-semibold">Graveyard Orbit Monitor</h2>
          <p className="text-[11px] text-slate-400">
            Satellites moved to end-of-life graveyard mode when fuel falls below critical threshold.
          </p>
        </div>

        <div className="flex-1 min-h-0 border border-slate-800 bg-slate-950 overflow-auto p-3">
          {inGraveyard.length === 0 ? (
            <div className="text-xs text-slate-500">No satellites in graveyard orbit.</div>
          ) : (
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-slate-500 border-b border-slate-800">
                  <th className="text-left py-1.5 px-1 font-medium">Satellite</th>
                  <th className="text-right py-1.5 px-1 font-medium">Fuel (kg)</th>
                  <th className="text-right py-1.5 px-1 font-medium">Altitude (km)</th>
                  <th className="text-left py-1.5 px-1 font-medium">Entered Graveyard (UTC)</th>
                  <th className="text-center py-1.5 px-1 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {inGraveyard.map((sat) => (
                  <tr key={sat.id} className="border-b border-slate-800/50 hover:bg-slate-900/50">
                    <td className="py-1.5 px-1 text-slate-300">{sat.id}</td>
                    <td className="py-1.5 px-1 text-right font-mono text-amber-300">{sat.fuel_kg.toFixed(2)}</td>
                    <td className="py-1.5 px-1 text-right font-mono text-sky-300">{sat.altitude_km.toFixed(2)}</td>
                    <td className="py-1.5 px-1 font-mono text-slate-400">
                      {sat.graveyard_entry_time ? new Date(sat.graveyard_entry_time).toUTCString() : "pending"}
                    </td>
                    <td className="py-1.5 px-1 text-center">
                      <span className="text-violet-300">GRAVEYARD</span>
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
