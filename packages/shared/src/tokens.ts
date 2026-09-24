import { APP_NAME } from "./brand";

/**
 * Heft design tokens — v2 ("Warm Utility").
 * Single source of truth for apps/mobile (React Native / NativeWind) and apps/admin (Next.js / Tailwind).
 * Suggested home: packages/shared/src/tokens.ts, re-exported from @heft/shared.
 * No runtime deps. All colors are hex; contrast ratios noted are WCAG 2.x vs. the intended background.
 */

/* ------------------------------------------------------------------ */
/* 1. Raw palette                                                      */
/* ------------------------------------------------------------------ */
export const palette = {
  // Charcoal / steel neutrals (cool-leaning ink)
  ink900: "#1A1D21", // brand charcoal — primary text, dark header
  ink800: "#24282D", // raised surface on dark (cards inside dark header, admin sidebar hover)
  ink700: "#33383E", // borders on dark, pressed on dark
  steel600: "#5C6670", // brand steel — secondary text (5.19:1 on paper, 5.85:1 on white)
  steel500: "#6B737B", // tertiary text — ONLY on white (4.81:1); placeholder text
  steel400: "#8E959C", // icons, disabled text on dark (5.58:1 on ink900)
  steel300: "#A9AEB3", // secondary text on dark (7.56:1 on ink900)

  // Warm off-white neutrals
  sand600: "#857F73", // INPUT border — non-text contrast 3.98:1 on white, 3.53:1 on paper, 3.34:1 on sand150
  sand300: "#D9D3C7", // decorative dividers only (1.32:1 on paper — never the only boundary of a control)
  sand200: "#E7E2D8", // default hairline border
  sand150: "#EFEBE3", // subtle fill: pressed rows, skeletons, input bg on white
  paper: "#F4F1EA", // brand off-white — app background
  paper50: "#FAF8F4", // raised light fill (segmented control track, table header)
  white: "#FFFFFF", // card surface

  // Amber (accent — use sparingly)
  amber50: "#FDF6E3", // tinted surface (selected card, info notice)
  amber100: "#FBEBC0", // selected chip bg, progress track fill-light
  amber300: "#F2C45A", // focus ring on dark
  amber500: "#E8A317", // brand amber — primary CTA fill (charcoal text 7.8:1)
  amber600: "#CC8C0C", // CTA pressed
  amber700: "#8A5A00", // "amber-ink": the ONLY amber allowed as text/icon on light (5.93:1 white, 5.25:1 paper, 5.49:1 amber50)

  // Semantic hues
  green50: "#E3F3EA",
  green600: "#17754C", // success text/solid (4.96:1 on green50; white text 5.5:1)
  red50: "#FDECEA",
  red600: "#B42318", // danger text/solid (6.57:1 on white; white text 6.57:1)
  blue50: "#E7EFF8",
  blue600: "#2B63A6", // info text (5.26:1 on blue50)
} as const;

/* ------------------------------------------------------------------ */
/* 2. Semantic color roles — components should use THESE, not palette */
/* ------------------------------------------------------------------ */
export const colors = {
  bg: palette.paper, // screen background
  bgSubtle: palette.paper50,
  surface: palette.white, // cards, sheets, inputs
  surfaceSunken: palette.sand150, // pressed row, skeleton, segmented track
  surfaceTint: palette.amber50, // highlighted card (selected option, quote card header)

  headerBg: palette.ink900, // dark top header / admin sidebar / hero
  headerSurface: palette.ink800, // cards sitting inside the dark header
  headerText: palette.paper,
  headerTextMuted: palette.steel300,
  headerBorder: palette.ink700,

  textPrimary: palette.ink900,
  textSecondary: palette.steel600,
  textTertiary: palette.steel500, // white backgrounds only
  textOnAccent: palette.ink900, // text on amber — NEVER white on amber (2.17:1 fails)
  textOnDark: palette.paper,
  textLink: palette.ink900, // links are charcoal + underline; amber text on light is forbidden except amberInk
  amberInk: palette.amber700, // amber-coloured text/icons on light surfaces (>=4.5:1)

  border: palette.sand200, // decorative hairlines (card edges, row dividers)
  borderStrong: palette.sand300, // decorative
  borderInput: palette.sand600, // text fields, selects, textarea, unchecked checkbox/radio (>=3:1)
  borderFocus: palette.ink900,

  accent: palette.amber500,
  accentPressed: palette.amber600,
  accentSoft: palette.amber100,
  accentText: palette.amber700,

  success: palette.green600,
  successSoft: palette.green50,
  warning: palette.amber700,
  warningSoft: palette.amber50,
  danger: palette.red600,
  dangerSoft: palette.red50,
  info: palette.blue600,
  infoSoft: palette.blue50,

  iconPrimary: palette.ink900,
  iconSecondary: palette.steel400,
  overlay: "rgba(26,29,33,0.48)",
  mapRoute: palette.ink900,
  mapPickup: palette.ink900,
  mapDropoff: palette.amber500,
} as const;

