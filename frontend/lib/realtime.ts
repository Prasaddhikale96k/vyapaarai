"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";

export type LiveState = "live" | "polling";

export interface RealtimePayload {
  eventType: "INSERT" | "UPDATE" | "DELETE" | string;
  schema: string;
  table: string;
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}

let _client: SupabaseClient | null = null;

export function supabase(): SupabaseClient | null {
  try {
    if (_client) return _client;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    _client = createClient(url, key);
    return _client;
  } catch {
    return null;
  }
}

function configured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Subscribe to postgres_changes on `tables`; debounced onEvent (300ms) on any
 * change. Returns "live" once SUBSCRIBED, "polling" on error/close/unconfigured.
 * Callers keep a long safety poll (300s) as fallback.
 */
export function useRealtime(
  tables: string[],
  onEvent: (payload?: RealtimePayload) => void
): LiveState {
  const [live, setLive] = useState<LiveState>("polling");
  const cb = useRef(onEvent);
  cb.current = onEvent;
  const key = tables.join(",");

  useEffect(() => {
    if (!configured() || tables.length === 0) {
      setLive("polling");
      return;
    }
    const sb = supabase();
    if (!sb) {
      setLive("polling");
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ch: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let timer: any = null;
    const fire = (payload?: RealtimePayload) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cb.current(payload), 300);
    };
    try {
      ch = sb.channel(`rt-${tables.join("-")}`);
      for (const table of tables) {
        ch = ch.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload: any) => fire(payload as RealtimePayload)
        );
      }
      ch.subscribe((status: string) => {
        if (status === "SUBSCRIBED") setLive("live");
        else if (status === "CHANNEL_ERROR" || status === "CLOSED" || status === "TIMED_OUT")
          setLive("polling");
      });
    } catch {
      setLive("polling");
    }
    return () => {
      try {
        if (timer) clearTimeout(timer);
      } catch {
        /* ignore */
      }
      try {
        if (ch) sb.removeChannel(ch);
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return live;
}
