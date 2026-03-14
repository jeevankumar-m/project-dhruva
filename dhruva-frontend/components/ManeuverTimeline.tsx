"use client";

import { useMemo } from "react";
import { ManeuverItem } from "@/lib/types";

interface TimelineProps {
  maneuvers: ManeuverItem[];
  nowIso: string;
}

const COOLDOWN_S = 600;
const WINDOW_MS = 6 * 3600 * 1000;

function formatTime(d: Date): string {
  return d.toISOString().slice(11, 16);
}

export default function ManeuverTimeline({ maneuvers, nowIso }: TimelineProps) {
  const now = new Date(nowIso).getTime();
  const windowStart = now - WINDOW_MS * 0.2;
  const windowEnd = now + WINDOW_MS * 0.8;

  const sorted = useMemo(
    () =>
      [...maneuvers]
        .sort((a, b) => new Date(a.burn_time).getTime() - new Date(b.burn_time).getTime())
        .filter((m) => {
          const t = new Date(m.burn_time).getTime();
          return t >= windowStart && t <= windowEnd;
        })
        .slice(0, 24),
    [maneuvers, windowStart, windowEnd],
  );

  const pct = (t: number) => Math.max(0, Math.min(100, ((t - windowStart) / (windowEnd - windowStart)) * 100));
  const nowPct = pct(now);

  const ticks: Array<{ p: number; label: string }> = [];
  const step = 3600 * 1000;
  for (let t = Math.ceil(windowStart / step) * step; t <= windowEnd; t += step) {
    ticks.push({ p: pct(t), label: formatTime(new Date(t)) });
  }

  return (
    <div className="h-full border border-slate-800 bg-slate-950 p-2 flex flex-col gap-0.5 text-[10px]">
      <div className="flex items-center justify-between mb-0.5">
        <h3 className="text-xs font-semibold text-slate-200">Maneuver Timeline</h3>
        <div className="flex gap-3 text-[9px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 inline-block" /> Burn</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500/50 inline-block" /> Cooldown</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 inline-block" /> Executed</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 inline-block" /> Rejected</span>
        </div>
      </div>

      <div className="flex">
        <div className="w-20 shrink-0" />
        <div className="flex-1 relative h-4 border-b border-slate-800">
          {ticks.map((t) => (
            <div key={t.label} className="absolute top-0 -translate-x-1/2" style={{ left: `${t.p}%` }}>
              <span className="text-[9px] text-slate-500 font-mono">{t.label}</span>
              <div className="w-px h-1 bg-slate-700 mx-auto mt-px" />
            </div>
          ))}
          <div className="absolute top-0 bottom-0 w-px bg-cyan-500 z-10" style={{ left: `${nowPct}%` }} />
        </div>
        <div className="w-14 shrink-0" />
      </div>

      <div className="flex-1 overflow-auto">
        {sorted.length === 0 && (
          <div className="text-slate-600 text-center py-3">No maneuvers in window</div>
        )}
        {sorted.map((m, idx) => {
          const burnMs = new Date(m.burn_time).getTime();
          const burnP = pct(burnMs);
          const coolP = (COOLDOWN_S * 1000 / (windowEnd - windowStart)) * 100;
          const burnWidth = Math.max(1, (30 * 1000 / (windowEnd - windowStart)) * 100);

          const burnColor = m.executed ? "bg-emerald-500" : m.rejected ? "bg-red-500" : "bg-blue-500";
          const coolColor = m.executed ? "bg-emerald-500/20" : m.rejected ? "bg-red-500/10" : "bg-amber-500/25";

          return (
            <div key={`${m.burn_id}-${idx}`} className="flex items-center h-5">
              <div className="w-20 shrink-0 truncate text-slate-400 font-mono pr-1" title={`${m.satellite_id} / ${m.burn_id}`}>
                {m.satellite_id.replace("SAT-Alpha-", "A-")} <span className="text-slate-600">{m.burn_id.includes("EVA") ? "E" : m.burn_id.includes("REC") ? "R" : "B"}</span>
              </div>

              <div className="flex-1 relative h-3 bg-slate-900/50">
                <div className={`absolute top-0 bottom-0 ${burnColor}`} style={{ left: `${burnP}%`, width: `${burnWidth}%` }} />
                {!m.rejected && (
                  <div className={`absolute top-0 bottom-0 ${coolColor}`} style={{ left: `${burnP + burnWidth}%`, width: `${Math.min(coolP, 100 - burnP - burnWidth)}%` }} />
                )}
                {(m.conflict || m.blackout_overlap) && (
                  <div className="absolute top-0 bottom-0 border border-red-500/50 bg-red-500/10" style={{ left: `${burnP}%`, width: `${burnWidth + coolP}%` }} />
                )}
              </div>

              <div className="w-14 shrink-0 text-right">
                <span className={m.executed ? "text-emerald-400" : m.rejected ? "text-red-400" : "text-blue-400"}>
                  {m.executed ? "Done" : m.rejected ? "Fail" : formatTime(new Date(burnMs))}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
