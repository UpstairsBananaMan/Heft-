/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        charcoal: "#1A1D21",
        paper: "#F4F1EA",
        amber: "#E8A317",
        steel: "#5C6670",
        line: "#E7E2D8",
        "amber-ink": "#8A5A00",
      },
    },
  },
  plugins: [],
};
