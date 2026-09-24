import { View } from "react-native";

/**
 * Empty-state and hero illustration slot.
 * A later personality pass drops an SVG in here. Keep the frame.
 */
export function ArtSlot({ name, size = 64 }: { name: string; size?: number }) {
  return (
    <View
      accessibilityLabel={name}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#EFEBE3" }}
    />
  );
}

/**
 * Reserved moment for a later celebration animation.
 * price reveal, driver found, and delivered each get one slot.
 */
export function CelebrationSlot({ moment }: { moment: "price" | "driver-found" | "delivered" }) {
  return <View testID={`celebration-${moment}`} pointerEvents="none" accessibilityElementsHidden style={{ height: 0 }} />;
}
