export type RiskLevel = "SAFE" | "WARNING" | "CRITICAL";

export interface SatelliteSnapshot {
  id: string;
  lat: number;
  lon: number;
  altitude_km: number;
  fuel_kg: number;
  planned_fuel_kg?: number;
  planned_mass_kg?: number;
  status: "NOMINAL" | "OUT_OF_BOX" | "GRAVEYARD" | string;
  drift_km: number;
  in_graveyard_orbit?: boolean;
  graveyard_entry_time?: string | null;
  nominal: {
    lat: number;
    lon: number;
    altitude_km: number;
  };
  eci?: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
  };
}

export type DebrisTuple = [id: string, lat: number, lon: number, altitude_km: number];

export interface ConjunctionItem {
  satellite_id: string;
  debris_id: string;
  tca_seconds: number;
  miss_distance_km: number;
  relative_angle_deg: number;
  risk_level: RiskLevel;
}

export interface ManeuverItem {
  burn_id: string;
  satellite_id: string;
  burn_time: string;
  delta_v_kmps: {
    x: number;
    y: number;
    z: number;
  };
  executed: boolean;
  rejected: boolean;
  blackout_overlap: boolean;
  conflict: boolean;
}

export interface SnapshotPayload {
  timestamp: string;
  satellites: SatelliteSnapshot[];
  debris_cloud: DebrisTuple[];
  conjunctions: ConjunctionItem[];
  maneuvers: ManeuverItem[];
  ground_stations?: GroundStationSnapshot[];
  burn_logs?: BurnLogEntry[];
  blackout_status?: BlackoutStatusItem[];
  counts?: {
    satellites: number;
    debris: number;
    conjunction_warnings: number;
    graveyard?: number;
  };
  metrics: {
    fleet_fuel_pct: number;
    fleet_fuel_planned_pct?: number;
    collisions_avoided: number;
    total_delta_v_mps: number;
    uptime_pct?: number;
    uptime_score?: number;
    outage_sat_seconds?: number;
    avoidance_per_delta_v?: number;
    time_warp_x?: number;
  };
}

export interface GroundStationSnapshot {
  id: string;
  name: string;
  lat: number;
  lon: number;
  min_elevation_deg: number;
}

export interface TrackPoint {
  lat: number;
  lon: number;
  timestamp: number;
}

export interface BurnLogEntry {
  burn_id: string;
  satellite_id: string;
  burn_time: string;
  delta_v_mps: number;
  executed: boolean;
  rejected: boolean;
}

export interface BlackoutStatusItem {
  satellite_id: string;
  in_blackout: boolean;
  estimated_recovery_seconds: number | null;
  estimated_recovery_timestamp: string | null;
  lat: number;
  lon: number;
}
