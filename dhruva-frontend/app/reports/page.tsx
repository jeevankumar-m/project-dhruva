"use client";

import AppShell from "@/components/AppShell";
import BurnLogs from "@/components/BurnLogs";
import { useSnapshotContext } from "@/components/SnapshotProvider";

export default function ReportsPage() {
  const { snapshot } = useSnapshotContext();
  const logs = snapshot?.burn_logs ?? [];

  return (
    <AppShell>
      <div className="h-full flex flex-col gap-2">
        <div className="border border-slate-800 bg-slate-950 p-3">
          <h2 className="text-sm font-semibold">Reports / Burn Logs</h2>
          <p className="text-[11px] text-slate-400">Executed and rejected maneuver history for the current simulation stream.</p>
        </div>
        <div className="flex-1 min-h-0">
          <BurnLogs logs={logs} />
        </div>
      </div>
    </AppShell>
  );
}
