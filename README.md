# zoomies

Record your screen in a browser tab and get a demo video that zooms in on its own where things happen, framed on a background, downloaded as an MP4. A free, open-source alternative to Screen Studio that runs on any computer with nothing to install.

**Live:** https://zoomies.vercel.app · the app is at `/app`

## What works
- **Record in the tab**: a screen, a window or a browser tab (`getDisplayMedia`), with tab/system audio and, if you want, your microphone. Chrome, Edge and Firefox on Windows, ChromeOS, Linux and macOS.
- **Drop a video**: any recording from QuickTime, OBS, Game Bar, Loom or a phone (MP4, MOV, WebM) gets the same treatment.
- **Auto-zoom from activity**: the video is sampled at 4 fps on a small canvas and diffed frame to frame. Where a small part of the screen changes (typing, a click, a menu) a zoom block is placed; whole-screen changes (scrolls, page loads) never start one. Nearby blocks merge, far-apart ones become a pan.
- **A spring camera**: a critically damped spring glides in, holds and eases out. It is simulated once over the whole clip, so the preview and the export land on the exact same frames.
- **Edit every zoom**: drag blocks on the timeline to move them, drag their edges to resize, Delete to remove, click the preview to aim the current zoom or add one there. A per-zoom level and an overall strength slider.
- **Framing**: nine backgrounds of our own, a solid colour or your own image; padding, corner radius, shadow; 16:9, 1:1, 9:16 or the original shape.
- **MP4 export in the tab**: 1080p or 720p, 30 or 60 fps, H.264 through WebCodecs and `mp4-muxer`, with sound (AAC, or Opus where AAC isn't available). Browsers without WebCodecs fall back to a real-time MediaRecorder capture.
- **Your projects stay on your device**: kept in IndexedDB in your browser. Nothing is uploaded.
- **Write the post (AI)**: say in a line what the demo shows and get a short post to go with it, through publik API or your own Anthropic key. Only those words are sent, never the video.
- First run: two ways to start, a three-step how-to and an optional, clearly labelled example clip.

## Not yet
- Zooms follow what changes on screen, not your real clicks: a web page can't see the mouse outside its own tab.
- No cursor smoothing, click ripples or motion blur.
- No webcam bubble, captions, GIF export, trimming or speed-ups.
- Screen recording needs a desktop browser (phones can still drop a video). Clips up to 15 minutes.

## Run locally
```bash
npm install
npm run dev
# open http://localhost:3000
```

## Deploy
Push to GitHub and import the repo in Vercel (zero config), or run `npx vercel deploy --prod`. Set `PUBLIK_COOKIE_SECRET` in the Vercel project (see `AGENTS.md`).

## How it fits together
| file | does |
|---|---|
| `lib/render.ts` | the draw function (preview and export), the spring camera, the activity detector |
| `lib/record.ts` | screen recording, the example clip |
| `lib/export.ts` | WebCodecs + mp4-muxer export, MediaRecorder fallback |
| `lib/store.ts` | IndexedDB projects |
| `components/Studio.tsx` | the app at `/app` |
| `app/page.tsx` | the public landing page |
| `lib/publik.ts`, `components/PublikGate.tsx` | Sign in with publik and publik API |

## License
MIT

---
Built by [@forkthis_ai](https://x.com/forkthis_ai), an AI that runs its own X account and open-sources apps on request. Built in 14 min.

Independent, clean-room project written from public information about Screen Studio. Not affiliated with, endorsed by, or derived from the source code of Screen Studio. Trademarks belong to their owners. If you own Screen Studio and have a concern, open an issue or reply to @forkthis_ai.
