import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        panel: 'var(--panel)',
        'panel-soft': 'var(--panel-soft)',
        surface: 'var(--surface)',
        elevated: 'var(--elevated)',
        code: 'var(--code)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        hover: 'var(--hover)',
        subtle: 'var(--subtle)',
        accent: 'var(--accent)',
        'accent-ink': 'var(--accent-ink)',
      },
      boxShadow: {
        soft: '0 18px 45px rgba(0, 0, 0, 0.16)',
      },
    },
  },
  plugins: [typography],
};
