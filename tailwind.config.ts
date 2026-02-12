import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        hammer: {
          orange: "#F97316",
          navy: "#0F172A",
          concrete: "#F8FAFC",
        },
      },
    },
  },
  plugins: [],
};

export default config;

