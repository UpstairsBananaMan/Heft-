import { Redirect } from "expo-router";
import { useSession } from "../../src/store/session";
import CustomerRate from "../../src/screens/CustomerRate";
import DriverRate from "../../src/screens/DriverRate";

export default function RateRoute() {
  const ready = useSession((state) => state.ready);
  const role = useSession((state) => state.profile?.role);
  if (!ready) return null;
  if (!role) return <Redirect href="/(auth)/welcome" />;
  if (role === "driver") return <DriverRate />;
  if (role === "customer") return <CustomerRate />;
  return <Redirect href="/" />;
}
