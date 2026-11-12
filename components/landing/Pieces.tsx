"use client";
// The pictures on the landing page. Every frame of video in them is drawn by zoomies' own code
// (lib/render.ts: the camera and the frame; lib/record.ts: the made-up dashboard recording), so what the
// page shows is what the app makes. The rest is the editor's own layout, drawn as a still picture.
import { useEffect, useRef, useState } from "react";
import { BACKGROUNDS, buildCamera, camAt, drawFrame, DEFAULT_STYLE, type Zoom } from "@/lib/render";
import { drawExampleScene, EXAMPLE_DURATION } from "@/lib/record";

const SRC_W = 1280, SRC_H = 800;
// the two zooms zoomies finds in the example recording (its own detector lands them here)
const ZOOMS: Zoom[] = [
  { id: "a", start: 0.5, end: 3.9, x: 0.34, y: 0.15, scale: 2.1 },
  { id: "b", start: 5.0, end: 7.0, x: 0.86, y: 0.83, scale: 2.2 },
];
const LOOP = EXAMPLE_DURATION + 0.8;
const isDark = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;

function source(t: number, dark: boolean) {
  const c = document.createElement("canvas");
  c.width = SRC_W; c.height = SRC_H;
  drawExampleScene(c.getContext("2d")!, SRC_W, SRC_H, t, dark);
  return c;
}

const PAUSE_SVG = (
  <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4.25" y="3.25" width="2.75" height="9.5" rx="0.9" /><rect x="9" y="3.25" width="2.75" height="9.5" rx="0.9" /></svg>
);
const PLAY_SVG = (
  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.25 3.7v8.6c0 .62.68 1 1.2.66l6.5-4.3c.47-.31.47-1 0-1.32l-6.5-4.3c-.52-.34-1.2.04-1.2.66Z" /></svg>
);

/** The hero: the window of the preview, playing the example recording through zoomies' camera. The switch in
 *  its bar shows the flat recording; the disc pauses it. Reduced motion: one zoomed frame, held. */
export function HeroWindow() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [after, setAfter] = useState(true);
  const [running, setRunning] = useState(true);
  const state = useRef({ after: true, running: true, t: 2.4 });
  state.current.after = after;
  state.current.running = running;

  useEffect(() => {
    const c = ref.current!;
    const g = c.getContext("2d", { alpha: false })!;
    const src = document.createElement("canvas");
    src.width = SRC_W; src.height = SRC_H;
    const sg = src.getContext("2d")!;
    const track = buildCamera(ZOOMS, LOOP, 1);
    const style = { ...DEFAULT_STYLE, padding: 0.07 };
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dark = isDark();
    const flat = { ...DEFAULT_STYLE, bg: "solid", solid: dark ? "#0c0c0b" : "#e4e1da", padding: 0, radius: 0, shadow: 0 };
    let last = performance.now(), raf = 0;
    const draw = () => {
      const t = state.current.t;
      drawExampleScene(sg, SRC_W, SRC_H, Math.min(t, EXAMPLE_DURATION), dark);
      if (state.current.after) drawFrame(g, c.width, c.height, src, SRC_W, SRC_H, style, camAt(track, t));
      else drawFrame(g, c.width, c.height, src, SRC_W, SRC_H, flat, { x: 0.5, y: 0.5, s: 1 });
    };
    const tick = (now: number) => {
      if (state.current.running && !reduce) state.current.t = (state.current.t + (now - last) / 1000) % LOOP;
      last = now;
      draw();
      raf = requestAnimationFrame(tick);
    };
    if (reduce) { setRunning(false); state.current.t = 2.4; }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <div className="ly-piece zw">
        <div className="zw__bar">
          <span className="zw__dots" aria-hidden="true"><i /><i /><i /></span>
          <span className="zw__title">dashboard-demo.webm</span>
          <span className="zw__switch" role="group" aria-label="Show the recording">
            <button type="button" aria-pressed={!after} onClick={() => setAfter(false)}>As recorded</button>
            <button type="button" aria-pressed={after} onClick={() => setAfter(true)}>With zooms</button>
          </span>
        </div>
        <canvas
          ref={ref}
          width={1280}
          height={720}
          className="zw__canvas"
          role="img"
          aria-label="A screen recording of a dashboard. The view glides in on the search box while someone types, then on the Export button they click, framed on an orange gradient."
        />
      </div>
      <button
        type="button"
        className={`ui-pause loop-pause ${running ? "" : "is-paused"}`}
        aria-label={running ? "Pause animation" : "Play animation"}
        title={running ? "Pause animation" : "Play animation"}
        onClick={() => setRunning((r) => !r)}
      >
        {running ? PAUSE_SVG : PLAY_SVG}
      </button>
    </>
  );
}

