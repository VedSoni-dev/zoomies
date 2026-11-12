"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePublik, PublikChoice } from "@/components/PublikGate";
import {
  BACKGROUNDS, DEFAULT_STYLE, buildCamera, camAt, canvasToSource, drawFrame, fixDuration, loadVideo, newId, outputSize,
  sampleActivity, zoomsFromActivity, type Aspect, type Style, type Zoom,
} from "@/lib/render";
import { canRecord, makeExampleClip, startRecording, type Recording } from "@/lib/record";
import { deleteProject, getImage, getVideo, listProjects, saveImage, saveProject, saveVideo, type Project } from "@/lib/store";
import { exportVideo, type ExportOpts } from "@/lib/export";

type View = "home" | "recording" | "working" | "edit";
const AKEY = "zoomies:anthropic-key";
const HOWTO = "zoomies:howto-hidden";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export default function Studio() {
  const [view, setView] = useState<View>("home");
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [working, setWorking] = useState({ label: "", p: 0 });
  const [error, setError] = useState<string | null>(null);
  const [mic, setMic] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const recRef = useRef<Recording | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try { setProjects(await listProjects()); } catch { setProjects([]); setError("This browser blocks local storage, so projects can't be kept. Private windows often do this."); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  // A new video (recorded, dropped or the example) becomes a project: read it, find the activity, save, open.
  const ingest = useCallback(async (blob: Blob, name: string, source: Project["source"]) => {
    setError(null);
    setView("working");
    setWorking({ label: "Reading the video", p: 0 });
    const url = URL.createObjectURL(blob);
    try {
      const v = await loadVideo(url);
      const duration = await fixDuration(v);
      if (!duration || !isFinite(duration)) throw new Error("Couldn't read how long this video is.");
      if (duration > 15 * 60) throw new Error("That video is over 15 minutes. zoomies keeps everything in this tab, so keep clips under 15 minutes.");
      setWorking({ label: "Finding where things happen", p: 0 });
      const samples = await sampleActivity(v, duration, (p) => setWorking({ label: "Finding where things happen", p }));
      const zooms = zoomsFromActivity(samples, duration);
      const id = newId();
      const p: Project = {
        id, name, created: Date.now(), updated: Date.now(), duration, w: v.videoWidth, h: v.videoHeight, zooms,
        style: { ...DEFAULT_STYLE, aspect: v.videoHeight > v.videoWidth ? "9:16" : "16:9" }, source, analyzed: true,
      };
      await saveVideo(id, blob);
      await saveProject(p);
      setProject(p);
      setVideoUrl(url);
      setView("edit");
      void refresh();
    } catch (e) {
      URL.revokeObjectURL(url);
      setError(e instanceof Error ? e.message : "Something went wrong reading that video.");
      setView("home");
    }
  }, [refresh]);

  const record = async () => {
    setError(null);
    try {
      const rec = await startRecording({ mic, onEnded: () => undefined });
      recRef.current = rec;
      setRecSecs(0);
      setView("recording");
      const t0 = Date.now();
      const iv = setInterval(() => setRecSecs((Date.now() - t0) / 1000), 250);
      const blob = await rec.done;
      clearInterval(iv);
      recRef.current = null;
      if (blob.size < 1000) { setView("home"); setError("The recording came out empty. Try again and share a screen, window or tab."); return; }
      await ingest(blob, `Recording ${new Date().toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`, "recording");
    } catch (e) {
      setView("home");
      const msg = e instanceof Error ? e.message : String(e);
      if (!/denied|abort|cancel/i.test(msg)) setError(`Couldn't start recording: ${msg}`);
    }
  };

  const onFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (!f.type.startsWith("video/") && !/\.(mp4|mov|webm|mkv|m4v)$/i.test(f.name)) { setError("That isn't a video file. Drop an MP4, MOV or WebM."); return; }
    void ingest(f, f.name.replace(/\.[^.]+$/, ""), "import");
  };

  const example = async () => {
    setView("working");
    setWorking({ label: "Recording a short example clip", p: 0 });
    try { const b = await makeExampleClip(); await ingest(b, "Example: search and export", "example"); }
    catch { setView("home"); setError("This browser couldn't make the example clip."); }
  };

  const open = async (p: Project) => {
    setError(null);
    const blob = await getVideo(p.id);
    if (!blob) { setError("This project's video is missing from this browser."); return; }
    setProject(p);
    setVideoUrl(URL.createObjectURL(blob));
    setView("edit");
  };

  const close = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setProject(null);
    setView("home");
    void refresh();
  };

  if (view === "edit" && project && videoUrl) return <Editor key={project.id} initial={project} videoUrl={videoUrl} onClose={close} />;

  return (
    <div className="zs-shell" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}>
      <TopBar />
      <main className="zs-home">
        {view === "recording" && (
          <section className="zs-recording" aria-live="polite">
            <span className="zs-dot" aria-hidden /> Recording <b className="mono">{fmt(recSecs)}</b>
            <p>Do your thing in the window you shared. Come back here, or use the browser&apos;s &ldquo;Stop sharing&rdquo;, when you&apos;re done.</p>
            <button className="btn btn-primary" onClick={() => recRef.current?.stop()}>Stop and make the video</button>
          </section>
        )}
        {view === "working" && (
          <section className="zs-recording" aria-live="polite">
            <p className="zs-working">{working.label}… <span className="mono">{Math.round(working.p * 100)}%</span></p>
            <div className="zs-bar"><i style={{ width: `${working.p * 100}%` }} /></div>
            <p className="muted">All of this happens in this tab. Your video isn&apos;t uploaded anywhere.</p>
          </section>
        )}
        {view === "home" && (
          <>
            <header className="zs-hello">
              <h1>{projects?.length ? "Your demos" : "Make your first demo"}</h1>
              <p className="muted">Record your screen, or drop a recording from any app. zoomies finds the moments where things happen and zooms in on them. Nothing leaves this tab.</p>
            </header>
            {error && <p className="zs-error" role="alert">{error}</p>}
            <div className="zs-start">
              <div className="zs-card">
                <h2>Record your screen</h2>
                <p className="muted">Pick a screen, a window or a tab in the browser&apos;s picker.</p>
                <label className="zs-check"><input type="checkbox" checked={mic} onChange={(e) => setMic(e.target.checked)} /> Also record my microphone</label>
                <button className="btn btn-primary" disabled={!canRecord()} onClick={() => void record()}>Start recording</button>
                {!canRecord() && <p className="muted small">This browser can&apos;t record the screen (phones can&apos;t). Drop a video instead, or open zoomies in Chrome, Edge or Firefox on a computer.</p>}
              </div>
              <button className="zs-card zs-drop" onClick={() => fileRef.current?.click()}>
                <h2>Drop a video</h2>
                <p className="muted">A recording from QuickTime, OBS, Game Bar, Loom or your phone. MP4, MOV or WebM.</p>
                <span className="btn">Choose a file</span>
              </button>
              <input ref={fileRef} type="file" accept="video/*,.mov,.mkv" hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
            </div>
            {projects && projects.length === 0 && (
              <ol className="zs-how">
                <li><b>1</b><span><strong>Record or drop.</strong> Click around and type like you normally would. Pause a beat on the important parts.</span></li>
                <li><b>2</b><span><strong>zoomies zooms.</strong> It reads the video and places a zoom wherever a small part of the screen changes. You can move, resize or delete each one.</span></li>
                <li><b>3</b><span><strong>Style and export.</strong> Pick a background and a shape for X, LinkedIn or Reels, then download an MP4.</span></li>
              </ol>
            )}
            {projects && projects.length > 0 && (
              <ul className="zs-projects">
                {projects.map((p) => (
                  <li key={p.id}>
                    <button className="zs-proj" onClick={() => void open(p)}>
                      <span className="zs-proj-name">{p.name}</span>
                      <span className="muted mono small">{fmt(p.duration)} · {p.zooms.length} zoom{p.zooms.length === 1 ? "" : "s"}{p.source === "example" ? " · example" : ""}</span>
                    </button>
                    <button className="icon-btn" aria-label={`Delete ${p.name}`} title="Delete" onClick={async () => { if (confirm(`Delete "${p.name}" from this browser?`)) { await deleteProject(p.id); void refresh(); } }}>×</button>
                  </li>
                ))}
              </ul>
            )}
            <p className="zs-example muted small">
              Want to see it work before recording? <button className="linkish" onClick={() => void example()}>Try it on an example clip</button> (a made-up app, labelled as an example).
            </p>
          </>
        )}
      </main>
      <Foot />
    </div>
  );
}

