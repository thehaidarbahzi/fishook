import { LocalStore, localStore } from "./local";
import { SupabaseStore } from "./supabase";
import type { Store } from "./types";

let warned = false;

export function getStore(): Store {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && key) {
    return new SupabaseStore(url, key);
  }

  if (!warned && process.env.NODE_ENV !== "test") {
    warned = true;
    console.warn(
      "fishook: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set. Using the local file store at .data/store.json. This mode is single-process and for development only.",
    );
  }

  return localStore();
}

export function storeMode(): "supabase" | "local" {
  return process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? "supabase"
    : "local";
}

export type { Store, LocalStore };
