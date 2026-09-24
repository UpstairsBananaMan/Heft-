import { BottomNav } from "../../src/components/ui";
import { AccountScreen } from "../../src/screens/AccountScreen";

const NAV = [
  { href: "/(customer)/home" as const, label: "Jobs" },
  { href: "/(customer)/new" as const, label: "New" },
  { href: "/(customer)/account" as const, label: "Account" },
];

export default function CustomerAccount() {
  return <AccountScreen homeHref="/(customer)/home" footer={<BottomNav items={NAV} />} />;
}
