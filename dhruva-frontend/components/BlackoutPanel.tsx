"use client";

import { BlackoutStatusItem } from "@/lib/types";

interface BlackoutPanelProps {
  blackoutStatus: BlackoutStatusItem[];
  selectedSatelliteId: string | null;
  onSelectSatellite: (id: string) => void;
}

function formatEta(seconds: number | null): string {
  if (seconds === null) return "--";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const rem = Math.round(seconds % 60);
  return `${mins}m ${rem}s`;
}

export default function BlackoutPanel({
  blackoutStatus,
  selectedSatelliteId,
  onSelectSatellite,
}: BlackoutPanelProps) {
  const active = blackoutStatus
    .filter((b) => b.in_blackout)
    .sort((a, b) => {
      const aSec = a.estimated_recovery_seconds ?? Number.POSITIVE_INFINITY;
      const bSec = b.estimated_recovery_seconds ?? Number.POSITIVE_INFINITY;
      return aSec - bSec;
    })
    .slice(0, 12);

  return (
    <div className="h-full border border-slate-800 bg-slate-950 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Blackout Status</h3>
        <span className="text-[10px] text-red-300 border border-red-500/50 px-2 py-0.5">{active.length} active</span>
      </div>

      <div className="overflow-auto pr-1 space-y-1">
        {active.length === 0 && (
          <div className="text-xs text-slate-500 border border-slate-800 bg-slate-900 px-2 py-2">
            No satellites in blackout right now.
          </div>
        )}
        {active.map((item) => (
          <button
            key={item.satellite_id}
            onClick={() => onSelectSatellite(item.satellite_id)}
            className={`w-full text-left px-2 py-1 border ${
              selectedSatelliteId === item.satellite_id ? "border-red-400 bg-red-500/10" : "border-slate-800 bg-slate-900"
            }`}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-200">{item.satellite_id}</span>
              <span className="text-red-300">{formatEta(item.estimated_recovery_seconds)}</span>
            </div>
            <div className="text-[10px] text-slate-500">
              LOS restore ETA: {item.estimated_recovery_timestamp ? new Date(item.estimated_recovery_timestamp).toUTCString() : "unknown"}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
