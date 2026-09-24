import { ReactNode } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, usePathname, type Href } from "expo-router";
import { APP_WORDMARK, STATUS_LABEL, type JobStatus } from "@heft/shared";

export function Screen({
  title,
  back,
  children,
  footer,
}: {
  title: string;
  back?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, height: "100%", width: "100%", backgroundColor: "#F4F1EA" }}>
      <View className="bg-charcoal px-5 pb-4 pt-2">
        {back ? (
          <Pressable onPress={() => router.back()} className="mb-2 self-start py-2">
            <Text className="text-xs font-semibold uppercase tracking-widest text-amber">Back</Text>
          </Pressable>
        ) : (
          <Text className="text-sm font-semibold tracking-[2px] text-paper">{APP_WORDMARK}</Text>
        )}
        <Text className="text-2xl font-semibold text-paper">{title}</Text>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: footer ? 120 : 40 }}>
        {children}
      </ScrollView>
      {footer}
    </SafeAreaView>
  );
}

export function Button({
  label,
  onPress,
  disabled,
  tone = "amber",
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  tone?: "amber" | "charcoal" | "ghost";
}) {
  const toneClass =
    tone === "charcoal" ? "bg-charcoal" : tone === "ghost" ? "border border-charcoal bg-transparent" : "bg-amber";
  const textClass = tone === "charcoal" ? "text-paper" : "text-charcoal";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`mb-3 min-h-[52px] items-center justify-center px-4 ${toneClass} ${disabled ? "opacity-40" : ""}`}
    >
      <Text className={`text-base font-semibold ${textClass}`}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  secureTextEntry?: boolean;
}) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-steel">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#5C6670"
        multiline={multiline}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
        className="border border-line bg-white px-3 py-3 text-base text-charcoal"
        style={{ minHeight: multiline ? 96 : 52, textAlignVertical: multiline ? "top" : "center" }}
      />
    </View>
  );
}

export function Choice({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-steel">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              className={`min-h-[44px] justify-center border px-3 ${selected ? "border-charcoal bg-charcoal" : "border-line bg-white"}`}
            >
              <Text className={`text-sm font-semibold ${selected ? "text-paper" : "text-charcoal"}`}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function StatusPill({ status }: { status: JobStatus }) {
  return (
    <View className="self-start bg-charcoal px-2 py-1">
      <Text className="text-[11px] font-semibold uppercase tracking-wider text-amber">{STATUS_LABEL[status]}</Text>
    </View>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <View className="mb-4 border border-amber bg-white px-3 py-3">
      <Text className="text-sm leading-5 text-charcoal">{children}</Text>
    </View>
  );
}

export function Steps({ labels, current }: { labels: string[]; current: number }) {
  return (
    <View className="mb-5 flex-row flex-wrap">
      {labels.map((label, index) => {
        const reached = index <= current;
        return (
          <View key={label} className="mb-2 mr-4">
            <Text className={`text-[11px] font-semibold uppercase tracking-wider ${reached ? "text-charcoal" : "text-steel"}`}>
              {index + 1} {label}
            </Text>
            <View className={`mt-1 h-1 w-14 ${reached ? "bg-amber" : "bg-line"}`} />
          </View>
        );
      })}
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View className="border border-line bg-white px-4 py-6">
      <Text className="text-lg font-semibold text-charcoal">{title}</Text>
      <Text className="mt-2 text-sm leading-5 text-steel">{body}</Text>
    </View>
  );
}

export function ErrorText({ children }: { children: string }) {
  return <Text className="mb-3 text-sm text-charcoal">{children}</Text>;
}

export function BottomNav({ items }: { items: { href: Href; label: string }[] }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <View className="absolute bottom-0 left-0 right-0 flex-row border-t border-line bg-paper">
      {items.map((item) => {
        const bare = String(item.href).replace(/\/\([^)]+\)/g, "");
        const active = pathname === item.href || pathname === bare;
        return (
          <Pressable key={item.label} onPress={() => router.replace(item.href)} className="flex-1 items-center py-4">
            <Text className={`text-xs font-semibold uppercase tracking-wider ${active ? "text-charcoal" : "text-steel"}`}>
              {item.label}
            </Text>
            {active ? <View className="mt-1 h-1 w-6 bg-amber" /> : <View className="mt-1 h-1 w-6" />}
          </Pressable>
        );
      })}
    </View>
  );
}