function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="zs-top">
      <a href="/" className="zs-logo"><Mark /> zoomies</a>
      <div className="zs-top-right">{children}</div>
    </header>
  );
}

export function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="11" y="10" width="8" height="7" rx="2" fill="var(--accent)" />
    </svg>
  );
}

function Foot() {
  return <footer className="zs-foot muted small">free &amp; open source · <a href="https://github.com/VedSoni-dev/zoomies">source</a> · not affiliated with Screen Studio</footer>;
}

// ---------------------------------------------------------------- editor
function Editor({ initial, videoUrl, onClose }: { initial: Project; videoUrl: string; onClose: () => void }) {
  const [p, setP] = useState<Project>(initial);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [bgImg, setBgImg] = useState<ImageBitmap | null>(null);
  const [showHow, setShowHow] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [redetect, setRedetect] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgInput = useRef<HTMLInputElement>(null);

  useEffect(() => { setShowHow(store.get(HOWTO) !== "1"); }, []);
  useEffect(() => {
    if (p.style.bg !== "image") return;
    void getImage(p.id).then(async (b) => b && setBgImg(await createImageBitmap(b)));
  }, [p.id, p.style.bg]);

  // save on change (debounced)
  useEffect(() => { const id = setTimeout(() => void saveProject(p), 400); return () => clearTimeout(id); }, [p]);

  const style = p.style;
  const setStyle = (s: Partial<Style>) => setP((x) => ({ ...x, style: { ...x.style, ...s } }));
  const setZooms = (fn: (z: Zoom[]) => Zoom[]) => setP((x) => ({ ...x, zooms: fn(x.zooms).sort((a, b) => a.start - b.start) }));
  const track = useMemo(() => buildCamera(p.zooms, p.duration, style.strength), [p.zooms, p.duration, style.strength]);
  const [W, H] = useMemo(() => outputSize(style, p.w, p.h, 720), [style, p.w, p.h]);

  // render loop: the same drawFrame the export uses
  useEffect(() => {
    let raf = 0;
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c) return;
    const g = c.getContext("2d", { alpha: false })!;
    const loop = () => {
      if (v.readyState >= 2) drawFrame(g, W, H, v, p.w, p.h, style, camAt(track, v.currentTime), bgImg);
      setT(v.currentTime);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [W, H, style, track, bgImg, p.w, p.h]);

  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { if (v.currentTime >= p.duration - 0.05) v.currentTime = 0; void v.play(); } else v.pause();
  }, [p.duration]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select,[contenteditable]")) return;
      if (e.code === "Space") { e.preventDefault(); toggle(); }
      if ((e.key === "Delete" || e.key === "Backspace") && sel) { setZooms((z) => z.filter((x) => x.id !== sel)); setSel(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, sel]);

  const clickPreview = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W, py = ((e.clientY - r.top) / r.height) * H;
    const pt = canvasToSource(px, py, camAt(track, t), style, W, H, p.w, p.h);
    const hit = p.zooms.find((z) => t >= z.start && t < z.end);
    if (hit) { setZooms((zs) => zs.map((z) => (z.id === hit.id ? { ...z, x: pt.x, y: pt.y } : z))); setSel(hit.id); return; }
    const next = p.zooms.find((z) => z.start > t);
    const z: Zoom = { id: newId(), start: Math.max(0, t - 0.2), end: Math.min(p.duration, next ? Math.min(next.start, t + 2.5) : t + 2.5), x: pt.x, y: pt.y, scale: 2 };
    if (z.end - z.start < 0.5) return;
    setZooms((zs) => [...zs, z]);
    setSel(z.id);
  };

  const runRedetect = async () => {
    setRedetect(0);
    try {
      const v = await loadVideo(videoUrl);
      await fixDuration(v);
      const s = await sampleActivity(v, p.duration, (x) => setRedetect(x));
      setZooms(() => zoomsFromActivity(s, p.duration));
      setSel(null);
    } finally { setRedetect(null); }
  };

  const onBgFile = async (f: File | undefined) => {
    if (!f) return;
    await saveImage(p.id, f);
    setBgImg(await createImageBitmap(f));
    setStyle({ bg: "image" });
  };

  const selected = p.zooms.find((z) => z.id === sel) ?? null;

  return (
    <div className="zs-shell zs-edit">
      <TopBar>
        <button className="btn btn-ghost" onClick={onClose}>← All demos</button>
        <button className="btn btn-primary" onClick={() => { videoRef.current?.pause(); setExporting(true); }}>Export MP4</button>
      </TopBar>
      <div className="zs-editor">
        <section className="zs-stage-col">
          <input className="zs-name" value={p.name} aria-label="Project name" onChange={(e) => setP((x) => ({ ...x, name: e.target.value }))} />
          {showHow && (
            <ol className="zs-howto">
              <li><b>1</b> {p.zooms.length ? `zoomies placed ${p.zooms.length} zoom${p.zooms.length === 1 ? "" : "s"} where your screen changed. Press play to watch.` : "No clear activity found, so there are no zooms yet. Click the preview where you want one."}</li>
              <li><b>2</b> Drag a block on the timeline to move it, its edges to resize, or click the preview to aim it or add one.</li>
              <li><b>3</b> Pick a background and a shape, then Export MP4.</li>
              <button className="icon-btn" aria-label="Hide these tips" onClick={() => { setShowHow(false); store.set(HOWTO, "1"); }}>×</button>
            </ol>
          )}
          <div className="zs-stage" style={{ aspectRatio: `${W} / ${H}` }}>
            <canvas ref={canvasRef} width={W} height={H} onClick={clickPreview} title="Click to add a zoom here, or aim the current one" />
            <video ref={videoRef} src={videoUrl} playsInline preload="auto" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} hidden />
          </div>
          <div className="zs-transport">
            <button className="btn" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>{playing ? "Pause" : "Play"}</button>
            <span className="mono small">{fmt(t)} / {fmt(p.duration)}</span>
            <span className="muted small zs-hint">Space plays · click the preview to zoom there</span>
          </div>
          <Timeline duration={p.duration} t={t} zooms={p.zooms} sel={sel} onSel={setSel}
            onSeek={(x) => { if (videoRef.current) videoRef.current.currentTime = x; }}
            onChange={(id, patch) => setZooms((zs) => zs.map((z) => (z.id === id ? { ...z, ...patch } : z)))} />
        </section>

        <aside className="zs-panel">
          {selected && (
            <div className="zs-group zs-selected">
              <h3>Selected zoom <span className="muted mono small">{fmt(selected.start)}–{fmt(selected.end)}</span></h3>
              <Slider label="Zoom" min={1.2} max={3.5} step={0.05} value={selected.scale} show={`${selected.scale.toFixed(2)}×`}
                onChange={(v) => setZooms((zs) => zs.map((z) => (z.id === selected.id ? { ...z, scale: v } : z)))} />
              <button className="btn btn-ghost danger" onClick={() => { setZooms((zs) => zs.filter((z) => z.id !== selected.id)); setSel(null); }}>Delete this zoom</button>
            </div>
          )}
          <div className="zs-group">
            <h3>Zooms</h3>
            <Slider label="Strength" min={0.6} max={1.5} step={0.05} value={style.strength} show={`${Math.round(style.strength * 100)}%`} onChange={(v) => setStyle({ strength: v })} />
            <div className="zs-row">
              <button className="btn btn-ghost" disabled={redetect !== null} onClick={() => void runRedetect()}>{redetect !== null ? `Reading… ${Math.round(redetect * 100)}%` : "Find zooms again"}</button>
              <button className="btn btn-ghost" disabled={!p.zooms.length} onClick={() => { setZooms(() => []); setSel(null); }}>Clear all</button>
            </div>
          </div>
          <div className="zs-group">
            <h3>Background</h3>
            <div className="zs-swatches">
              {BACKGROUNDS.map((b) => (
                <button key={b.id} aria-label={b.name} title={b.name} aria-pressed={style.bg === b.id} className="zs-sw"
                  style={{ background: `linear-gradient(${b.angle}deg, ${b.stops.join(",")})` }} onClick={() => setStyle({ bg: b.id })} />
              ))}
              <label className="zs-sw zs-sw-solid" title="Solid colour" aria-pressed={style.bg === "solid"} style={{ background: style.solid }}>
                <input type="color" value={style.solid} aria-label="Solid colour" onChange={(e) => setStyle({ bg: "solid", solid: e.target.value })} onClick={() => setStyle({ bg: "solid" })} />
              </label>
              <button className="zs-sw zs-sw-img" title="Your image" aria-pressed={style.bg === "image"} onClick={() => bgInput.current?.click()}>img</button>
              <input ref={bgInput} type="file" accept="image/*" hidden onChange={(e) => void onBgFile(e.target.files?.[0])} />
            </div>
          </div>
          <div className="zs-group">
            <h3>Frame</h3>
            <div className="zs-seg" role="group" aria-label="Shape">
              {(["16:9", "1:1", "9:16", "source"] as Aspect[]).map((a) => (
                <button key={a} aria-pressed={style.aspect === a} onClick={() => setStyle({ aspect: a })}>{a === "source" ? "Original" : a}</button>
              ))}
            </div>
            <Slider label="Padding" min={0} max={0.2} step={0.005} value={style.padding} show={`${Math.round(style.padding * 100)}`} onChange={(v) => setStyle({ padding: v })} />
            <Slider label="Corners" min={0} max={48} step={1} value={style.radius} show={`${style.radius}`} onChange={(v) => setStyle({ radius: v })} />
            <Slider label="Shadow" min={0} max={1} step={0.05} value={style.shadow} show={`${Math.round(style.shadow * 100)}`} onChange={(v) => setStyle({ shadow: v })} />
          </div>
          <PostWriter duration={p.duration} zooms={p.zooms.length} />
        </aside>
      </div>
      {exporting && <ExportDialog project={p} videoUrl={videoUrl} bg={bgImg} onClose={() => setExporting(false)} />}
    </div>
  );
}

