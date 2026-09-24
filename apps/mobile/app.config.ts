import type { ExpoConfig } from "expo/config";

const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const config: ExpoConfig = {
  name: "Heft",
  slug: "heft",
  scheme: "heft",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  splash: { backgroundColor: "#1A1D21" },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "app.heft.mobile",
    config: mapsKey ? { googleMapsApiKey: mapsKey } : undefined,
  },
  android: {
    package: "app.heft.mobile",
    adaptiveIcon: { backgroundColor: "#1A1D21" },
    config: mapsKey ? { googleMaps: { apiKey: mapsKey } } : undefined,
  },
  plugins: [
    "expo-router",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Heft uses your location while a job is active so the customer can see the truck.",
      },
    ],
    [
      "expo-image-picker",
      { photosPermission: "Heft needs photos of the item and proof of delivery." },
    ],
    "expo-notifications",
  ],
  experiments: { typedRoutes: false },
};

export default config;
