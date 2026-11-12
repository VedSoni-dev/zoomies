// Screen recording in the tab (getDisplayMedia + MediaRecorder), and the optional example clip.

export function pickMime(): string {
  const types = ["video/mp4;codecs=avc1,opus", "video/mp4;codecs=avc1", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return types.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
}

export const canRecord = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;

export type Recording = { stop: () => void; done: Promise<Blob>; stream: MediaStream };

export async function startRecording(opts: { mic: boolean; onEnded?: () => void }): Promise<Recording> {
  const display = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: 30, max: 60 }, width: { ideal: 2560 }, height: { ideal: 1440 }, cursor: "always" } as MediaTrackConstraints,
    audio: true,
  });
  let mic: MediaStream | null = null;
  if (opts.mic) mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).catch(() => null);

  const tracks: MediaStreamTrack[] = [...display.getVideoTracks()];
  const audioIns = [display, mic].filter((s): s is MediaStream => !!s && s.getAudioTracks().length > 0);
  let ctx: AudioContext | null = null;
  if (audioIns.length === 1) tracks.push(audioIns[0].getAudioTracks()[0]);
  else if (audioIns.length > 1) {
    ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    for (const s of audioIns) ctx.createMediaStreamSource(s).connect(dest);
    tracks.push(dest.stream.getAudioTracks()[0]);
  }
  const stream = new MediaStream(tracks);
  const mime = pickMime();
  const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 12_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<Blob>((res) => {
    rec.onstop = () => {
      display.getTracks().forEach((t) => t.stop());
      mic?.getTracks().forEach((t) => t.stop());
      ctx?.close();
      res(new Blob(chunks, { type: (mime || "video/webm").split(";")[0] }));
    };
  });
  display.getVideoTracks()[0].addEventListener("ended", () => { if (rec.state !== "inactive") rec.stop(); opts.onEnded?.(); });
  rec.start(1000);
  return { stop: () => rec.state !== "inactive" && rec.stop(), done, stream };
}

