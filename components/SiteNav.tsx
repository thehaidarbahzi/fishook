"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GitHubIcon } from "./Icon";
import { LogoLink } from "./Logo";

export function SiteNav({ github }: { github: string }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-20 h-16 bg-surface-0 ${
        scrolled ? "border-b border-divider" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-full w-full max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-6">
          <LogoLink />
          <nav aria-label="Main" className="flex items-center gap-4 text-[13px]">
            <Link href="/docs" className="-mx-2 inline-flex h-11 items-center px-2 text-text-2 hover:text-text-1">
              Docs
            </Link>
            <Link href="/privacy" className="-mx-2 hidden h-11 items-center px-2 text-text-2 hover:text-text-1 sm:inline-flex">
              Privacy
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {github ? (
            <a
              href={github}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="GitHub repository"
              className="inline-flex size-11 items-center justify-center rounded-md text-text-2 hover:bg-hover hover:text-text-1 md:size-8"
            >
              <GitHubIcon size={20} />
            </a>
          ) : null}
          <a
            href="/api/session?next=/app"
            className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-[13px] font-medium text-on-primary hover:bg-primary-hover md:h-8"
          >
            Open the app
          </a>
        </div>
      </div>
    </header>
  );
}
