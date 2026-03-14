"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ConjunctionItem } from "@/lib/types";

interface BullseyeProps {
  selectedSatelliteId: string | null;
  conjunctions: ConjunctionItem[];
}

interface HitInfo {
  x: number;
  y: number;
  item: ConjunctionItem;
}

function riskColor(level: string) {
  if (level === "CRITICAL") return "#ef4444";
  if (level === "WARNING") return "#f59e0b";
  return "#22c55e";
}

function riskTextClass(level: string) {
  if (level === "CRITICAL") return "text-red-400";
  if (level === "WARNING") return "text-amber-400";
  return "text-emerald-400";
}

function drawBullseye(
  canvas: HTMLCanvasElement,
  filtered: ConjunctionItem[],
  selectedSatelliteId: string | null,
  hitZonesRef: React.MutableRefObject<Array<{ cx: number; cy: number; r: number; item: ConjunctionItem }>>,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.min(w, h) * 0.42;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 1;
  const rings = [0.25, 0.5, 0.75, 1];
  const ringLabels = ["6h", "12h", "18h", "24h"];
  rings.forEach((k, idx) => {
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * k, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#475569";
    ctx.font = `${Math.max(9, w * 0.018)}px sans-serif`;
    ctx.fillText(ringLabels[idx], cx + maxR * k + 3, cy - 3);
  });

  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 0.5;
  for (let a = 0; a < 360; a += 30) {
    const rad = (a * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(rad) * maxR, cy + Math.sin(rad) * maxR);
    ctx.stroke();
  }

  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(4, w * 0.008), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#94a3b8";
  ctx.font = `${Math.max(9, w * 0.018)}px sans-serif`;
  ctx.fillText(selectedSatelliteId ?? "SAT", cx + 7, cy + 3);

  const zones: typeof hitZonesRef.current = [];

  for (const c of filtered) {
    const norm = Math.min(1, c.tca_seconds / (24 * 3600));
    const r = Math.max(12, norm * maxR);
    const a = (c.relative_angle_deg * Math.PI) / 180;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;

    const dotR = c.risk_level === "CRITICAL" ? 6 : c.risk_level === "WARNING" ? 5 : 3.5;

    ctx.fillStyle = riskColor(c.risk_level);
    ctx.beginPath();
    ctx.arc(px, py, dotR, 0, Math.PI * 2);
    ctx.fill();

    if (c.risk_level !== "SAFE") {
      ctx.strokeStyle = riskColor(c.risk_level);
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(px, py, dotR + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = "#cbd5e1";
    ctx.font = `${Math.max(8, w * 0.016)}px sans-serif`;
    ctx.fillText(c.debris_id, px + dotR + 4, py + 3);

    zones.push({ cx: px, cy: py, r: dotR + 8, item: c });
  }

  hitZonesRef.current = zones;
}

export default function BullseyePlot({ selectedSatelliteId, conjunctions }: BullseyeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const expandedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tooltip, setTooltip] = useState<HitInfo | null>(null);
  const [expanded, setExpanded] = useState(false);
  const hitZonesRef = useRef<Array<{ cx: number; cy: number; r: number; item: ConjunctionItem }>>([]);
  const expandedHitZonesRef = useRef<Array<{ cx: number; cy: number; r: number; item: ConjunctionItem }>>([]);

  const filtered = useMemo(
    () => conjunctions.filter((c) => c.satellite_id === selectedSatelliteId).slice(0, 200),
    [conjunctions, selectedSatelliteId],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) drawBullseye(canvas, filtered, selectedSatelliteId, hitZonesRef);
  }, [filtered, selectedSatelliteId]);

  useEffect(() => {
    if (!expanded) return;
    const canvas = expandedCanvasRef.current;
    if (canvas) drawBullseye(canvas, filtered, selectedSatelliteId, expandedHitZonesRef);
  }, [filtered, selectedSatelliteId, expanded]);

  const handleCanvasClick = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>, zones: typeof hitZonesRef.current) => {
      const canvas = evt.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const mx = ((evt.clientX - rect.left) / rect.width) * canvas.width;
      const my = ((evt.clientY - rect.top) / rect.height) * canvas.height;

      for (const zone of zones) {
        if (Math.hypot(mx - zone.cx, my - zone.cy) <= zone.r) {
          setTooltip({ x: evt.clientX - rect.left, y: evt.clientY - rect.top, item: zone.item });
          return;
        }
      }
      setTooltip(null);
    },
    [],
  );

  const tooltipEl = tooltip && (
    <div
      className="absolute z-30 bg-slate-900 border border-slate-700 p-2.5 text-[11px] text-slate-200 shadow-xl"
      style={{ left: Math.min(tooltip.x, 260), top: Math.max(tooltip.y - 90, 4) }}
    >
      <div className="font-semibold text-slate-100 mb-1">{tooltip.item.debris_id}</div>
      <div>Risk: <span className={riskTextClass(tooltip.item.risk_level)}>{tooltip.item.risk_level}</span></div>
      <div>Miss distance: {tooltip.item.miss_distance_km.toFixed(3)} km</div>
      <div>TCA: {(tooltip.item.tca_seconds / 60).toFixed(1)} min ({tooltip.item.tca_seconds.toFixed(0)}s)</div>
      <div>Approach angle: {tooltip.item.relative_angle_deg.toFixed(1)}&deg;</div>
      <button className="mt-1.5 text-[10px] text-slate-400 hover:text-slate-200 underline" onClick={() => setTooltip(null)}>dismiss</button>
    </div>
  );

  return (
    <>
      <div className="h-full border border-slate-800 bg-slate-950 p-3 flex flex-col relative">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-semibold text-slate-200">Conjunction Bullseye</div>
          <button
            className="text-[10px] text-cyan-400 hover:text-cyan-300 border border-slate-700 px-2 py-0.5 bg-slate-900 hover:bg-slate-800"
            onClick={() => { setExpanded(true); setTooltip(null); }}
          >
            Expand
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mb-2">Click dots for info. Radial = TCA, Angle = approach</p>
        <canvas
          ref={canvasRef}
          width={340}
          height={270}
          className="w-full flex-1 cursor-pointer"
          onClick={(e) => handleCanvasClick(e, hitZonesRef.current)}
        />
        {!expanded && tooltipEl}
      </div>

      {expanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => { setExpanded(false); setTooltip(null); }}>
          <div
            className="relative bg-slate-950 border border-slate-700 shadow-2xl flex flex-col"
            style={{ width: "min(90vw, 700px)", height: "min(85vh, 660px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <div>
                <div className="text-sm font-semibold text-slate-100">Conjunction Bullseye - Extended View</div>
                <div className="text-[11px] text-slate-400">
                  {selectedSatelliteId ?? "No satellite"} - {filtered.length} conjunction{filtered.length !== 1 ? "s" : ""}
                </div>
              </div>
              <button
                className="text-xs text-slate-400 hover:text-slate-100 border border-slate-700 px-3 py-1 bg-slate-900 hover:bg-slate-800"
                onClick={() => { setExpanded(false); setTooltip(null); }}
              >
                Close
              </button>
            </div>

            <div className="flex flex-1 min-h-0">
              <div className="flex-1 p-3 relative">
                <canvas
                  ref={expandedCanvasRef}
                  width={560}
                  height={480}
                  className="w-full h-full cursor-pointer"
                  onClick={(e) => handleCanvasClick(e, expandedHitZonesRef.current)}
                />
                {tooltipEl}
              </div>

              <div className="w-52 border-l border-slate-800 p-3 overflow-auto">
                <div className="text-[10px] text-slate-500 mb-2 font-semibold uppercase tracking-wide">Threat List</div>
                <div className="space-y-1.5">
                  {filtered.length === 0 && <div className="text-[11px] text-slate-600">No conjunctions</div>}
                  {filtered.map((c) => (
                    <button
                      key={c.debris_id}
                      className="w-full text-left p-1.5 border border-slate-800 bg-slate-900 hover:bg-slate-800 text-[10px]"
                      onClick={() => setTooltip({ x: 200, y: 200, item: c })}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-slate-200 font-mono">{c.debris_id}</span>
                        <span className={riskTextClass(c.risk_level)}>{c.risk_level}</span>
                      </div>
                      <div className="text-slate-500 mt-0.5">
                        {c.miss_distance_km.toFixed(2)} km | {(c.tca_seconds / 60).toFixed(0)}m
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800">
                  <div className="text-[10px] text-slate-500 mb-1.5 font-semibold uppercase tracking-wide">Legend</div>
                  <div className="space-y-1 text-[10px]">
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 bg-red-500 inline-block" /> Critical (&lt; 1 km)</div>
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 bg-amber-500 inline-block" /> Warning (&lt; 5 km)</div>
                    <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 bg-emerald-500 inline-block" /> Safe (&gt; 5 km)</div>
                  </div>
                  <div className="mt-2 text-[9px] text-slate-600">
                    Center = selected satellite. Radial distance = Time to Closest Approach. Angle = relative approach vector.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