function Slider({ label, min, max, step, value, show, onChange }: { label: string; min: number; max: number; step: number; value: number; show: string; onChange: (v: number) => void }) {
  return (
    <label className="zs-slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="mono small">{show}</span>
    </label>
  );
}

// ---------------------------------------------------------------- timeline
function Timeline({ duration, t, zooms, sel, onSel, onSeek, onChange }: {
  duration: number; t: number; zooms: Zoom[]; sel: string | null;
  onSel: (id: string | null) => void; onSeek: (t: number) => void; onChange: (id: string, patch: Partial<Zoom>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const toTime = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.max(0, Math.min(duration, ((clientX - r.left) / r.width) * duration));
  };
  const drag = (e: React.PointerEvent, z: Zoom, mode: "move" | "a" | "b") => {
    e.stopPropagation();
    onSel(z.id);
    const t0 = toTime(e.clientX), { start, end } = z;
    const idx = zooms.findIndex((x) => x.id === z.id);
    const lo = idx > 0 ? zooms[idx - 1].end : 0, hi = idx < zooms.length - 1 ? zooms[idx + 1].start : duration;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const d = toTime(ev.clientX) - t0;
      if (mode === "move") { const len = end - start; const s = Math.max(lo, Math.min(hi - len, start + d)); onChange(z.id, { start: r2(s), end: r2(s + len) }); }
      if (mode === "a") onChange(z.id, { start: r2(Math.max(lo, Math.min(end - 0.5, start + d))) });
      if (mode === "b") onChange(z.id, { end: r2(Math.min(hi, Math.max(start + 0.5, end + d))) });
    };
    const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };
  const stepS = duration <= 12 ? 1 : duration <= 30 ? 2 : duration <= 90 ? 5 : duration <= 300 ? 15 : 60;
  const marks = Array.from({ length: Math.floor(duration / stepS) + 1 }, (_, i) => i * stepS);
  return (
    <div className="zs-timeline">
      <div className="zs-ticks mono small" aria-hidden>
        {marks.map((m) => <span key={m} style={{ left: `${(m / duration) * 100}%` }}>{fmt(m)}</span>)}
      </div>
      <div ref={ref} className="zs-track" onPointerDown={(e) => { onSel(null); onSeek(toTime(e.clientX)); }}>
        {zooms.map((z) => (
          <div key={z.id} className={`zs-block${sel === z.id ? " on" : ""}`} style={{ left: `${(z.start / duration) * 100}%`, width: `${((z.end - z.start) / duration) * 100}%` }}
            onPointerDown={(e) => drag(e, z, "move")} role="button" tabIndex={0} aria-label={`Zoom ${z.scale.toFixed(1)}× from ${fmt(z.start)} to ${fmt(z.end)}`}
            onKeyDown={(e) => { if (e.key === "Enter") onSel(z.id); }}>
            <i className="h a" onPointerDown={(e) => drag(e, z, "a")} />
            <span className="mono">{z.scale.toFixed(1)}×</span>
            <i className="h b" onPointerDown={(e) => drag(e, z, "b")} />
          </div>
        ))}
        <div className="zs-head" style={{ left: `${(t / duration) * 100}%` }} />
      </div>
    </div>
  );
}
const r2 = (v: number) => Math.round(v * 100) / 100;

