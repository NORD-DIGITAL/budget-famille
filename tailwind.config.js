/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // brand = encre (texte/actions) ; sun = jaune d'accent
        brand: { 50: '#FFF8D6', 100: '#FFEFA3', 400: '#FFD83D', 500: '#FFCC00', 600: '#141414', 700: '#000000' },
        sun: { 50: '#FFFBEA', 100: '#FFF3C2', 300: '#FFE066', 400: '#FFD60A', 500: '#FFCC00', 600: '#E6B800' },
        ink: { DEFAULT: '#141414', soft: '#3A3A3A', muted: '#767676' },
        cream: { DEFAULT: '#FFFCF2', tile: '#FEFAEC', line: '#F1E9CC' },
      },
      fontFamily: { sans: ['Poppins', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}
