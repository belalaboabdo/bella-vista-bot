import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "media",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: "#E86A1C",
          "orange-light": "#F58428",
          "orange-dark": "#D4622B",
          cream: "#FFFBF5",
          "cream-dark": "#FDF8F4",
          linen: "#F5F0EB",
          sand: "#EDE8E3",
          charcoal: "#2D2A26",
          "charcoal-light": "#3D3830",
          stone: "#5A5348",
          "stone-light": "#6B6560",
          muted: "#9C9590",
        },
      },
      fontFamily: {
        heading: ["var(--font-fraunces)", "Georgia", "serif"],
        body: ["var(--font-outfit)", "system-ui", "sans-serif"],
        sans: ["var(--font-outfit)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};
export default config;
