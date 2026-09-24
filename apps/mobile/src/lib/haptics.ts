import { Platform } from "react-native";

/** The only module that imports expo-haptics. Web is a no-op. */
async function fire(kind: "select" | "light" | "medium" | "heavy" | "success" | "warning" | "error") {
  if (Platform.OS === "web") return;
  try {
    const Haptics = await import("expo-haptics");
    if (kind === "select") await Haptics.selectionAsync();
    else if (kind === "success") await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (kind === "warning") await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else if (kind === "error") await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    else if (kind === "light") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (kind === "medium") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {
    // Haptics are optional.
  }
}

export const haptic = {
  select: () => void fire("select"),
  light: () => void fire("light"),
  medium: () => void fire("medium"),
  heavy: () => void fire("heavy"),
  success: () => void fire("success"),
  warning: () => void fire("warning"),
  error: () => void fire("error"),
};
