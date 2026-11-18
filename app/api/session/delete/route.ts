import { NextResponse, type NextRequest } from "next/server";
import { getStore } from "@/lib/store";
import { activeSession, clearSessionCookie } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await activeSession(request);
  if (!session) {
    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response);
    return response;
  }

  await getStore().deleteEndpoint(session.endpoint.id);
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
