"use client";
// The public front door at /: a screen recorder in a browser tab that zooms the demo in on its own. Built with
// the taste skill's kit (public/assets, loaded only here) and zoomies' own colours; the plan is .taste-skill/plan.md.
// type: software (site-kind software)
// deal: hero centred, nav nav-centre, close close-type, footer footer-statement, rhythm space, buttons tonal,
//       zoomies' own mark, lit ground sand, radius soft, palette zoomies' own (start.mjs brand), type geist,
//       effect grain-gradient held still in the hero frame
// moments: letters-assemble in #statement
// This component holds no state, so React never redraws the static markup the kit's scripts work on. The live
// parts keep their own state: the hero's window and the canvases.
import { useEffect } from "react";
import { PublikPitch } from "@/components/PublikGate";
import { HeroWindow, EditorFrame, RecordFragment, DropFragment, FrameFragment, ExportFragment, DiffView, PostFragment } from "./Pieces";

const REPO = "https://github.com/VedSoni-dev/zoomies";
const KIT_CSS = ["system.css", "ui/cards.css", "motion/motion.css", "backgrounds/backgrounds.css", "layout/layout.css", "ui/base.css"];
const KIT_JS = ["system.js", "motion/motion.js", "layout/layout.js"];
// <html> carries the page's type, radius, lit ground, button look and the motion layer (system.md); the two
// classes hold the hero's words for the entrance and the moment's finished state if a script is late
const HTML_ATTRS = `(function(){var d=document.documentElement;d.setAttribute('data-type','software');d.setAttribute('data-radius','soft');d.setAttribute('data-ground','sand');d.setAttribute('data-buttons','tonal');d.setAttribute('data-motion','');d.classList.add('m-enter','mo-js');setTimeout(function(){d.classList.add('m-enter-done')},700);setTimeout(function(){d.classList.add('mo-safe')},2500)})();`;

export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="11" y="10" width="8" height="7" rx="2" fill="var(--accent)" />
    </svg>
  );
}

const ARROW = (
  <svg className="m-arrow" viewBox="0 0 12 12" aria-hidden="true"><path className="m-arrow__stem" d="M1 6h8" /><path className="m-arrow__head" d="M4.5 2.5 8 6l-3.5 3.5" /></svg>
);

