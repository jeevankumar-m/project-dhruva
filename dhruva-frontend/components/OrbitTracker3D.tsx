"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from "react";
import { ConjunctionItem, DebrisTuple, SatelliteSnapshot } from "@/lib/types";

const MU = 398600.4418;

interface OrbitTracker3DProps {
  satellites: SatelliteSnapshot[];
  selectedSatelliteId: string | null;
  onSelectSatellite: (id: string) => void;
  timestamp: string;
  debrisCloud: DebrisTuple[];
  conjunctions: ConjunctionItem[];
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

function computeOrbitEllipseCesium(
  eci: { x: number; y: number; z: number; vx: number; vy: number; vz: number },
  timestamp: string,
  numPoints: number = 300,
): { x: number; y: number; z: number }[] {
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
  const points: { x: number; y: number; z: number }[] = [];

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

    points.push({ x: xECEF * 1000, y: yECEF * 1000, z: zECEF * 1000 });
  }

  return points;
}

export default function OrbitTracker3D({
  satellites,
  selectedSatelliteId,
  onSelectSatellite,
  timestamp,
  debrisCloud,
  conjunctions,
}: OrbitTracker3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const entitiesRef = useRef<{ [key: string]: any }>({});
  const posPropsRef = useRef<{ [key: string]: any }>({});
  const previousSelectedIdRef = useRef<string | null>(null);
  const lastSimTimeRef = useRef<number | null>(null);
  const [cesiumLoaded, setCesiumLoaded] = useState(false);
  const onSelectRef = useRef(onSelectSatellite);

  useEffect(() => {
    onSelectRef.current = onSelectSatellite;
  }, [onSelectSatellite]);

  useEffect(() => {
    const checkCesium = setInterval(() => {
      if (typeof window !== "undefined" && (window as any).Cesium) {
        setCesiumLoaded(true);
        clearInterval(checkCesium);
      }
    }, 100);

    return () => clearInterval(checkCesium);
  }, []);

  useEffect(() => {
    if (!cesiumLoaded || !containerRef.current) return;
    const container = containerRef.current;

    const Cesium = (window as any).Cesium;
    (window as any).CESIUM_BASE_URL = "/cesium";

    if (!viewerRef.current) {
      viewerRef.current = new Cesium.Viewer(containerRef.current, {
        shouldAnimate: true,
        selectionIndicator: true,
      });

      const viewer = viewerRef.current;
      viewer.scene.globe.enableLighting = true;
      
      const creditContainer = viewer.bottomContainer;
      if (creditContainer) creditContainer.style.display = "none";

      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click: any) => {
        const pickedObject = viewer.scene.pick(click.position);
        if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.properties) {
          const id = pickedObject.id.properties.id?.getValue();
          if (id && pickedObject.id.properties.type?.getValue() === "satellite") {
            onSelectRef.current(id);
          }
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }
    
    return () => {
      if (viewerRef.current && !container.isConnected) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [cesiumLoaded]);

  // Update entities when data changes
  useEffect(() => {
    if (!viewerRef.current || !cesiumLoaded) return;
    const Cesium = (window as any).Cesium;
    const viewer = viewerRef.current;

    // Keep Cesium clock in sync with backend simulation time and warp.
    const simDate = new Date(timestamp);
    const simTime = simDate.getTime();
    const lastSimTime = lastSimTimeRef.current;
    lastSimTimeRef.current = simTime;

    const startTime = Cesium.JulianDate.fromDate(simDate);
    viewer.clock.startTime = startTime.clone();
    viewer.clock.currentTime = startTime.clone();
    viewer.clock.shouldAnimate = true;
    viewer.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK_MULTIPLIER;
    viewer.clock.multiplier = 1.0;

    // If simulation time jumped forward a lot (e.g., time warp or fast propagation),
    // adjust the viewed timeline window so the scrubber/animation stay near "now".
    if (!lastSimTime || Math.abs(simTime - lastSimTime) > 1000) {
      const endTime = Cesium.JulianDate.addSeconds(startTime, 3600, new Cesium.JulianDate());
      viewer.clock.stopTime = endTime.clone();
      viewer.clockViewModel && (viewer.clockViewModel.currentTime = viewer.clock.currentTime);
    }

    const activeIds = new Set<string>();

    const warningIds = new Set(
      conjunctions
        .filter((c) => c.risk_level === "CRITICAL" || c.risk_level === "WARNING")
        .map((c) => c.debris_id)
    );

    // Render Satellites
    const clockTime = viewer.clock.currentTime.clone();
    satellites.forEach((sat) => {
      const entityId = `sat_${sat.id}`;
      activeIds.add(entityId);

      const isSelected = selectedSatelliteId === sat.id;
      const color = isSelected ? Cesium.Color.fromCssColorString("#22c55e") : Cesium.Color.fromCssColorString("#60a5fa");
      const pos = Cesium.Cartesian3.fromDegrees(sat.lon, sat.lat, sat.altitude_km * 1000);

      // Ensure we have a SampledPositionProperty for this entity
      if (!posPropsRef.current[entityId]) {
        const sampled = new Cesium.SampledPositionProperty();
        sampled.setInterpolationOptions({
          interpolationDegree: 1,
          interpolationAlgorithm: Cesium.LinearApproximation,
        });
        sampled.forwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
        sampled.backwardExtrapolationType = Cesium.ExtrapolationType.HOLD;
        posPropsRef.current[entityId] = sampled;
      }
      // Add the latest position sample at viewer's current clock time
      posPropsRef.current[entityId].addSample(clockTime, pos);

      if (entitiesRef.current[entityId]) {
        const entity = entitiesRef.current[entityId];
        if (entity.billboard) {
          entity.billboard.color = color;
          entity.billboard.scale = isSelected ? 2.5 : 1.5;
        }
        
        // Handle analytical orbit ring if selected
        if (isSelected && sat.eci) {
          const points = computeOrbitEllipseCesium(sat.eci, timestamp, 300);
          if (points.length > 0) {
            const positions = points.map((p) => new Cesium.Cartesian3(p.x, p.y, p.z));
            if (!entity.polyline) {
              entity.polyline = new Cesium.PolylineGraphics({
                positions: positions,
                width: 2,
                material: Cesium.Color.fromCssColorString("#22d3ee").withAlpha(0.6),
              });
            } else {
              entity.polyline.positions = positions;
            }
          }
        } else {
          if (entity.polyline) {
             entity.polyline = undefined;
          }
        }
      } else {
        const entity = viewer.entities.add({
          id: entityId,
          position: posPropsRef.current[entityId],
          billboard: {
            image: "/satellite.png",
            scale: isSelected ? 2.5 : 1.5,
            color: color,
          },
          label: {
            text: sat.id,
            font: "10px sans-serif",
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -20),
            fillColor: Cesium.Color.WHITE,
            showBackground: false,
            show: false,
          },
          properties: {
            id: sat.id,
            type: "satellite",
          },
        });
        
        if (isSelected && sat.eci) {
          const points = computeOrbitEllipseCesium(sat.eci, timestamp, 300);
          if (points.length > 0) {
            entity.polyline = new Cesium.PolylineGraphics({
              positions: points.map((p) => new Cesium.Cartesian3(p.x, p.y, p.z)),
              width: 2,
              material: Cesium.Color.fromCssColorString("#22d3ee").withAlpha(0.6),
            });
          }
        }

        entitiesRef.current[entityId] = entity;
      }
    });

    // Render Debris
    debrisCloud.forEach((deb) => {
      const [id, lat, lon, altKm] = deb;
      const entityId = `deb_${id}`;
      activeIds.add(entityId);

      const isWarn = warningIds.has(id);
      const color = isWarn ? Cesium.Color.fromCssColorString("#ef4444") : Cesium.Color.fromCssColorString("#f87171").withAlpha(0.6);
      const pixelSize = isWarn ? 8 : 4;
      const outlineWidth = isWarn ? 1 : 0;

      if (entitiesRef.current[entityId]) {
        const entity = entitiesRef.current[entityId];
        entity.position = Cesium.Cartesian3.fromDegrees(lon, lat, altKm * 1000);
        entity.point.color = color;
        entity.point.pixelSize = pixelSize;
        entity.point.outlineWidth = outlineWidth;
      } else {
        const entity = viewer.entities.add({
          id: entityId,
          position: Cesium.Cartesian3.fromDegrees(lon, lat, altKm * 1000),
          point: {
            pixelSize: pixelSize,
            color: color,
            outlineColor: isWarn ? Cesium.Color.WHITE : Cesium.Color.TRANSPARENT,
            outlineWidth: outlineWidth,
          },
          properties: {
            id: id,
            type: "debris",
          },
        });
        entitiesRef.current[entityId] = entity;
      }
    });

    // Remove old entities
    Object.keys(entitiesRef.current).forEach((key) => {
      if (!activeIds.has(key)) {
        viewer.entities.remove(entitiesRef.current[key]);
        delete entitiesRef.current[key];
      }
    });

    // Synchronize selection & tracking only when selection actually changes
    if (selectedSatelliteId !== previousSelectedIdRef.current) {
      if (selectedSatelliteId && entitiesRef.current[`sat_${selectedSatelliteId}`]) {
        const selectedEnt = entitiesRef.current[`sat_${selectedSatelliteId}`];
        viewer.trackedEntity = undefined;
        viewer.selectedEntity = selectedEnt;
        viewer.flyTo(selectedEnt, {
            offset: new Cesium.HeadingPitchRange(0, -Cesium.Math.PI_OVER_FOUR, 8000000),
            duration: 1.5,
        }).then(() => {
            if (previousSelectedIdRef.current === selectedSatelliteId) {
                viewer.trackedEntity = selectedEnt;
            }
        });
      } else if (!selectedSatelliteId) {
        viewer.selectedEntity = undefined;
        viewer.trackedEntity = undefined;
      }
      previousSelectedIdRef.current = selectedSatelliteId;
    }

  }, [satellites, selectedSatelliteId, debrisCloud, conjunctions, timestamp, cesiumLoaded]);

  return (
    <div className="h-full border border-slate-800 bg-slate-950 overflow-hidden relative">
      <div className="absolute z-10 top-3 left-3 text-xs text-slate-200 bg-black/50 p-1 rounded">
        Worldwide Perspective - 3D Orbit Tracker (Cesium)
      </div>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
