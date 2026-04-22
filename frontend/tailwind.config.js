/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-charcoal': '#2C2C2C',
        'background-white': '#F5F5F5',
        'grey': {
            light: '#D9D9D9',
            DEFAULT: '#757575',
        },
        'dark-mode-border': '#B8E1EC',
        'dark-mode-text-1': '#EAF5FF',
        'dark-mode-button-background': '#001A69',
        'dark-mode-text-2': '#9FC8FE',

        'light-mode-border': '#757575',
        'light-mode-text-1': '#2C2C2C',
        'light-mode-text-2': '#F5F5F5',
        'light-mode-button-background': '#2C2C2C',
      },
    },
  },
  plugins: [],
}