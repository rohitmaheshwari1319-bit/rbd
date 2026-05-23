/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        rbd: {
          // Brand red — matches the RBD "Trust of India" logo.
          50:  '#FFF1F2',
          100: '#FFE0E2',
          200: '#FFC1C5',
          300: '#FF9298',
          400: '#FB6068',
          500: '#EF3540',
          600: '#E11D2E',
          700: '#BC1424',
          800: '#9A1320',
          900: '#7E1620'
        },
        ink: {
          50:  '#F7F7F8',
          100: '#EDEEF0',
          200: '#D7D9DD',
          300: '#B6BAC1',
          400: '#8C9099',
          500: '#646973',
          600: '#494E58',
          700: '#363A42',
          800: '#21242A',
          900: '#14161A',
          950: '#0B0C0F'
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif']
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,17,21,0.06), 0 8px 24px rgba(15,17,21,0.06)',
        glow: '0 0 0 4px rgba(225,29,46,0.12)'
      },
      keyframes: {
        'fade-in': { '0%': { opacity: 0, transform: 'translateY(4px)' }, '100%': { opacity: 1, transform: 'none' } },
        'pulse-soft': { '0%,100%': { opacity: .85 }, '50%': { opacity: 1 } }
      },
      animation: {
        'fade-in': 'fade-in .25s ease-out both',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite'
      }
    }
  },
  plugins: []
};
