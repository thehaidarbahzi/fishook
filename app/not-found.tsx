import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col justify-center px-6">
      <Logo />
      <p className="fk-micro mt-8 text-text-3">404</p>
      <h1 className="fk-display mt-2 text-text-1">This page is not in the net.</h1>
      <p className="mt-3 max-w-[44ch] text-[14px] leading-[22px] text-text-2">
        The link may be old, or the endpoint may have been deleted. The app can start a new
        endpoint without an account.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-md border border-outline px-4 text-[13px] font-medium text-text-1 hover:bg-hover"
        >
          Home
        </Link>
        <a
          href="/api/session?next=/app"
          className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-[13px] font-medium text-on-primary hover:bg-primary-hover"
        >
          Open the app
        </a>
      </div>
    </main>
  );
}
