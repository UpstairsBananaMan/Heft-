import "react-native-gesture-handler";
import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import * as Linking from "expo-linking";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ToastHost } from "../src/components/ToastHost";
import { completeAuthFromUrl } from "../src/lib/auth-link";
import { useSession } from "../src/store/session";

const queryClient = new QueryClient();

export default function RootLayout() {
  const boot = useSession((state) => state.boot);
  useEffect(() => {
    void boot();
    void Linking.getInitialURL().then((url) => completeAuthFromUrl(url).catch(() => undefined));
    const subscription = Linking.addEventListener("url", ({ url }) => {
      void completeAuthFromUrl(url).catch(() => undefined);
    });
    return () => subscription.remove();
  }, [boot]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#F4F1EA" } }} />
        <ToastHost />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
