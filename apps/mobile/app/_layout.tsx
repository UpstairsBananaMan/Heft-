import "react-native-gesture-handler";
import "../global.css";
import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { OfflineBanner } from "../src/components/OfflineBanner";
import { ToastHost } from "../src/components/ToastHost";
import { completeAuthFromUrl } from "../src/lib/auth-link";
import { useSession } from "../src/store/session";

const queryClient = new QueryClient();

export default function RootLayout() {
  const boot = useSession((state) => state.boot);
  const router = useRouter();
  useEffect(() => {
    void boot();
    void Linking.getInitialURL().then((url) => completeAuthFromUrl(url).catch(() => undefined));
    const subscription = Linking.addEventListener("url", ({ url }) => {
      void completeAuthFromUrl(url).catch(() => undefined);
    });
    let opened: { remove: () => void } | undefined;
    try {
      opened = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as { job_id?: string };
        const jobId = data?.job_id;
        if (!jobId) return;
        const role = useSession.getState().profile?.role;
        router.push(`/job/${jobId}`);
      });
    } catch {
      opened = undefined;
    }
    return () => {
      subscription.remove();
      opened?.remove();
    };
  }, [boot, router]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#F4F1EA" } }} />
        <OfflineBanner />
        <ToastHost />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
