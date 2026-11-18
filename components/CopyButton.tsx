"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

type Variant = "primary" | "tonal" | "outline" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-pressed",
  tonal:
    "bg-primary-container text-on-primary-container hover:brightness-110 active:brightness-95",
  outline:
    "border border-outline text-text-1 hover:bg-hover active:bg-pressed",
  ghost: "text-text-2 hover:bg-hover hover:text-text-1 active:bg-pressed",
};

export function selectNodeText(node: HTMLElement | null) {
  if (!node) return;
  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export function CopyButton({
  text,
  label = "Copy",
  variant = "outline",
  selectOnError,
  ariaLabel,
  className = "",
  disabled = false,
}: {
  text: string;
  label?: string;
  variant?: Variant;
  selectOnError?: () => void;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function resetLater() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1500);
  }

  async function copy() {
    if (disabled) return;
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      try {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.top = "-1000px";
        document.body.appendChild(area);
        area.select();
        ok = document.execCommand("copy");
        area.remove();
      } catch {
        ok = false;
      }
    }

    if (ok) {
      setState("copied");
      resetLater();
    } else {
      setState("error");
      selectOnError?.();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setState("idle"), 4000);
    }
  }

  const visible = state === "copied" ? "Copied" : state === "error" ? "Select and copy manually" : label;

  return (
    <>
      <button
        type="button"
        onClick={copy}
        disabled={disabled}
        aria-label={ariaLabel ?? (label || "Copy")}
        className={`inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md px-3 text-[13px] font-medium transition-[background-color,color,filter] duration-100 disabled:cursor-not-allowed disabled:opacity-40 md:h-8 ${VARIANTS[variant]} ${className}`}
      >
        <Icon name={state === "copied" ? "check" : "copy"} size={16} />
        {label ? <span>{visible}</span> : null}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {state === "copied" ? "Copied to clipboard" : state === "error" ? "Copy failed. Select and copy manually." : ""}
      </span>
    </>
  );
}
