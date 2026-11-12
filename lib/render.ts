// zoomies render core: the one draw function (preview and export share it), the camera, and the activity detector.

export type Zoom = { id: string; start: number; end: number; x: number; y: number; scale: number };
export type Aspect = "16:9" | "1:1" | "9:16" | "source";
export type Style = {
  bg: string; // preset id, or "solid", or "image"
  solid: string;
  padding: number; // 0..0.2 of the shorter side
  radius: number; // px at 1080p
  shadow: number; // 0..1
  aspect: Aspect;
  strength: number; // multiplies every zoom's scale, 0.6..1.5
};

export const DEFAULT_STYLE: Style = { bg: "tangerine", solid: "#16150f", padding: 0.08, radius: 18, shadow: 0.6, aspect: "16:9", strength: 1 };

export const BACKGROUNDS: { id: string; name: string; stops: string[]; angle: number; glow: string }[] = [
  { id: "tangerine", name: "Tangerine", stops: ["#ff6a2b", "#ffb35c"], angle: 135, glow: "#fff1c9" },
  { id: "lagoon", name: "Lagoon", stops: ["#0b5d57", "#46d3bf"], angle: 160, glow: "#c9fff4" },
  { id: "dusk", name: "Dusk", stops: ["#1d2540", "#d9714f"], angle: 120, glow: "#ffc9a8" },
  { id: "moss", name: "Moss", stops: ["#26331f", "#9fb37f"], angle: 145, glow: "#e9f5c8" },
  { id: "sky", name: "Sky", stops: ["#1d4fd8", "#8cc4ff"], angle: 135, glow: "#e6f3ff" },
  { id: "rose", name: "Rose", stops: ["#8c1035", "#ff9aa9"], angle: 135, glow: "#ffe3e8" },
  { id: "graphite", name: "Graphite", stops: ["#0c0c0d", "#3a3a40"], angle: 150, glow: "#8a8a94" },
  { id: "paper", name: "Paper", stops: ["#e9e3d6", "#cfc5b3"], angle: 135, glow: "#ffffff" },
  { id: "lime", name: "Lime", stops: ["#2e5c0e", "#d4f26a"], angle: 135, glow: "#f6ffd0" },
];

export const ASPECTS: Record<Exclude<Aspect, "source">, number> = { "16:9": 16 / 9, "1:1": 1, "9:16": 9 / 16 };

export function outputSize(style: Style, srcW: number, srcH: number, height: number): [number, number] {
  const ratio = style.aspect === "source" ? srcW / srcH : ASPECTS[style.aspect];
  // "height" is the short side for portrait, so 1080p 9:16 is 1080x1920
  let w: number, h: number;
  if (ratio >= 1) { h = height; w = Math.round(h * ratio); } else { w = height; h = Math.round(w / ratio); }
  return [w - (w % 2), h - (h % 2)];
}

const uid = () => Math.random().toString(36).slice(2, 10);
export const newId = uid;

// ---------- camera ----------
// A critically damped spring follows a target that is either a zoom block or "zoomed out".
// It is simulated once at 60 Hz over the whole clip, so preview and export land on the exact same frames.
export type Cam = { x: number; y: number; s: number };
export type CamTrack = { fps: number; xs: Float32Array; ys: Float32Array; ss: Float32Array };

const LEAD = 0.3; // start moving a little before the block so the camera arrives on time

