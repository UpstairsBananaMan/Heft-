import { Text } from "react-native";
import { PRIVACY_DRAFT, TERMS_DRAFT } from "@heft/shared";
import { Notice, Screen } from "../components/ui";

export function LegalScreen({ kind }: { kind: "privacy" | "terms" }) {
  const body = kind === "privacy" ? PRIVACY_DRAFT : TERMS_DRAFT;
  const title = kind === "privacy" ? "Privacy Policy" : "Terms of Service";
  return (
    <Screen title={title} back>
      <Notice>DRAFT. Not legal advice. A lawyer must replace this before a store release.</Notice>
      {body.split("\n\n").map((paragraph) => (
        <Text key={paragraph.slice(0, 24)} className="mb-4 text-sm leading-6 text-charcoal">
          {paragraph}
        </Text>
      ))}
    </Screen>
  );
}
