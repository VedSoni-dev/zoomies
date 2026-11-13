import Studio from "@/components/Studio";
import { PublikGate } from "@/components/PublikGate";
import "./studio.css";

// The software lives here, behind Sign in with publik. The landing page at / stays public.
export const metadata = { title: "zoomies · studio" };

export default function AppPage() {
  return (
    <PublikGate appName="zoomies" tagline="Demo videos that zoom in on their own, recorded right in a browser tab." preview="/gate-preview.mp4">
      <Studio />
    </PublikGate>
  );
}
