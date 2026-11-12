// MP4 export in the tab: WebCodecs VideoEncoder (+ AudioEncoder) into mp4-muxer. Falls back to MediaRecorder.
import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { buildCamera, camAt, drawFrame, outputSize, type Style, type Zoom } from "./render";

export type ExportOpts = { height: 720 | 1080; fps: 30 | 60; withAudio: boolean };
export type ExportResult = { blob: Blob; ext: "mp4" | "webm"; note?: string };

const seek = (v: HTMLVideoElement, t: number) =>
  new Promise<void>((res) => {
    if (Math.abs(v.currentTime - t) < 1e-4 && v.readyState >= 2) return res();
    const done = () => { v.removeEventListener("seeked", done); res(); };
    v.addEventListener("seeked", done);
    v.currentTime = t;
    setTimeout(done, 2000);
  });

async function pickVideoCodec(w: number, h: number, fps: number) {
  if (typeof VideoEncoder === "undefined") return null;
  for (const codec of ["avc1.640033", "avc1.640028", "avc1.4d0028", "avc1.42003e"]) {
    const config: VideoEncoderConfig = { codec, width: w, height: h, bitrate: h >= 1080 ? 12_000_000 : 6_000_000, framerate: fps, avc: { format: "avc" } };
    try { if ((await VideoEncoder.isConfigSupported(config)).supported) return config; } catch { /* next */ }
  }
  return null;
}

async function decodeAudio(blob: Blob): Promise<AudioBuffer | null> {
  try {
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    return await ctx.decodeAudioData(await blob.arrayBuffer());
  } catch { return null; }
}

async function pickAudioCodec(sampleRate: number, channels: number) {
  if (typeof AudioEncoder === "undefined") return null;
  for (const [codec, mux] of [["mp4a.40.2", "aac"], ["opus", "opus"]] as const) {
    const config: AudioEncoderConfig = { codec, sampleRate, numberOfChannels: channels, bitrate: 160_000 };
    try { if ((await AudioEncoder.isConfigSupported(config)).supported) return { config, mux }; } catch { /* next */ }
  }
  return null;
}

export async function exportVideo(
  source: Blob, video: HTMLVideoElement, duration: number, zooms: Zoom[], style: Style, bg: ImageBitmap | null,
  opts: ExportOpts, onProgress: (p: number) => void, signal: AbortSignal,
): Promise<ExportResult> {
  const [W, H] = outputSize(style, video.videoWidth, video.videoHeight, opts.height);
  const vconf = await pickVideoCodec(W, H, opts.fps);
  if (!vconf) return recorderFallback(video, duration, zooms, style, bg, W, H, opts, onProgress, signal);

  const audioBuf = opts.withAudio ? await decodeAudio(source) : null;
  const aconf = audioBuf ? await pickAudioCodec(audioBuf.sampleRate, Math.min(2, audioBuf.numberOfChannels)) : null;

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width: W, height: H, frameRate: opts.fps },
    ...(aconf && audioBuf ? { audio: { codec: aconf.mux, sampleRate: audioBuf.sampleRate, numberOfChannels: aconf.config.numberOfChannels } } : {}),
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });

  let failure: Error | null = null;
  const venc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { failure = e; } });
  venc.configure(vconf);

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext("2d", { alpha: false })!;
  const cam = buildCamera(zooms, duration, style.strength);
  const total = Math.floor(duration * opts.fps);
  video.pause();
  for (let i = 0; i < total; i++) {
    if (signal.aborted) { venc.close(); throw new DOMException("Export cancelled", "AbortError"); }
    if (failure) throw failure;
    const t = i / opts.fps;
    await seek(video, Math.min(t, duration - 0.001));
    drawFrame(g, W, H, video, video.videoWidth, video.videoHeight, style, camAt(cam, t), bg);
    const frame = new VideoFrame(canvas, { timestamp: Math.round(t * 1e6), duration: Math.round(1e6 / opts.fps) });
    venc.encode(frame, { keyFrame: i % (opts.fps * 2) === 0 });
    frame.close();
    while (venc.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 2));
    if (i % 5 === 0) onProgress((i / total) * (aconf ? 0.92 : 1));
  }
  await venc.flush();
  venc.close();

  if (aconf && audioBuf) {
    const aenc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: (e) => { failure = e; } });
    aenc.configure(aconf.config);
    const ch = aconf.config.numberOfChannels, sr = audioBuf.sampleRate;
    const len = Math.min(audioBuf.length, Math.floor(duration * sr));
    const block = sr; // one second at a time
    for (let off = 0; off < len; off += block) {
      const n = Math.min(block, len - off);
      const data = new Float32Array(n * ch);
      for (let c = 0; c < ch; c++) data.set(audioBuf.getChannelData(Math.min(c, audioBuf.numberOfChannels - 1)).subarray(off, off + n), c * n);
      const ad = new AudioData({ format: "f32-planar", sampleRate: sr, numberOfFrames: n, numberOfChannels: ch, timestamp: Math.round((off / sr) * 1e6), data });
      aenc.encode(ad);
      ad.close();
    }
    await aenc.flush();
    aenc.close();
  }
  if (failure) throw failure;
  muxer.finalize();
  onProgress(1);
  return { blob: new Blob([target.buffer], { type: "video/mp4" }), ext: "mp4", note: audioBuf && !aconf ? "This browser can't encode audio, so the MP4 is silent." : undefined };
}

// Browsers without WebCodecs (older Firefox, Safari): play the clip in real time and record the canvas.
async function recorderFallback(
  video: HTMLVideoElement, duration: number, zooms: Zoom[], style: Style, bg: ImageBitmap | null,
  W: number, H: number, opts: ExportOpts, onProgress: (p: number) => void, signal: AbortSignal,
): Promise<ExportResult> {
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext("2d", { alpha: false })!;
  const cam = buildCamera(zooms, duration, style.strength);
  const stream = canvas.captureStream(opts.fps);
  const mime = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
  const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: opts.height >= 1080 ? 12_000_000 : 6_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => (rec.onstop = () => r()));
  await seek(video, 0);
  rec.start(500);
  await video.play().catch(() => {});
  await new Promise<void>((res) => {
    const tick = () => {
      if (signal.aborted || video.ended || video.currentTime >= duration - 0.02) return res();
      drawFrame(g, W, H, video, video.videoWidth, video.videoHeight, style, camAt(cam, video.currentTime), bg);
      onProgress(video.currentTime / duration);
      requestAnimationFrame(tick);
    };
    tick();
  });
  video.pause();
  rec.stop();
  await done;
  if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");
  const isMp4 = mime.startsWith("video/mp4");
  return { blob: new Blob(chunks, { type: isMp4 ? "video/mp4" : "video/webm" }), ext: isMp4 ? "mp4" : "webm", note: isMp4 ? "Recorded in real time (this browser has no WebCodecs), without sound." : "This browser can only write WebM here. Chrome or Edge give you an MP4." };
}
