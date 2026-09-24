import { VEHICLE_LABEL } from "@heft/shared";
import { setDriverStatus } from "@/lib/actions";
import { requireAdmin } from "@/lib/auth";

export default async function DriversPage() {
  const gate = await requireAdmin();
  if (!gate.configured) return null;
  const { data: drivers } = await gate.supabase
    .from("driver_profiles")
    .select("*, users(display_name, phone)")
    .order("status", { ascending: true });

  return (
    <main>
      <h1 className="text-3xl font-semibold">Drivers</h1>
      <p className="mt-2 max-w-2xl text-sm text-steel">
        New drivers stay pending until you approve them. Only approved, online drivers can see and accept open jobs.
      </p>
      <ul className="mt-6 space-y-4">
        {(drivers ?? []).map((driver) => {
          const user = Array.isArray(driver.users) ? driver.users[0] : driver.users;
          return (
            <li key={driver.user_id} className="border border-line bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">{user?.display_name ?? "Driver"}</p>
                  <p className="mt-1 text-sm text-steel">
                    {VEHICLE_LABEL[driver.vehicle_type] ?? driver.vehicle_type} · {driver.status}
                    {driver.is_online ? " · online" : " · offline"}
                  </p>
                  <p className="mt-1 text-sm text-steel">
                    Service {Number(driver.service_lat).toFixed(3)}, {Number(driver.service_lng).toFixed(3)} ·{" "}
                    {Number(driver.service_radius_miles)} mi
                  </p>
                </div>
                <div className="flex gap-2">
                  {driver.status !== "approved" ? (
                    <form action={setDriverStatus}>
                      <input type="hidden" name="user_id" value={driver.user_id} />
                      <input type="hidden" name="status" value="approved" />
                      <button className="h-10 bg-amber px-4 text-sm font-semibold" type="submit">
                        Approve
                      </button>
                    </form>
                  ) : null}
                  {driver.status !== "suspended" ? (
                    <form action={setDriverStatus}>
                      <input type="hidden" name="user_id" value={driver.user_id} />
                      <input type="hidden" name="status" value="suspended" />
                      <button className="h-10 border border-charcoal px-4 text-sm font-semibold" type="submit">
                        Suspend
                      </button>
                    </form>
                  ) : (
                    <form action={setDriverStatus}>
                      <input type="hidden" name="user_id" value={driver.user_id} />
                      <input type="hidden" name="status" value="pending" />
                      <button className="h-10 border border-charcoal px-4 text-sm font-semibold" type="submit">
                        Mark pending
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </li>
          );
        })}
        {(drivers ?? []).length === 0 ? <li className="text-sm text-steel">No driver profiles yet.</li> : null}
      </ul>
    </main>
  );
}
