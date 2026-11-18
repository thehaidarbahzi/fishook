import { NextResponse, type NextRequest } from "next/server";
import { activeSession } from "@/lib/session-server";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ seq: string }> },
) {
  const session = await activeSession(request);
  if (!session) {
    return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 });
  }

  const { seq: rawSeq } = await context.params;
  const seq = Number(rawSeq);
  if (!Number.isSafeInteger(seq) || seq <= 0) {
    return NextResponse.json({ ok: false, error: "bad_seq" }, { status: 400 });
  }

  const event = await getStore().getEvent(session.endpoint.id, seq);
  if (!event) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(
    { ok: true, event },
    { headers: { "Cache-Control": "no-store" } },
  );
}
