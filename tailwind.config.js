/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    screens: {
      xs: "400px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      fontFamily: {
        heading: ["Poppins", "sans-serif"],
        sans: ["Inter", "sans-serif"],
        display: ["Montserrat", "sans-serif"],
        banner: ["Cinzel", "serif"],
        accent: ["Lato", "sans-serif"],
      },
      colors: {
        // Sidebar / brand indigo
        sidebar: {
          from: "#1e1b4b",
          via: "#312e81",
          to: "#3730a3",
        },
        // Header gold rail
        gold: {
          DEFAULT: "#f5c800",
          dark: "#d4a800",
          light: "#f9da5a",
        },
        // Login navy
        navy: {
          950: "#060e2e",
          900: "#0b1640",
          800: "#0d1f5c",
          700: "#111d4e",
          600: "#1b2a6b",
          500: "#2a3d8f",
        },
        brand: {
          red: "#dc2626",
          blue: "#2563eb",
        },
        status: {
          success: "#10b981",
          warning: "#f59e0b",
          danger: "#ef4444",
          info: "#0ea5e9",
          indigo: "#4f46e5",
        },
      },
      boxShadow: {
        card: "0px 1px 1.5px rgba(0,0,0,0.1), 0px 1px 1px rgba(0,0,0,0.1)",
        panel: "0px 40px 80px rgba(0,0,0,0.6), 0px 0px 0px 1px rgba(220,38,38,0.15)",
      },
      borderRadius: {
        xl2: "18px",
      },
    },
  },
  plugins: [],
};
