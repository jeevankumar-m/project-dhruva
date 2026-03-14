"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";

import Earth from "@/components/Earth";
import { ConjunctionItem, DebrisTuple, SatelliteSnapshot } from "@/lib/types";

const MU = 398600.4418;
const EARTH_R_KM = 6378.137;
const SCENE_SCALE = 6.371 / EARTH_R_KM;

interface OrbitTracker3DProps {
  satellites: SatelliteSnapshot[];
  selectedSatelliteId: string | null;
  onSelectSatellite: (id: string) => void;
  timestamp: string;
  debrisCloud: DebrisTuple[];
  conjunctions: ConjunctionItem[];
}

function latLonToCartesian(lat: number, lon: number, radius: number): [number, number, number] {
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  return [
    radius * Math.cos(latRad) * Math.cos(lonRad),
    radius * Math.sin(latRad),
    radius * Math.cos(latRad) * Math.sin(lonRad),
  ];
}

function cross(a: number[], b: number[]): number[] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function mag(v: number[]): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function julianDate(date: Date): number {
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth() + 1;
  const day =
    date.getUTCDate() +
    (date.getUTCHours() + (date.getUTCMinutes() + (date.getUTCSeconds() + date.getUTCMilliseconds() / 1000) / 60) / 60) / 24;
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}

function gmstRadians(timestamp: string): number {
  const jd = julianDate(new Date(timestamp));
  const t = (jd - 2451545.0) / 36525.0;
  const gmstDeg = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t * t - (t * t * t) / 38710000.0;
  return ((gmstDeg % 360) * Math.PI) / 180;
}

function computeOrbitEllipse(
  eci: { x: number; y: number; z: number; vx: number; vy: number; vz: number },
  timestamp: string,
  numPoints: number = 300,
): [number, number, number][] {
  const r = [eci.x, eci.y, eci.z];
  const v = [eci.vx, eci.vy, eci.vz];
  const rMag = mag(r);
  const vSq = v[0] * v[0] + v[1] * v[1] + v[2] * v[2];

  const energy = vSq / 2 - MU / rMag;
  if (energy >= 0) return [];
  const a = -MU / (2 * energy);

  const h = cross(r, v);
  const hMag = mag(h);
  if (hMag < 1e-10) return [];

  const rdotv = r[0] * v[0] + r[1] * v[1] + r[2] * v[2];
  const eVec = [
    (vSq / MU - 1 / rMag) * r[0] - (rdotv / MU) * v[0],
    (vSq / MU - 1 / rMag) * r[1] - (rdotv / MU) * v[1],
    (vSq / MU - 1 / rMag) * r[2] - (rdotv / MU) * v[2],
  ];
  const e = mag(eVec);

  let P: number[];
  if (e > 1e-8) {
    P = eVec.map((x) => x / e);
  } else {
    P = r.map((x) => x / rMag);
  }

  const hHat = h.map((x) => x / hMag);
  const Q = cross(hHat, P);

  const gmst = gmstRadians(timestamp);
  const cosG = Math.cos(gmst);
  const sinG = Math.sin(gmst);

  const p = a * (1 - e * e);
  const points: [number, number, number][] = [];

  for (let i = 0; i <= numPoints; i++) {
    const theta = (2 * Math.PI * i) / numPoints;
    const radius = p / (1 + e * Math.cos(theta));
    const xPeri = radius * Math.cos(theta);
    const yPeri = radius * Math.sin(theta);

    const xECI = xPeri * P[0] + yPeri * Q[0];
    const yECI = xPeri * P[1] + yPeri * Q[1];
    const zECI = xPeri * P[2] + yPeri * Q[2];

    const xECEF = xECI * cosG + yECI * sinG;
    const yECEF = -xECI * sinG + yECI * cosG;
    const zECEF = zECI;

    points.push([xECEF * SCENE_SCALE, zECEF * SCENE_SCALE, yECEF * SCENE_SCALE]);
  }

  return points;
}

