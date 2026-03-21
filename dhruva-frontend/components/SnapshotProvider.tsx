"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { createOrbitSocket, fetchSnapshot, setTimeWarp } from "@/lib/api";
import { SnapshotPayload, TrackPoint } from "@/lib/types";

interface SnapshotContextType {
  snapshot: SnapshotPayload | null;
  status: "connecting" | "live" | "degraded" | "disconnected" | "error";
  selectedSatelliteId: string | null;
  setSelectedSatelliteId: (id: string | null) => void;
  tracks: Record<string, TrackPoint[]>;
  metricsHistory: Array<{ timestamp: number; fleetFuelPct: number; totalDeltaVMps: number; collisionsAvoided: number }>;
  timeWarpX: number;
  decreaseTimeWarp: () => Promise<void>;
  increaseTimeWarp: () => Promise<void>;
}

const SnapshotContext = createContext<SnapshotContextType | null>(null);
const TRACK_WINDOW_MS = 90 * 60 * 1000;
const WARP_LEVELS = [1, 2, 10, 25, 100];

export function SnapshotProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<SnapshotPayload | null>(null);
  const [status, setStatus] = useState<SnapshotContextType["status"]>("connecting");
  const [selectedSatelliteId, setSelectedSatelliteId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Record<string, TrackPoint[]>>({});
  const [metricsHistory, setMetricsHistory] = useState<SnapshotContextType["metricsHistory"]>([]);
  const [timeWarpX, setTimeWarpX] = useState(1);

  const wsRef = useRef<WebSocket | null>(null);
  const statusRef = useRef<SnapshotContextType["status"]>("connecting");

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const ingestSnapshot = useCallback((data: SnapshotPayload) => {
    setSnapshot(data);
    setTimeWarpX(data.metrics.time_warp_x ?? 1);

    const now = new Date(data.timestamp).getTime();
    setTracks((prev) => {
      const next: Record<string, TrackPoint[]> = { ...prev };
      for (const sat of data.satellites) {
        const existing = next[sat.id] ?? [];
        const merged = [...existing, { lat: sat.lat, lon: sat.lon, timestamp: now }];
        next[sat.id] = merged.filter((p) => now - p.timestamp <= TRACK_WINDOW_MS);
      }
      return next;
    });

    setMetricsHistory((prev) => {
      const merged = [
        ...prev,
        {
          timestamp: now,
          fleetFuelPct: data.metrics.fleet_fuel_planned_pct ?? data.metrics.fleet_fuel_pct,
          totalDeltaVMps: data.metrics.total_delta_v_mps,
          collisionsAvoided: data.metrics.collisions_avoided,
        },
      ];
      return merged.slice(-180);
    });

    if (data.satellites.length > 0) {
      const firstId = data.satellites[0].id;
      setSelectedSatelliteId((prev) => prev ?? firstId);
    }
  }, []);

  const changeTimeWarp = useCallback(
    async (direction: -1 | 1) => {
      const idx = WARP_LEVELS.indexOf(timeWarpX);
      const currentIdx = idx >= 0 ? idx : 0;
      const nextIdx = Math.min(WARP_LEVELS.length - 1, Math.max(0, currentIdx + direction));
      const target = WARP_LEVELS[nextIdx];
      const applied = await setTimeWarp(target);
      setTimeWarpX(applied);
    },
    [timeWarpX]
  );

  const decreaseTimeWarp = useCallback(async () => {
    await changeTimeWarp(-1);
  }, [changeTimeWarp]);

  const increaseTimeWarp = useCallback(async () => {
    await changeTimeWarp(1);
  }, [changeTimeWarp]);

  useEffect(() => {
    let mounted = true;
    let reconnectTimer: number | null = null;

    const initialLoad = async () => {
      try {
        const data = await fetchSnapshot();
        if (!mounted) return;
        ingestSnapshot(data);
        setStatus("degraded");
      } catch {
        if (mounted) setStatus("degraded");
      }
    };

    initialLoad();

    const connectWebSocket = () => {
      if (!mounted) return;
      const ws = createOrbitSocket((data) => {
        if (!mounted) return;
        setStatus("live");
        ingestSnapshot(data);
      });

      ws.onopen = () => {
        if (mounted) setStatus("live");
      };

      ws.onclose = () => {
        if (!mounted) return;
        setStatus("degraded");
        reconnectTimer = window.setTimeout(connectWebSocket, 500);
      };

      ws.onerror = () => {
        if (!mounted) return;
        setStatus("error");
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    const poll = window.setInterval(async () => {
      if (statusRef.current === "live") return;
      try {
        const data = await fetchSnapshot();
        if (!mounted) return;
        ingestSnapshot(data);
        setStatus("degraded");
      } catch {
        if (mounted && (statusRef.current as string) !== "live") setStatus("disconnected");
      }
    }, 400);

    return () => {
      mounted = false;
      window.clearInterval(poll);
       if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      wsRef.current?.close();
    };
  }, [ingestSnapshot]);

  const value = useMemo<SnapshotContextType>(
    () => ({
      snapshot,
      status,
      selectedSatelliteId,
      setSelectedSatelliteId,
      tracks,
      metricsHistory,
      timeWarpX,
      decreaseTimeWarp,
      increaseTimeWarp,
    }),
    [snapshot, status, selectedSatelliteId, tracks, metricsHistory, timeWarpX, decreaseTimeWarp, increaseTimeWarp]
  );

  return <SnapshotContext.Provider value={value}>{children}</SnapshotContext.Provider>;
}

export function useSnapshotContext() {
  const ctx = useContext(SnapshotContext);
  if (!ctx) {
    throw new Error("useSnapshotContext must be used within SnapshotProvider");
  }
  return ctx;
}
