import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        charcoal: "#1A1D21",
        paper: "#F4F1EA",
        amber: {
          DEFAULT: "#E8A317",
          50: "#FDF6E3",
          100: "#FBEBC0",
          300: "#F2C45A",
          500: "#E8A317",
          600: "#CC8C0C",
          700: "#8A5A00",
        },
        steel: { DEFAULT: "#5C6670", 300: "#A9AEB3", 400: "#8E959C", 500: "#6B737B", 600: "#5C6670" },
        ink: { 700: "#33383E", 800: "#24282D", 900: "#1A1D21" },
        sand: { 150: "#EFEBE3", 200: "#E7E2D8", 300: "#D9D3C7", 600: "#857F73" },
        line: "#E7E2D8",
      },
    },
  },
  plugins: [],
};

export default config;
