"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Icon } from "./Icon";

export function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  destructive,
  busy,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  busy: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[50] bg-surface-0/70" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-surface-3 p-6 shadow-[0_16px_48px_rgba(0,0,0,0.45)]"
          aria-modal="true"
          aria-describedby={undefined}
        >
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="fk-title text-text-1">{title}</Dialog.Title>
            <Dialog.Close
              aria-label="Close dialog"
              className="-m-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-text-2 hover:bg-hover hover:text-text-1 md:size-8"
            >
              <Icon name="close" size={18} />
            </Dialog.Close>
          </div>
          <p className="mt-2 max-w-[42ch] text-[13px] leading-[20px] text-text-2">{body}</p>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center rounded-md border border-outline px-4 text-[13px] font-medium text-text-1 hover:bg-hover md:h-8"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className={`inline-flex h-11 items-center gap-2 rounded-md px-4 text-[13px] font-medium disabled:cursor-wait disabled:opacity-60 md:h-8 ${
                destructive
                  ? "border border-error/40 text-error hover:bg-error-tint"
                  : "bg-primary text-on-primary hover:bg-primary-hover"
              }`}
            >
              {busy ? <Spinner /> : null}
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