function SatelliteMesh({
  sat,
  isSelected,
  onSelect,
}: {
  sat: SatelliteSnapshot;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const targetPos = useRef(new THREE.Vector3());

  useEffect(() => {
    const altitudeScale = 6.371 + Math.max(0.15, sat.altitude_km / 1000);
    const [x, y, z] = latLonToCartesian(sat.lat, sat.lon, altitudeScale);
    targetPos.current.set(x, y, z);

    if (meshRef.current && meshRef.current.position.lengthSq() === 0) {
      meshRef.current.position.copy(targetPos.current);
    }
  }, [sat.lat, sat.lon, sat.altitude_km]);

  useFrame(() => {
    if (!meshRef.current) return;
    meshRef.current.position.lerp(targetPos.current, 0.08);
  });

  return (
    <mesh ref={meshRef} onClick={onSelect}>
      <sphereGeometry args={[isSelected ? 0.18 : 0.12, 16, 16]} />
      <meshStandardMaterial
        color={isSelected ? "#22c55e" : "#60a5fa"}
        emissive={isSelected ? "#14532d" : "#1e3a8a"}
        emissiveIntensity={0.6}
      />
    </mesh>
  );
}

function AnalyticalOrbitRing({
  selectedSatelliteId,
  satellites,
  timestamp,
}: {
  selectedSatelliteId: string | null;
  satellites: SatelliteSnapshot[];
  timestamp: string;
}) {
  const orbitPoints = useMemo(() => {
    if (!selectedSatelliteId) return [];
    const sat = satellites.find((s) => s.id === selectedSatelliteId);
    if (!sat?.eci) return [];
    return computeOrbitEllipse(sat.eci, timestamp, 300);
  }, [selectedSatelliteId, satellites, timestamp]);

  if (orbitPoints.length < 2) return null;

  return <Line points={orbitPoints} color="#22d3ee" lineWidth={1.5} transparent opacity={0.8} />;
}

function DebrisDots({
  debrisCloud,
  warningIds,
}: {
  debrisCloud: DebrisTuple[];
  warningIds: Set<string>;
}) {
  const meshes = useMemo(() => {
    return debrisCloud.map((deb) => {
      const [id, lat, lon, altKm] = deb;
      const r = 6.371 + Math.max(0.1, altKm / 1000);
      const pos = latLonToCartesian(lat, lon, r);
      const isWarn = warningIds.has(id);
      return { id, pos, isWarn };
    });
  }, [debrisCloud, warningIds]);

  return (
    <>
      {meshes.map((d) => (
        <mesh key={d.id} position={d.pos}>
          <sphereGeometry args={[d.isWarn ? 0.12 : 0.07, 8, 8]} />
          <meshStandardMaterial
            color={d.isWarn ? "#ef4444" : "#f87171"}
            emissive={d.isWarn ? "#7f1d1d" : "#450a0a"}
            emissiveIntensity={d.isWarn ? 1.0 : 0.3}
            transparent={!d.isWarn}
            opacity={d.isWarn ? 1.0 : 0.6}
          />
        </mesh>
      ))}
    </>
  );
}

export default function OrbitTracker3D({
  satellites,
  selectedSatelliteId,
  onSelectSatellite,
  timestamp,
  debrisCloud,
  conjunctions,
}: OrbitTracker3DProps) {
  const warningIds = useMemo(
    () =>
      new Set(
        conjunctions
          .filter((c) => c.risk_level === "CRITICAL" || c.risk_level === "WARNING")
          .map((c) => c.debris_id),
      ),
    [conjunctions],
  );

  return (
    <div className="h-full border border-slate-800 bg-slate-950 overflow-hidden">
      <div className="absolute z-10 mt-3 ml-3 text-xs text-slate-200">
        Worldwide Perspective - 3D Orbit Tracker
      </div>
      <Canvas camera={{ position: [0, 0, 22], fov: 45 }}>
        <color attach="background" args={["#020617"]} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[12, 8, 10]} intensity={1.4} />

        <Earth />

        <AnalyticalOrbitRing selectedSatelliteId={selectedSatelliteId} satellites={satellites} timestamp={timestamp} />
        <DebrisDots debrisCloud={debrisCloud} warningIds={warningIds} />

        {satellites.map((sat) => (
          <SatelliteMesh
            key={sat.id}
            sat={sat}
            isSelected={sat.id === selectedSatelliteId}
            onSelect={() => onSelectSatellite(sat.id)}
          />
        ))}

        <OrbitControls enablePan={false} minDistance={10} maxDistance={40} />
      </Canvas>
    </div>
  );
}