// ---------------------------------------------------------------- export
function ExportDialog({ project, videoUrl, bg, onClose }: { project: Project; videoUrl: string; bg: ImageBitmap | null; onClose: () => void }) {
  const [opts, setOpts] = useState<ExportOpts>({ height: 1080, fps: 30, withAudio: true });
  const [prog, setProg] = useState<number | null>(null);
  const [out, setOut] = useState<{ url: string; name: string; note?: string; size: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  const go = async () => {
    setErr(null); setOut(null); setProg(0);
    const c = new AbortController();
    ctrl.current = c;
    try {
      const blob = await getVideo(project.id);
      if (!blob) throw new Error("The video is missing from this browser.");
      const v = await loadVideo(videoUrl);
      await fixDuration(v);
      const r = await exportVideo(blob, v, project.duration, project.zooms, project.style, bg, opts, setProg, c.signal);
      const name = `${project.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "zoomies"}.${r.ext}`;
      setOut({ url: URL.createObjectURL(r.blob), name, note: r.note, size: r.blob.size });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setErr(e instanceof Error ? e.message : "Export failed.");
    } finally { setProg(null); }
  };

  return (
    <div className="zs-modal" role="dialog" aria-modal="true" aria-label="Export">
      <div className="zs-modal-card">
        <h2>Export</h2>
        <div className="zs-group">
          <div className="zs-seg" role="group" aria-label="Resolution">
            {([1080, 720] as const).map((h) => <button key={h} aria-pressed={opts.height === h} disabled={prog !== null} onClick={() => setOpts({ ...opts, height: h })}>{h}p</button>)}
          </div>
          <div className="zs-seg" role="group" aria-label="Frame rate">
            {([30, 60] as const).map((f) => <button key={f} aria-pressed={opts.fps === f} disabled={prog !== null} onClick={() => setOpts({ ...opts, fps: f })}>{f} fps</button>)}
          </div>
          <label className="zs-check"><input type="checkbox" checked={opts.withAudio} disabled={prog !== null} onChange={(e) => setOpts({ ...opts, withAudio: e.target.checked })} /> Keep the sound</label>
        </div>
        {prog !== null && (
          <div aria-live="polite">
            <div className="zs-bar"><i style={{ width: `${prog * 100}%` }} /></div>
            <p className="muted small">Rendering in this tab… {Math.round(prog * 100)}%. Keep this tab open.</p>
          </div>
        )}
        {err && <p className="zs-error" role="alert">{err}</p>}
        {out && (
          <div className="zs-done">
            <a className="btn btn-primary" href={out.url} download={out.name}>Download {out.name} ({(out.size / 1e6).toFixed(1)} MB)</a>
            {out.note && <p className="muted small">{out.note}</p>}
          </div>
        )}
        <div className="zs-row">
          {prog === null ? <button className="btn btn-primary" onClick={() => void go()}>{out ? "Export again" : "Export MP4"}</button>
            : <button className="btn" onClick={() => ctrl.current?.abort()}>Cancel</button>}
          <button className="btn btn-ghost" disabled={prog !== null} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- AI: the post that goes with the video
function PostWriter({ duration, zooms }: { duration: number; zooms: number }) {
  const { choice } = usePublik();
  const viaPublik = choice === "publik";
  const [about, setAbout] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ post: string; title: string } | null>(null);
  const [err, setErr] = useState<{ msg: string; top?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { setKey(store.get(AKEY) ?? ""); }, []);

  const write = async () => {
    setBusy(true); setErr(null); setCopied(false);
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (!viaPublik && key) headers["x-anthropic-key"] = key;
      const r = await fetch("/api/caption", { method: "POST", headers, body: JSON.stringify({ about, seconds: duration, zooms }) });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) setErr({ msg: b.error ?? "That didn't work.", top: b.topUpUrl });
      else setRes(b);
    } catch { setErr({ msg: "Couldn't reach the server." }); }
    finally { setBusy(false); }
  };

  return (
    <div className="zs-group">
      <h3>Write the post <span className="muted small">AI</span></h3>
      <textarea rows={3} placeholder="What does this demo show? e.g. exporting a report from our dashboard in two clicks" value={about} onChange={(e) => setAbout(e.target.value)} />
      {!viaPublik && (
        <input type="password" placeholder="Your Anthropic API key (stays in this browser)" value={key} autoComplete="off"
          onChange={(e) => { setKey(e.target.value); store.set(AKEY, e.target.value); }} />
      )}
      <button className="btn" disabled={busy || !about.trim() || (!viaPublik && !key)} onClick={() => void write()}>{busy ? "Writing…" : "Write it"}</button>
      {err && <p className="zs-error small" role="alert">{err.msg}{err.top && <> <a href={err.top} target="_blank" rel="noopener noreferrer">Top up on publik</a></>}</p>}
      {res && (
        <div className="zs-post">
          <p>{res.post}</p>
          <button className="btn btn-ghost" onClick={() => { void navigator.clipboard.writeText(res.post); setCopied(true); }}>{copied ? "Copied" : "Copy"}</button>
        </div>
      )}
      <p className="muted small">Only these words are sent, never your video.</p>
      <PublikChoice />
    </div>
  );
}
