import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import type { MapPin } from "./JobMap";

/**
 * Port of the styled web map (mapSVG): land, blocks, parks, bay, route and pins.
 * Coordinates are used only to place shapes. They are never drawn as text.
 */
export function JobMap({
  pins,
  height,
}: {
  pins: MapPin[];
  height?: number;
  bottomInset?: number;
  route?: boolean;
}) {
  const w = 390;
  const h = height ?? 520;
  const scene = useMemo(() => buildScene(pins, w, h), [pins, h]);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flex: height ? undefined : 1, height, backgroundColor: "#EEEAE1", overflow: "hidden" }}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`}>
        <Rect width={w} height={h} fill="#EEEAE1" />
        <G transform={`rotate(-9 ${w / 2} ${h / 2})`}>{scene.grid}</G>
        <Path d={scene.highway} stroke="#BFC5CB" strokeWidth={15} fill="none" />
        <Path d={scene.highway} stroke="#D9DDE1" strokeWidth={11} fill="none" />
        <Path d={scene.bay} fill="#CFDDE3" />
        <SvgText x={w * 0.62} y={h * 0.9} fill="#8E959C" fontSize={11} textAnchor="middle">
          Pensacola Bay
        </SvgText>
        {scene.route ? (
          <>
            <Path d={scene.route} stroke="#FFFFFF" strokeWidth={10} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            <Path d={scene.route} stroke="#1A1D21" strokeWidth={5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          </>
        ) : null}
        {scene.labels.map((label) => (
          <SvgText key={label.t} x={label.x} y={label.y} fill="#8E959C" fontSize={11} textAnchor="middle">
            {label.t}
          </SvgText>
        ))}
        {scene.markers}
      </Svg>
    </View>
  );
}

function buildScene(pins: MapPin[], w: number, h: number) {
  const grid = [];
  const step = 44;
  let seed = 9301;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let x = -w; x < w * 2; x += step) {
    for (let y = -h; y < h * 2; y += step) {
      const v = rnd();
      if (v < 0.07) {
        grid.push(<Rect key={`p-${x}-${y}`} x={x + 4} y={y + 4} width={step - 8} height={step - 8} rx={4} fill="#DDE5D3" />);
      } else if (v < 0.22) {
        grid.push(<Rect key={`b-${x}-${y}`} x={x + 4} y={y + 4} width={step - 8} height={step - 8} rx={3} fill="#E6E1D6" />);
      }
    }
  }
  for (let x = -w; x < w * 2; x += step) {
    grid.push(<Line key={`v-${x}`} x1={x} y1={-h} x2={x} y2={h * 2} stroke="#FFFFFF" strokeWidth={4} />);
  }
  for (let y = -h; y < h * 2; y += step) {
    grid.push(<Line key={`h-${y}`} x1={-w} y1={y} x2={w * 2} y2={y} stroke="#FFFFFF" strokeWidth={4} />);
  }

  const located = pins.filter((pin) => Number.isFinite(pin.lat) && Number.isFinite(pin.lng));
  const project = projector(located, w, h);
  const pickup = located.find((pin) => pin.kind === "pickup");
  const dropoff = located.find((pin) => pin.kind === "dropoff");
  const driver = located.find((pin) => pin.kind === "driver");
  let route: string | null = null;
  if (pickup && dropoff) {
    const a = project(pickup.lat, pickup.lng);
    const b = project(dropoff.lat, dropoff.lng);
    const mid: [number, number] = [a[0], b[1]];
    route = `M ${a[0].toFixed(1)} ${a[1].toFixed(1)} L ${mid[0].toFixed(1)} ${mid[1].toFixed(1)} L ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
  }

  const markers = located.map((pin) => {
    const [x, y] = project(pin.lat, pin.lng);
    if (pin.kind === "payout" && pin.payout) return payoutPin(pin.id, x, y, pin.payout, Boolean(pin.hot));
    if (pin.kind === "dropoff") return squarePin(pin.id, x, y, pin.title);
    if (pin.kind === "driver") return driverPin(pin.id, x, y);
    if (pin.kind === "user") return userPin(pin.id, x, y);
    return discPin(pin.id, x, y, pin.title);
  });

  return {
    grid,
    highway: `M -20 ${h * 0.18} C ${w * 0.35} ${h * 0.08}, ${w * 0.55} ${h * 0.42}, ${w + 20} ${h * 0.28}`,
    bay: `M0 ${h * 0.78} C ${w * 0.25} ${h * 0.72}, ${w * 0.45} ${h * 0.86}, ${w * 0.7} ${h * 0.8} S ${w} ${h * 0.72}, ${w} ${h * 0.74} L ${w} ${h} L 0 ${h} Z`,
    route,
    labels: route ? [] : [{ t: "DOWNTOWN", x: w * 0.48, y: h * 0.46 }],
    markers,
  };
}

