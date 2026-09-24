import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "supabase", "seed_demo.sql");
const localUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function run(command, args) {
  return spawnSync(command, args, { cwd: root, stdio: "inherit" });
}

function missing(result) {
  return result.error && result.error.code === "ENOENT";
}

let result = run("supabase", ["db", "query", "--local", "-f", file]);
if (result.status !== 0) {
  if (!missing(result)) {
    console.error("\nSupabase CLI could not apply the demo. If the database is not running, start Docker and run: supabase start");
  }
  result = run("psql", [localUrl, "-v", "ON_ERROR_STOP=1", "-f", file]);
}

if (result.status !== 0) {
  if (missing(result)) {
    console.error("Install the Supabase CLI (https://supabase.com/docs/guides/cli) or psql, then run npm run demo again.");
  }
  console.error("Demo seed did not apply. From the Heft folder: supabase start");
  process.exit(result.status ?? 1);
}

console.log(`
Demo seed is in the local database. It is sample data, not a real order.

Customer   customer@heft.local   heft-customer-seed
Driver     driver@heft.local     heft-driver-seed
Admin      admin@heft.local      heft-admin-seed

The driver is already approved and online. Sign in on the phone as the driver and tap Accept on “Demo sofa”.
Or sign in as the customer and open that job.
`);
