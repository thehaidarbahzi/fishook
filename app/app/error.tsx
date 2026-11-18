"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("fishook: app route failed", error);
  }, [error]);

  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col justify-center px-6">
      <p className="fk-micro text-text-3">Endpoint unavailable</p>
      <h1 className="fk-display mt-2 text-text-1">The endpoint did not load.</h1>
      <p className="mt-3 max-w-[44ch] text-[14px] leading-[22px] text-text-2">
        The store could not be reached, or the endpoint no longer exists. Retrying is safe. No
        new endpoint is created while the current cookie is still valid.
      </p>
      {error.digest ? (
        <p className="fk-mono-data mt-3 text-[11px] leading-4 text-text-3">digest {error.digest}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-[13px] font-medium text-on-primary hover:bg-primary-hover"
        >
          Retry
        </button>
        <Link
          href="/api/session?next=/app"
          className="inline-flex h-11 items-center rounded-md border border-outline px-4 text-[13px] font-medium text-text-1 hover:bg-hover"
        >
          Start a new endpoint
        </Link>
      </div>
    </main>
  );
}
