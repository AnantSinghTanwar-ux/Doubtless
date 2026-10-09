"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  r: number;
  base: number;
  speed: number;
  phase: number;
}

interface Streak {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

/**
 * Fixed, non-interactive backdrop: faint drifting ink specks, plus one very soft streak drifting down every ~10 seconds. Pauses when the tab is hidden and is static for reduced-motion users.
 */
export default function StarField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let stars: Star[] = [];
    let streaks: Streak[] = [];
    let raf = 0;
    let last = 0;
    let nextStreak = 4000 + Math.random() * 3000;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round((w * h) / 9000);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.1 + 0.25,
        base: Math.random() * 0.45 + 0.1,
        speed: Math.random() * 0.0012 + 0.0004,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const a = s.base * (0.65 + 0.35 * Math.sin(t * s.speed + s.phase));
        ctx.fillStyle = `rgba(20,33,61,${a * 0.55})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const k of streaks) {
        const tail = 110;
        const len = Math.hypot(k.vx, k.vy);
        const tx = k.x - (k.vx / len) * tail;
        const ty = k.y - (k.vy / len) * tail;
        const alpha = 0.4 * Math.sin(Math.min(1, k.life) * Math.PI);
        const g = ctx.createLinearGradient(tx, ty, k.x, k.y);
        g.addColorStop(0, "rgba(20,33,61,0)");
        g.addColorStop(1, `rgba(20,33,61,${alpha * 0.6})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(k.x, k.y);
        ctx.stroke();
        ctx.fillStyle = `rgba(20,33,61,${alpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(k.x, k.y, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const frame = (t: number) => {
      const dt = Math.min(t - last, 64);
      last = t;
      nextStreak -= dt;
      if (nextStreak <= 0) {
        // Starlight falls down and slightly to the right.
        streaks.push({ x: Math.random() * w * 0.9, y: -20, vx: 1.6, vy: 4.2, life: 0 });
        nextStreak = 9000 + Math.random() * 3000;
      }
      for (const k of streaks) {
        k.x += (k.vx * dt) / 16;
        k.y += (k.vy * dt) / 16;
        k.life += dt / 2600;
      }
      streaks = streaks.filter((k) => k.life < 1 && k.y < h + 120);
      draw(t);
      raf = requestAnimationFrame(frame);
    };

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    resize();
    draw(0);
    if (!reduced) raf = requestAnimationFrame(frame);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />;
}
