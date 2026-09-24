import { ReactNode, useRef, useState } from "react";
import { Platform, Pressable, Text, TextInput, View, type TextStyle, type ViewStyle } from "react-native";
import { APP_WORDMARK } from "@heft/shared";
import { haptic } from "../lib/haptics";

export const C = {
  ink: "#1A1D21",
  ink800: "#24282D",
  paper: "#F4F1EA",
  white: "#FFFFFF",
  amber: "#E8A317",
  amberPressed: "#CC8C0C",
  amberInk: "#8A5A00",
  amber50: "#FDF6E3",
  amber100: "#FBEBC0",
  steel: "#5C6670",
  steel400: "#8E959C",
  steel500: "#6B737B",
  sand150: "#EFEBE3",
  sand200: "#E7E2D8",
  sand300: "#D9D3C7",
  sand600: "#857F73",
  green: "#17754C",
  green50: "#E3F3EA",
  red: "#B42318",
  red50: "#FDECEA",
  blue: "#2B63A6",
  blue50: "#E7EFF8",
};

export const font = {
  body: "Inter_400Regular",
  medium: "Inter_500Medium",
  semi: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  display: "PlusJakartaSans_800ExtraBold",
  heading: "PlusJakartaSans_700Bold",
};

export function Wordmark({ color = C.paper, size = 26 }: { color?: string; size?: number }) {
  const dot = Math.max(6, Math.round(size * 0.26));
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
      <Text style={{ color, fontFamily: font.display, fontSize: size, letterSpacing: -0.6 }}>{APP_WORDMARK}</Text>
      <View style={{ width: dot, height: dot, borderRadius: 2, backgroundColor: C.amber, marginLeft: 2, marginBottom: size * 0.16 }} />
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 56,
        borderRadius: 16,
        backgroundColor: disabled ? C.sand150 : pressed ? C.amberPressed : C.amber,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16,
        shadowColor: disabled ? "transparent" : "#B87F08",
        shadowOpacity: disabled || pressed ? 0 : 0.28,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
      })}
    >
      <Text style={{ color: disabled ? C.steel500 : C.ink, fontFamily: font.semi, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled }: { label: string; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        borderRadius: 16,
        backgroundColor: pressed ? "#000" : C.ink,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16,
        opacity: disabled ? 0.4 : 1,
      })}
    >
      <Text style={{ color: C.paper, fontFamily: font.semi, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

export function OutlineButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        minHeight: 48,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: C.sand300,
        backgroundColor: C.white,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16,
      }}
    >
      <Text style={{ color: C.ink, fontFamily: font.semi, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

export function Sheet({ children, footer, tall }: { children: ReactNode; footer?: ReactNode; tall?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: C.white,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: footer ? 12 : 8,
        maxHeight: tall ? "86%" : "58%",
        shadowColor: "#1A1D21",
        shadowOpacity: 0.14,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: -6 },
        elevation: 16,
      }}
    >
      <View style={{ alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: C.sand300, marginBottom: 12 }} />
      {children}
      {footer}
    </View>
  );
}

export function FieldBox({
  label,
  value,
  onChangeText,
  placeholder,
  autoFocus,
  onFocus,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onFocus?: () => void;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: C.steel, fontFamily: font.medium, fontSize: 14, marginBottom: 6 }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.steel500}
        autoFocus={autoFocus}
        onFocus={onFocus}
        style={{
          minHeight: 60,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: C.sand600,
          backgroundColor: C.white,
          paddingHorizontal: 14,
          color: C.ink,
          fontFamily: font.body,
          fontSize: 16,
        }}
      />
    </View>
  );
}

export function HoldToAccept({ onAccept }: { onAccept: () => void | Promise<void> }) {
  const [progress, setProgress] = useState(0);
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const started = useRef(0);
  const done = useRef(false);

  function clear() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }

  function begin() {
    if (busy) return;
    done.current = false;
    started.current = Date.now();
    haptic.light();
    clear();
    timer.current = setInterval(() => {
      const next = Math.min(1, (Date.now() - started.current) / 600);
      setProgress(next);
      if (next >= 1 && !done.current) {
        done.current = true;
        clear();
        setBusy(true);
        haptic.heavy();
        void Promise.resolve(onAccept()).finally(() => setBusy(false));
      }
    }, 30);
  }

  function end() {
    if (done.current || busy) return;
    const elapsed = Date.now() - started.current;
    clear();
    if (elapsed > 40 && elapsed < 600) {
      setHint("Keep holding to accept");
      setTimeout(() => setHint(""), 1500);
    }
    setProgress(0);
  }

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hold to accept"
        onPressIn={begin}
        onPressOut={end}
        style={{ height: 64, borderRadius: 999, backgroundColor: C.ink, overflow: "hidden", justifyContent: "center" }}
      >
        <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.round(progress * 100)}%`, backgroundColor: C.amber }} />
        <Text style={{ textAlign: "center", color: progress > 0.45 ? C.ink : C.paper, fontFamily: font.bold, fontSize: 17 }}>
          {busy ? "Accepting…" : "Hold to accept"}
        </Text>
      </Pressable>
      {hint ? <Text style={{ marginTop: 8, textAlign: "center", color: C.steel, fontFamily: font.body, fontSize: 14 }}>{hint}</Text> : null}
      {Platform.OS === "web" ? (
        <Pressable onPress={() => setConfirm(true)} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: C.ink, fontFamily: font.semi, fontSize: 14, textDecorationLine: "underline" }}>Accept job</Text>
        </Pressable>
      ) : null}
      {confirm ? (
        <View style={{ marginTop: 8, gap: 8 }}>
          <Text style={{ color: C.ink, fontFamily: font.body, fontSize: 16 }}>Accept this job?</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <OutlineButton label="Cancel" onPress={() => setConfirm(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <SecondaryButton
                label="Accept"
                onPress={() => {
                  setConfirm(false);
                  setBusy(true);
                  void Promise.resolve(onAccept()).finally(() => setBusy(false));
                }}
              />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function bodyStyle(extra?: TextStyle): TextStyle {
  return { color: C.ink, fontFamily: font.body, fontSize: 16, lineHeight: 24, ...extra };
}

export function cardStyle(extra?: ViewStyle): ViewStyle {
  return {
    backgroundColor: C.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.sand200,
    padding: 16,
    ...extra,
  };
}
