"use client";

import { SatelliteSnapshot } from "@/lib/types";

interface SatelliteDetailProps {
  satellite: SatelliteSnapshot | null;
}

const DRY_MASS_KG = 500.0;
const INITIAL_FUEL_KG = 50.0;

export default function SatelliteDetail({ satellite }: SatelliteDetailProps) {
  if (!satellite) {
    return (
      <div className="h-full border border-slate-800 bg-slate-950 p-3 flex items-center justify-center text-xs text-slate-500">
        Select a satellite to view details
      </div>
    );
  }

  const plannedFuelKg = satellite.planned_fuel_kg ?? satellite.fuel_kg;
  const reservedFuelKg = Math.max(0, satellite.fuel_kg - plannedFuelKg);
  const fuelPct = Math.max(0, Math.min(100, (plannedFuelKg / INITIAL_FUEL_KG) * 100));
  const totalMass = satellite.planned_mass_kg ?? (DRY_MASS_KG + plannedFuelKg);
  const fuelColor = fuelPct > 40 ? "text-emerald-400" : fuelPct > 20 ? "text-amber-400" : "text-red-400";
  const statusColor =
    satellite.status === "NOMINAL" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" : "text-amber-400 bg-amber-500/10 border-amber-500/30";

  return (
    <div className="h-full border border-slate-800 bg-slate-950 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">{satellite.id}</h3>
        <span className={`text-[10px] px-2 py-0.5 border ${statusColor}`}>{satellite.status}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-900 border border-slate-800 p-2">
          <div className="text-slate-500 text-[10px]">Fuel remaining (planned)</div>
          <div className={`text-base font-bold ${fuelColor}`}>{plannedFuelKg.toFixed(2)} kg</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-2">
          <div className="text-slate-500 text-[10px]">Fuel %</div>
          <div className={`text-base font-bold ${fuelColor}`}>{fuelPct.toFixed(1)}%</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-2">
          <div className="text-slate-500 text-[10px]">Current mass (planned)</div>
          <div className="text-base font-bold text-slate-200">{totalMass.toFixed(2)} kg</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-2">
          <div className="text-slate-500 text-[10px]">Dry mass</div>
          <div className="text-base font-bold text-slate-400">{DRY_MASS_KG} kg</div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-2 text-xs">
        <div className="flex items-center justify-between mb-1">
          <div className="text-slate-500 text-[10px]">Reserved for queued burns</div>
          <div className="text-[10px] text-slate-300">{reservedFuelKg.toFixed(2)} kg</div>
        </div>
        <div className="text-slate-500 text-[10px] mb-1">Fuel gauge</div>
        <div className="h-2 bg-slate-800 overflow-hidden">
          <div
            className={`h-full ${fuelPct > 40 ? "bg-emerald-500" : fuelPct > 20 ? "bg-amber-500" : "bg-red-500"}`}
            style={{ width: `${fuelPct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-900 border border-slate-800 p-2">
          <div className="text-slate-500 text-[10px]">Altitude</div>
          <div className="text-sm font-mono text-sky-300">{satellite.altitude_km.toFixed(1)} km</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-2">
          <div className="text-slate-500 text-[10px]">Drift from slot</div>
          <div className={`text-sm font-mono ${satellite.drift_km > 5 ? "text-amber-300" : "text-slate-300"}`}>{satellite.drift_km.toFixed(2)} km</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-2">
          <div className="text-slate-500 text-[10px]">Latitude</div>
          <div className="text-sm font-mono text-slate-300">{satellite.lat.toFixed(3)}&deg;</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-2">
          <div className="text-slate-500 text-[10px]">Longitude</div>
          <div className="text-sm font-mono text-slate-300">{satellite.lon.toFixed(3)}&deg;</div>
        </div>
      </div>
    </div>
  );
}
