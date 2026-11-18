import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { currentSession } from "@/lib/session-server";
import { getStore } from "@/lib/store";
import { requestOrigin } from "@/lib/origin";
import { webhookUrl } from "@/lib/token";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "App",
  robots: { index: false, follow: false },
};

export default async function AppPage() {
  const session = await currentSession();
  if (!session) redirect("/api/session?next=/app");

  const store = getStore();
  const [events, schemas, count, origin] = await Promise.all([
    store.listEvents(session.endpoint.id, { limit: 2000 }),
    store.getSchemas(session.endpoint.id),
    store.countEvents(session.endpoint.id),
    requestOrigin(),
  ]);

  return (
    <AppShell
      initialUrl={webhookUrl(session.token, origin)}
      tokenTail={session.endpoint.tokenTail}
      initialEvents={events}
      initialSchemas={schemas}
      initialCount={count}
      initialRejected={session.endpoint.rejectedLastHour}
    />
  );
}
