import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from "./token";
import type { Endpoint } from "./types";
import { getStore } from "./store";

export interface ActiveSession {
  endpoint: Endpoint;
  token: string;
}

export function readSession(request: NextRequest) {
  return verifySession(request.cookies.get(SESSION_COOKIE)?.value);
}

export async function activeSession(request: NextRequest): Promise<ActiveSession | null> {
  const payload = readSession(request);
  if (!payload) return null;
  const endpoint = await getStore().getEndpoint(payload.endpointId);
  if (!endpoint) return null;
  return { endpoint, token: payload.token };
}

/** For server components and route handlers that read the request cookie jar. */
export async function currentSession(): Promise<ActiveSession | null> {
  const jar = await cookies();
  const payload = verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  const endpoint = await getStore().getEndpoint(payload.endpointId);
  if (!endpoint) return null;
  return { endpoint, token: payload.token };
}

export function setSessionCookie(
  response: NextResponse,
  endpointId: string,
  token: string,
): void {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: signSession({ endpointId, token }),
    ...sessionCookieOptions,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    ...sessionCookieOptions,
    maxAge: 0,
  });
}
