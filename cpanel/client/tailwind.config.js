/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // cPanel-Jupiter-inspired: deep navy header + electric blue accent.
        nav: {
          50:  '#EEF2F7',
          100: '#D7DEEA',
          200: '#A9B6CC',
          300: '#7B8DAE',
          400: '#4F628A',
          500: '#2F4368',
          600: '#1F3358',
          700: '#152648',
          800: '#0E1B36',
          900: '#0A1428',
          950: '#050B19'
        },
        brand: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A'
        },
        ink: {
          50:  '#F7F8FA',
          100: '#EEF0F4',
          200: '#D8DCE3',
          300: '#B6BCC8',
          400: '#8B93A3',
          500: '#5F6776',
          600: '#454C5A',
          700: '#333944',
          800: '#1F242E',
          900: '#11151D',
          950: '#080B12'
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace']
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,17,21,0.05), 0 6px 18px rgba(15,17,21,0.06)',
        tile: '0 1px 0 rgba(15,17,21,0.04), 0 4px 12px rgba(15,17,21,0.05)',
        glow: '0 0 0 4px rgba(37,99,235,0.18)'
      },
      keyframes: {
        'fade-in': { '0%': { opacity: 0, transform: 'translateY(4px)' }, '100%': { opacity: 1, transform: 'none' } },
        'pulse-soft': { '0%,100%': { opacity: .85 }, '50%': { opacity: 1 } }
      },
      animation: {
        'fade-in': 'fade-in .2s ease-out both',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite'
      }
    }
  },
  plugins: []
};
