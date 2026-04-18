/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        detective: {
          900: '#0a0e1a',
          800: '#111827',
          700: '#1a2332',
          600: '#243044',
          500: '#2d3b52',
          accent: '#00d4ff',
          warn: '#ff6b35',
          danger: '#ff3860',
          success: '#23d160',
        },
      },
    },
  },
  plugins: [],
}
