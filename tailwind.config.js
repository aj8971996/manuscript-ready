/** @type {import('tailwindcss').Config} */
const withOpacity = (v) => `rgb(var(${v}) / <alpha-value>)`;

module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/app-lib/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        'bg': withOpacity('--color-bg'),
        'surface': withOpacity('--color-surface'),
        'surface-muted': withOpacity('--color-surface-muted'),
        'border': withOpacity('--color-border'),
        'border-strong': withOpacity('--color-border-strong'),
        'text-primary': withOpacity('--color-text-primary'),
        'text-secondary': withOpacity('--color-text-secondary'),
        'text-muted': withOpacity('--color-text-muted'),
        'accent': withOpacity('--color-accent'),
        'accent-subtle': withOpacity('--color-accent-subtle'),
        'severity-blocker': withOpacity('--color-severity-blocker'),
        'severity-attention': withOpacity('--color-severity-attention'),
        'severity-info': withOpacity('--color-severity-info'),
        'status-ready-text': withOpacity('--color-status-ready-text'),
        'status-ready-bg': withOpacity('--color-status-ready-bg'),
        'status-attention-text': withOpacity('--color-status-attention-text'),
        'status-attention-bg': withOpacity('--color-status-attention-bg'),
      },
      spacing: {
        0: '0px', 1: '4px', 2: '8px', 3: '12px', 4: '16px',
        5: '24px', 6: '32px', 7: '48px', 8: '64px',
      },
      borderRadius: { sm: '6px', md: '12px', lg: '20px' },
      fontSize: {
        xs: ['12px', '18px'], sm: ['14px', '21px'], base: ['16px', '24px'],
        lg: ['18px', '27px'], xl: ['22px', '29px'], '2xl': ['28px', '36px'],
        '3xl': ['36px', '47px'],
      },
    },
  },
  plugins: [],
};