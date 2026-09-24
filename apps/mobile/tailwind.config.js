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
        line: "#D9D3C7",
      },
    },
  },
  plugins: [],
};
