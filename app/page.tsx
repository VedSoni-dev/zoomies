import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";

const DESCRIPTION =
  "Record a screen or tab in Chrome, Edge or Firefox and get a demo video that zooms in where you typed and clicked, framed on a background, saved as a 1080p MP4. Free, open source, nothing uploaded.";

// The landing page's own head, and the page type the taste kit reads (page-type, site-kind;
// <html data-type> is set by Landing's first script).
export const metadata: Metadata = {
  title: "zoomies: screen recorder that zooms in for you, in a browser tab",
  description: DESCRIPTION,
  openGraph: { title: "zoomies: demo videos that zoom in on their own", description: DESCRIPTION, type: "website" },
  twitter: { card: "summary_large_image" },
  other: { "page-type": "software", "site-kind": "software" },
};

export default function Home() {
  return <Landing />;
}
