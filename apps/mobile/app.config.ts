import type { ExpoConfig } from "expo/config";

const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const config: ExpoConfig = {
  name: "Heft",
  slug: "heft",
  scheme: "heft",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#1A1D21",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.heft.app",
    config: mapsKey ? { googleMapsApiKey: mapsKey } : undefined,
    infoPlist: {
      NSCameraUsageDescription: "Heft uses the camera for proof-of-delivery photos.",
      NSPhotoLibraryUsageDescription: "Heft needs photos of the item and proof of delivery.",
      NSLocationWhenInUseUsageDescription:
        "Heft uses your location while a job is active so the customer can see the truck.",
    },
  },
  android: {
    package: "com.heft.app",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#1A1D21",
    },
    config: mapsKey ? { googleMaps: { apiKey: mapsKey } } : undefined,
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: false,
        data: [{ scheme: "heft", host: "auth", pathPrefix: "/callback" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
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
      {
        photosPermission: "Heft needs photos of the item and proof of delivery.",
        cameraPermission: "Heft uses the camera for proof-of-delivery photos.",
      },
    ],
    "expo-notifications",
    "expo-secure-store",
  ],
  experiments: { typedRoutes: false },
};

export default config;
