import { cookies } from "next/headers";
import { forget, gateStatus } from "@/lib/publik";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Creates this browser's publik install (POST /api/v1/installs) when it has none, seals its key into
 *  an http-only cookie, and answers the gate's next screen. The key never appears in the response. */
export async function POST(req: Request) {
  const status = await gateStatus(await cookies(), req, { provision: true });
  return Response.json(status, { headers: { "cache-control": "no-store" } });
}

/** Forget this browser's install and choice. The next visit starts at Sign in with publik again. */
export async function DELETE() {
  forget(await cookies());
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
