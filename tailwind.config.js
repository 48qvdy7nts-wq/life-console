export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: "#0a0e27",
          800: "#0f1535",
          700: "#1a1f3a",
        },
        neon: {
          cyan: "#00f0ff",
          purple: "#ff00ff",
          pink: "#ff006e",
        }
      },
      fontFamily: {
        display: ["Poppins", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      animation: {
        float: "float 3s ease-in-out infinite",
        glow: "glow 2s ease-in-out infinite",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        glow: {
          "0%, 100%": { boxShadow: "0 0 5px rgba(0, 240, 255, 0.5)" },
          "50%": { boxShadow: "0 0 20px rgba(0, 240, 255, 1)" },
        },
      }
    },
  },
  plugins: [],
}
