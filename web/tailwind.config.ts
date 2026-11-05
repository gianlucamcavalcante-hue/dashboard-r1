import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        bg: "var(--bg)",
        card: "var(--card)",
        card2: "var(--card2)",
        border: "var(--border)",
        text: "var(--text)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        accent: "#3a6aa5", // azul-marinho
        pos: "#16a34a",
        neg: "#ef4444",
        warn: "var(--warn)",
        gold: "#f59e0b",
        sky: "#38bdf8",
      },
    },
  },
  plugins: [],
};

export default config;
