import { requireAdmin } from "@/lib/auth";

export default async function CustomersPage() {
  const gate = await requireAdmin();
  if (!gate.configured) return null;
  const { data: customers } = await gate.supabase
    .from("users")
    .select("id, display_name, phone, created_at, customer_profiles(rating_avg, rating_count, default_address)")
    .eq("role", "customer")
    .order("created_at", { ascending: false });

  return (
    <main>
      <h1 className="text-3xl font-semibold">Customers</h1>
      <p className="mt-2 text-sm text-steel">Accounts that signed up as customers. The seed admin is not listed.</p>
      <div className="mt-6 overflow-x-auto border border-line bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wider text-steel">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Phone</th>
              <th className="px-4 py-3 font-semibold">Rating</th>
              <th className="px-4 py-3 font-semibold">Joined</th>
            </tr>
          </thead>
          <tbody>
            {(customers ?? []).map((customer) => {
              const profile = Array.isArray(customer.customer_profiles)
                ? customer.customer_profiles[0]
                : customer.customer_profiles;
              return (
                <tr key={customer.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-semibold">{customer.display_name}</td>
                  <td className="px-4 py-3">{customer.phone ?? "—"}</td>
                  <td className="px-4 py-3 font-mono">
                    {profile ? `${Number(profile.rating_avg).toFixed(2)} (${profile.rating_count})` : "—"}
                  </td>
                  <td className="px-4 py-3 text-steel">{new Date(customer.created_at).toLocaleDateString()}</td>
                </tr>
              );
            })}
            {(customers ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-steel">
                  No customers yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
