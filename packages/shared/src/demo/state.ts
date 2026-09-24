import { createDemoState, DEMO_SCHEMA_VERSION } from "./seed";
import type { DemoState } from "./types";

export { DEMO_SCHEMA_VERSION };

export const DEMO_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
} as const;

export function demoErrorResult(error: unknown) {
  const message = error instanceof Error ? error.message : "Demo request failed";
  return { data: null, error: { message }, count: null };
}

/**
 * Current files pass through. Older files keep the tables they have and
 * pick up anything new from a fresh seed. Unreadable shapes start over.
 */
export function prepareDemoState(value: unknown): { state: DemoState; migrated: boolean } {
  const seed = createDemoState();
  if (!value || typeof value !== "object" || Array.isArray(value)) return { state: seed, migrated: true };
  const raw = value as Record<string, unknown>;
  const current =
    raw.schema_version === DEMO_SCHEMA_VERSION &&
    Array.isArray(raw.jobs) &&
    Array.isArray(raw.users) &&
    Array.isArray(raw.feed_posts);
  if (current) return { state: raw as unknown as DemoState, migrated: false };
  if (!Array.isArray(raw.jobs) || !Array.isArray(raw.users)) return { state: seed, migrated: true };
  const next = { ...seed, schema_version: DEMO_SCHEMA_VERSION };
  for (const key of Object.keys(seed) as (keyof DemoState)[]) {
    if (key === "schema_version") continue;
    if (Array.isArray(raw[key as string])) (next as Record<string, unknown>)[key] = raw[key as string];
  }
  return { state: next, migrated: true };
}
