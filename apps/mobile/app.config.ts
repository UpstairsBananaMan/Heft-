import type { ExpoConfig } from "expo/config";

const brand = require("../../packages/shared/brand.json") as { appName: string };
const APP_NAME = brand.appName;
const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const config: ExpoConfig = {
  name: APP_NAME,
  slug: "heft",
  scheme: "heft",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  web: { name: APP_NAME, shortName: APP_NAME },
  newArchEnabled: true,
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#1A1D21",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.heft.app",
    entitlements: {
      "com.apple.developer.usernotifications.time-sensitive": true,
    },
    config: mapsKey ? { googleMapsApiKey: mapsKey } : undefined,
    infoPlist: {
      NSCameraUsageDescription: `${APP_NAME} uses the camera for delivery photos.`,
      NSPhotoLibraryUsageDescription: `${APP_NAME} needs photos of the item and the delivery.`,
      NSLocationWhenInUseUsageDescription: `${APP_NAME} uses your location while a job is active so the customer can see the truck.`,
    },
  },
  android: {
    package: "com.heft.app",
    softwareKeyboardLayoutMode: "resize",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#1A1D21",
    },
    config: mapsKey ? { googleMaps: { apiKey: mapsKey } } : undefined,
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: false,
        data: [
      { scheme: "heft", host: "auth", pathPrefix: "/callback" },
      { scheme: "heft", host: "stripe", pathPrefix: "/connect" },
    ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  plugins: [
    "expo-router",
    [
      "expo-location",
      {
        locationWhenInUsePermission: `${APP_NAME} uses your location while a job is active so the customer can see the truck.`,
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: `${APP_NAME} needs photos of the item and the delivery.`,
        cameraPermission: `${APP_NAME} uses the camera for delivery photos.`,
      },
    ],
    "expo-font",
    "expo-notifications",
    "expo-secure-store",
  ],
  extra: process.env.EXPO_PUBLIC_EAS_PROJECT_ID
    ? { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } }
    : undefined,
  experiments: { typedRoutes: false },
};

export default config;
