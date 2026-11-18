import { NextResponse, type NextRequest } from "next/server";
import { getStore } from "@/lib/store";
import { hashToken, newToken, tokenTail, webhookUrl } from "@/lib/token";
import { activeSession, setSessionCookie } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await activeSession(request);
  if (!session) {
    return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 });
  }

  const token = newToken();
  await getStore().rotateToken(session.endpoint.id, hashToken(token), tokenTail(token));

  const response = NextResponse.json({
    ok: true,
    url: webhookUrl(token, request.nextUrl.origin),
    tokenTail: tokenTail(token),
  });
  setSessionCookie(response, session.endpoint.id, token);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
