/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'shrink-width': 'shrinkWidth 5s linear forwards',
      },
      keyframes: {
        slideInRight: {
          '0%': {
            transform: 'translateX(100%)',
            opacity: '0'
          },
          '100%': {
            transform: 'translateX(0)',
            opacity: '1'
          }
        },
        shrinkWidth: {
          '0%': { width: '100%' },
          '100%': { width: '0%' }
        }
      }
    },
  },
  plugins: [],
}

