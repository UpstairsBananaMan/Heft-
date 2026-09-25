import { applyDemo, createDemoQuery, createDemoState, DEMO_IDS, prepareDemoState, type DemoRequest, type DemoState } from "@heft/shared";

export const demoMode = process.env.EXPO_PUBLIC_DEMO_MODE === "1";

const ROLE_KEY = "heft-demo-role";
const STATE_KEY = "heft-demo-state";
const api = process.env.EXPO_PUBLIC_DEMO_API || "http://localhost:3000/api/demo";

type RoleName = "customer" | "driver" | "partner";
type Listener = (event: string, session: { user: { id: string; email: string } } | null) => void;

const listeners = new Set<Listener>();
let memory: DemoState | null = null;

const PEOPLE = {
  customer: { id: DEMO_IDS.customer, email: "customer@heft.local", role: "customer" as const },
  driver: { id: DEMO_IDS.driver, email: "driver@heft.local", role: "driver" as const },
  partner: { id: DEMO_IDS.partner, email: "partner@heft.local", role: "driver" as const },
};

function storage(): Storage | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

export function demoRole(): RoleName | null {
  const value = storage()?.getItem(ROLE_KEY);
  return value === "driver" || value === "customer" || value === "partner" ? value : null;
}

export function demoPerson(role: RoleName) {
  return PEOPLE[role];
}

export function setDemoRole(role: RoleName | null) {
  const store = storage();
  if (!role) store?.removeItem(ROLE_KEY);
  else store?.setItem(ROLE_KEY, role);
  const session = role ? { user: { id: PEOPLE[role].id, email: PEOPLE[role].email } } : null;
  for (const listener of listeners) listener(role ? "SIGNED_IN" : "SIGNED_OUT", session);
}

function actor() {
  const role = demoRole();
  if (!role) return undefined;
  return { id: PEOPLE[role].id, role: PEOPLE[role].role };
}

function loadMemory(): DemoState {
  if (memory) return memory;
  const raw = storage()?.getItem(STATE_KEY);
  if (raw) {
    try {
      const prepared = prepareDemoState(JSON.parse(raw) as unknown);
      memory = prepared.state;
      if (prepared.migrated) storage()?.setItem(STATE_KEY, JSON.stringify(memory));
      return memory;
    } catch {
      // Fall through to a fresh sample.
    }
  }
  memory = createDemoState();
  return memory;
}

function saveMemory(state: DemoState) {
  memory = state;
  storage()?.setItem(STATE_KEY, JSON.stringify(state));
}

async function run(request: DemoRequest) {
  const withActor = { ...request, actor: actor() };
  try {
    const response = await fetch(api, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(withActor),
    });
    if (response.ok) return response.json();
  } catch {
    // Static export and offline review keep a copy in this browser.
  }
  const applied = applyDemo(loadMemory(), withActor);
  saveMemory(applied.state);
  return applied.result;
}

const PHOTO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="100%" height="100%" fill="#1A1D21"/><text x="32" y="210" fill="#F4F1EA" font-size="28" font-family="sans-serif">Demo proof photo</text></svg>`,
  );

export function createMobileDemo() {
  const query = createDemoQuery(run);
  return {
    ...query,
    auth: {
      async getSession() {
        const role = demoRole();
        return { data: { session: role ? { user: { id: PEOPLE[role].id, email: PEOPLE[role].email } } : null }, error: null };
      },
      async getUser() {
        const role = demoRole();
        return { data: { user: role ? { id: PEOPLE[role].id, email: PEOPLE[role].email } : null }, error: null };
      },
      onAuthStateChange(callback: Listener) {
        listeners.add(callback);
        return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
      },
      async signInWithPassword({ email }: { email: string; password: string }) {
        setDemoRole(email.toLowerCase().includes("driver") ? "driver" : "customer");
        return { data: { session: {} }, error: null };
      },
      async signUp({ options }: { email: string; password: string; options?: { data?: { role?: string } } }) {
        setDemoRole(options?.data?.role === "driver" ? "driver" : "customer");
        return { data: { session: { user: {} } }, error: null };
      },
      async signInAnonymously() {
        setDemoRole("customer");
        return {
          data: { user: { id: PEOPLE.customer.id, email: PEOPLE.customer.email }, session: { user: { id: PEOPLE.customer.id, email: PEOPLE.customer.email } } },
          error: null,
        };
      },
      async signOut() {
        setDemoRole(null);
        return { error: null };
      },
      async exchangeCodeForSession() {
        return { error: null };
      },
      async setSession() {
        return { error: null };
      },
      startAutoRefresh() {},
      stopAutoRefresh() {},
    },
    functions: {
      async invoke(name: string, options?: { body?: Record<string, unknown> }) {
        const result = await run({ kind: "invoke", name, body: options?.body });
        return { data: result.error ? { error: result.error.message } : result.data, error: result.error ? { message: result.error.message } : null };
      },
    },
    storage: {
      from() {
        return {
          async upload(path: string) {
            return { data: { path }, error: null };
          },
          async createSignedUrl() {
            return { data: { signedUrl: PHOTO }, error: null };
          },
        };
      },
    },
    channel() {
      const stub = {
        on() {
          return stub;
        },
        subscribe() {
          return stub;
        },
      };
      return stub;
    },
    removeChannel() {},
  };
}
