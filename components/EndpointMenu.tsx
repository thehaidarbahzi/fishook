"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

export function EndpointMenu({
  tokenTail,
  rejected,
  payloadCount,
  onRotated,
  onDeleted,
}: {
  tokenTail: string;
  rejected: number;
  payloadCount: number;
  onRotated: (url: string, tail: string) => void;
  onDeleted: () => void;
}) {
  const { notify } = useToast();
  const [rotateOpen, setRotateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function rotate() {
    setBusy(true);
    try {
      const response = await fetch("/api/session/rotate", { method: "POST" });
      if (!response.ok) throw new Error("rotate failed");
      const data = (await response.json()) as { url: string; tokenTail: string };
      onRotated(data.url, data.tokenTail);
      setRotateOpen(false);
      notify("New URL ready. Update your provider.");
    } catch {
      notify("Could not rotate the URL. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const response = await fetch("/api/session/delete", { method: "POST" });
      if (!response.ok) throw new Error("delete failed");
      setDeleteOpen(false);
      onDeleted();
    } catch {
      notify("Could not delete the endpoint. Try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={`Endpoint menu, URL ending ${tokenTail}`}
            className="inline-flex h-11 items-center gap-1.5 rounded-md px-2 text-[12px] text-text-2 hover:bg-hover hover:text-text-1 data-[state=open]:bg-hover md:h-8"
          >
            <Icon name="link" size={16} />
            <span className="fk-mono-data hidden sm:inline">…{tokenTail}</span>
            <Icon name="chevron" size={16} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="z-30 min-w-[248px] rounded-md border border-line bg-surface-3 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
          >
            <div className="px-2 py-1.5">
              <p className="fk-micro text-text-3">Endpoint</p>
              <p className="fk-mono-data mt-0.5 text-[12px] text-text-1">…{tokenTail}</p>
              <p className="mt-1 text-[11px] leading-4 text-text-3">
                {rejected > 0
                  ? `${rejected} rejected in the last hour`
                  : "No rejected requests in the last hour"}
              </p>
            </div>
            <DropdownMenu.Separator className="my-1 h-px bg-divider" />
            <DropdownMenu.Item asChild>
              <Link
                href="/privacy"
                className="flex h-11 cursor-pointer items-center rounded-sm px-2 text-[13px] text-text-1 outline-none data-[highlighted]:bg-hover md:h-9"
              >
                What is stored
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => setRotateOpen(true)}
              className="flex h-11 cursor-pointer items-center rounded-sm px-2 text-[13px] text-text-1 outline-none data-[highlighted]:bg-hover md:h-9"
            >
              Rotate URL
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-divider" />
            <DropdownMenu.Item
              onSelect={() => setDeleteOpen(true)}
              className="flex h-11 cursor-pointer items-center rounded-sm px-2 text-[13px] text-error outline-none data-[highlighted]:bg-error-tint md:h-9"
            >
              Delete endpoint
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <ConfirmDialog
        open={rotateOpen}
        onClose={() => setRotateOpen(false)}
        title="Rotate this URL?"
        body="The old URL stops working immediately. Captured payloads stay."
        confirmLabel="Rotate URL"
        busy={busy}
        onConfirm={rotate}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete endpoint and ${payloadCount} ${payloadCount === 1 ? "payload" : "payloads"}?`}
        body="This removes the endpoint, its payloads, and its generated models. It cannot be undone."
        confirmLabel="Delete endpoint"
        destructive
        busy={busy}
        onConfirm={remove}
      />
    </>
  );
}
