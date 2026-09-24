import { Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Notice, Screen } from "../../src/components/ui";

export default function StripeConnectReturn() {
  const { result } = useLocalSearchParams<{ result?: string }>();
  return (
    <Screen title="Payouts" back>
      <Notice>DRAFT payout return. This is not a bank confirmation.</Notice>
      <Text className="text-sm leading-6 text-charcoal">
        {result === "refresh"
          ? "Stripe asked you to start the link again. Open Set up payouts from Account."
          : "If Stripe test mode was open, you can return to jobs. A missing Stripe secret means no account was created."}
      </Text>
    </Screen>
  );
}