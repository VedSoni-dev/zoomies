import HeroDemo from "@/components/HeroDemo";
import { PublikPitch } from "@/components/PublikGate";
import "./landing.css";

const WORKS = [
  ["Record in the tab", "A screen, a window or a browser tab, with your mic if you want it. Chrome, Edge and Firefox on Windows, ChromeOS, Linux and macOS."],
  ["Or drop any recording", "Already recorded it in QuickTime, OBS, Game Bar or Loom? Drop the file and it gets the same treatment."],
  ["Zooms that place themselves", "zoomies reads the video, finds where a small part of the screen changes (typing, clicks, menus) and glides the camera there on a spring."],
  ["Edit every zoom", "Move, stretch or delete blocks on the timeline. Click the preview to aim a zoom or add one. One slider for overall strength."],
  ["Framed for where it's going", "Nine backgrounds, a solid colour or your own image. Padding, corners, shadow. 16:9 for X, 1:1 for LinkedIn, 9:16 for Reels."],
  ["MP4 out, 1080p, 60 fps", "Encoded in your browser with sound. No watermark, no cap, no account to export."],
];

export default function Landing() {
  return (
    <div className="ld">
      <header className="ld-nav">
        <a href="/" className="ld-logo">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><rect x="2" y="4" width="20" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="2" /><rect x="11" y="10" width="8" height="7" rx="2" fill="var(--accent)" /></svg>
          zoomies
        </a>
        <nav>
          <a href="https://github.com/VedSoni-dev/zoomies">GitHub</a>
          <a className="btn btn-primary" href="/app">Open zoomies →</a>
        </nav>
      </header>

      <main>
        <section className="ld-hero">
          <div className="ld-copy">
            <p className="ld-eyebrow mono">Free · any computer · nothing to install</p>
            <h1>Demo videos that zoom in on their own.</h1>
            <p className="ld-lede">Record your screen in a browser tab. zoomies finds where you were typing and clicking, glides the camera in, frames it on a background and hands you an MP4. Your video never leaves the tab.</p>
            <div className="ld-cta">
              <a className="btn btn-primary btn-lg" href="/app">Record a demo →</a>
              <span className="muted small">Works on Windows, Chromebook, Linux and Mac.</span>
            </div>
          </div>
          <HeroDemo />
        </section>

        <section className="ld-section">
          <h2>What works today</h2>
          <ul className="ld-grid">
            {WORKS.map(([h, p]) => (
              <li key={h}><h3>{h}</h3><p>{p}</p></li>
            ))}
          </ul>
        </section>

        <section className="ld-section ld-split">
          <div>
            <h2>Honest about the gaps</h2>
            <p>A web page can&apos;t see your mouse outside its own tab, so zoomies places zooms from what changes on screen, not from your actual clicks. On most demos that lands in the same spot. When it doesn&apos;t, click the preview to aim it.</p>
          </div>
          <ul className="ld-list">
            <li>No cursor smoothing or click ripples yet</li>
            <li>No webcam bubble, captions or GIF export yet</li>
            <li>Screen recording needs a desktop browser (phones can still drop a video)</li>
            <li>Clips up to 15 minutes</li>
          </ul>
        </section>

        <section className="ld-section ld-publik">
          <h2>Free, because of publik</h2>
          <PublikPitch appName="zoomies" className="ld-pitch" />
          <p className="muted small">The app asks you to sign in with publik once. Your recordings stay in your browser either way.</p>
        </section>

        <section className="ld-end">
          <h2>Make the first one now.</h2>
          <a className="btn btn-primary btn-lg" href="/app">Open zoomies →</a>
        </section>
      </main>

      <footer className="ld-foot muted small">
        <span>free &amp; open source (MIT) · <a href="https://github.com/VedSoni-dev/zoomies">source</a> · built by <a href="https://x.com/forkthis_ai">@forkthis_ai</a></span>
        <span>An independent alternative to Screen Studio. Not affiliated with it.</span>
      </footer>
    </div>
  );
}
