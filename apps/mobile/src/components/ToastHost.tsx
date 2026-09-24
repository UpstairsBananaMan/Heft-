import { Pressable, Text, View } from "react-native";
import { useToast } from "../store/toast";

export function ToastHost() {
  const current = useToast((state) => state.current);
  const clear = useToast((state) => state.clear);
  if (!current) return null;
  const error = current.tone === "error";
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 16, right: 16, top: 54, zIndex: 50 }}>
      <Pressable onPress={clear} className={`border px-4 py-3 ${error ? "border-charcoal bg-charcoal" : "border-amber bg-amber"}`}>
        <Text className={`text-sm font-semibold leading-5 ${error ? "text-paper" : "text-charcoal"}`}>{current.message}</Text>
      </Pressable>
    </View>
  );
}
