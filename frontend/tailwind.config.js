import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        panel: '#17191f',
        surface: '#101217',
        ink: '#f2f5f8',
        muted: '#9ca6b3',
        line: '#2a2f3a',
        accent: '#55c7a5',
      },
      boxShadow: {
        soft: '0 18px 45px rgba(0, 0, 0, 0.22)',
      },
    },
  },
  plugins: [typography],
};
