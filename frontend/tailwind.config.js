/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Manrope", "Inter", "ui-sans-serif", "sans-serif"],
      },
      colors: {
        ink: "#080a12",
        panel: "#10121d",
        violet: "#8b7cff",
        cyan: "#64d7ef",
      },
      boxShadow: {
        panel: "0 16px 60px rgba(0,0,0,.28)",
      },
    },
  },
  plugins: [],
};
