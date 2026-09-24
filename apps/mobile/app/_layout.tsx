import "react-native-gesture-handler";
import "react-native-reanimated";
import "../global.css";
import { useEffect } from "react";
import { View } from "react-native";
import { Stack, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { OfflineBanner } from "../src/components/OfflineBanner";
import { ToastHost } from "../src/components/ToastHost";
import { completeAuthFromUrl } from "../src/lib/auth-link";
import { useSession } from "../src/store/session";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

export default function RootLayout() {
  const boot = useSession((state) => state.boot);
  const ready = useSession((state) => state.ready);
  const router = useRouter();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  useEffect(() => {
    if ((fontsLoaded || fontError) && ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded, fontError, ready]);
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

  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: "#1A1D21" }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#F4F1EA" } }} />
          <OfflineBanner />
          <ToastHost />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
