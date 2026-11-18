export default function AppLoading() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-surface-0" aria-busy="true">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-divider bg-surface-1 px-4">
        <div className="fk-skeleton h-5 w-24" />
        <div className="fk-skeleton h-8 w-20" />
      </div>
      <div className="border-b border-divider bg-surface-1 px-4 py-2">
        <div className="fk-skeleton h-3 w-20" />
        <div className="mt-2 flex gap-2">
          <div className="fk-skeleton h-9 flex-1" />
          <div className="fk-skeleton h-8 w-20" />
          <div className="fk-skeleton size-8" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="flex min-h-0 flex-1 flex-col gap-2 border-b border-divider p-4 md:w-[46%] md:border-b-0 md:border-r lg:w-[42%]">
          <div className="fk-skeleton h-3 w-16" />
          <div className="mt-2 flex flex-col gap-2">
            {[72, 88, 64, 81, 58, 76].map((width) => (
              <div key={width} className="flex items-center gap-4">
                <div className="fk-skeleton h-3 w-12" />
                <div className="fk-skeleton size-2 rounded-full" />
                <div className="fk-skeleton h-3" style={{ width: `${width}%` }} />
              </div>
            ))}
          </div>
        </div>
        <div className="hidden min-h-0 flex-1 flex-col gap-2 p-4 md:flex md:w-[54%] lg:w-[58%]">
          <div className="fk-skeleton h-8 w-48" />
          <div className="fk-skeleton h-3 w-36" />
          <div className="mt-3 flex flex-col gap-2">
            {[64, 52, 71, 44, 60, 36].map((width) => (
              <div key={width} className="fk-skeleton h-3" style={{ width: `${width}%` }} />
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only" role="status">
        Loading the endpoint
      </span>
    </div>
  );
}
