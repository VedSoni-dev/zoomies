"use client";

import { useEffect, useRef, useState } from "react";
import { buildCamera, camAt, drawFrame, DEFAULT_STYLE, type Zoom } from "@/lib/render";
import { drawExampleScene, EXAMPLE_DURATION } from "@/lib/record";

// The landing hero: a made-up app being used, drawn live, through the exact same camera and frame code as the app.
// The switch shows the flat recording next to what zoomies makes of it.
const ZOOMS: Zoom[] = [
  { id: "a", start: 0.5, end: 3.9, x: 0.34, y: 0.15, scale: 2.1 },
  { id: "b", start: 5.0, end: 7.0, x: 0.86, y: 0.83, scale: 2.2 },
];
const LOOP = EXAMPLE_DURATION + 0.8;

export default function HeroDemo() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [after, setAfter] = useState(true);
  const afterRef = useRef(after);
  afterRef.current = after;

  useEffect(() => {
    const c = ref.current!;
    const g = c.getContext("2d", { alpha: false })!;
    const src = document.createElement("canvas");
    src.width = 1280; src.height = 800;
    const sg = src.getContext("2d")!;
    const track = buildCamera(ZOOMS, LOOP, 1);
    const style = { ...DEFAULT_STYLE, padding: 0.07 };
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dark = matchMedia("(prefers-color-scheme: dark)").matches;
    const flat = { ...DEFAULT_STYLE, bg: "solid", solid: dark ? "#0c0c0b" : "#e4e1da", padding: 0, radius: 0, shadow: 0 };
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const t = reduce ? 2.2 : ((performance.now() - t0) / 1000) % LOOP;
      drawExampleScene(sg, 1280, 800, Math.min(t, EXAMPLE_DURATION), dark);
      if (afterRef.current) drawFrame(g, c.width, c.height, src, 1280, 800, style, camAt(track, t));
      else drawFrame(g, c.width, c.height, src, 1280, 800, flat, { x: 0.5, y: 0.5, s: 1 });
      if (!reduce) raf = requestAnimationFrame(tick);
    };
    tick();
    if (reduce) { const iv = setInterval(tick, 300); return () => clearInterval(iv); }
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <figure className="hero-demo">
      <canvas ref={ref} width={1280} height={720} aria-label="A screen recording of a dashboard: the view glides in on the search box while someone types, then on the Export button they click, framed on an orange gradient." />
      <div className="hero-toggle" role="group" aria-label="Compare">
        <button aria-pressed={!after} onClick={() => setAfter(false)}>Your recording</button>
        <button aria-pressed={after} onClick={() => setAfter(true)}>After zoomies</button>
      </div>
    </figure>
  );
}
