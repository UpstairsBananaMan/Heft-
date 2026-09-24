import { BottomNav } from "../../src/components/ui";
import { AccountScreen } from "../../src/screens/AccountScreen";

const NAV = [
  { href: "/(driver)/map" as const, label: "Map" },
  { href: "/(driver)/earnings" as const, label: "Earnings" },
  { href: "/(driver)/account" as const, label: "Account" },
];

export default function DriverAccount() {
  return <AccountScreen homeHref="/(driver)/map" footer={<BottomNav items={NAV} />} />;
}
