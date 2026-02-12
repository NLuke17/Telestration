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
        'border-grey': '#757575',
        'background-white': '#F5F5F5',
      },
    },
  },
  plugins: [],
}