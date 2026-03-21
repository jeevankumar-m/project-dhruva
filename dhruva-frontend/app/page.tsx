"use client";

import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import BullseyePlot from "@/components/BullseyePlot";
import ConstellationList from "@/components/ConstellationList";
import GroundTrackMap from "@/components/GroundTrackMap";
import OrbitTracker3D from "@/components/OrbitTracker3D";
import ManeuverTimeline from "@/components/ManeuverTimeline";
import SatelliteDetail from "@/components/SatelliteDetail";
import { useSnapshotContext } from "@/components/SnapshotProvider";
import TelemetryHeatmaps from "@/components/TelemetryHeatmaps";
import BlackoutPanel from "@/components/BlackoutPanel";

function Dashboard() {
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");

  const {
    snapshot,
    selectedSatelliteId,
    setSelectedSatelliteId,
    metricsHistory,
    tracks,
  } = useSnapshotContext();

  const satellites = useMemo(() => snapshot?.satellites ?? [], [snapshot?.satellites]);
  const selectedSat = useMemo(
    () => satellites.find((s) => s.id === selectedSatelliteId) ?? null,
    [satellites, selectedSatelliteId],
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-2 min-h-full">
        <div className="flex gap-2 flex-1 min-h-0 flex-col xl:flex-row">
          <div className="w-full xl:w-64 xl:shrink-0 flex flex-col gap-2 min-h-[22rem] xl:min-h-0">
            <div className="flex-1 min-h-0">
              <TelemetryHeatmaps satellites={satellites} metricsHistory={metricsHistory} />
            </div>
            <div className="flex-1 min-h-0">
              <BullseyePlot selectedSatelliteId={selectedSatelliteId} conjunctions={snapshot?.conjunctions ?? []} />
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-1 min-w-0 min-h-[26rem] xl:min-h-0">
            <div className="flex items-center justify-between shrink-0 px-0.5">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
                {snapshot?.counts ? `${snapshot.counts.satellites} SATs · ${snapshot.counts.debris} DEB · ${snapshot.counts.conjunction_warnings} CDMs` : "Orbital View"}
              </div>
              <div className="inline-flex border border-slate-700 bg-slate-900/80 p-0.5 text-[11px]">
                <button
                  className={`px-3 py-0.5 font-semibold tracking-wide transition-colors ${viewMode === "2d" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-slate-200"}`}
                  onClick={() => setViewMode("2d")}
                >
                  2D MAP
                </button>
                <button
                  className={`px-3 py-0.5 font-semibold tracking-wide transition-colors ${viewMode === "3d" ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:text-slate-200"}`}
                  onClick={() => setViewMode("3d")}
                >
                  3D ORBIT
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              {viewMode === "2d" ? (
                <GroundTrackMap
                  satellites={satellites}
                  selectedSatelliteId={selectedSatelliteId}
                  onSelectSatellite={setSelectedSatelliteId}
                  timestamp={snapshot?.timestamp ?? new Date().toISOString()}
                  groundStations={snapshot?.ground_stations ?? []}
                  debrisCloud={snapshot?.debris_cloud ?? []}
                  conjunctions={snapshot?.conjunctions ?? []}
                  tracks={tracks}
                />
              ) : (
                <OrbitTracker3D
                  satellites={satellites}
                  selectedSatelliteId={selectedSatelliteId}
                  onSelectSatellite={setSelectedSatelliteId}
                  timestamp={snapshot?.timestamp ?? new Date().toISOString()}
                  debrisCloud={snapshot?.debris_cloud ?? []}
                  conjunctions={snapshot?.conjunctions ?? []}
                  blackoutStatus={snapshot?.blackout_status ?? []}
                />
              )}
            </div>
          </div>

          <div className="w-full xl:w-60 xl:shrink-0 flex flex-col gap-2 min-h-[22rem] xl:min-h-0">
            <div className="h-40 xl:h-36 shrink-0">
              <ConstellationList
                satellites={satellites}
                selectedSatelliteId={selectedSatelliteId}
                onSelectSatellite={setSelectedSatelliteId}
              />
            </div>
            <div className="h-40 xl:h-36 shrink-0">
              <BlackoutPanel
                blackoutStatus={snapshot?.blackout_status ?? []}
                selectedSatelliteId={selectedSatelliteId}
                onSelectSatellite={setSelectedSatelliteId}
              />
            </div>
            <div className="flex-1 min-h-0">
              <SatelliteDetail satellite={selectedSat} />
            </div>
          </div>
        </div>

        <div className="h-32 xl:h-36 shrink-0 min-w-0">
          <ManeuverTimeline maneuvers={snapshot?.maneuvers ?? []} nowIso={snapshot?.timestamp ?? new Date().toISOString()} />
        </div>
      </div>
    </AppShell>
  );
}

export default function Home() {
  return <Dashboard />;
}