/** One still frame of the example through zoomies' camera at time t, drawn once. */
function StillFrame({ t, className, width = 1280, height = 720 }: { t: number; className?: string; width?: number; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const g = c.getContext("2d", { alpha: false })!;
    const track = buildCamera(ZOOMS, LOOP, 1);
    drawFrame(g, c.width, c.height, source(t, isDark()), SRC_W, SRC_H, { ...DEFAULT_STYLE, padding: 0.07 }, camAt(track, t));
  }, [t]);
  return <canvas ref={ref} width={width} height={height} className={className} aria-hidden="true" />;
}

const pct = (v: number) => `${(v / EXAMPLE_DURATION) * 100}%`;

/** #editor: the editor as the app lays it out: the preview, its play bar and the zoom timeline, then the panel. */
export function EditorFrame() {
  const T = 2.6;
  return (
    <div className="ui app fill ze" role="img" aria-label="The zoomies editor: the preview zoomed in on a search box, a timeline with two zoom blocks, and the panel with the zoom level, nine backgrounds and the 16:9, 1:1 and 9:16 shapes.">
      <div className="app__pane ze__main">
        <div className="ze__name">dashboard-demo</div>
        <div className="ze__stage"><StillFrame t={T} className="ze__canvas" /></div>
        <div className="ze__transport">
          <span className="ze__play" />
          <span className="ze__time">0:02 / 0:07</span>
          <span className="ze__hint">Click the preview to aim a zoom</span>
        </div>
        <div className="ze__timeline">
          <div className="ze__ticks">{[0, 2, 4, 6].map((s) => <span key={s} style={{ left: pct(s) }}>{s}s</span>)}</div>
          <div className="ze__track">
            {ZOOMS.map((z, i) => (
              <span key={z.id} className={`ze__block${i === 0 ? " is-on" : ""}`} style={{ left: pct(z.start), width: pct(z.end - z.start) }}>
                <i className="ze__h ze__h--a" />{z.scale.toFixed(1)}×<i className="ze__h ze__h--b" />
              </span>
            ))}
            <span className="ze__head" style={{ left: pct(T) }} />
          </div>
        </div>
      </div>
      <div className="app__pane ze__panel">
        <div className="ze__group">
          <div className="ze__h3"><b>Zoom 1</b><span>0.5 s to 3.9 s</span></div>
          <div className="ze__slider"><span>Level</span><i style={{ "--v": "62%" } as React.CSSProperties} /><em>2.1×</em></div>
          <div className="ze__row"><span className="ze__btn">Aim</span><span className="ze__btn ze__btn--danger">Delete</span></div>
        </div>
        <div className="ze__group">
          <div className="ze__h3"><b>Background</b></div>
          <div className="ze__swatches">
            {BACKGROUNDS.map((b, i) => (
              <span key={b.id} className={i === 0 ? "is-on" : ""} style={{ background: `linear-gradient(${b.angle}deg, ${b.stops[0]}, ${b.stops[1]})` }} />
            ))}
          </div>
        </div>
        <div className="ze__group">
          <div className="ze__h3"><b>Shape</b></div>
          <div className="ze__seg"><span className="is-on">16:9</span><span>1:1</span><span>9:16</span><span>Original</span></div>
          <div className="ze__slider"><span>Padding</span><i style={{ "--v": "40%" } as React.CSSProperties} /><em>8%</em></div>
          <div className="ze__slider"><span>Corners</span><i style={{ "--v": "45%" } as React.CSSProperties} /><em>18</em></div>
          <div className="ze__slider"><span>Shadow</span><i style={{ "--v": "60%" } as React.CSSProperties} /><em>60%</em></div>
        </div>
        <div className="ze__group">
          <div className="ze__h3"><b>All zooms</b></div>
          <div className="ze__slider"><span>Strength</span><i style={{ "--v": "50%" } as React.CSSProperties} /><em>100%</em></div>
          <span className="ze__btn ze__btn--primary">Export MP4</span>
        </div>
      </div>
    </div>
  );
}

/** Card 1: the record card from the app's first screen. */
export function RecordFragment() {
  return (
    <div className="ui zf" role="img" aria-label="The record card: Record your screen, Also record my microphone switched on, and Start recording.">
      <b className="zf__title">Record your screen</b>
      <span className="zf__muted">A screen, a window or a tab, from the browser&apos;s picker.</span>
      <span className="zf__switch"><i className="is-on" />Also record my microphone</span>
      <span className="zf__btn zf__btn--primary"><i className="zf__rec" />Start recording</span>
    </div>
  );
}

/** Card 2: a QuickTime file dropped in, zoomies reading it. */
export function DropFragment() {
  return (
    <div className="ui zf" role="img" aria-label="A QuickTime file, standup-demo.mov, dropped in and being read: Finding where things happen, 62 percent.">
      <span className="zf__drop">Drop a video · MP4, MOV or WebM</span>
      <span className="zf__file">
        <i className="zf__thumb" />
        <span><b>standup-demo.mov</b><small>QuickTime · 1920×1080 · 0:48</small></span>
      </span>
      <span className="zf__muted">Finding where things happen</span>
      <span className="zf__bar"><i style={{ width: "62%" }} /></span>
    </div>
  );
}

