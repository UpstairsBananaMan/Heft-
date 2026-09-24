/** Shared motion numbers. Screens should not invent their own. */
export const spring = {
  press: { damping: 18, stiffness: 420, mass: 0.6 },
  pop: { damping: 12, stiffness: 260 },
  settle: { damping: 20, stiffness: 180 },
};

export const dur = {
  pressIn: 90,
  fast: 160,
  base: 220,
  reveal: 600,
  layout: 200,
};

export const sheetSpring = { damping: 80, stiffness: 500, mass: 1, overshootClamping: true };
