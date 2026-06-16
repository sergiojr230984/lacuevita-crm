import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17211d",
        fern: "#f26a21",
        coral: "#c94b1f",
        honey: "#ffb24a"
      },
      boxShadow: {
        soft: "0 14px 45px rgba(23, 33, 29, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