export function buildCamera(zooms: Zoom[], duration: number, strength: number): CamTrack {
  const fps = 60;
  const n = Math.max(2, Math.ceil(duration * fps) + 2);
  const xs = new Float32Array(n), ys = new Float32Array(n), ss = new Float32Array(n);
  const sorted = [...zooms].sort((a, b) => a.start - b.start);
  const omega = 7.5; // spring stiffness: ~0.6 s to settle
  let x = 0.5, y = 0.5, s = 1, vx = 0, vy = 0, vs = 0;
  const dt = 1 / fps;
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    const active = sorted.find((z) => t >= z.start - LEAD && t < z.end - LEAD);
    const next = active ?? sorted.find((z) => z.start - LEAD > t) ?? sorted[sorted.length - 1];
    const tx = next ? next.x : 0.5, ty = next ? next.y : 0.5;
    const ts = active ? Math.max(1, 1 + (active.scale - 1) * strength) : 1;
    // critically damped spring step (semi-implicit Euler)
    const step = (p: number, v: number, target: number, w: number) => {
      const a = w * w * (target - p) - 2 * w * v;
      v += a * dt;
      return [p + v * dt, v] as const;
    };
    // while zoomed out the pan target moves freely, so it is already in place when the next zoom starts
    if (s < 1.02 && !active) { x = tx; y = ty; vx = 0; vy = 0; }
    [x, vx] = step(x, vx, tx, omega);
    [y, vy] = step(y, vy, ty, omega);
    [s, vs] = step(s, vs, ts, omega * 0.9);
    xs[i] = x; ys[i] = y; ss[i] = Math.max(1, s);
  }
  return { fps, xs, ys, ss };
}

export function camAt(track: CamTrack | null, t: number): Cam {
  if (!track) return { x: 0.5, y: 0.5, s: 1 };
  const f = Math.max(0, Math.min(track.xs.length - 1.001, t * track.fps));
  const i = Math.floor(f), k = f - i;
  const l = (a: Float32Array) => a[i] + (a[i + 1] - a[i]) * k;
  return { x: l(track.xs), y: l(track.ys), s: l(track.ss) };
}

// ---------- drawing ----------
const bgCache = new Map<string, HTMLCanvasElement>();

function background(style: Style, W: number, H: number, image: HTMLImageElement | ImageBitmap | null): HTMLCanvasElement {
  const key = `${style.bg}|${style.solid}|${W}x${H}|${image ? "img" : ""}`;
  const hit = bgCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  if (style.bg === "image" && image) {
    const iw = image.width, ih = image.height, k = Math.max(W / iw, H / ih);
    g.drawImage(image, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k);
  } else if (style.bg === "solid" || style.bg === "image") {
    g.fillStyle = style.solid; g.fillRect(0, 0, W, H);
  } else {
    const p = BACKGROUNDS.find((b) => b.id === style.bg) ?? BACKGROUNDS[0];
    const a = (p.angle * Math.PI) / 180, r = Math.hypot(W, H) / 2;
    const lin = g.createLinearGradient(W / 2 - Math.cos(a) * r, H / 2 - Math.sin(a) * r, W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r);
    p.stops.forEach((s, i) => lin.addColorStop(i / (p.stops.length - 1), s));
    g.fillStyle = lin; g.fillRect(0, 0, W, H);
    const rad = g.createRadialGradient(W * 0.78, H * 0.18, 0, W * 0.78, H * 0.18, Math.max(W, H) * 0.7);
    rad.addColorStop(0, p.glow + "66"); rad.addColorStop(1, p.glow + "00");
    g.fillStyle = rad; g.fillRect(0, 0, W, H);
    // fine grain so gradients don't band in the encoded video
    const img = g.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 6; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(img, 0, 0);
  }
  if (bgCache.size > 12) bgCache.clear();
  bgCache.set(key, c);
  return c;
}

export function frameRect(style: Style, W: number, H: number, srcW: number, srcH: number) {
  const pad = style.padding * Math.min(W, H);
  const aw = W - pad * 2, ah = H - pad * 2;
  const k = Math.min(aw / srcW, ah / srcH);
  const fw = srcW * k, fh = srcH * k;
  return { fx: (W - fw) / 2, fy: (H - fh) / 2, fw, fh };
}

