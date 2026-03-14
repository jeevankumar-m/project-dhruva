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

function Dashboard() {
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");

  const {
    snapshot,
    selectedSatelliteId,
    setSelectedSatelliteId,
    metricsHistory,
  } = useSnapshotContext();

  const satellites = useMemo(() => snapshot?.satellites ?? [], [snapshot?.satellites]);
  const selectedSat = useMemo(
    () => satellites.find((s) => s.id === selectedSatelliteId) ?? null,
    [satellites, selectedSatelliteId],
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-2 h-full">
        <div className="flex gap-2 flex-1 min-h-0">
          <div className="w-64 shrink-0 flex flex-col gap-2">
            <div className="flex-1 min-h-0">
              <TelemetryHeatmaps satellites={satellites} metricsHistory={metricsHistory} />
            </div>
            <div className="flex-1 min-h-0">
              <BullseyePlot selectedSatelliteId={selectedSatelliteId} conjunctions={snapshot?.conjunctions ?? []} />
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-1 min-w-0">
            <div className="flex items-center justify-end shrink-0">
              <div className="inline-flex border border-slate-700 bg-slate-900 p-0.5 text-xs">
                <button
                  className={`px-3 py-0.5 ${viewMode === "2d" ? "bg-cyan-500 text-slate-950" : "text-slate-300"}`}
                  onClick={() => setViewMode("2d")}
                >
                  2D
                </button>
                <button
                  className={`px-3 py-0.5 ${viewMode === "3d" ? "bg-cyan-500 text-slate-950" : "text-slate-300"}`}
                  onClick={() => setViewMode("3d")}
                >
                  3D
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
                />
              ) : (
                <OrbitTracker3D
                  satellites={satellites}
                  selectedSatelliteId={selectedSatelliteId}
                  onSelectSatellite={setSelectedSatelliteId}
                  timestamp={snapshot?.timestamp ?? new Date().toISOString()}
                  debrisCloud={snapshot?.debris_cloud ?? []}
                  conjunctions={snapshot?.conjunctions ?? []}
                />
              )}
            </div>
          </div>

          <div className="w-60 shrink-0 flex flex-col gap-2">
            <div className="h-48 shrink-0">
              <ConstellationList
                satellites={satellites}
                selectedSatelliteId={selectedSatelliteId}
                onSelectSatellite={setSelectedSatelliteId}
              />
            </div>
            <div className="flex-1 min-h-0">
              <SatelliteDetail satellite={selectedSat} />
            </div>
          </div>
        </div>

        <div className="h-36 shrink-0">
          <ManeuverTimeline maneuvers={snapshot?.maneuvers ?? []} nowIso={snapshot?.timestamp ?? new Date().toISOString()} />
        </div>
      </div>
    </AppShell>
  );
}

export default function Home() {
  return <Dashboard />;
}
