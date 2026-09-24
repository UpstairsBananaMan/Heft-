import { useEffect, useState } from "react";
import { AppState, View } from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SvgXml } from "react-native-svg";
import { ILLUSTRATIONS, type IllustrationName } from "../illustrations/markup";
import { useReducedMotion } from "../lib/motion-pref";

export function Illustration({
  name,
  width,
  height,
}: {
  name: IllustrationName;
  width: number;
  height: number;
}) {
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width, height }}>
      <SvgXml xml={ILLUSTRATIONS[name]} width={width} height={height} />
    </View>
  );
}

export function FloatingIllustration({ name, size = 96 }: { name: IllustrationName; size?: number }) {
  const reduced = useReducedMotion();
  const focused = useScreenActive();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduced || !focused) {
      y.value = 0;
      return;
    }
    y.value = withRepeat(
      withSequence(withTiming(-4, { duration: 1500, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 1500 })),
      -1,
    );
  }, [focused, reduced, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View accessible={false} importantForAccessibility="no-hide-descendants" style={style}>
      <Illustration name={name} width={size} height={size} />
    </Animated.View>
  );
}

export function LookingIllustration({ size = 88 }: { size?: number }) {
  const reduced = useReducedMotion();
  const focused = useScreenActive();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (reduced || !focused) {
      turn.value = 0;
      return;
    }
    turn.value = withRepeat(
      withSequence(withTiming(-6, { duration: 600 }), withTiming(6, { duration: 1200 }), withTiming(0, { duration: 600 })),
      -1,
    );
  }, [focused, reduced, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  return (
    <Animated.View accessible={false} importantForAccessibility="no-hide-descendants" style={style}>
      <Illustration name="box-look" width={size} height={size} />
    </Animated.View>
  );
}

function useScreenActive() {
  const [focused, setFocused] = useState(true);
  const [foreground, setForeground] = useState(true);
  useFocusEffect(() => {
    setFocused(true);
    return () => setFocused(false);
  });
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => setForeground(state === "active"));
    return () => sub.remove();
  }, []);
  return focused && foreground;
}

export function WavingIllustration({ play, size = 96 }: { play: boolean; size?: number }) {
  const reduced = useReducedMotion();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (!play || reduced) {
      turn.value = 0;
      return;
    }
    turn.value = withSequence(
      withTiming(10, { duration: 150 }),
      withTiming(-10, { duration: 200 }),
      withTiming(10, { duration: 200 }),
      withTiming(0, { duration: 150 }),
    );
  }, [play, reduced, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  return (
    <Animated.View accessible={false} importantForAccessibility="no-hide-descendants" style={style}>
      <Illustration name="box-wave" width={size} height={size} />
    </Animated.View>
  );
}

export function DroppingIllustration({ play, size = 72 }: { play: boolean; size?: number }) {
  const reduced = useReducedMotion();
  const y = useSharedValue(play && !reduced ? -24 : 0);
  useEffect(() => {
    if (reduced) {
      y.value = withTiming(0, { duration: 150 });
      return;
    }
    if (play) y.value = withTiming(0, { duration: 420 });
  }, [play, reduced, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View accessible={false} importantForAccessibility="no-hide-descendants" style={style}>
      <Illustration name="box-happy" width={size} height={size} />
    </Animated.View>
  );
}
