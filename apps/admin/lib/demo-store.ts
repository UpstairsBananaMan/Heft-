import fs from "node:fs";
import path from "node:path";
import { applyDemo, createDemoQuery, createDemoState, DEMO_IDS, prepareDemoState, type DemoRequest, type DemoState } from "@heft/shared";

const file = path.join(process.cwd(), ".demo-state.json");

export function demoModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "1";
}

function readState(): DemoState {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    const prepared = prepareDemoState(parsed);
    if (prepared.migrated) fs.writeFileSync(file, JSON.stringify(prepared.state));
    return prepared.state;
  } catch {
    const seed = createDemoState();
    try {
      fs.writeFileSync(file, JSON.stringify(seed));
    } catch {
      // A read-only disk still gets a fresh in-memory sample.
    }
    return seed;
  }
}

function writeState(state: DemoState) {
  fs.writeFileSync(file, JSON.stringify(state));
}

export function runDemo(request: DemoRequest) {
  const state = readState();
  const applied = applyDemo(state, request);
  if (request.kind === "invoke" || (request.kind === "query" && request.action !== "select")) writeState(applied.state);
  return applied.result;
}

const PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="100%" height="100%" fill="#1A1D21"/><text x="32" y="210" fill="#F4F1EA" font-size="28" font-family="sans-serif">Demo proof photo</text></svg>`,
  );

export function createAdminDemoClient() {
  const actor = { id: DEMO_IDS.admin, role: "admin" as const };
  const query = createDemoQuery((request) => runDemo({ ...request, actor }));
  return {
    ...query,
    auth: {
      async getUser() {
        return { data: { user: { id: DEMO_IDS.admin, email: "admin@heft.local" } }, error: null };
      },
      async signOut() {
        return { error: null };
      },
    },
    storage: {
      from() {
        return {
          async createSignedUrl() {
            return { data: { signedUrl: PHOTO }, error: null };
          },
          async upload(uploadPath: string) {
            return { data: { path: uploadPath }, error: null };
          },
        };
      },
    },
  };
}
