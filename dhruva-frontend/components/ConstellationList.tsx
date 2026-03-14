"use client";

import { SatelliteSnapshot } from "@/lib/types";

interface ConstellationListProps {
  satellites: SatelliteSnapshot[];
  selectedSatelliteId: string | null;
  onSelectSatellite: (id: string) => void;
}

export default function ConstellationList({
  satellites,
  selectedSatelliteId,
  onSelectSatellite,
}: ConstellationListProps) {
  return (
    <div className="h-full border border-slate-800 bg-slate-950 p-3 flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Constellation Contents</h3>
      <div className="overflow-auto space-y-2 pr-1">
        {satellites.map((sat) => {
          const fuelPct = Math.max(0, Math.min(100, (sat.fuel_kg / 50) * 100));
          return (
            <button
              key={sat.id}
              onClick={() => onSelectSatellite(sat.id)}
              className={`w-full text-left p-2 border ${
                selectedSatelliteId === sat.id ? "border-cyan-400 bg-cyan-500/10" : "border-slate-800 bg-slate-900"
              }`}
            >
              <div className="flex justify-between text-xs">
                <span className="text-slate-200">{sat.id}</span>
                <span className="text-slate-400">{fuelPct.toFixed(1)}%</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">{sat.status}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
