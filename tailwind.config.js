/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Tipwave brand, taken from the logo: teal (500), pink accent, and the logo's ink for text.
        // 700 is the darkest teal that still passes contrast with white text, so it is the button color.
        brand: {
          50: "#E6F6F9",
          100: "#C2EAF0",
          200: "#8DD8E3",
          300: "#52C2D2",
          400: "#22AABE",
          500: "#06B6C8",
          600: "#0891A6",
          700: "#0E7490",
          800: "#155E75",
          900: "#164E63",
        },
        accent: {
          50: "#FFF1F6",
          100: "#FFE0EB",
          400: "#F0709F",
          500: "#E5548C",
          600: "#CC3D75",
          700: "#A92F5E",
        },
        ink: {
          900: "#1B2530",
          700: "#334155",
          500: "#64748B",
          400: "#94A3B8",
        },
        surface: "#F5F7FA",
        // Existing pages use primary-*; point it at the brand teal so they follow the new colors.
        primary: {
          50: "#E6F6F9",
          500: "#0891A6",
          600: "#0E7490",
          700: "#155E75",
        },
      },
      boxShadow: {
        card: "0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "bounce-in": "bounceIn 0.6s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        bounceIn: {
          "0%": { transform: "scale(0.3)", opacity: "0" },
          "50%": { transform: "scale(1.05)" },
          "70%": { transform: "scale(0.9)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
