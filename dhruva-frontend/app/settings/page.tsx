"use client";

import AppShell from "@/components/AppShell";
import { useSnapshotContext } from "@/components/SnapshotProvider";

export default function SettingsPage() {
  const { snapshot, timeWarpX } = useSnapshotContext();

  return (
    <AppShell>
      <div className="h-full flex flex-col gap-2">
        <div className="border border-slate-800 bg-slate-950 p-3">
          <h2 className="text-sm font-semibold">Settings</h2>
          <p className="text-[11px] text-slate-400">Simulation controls and configuration placeholders.</p>
        </div>

        <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
          <div className="border border-slate-800 bg-slate-950 p-3">
            <h3 className="text-xs font-semibold mb-2">Simulation</h3>
            <div className="text-[11px] text-slate-400 flex flex-col gap-1">
              <div>Current time warp: {timeWarpX}x</div>
              <div>Satellites: {snapshot?.counts?.satellites ?? 0}</div>
              <div>Debris objects: {snapshot?.counts?.debris ?? 0}</div>
              <div>Active CDM warnings: {snapshot?.counts?.conjunction_warnings ?? 0}</div>
            </div>
          </div>

          <div className="border border-slate-800 bg-slate-950 p-3">
            <h3 className="text-xs font-semibold mb-2">Configuration</h3>
            <div className="text-[11px] text-slate-500">
              Dedicated settings controls can be attached here (thresholds, notification policy, automation policy).
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
