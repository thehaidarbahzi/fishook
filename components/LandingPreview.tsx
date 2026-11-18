const rows = [
  { clock: "14:02:11", time: "2026-11-17T14:02:11Z", type: "payment.succeeded", state: "received" },
  { clock: "14:01:47", time: "2026-11-17T14:01:47Z", type: "invoice.paid", state: "received" },
  { clock: "14:01:12", time: "2026-11-17T14:01:12Z", type: "payment.succeeded", state: "duplicate" },
  { clock: "14:00:33", time: "2026-11-17T14:00:33Z", type: "customer.updated", state: "received" },
] as const;

function Knot({ state }: { state: "received" | "duplicate" }) {
  return (
    <span
      aria-hidden="true"
      className={`block size-2 ${
        state === "duplicate"
          ? "rounded-full border border-text-3 bg-surface-0"
          : "rounded-full bg-primary"
      }`}
    />
  );
}

export function LandingPreview() {
  return (
    <div className="flex h-full min-h-[268px] flex-col overflow-hidden rounded-xl border border-line bg-surface-1">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-divider px-4">
        <span className="fk-micro text-text-3">Catch</span>
        <span className="fk-nums text-[11px] leading-4 text-text-3">4 events</span>
      </div>

      <div className="relative flex-1">
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-[72px] top-0 w-[2px] -translate-x-1/2 bg-outline"
        />
        <ul role="list">
          {rows.map((row) => (
            <li key={`${row.type}-${row.time}`}>
              <div className="grid h-9 grid-cols-[56px_32px_minmax(0,1fr)_auto] items-center">
                <time
                  dateTime={row.time}
                  className="fk-mono-data fk-nums pr-1 text-right text-[11px] leading-4 text-text-3"
                >
                  {row.clock}
                </time>
                <span className="flex h-full items-center justify-center">
                  <Knot state={row.state} />
                </span>
                <span className="min-w-0 truncate pl-2 text-[13px] font-medium leading-5 text-text-1">
                  {row.type}
                </span>
                <span className="pr-4 text-[10px] leading-4 text-text-3">
                  {row.state === "duplicate" ? "dup" : ""}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="shrink-0 border-t border-divider bg-surface-0 px-4 py-3">
        <p className="fk-mono-data overflow-x-auto whitespace-nowrap text-[11px] leading-[18px] text-text-2">
          <span className="text-code-keyword">type</span>{" "}
          <span className="text-code-type">PaymentSucceeded</span>{" "}
          <span className="text-code-keyword">struct</span> {"{"}
          <br />
          {"  "}
          <span className="text-text-1">Amount</span>
          {"    "}
          <span className="text-code-type">int64</span>
          <br />
          {"  "}
          <span className="text-text-1">Refunded</span>
          {"  "}
          <span className="text-code-type">*bool</span>
          <span className="text-code-comment"> // optional, 1/2</span>
          <br />
          {"}"}
        </p>
      </div>
    </div>
  );
}
