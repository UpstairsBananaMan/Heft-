import type { DemoQuery, DemoRequest, DemoResult } from "./types";

type Run = (request: DemoRequest) => Promise<DemoResult> | DemoResult;

export function createDemoQuery(run: Run) {
  function from(table: string) {
    const req: DemoQuery = { kind: "query", table, action: "select", filters: [], orders: [] };
    const self = {
      select(columns?: string, options?: { count?: "exact"; head?: boolean }) {
        req.select = columns ?? "*";
        if (options?.count) req.count = options.count;
        if (options?.head) req.head = true;
        return self;
      },
      eq(column: string, value: unknown) {
        req.filters?.push({ op: "eq", column, value });
        return self;
      },
      in(column: string, value: unknown[]) {
        req.filters?.push({ op: "in", column, value });
        return self;
      },
      gte(column: string, value: unknown) {
        req.filters?.push({ op: "gte", column, value });
        return self;
      },
      order(column: string, options?: { ascending?: boolean }) {
        req.orders?.push({ column, ascending: options?.ascending !== false });
        return self;
      },
      limit(count: number) {
        req.limit = count;
        return self;
      },
      insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
        req.action = "insert";
        req.payload = payload;
        return self;
      },
      update(payload: Record<string, unknown>) {
        req.action = "update";
        req.payload = payload;
        return self;
      },
      upsert(payload: Record<string, unknown>, options?: { onConflict?: string }) {
        req.action = "upsert";
        req.payload = payload;
        req.onConflict = options?.onConflict;
        return self;
      },
      maybeSingle() {
        req.single = "maybe";
        return Promise.resolve(run(req));
      },
      single() {
        req.single = "one";
        return Promise.resolve(run(req));
      },
      then(resolve: (value: DemoResult) => unknown, reject?: (reason: unknown) => unknown) {
        return Promise.resolve(run(req)).then(resolve, reject);
      },
    };
    return self;
  }

  function rpc(name: string, args?: Record<string, unknown>) {
    const body = { ...(args ?? {}) };
    if (name === "assigned_driver_card") body.job_id = args?.p_job_id ?? args?.job_id;
    return Promise.resolve(run({ kind: "invoke", name, body }));
  }

  return { from, rpc };
}
