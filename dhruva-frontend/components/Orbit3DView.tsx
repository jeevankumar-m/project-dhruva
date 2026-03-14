"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import Earth from "./Earth";

type Vec2 = { x: number; y: number };

type Conjunction = {
  tca_seconds: number;
  miss_distance_km: number;
  satellite: [number, number];
  debris: [number, number];
} | null;

interface Props {
  sat: Vec2;
  deb: Vec2;
  satTrail: Vec2[];
  debTrail: Vec2[];
  conjunction?: Conjunction;
  showEncounter?: boolean;
}

const SCALE = 1 / 1000; // km -> scene units

export default function Orbit3DView({
  sat,
  deb,
  satTrail,
  debTrail,
  conjunction,
  showEncounter,
}: Props) {
  const satPos: [number, number, number] = [sat.x * SCALE, sat.y * SCALE, 0];
  const debPos: [number, number, number] = [deb.x * SCALE, deb.y * SCALE, 0];

  const satTrackPoints: [number, number, number][] = satTrail.map((p) => [
    p.x * SCALE,
    p.y * SCALE,
    0,
  ]);
  const debTrackPoints: [number, number, number][] = debTrail.map((p) => [
    p.x * SCALE,
    p.y * SCALE,
    0,
  ]);

  const conjSatPos: [number, number, number] | null = conjunction
    ? [conjunction.satellite[0] * SCALE, conjunction.satellite[1] * SCALE, 0]
    : null;
  const conjDebPos: [number, number, number] | null = conjunction
    ? [conjunction.debris[0] * SCALE, conjunction.debris[1] * SCALE, 0]
    : null;

  return (
    <Canvas camera={{ position: [0, 0, 30], fov: 40 }}>
      <color attach="background" args={["#020617"]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[20, 20, 10]} intensity={1.6} />

      <Earth />

      {satTrackPoints.length > 1 && (
        <Line
          points={satTrackPoints}
          color="#38bdf8"
          lineWidth={2}
          dashed={false}
        />
      )}
      {debTrackPoints.length > 1 && (
        <Line
          points={debTrackPoints}
          color="#f97373"
          lineWidth={2}
          dashed={false}
        />
      )}

      <mesh position={satPos}>
        <coneGeometry args={[0.25, 0.8, 16]} />
        <meshStandardMaterial color="#22c55e" />
      </mesh>

      <mesh position={debPos}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>

      {conjSatPos && conjDebPos && (
        <>
          {/* Predicted TCA marker */}
          <mesh position={conjSatPos}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial color="#eab308" emissive="#451a03" emissiveIntensity={0.9} />
          </mesh>

          {showEncounter && (
            <>
              <Line
                points={[satPos, conjSatPos]}
                color="#fde047"
                lineWidth={3}
                dashed={false}
              />
              <Line
                points={[debPos, conjDebPos]}
                color="#f97316"
                lineWidth={3}
                dashed={true}
              />
            </>
          )}
        </>
      )}

      <OrbitControls enablePan={false} minDistance={10} maxDistance={80} />
    </Canvas>
  );
}

