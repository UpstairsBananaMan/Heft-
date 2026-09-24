import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { completeAuthFromUrl } from "../../src/lib/auth-link";
import { errorText } from "../../src/lib/invoke";

export default function AuthCallback() {
  const router = useRouter();
  const url = Linking.useURL();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function finish(target: string | null) {
      try {
        await completeAuthFromUrl(target);
        if (!cancelled) router.replace("/");
      } catch (err) {
        if (!cancelled) setError(errorText(err));
      }
    }
    void finish(url);
    return () => {
      cancelled = true;
    };
  }, [router, url]);

  return (
    <View style={{ flex: 1, backgroundColor: "#1A1D21", alignItems: "center", justifyContent: "center", padding: 24 }}>
      {error ? (
        <Text style={{ color: "#F4F1EA", textAlign: "center", lineHeight: 22 }}>{error}</Text>
      ) : (
        <ActivityIndicator color="#E8A317" />
      )}
    </View>
  );
}
