import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What fishook stores, what it does not store, how long payloads live, and how to delete an endpoint.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-surface-0">
      <SiteNav github={site.github} />

      <main id="main" className="mx-auto w-full max-w-[720px] px-4 pb-20 pt-12 sm:px-6">
        <p className="fk-micro text-text-3">Privacy</p>
        <h1 className="fk-display mt-2 text-text-1">What passes through, and for how long.</h1>
        <p className="mt-3 max-w-[60ch] text-[14px] leading-[22px] text-text-2">
          fishook is a webhook receiver. It stores the request so you can inspect it and generate
          types. This page lists exactly what is kept and what is not. It describes the software,
          not a company.
        </p>

        <section className="mt-10 border-t border-divider pt-8">
          <h2 className="text-[18px] font-semibold leading-7 text-text-1">What is stored</h2>
          <dl className="mt-4 divide-y divide-divider border-y border-divider">
            {[
              [
                "Request body",
                "The exact bytes received, up to 256 KB, plus a SHA-256 digest and the byte count.",
              ],
              [
                "Headers",
                "Every header as a name-value pair, including repeated Set-Cookie values. Sensitive headers are masked in the interface, not removed from storage.",
              ],
              [
                "Request metadata",
                "HTTP method, normalized path (/api/h/:token), query string, source IP, content type, and receive time.",
              ],
              [
                "Derived type data",
                "Event type, provider event ID, parse status, duplicate flags, and the inferred schema for each event type.",
              ],
              [
                "Endpoint record",
                "A random ID, the SHA-256 hash of the write token, its last four characters for display, and timestamps.",
              ],
              [
                "Rejected requests",
                "A timestamp and endpoint ID when a request is rate limited or too large. The payload is not stored.",
              ],
            ].map(([term, detail]) => (
              <div key={term} className="py-3">
                <dt className="text-[13px] font-medium leading-5 text-text-1">{term}</dt>
                <dd className="mt-1 text-[12px] leading-[19px] text-text-2">{detail}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-10 border-t border-divider pt-8">
          <h2 className="text-[18px] font-semibold leading-7 text-text-1">What is not stored</h2>
          <ul className="mt-4 flex flex-col gap-2 text-[13px] leading-[21px] text-text-2">
            {[
              "The plaintext webhook token. Only its hash and last four characters are kept.",
              "Passwords, emails, or account records. There are no accounts.",
              "Advertising identifiers, cross-site trackers, or session replay.",
              "A copy of your response, because fishook never forwards the request to your API.",
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <span aria-hidden="true" className="mt-[9px] size-1 shrink-0 rounded-full bg-text-3" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10 border-t border-divider pt-8">
          <h2 className="text-[18px] font-semibold leading-7 text-text-1">Cookies</h2>
          <p className="mt-3 text-[13px] leading-[21px] text-text-2">
            One cookie, <code className="fk-mono-data text-text-1">fishook_session</code>. It is
            httpOnly, SameSite=Lax, Secure on HTTPS, and signed with the server secret. It contains
            the endpoint ID and the write token so the webhook URL can be shown again. It expires
            after one year and is refreshed on each visit. There is no analytics cookie and no
            third-party cookie.
          </p>
        </section>

        <section className="mt-10 border-t border-divider pt-8">
          <h2 className="text-[18px] font-semibold leading-7 text-text-1">Retention</h2>
          <div className="mt-4 overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[420px] border-collapse text-left text-[12px]">
              <tbody className="divide-y divide-divider">
                {[
                  ["Events and payloads", "72 hours, then deleted by a scheduled job"],
                  ["Rejected request counts", "1 hour"],
                  ["Schemas", "Until no samples remain for that event type"],
                  ["Endpoint", "Until you delete it"],
                ].map(([term, detail]) => (
                  <tr key={term}>
                    <td className="w-[190px] px-3 py-2 text-text-3">{term}</td>
                    <td className="px-3 py-2 text-text-1">{detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] leading-[19px] text-text-3">
            Database and hosting backups can outlive the retention window. Their schedule belongs
            to the deployment, not to fishook. Check the provider settings if that matters to you.
          </p>
        </section>

        <section className="mt-10 border-t border-divider pt-8">
          <h2 className="text-[18px] font-semibold leading-7 text-text-1">Deleting data</h2>
          <p className="mt-3 text-[13px] leading-[21px] text-text-2">
            Open the endpoint menu in the header and choose Delete endpoint. That removes the
            endpoint, its events, its rejected-request rows, and its generated schemas, then clears
            the cookie. To remove only the browser key, clear the{" "}
            <code className="fk-mono-data text-text-1">fishook_session</code> cookie. The endpoint
            stays in the database until it is deleted from a browser that still holds the cookie.
          </p>
        </section>

        <section className="mt-10 border-t border-divider pt-8">
          <h2 className="text-[18px] font-semibold leading-7 text-text-1">Contact</h2>
          <p className="mt-3 text-[13px] leading-[21px] text-text-2">
            {site.github ? (
              <>
                This deployment is self-hosted. Open an issue in the{" "}
                <a
                  href={site.github}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-text-1 underline"
                >
                  repository
                </a>{" "}
                for questions about the data model or to report a problem.
              </>
            ) : (
              <>
                This deployment is self-hosted and has no public contact channel configured. The
                operator of the instance is responsible for data requests.
              </>
            )}
          </p>
          <p className="mt-6 text-[11px] leading-4 text-text-3">
            Last updated 2026-11-17.{" "}
            <Link href="/docs" className="underline hover:text-text-1">
              Read the docs
            </Link>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
