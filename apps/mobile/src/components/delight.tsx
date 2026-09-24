import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, Text, View, useWindowDimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { formatUsd } from "@heft/shared";
import { C, font } from "./v2";
import { haptic } from "../lib/haptics";
import { useReducedMotion } from "../lib/motion-pref";

const COLORS = ["#E8A317", "#1A1D21", "#F4F1EA", "#5C6670", "#F2C45A"];

export function useDelight(options: { jobId?: string | null; moment: string; announce: string; enabled?: boolean }) {
  const reduced = useReducedMotion();
  const enabled = options.enabled !== false && Boolean(options.jobId);
  const [phase, setPhase] = useState<"wait" | "play" | "done">("wait");
  const [locked, setLocked] = useState(true);
  const announced = useRef(false);
  const key = options.jobId ? `seen:${options.jobId}:${options.moment}` : "";

  function announce() {
    if (announced.current || !options.announce) return;
    announced.current = true;
    AccessibilityInfo.announceForAccessibility(options.announce);
  }

  function settle() {
    setPhase("done");
    announce();
    setTimeout(() => setLocked(false), 250);
  }

  useEffect(() => {
    if (!enabled || !key) return;
    let cancel = false;
    AsyncStorage.getItem(key)
      .then((seen) => {
        if (cancel) return;
        if (seen) {
          setPhase("done");
          setLocked(false);
          return;
        }
        void AsyncStorage.setItem(key, "1");
        setPhase("play");
        setLocked(true);
      })
      .catch(() => {
        if (!cancel) setPhase("play");
      });
    return () => {
      cancel = true;
    };
  }, [enabled, key]);

  useEffect(() => {
    if (phase !== "play") return;
    const timer = setTimeout(settle, reduced ? 150 : 1200);
    return () => clearTimeout(timer);
    // settle closes over the latest announce string
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, reduced]);

  return {
    playing: phase === "play",
    settled: phase === "done",
    locked: phase === "wait" ? true : locked,
    reduced,
    skip: () => {
      if (phase === "play") settle();
    },
  };
}

export function SkipLayer({ active, onSkip, onDark }: { active: boolean; onSkip: () => void; onDark?: boolean }) {
  if (!active) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Tap to skip"
      onPress={onSkip}
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 30 }}
    >
      <Text
        style={{
          position: "absolute",
          top: 52,
          right: 16,
          fontFamily: font.medium,
          fontSize: 13,
          color: onDark ? "#F2C45A" : C.steel,
        }}
      >
        Tap to skip
      </Text>
    </Pressable>
  );
}

export function Confetti({ count, play }: { count: number; play: boolean }) {
  const { width, height } = useWindowDimensions();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => {
        const side = index % 2 === 0;
        return {
          id: index,
          x: side ? 8 + (index % 5) * 14 : width - 28 - (index % 5) * 14,
          delay: (index % 8) * 40,
          drift: side ? 10 : -10,
          spin: index % 2 === 0 ? 40 : -50,
          color: COLORS[index % COLORS.length],
          w: index % 3 === 0 ? 8 : 6,
          h: index % 3 === 0 ? 14 : 8,
        };
      }),
    [count, width],
  );
  if (!play) return null;
  return (
    <View accessible={false} pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height, zIndex: 1 }}>
      {pieces.map((piece) => (
        <Piece key={piece.id} {...piece} />
      ))}
    </View>
  );
}

function Piece({
  x,
  delay,
  drift,
  spin,
  color,
  w,
  h,
}: {
  x: number;
  delay: number;
  drift: number;
  spin: number;
  color: string;
  w: number;
  h: number;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      progress.value = withTiming(1, { duration: 1100 });
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, progress]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -20 + progress.value * 220 },
      { translateX: progress.value * drift },
      { rotate: `${progress.value * spin}deg` },
    ],
    opacity: 1 - progress.value * 0.15,
  }));
  return <Animated.View style={[{ position: "absolute", left: x, top: 8, width: w, height: h, backgroundColor: color, borderRadius: 1 }, style]} />;
}

export function PulseRing() {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.35);
  useEffect(() => {
    if (reduced) return;
    scale.value = withRepeat(withTiming(2.2, { duration: 1600 }), -1);
    opacity.value = withRepeat(withTiming(0, { duration: 1600 }), -1);
  }, [opacity, reduced, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  if (reduced) return null;
  return <Animated.View accessible={false} pointerEvents="none" style={[{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#E8A317" }, style]} />;
}

export function CountUp({
  cents,
  play,
  prefix,
  color,
  size = 44,
  hapticOnEnd = true,
}: {
  cents: number;
  play: boolean;
  prefix?: string;
  color?: string;
  size?: number;
  hapticOnEnd?: boolean;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(play && !reduced ? Math.round(cents * 0.15) : cents);
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!play || reduced) {
      setShown(cents);
      return;
    }
    const began = Date.now();
    const timer = setInterval(() => {
      const t = Math.min(1, (Date.now() - began) / 600);
      setShown(Math.round(cents * t));
      if (t >= 1) {
        clearInterval(timer);
        scale.value = withTiming(1.06, { duration: 110 }, () => {
          scale.value = withTiming(1, { duration: 110 });
        });
        if (hapticOnEnd) haptic.success();
      }
    }, 30);
    return () => clearInterval(timer);
  }, [cents, play, reduced, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const label = `${prefix ?? ""}${formatUsd(cents)}`;
  return (
    <View accessibilityLabel={label}>
      <Animated.View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={style}>
        <Text style={{ fontFamily: font.display, fontSize: size, color: color ?? C.ink }}>
          {prefix ?? ""}
          {formatUsd(shown)}
        </Text>
      </Animated.View>
    </View>
  );
}