// ---------- the example clip ----------
// A made-up app window: someone types into a search box (top left), then clicks a button (bottom right).
// It is drawn on a canvas so the landing page hero and "see an example" never need a real recording.
export function drawExampleScene(g: CanvasRenderingContext2D, W: number, H: number, t: number, dark = false) {
  const u = W / 1280;
  const bg = dark ? "#18181a" : "#fbfaf8", ink = dark ? "#ecebe6" : "#1c1b17", mute = dark ? "#55544f" : "#d9d6cf", soft = dark ? "#232326" : "#f0eee9";
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // top bar
  g.fillStyle = soft; g.fillRect(0, 0, W, 54 * u);
  ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc((24 + i * 20) * u, 27 * u, 6 * u, 0, 7); g.fill(); });
  g.fillStyle = mute; rr(g, 420 * u, 15 * u, 440 * u, 24 * u, 12 * u); g.fill();
  // sidebar
  g.fillStyle = soft; g.fillRect(0, 54 * u, 220 * u, H);
  for (let i = 0; i < 7; i++) { g.fillStyle = i === 1 ? "#ff6a2b" : mute; rr(g, 24 * u, (90 + i * 44) * u, (i === 1 ? 140 : 110 - i * 6) * u, 14 * u, 7 * u); g.fill(); }
  // search box + typed text (t 0.8 → 3.2)
  g.strokeStyle = t > 0.6 && t < 3.8 ? "#ff6a2b" : mute; g.lineWidth = 2 * u;
  rr(g, 260 * u, 90 * u, 520 * u, 52 * u, 10 * u); g.stroke();
  const text = "quarterly signups by country";
  const n = Math.max(0, Math.min(text.length, Math.floor((t - 0.8) * 12)));
  g.fillStyle = ink; g.font = `${22 * u}px Inter, system-ui, sans-serif`; g.textBaseline = "middle";
  g.fillText(text.slice(0, n) || (t < 0.8 ? "" : ""), 282 * u, 116 * u);
  if (t > 0.6 && t < 3.8 && Math.floor(t * 2.5) % 2 === 0) { const w = g.measureText(text.slice(0, n)).width; g.fillRect(284 * u + w, 102 * u, 2 * u, 28 * u); }
  if (n === 0 && t < 0.8) { g.fillStyle = mute; g.fillText("Search reports", 282 * u, 116 * u); }
  // cards (results appear at 3.4 s)
  const shown = t > 3.4;
  for (let i = 0; i < 3; i++) {
    const x = (260 + i * 330) * u, y = 180 * u;
    g.fillStyle = soft; rr(g, x, y, 300 * u, 200 * u, 14 * u); g.fill();
    g.fillStyle = mute; rr(g, x + 20 * u, y + 22 * u, 120 * u, 12 * u, 6 * u); g.fill();
    if (shown) {
      const heights = [[60, 90, 120, 80, 140], [110, 70, 50, 130, 95], [40, 80, 120, 150, 170]][i];
      heights.forEach((hgt, k) => { g.fillStyle = k === 4 ? "#ff6a2b" : ink; g.globalAlpha = k === 4 ? 1 : 0.8; rr(g, x + (24 + k * 52) * u, y + (180 - hgt * 0.8) * u, 34 * u, hgt * 0.8 * u, 5 * u); g.fill(); g.globalAlpha = 1; });
    }
  }
  // table rows
  for (let r = 0; r < 5; r++) { g.fillStyle = r % 2 ? soft : bg; g.fillRect(260 * u, (410 + r * 40) * u, 960 * u, 40 * u); g.fillStyle = mute; rr(g, 280 * u, (424 + r * 40) * u, (160 + ((r * 37) % 90)) * u, 12 * u, 6 * u); g.fill(); }
  // export button + click (t 5.2 → 6.6)
  const pressed = t > 5.6 && t < 5.9, toast = t > 5.9;
  g.fillStyle = pressed ? "#d94f14" : "#ff6a2b"; rr(g, 1040 * u, 640 * u, 180 * u, 50 * u, 12 * u); g.fill();
  g.fillStyle = "#fff"; g.font = `600 ${20 * u}px Inter, system-ui, sans-serif`; g.textAlign = "center"; g.fillText(toast ? "Exported ✓" : "Export CSV", 1130 * u, 665 * u); g.textAlign = "left";
  // cursor: glides to the search box, then to the button
  const path: [number, number, number][] = [[0, 640, 400], [0.6, 380, 118], [3.6, 400, 130], [5.4, 1120, 668], [9, 1120, 668]];
  let cx = path[0][1], cy = path[0][2];
  for (let i = 0; i < path.length - 1; i++) {
    const [ta, xa, ya] = path[i], [tb, xb, yb] = path[i + 1];
    if (t >= ta && t <= tb) { const k = ease((t - ta) / (tb - ta)); cx = xa + (xb - xa) * k; cy = ya + (yb - ya) * k; }
    if (t > tb) { cx = xb; cy = yb; }
  }
  g.save(); g.translate(cx * u, cy * u); g.scale(u * 1.3, u * 1.3);
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 22); g.lineTo(6, 17); g.lineTo(10, 26); g.lineTo(14, 24); g.lineTo(10, 15); g.lineTo(17, 15); g.closePath();
  g.fillStyle = "#111"; g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 1.5; g.stroke(); g.restore();
}

const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

export const EXAMPLE_DURATION = 7.5;

// Records the example scene into a real video file, so it goes through the same pipeline as your own recordings.
export async function makeExampleClip(): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = 1280; c.height = 800;
  const g = c.getContext("2d")!;
  const stream = c.captureStream(30);
  const mime = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
  const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<Blob>((res) => (rec.onstop = () => res(new Blob(chunks, { type: (mime || "video/webm").split(";")[0] }))));
  const t0 = performance.now();
  drawExampleScene(g, 1280, 800, 0);
  rec.start(500);
  await new Promise<void>((res) => {
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      drawExampleScene(g, 1280, 800, t);
      if (t >= EXAMPLE_DURATION) return res();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  rec.stop();
  return done;
}