/** Card 3: the background and shape picker, with the frame it makes. */
export function FrameFragment() {
  return (
    <div className="ui zf" role="img" aria-label="Nine background swatches and the 16:9, 1:1 and 9:16 shapes, with 9:16 picked.">
      <span className="zf__swatches">
        {BACKGROUNDS.map((b, i) => (
          <i key={b.id} className={i === 4 ? "is-on" : ""} style={{ background: `linear-gradient(${b.angle}deg, ${b.stops[0]}, ${b.stops[1]})` }} />
        ))}
      </span>
      <span className="zf__seg"><span>16:9</span><span>1:1</span><span className="is-on">9:16</span></span>
      <span className="zf__shapes">
        <i className="zf__shape zf__shape--w" />
        <i className="zf__shape zf__shape--s" />
        <i className="zf__shape zf__shape--t is-on" />
      </span>
    </div>
  );
}

/** Card 4: the export sheet, encoding. */
export function ExportFragment() {
  return (
    <div className="ui zf" role="img" aria-label="The Export MP4 sheet at 1080p and 60 fps, encoding at 84 percent.">
      <b className="zf__title">Export MP4</b>
      <span className="zf__seg"><span className="is-on">1080p</span><span>720p</span></span>
      <span className="zf__seg"><span>30 fps</span><span className="is-on">60 fps</span></span>
      <span className="zf__muted">Encoding · 1920×1080 · H.264 + AAC</span>
      <span className="zf__bar"><i style={{ width: "84%" }} /></span>
    </div>
  );
}

/** #how: the example recording while someone types, with the cells that changed since the last sample (a
 *  quarter second earlier) marked on zoomies' own 192-wide grid, and the zoom it makes drawn round them. */
export function DiffView() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const g = c.getContext("2d")!;
    const dark = isDark();
    const t = 2.4;
    const now = source(t, dark), before = source(t - 0.25, dark);
    const SW = 192, SH = 120;
    const small = (s: HTMLCanvasElement) => {
      const k = document.createElement("canvas"); k.width = SW; k.height = SH;
      const kg = k.getContext("2d", { willReadFrequently: true })!; kg.drawImage(s, 0, 0, SW, SH);
      return kg.getImageData(0, 0, SW, SH).data;
    };
    const a = small(now), b = small(before);
    g.drawImage(now, 0, 0, c.width, c.height);
    g.fillStyle = dark ? "rgba(0,0,0,.45)" : "rgba(255,255,255,.55)";
    g.fillRect(0, 0, c.width, c.height);
    const cw = c.width / SW, ch = c.height / SH;
    let minX = SW, minY = SH, maxX = -1, maxY = -1;
    g.fillStyle = "#e8501a";
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      const i = (y * SW + x) * 4;
      const la = (a[i] * 3 + a[i + 1] * 6 + a[i + 2]) / 10, lb = (b[i] * 3 + b[i + 1] * 6 + b[i + 2]) / 10;
      if (Math.abs(la - lb) > 18) {
        g.fillRect(x * cw, y * ch, cw - 1, ch - 1);
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
    // the zoom: a 2.1x view centred on the first zoom's point
    const z = ZOOMS[0], vw = c.width / z.scale, vh = c.height / z.scale;
    const zx = Math.max(0, Math.min(c.width - vw, z.x * c.width - vw / 2)), zy = Math.max(0, Math.min(c.height - vh, z.y * c.height - vh / 2));
    g.strokeStyle = dark ? "#efede7" : "#16150f"; g.lineWidth = 3; g.setLineDash([12, 8]);
    g.strokeRect(zx, zy, vw, vh); g.setLineDash([]);
    g.fillStyle = dark ? "#efede7" : "#16150f";
    const label = "Zoom 1 · 2.1×";
    g.font = "500 24px Geist, system-ui, sans-serif";
    const w = g.measureText(label).width + 24;
    g.fillRect(zx, zy + vh + 8, w, 40);
    g.fillStyle = dark ? "#111110" : "#f4f2ee"; g.textBaseline = "middle"; g.fillText(label, zx + 12, zy + vh + 28);
  }, []);
  return (
    <canvas
      ref={ref}
      width={1280}
      height={800}
      className="zd"
      role="img"
      aria-label="The dashboard recording mid-typing, with the small cells that changed around the search box marked in orange and a dashed box for the zoom zoomies makes there."
    />
  );
}

/** #questions: the editor's "Write the post" panel, the one part of zoomies that uses AI (through publik). */
export function PostFragment() {
  return (
    <div className="ui zf zf--post" role="img" aria-label="The editor's Write the post panel: one line about the demo becomes a short post, sent through publik; only the words are sent, never the video.">
      <span className="zf__h"><b>Write the post</b><small>AI · publik</small></span>
      <span className="zf__field">Search a report, then export it as CSV</span>
      <span className="zf__out">Typed a search, got the chart, exported the CSV. 7 seconds, two zooms, zero editing.</span>
      <span className="zf__muted">Only these words are sent, never your video.</span>
    </div>
  );
}
