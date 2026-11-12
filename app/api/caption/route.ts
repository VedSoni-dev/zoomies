import { cookies } from "next/headers";
import { MODELS, publikChat, resolveProvider } from "@/lib/publik";

/*
 * "Write the post": one line about what the demo shows (+ its length and zoom count) -> a short post for X or LinkedIn
 * and a file title. publik API when the person chose "Connect your plan" (the key stays in its sealed cookie on the
 * server), otherwise their own Anthropic key from a request header, used for this one call and never stored here.
 * The video itself never leaves the browser: only the words typed here are sent.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM = `You write the text that goes with a short product demo video someone is about to post.
Given what the video shows, reply with JSON only, no prose: {"title": string (2-6 words, for the file name), "post": string (the post: under 260 characters, plain and specific, first person, says what the thing does and for whom, no hashtags, no emoji, no hype words like "revolutionary" or "game-changer")}.`;

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

function parse(text: string) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    if (typeof o.post !== "string" || !o.post.trim()) return null;
    return { title: String(o.title ?? "demo").slice(0, 60), post: o.post.trim().slice(0, 600) };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const ownKey = req.headers.get("x-anthropic-key")?.trim();
  const p = resolveProvider(await cookies(), ownKey ? { baseURL: "https://api.anthropic.com", apiKey: ownKey } : null);
  if (p.kind === "needs_own_key") return json({ error: "Add your Anthropic API key first (it stays in this browser)." }, 401);

  let about = "";
  try {
    const b = (await req.json()) as { about?: unknown; seconds?: unknown; zooms?: unknown };
    const what = String(b.about ?? "").slice(0, 400).trim();
    if (what) about = `${what}\n(The video is ${Math.round(Number(b.seconds) || 0)} seconds long with ${Number(b.zooms) || 0} zoom-ins on the important moments.)`;
  } catch {
    return json({ error: "Bad request." }, 400);
  }
  if (!about) return json({ error: "Say in a few words what your demo shows." }, 400);

  let text = "";
  if (p.kind === "publik") {
    const r = await publikChat(p, { model: MODELS.fast, max_tokens: 500, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: about }] }, req.signal);
    if (!r.ok) return json({ error: r.message, ...(r.topUpUrl ? { topUpUrl: r.topUpUrl } : {}) }, r.status);
    text = r.text;
  } else {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": p.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 500, system: SYSTEM, messages: [{ role: "user", content: about }] }),
      signal: req.signal,
    }).catch(() => null);
    if (!res) return json({ error: "Couldn't reach Anthropic. Try again." }, 502);
    const body = (await res.json().catch(() => ({}))) as { content?: { text?: string }[]; error?: { message?: string } };
    if (!res.ok) return json({ error: body.error?.message ?? `Anthropic answered ${res.status}.` }, res.status === 401 ? 401 : 502);
    text = (body.content ?? []).map((c) => c.text ?? "").join("");
  }
  const out = parse(text);
  return out ? json(out) : json({ error: "The model's answer wasn't usable. Try again." }, 502);
}