export function Landing() {
  useEffect(() => {
    for (const f of KIT_JS) {
      const src = `/assets/${f}`;
      if (document.querySelector(`script[src="${src}"]`)) continue;
      const s = document.createElement("script");
      s.type = "module";
      s.src = src;
      document.body.append(s);
    }
  }, []);

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: HTML_ATTRS }} />
      {KIT_CSS.map((f) => (
        <link key={f} rel="stylesheet" href={`/assets/${f}`} precedence="taste-kit" />
      ))}
      <link rel="stylesheet" href="/assets/landing.css" precedence="taste-page" />
      <link rel="modulepreload" href="/assets/moments/moments.js" />
      <link rel="modulepreload" href="/assets/moments/lib.js" />
      <link rel="modulepreload" href="/assets/moments/letters-assemble/moment.js" />

      <header className="nav nav--centre">
        <div className="wrap nav__bar">
          <a className="skip-link" href="#top">Skip to content</a>
          <a className="nav__logo" href="#top"><span className="lp-mark"><Mark /></span>zoomies</a>
          <nav className="nav__links" aria-label="Main">
            <div className="nav__item"><a className="nav__link" href="#editor">Editor</a></div>
            <div className="nav__item"><a className="nav__link" href="#features">Features</a></div>
            <div className="nav__item"><a className="nav__link" href="#how">Zooms</a></div>
            <div className="nav__item"><a className="nav__link" href="#questions">Questions</a></div>
          </nav>
          <div className="nav__actions">
            <a className="btn btn--primary" href="/app">Record a demo</a>
          </div>
          <button className="nav__toggle" type="button" aria-expanded="false" aria-label="Menu">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 5h14M2 13h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>
      </header>

      <main id="top">
        {/* HERO: centred. The words, then the preview window rising out of the grain frame, playing. */}
        <section className="hero hero--centred" data-enter aria-labelledby="hero-h">
          <div className="wrap">
            <div className="hero-text">
              <div className="hero__c">
                <a className="pill" href={`${REPO}/blob/main/LICENSE`}><span>Free and open source</span><span className="muted">MIT licence</span></a>
                <h1 id="hero-h">Screen recorder that zooms in for you</h1>
                <p className="hero__lead">
                  Record a screen or tab in Chrome, Edge or Firefox. zoomies zooms in where you typed and clicked, frames it on a background and saves a 1080p MP4.
                </p>
                <div className="btn-row">
                  <a className="btn btn--primary" href="/app">Record a demo{ARROW}</a>
                  <a className="btn btn--secondary" href={REPO}>Read the source</a>
                </div>
              </div>
              <div className="hero__window" data-fx="grain-gradient" data-fx-seed="7" data-fx-params='{"speed":0,"grainMotion":0,"calm":0.55,"calmX":0.5,"calmY":0.3}'>
                <HeroWindow />
              </div>
            </div>
          </div>
        </section>

        {/* EDITOR: app-frame. The h2 left, the steps right, then the editor across the wrap. */}
        <section className="section" id="editor" aria-labelledby="editor-h">
          <div className="wrap">
            <div className="grid grid--top">
              <h2 id="editor-h" className="span-5">Every zoom in the demo video, on one timeline</h2>
              <p className="t-lead muted span-6 start-7">
                zoomies opens your recording with its zooms already placed. Drag a block to move it, pull an edge to resize it, or click the preview to aim a new one.
              </p>
            </div>
            <EditorFrame />
          </div>
        </section>

        {/* FEATURES: one 2x2 in one group, two screens, every panel on the lit ground, held still */}
        <section className="section" id="features" style={{ "--h": 2 } as React.CSSProperties} aria-labelledby="features-h">
          <div className="wrap">
            <div className="group">
              <div className="section-head">
                <h2 id="features-h">
                  What zoomies does to a recording. <span className="muted">It all runs in the tab, on Windows, ChromeOS, Linux or Mac.</span>
                </h2>
              </div>
              <div className="grid">
                <article className="card card--row card--open span-6 m-nolift">
                  <h3>Records a screen, window or tab</h3>
                  <p>Pick what to share in the browser&apos;s own picker. Your microphone is one switch.</p>
                  <div className="panel"><div className="stage stage--fade-b">
                    <div className="at-rise fit" style={{ "--fit-max": "360px", "--ax": "max(24px, 50% - 180px)", "--ay": "48px", "--ay-sm": "24px" } as React.CSSProperties}>
                      <RecordFragment />
                    </div>
                  </div></div>
                </article>
                <article className="card card--row card--open span-6 m-nolift">
                  <h3>Takes a recording from any app</h3>
                  <p>Drop an MP4, MOV or WebM from QuickTime, OBS, Game Bar, Loom or a phone.</p>
                  <div className="panel"><div className="stage stage--fade-b">
                    <div className="at-rise fit" style={{ "--fit-max": "360px", "--ax": "max(24px, 50% - 180px)", "--ay": "48px", "--ay-sm": "24px" } as React.CSSProperties}>
                      <DropFragment />
                    </div>
                  </div></div>
                </article>
              <article className="card card--row card--open span-6 m-nolift">
                <h3>Frames the video for X, LinkedIn or Reels</h3>
                <p>Nine backgrounds, one colour or your own image, at 16:9, 1:1 or 9:16.</p>
                <div className="panel"><div className="stage stage--fade-b">
                  <div className="at-rise fit" style={{ "--fit-max": "360px", "--ax": "max(24px, 50% - 180px)", "--ay": "48px", "--ay-sm": "24px" } as React.CSSProperties}>
                    <FrameFragment />
                  </div>
                </div></div>
              </article>
              <article className="card card--row card--open span-6 m-nolift">
                <h3>Exports an MP4 at 1080p and 60 fps</h3>
                <p>Encoded in the tab with its sound. A 7.5 second clip took 5.3 seconds.</p>
                <div className="panel"><div className="stage stage--fade-b">
                  <div className="at-rise fit" style={{ "--fit-max": "360px", "--ax": "max(24px, 50% - 180px)", "--ay": "48px", "--ay-sm": "24px" } as React.CSSProperties}>
                    <ExportFragment />
                  </div>
                </div></div>
              </article>
              </div>
            </div>
          </div>
        </section>

        {/* STATEMENT: letters-assemble (moments.md), one screen of its own */}
        <section className="section" id="statement" data-moment="letters-assemble" aria-labelledby="statement-h">
          <div className="wrap">
            <h2 id="statement-h" className="mo-la__type">Nothing leaves the tab</h2>
            <p className="mo-la__sub">zoomies reads, zooms and encodes the video in your browser. Projects stay in this browser&apos;s own storage, on this computer.</p>
          </div>
        </section>

        {/* HOW: split-text-left. The mechanism in three facts beside the changed cells it reads. */}
        <section className="section" id="how" aria-labelledby="how-h">
          <div className="wrap">
            <div className="grid grid--top">
              <div className="span-5 stack-5">
                <h2 id="how-h">How the recorder places a zoom</h2>
                <p className="t-lead">Four times a second, zoomies compares each frame of your recording with the one before, on a copy 192 pixels wide.</p>
                <ul className="rows">
                  <li><span className="rows__name">Small change</span><p>Typing, a click or a menu changes a small area, and that area becomes a zoom.</p></li>
                  <li><span className="rows__name">Whole screen</span><p>A scroll or a page load changes everything and never starts one.</p></li>
                  <li><span className="rows__name">Two zooms</span><p>Close together they merge. Far apart, the camera pans from one to the next.</p></li>
                </ul>
              </div>
              <div className="frame frame--split frame--lit span-6 start-7">
                <div className="stage lp-diff"><DiffView /></div>
              </div>
            </div>
          </div>
        </section>

        {/* QUESTIONS: every answer open, the limits said plainly; the publik pitch beside them */}
        <section className="section" id="questions" aria-labelledby="questions-h">
          <div className="wrap">
            <div className="grid grid--top">
              <div className="span-5 stack-5">
                <h2 id="questions-h">Questions</h2>
                <PublikPitch appName="zoomies" className="lp-pitch" />
                <div className="frame frame--lit lp-post"><PostFragment /></div>
              </div>
              <div className="faq span-6 start-7">
                <div className="faq__item">
                  <h3>Does a zoom land where I clicked in the demo?</h3>
                  <p>Close to it. A web page can&apos;t see your mouse outside its tab, so zoomies zooms where the screen changes, which is where you click and type.</p>
                </div>
                <div className="faq__item">
                  <h3>Which browsers can record the screen?</h3>
                  <p>Chrome, Edge and Firefox on Windows, ChromeOS, Linux and macOS. On a phone, drop a video in.</p>
                </div>
                <div className="faq__item">
                  <h3>How is it different from Screen Studio?</h3>
                  <p>Screen Studio is a Mac app at $29 a month. zoomies is free and runs in a browser, without its cursor smoothing or webcam bubble yet.</p>
                </div>
                <div className="faq__item">
                  <h3>What is missing from the recorder?</h3>
                  <p>Cursor smoothing, click ripples, a webcam bubble, captions, GIF export and trimming. Clips run up to 15 minutes.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer closing footer--statement" id="contact" aria-labelledby="close-h">
        <div className="wrap">
          <div className="closing__cta close--type">
            <div className="section-head">
              <h2 id="close-h">Record your first demo</h2>
              <p>Free and MIT licensed. Chrome, Edge or Firefox, nothing to install.</p>
            </div>
            <a className="btn btn--primary btn--xl btn--wide" href="/app">Record a demo{ARROW}</a>
          </div>
          <div className="closing__links">
            <div className="grid">
              <div className="span-4 stack-4">
                <a className="nav__logo" href="#top"><span className="lp-mark"><Mark /></span>zoomies</a>
                <p className="footer__lede">Demo videos that zoom in on their own, recorded in a browser tab.</p>
              </div>
              <div className="span-2 footer__col">
                <h3>zoomies</h3>
                <ul>
                  <li><a href="#editor">Editor</a></li>
                  <li><a href="#features">Features</a></li>
                  <li><a href="#how">Zooms</a></li>
                </ul>
              </div>
              <div className="span-2 footer__col">
                <h3>Help</h3>
                <ul>
                  <li><a href="#questions">Questions</a></li>
                  <li><a href={`${REPO}/issues`}>Issues</a></li>
                </ul>
              </div>
              <div className="span-2 footer__col">
                <h3>Code</h3>
                <ul>
                  <li><a href={REPO}>Read the source</a></li>
                  <li><a href={`${REPO}/blob/main/LICENSE`}>MIT licence</a></li>
                </ul>
              </div>
              <div className="span-2 footer__col">
                <h3>More</h3>
                <ul>
                  <li><a href="https://publikhq.com">publik</a></li>
                  <li><a href="https://x.com/forkthis_ai">@forkthis_ai</a></li>
                </ul>
              </div>
            </div>
            <div className="footer__legal">
              <span>&copy; 2026 zoomies. Not affiliated with Screen Studio.</span>
              <div className="socials" />
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
