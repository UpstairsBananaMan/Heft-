import { Redirect } from "expo-router";
import { useSession } from "../../src/store/session";
import CustomerJob from "../../src/screens/CustomerJob";
import DriverJob from "../../src/screens/DriverJob";

export default function JobRoute() {
  const ready = useSession((state) => state.ready);
  const role = useSession((state) => state.profile?.role);
  if (!ready) return null;
  if (!role) return <Redirect href="/(auth)/welcome" />;
  if (role === "driver") return <DriverJob />;
  if (role === "customer") return <CustomerJob />;
  return <Redirect href="/" />;
}
