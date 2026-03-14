"use client";

import { SnapshotProvider } from "@/components/SnapshotProvider";

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return <SnapshotProvider>{children}</SnapshotProvider>;
}