// The scene transform for a camera: scale around the focus point, clamped so the view never leaves the canvas.
export function sceneTransform(cam: Cam, W: number, H: number, rect: ReturnType<typeof frameRect>) {
  const s = cam.s;
  const px = rect.fx + cam.x * rect.fw, py = rect.fy + cam.y * rect.fh;
  let tx = W / 2 - px * s, ty = H / 2 - py * s;
  tx = Math.min(0, Math.max(W - W * s, tx));
  ty = Math.min(0, Math.max(H - H * s, ty));
  return { s, tx, ty };
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function drawFrame(
  g: CanvasRenderingContext2D, W: number, H: number,
  src: CanvasImageSource, srcW: number, srcH: number,
  style: Style, cam: Cam, bgImage: HTMLImageElement | ImageBitmap | null = null,
) {
  const rect = frameRect(style, W, H, srcW, srcH);
  const { s, tx, ty } = sceneTransform(cam, W, H, rect);
  const unit = Math.min(W, H) / 1080;
  g.save();
  g.setTransform(s, 0, 0, s, tx, ty);
  g.drawImage(background(style, W, H, bgImage), 0, 0);
  const r = style.radius * unit;
  if (style.shadow > 0) {
    g.save();
    g.shadowColor = `rgba(0,0,0,${0.55 * style.shadow})`;
    g.shadowBlur = 60 * unit * style.shadow;
    g.shadowOffsetY = 22 * unit * style.shadow;
    roundRect(g, rect.fx, rect.fy, rect.fw, rect.fh, r);
    g.fillStyle = "#000";
    g.fill();
    g.restore();
  }
  g.save();
  roundRect(g, rect.fx, rect.fy, rect.fw, rect.fh, r);
  g.clip();
  g.imageSmoothingQuality = "high";
  g.drawImage(src, 0, 0, srcW, srcH, rect.fx, rect.fy, rect.fw, rect.fh);
  g.restore();
  g.restore();
}

// Canvas point -> point in the source video (0..1), undoing the camera. Used to place a zoom where you click.
export function canvasToSource(px: number, py: number, cam: Cam, style: Style, W: number, H: number, srcW: number, srcH: number) {
  const rect = frameRect(style, W, H, srcW, srcH);
  const { s, tx, ty } = sceneTransform(cam, W, H, rect);
  const sx = (px - tx) / s, sy = (py - ty) / s;
  return { x: clamp01((sx - rect.fx) / rect.fw), y: clamp01((sy - rect.fy) / rect.fh) };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ---------- activity detector ----------
// A tab can't see your clicks outside itself, so zoomies reads the pixels: it diffs small frames and finds where
// a small part of the screen changes (typing, a click, a menu) as opposed to the whole screen (a scroll, a page load).
export type Sample = { t: number; frac: number; x: number; y: number; bw: number; bh: number };

const seek = (v: HTMLVideoElement, t: number) =>
  new Promise<void>((res) => {
    const done = () => { v.removeEventListener("seeked", done); res(); };
    v.addEventListener("seeked", done);
    v.currentTime = t;
    setTimeout(done, 1500);
  });

export async function sampleActivity(v: HTMLVideoElement, duration: number, onProgress?: (p: number) => void, signal?: AbortSignal): Promise<Sample[]> {
  const SW = 192, SH = Math.max(2, Math.round((SW * v.videoHeight) / v.videoWidth));
  const c = document.createElement("canvas");
  c.width = SW; c.height = SH;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  const step = duration > 240 ? 0.5 : 0.25;
  let prev: Uint8ClampedArray | null = null;
  const out: Sample[] = [];
  for (let t = 0; t < duration; t += step) {
    if (signal?.aborted) break;
    await seek(v, Math.min(t, duration - 0.05));
    g.drawImage(v, 0, 0, SW, SH);
    const d = g.getImageData(0, 0, SW, SH).data;
    const lum = new Uint8ClampedArray(SW * SH);
    for (let i = 0, j = 0; j < lum.length; i += 4, j++) lum[j] = (d[i] * 3 + d[i + 1] * 6 + d[i + 2]) / 10;
    if (prev) {
      let n = 0, minX = SW, minY = SH, maxX = -1, maxY = -1, sx = 0, sy = 0;
      for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
        const k = y * SW + x;
        if (Math.abs(lum[k] - prev[k]) > 18) {
          n++; sx += x; sy += y;
          if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
      out.push(n ? { t, frac: n / lum.length, x: sx / n / SW, y: sy / n / SH, bw: (maxX - minX + 1) / SW, bh: (maxY - minY + 1) / SH }
        : { t, frac: 0, x: 0.5, y: 0.5, bw: 0, bh: 0 });
    }
    prev = lum;
    onProgress?.(t / duration);
  }
  onProgress?.(1);
  return out;
}

// Samples -> zoom blocks. Local change groups into a block; whole-screen change ends one and never starts one.
export function zoomsFromActivity(samples: Sample[], duration: number): Zoom[] {
  type Seg = { a: number; b: number; wx: number; wy: number; w: number; ext: number };
  const segs: Seg[] = [];
  let cur: Seg | null = null;
  const GAP = 0.9;
  for (const s of samples) {
    const local = s.frac > 0.0006 && s.frac < 0.22 && s.bw < 0.7 && s.bh < 0.7;
    const global = s.frac >= 0.22;
    if (local) {
      const far = cur && Math.hypot(cur.wx / cur.w - s.x, cur.wy / cur.w - s.y) > 0.3;
      if (cur && s.t - cur.b <= GAP && !far) {
        cur.b = s.t; cur.wx += s.x * s.frac; cur.wy += s.y * s.frac; cur.w += s.frac; cur.ext = Math.max(cur.ext, s.bw, s.bh);
      } else {
        if (cur) segs.push(cur);
        cur = { a: s.t, b: s.t, wx: s.x * s.frac, wy: s.y * s.frac, w: s.frac, ext: Math.max(s.bw, s.bh) };
      }
    } else if (global && cur) { segs.push(cur); cur = null; }
  }
  if (cur) segs.push(cur);

  let zooms: Zoom[] = segs
    .filter((s) => s.b - s.a >= 0.2 || s.w > 0.004)
    .map((s) => {
      const ext = Math.max(0.12, s.ext);
      const scale = Math.max(1.5, Math.min(2.4, 0.9 / ext + 0.6));
      return { id: uid(), start: Math.max(0, s.a - 0.35), end: Math.min(duration, s.b + 1.1), x: s.wx / s.w, y: s.wy / s.w, scale: round2(scale) };
    });
  // make every block at least 1.6 s, then merge neighbours that overlap or sit close in space
  zooms = zooms.map((z) => (z.end - z.start < 1.6 ? { ...z, end: Math.min(duration, z.start + 1.6) } : z));
  const merged: Zoom[] = [];
  for (const z of zooms) {
    const last = merged[merged.length - 1];
    if (last && z.start - last.end < 0.6 && Math.hypot(last.x - z.x, last.y - z.y) < 0.18) {
      const wa = last.end - last.start, wb = z.end - z.start;
      last.x = (last.x * wa + z.x * wb) / (wa + wb); last.y = (last.y * wa + z.y * wb) / (wa + wb);
      last.end = Math.max(last.end, z.end); last.scale = round2(Math.min(last.scale, z.scale));
    } else if (last && z.start < last.end) {
      last.end = z.start; // a pan: the camera glides from one spot to the next
      merged.push(z);
    } else merged.push(z);
  }
  return merged.filter((z) => z.end - z.start > 0.5).map((z) => ({ ...z, start: round2(z.start), end: round2(z.end), x: round3(z.x), y: round3(z.y) }));
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const round3 = (v: number) => Math.round(v * 1000) / 1000;

export async function fixDuration(v: HTMLVideoElement): Promise<number> {
  // MediaRecorder WebM files often report Infinity until you seek to the end
  if (isFinite(v.duration) && v.duration > 0) return v.duration;
  await new Promise<void>((res) => {
    const done = () => { v.removeEventListener("durationchange", on); res(); };
    const on = () => { if (isFinite(v.duration)) done(); };
    v.addEventListener("durationchange", on);
    v.currentTime = 1e7;
    setTimeout(done, 4000);
  });
  const d = isFinite(v.duration) ? v.duration : v.currentTime;
  v.currentTime = 0;
  return d;
}

export function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((res, rej) => {
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.preload = "auto"; v.crossOrigin = "anonymous";
    v.onloadeddata = () => res(v);
    v.onerror = () => rej(new Error("This file couldn't be read as a video. Try an MP4 or WebM."));
    v.src = url;
  });
}
