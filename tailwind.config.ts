import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core palette
        canvas: "#0F0C09",
        accent: {
          DEFAULT: "#D4A96A",
          muted: "#A87C45",
          subtle: "#2A2118",
        },
        surface: {
          DEFAULT: "#1A1510",
          raised: "#241E17",
          overlay: "#2E271E",
        },
        // Domain colors (warm-toned, distinct on dark canvas)
        domain: {
          fitness: "#7DB87A",   // warm sage green
          personal: "#7BA8C4",  // soft steel blue
          consulting: "#D4845A", // burnt sienna
          corporate: "#9B8EC4", // muted lavender
        },
        // Semantic
        text: {
          primary: "#F0E6D3",
          secondary: "#A89880",
          muted: "#6B5C4A",
        },
        status: {
          urgent: "#E05C5C",
          high: "#E0975C",
          medium: "#D4A96A",
          low: "#7DB87A",
        },
      },
      fontFamily: {
        heading: ["var(--font-dm-serif)", "Georgia", "serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
