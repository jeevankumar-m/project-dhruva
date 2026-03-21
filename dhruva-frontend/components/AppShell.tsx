"use client";

import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { useSnapshotContext } from "@/components/SnapshotProvider";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { snapshot, status, timeWarpX, decreaseTimeWarp, increaseTimeWarp } = useSnapshotContext();

  return (
    <div className="h-dvh bg-slate-950 text-slate-100 overflow-hidden">
      <Header
        status={status}
        timestamp={snapshot?.timestamp ?? null}
        timeWarpX={timeWarpX}
        onDecreaseTimeWarp={() => {
          void decreaseTimeWarp();
        }}
        onIncreaseTimeWarp={() => {
          void increaseTimeWarp();
        }}
      />
      <div className="flex h-[calc(100dvh-3rem)] min-h-0">
        <Sidebar />
        <main className="flex-1 p-2 min-w-0 min-h-0 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
