import { useEffect, useState } from "react";
import { supabaseConfigured } from "./supabase";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    if (!supabaseConfigured || !url) return;
    let stop = false;
    async function ping() {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      try {
        const response = await fetch(`${url}/auth/v1/health`, { signal: controller.signal });
        if (!stop) setOnline(response.ok);
      } catch {
        if (!stop) setOnline(false);
      } finally {
        clearTimeout(timer);
      }
    }
    void ping();
    const interval = setInterval(() => void ping(), 20000);
    return () => {
      stop = true;
      clearInterval(interval);
    };
  }, []);
  return online;
}
