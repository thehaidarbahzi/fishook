import { headers } from "next/headers";
import { site } from "./site";

/**
 * The webhook URL has to match the browser origin, including the port and the
 * proxy scheme. Falls back to NEXT_PUBLIC_SITE_URL when no host header exists.
 */
export async function requestOrigin(): Promise<string> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host");
  if (!host) return site.url.replace(/\/$/, "");

  const forwardedProto = incoming.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const proto = forwardedProto || (local ? "http" : "https");
  return `${proto}://${host}`;
}
