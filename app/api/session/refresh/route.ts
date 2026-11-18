import { NextResponse, type NextRequest } from "next/server";
import { activeSession, setSessionCookie } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sliding expiry: visiting the app re-signs the same read cookie with a fresh
 * Max-Age. It does not rotate the write token and does not touch the endpoint.
 */
export async function POST(request: NextRequest) {
  const session = await activeSession(request);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "no_session" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  setSessionCookie(response, session.endpoint.id, session.token);
  return response;
}
