/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        primary: {
          50: "#eef3f9",
          100: "#d6e2f0",
          200: "#adc1e0",
          300: "#84a0cf",
          400: "#5b7fbf",
          500: "#335eae",
          600: "#2a4b8b",
          700: "#203868",
          800: "#172645",
          900: "#0d1322",
        },
        accent: {
          50: "#fbf5e7",
          100: "#f6e8c4",
          200: "#edd189",
          300: "#e4ba4e",
          400: "#d4a24c",
          500: "#c9932e",
          600: "#a67820",
          700: "#805a17",
          800: "#593d10",
          900: "#331f09",
        },
      },
      fontFamily: {
        sans: [
          '"Source Han Sans SC"',
          '"Noto Sans SC"',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          "system-ui",
          "sans-serif",
        ],
        serif: [
          '"Source Han Serif SC"',
          '"Noto Serif SC"',
          '"SimSun"',
          "serif",
        ],
        mono: ['"JetBrains Mono"', '"Fira Code"', "Consolas", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.35s ease-out",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
