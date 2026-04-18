/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        detective: {
          900: 'rgb(var(--d-900) / <alpha-value>)',
          800: 'rgb(var(--d-800) / <alpha-value>)',
          700: 'rgb(var(--d-700) / <alpha-value>)',
          600: 'rgb(var(--d-600) / <alpha-value>)',
          500: 'rgb(var(--d-500) / <alpha-value>)',
          accent: 'rgb(var(--d-accent) / <alpha-value>)',
          warn: 'rgb(var(--d-warn) / <alpha-value>)',
          danger: 'rgb(var(--d-danger) / <alpha-value>)',
          success: 'rgb(var(--d-success) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
}
