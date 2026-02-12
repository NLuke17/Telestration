/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-charcoal': '#1a1a1a',
        'background-white': '#F5F5F5',
        'grey': {
            light: '#D9D9D9',
            DEFAULT: '#757575',
        },
      },
    },
  },
  plugins: [],
}