import type { Config } from 'tailwindcss';

const config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // Google Meet Dark Theme Colors
        dark: {
          1: '#202124', // Primary background
          2: '#292a2d', // Secondary background
          3: '#3c4043', // Tertiary/elevated
          4: '#5f6368', // Muted text/borders
        },
        // Google Brand Colors
        blue: {
          1: '#1a73e8', // Primary action blue
          2: '#8ab4f8', // Light blue accent
          3: '#174ea6', // Dark blue
        },
        // Google Meet UI Colors
        meet: {
          green: '#00796b', // Teal accent
          red: '#ea4335', // End call / danger
          yellow: '#fbbc04', // Warning
          surface: '#202124',
          'surface-light': '#292a2d',
          hover: '#3c4043',
          border: '#5f6368',
        },
        // Legacy support (mapped to new colors)
        sky: {
          1: '#e8f0fe',
          2: '#d2e3fc',
          3: '#aecbfa',
        },
        orange: {
          1: '#fa7b17',
        },
        purple: {
          1: '#a142f4',
        },
        yellow: {
          1: '#fbbc04',
        },
        // Success colors
        green: {
          meet: '#1e8e3e',
          hover: '#34a853',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Google Sans', 'Roboto', 'Arial', 'sans-serif'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { transform: 'translateY(10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'scale-in': {
          from: { transform: 'scale(0.95)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
      },
      backgroundImage: {
        hero: "url('/images/hero-background.png')",
        'gradient-meet': 'linear-gradient(135deg, #202124 0%, #292a2d 100%)',
      },
      boxShadow: {
        'meet': '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 4px 8px 3px rgba(0, 0, 0, 0.15)',
        'meet-lg': '0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.3)',
        'control': '0 4px 12px rgba(0, 0, 0, 0.4)',
      },
      borderRadius: {
        'meet': '24px',
        'meet-lg': '28px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;

export default config;