/** Job status → pill appearance. Keys match JobStatus in packages/shared/src/types.ts */
export const statusTone = {
  draft: "neutral",
  priced: "neutral",
  open: "info", // "Finding a driver"
  assigned: "accent",
  en_route_pickup: "accent",
  at_pickup: "accent",
  en_route_dropoff: "accent",
  at_dropoff: "accent",
  delivered: "success",
  paid: "success",
  cancelled: "neutral",
  disputed: "danger",
} as const;

export const toneColors = {
  neutral: { bg: palette.sand150, fg: palette.steel600, dot: palette.steel400 },
  info: { bg: palette.blue50, fg: palette.blue600, dot: palette.blue600 },
  accent: { bg: palette.amber50, fg: palette.amber700, dot: palette.amber500 },
  success: { bg: palette.green50, fg: palette.green600, dot: palette.green600 },
  danger: { bg: palette.red50, fg: palette.red600, dot: palette.red600 },
} as const;

/* ------------------------------------------------------------------ */
/* 3. Spacing (4pt grid)                                               */
/* ------------------------------------------------------------------ */
export const space = {
  0: 0,
  0.5: 2,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20, // mobile screen gutter
  6: 24, // card padding (large), section gap
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

export const layout = {
  screenGutter: 20,
  cardPadding: 20,
  sectionGap: 28,
  listGap: 12,
  tapTargetMin: 48, // mobile minimum; primary buttons 56
  buttonHeight: { sm: 40, md: 48, lg: 56 },
  inputHeight: 56,
  tabBarHeight: 64, // + safe-area inset
  headerHeightCompact: 56,
  adminSidebarWidth: 248,
  adminContentMax: 1200,
  adminTopbarHeight: 64,
} as const;

/* ------------------------------------------------------------------ */
/* 4. Radii                                                            */
/* ------------------------------------------------------------------ */
export const radii = {
  none: 0,
  xs: 6, // tiny tags, checkbox
  sm: 10, // chips, small buttons, admin inputs
  md: 14, // inputs, buttons, list-row icons
  lg: 18, // cards (default)
  xl: 24, // bottom sheets, hero cards, phone-screen modals
  pill: 999,
} as const;

/* ------------------------------------------------------------------ */
/* 5. Typography                                                       */
/* ------------------------------------------------------------------ */
/**
 * Mobile: load with expo-font / @expo-google-fonts:
 *   @expo-google-fonts/plus-jakarta-sans → PlusJakartaSans_600SemiBold, _700Bold, _800ExtraBold
 *   @expo-google-fonts/inter             → Inter_400Regular, _500Medium, _600SemiBold, _700Bold
 * Admin: next/font/google → Plus_Jakarta_Sans (600,700,800) + Inter (400,500,600,700).
 * On RN, fontWeight must NOT be combined with a named weight file; the family name encodes weight.
 */
export const fontFamily = {
  display: "PlusJakartaSans_800ExtraBold",
  displayBold: "PlusJakartaSans_700Bold",
  displaySemi: "PlusJakartaSans_600SemiBold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemi: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
} as const;

/** Web font stacks (admin + mockups) */
export const fontStack = {
  display: `"Plus Jakarta Sans", Inter, ui-sans-serif, system-ui, sans-serif`,
  body: `Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`,
  mono: `"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace`, // IDs only, never prices
} as const;

type TextStyle = {
  fontFamily: string;
  webFamily: "display" | "body";
  fontSize: number;
  lineHeight: number;
  fontWeight: "400" | "500" | "600" | "700" | "800";
  letterSpacing: number; // px (RN) — CSS: same value in px
  tabular?: boolean; // fontVariant: ['tabular-nums'] / font-variant-numeric: tabular-nums
};

export const type = {
  displayXL: { fontFamily: fontFamily.display, webFamily: "display", fontSize: 40, lineHeight: 44, fontWeight: "800", letterSpacing: -1.2 },
  display: { fontFamily: fontFamily.display, webFamily: "display", fontSize: 32, lineHeight: 38, fontWeight: "800", letterSpacing: -0.8 },
  h1: { fontFamily: fontFamily.displayBold, webFamily: "display", fontSize: 26, lineHeight: 32, fontWeight: "700", letterSpacing: -0.5 },
  h2: { fontFamily: fontFamily.displayBold, webFamily: "display", fontSize: 20, lineHeight: 26, fontWeight: "700", letterSpacing: -0.3 },
  h3: { fontFamily: fontFamily.bodySemi, webFamily: "body", fontSize: 17, lineHeight: 24, fontWeight: "600", letterSpacing: -0.2 },
  bodyL: { fontFamily: fontFamily.body, webFamily: "body", fontSize: 17, lineHeight: 26, fontWeight: "400", letterSpacing: -0.1 },
  body: { fontFamily: fontFamily.body, webFamily: "body", fontSize: 16, lineHeight: 24, fontWeight: "400", letterSpacing: 0 }, // minimum body size (team rule: 16pt)
  bodyStrong: { fontFamily: fontFamily.bodySemi, webFamily: "body", fontSize: 16, lineHeight: 24, fontWeight: "600", letterSpacing: 0 },
  label: { fontFamily: fontFamily.bodyMedium, webFamily: "body", fontSize: 14, lineHeight: 20, fontWeight: "500", letterSpacing: 0 }, // field labels, meta rows
  caption: { fontFamily: fontFamily.body, webFamily: "body", fontSize: 13, lineHeight: 18, fontWeight: "400", letterSpacing: 0 }, // timestamps, fine print only
  overline: { fontFamily: fontFamily.bodySemi, webFamily: "body", fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 0.8 }, // sparingly; uppercase
  button: { fontFamily: fontFamily.bodySemi, webFamily: "body", fontSize: 16, lineHeight: 20, fontWeight: "600", letterSpacing: -0.1 },
  buttonSm: { fontFamily: fontFamily.bodySemi, webFamily: "body", fontSize: 14, lineHeight: 18, fontWeight: "600", letterSpacing: 0 },
  tab: { fontFamily: fontFamily.bodyMedium, webFamily: "body", fontSize: 12, lineHeight: 14, fontWeight: "500", letterSpacing: 0.1 },
  priceXL: { fontFamily: fontFamily.display, webFamily: "display", fontSize: 44, lineHeight: 48, fontWeight: "800", letterSpacing: -1.5, tabular: true },
  priceL: { fontFamily: fontFamily.displayBold, webFamily: "display", fontSize: 28, lineHeight: 32, fontWeight: "700", letterSpacing: -0.6, tabular: true },
  payout: { fontFamily: fontFamily.display, webFamily: "display", fontSize: 34, lineHeight: 38, fontWeight: "800", letterSpacing: -1, tabular: true }, // driver job card
  priceM: { fontFamily: fontFamily.bodySemi, webFamily: "body", fontSize: 17, lineHeight: 22, fontWeight: "600", letterSpacing: -0.2, tabular: true },
  wordmark: { fontFamily: fontFamily.display, webFamily: "display", fontSize: 22, lineHeight: 24, fontWeight: "800", letterSpacing: -0.6 },
} satisfies Record<string, TextStyle>;

/* ------------------------------------------------------------------ */
/* 6. Shadows / elevation                                              */
/* ------------------------------------------------------------------ */
/** RN: spread the object into a style. Android uses `elevation`; iOS uses shadow*. Shadow color is warm charcoal. */
export const shadowsRN = {
  none: {},
  sm: { shadowColor: "#1A1D21", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  md: { shadowColor: "#1A1D21", shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  lg: { shadowColor: "#1A1D21", shadowOpacity: 0.12, shadowRadius: 28, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  cta: { shadowColor: "#B87F08", shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
} as const;

/** CSS box-shadow values (admin + web) */
export const shadowsCSS = {
  none: "none",
  sm: "0 1px 2px rgba(26,29,33,0.06), 0 1px 1px rgba(26,29,33,0.04)",
  md: "0 4px 16px rgba(26,29,33,0.08), 0 1px 2px rgba(26,29,33,0.04)",
  lg: "0 10px 28px rgba(26,29,33,0.12), 0 2px 6px rgba(26,29,33,0.06)",
  cta: "0 6px 14px rgba(184,127,8,0.28)",
  focus: "0 0 0 3px rgba(232,163,23,0.35)",
} as const;

/* ------------------------------------------------------------------ */
/* 7. Component-level tokens                                           */
/* ------------------------------------------------------------------ */
/** Bottom sheet (customer home / booking steps / tracking). Motion owned by Mobile Feel. */
export const sheet = {
  bg: palette.white,
  radiusTop: 28,
  handle: { width: 40, height: 5, radius: 3, color: palette.sand300, marginTop: 8 },
  paddingX: 20,
  paddingTop: 12,
  shadowRN: { shadowColor: "#1A1D21", shadowOpacity: 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: -6 }, elevation: 16 },
  shadowCSS: "0 -6px 24px rgba(26,29,33,0.14)",
  scrim: "rgba(26,29,33,0.32)",
} as const;

/** Styled static map (MapPlaceholder on web; also the custom style for react-native-maps). */
export const mapStyle = {
  land: "#EEEAE1",
  landAlt: "#E6E1D6", // parks/blocks
  park: "#DDE5D3",
  water: "#CFDDE3",
  roadMinor: "#FFFFFF",
  roadMajor: "#F9F6F0",
  roadCasing: "#D7D2C7",
  highway: "#D9DDE1", // steel-tinted
  highwayCasing: "#BFC5CB",
  label: "#8E959C",
  route: palette.ink900,
  routeWidth: 5,
  routeCasing: "#FFFFFF",
  pinPickup: palette.amber500, // amber disc, charcoal ring+center dot
  pinDropoff: palette.amber500, // amber rounded-square, charcoal inner square
  pinStroke: palette.ink900,
  driverDot: palette.ink900, // charcoal disc with truck icon, white ring, soft halo
  driverHalo: "rgba(26,29,33,0.12)",
} as const;

/** Hold-to-accept ring/button (driver). Duration ~600ms, owned by Mobile Feel. */
export const holdToAccept = {
  height: 64,
  radius: 999,
  trackBg: palette.ink900, // charcoal button body
  fill: palette.amber500, // progress fill sweeps left→right across the pill
  label: palette.paper, // "Hold to accept" on charcoal; flips to ink900 once fill passes it
  labelFilled: palette.ink900,
  ring: { size: 40, stroke: 4, track: palette.ink700, fill: palette.amber500 }, // leading circular ring icon
  durationMs: 600,
} as const;

/** Pressed / state colors (motion itself owned by Mobile Feel: scale 0.97 spring). */
export const states = {
  primaryBg: palette.amber500, primaryPressed: palette.amber600,
  secondaryBg: palette.ink900, secondaryPressed: "#000000",
  outlineBorder: palette.sand300, outlinePressedBg: palette.sand150,
  ghostPressedBg: palette.sand150,
  rowPressedBg: palette.sand150,
  focusRing: palette.amber300,
  disabledBg: palette.sand150, disabledText: palette.steel500,
} as const;

/* ------------------------------------------------------------------ */
/* 8. Misc                                                             */
/* ------------------------------------------------------------------ */
export const iconSize = { sm: 16, md: 20, lg: 24, xl: 28 } as const;
export const iconStroke = 1.75; // lucide default is 2; 1.75 reads more premium at 20–24px
export const zIndex = { base: 0, sticky: 10, header: 20, sheet: 40, toast: 60 } as const;
export const opacity = { disabled: 0.4, pressed: 0.85 } as const;

/** Tailwind `theme.extend` fragment shared by apps/mobile/tailwind.config.js and apps/admin/tailwind.config.ts */
export const tailwindExtend = {
  colors: {
    charcoal: palette.ink900, // kept for backwards-compat with existing classNames
    paper: palette.paper,
    amber: { DEFAULT: palette.amber500, 50: palette.amber50, 100: palette.amber100, 300: palette.amber300, 500: palette.amber500, 600: palette.amber600, 700: palette.amber700 },
    steel: { DEFAULT: palette.steel600, 300: palette.steel300, 400: palette.steel400, 500: palette.steel500, 600: palette.steel600 },
    ink: { 700: palette.ink700, 800: palette.ink800, 900: palette.ink900 },
    sand: { 150: palette.sand150, 200: palette.sand200, 300: palette.sand300, 600: palette.sand600 },
    'border-input': palette.sand600,
    'amber-ink': palette.amber700,
    line: palette.sand200,
    surface: palette.white,
    success: { DEFAULT: palette.green600, soft: palette.green50 },
    danger: { DEFAULT: palette.red600, soft: palette.red50 },
    info: { DEFAULT: palette.blue600, soft: palette.blue50 },
  },
  borderRadius: { xs: "6px", sm: "10px", md: "14px", lg: "18px", xl: "24px" },
  fontFamily: {
    display: ["PlusJakartaSans_800ExtraBold", "Plus Jakarta Sans"],
    heading: ["PlusJakartaSans_700Bold", "Plus Jakarta Sans"],
    sans: ["Inter_400Regular", "Inter"],
    medium: ["Inter_500Medium", "Inter"],
    semibold: ["Inter_600SemiBold", "Inter"],
    bold: ["Inter_700Bold", "Inter"],
  },
} as const;

export const tokens = { APP_NAME, palette, sheet, mapStyle, holdToAccept, states, colors, statusTone, toneColors, space, layout, radii, fontFamily, fontStack, type, shadowsRN, shadowsCSS, iconSize, iconStroke, zIndex, opacity, tailwindExtend };
export default tokens;
