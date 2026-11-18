import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/CodeBlock";
import { GitHubIcon } from "@/components/Icon";
import { LandingPreview } from "@/components/LandingPreview";
import { Logo } from "@/components/Logo";
import { SiteNav } from "@/components/SiteNav";
import { exampleGo, exampleSchema } from "@/lib/example";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "fishook — webhook payloads into typed models",
  description:
    "Paste one URL into your provider. fishook stores what arrives, merges samples per event type, and generates Go structs or TypeScript interfaces you can compile.",
};

const steps = [
  {
    title: "Paste the URL",
    body: "One endpoint per browser session. The write token lives in the URL, so any provider can post to it.",
  },
  {
    title: "Trigger a test event",
    body: "Send from the provider sandbox. The row lands in about a second over a server-sent stream.",
  },
  {
    title: "Samples merge by event type",
    body: "Optional fields, nulls, arrays, and type conflicts are counted across every payload of that type.",
  },
  {
    title: "Copy the types",
    body: "Go structs or TypeScript interfaces, generated from the same schema the drawer shows.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-surface-0">
      <SiteNav github={site.github} />

      <main id="main">
        <section className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[7fr_5fr] lg:items-center lg:gap-16 lg:pt-24">
          <div>
            <p className="fk-micro text-text-3">Webhook receiver · Go + TypeScript</p>
            <h1 className="fk-hero mt-3 max-w-[15ch] text-text-1">
              Catch the payload. Ship the type.
            </h1>
            <p className="fk-sub mt-4 max-w-[46ch] text-text-2">
              One URL. fishook stores what actually arrives, merges samples per event type, and
              writes Go or TypeScript you can compile.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-2">
              <a
                href="/api/session?next=/app"
                className="inline-flex h-11 items-center rounded-md bg-primary px-5 text-[13px] font-medium text-on-primary hover:bg-primary-hover"
              >
                Open the app
              </a>
              {site.github ? (
                <a
                  href={site.github}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex h-11 items-center gap-2 rounded-md border border-outline px-4 text-[13px] font-medium text-text-1 hover:bg-hover"
                >
                  <GitHubIcon size={18} />
                  GitHub
                </a>
              ) : null}
              <Link
                href="/docs"
                className="inline-flex h-11 items-center rounded-md px-3 text-[13px] font-medium text-text-2 hover:bg-hover hover:text-text-1"
              >
                Read the docs
              </Link>
            </div>
            <p className="mt-4 text-[12px] leading-[18px] text-text-3">
              No sign-up. The endpoint is tied to this browser. Payloads expire after 72 hours.
            </p>
          </div>

          <LandingPreview />
        </section>

        <section
          aria-label="Limits"
          className="border-y border-divider bg-surface-1"
        >
          <dl className="mx-auto grid w-full max-w-[1200px] grid-cols-2 divide-divider px-4 sm:grid-cols-4 sm:divide-x sm:px-6">
            {[
              ["256 KB", "max body"],
              ["60/min", "per URL"],
              ["72 h", "retention"],
              ["Go · TS", "output"],
            ].map(([value, label]) => (
              <div key={label} className="px-0 py-4 sm:px-5">
                <dt className="fk-micro text-text-3">{label}</dt>
                <dd className="fk-nums mt-1 text-[20px] font-semibold leading-6 tracking-[-0.01em] text-text-1">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mx-auto w-full max-w-[1200px] px-4 py-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-divider pb-4">
            <div>
              <p className="fk-micro text-text-3">How it works</p>
              <h2 className="fk-display mt-1 text-text-1">Four steps, one URL.</h2>
            </div>
            <p className="max-w-[36ch] text-[12px] leading-[18px] text-text-3">
              The app is a receiver, not a proxy. It never calls your API with the payload.
            </p>
          </div>

          <ol className="grid gap-px bg-divider sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, index) => (
              <li key={step.title} className="bg-surface-0 py-6 pr-4 sm:px-5 lg:pr-6">
                <span className="fk-mono-data fk-nums text-[11px] leading-4 text-primary">
                  0{index + 1}
                </span>
                <h3 className="mt-2 text-[14px] font-medium leading-5 text-text-1">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-[12px] leading-[18px] text-text-2">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto w-full max-w-[960px] px-4 pb-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-divider pb-4">
            <div>
              <p className="fk-micro text-text-3">Example output</p>
              <h2 className="fk-display mt-1 text-text-1">The same file, on your machine.</h2>
            </div>
            <p className="fk-mono-data fk-nums text-[11px] leading-4 text-text-3">
              payment.succeeded · {exampleSchema.samples} samples
            </p>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface-0">
            <div className="flex h-10 items-center justify-between border-b border-divider px-4">
              <span className="fk-mono-data text-[11px] leading-4 text-text-2">
                payment_succeeded.go
              </span>
              <span className="fk-micro text-text-3">Generated</span>
            </div>
            <CodeBlock code={exampleGo} lang="go" className="max-h-[420px]" />
          </div>
          <p className="mt-3 max-w-[70ch] text-[12px] leading-[18px] text-text-3">
            Optional fields, nullable fields, empty arrays, and type conflicts are annotated in
            the file. The app uses the same generator, so this example cannot drift from the
            output.
          </p>
        </section>

        <section className="border-t border-divider bg-surface-1">
          <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="fk-micro text-text-3">Scope</p>
              <h2 className="fk-display mt-1 max-w-[18ch] text-text-1">
                Useful before it surprises you.
              </h2>
              <p className="mt-3 max-w-[46ch] text-[13px] leading-[20px] text-text-2">
                fishook does one job. Knowing where it stops is part of using it well.
              </p>
            </div>
            <dl className="divide-y divide-divider border-t border-divider lg:border-t-0">
              {[
                ["Receiver", "Stores what arrives. It never calls your API."],
                ["Signatures", "Not verified. Check them in your own handler."],
                ["Identity", "No accounts. The browser cookie is the read key."],
                ["Languages", "Go and TypeScript in v1."],
              ].map(([term, detail]) => (
                <div key={term} className="py-3">
                  <dt className="text-[12px] leading-[18px] text-text-3">{term}</dt>
                  <dd className="mt-1 text-[12px] leading-[18px] text-text-1">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <footer className="border-t border-divider">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
          <Logo size={20} />
          <nav aria-label="Footer" className="flex items-center gap-4 text-[12px]">
            <Link href="/docs" className="text-text-3 hover:text-text-1">
              Docs
            </Link>
            <Link href="/privacy" className="text-text-3 hover:text-text-1">
              Privacy
            </Link>
            <span className="text-text-3">MIT</span>
          </nav>
        </div>
      </footer>
    </div>
  );
}
