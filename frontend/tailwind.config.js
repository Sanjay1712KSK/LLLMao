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
        tertiary: 'var(--tertiary)',
        line: 'var(--line)',
        hover: 'var(--hover)',
        subtle: 'var(--subtle)',
        input: 'var(--input)',
        accent: 'var(--accent)',
        'accent-ink': 'var(--accent-ink)',
      },
      boxShadow: {
        soft: '0 22px 70px rgba(0, 0, 0, 0.42)',
        float: '0 20px 90px rgba(0, 0, 0, 0.52)',
      },
    },
  },
  plugins: [typography],
};
