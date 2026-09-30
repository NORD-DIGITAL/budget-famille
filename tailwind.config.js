/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // brand = encre (texte/actions) ; sun = jaune d'accent
        brand: { 50: 'rgb(var(--sun-50) / <alpha-value>)', 100: 'rgb(var(--sun-100) / <alpha-value>)', 400: 'rgb(var(--sun-400) / <alpha-value>)', 500: 'rgb(var(--sun-500) / <alpha-value>)', 600: '#141414', 700: '#000000' },
        sun: Object.fromEntries([50, 100, 300, 400, 500, 600].map((k) => [k, `rgb(var(--sun-${k}) / <alpha-value>)`])),
        ink: { DEFAULT: '#141414', soft: '#3A3A3A', muted: '#767676' },
        cream: { DEFAULT: 'rgb(var(--cream) / <alpha-value>)', tile: 'rgb(var(--cream-tile) / <alpha-value>)', line: 'rgb(var(--cream-line) / <alpha-value>)' },
      },
      fontFamily: { sans: ['Poppins', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}
