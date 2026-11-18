"use client";

import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { Icon } from "./Icon";
import { useToast } from "./Toast";
import { Tip } from "./Tooltip";

export function RotateUrlButton({
  onRotated,
}: {
  onRotated: (url: string, tail: string) => void;
}) {
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function rotate() {
    setBusy(true);
    try {
      const response = await fetch("/api/session/rotate", { method: "POST" });
      if (!response.ok) throw new Error("rotate failed");
      const data = (await response.json()) as { url: string; tokenTail: string };
      onRotated(data.url, data.tokenTail);
      setOpen(false);
      notify("New URL ready. Update your provider.");
    } catch {
      notify("Could not rotate the URL. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Tip label="Rotate URL">
        <button
          type="button"
          aria-label="Rotate URL"
          onClick={() => setOpen(true)}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-text-2 hover:bg-hover hover:text-text-1 md:size-8"
        >
          <Icon name="refresh" size={18} />
        </button>
      </Tip>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Rotate this URL?"
        body="The old URL stops working immediately. Captured payloads stay."
        confirmLabel="Rotate URL"
        busy={busy}
        onConfirm={rotate}
      />
    </>
  );
}
