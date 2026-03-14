"use client";

import { BurnLogEntry } from "@/lib/types";

interface BurnLogsProps {
  logs: BurnLogEntry[];
}

export default function BurnLogs({ logs }: BurnLogsProps) {
  const executed = logs.filter((l) => l.executed);
  const rejected = logs.filter((l) => l.rejected);

  return (
    <div className="h-full border border-slate-800 bg-slate-950 flex flex-col">
      <div className="px-4 py-3 border-b border-slate-800">
        <div className="text-sm font-semibold text-slate-100">Burn Logs</div>
        <div className="text-[11px] text-slate-400">
          {executed.length} executed, {rejected.length} rejected
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {logs.length === 0 && <div className="text-xs text-slate-600 text-center py-6">No burns recorded yet</div>}

        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-slate-500 border-b border-slate-800">
              <th className="text-left py-1.5 px-1 font-medium">Burn ID</th>
              <th className="text-left py-1.5 px-1 font-medium">Satellite</th>
              <th className="text-left py-1.5 px-1 font-medium">Time (UTC)</th>
              <th className="text-right py-1.5 px-1 font-medium">Delta-v (m/s)</th>
              <th className="text-center py-1.5 px-1 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, idx) => (
              <tr key={`${log.burn_id}-${idx}`} className="border-b border-slate-800/50 hover:bg-slate-900/50">
                <td className="py-1.5 px-1 font-mono text-slate-300">{log.burn_id}</td>
                <td className="py-1.5 px-1 text-slate-400">{log.satellite_id}</td>
                <td className="py-1.5 px-1 font-mono text-slate-400">{new Date(log.burn_time).toISOString().slice(11, 19)}</td>
                <td className="py-1.5 px-1 text-right font-mono text-cyan-300">{log.delta_v_mps.toFixed(2)}</td>
                <td className="py-1.5 px-1 text-center">
                  {log.executed ? (
                    <span className="text-emerald-400">Executed</span>
                  ) : (
                    <span className="text-red-400">Rejected</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t border-slate-800 text-[9px] text-slate-500 flex gap-4">
        <span>Total burns: {logs.length}</span>
        <span>Total delta-v: {executed.reduce((s, l) => s + l.delta_v_mps, 0).toFixed(2)} m/s</span>
      </div>
    </div>
  );
}