function projector(pins: MapPin[], w: number, h: number) {
  const lats = pins.map((pin) => pin.lat);
  const lngs = pins.map((pin) => pin.lng);
  const minLat = Math.min(...lats, 30.4);
  const maxLat = Math.max(...lats, 30.46);
  const minLng = Math.min(...lngs, -87.24);
  const maxLng = Math.max(...lngs, -87.18);
  const latSpan = Math.max(0.02, maxLat - minLat);
  const lngSpan = Math.max(0.02, maxLng - minLng);
  const pad = 0.22;
  return (lat: number, lng: number): [number, number] => {
    const x = ((lng - minLng) / lngSpan) * (1 - pad * 2) * w + pad * w;
    const y = (1 - (lat - minLat) / latSpan) * (1 - pad * 2) * h + pad * h;
    return [x, y];
  };
}

function tag(x: number, y: number, text: string) {
  const width = text.length * 7.2 + 22;
  return (
    <G>
      <Rect x={x - width / 2} y={y - 14} width={width} height={26} rx={13} fill="#FFFFFF" stroke="#E7E2D8" />
      <SvgText x={x} y={y + 4} fill="#1A1D21" fontSize={12} textAnchor="middle">
        {text}
      </SvgText>
    </G>
  );
}

function discPin(id: string, x: number, y: number, title: string) {
  return (
    <G key={id}>
      <Circle cx={x} cy={y} r={15} fill="rgba(26,29,33,0.10)" />
      <Circle cx={x} cy={y} r={10.5} fill="#E8A317" stroke="#1A1D21" strokeWidth={3} />
      <Circle cx={x} cy={y} r={3.5} fill="#1A1D21" />
      {title ? tag(x, y - 28, title) : null}
    </G>
  );
}

function squarePin(id: string, x: number, y: number, title: string) {
  return (
    <G key={id}>
      <Rect x={x - 15} y={y - 15} width={30} height={30} rx={9} fill="rgba(26,29,33,0.10)" />
      <Rect x={x - 10.5} y={y - 10.5} width={21} height={21} rx={6} fill="#E8A317" stroke="#1A1D21" strokeWidth={3} />
      <Rect x={x - 3.5} y={y - 3.5} width={7} height={7} rx={1.5} fill="#1A1D21" />
      {title ? tag(x, y - 30, title) : null}
    </G>
  );
}

function driverPin(id: string, x: number, y: number) {
  return (
    <G key={id}>
      <Circle cx={x} cy={y} r={26} fill="rgba(26,29,33,0.10)" />
      <Circle cx={x} cy={y} r={16} fill="#1A1D21" stroke="#FFFFFF" strokeWidth={3} />
      <SvgText x={x} y={y + 4} fill="#F4F1EA" fontSize={11} textAnchor="middle">
        van
      </SvgText>
    </G>
  );
}

function userPin(id: string, x: number, y: number) {
  return (
    <G key={id}>
      <Circle cx={x} cy={y} r={22} fill="rgba(43,99,166,0.12)" />
      <Circle cx={x} cy={y} r={7} fill="#2B63A6" stroke="#FFFFFF" strokeWidth={3} />
    </G>
  );
}

function payoutPin(id: string, x: number, y: number, text: string, hot: boolean) {
  const width = text.length * 9 + 22;
  return (
    <G key={id}>
      <Rect x={x - width / 2} y={y - 15} width={width} height={30} rx={15} fill={hot ? "#E8A317" : "#1A1D21"} stroke="#FFFFFF" strokeWidth={2} />
      <SvgText x={x} y={y + 4} fill={hot ? "#1A1D21" : "#F4F1EA"} fontSize={13} fontWeight="700" textAnchor="middle">
        {text}
      </SvgText>
    </G>
  );
}
