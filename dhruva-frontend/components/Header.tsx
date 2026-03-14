"use client";

interface HeaderProps {
  status: "connecting" | "live" | "degraded" | "disconnected" | "error";
  timestamp: string | null;
  timeWarpX: number;
  onDecreaseTimeWarp: () => void;
  onIncreaseTimeWarp: () => void;
}

export default function Header({
  status,
  timestamp,
  timeWarpX,
  onDecreaseTimeWarp,
  onIncreaseTimeWarp,
}: HeaderProps) {
  const label = status.toUpperCase();
  const statusClass =
    status === "live"
      ? "text-emerald-300 border-emerald-500"
      : status === "degraded"
        ? "text-amber-300 border-amber-500"
        : "text-slate-300 border-slate-600";

  return (
    <header className="h-12 border-b border-slate-800 bg-slate-950/95 backdrop-blur px-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 bg-gradient-to-br from-blue-500 to-cyan-300" />
        <h1 className="text-sm font-bold tracking-wide">Dhruva CDM</h1>
      </div>

      <div className="flex items-center gap-2">
        <div className="text-[11px] text-slate-400 font-mono hidden md:block">
          {timestamp ? new Date(timestamp).toUTCString() : "--"}
        </div>

        <div className="inline-flex items-center border border-slate-700 bg-slate-900 text-xs">
          <button className="px-2 py-1 hover:bg-slate-800 text-slate-300" onClick={onDecreaseTimeWarp}>
            {"<<"}
          </button>
          <span className="px-2 py-1 text-cyan-300 font-bold border-x border-slate-700">{timeWarpX}x</span>
          <button className="px-2 py-1 hover:bg-slate-800 text-slate-300" onClick={onIncreaseTimeWarp}>
            {">>"}
          </button>
        </div>

        <div className={`px-2 py-0.5 border text-[10px] font-semibold ${statusClass}`}>{label}</div>
        <div className="px-2 py-0.5 border border-slate-700 bg-slate-900 text-[11px] text-slate-300">Mission Control</div>
      </div>
    </header>
  );
}
