import type { Role } from "../types";

export type DemoRow = Record<string, unknown>;

export type DemoState = {
  users: DemoRow[];
  customer_profiles: DemoRow[];
  driver_profiles: DemoRow[];
  jobs: DemoRow[];
  job_events: DemoRow[];
  job_photos: DemoRow[];
  disputes: DemoRow[];
  payouts: DemoRow[];
  pricing_rules: DemoRow[];
  ratings: DemoRow[];
  device_tokens: DemoRow[];
  driver_documents: DemoRow[];
  feed_posts: DemoRow[];
};

export type DemoActor = { id: string; role: Role };

export type DemoFilter = { op: "eq" | "in" | "gte"; column: string; value: unknown };

export type DemoQuery = {
  kind: "query";
  table: string;
  action: "select" | "insert" | "update" | "upsert";
  select?: string;
  filters?: DemoFilter[];
  orders?: { column: string; ascending: boolean }[];
  limit?: number;
  head?: boolean;
  count?: "exact" | null;
  single?: "maybe" | "one" | null;
  payload?: DemoRow | DemoRow[];
  onConflict?: string;
  actor?: DemoActor;
};

export type DemoInvoke = {
  kind: "invoke";
  name: string;
  body?: Record<string, unknown>;
  actor?: DemoActor;
};

export type DemoRequest = DemoQuery | DemoInvoke;

export type DemoResult = {
  data: unknown;
  error: { message: string } | null;
  count: number | null;
};
