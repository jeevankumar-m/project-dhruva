"use client";

import { useEffect, useRef } from "react";

type Vec2 = { x: number; y: number };

interface Props {
  sat: Vec2;
  deb: Vec2;
  satTrail: Vec2[];
  debTrail: Vec2[];
}

const SCALE = 1 / 40; // km -> px scaling at typical LEO radius

export default function Orbit2DView({ sat, deb, satTrail, debTrail }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height * 0.55;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, width, height);

    const baseRadius = 160 * SCALE * 100; // arbitrary normalized Earth radius

    ctx.save();
    const grd = ctx.createRadialGradient(
      cx,
      cy - baseRadius * 0.6,
      baseRadius * 0.1,
      cx,
      cy,
      baseRadius * 1.2
    );
    grd.addColorStop(0, "#1e293b");
    grd.addColorStop(1, "#020617");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius * 1.1, Math.PI, 2 * Math.PI);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius, Math.PI, 2 * Math.PI);
    ctx.stroke();

    const drawTrail = (trail: Vec2[], color: string) => {
      if (!trail.length) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      trail.forEach((p, idx) => {
        const x = cx + p.x * SCALE;
        const y = cy - p.y * SCALE;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };

    drawTrail(satTrail, "#38bdf8");
    drawTrail(debTrail, "#f97373");

    const drawBody = (p: Vec2, color: string, isSat: boolean) => {
      const x = cx + p.x * SCALE;
      const y = cy - p.y * SCALE;
      ctx.save();
      ctx.translate(x, y);
      if (isSat) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(-5, 4);
        ctx.lineTo(5, 4);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.restore();
    };

    drawBody(sat, "#22c55e", true);
    drawBody(deb, "#ef4444", false);
  }, [sat, deb, satTrail, debTrail]);

  return <canvas ref={canvasRef} width={900} height={480} className="w-full h-full" />;
}

