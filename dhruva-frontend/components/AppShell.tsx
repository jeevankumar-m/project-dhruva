"use client";

import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { useSnapshotContext } from "@/components/SnapshotProvider";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { snapshot, status, timeWarpX, decreaseTimeWarp, increaseTimeWarp } = useSnapshotContext();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
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
      <div className="flex h-[calc(100vh-3rem)]">
        <Sidebar />
        <main className="flex-1 p-2 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
