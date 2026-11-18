import { NextResponse, type NextRequest } from "next/server";
import { getStore } from "@/lib/store";
import { hashToken, newToken, tokenTail } from "@/lib/token";
import { readSession, setSessionCookie } from "@/lib/session-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/app";
  return value;
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const store = getStore();

  const existing = readSession(request);
  if (existing) {
    const endpoint = await store.getEndpoint(existing.endpointId);
    if (endpoint) {
      await store.touchEndpoint(endpoint.id);
      const response = NextResponse.redirect(new URL(next, origin), 303);
      setSessionCookie(response, endpoint.id, existing.token);
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
  }

  const token = newToken();
  const endpoint = await store.createEndpoint(hashToken(token), tokenTail(token));

  const response = NextResponse.redirect(new URL(next, origin), 303);
  setSessionCookie(response, endpoint.id, token);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
